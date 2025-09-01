import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_IMAGES_FILE = path.join(DATA_DIR, 'images.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_IMAGES_FILE))
  fs.writeFileSync(DATA_IMAGES_FILE, '[]', 'utf-8');

export async function readDB() {
  try {
    const raw = await fsp.readFile(DATA_IMAGES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

export async function writeDB(data) {
  const tmp = DATA_IMAGES_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, DATA_IMAGES_FILE);
}
