const path = require('path');
const fs = require('fs');
const https = require('https');

const MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const destDir = path.resolve(__dirname, '..', 'face-models');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

function download(url, file) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${file}`));
        }
        const ws = fs.createWriteStream(file);
        res.pipe(ws);
        ws.on('finish', () => ws.close(() => resolve(file)));
        ws.on('error', reject);
      })
      .on('error', reject);
  });
}

(async () => {
  console.log(`Downloading face-api.js models into ${destDir}...`);
  for (const file of MODELS) {
    const target = path.join(destDir, file);
    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
      console.log(`- ${file} (cached)`);
      continue;
    }
    try {   
      await download(`${BASE_URL}/${file}`, target);
      console.log(`- ${file} OK`);
    } catch (err) {
      console.warn(`- ${file} FAILED: ${err.message}`);
    }
  }
  console.log('Done. Tip: run `npm run models:download` in the server folder if any file is missing.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});