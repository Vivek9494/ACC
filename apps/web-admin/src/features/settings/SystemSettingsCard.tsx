import {
  IMAGE_UPLOAD_MAX_MB_MAX,
  IMAGE_UPLOAD_MAX_MB_MIN,
  VIDEO_UPLOAD_MAX_MB_MAX,
  VIDEO_UPLOAD_MAX_MB_MIN,
  type AdminAppSettings,
} from '@acc/types';
import { Cloud, HardDriveUpload, Loader2, MapPinned, Server } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api-client';

import { FormField } from './FormField';
import { useAdminSettings, useUpdateAdminSettings } from './settings-api';
import {
  isAwsKeyChanged,
  isSystemSettingsDirty,
  systemSettingsValues,
  toUpdateSettingsRequest,
  validateSystemSettings,
  type SystemSettingsErrors,
  type SystemSettingsValues,
} from './settings';

function SectionHeading({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cloud;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SystemSettingsForm({ settings }: { settings: AdminAppSettings }): React.ReactElement {
  const update = useUpdateAdminSettings();
  const saved = systemSettingsValues(settings);
  const [values, setValues] = useState<SystemSettingsValues>(saved);
  const [errors, setErrors] = useState<SystemSettingsErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = isSystemSettingsDirty(values, saved);

  const change = (key: keyof SystemSettingsValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = validateSystemSettings(values);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setFormError(null);
    try {
      const result = await update.mutateAsync(toUpdateSettingsRequest(values));
      setValues(systemSettingsValues(result));
      toast.success('Settings saved');
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save settings.'));
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-6" noValidate>
      <section className="grid gap-4">
        <SectionHeading icon={HardDriveUpload} title="Upload limits" />
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <FormField
            id="video-upload-max"
            label="Video upload size (MB)"
            inputMode="numeric"
            placeholder="100"
            value={values.videoUploadMaxMb}
            onChange={(value) => change('videoUploadMaxMb', value)}
            error={errors.videoUploadMaxMb}
            hint={`${VIDEO_UPLOAD_MAX_MB_MIN}–${VIDEO_UPLOAD_MAX_MB_MAX} MB · player showcase videos`}
          />
          <FormField
            id="image-upload-max"
            label="Image upload size (MB)"
            inputMode="numeric"
            placeholder="5"
            value={values.imageUploadMaxMb}
            onChange={(value) => change('imageUploadMaxMb', value)}
            error={errors.imageUploadMaxMb}
            hint={`${IMAGE_UPLOAD_MAX_MB_MIN}–${IMAGE_UPLOAD_MAX_MB_MAX} MB · photos, posters, broadcast images`}
          />
        </div>
      </section>

      <section className="grid gap-4 border-t pt-6">
        <SectionHeading icon={MapPinned} title="Google Maps" />
        <div className="max-w-xl">
          <FormField
            id="google-maps-key"
            label="Google Maps API key"
            placeholder="AIzaSy…"
            autoComplete="off"
            spellCheck={false}
            value={values.googleMapsApiKey}
            onChange={(value) => change('googleMapsApiKey', value)}
            error={errors.googleMapsApiKey}
            hint="Restrict this key in Google Cloud Console (API restrictions plus HTTP referrer or IP restrictions) so a leaked key has limited use."
          />
        </div>
      </section>

      <section className="grid gap-4 border-t pt-6">
        <SectionHeading icon={Cloud} title="AWS">
          <Badge variant={settings.awsKeyConfigured ? 'secondary' : 'destructive'}>
            {settings.awsKeyConfigured ? 'Configured' : 'Not configured'}
          </Badge>
        </SectionHeading>
        <div className="max-w-xl">
          <FormField
            id="aws-key"
            label="AWS key"
            placeholder="Secret access key"
            autoComplete="off"
            spellCheck={false}
            type={isAwsKeyChanged(values.awsKey) ? 'password' : 'text'}
            value={values.awsKey}
            onChange={(value) => change('awsKey', value)}
            error={errors.awsKey}
            hint="AWS secret access key for server-side S3 uploads, stored on the API only. Leave the masked value unchanged to keep the current key; enter a new value to replace it."
          />
        </div>
      </section>

      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-t pt-6">
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="animate-spin" /> : null}
          Save settings
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || update.isPending}
          onClick={() => {
            setValues(saved);
            setErrors({});
            setFormError(null);
          }}
        >
          Discard changes
        </Button>
        {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
      </div>
    </form>
  );
}

/** Platform configuration (GET/PATCH /admin/settings) — Admin only, like the mobile Settings screen. */
export function SystemSettingsCard(): React.ReactElement {
  const settings = useAdminSettings(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-4 text-primary" />
          System
        </CardTitle>
        <CardDescription>
          Platform-wide configuration. Changes are recorded in the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isError ? (
          <QueryErrorCard
            title="Could not load settings"
            error={settings.error}
            onRetry={() => void settings.refetch()}
          />
        ) : settings.data ? (
          <SystemSettingsForm
            key={Object.values(systemSettingsValues(settings.data)).join('|')}
            settings={settings.data}
          />
        ) : (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
