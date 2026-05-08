import { useState, useEffect, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning" | "xp";
type Toast = { id: number; message: string; type: ToastType; undoFn?: () => void; fading: boolean };

const ICONS: Record<ToastType, [string, string]> = {
  success: ["\u2713", "var(--green)"],
  error: ["\u2717", "var(--red)"],
  info: ["i", "var(--blue)"],
  warning: ["!", "var(--orange)"],
  xp: ["+XP", "var(--green)"],
};

let _listener: ((t: Toast[]) => void) | null = null;
let _toasts: Toast[] = [];
let _id = 0;

export const toastManager = {
  show(message: string, type: ToastType = "info", undoFn?: () => void) {
    const id = ++_id;
    _toasts = [..._toasts.slice(-4), { id, message, type, undoFn, fading: false }];
    _listener?.([..._toasts]);
    setTimeout(() => {
      _toasts = _toasts.map(t => (t.id === id ? { ...t, fading: true } : t));
      _listener?.([..._toasts]);
      setTimeout(() => {
        _toasts = _toasts.filter(t => t.id !== id);
        _listener?.([..._toasts]);
      }, 300);
    }, 4000);
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => { _listener = setToasts; return () => { _listener = null; }; }, []);

  const dismiss = useCallback((id: number) => {
    _toasts = _toasts.filter(t => t.id !== id);
    _listener?.([..._toasts]);
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => {
        const [icon, color] = ICONS[t.type];
        return (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              background: "var(--surface, #fff)", borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,.12)", border: `1.5px solid ${color}`,
              color: "var(--ink)", fontSize: 14, minWidth: 260, maxWidth: 380,
              opacity: t.fading ? 0 : 1, transform: t.fading ? "translateX(40px)" : "none",
              transition: "opacity .3s, transform .3s",
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: "50%", background: color,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: t.type === "xp" ? 10 : 14, flexShrink: 0,
            }}>{icon}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.undoFn && (
              <button
                onClick={() => { t.undoFn!(); dismiss(t.id); }}
                style={{
                  background: "none", border: "none", color, cursor: "pointer",
                  fontWeight: 600, fontSize: 13, padding: "2px 6px", flexShrink: 0,
                }}
              >Undo</button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--ink)", opacity: .4, fontSize: 16, padding: 0, lineHeight: 1,
              }}
            >&times;</button>
          </div>
        );
      })}
    </div>
  );
}
