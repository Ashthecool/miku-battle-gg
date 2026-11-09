# YouTube uploader

Uploads a video through the YouTube Data API v3 (resumable, no dependencies, Node 18+). An API key cannot upload;
it needs OAuth, so there is a one-time Google setup.

## One-time setup

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project → **APIs & Services → Library** →
   enable **YouTube Data API v3**.
2. **OAuth consent screen**: External, add yourself under **Test users**. (In "Testing" the refresh token expires after
   7 days; click **Publish app** to stop that. Unverified apps are fine for your own channel.)
3. **Credentials → Create credentials → OAuth client ID → Desktop app**. Put the ID and secret in `.env.local`:
   ```
   YOUTUBE_CLIENT_ID=...apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=...
   ```
   (or drop the downloaded `client_secret_*.json` in this folder).
4. `node tools/youtube/upload.js auth`: sign in with the Google account that owns the channel. The refresh token is saved
   to `tools/youtube/.token.json` (git-ignored).

## Use

```
node tools/youtube/upload.js whoami
node tools/youtube/upload.js upload output/miku-battle-adoptive-life-short.mp4 \
  --title "Adoptive Life is in Miku Battle!" --description-file desc.txt --tags "miku battle,adoptive life" \
  --short --privacy private --thumbnail thumb.png
```

`--privacy` is `private` by default. Projects created after July 2020 that have not passed Google's API audit get every
upload locked to private whatever you ask; apply for the audit (YouTube API Services → Audit form) to publish from the API.
Each upload costs 1600 of the 10,000 daily quota units.

From code: `require('./tools/youtube/upload.js').upload({ _: [file], title, privacy })`.
