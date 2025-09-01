import { randomUUID } from 'crypto';

export function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags))
    return tags
      .map(String)
      .map((t) => t.trim())
      .filter(Boolean);
  if (typeof tags === 'string')
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  return [];
}

export function generateSafeFilename(originalName) {
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const uuid = randomUUID().slice(0, 8);
  return `${timestamp}_${uuid}_${safeName}`;
}

export function parseCustomData(custom) {
  try {
    return typeof custom === 'string' ? JSON.parse(custom) : custom;
  } catch {
    return {};
  }
}
