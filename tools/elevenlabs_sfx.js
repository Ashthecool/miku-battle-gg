// Generates sound effects using ElevenLabs Sound Generation API and saves to game/assets/sounds/
// Usage: node tools/elevenlabs_sfx.js <name> "<prompt>" [duration_seconds=1.5]
const fs = require('fs');
const path = require('path');

function getApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8');
    const m = text.match(/ELEVENLABS_API_KEY=([^\r\n]+)/);
    if (m) return m[1].trim();
  }
  throw new Error('ELEVENLABS_API_KEY not found in environment or .env.local');
}

async function generate(name, prompt, duration = 1.5) {
  const apiKey = getApiKey();
  console.log(`Generating SFX "${name}" with prompt: "${prompt}" (${duration}s)...`);
  
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: duration,
      prompt_influence: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs API error (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const outDir = path.join(__dirname, '..', 'game', 'assets', 'sounds');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const fileName = `${name}.mp3`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, buffer);
  console.log(`Saved ${buffer.length} bytes to ${filePath}`);
  return fileName;
}

if (require.main === module) {
  const [,, name, prompt, dur] = process.argv;
  if (!name || !prompt) {
    console.error('Usage: node tools/elevenlabs_sfx.js <name> "<prompt>" [duration_seconds]');
    process.exit(1);
  }
  generate(name, prompt, dur ? parseFloat(dur) : 1.5)
    .then((f) => console.log(`Done! File: ${f}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { generate };
