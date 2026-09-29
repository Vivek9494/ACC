import { mbToBytes, type MediaUploadCompleteResponse } from '@acc/types';

import { uploadJpegImage } from '@/lib/image-upload';

export function imageTooLargeMessage(maxMb: number): string {
  return `Image must be ${maxMb} MB or smaller`;
}

export function uploadBroadcastImage(
  file: File,
  maxMb: number,
): Promise<MediaUploadCompleteResponse> {
  return uploadJpegImage<MediaUploadCompleteResponse>(file, {
    sessionPath: '/admin/broadcast/image/upload-session',
    completePath: '/admin/broadcast/image/complete',
    maxBytes: mbToBytes(maxMb),
    tooLargeMessage: imageTooLargeMessage(maxMb),
  });
}
