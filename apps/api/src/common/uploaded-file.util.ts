import { readFileSync } from 'node:fs';

/** Read bytes from a multer file (memory or disk storage). */
export function readUploadedFileBuffer(
  file: { buffer?: Buffer; path?: string } | undefined,
): Buffer | undefined {
  if (!file) {
    return undefined;
  }
  if (file.buffer != null && file.buffer.length > 0) {
    return file.buffer;
  }
  if (file.path) {
    return readFileSync(file.path);
  }
  return undefined;
}
