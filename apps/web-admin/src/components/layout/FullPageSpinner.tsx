import { Loader2 } from 'lucide-react';

export function FullPageSpinner({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
