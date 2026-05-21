import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const ICONS = {
  success: "✓",
  error:   "✕",
  warn:    "!",
  info:    "i",
};

const COLORS = {
  success: { bg: "#f0fdf4", border: "#86efac", icon: "#16a34a", text: "#15803d" },
  error:   { bg: "#fef2f2", border: "#fca5a5", icon: "#dc2626", text: "#b91c1c" },
  warn:    { bg: "#fffbeb", border: "#fcd34d", icon: "#d97706", text: "#92400e" },
  info:    { bg: "#eff6ff", border: "#93c5fd", icon: "#2563eb", text: "#1d4ed8" },
};

function Toast({ id, type, message, onRemove }) {
  const c = COLORS[type] || COLORS.info;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
        minWidth: "280px",
        maxWidth: "380px",
        animation: "toast-in 0.22s ease",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: c.icon,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: "12px",
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        {ICONS[type]}
      </div>
      <span style={{ flex: 1, fontSize: "13px", color: c.text, lineHeight: 1.5 }}>
        {message}
      </span>
      <button
        onClick={() => onRemove(id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: c.text,
          opacity: 0.6,
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 2px",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function ConfirmDialog({ msg, onYes, onNo }) {
  return (
    <>
      <div
        onClick={onNo}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", zIndex: 9998 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          background: "#fff",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
          padding: "28px 28px 22px",
          maxWidth: "380px",
          width: "calc(100vw - 32px)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚠️</div>
        <p style={{ fontSize: "14px", color: "#1e293b", lineHeight: 1.6, margin: "0 0 22px" }}>
          {msg}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={onNo}
            style={{
              padding: "9px 22px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onYes}
            style={{
              padding: "9px 22px",
              borderRadius: "8px",
              border: "none",
              background: "#dc2626",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 700,
            }}
            autoFocus
          >
            Confirmar
          </button>
        </div>
      </div>
    </>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts]         = useState([]);
  const [confirmState, setConfirm]  = useState(null);
  const timers                       = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type, message, duration = 4500) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      if (duration > 0) {
        timers.current[id] = setTimeout(() => remove(id), duration);
      }
    },
    [remove]
  );

  const confirm = useCallback(
    (msg) =>
      new Promise((resolve) => {
        setConfirm({
          msg,
          onYes: () => { setConfirm(null); resolve(true); },
          onNo:  () => { setConfirm(null); resolve(false); },
        });
      }),
    []
  );

  const toast = useMemo(
    () => ({
      success: (msg)           => add("success", msg, 4500),
      error:   (msg)           => add("error",   msg, 6000),
      warn:    (msg)           => add("warn",     msg, 5000),
      info:    (msg)           => add("info",     msg, 4500),
      confirm,
    }),
    [add, confirm]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast stack */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9990,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <Toast {...t} onRemove={remove} />
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          msg={confirmState.msg}
          onYes={confirmState.onYes}
          onNo={confirmState.onNo}
        />
      )}

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
