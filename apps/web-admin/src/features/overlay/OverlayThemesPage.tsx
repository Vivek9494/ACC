import { OVERLAY_THEME_MESSAGES, type OverlayThemeSummary } from '@acc/types';
import { Loader2, MonitorPlay, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { RowActionsMenu } from '@/components/RowActionsMenu';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useOverlayThemeMutations, useOverlayThemes } from './overlay-themes-api';

function themePath(themeId: string): string {
  return `/overlay/${encodeURIComponent(themeId)}`;
}

function ThemeCard({
  theme,
  onOpen,
  onDelete,
}: {
  theme: OverlayThemeSummary;
  onOpen: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      className="cursor-pointer gap-3 py-4 transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MonitorPlay className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-secondary">{theme.name}</p>
            <p className="text-sm text-muted-foreground">
              {theme.uploadedCount} of {theme.totalControls} controls uploaded
            </p>
          </div>
        </div>
        <RowActionsMenu label={theme.name} onEdit={onOpen} onDelete={onDelete} />
      </CardContent>
    </Card>
  );
}

/** /overlay — Admin-only list of uploaded broadcast overlay themes. */
export function OverlayThemesPage(): React.ReactElement {
  const navigate = useNavigate();
  const themes = useOverlayThemes();
  const { remove } = useOverlayThemeMutations();
  const [pendingDelete, setPendingDelete] = useState<OverlayThemeSummary | null>(null);

  const openTheme = (themeId: string) => void navigate(themePath(themeId));

  return (
    <>
      <PageHeader
        title="Overlay"
        description="Broadcast overlay themes — upload one HTML graphic per overlay control."
        actions={
          <Button onClick={() => void navigate('/overlay/new')}>
            <Plus />
            Add New Theme
          </Button>
        }
      />

      {themes.isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : themes.isError ? (
        <QueryErrorCard
          title="Couldn't load overlay themes"
          error={themes.error}
          onRetry={() => void themes.refetch()}
        />
      ) : themes.data.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <MonitorPlay className="size-8 text-muted-foreground" />
            <p className="font-semibold">No themes yet</p>
            <p className="text-sm text-muted-foreground">
              Add a theme to upload HTML graphics for the overlay controls.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.data.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onOpen={() => openTheme(theme.id)}
              onDelete={() => setPendingDelete(theme)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={OVERLAY_THEME_MESSAGES.deleteConfirmTitle}
        description={OVERLAY_THEME_MESSAGES.deleteConfirmMessage(pendingDelete?.name ?? '')}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          toast.success(`${pendingDelete.name} deleted`);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
