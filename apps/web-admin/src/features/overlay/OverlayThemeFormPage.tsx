import {
  OVERLAY_THEME_CONTROL_KEYS,
  OVERLAY_THEME_HTML_EXTENSION,
  OVERLAY_THEME_HTML_MIME_TYPE,
  OVERLAY_THEME_MESSAGES,
  OVERLAY_THEME_NAME_MAX_LENGTH,
  overlayThemeControlLabel,
  type OverlayThemeControlKey,
  type OverlayThemeGraphicSummary,
} from '@acc/types';
import { ArrowLeft, Eye, FileCode2, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, errorMessage } from '@/lib/api-client';

import { HtmlPreviewDialog, type HtmlPreview } from './HtmlPreviewDialog';
import {
  formatFileSize,
  htmlFileError,
  overlayControlSections,
  type OverlayThemeControl,
} from './overlay-themes';
import {
  fetchOverlayGraphicSource,
  useOverlayTheme,
  useOverlayThemeMutations,
} from './overlay-themes-api';

const HTML_ACCEPT = `${OVERLAY_THEME_HTML_EXTENSION},${OVERLAY_THEME_HTML_MIME_TYPE}`;

type StagedFiles = Partial<Record<OverlayThemeControlKey, File>>;
type RowErrors = Partial<Record<OverlayThemeControlKey, string>>;

