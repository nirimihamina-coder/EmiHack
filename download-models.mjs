// download-models.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin'
];

mkdirSync('public/models', { recursive: true });

for (const file of FILES) {
  console.log(`⬇️  Téléchargement : ${file}`);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`❌ Échec : ${file} (${res.status})`);
  const buffer = await res.arrayBuffer();
  writeFileSync(join('public/models', file), Buffer.from(buffer));
  console.log(`✅ ${file} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
}

console.log('\n🎉 Tous les modèles sont téléchargés !');
