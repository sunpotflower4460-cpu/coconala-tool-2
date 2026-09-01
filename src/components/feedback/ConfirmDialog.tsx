import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "実行する",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-overlay" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        {description && <p>{description}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              void Promise.resolve(onConfirm()).finally(() => {
                setBusy(false);
              });
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
