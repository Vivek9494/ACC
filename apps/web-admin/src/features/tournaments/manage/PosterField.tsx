import { ImagePlus, Loader2 } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PosterField({
  previewUrl,
  uploading,
  error,
  onPick,
}: {
  previewUrl: string | null;
  uploading: boolean;
  error?: string;
  onPick: (file: File) => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5" data-field="poster">
      <p className="text-sm leading-none font-medium">Tournament Poster</p>
      <div className="flex flex-wrap items-end gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={previewUrl ? 'Change poster' : 'Upload poster'}
          className={cn(
            'relative flex aspect-[3/4] w-40 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary',
            error && 'border-destructive',
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Tournament poster" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 px-3 text-center text-xs">
              <ImagePlus className="size-6" />
              Click to upload poster
            </span>
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin" />
            </span>
          ) : null}
        </button>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {uploading ? 'Uploading poster…' : 'JPEG up to 5MB (other images are converted).'}
          </p>
          {previewUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Change poster
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="poster-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
