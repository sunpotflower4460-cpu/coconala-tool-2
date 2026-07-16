export type SaveStatusValue = "idle" | "saving" | "saved" | "error";

interface SaveStatusProps {
  status: SaveStatusValue;
  errorMessage?: string;
}

const LABELS: Record<SaveStatusValue, string> = {
  idle: "",
  saving: "保存中…",
  saved: "保存しました",
  error: "保存に失敗しました",
};

export function SaveStatus({ status, errorMessage }: SaveStatusProps) {
  if (status === "idle") return null;
  return (
    <p role="status" className={`save-status save-status--${status}`}>
      {status === "error" ? (errorMessage ?? LABELS.error) : LABELS[status]}
    </p>
  );
}
