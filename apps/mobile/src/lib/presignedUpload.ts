import * as FileSystem from 'expo-file-system/legacy';

export interface PresignedUploadProgress {
  sent: number;
  total: number;
  fraction: number;
}

export interface PresignedUploadTarget {
  uploadUrl: string;
  headers: Record<string, string>;
}

export async function uploadViaPresignedPut(
  target: PresignedUploadTarget,
  file: { uri: string; mimeType: string; sizeBytes: number },
  onProgress?: (progress: PresignedUploadProgress) => void,
): Promise<void> {
  const progressCallback = onProgress
    ? (data: FileSystem.UploadProgressData) => {
        const total = data.totalBytesExpectedToSend || file.sizeBytes;
        onProgress({
          sent: data.totalBytesSent,
          total,
          fraction: total > 0 ? data.totalBytesSent / total : 0,
        });
      }
    : undefined;

  const task = FileSystem.createUploadTask(
    target.uploadUrl,
    file.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': file.mimeType,
        ...target.headers,
      },
    },
    progressCallback,
  );

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error('Upload failed. Please try again.');
  }
}
