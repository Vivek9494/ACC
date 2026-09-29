import {
  IMAGE_UPLOAD_MIME_TYPE,
  type MediaUploadCompleteRequest,
  type MediaUploadSessionRequest,
  type MediaUploadSessionResponse,
} from '@acc/types';

import { apiFetch } from '@/lib/api-client';

/** Longest edge after re-encoding — banners and posters render well below this. */
const MAX_IMAGE_EDGE_PX = 2048;
const JPEG_QUALITY = 0.85;

/** The API only accepts JPEG uploads, so every picked image is re-encoded (and downscaled if huge). */
export async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process the image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image.'))),
        IMAGE_UPLOAD_MIME_TYPE,
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}

export interface JpegUploadOptions {
  sessionPath: string;
  completePath: string;
  maxBytes: number;
  tooLargeMessage: string;
}

/** Re-encode → upload session → presigned PUT straight to storage → complete (same flow as the mobile app). */
export async function uploadJpegImage<T>(file: File, options: JpegUploadOptions): Promise<T> {
  const jpeg = await toJpeg(file);
  if (jpeg.size > options.maxBytes) throw new Error(options.tooLargeMessage);

  const sessionBody: MediaUploadSessionRequest = {
    mimeType: IMAGE_UPLOAD_MIME_TYPE,
    sizeBytes: jpeg.size,
  };
  const session = await apiFetch<MediaUploadSessionResponse>(options.sessionPath, {
    method: 'POST',
    body: sessionBody,
  });

  let put: Response;
  try {
    put = await fetch(session.uploadUrl, {
      method: session.uploadMethod,
      headers: session.headers,
      body: jpeg,
    });
  } catch {
    throw new Error('Could not upload the image. Check your connection and try again.');
  }
  if (!put.ok) throw new Error(`Image upload failed (${put.status}).`);

  const completeBody: MediaUploadCompleteRequest = {
    storageKey: session.storageKey,
    mimeType: IMAGE_UPLOAD_MIME_TYPE,
    sizeBytes: jpeg.size,
  };
  return apiFetch<T>(options.completePath, { method: 'POST', body: completeBody });
}
