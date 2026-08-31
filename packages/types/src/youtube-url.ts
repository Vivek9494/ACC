/** Parse a YouTube watch, youtu.be, live, or embed URL into an 11-char video id. */
export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const patterns = [
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:[?&]v=)([a-zA-Z0-9_-]{11})/,
    /(?:\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/** Standard YouTube iframe embed URL (muted autoplay for browser policy). */
export function youtubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean; mute?: boolean },
): string {
  const params = new URLSearchParams();
  if (options?.autoplay !== false) {
    params.set('autoplay', '1');
  }
  if (options?.mute !== false) {
    params.set('mute', '1');
  }
  const query = params.toString();
  return query.length > 0
    ? `https://www.youtube.com/embed/${videoId}?${query}`
    : `https://www.youtube.com/embed/${videoId}`;
}