function ControlRow({
  control,
  uploaded,
  staged,
  error,
  disabled,
  onPick,
  onClearStaged,
  onPreview,
  onRemove,
}: {
  control: OverlayThemeControl;
  uploaded: OverlayThemeGraphicSummary | undefined;
  staged: File | undefined;
  error: string | undefined;
  disabled: boolean;
  onPick: (file: File) => void;
  onClearStaged: () => void;
  onPreview: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `overlay-control-${control.key}`;

  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Label htmlFor={inputId} className="font-semibold">
          {control.label}
        </Label>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {staged ? (
            <span className="font-medium text-primary">
              {staged.name} ({formatFileSize(staged.size)}) — pending upload
            </span>
          ) : uploaded ? (
            <span className="inline-flex items-center gap-1">
              <FileCode2 className="size-3.5" />
              {uploaded.fileName} ({formatFileSize(uploaded.sizeBytes)})
            </span>
          ) : (
            'No file uploaded'
          )}
        </p>
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={HTML_ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onPick(file);
          }}
        />
        {staged || uploaded ? (
          <Button variant="ghost" size="sm" onClick={onPreview} disabled={disabled}>
            <Eye />
            Preview
          </Button>
        ) : null}
        {staged ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Discard ${staged.name}`}
            onClick={onClearStaged}
            disabled={disabled}
          >
            <X />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload />
          {uploaded || staged ? 'Replace' : 'Upload HTML'}
        </Button>
        {uploaded && !staged ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            aria-label={`Remove ${control.label} file`}
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** /overlay/new and /overlay/:themeId — theme name plus one HTML upload per overlay control. */
export function OverlayThemeFormPage(): React.ReactElement {
  const params = useParams<{ themeId?: string }>();
  const navigate = useNavigate();
  const [createdThemeId, setCreatedThemeId] = useState<string | null>(null);
  const themeId = params.themeId ?? createdThemeId ?? undefined;
  const isNew = params.themeId == null;

  const theme = useOverlayTheme(themeId);
  const mutations = useOverlayThemeMutations();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedFiles>({});
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<HtmlPreview | null>(null);
  const [pendingRemove, setPendingRemove] = useState<OverlayThemeControlKey | null>(null);
  const nameSeeded = useRef(false);

  useEffect(() => {
    if (theme.data && !nameSeeded.current) {
      nameSeeded.current = true;
      setName(theme.data.name);
    }
  }, [theme.data]);

  const sections = useMemo(() => overlayControlSections(), []);
  const uploadedByKey = useMemo(() => {
    const map = new Map<OverlayThemeControlKey, OverlayThemeGraphicSummary>();
    for (const graphic of theme.data?.graphics ?? []) map.set(graphic.controlKey, graphic);
    return map;
  }, [theme.data]);

  const stagedKeys = OVERLAY_THEME_CONTROL_KEYS.filter((key) => staged[key] != null);
  const savedName = theme.data?.name ?? '';
  const nameChanged = name.trim() !== savedName;
  const canSave = !saving && (nameChanged || stagedKeys.length > 0);

  const pickFile = (key: OverlayThemeControlKey, file: File) => {
    const error = htmlFileError(file);
    setRowErrors((prev) => ({ ...prev, [key]: error ?? undefined }));
    if (error) return;
    setStaged((prev) => ({ ...prev, [key]: file }));
  };

  const clearStaged = (key: OverlayThemeControlKey) => {
    setStaged((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openPreview = async (key: OverlayThemeControlKey) => {
    const title = overlayThemeControlLabel(key);
    try {
      const file = staged[key];
      if (file) {
        setPreview({ title, fileName: file.name, html: await file.text() });
      } else if (themeId) {
        const source = await fetchOverlayGraphicSource(themeId, key);
        setPreview({ title, fileName: source.fileName, html: source.html });
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the preview.'));
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(OVERLAY_THEME_MESSAGES.nameRequired);
      return;
    }
    setNameError(null);
    setFormError(null);
    setSaving(true);
    try {
      let id = themeId;
      try {
        if (!id) {
          id = (await mutations.create.mutateAsync({ name: trimmed })).id;
          setCreatedThemeId(id);
        } else if (nameChanged) {
          await mutations.rename.mutateAsync({ themeId: id, body: { name: trimmed } });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) setNameError(err.message);
        else setFormError(errorMessage(err));
        return;
      }

      const failures: RowErrors = {};
      for (const key of stagedKeys) {
        const file = staged[key];
        if (!file) continue;
        try {
          await mutations.upload.mutateAsync({ themeId: id, controlKey: key, file });
          clearStaged(key);
        } catch (err) {
          failures[key] = errorMessage(err, 'Upload failed.');
        }
      }
      setRowErrors(failures);

      if (Object.keys(failures).length > 0) {
        toast.error('Some files could not be uploaded.');
        return;
      }
      toast.success(`${trimmed} saved`);
      if (isNew) void navigate(`/overlay/${encodeURIComponent(id)}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && theme.isError) {
    return (
      <QueryErrorCard
        title="Couldn't load this theme"
        error={theme.error}
        onRetry={() => void theme.refetch()}
      />
    );
  }

  if (!isNew && theme.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/overlay"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Overlay
      </Link>

      <PageHeader
        title={isNew ? 'Add New Theme' : (theme.data?.name ?? 'Theme')}
        description={
          isNew
            ? 'Name the theme and upload an HTML file for any of the overlay controls.'
            : `${theme.data?.uploadedCount ?? 0} of ${theme.data?.totalControls ?? 0} controls uploaded`
        }
        actions={
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isNew && !createdThemeId ? 'Create Theme' : 'Save'}
          </Button>
        }
      />

      <Card className="mb-6 py-4">
        <CardContent className="grid max-w-md gap-2 px-4">
          <Label htmlFor="overlay-theme-name">Theme Name</Label>
          <Input
            id="overlay-theme-name"
            value={name}
            maxLength={OVERLAY_THEME_NAME_MAX_LENGTH}
            placeholder="e.g. Night Match"
            aria-invalid={nameError != null}
            disabled={saving}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
          />
          {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
        </CardContent>
      </Card>

      {formError ? (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.title} className="gap-2 py-4">
            <CardContent className="px-4">
              <h2 className="mb-1 text-sm font-bold tracking-wide text-secondary uppercase">
                {section.title}
              </h2>
              {section.controls.map((control) => (
                <ControlRow
                  key={control.key}
                  control={control}
                  uploaded={uploadedByKey.get(control.key)}
                  staged={staged[control.key]}
                  error={rowErrors[control.key]}
                  disabled={saving}
                  onPick={(file) => pickFile(control.key, file)}
                  onClearStaged={() => clearStaged(control.key)}
                  onPreview={() => void openPreview(control.key)}
                  onRemove={() => setPendingRemove(control.key)}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <HtmlPreviewDialog
        preview={preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />

      <ConfirmDialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title="Remove file?"
        description={`The uploaded HTML for "${pendingRemove ? overlayThemeControlLabel(pendingRemove) : ''}" will be permanently deleted.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!pendingRemove || !themeId) return;
          await mutations.removeGraphic.mutateAsync({ themeId, controlKey: pendingRemove });
          toast.success(`${overlayThemeControlLabel(pendingRemove)} file removed`);
          setPendingRemove(null);
        }}
      />
    </div>
  );
}
