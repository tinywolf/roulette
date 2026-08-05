import { useEffect } from "react";

export type ToastType = "success" | "warning" | "error";

export type ToastMessage = {
  id: number;
  key: string;
  type: ToastType;
  text: string;
  duration: number | null;
};

type ToastStackProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

type ToastItemProps = {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  warning: "!",
  error: "×",
};

/**
 * 개별 알림의 자동 만료와 수동 닫기를 담당한다.
 * duration이 null인 시스템 알림은 사용자가 닫을 때까지 유지한다.
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    if (toast.duration === null) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [onDismiss, toast.duration, toast.id]);

  return (
    <div
      className={`toast toast--${toast.type}`}
      role={toast.type === "error" ? "alert" : "status"}
    >
      <span className="toast__icon" aria-hidden="true">
        {ICONS[toast.type]}
      </span>
      <span className="toast__message">{toast.text}</span>
      <button
        className="toast__dismiss"
        type="button"
        aria-label={`${toast.text} 알림 닫기`}
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

/** 화면 위치를 바꾸지 않고 여러 알림을 순서대로 쌓아 표시한다. */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-label="알림">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
