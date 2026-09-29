import { useState } from 'react';

import { cn } from '@/lib/utils';

/** Team crest, or the team's initial when no logo is uploaded (or it fails to load). */
export function TeamLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className: string;
}): React.ReactElement {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        onError={() => setFailedUrl(logoUrl)}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-secondary/10 font-bold text-secondary',
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
