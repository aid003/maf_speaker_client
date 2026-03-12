"use client";

import { useToast } from "@/shared/lib/toast/toast-context";

export function Toaster() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toaster" role="region" aria-label="Уведомления">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          role="alert"
        >
          <span className="toastMessage">{t.message}</span>
          <button
            type="button"
            className="toastClose"
            aria-label="Закрыть"
            onClick={() => removeToast(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
