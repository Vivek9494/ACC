import {
  BROADCAST_TEXT_MAX_LENGTH,
  BROADCAST_VALIDATION_MESSAGES,
  BroadcastDisplayStatus,
  formatBroadcastPostedLabel,
  formatBroadcastTimeRemaining,
  isValidBroadcastContent,
  type AdminBroadcastView,
  type BroadcastHistoryEntry,
} from '@acc/types';
import { ImagePlus, Loader2, Megaphone, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUploadLimits } from '@/features/settings/settings-api';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { useAdminBroadcast, useBroadcastHistory, useBroadcastMutations } from './broadcast-api';

export function BroadcastPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcast"
        description="Post an announcement banner shown on every signed-in dashboard for 24 hours. Posting a new one replaces the current banner."
      />
      <div className="@container">
        <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <ActiveBroadcastCard />
            <PostBroadcastCard />
          </div>
          <BroadcastHistoryCard />
        </div>
      </div>
    </div>
  );
}

function ActiveBroadcastCard(): React.ReactElement {
  const active = useAdminBroadcast();
  const { remove } = useBroadcastMutations();
  const [confirming, setConfirming] = useState(false);

  if (active.isError) {
    return (
      <QueryErrorCard
        title="Couldn't load the current banner"
        error={active.error}
        onRetry={() => void active.refetch()}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" aria-hidden />
          Current banner
        </CardTitle>
        <CardDescription>What signed-in users see right now.</CardDescription>
      </CardHeader>
      <CardContent>
        {active.isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : active.data ? (
          <div className="space-y-4">
            <BannerPreview broadcast={active.data} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Posted by{' '}
                <span className="font-medium text-foreground">{active.data.postedByName}</span> ·{' '}
                {formatBroadcastTimeRemaining(active.data.remainingSeconds)}
              </p>
              <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                <Trash2 className="size-4" aria-hidden />
                Remove banner
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No active banner.
          </p>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove banner?"
        description="The banner disappears from every dashboard immediately. It stays in the history."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync();
          toast.success('Banner removed');
        }}
      />
    </Card>
  );
}

function BannerPreview({ broadcast }: { broadcast: AdminBroadcastView }): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-lg border bg-primary/5">
      {broadcast.imageUrl ? (
        <img
          src={broadcast.imageUrl}
          alt="Banner"
          className="max-h-72 w-full bg-muted object-contain"
        />
      ) : null}
      {broadcast.text ? (
        <p className="px-4 py-3 text-sm whitespace-pre-wrap">{broadcast.text}</p>
      ) : null}
    </div>
  );
}

function PostBroadcastCard(): React.ReactElement {
  const limits = useUploadLimits();
  const { post } = useBroadcastMutations();
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const imageMaxMb = limits.data?.imageUploadMaxMb ?? null;
  const tooLong = text.trim().length > BROADCAST_TEXT_MAX_LENGTH;

  const pickImage = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    setImage(file);
  };

  const clearImage = () => {
    setImage(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isValidBroadcastContent(text, image !== null)) {
      setError(
        tooLong
          ? BROADCAST_VALIDATION_MESSAGES.textTooLong
          : BROADCAST_VALIDATION_MESSAGES.contentRequired,
      );
      return;
    }
    if (image && imageMaxMb === null) {
      setError('Upload limits are still loading. Try again in a moment.');
      return;
    }
    try {
      await post.mutateAsync({ text, image, imageMaxMb: imageMaxMb ?? 0 });
      setText('');
      clearImage();
      toast.success('Broadcast posted');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a broadcast</CardTitle>
        <CardDescription>A message, an image, or both.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-text">Message</Label>
            <Textarea
              id="broadcast-text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              rows={4}
              placeholder="e.g. Finals moved to Sunday 10 AM at Riverside Park."
              aria-invalid={tooLong || undefined}
              aria-describedby="broadcast-text-count"
            />
            <p
              id="broadcast-text-count"
              className={cn(
                'text-right text-xs',
                tooLong ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {text.trim().length} / {BROADCAST_TEXT_MAX_LENGTH}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-image">Image</Label>
            <input
              ref={fileInput}
              id="broadcast-image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => pickImage(event.target.files?.[0])}
            />
            {previewUrl ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={previewUrl}
                  alt="Selected banner"
                  className="max-h-60 w-full bg-muted object-contain"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 bg-card"
                  onClick={clearImage}
                  aria-label="Remove image"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <ImagePlus className="size-5" aria-hidden />
                Choose an image
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Converted to JPEG before upload{imageMaxMb !== null ? ` · max ${imageMaxMb} MB` : ''}.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={post.isPending}>
            {post.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {post.isPending ? 'Posting…' : 'Post broadcast'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BroadcastHistoryCard(): React.ReactElement {
  const history = useBroadcastHistory();

  if (history.isError) {
    return (
      <QueryErrorCard
        title="Couldn't load broadcast history"
        error={history.error}
        onRetry={() => void history.refetch()}
      />
    );
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Every banner posted, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {history.isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : history.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No broadcasts yet.</p>
        ) : (
          <ul className="divide-y">
            {history.data.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryRow({ entry }: { entry: BroadcastHistoryEntry }): React.ReactElement {
  const active = entry.status === BroadcastDisplayStatus.Active;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      {entry.imageUrl ? (
        <img
          src={entry.imageUrl}
          alt=""
          className="size-14 shrink-0 rounded-md border bg-muted object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{entry.postedByName}</span>
          <Badge variant={active ? 'live' : 'muted'}>
            {active ? 'Active' : entry.removedAt ? 'Removed' : 'Expired'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatBroadcastPostedLabel(entry.postedAt)}
          </span>
        </div>
        {entry.text ? (
          <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {entry.text}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Image only</p>
        )}
      </div>
    </li>
  );
}
