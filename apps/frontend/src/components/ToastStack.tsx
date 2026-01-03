import type { Alert } from "../notifications";

interface ToastStackProps {
  toasts: Alert[];
  openLabel: string;
  dismissLabel: string;
  onDismissToast: (id: string) => void;
  onOpenNotifications: () => void;
}

const formatToastTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit"
  });

export default function ToastStack({
  toasts,
  openLabel,
  dismissLabel,
  onDismissToast,
  onOpenNotifications
}: ToastStackProps) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          <div className="toast-header">
            <span className="toast-title">{toast.title}</span>
            <span className="toast-time">
              {formatToastTime(toast.createdAt)}
            </span>
          </div>
          <p className="toast-message">{toast.message}</p>
          <div className="toast-actions">
            <button className="ghost-button tiny" onClick={onOpenNotifications}>
              {openLabel}
            </button>
            <button
              className="ghost-button tiny"
              onClick={() => onDismissToast(toast.id)}
            >
              {dismissLabel}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
