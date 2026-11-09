#!/usr/bin/env node
// YouTube Data API v3 uploader. No dependencies (Node 18+). See README.md for the one-time Google setup.
//
//   node tools/youtube/upload.js auth                       # one-time browser sign-in, saves a refresh token
//   node tools/youtube/upload.js upload <video> [options]   # resumable upload
//   node tools/youtube/upload.js whoami                     # which channel the token uploads to
//
// upload options:
//   --title "..."          default: the file name
//   --description "..."    or --description-file path.txt
//   --tags a,b,c
//   --privacy private|unlisted|public   default: private (the API forces private on unverified projects anyway)
//   --category 20          default 20 (Gaming)
//   --thumbnail path.png   set after the upload
//   --kids                 mark as made for kids (default: not made for kids)
//   --notify               notify subscribers (default: no)
//   --short                append #Shorts to the title/description if missing
//   --dry-run              print what would be sent
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const TOKEN_FILE = path.join(__dirname, '.token.json'); // git-ignored
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube', // thumbnails.set needs this one
].join(' ');
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/`;

function loadEnv() {
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function client() {
  loadEnv();
  let id = process.env.YOUTUBE_CLIENT_ID, secret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!id || !secret) {
    // also accept the client_secret*.json Google lets you download, dropped next to this script
    const f = fs.readdirSync(__dirname).find((n) => /^client_secret.*\.json$/.test(n));
    if (f) {
      const j = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
      const c = j.installed || j.web;
      id = c.client_id; secret = c.client_secret;
    }
  }
  if (!id || !secret) {
    throw new Error('No OAuth client. Put YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env.local ' +
      '(or drop the downloaded client_secret_*.json in tools/youtube/). See tools/youtube/README.md.');
  }
  return { id, secret };
}

async function tokenRequest(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`token endpoint: ${j.error} ${j.error_description || ''}`.trim());
  return j;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch (e) { /* the URL is printed anyway */ }
}

async function auth() {
  const { id, secret } = client();
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(12).toString('hex');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPES,
    access_type: 'offline', prompt: 'consent', state,
    code_challenge: challenge, code_challenge_method: 'S256',
  });
  const code = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/') { res.writeHead(404).end(); return; }
      const err = u.searchParams.get('error');
      const ok = !err && u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(ok ? '<h2>Signed in. You can close this tab.</h2>' : `<h2>Sign-in failed: ${err || 'bad state'}</h2>`);
      srv.close();
      ok ? resolve(u.searchParams.get('code')) : reject(new Error('sign-in failed: ' + (err || 'state mismatch')));
    });
    srv.on('error', reject);
    srv.listen(PORT, '127.0.0.1', () => {
      console.log('Opening the browser. If nothing opens, visit:\n' + url + '\n');
      openBrowser(url);
    });
  });
  const t = await tokenRequest({
    client_id: id, client_secret: secret, code, code_verifier: verifier,
    grant_type: 'authorization_code', redirect_uri: REDIRECT,
  });
  if (!t.refresh_token) throw new Error('Google returned no refresh token; revoke the app at myaccount.google.com/permissions and retry.');
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: t.refresh_token }, null, 2));
  console.log('Saved', path.relative(ROOT, TOKEN_FILE));
  await whoami();
}

async function accessToken() {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error('Not signed in. Run: node tools/youtube/upload.js auth');
  const { id, secret } = client();
  const { refresh_token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const t = await tokenRequest({ client_id: id, client_secret: secret, refresh_token, grant_type: 'refresh_token' });
  return t.access_token;
}

async function api(token, url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { const e = JSON.parse(body).error; msg = `${e.code} ${e.message} ${(e.errors || []).map((x) => x.reason).join(',')}`; } catch (_) { /* raw */ }
    const hint = /quotaExceeded/.test(msg) ? ' (uploads cost 1600 quota units; the default is 10,000/day)'
      : /uploadLimitExceeded/.test(msg) ? ' (channel hit its daily upload limit)'
      : /youtubeSignupRequired|forbidden/.test(msg) ? ' (does the Google account have a YouTube channel?)' : '';
    throw new Error(`${url.split('?')[0]} -> ${msg}${hint}`);
  }
  return res;
}

async function whoami() {
  const token = await accessToken();
  const j = await (await api(token, 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true')).json();
  const c = (j.items || [])[0];
  console.log(c ? `Uploads go to: ${c.snippet.title} (${c.id})` : 'Signed in, but this Google account has no YouTube channel.');
}

function parseArgs(argv) {
  const o = { _: [] };
  const flags = new Set(['kids', 'notify', 'short', 'dry-run']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      o[k] = flags.has(k) ? true : argv[++i];
    } else o._.push(a);
  }
  return o;
}

const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' };

async function upload(o) {
  const file = o._[0];
  if (!file || !fs.existsSync(file)) throw new Error('usage: upload <video file> [--title ...]');
  const size = fs.statSync(file).size;
  let title = o.title || path.basename(file, path.extname(file));
  let description = o.description || (o['description-file'] ? fs.readFileSync(o['description-file'], 'utf8') : '');
  if (o.short) {
    if (!/#shorts/i.test(title + description)) description = (description + '\n\n#Shorts').trim();
  }
  if (title.length > 100) throw new Error(`title is ${title.length} chars; YouTube allows 100`);
  const meta = {
    snippet: {
      title, description, categoryId: String(o.category || 20),
      tags: o.tags ? o.tags.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    },
    status: { privacyStatus: o.privacy || 'private', selfDeclaredMadeForKids: !!o.kids, embeddable: true },
  };
  if (o['dry-run']) { console.log(JSON.stringify({ file, size, meta }, null, 2)); return; }

  const token = await accessToken();
  const init = await api(token,
    `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${!!o.notify}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-length': String(size),
        'x-upload-content-type': MIME[path.extname(file).toLowerCase()] || 'video/*',
      },
      body: JSON.stringify(meta),
    });
  const sessionUrl = init.headers.get('location');
  if (!sessionUrl) throw new Error('no resumable session URL returned');

  const CHUNK = 8 * 1024 * 1024 * 4; // 32 MiB, a multiple of 256 KiB
  const fd = fs.openSync(file, 'r');
  let offset = 0, video = null;
  const t0 = Date.now();
  try {
    while (offset < size) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      let res, attempt = 0;
      for (;;) {
        try {
          res = await fetch(sessionUrl, {
            method: 'PUT',
            headers: { 'content-length': String(len), 'content-range': `bytes ${offset}-${offset + len - 1}/${size}` },
            body: buf,
          });
          if (res.status < 500) break;
        } catch (e) { /* network drop: ask where we are and retry */ }
        if (++attempt > 5) throw new Error('upload kept failing');
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        const q = await fetch(sessionUrl, { method: 'PUT', headers: { 'content-length': '0', 'content-range': `bytes */${size}` } }).catch(() => null);
        if (q && q.status === 308) {
          const r = /bytes=0-(\d+)/.exec(q.headers.get('range') || '');
          const have = r ? +r[1] + 1 : 0;
          if (have !== offset) { offset = have; break; } // resend from the server's offset
        }
      }
      if (res && (res.status === 200 || res.status === 201)) { video = await res.json(); offset = size; }
      else if (res && res.status === 308) {
        const r = /bytes=0-(\d+)/.exec(res.headers.get('range') || '');
        offset = r ? +r[1] + 1 : offset + len;
      } else if (res && res.status >= 400) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
      process.stdout.write(`\r${(offset / size * 100).toFixed(0)}%  ${(offset / 1048576).toFixed(1)}/${(size / 1048576).toFixed(1)} MiB  ${((Date.now() - t0) / 1000).toFixed(0)}s `);
    }
  } finally { fs.closeSync(fd); }
  console.log();
  if (!video) throw new Error('upload finished without a video resource');

  if (o.thumbnail) {
    const ext = path.extname(o.thumbnail).toLowerCase();
    await api(token, `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${video.id}`, {
      method: 'POST',
      headers: { 'content-type': ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png' },
      body: fs.readFileSync(o.thumbnail),
    }).then(() => console.log('Thumbnail set.'))
      .catch((e) => console.log('Thumbnail failed (channel needs phone verification for custom thumbnails):', e.message));
  }
  console.log(`Uploaded: https://youtu.be/${video.id}  (${video.status && video.status.privacyStatus})`);
  return video;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = parseArgs(rest);
  if (cmd === 'auth') return auth();
  if (cmd === 'whoami') return whoami();
  if (cmd === 'upload') return upload(o);
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}

if (require.main === module) main().catch((e) => { console.error('\n' + e.message); process.exit(1); });
module.exports = { upload, accessToken };
