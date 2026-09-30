import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Uploaded theme HTML is untrusted, executable code. It renders only inside
 * an iframe whose sandbox omits `allow-same-origin` (opaque origin: no access
 * to the dashboard DOM, cookies, storage or tokens) — never injected into the page.
 */
export const OVERLAY_PREVIEW_SANDBOX = 'allow-scripts';

export interface HtmlPreview {
  title: string;
  fileName: string;
  html: string;
}

export function SandboxedHtmlFrame({ preview }: { preview: HtmlPreview }): React.ReactElement {
  return (
    <iframe
      title={`Preview of ${preview.fileName}`}
      sandbox={OVERLAY_PREVIEW_SANDBOX}
      srcDoc={preview.html}
      referrerPolicy="no-referrer"
      className="aspect-video w-full rounded-md border bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:20px_20px]"
    />
  );
}

export function HtmlPreviewDialog({
  preview,
  onOpenChange,
}: {
  preview: HtmlPreview | null;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  return (
    <Dialog open={preview != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{preview?.title ?? 'Preview'}</DialogTitle>
          <DialogDescription>
            {preview?.fileName} — rendered in an isolated sandbox.
          </DialogDescription>
        </DialogHeader>
        {preview ? <SandboxedHtmlFrame preview={preview} /> : null}
      </DialogContent>
    </Dialog>
  );
}
