import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CadastrosProvider } from "./context/CadastrosContext";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("React render error:", error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px",
          background: "#fff1f2",
          minHeight: "100vh",
          fontFamily: "monospace",
        }}>
          <h2 style={{ color: "#dc2626", marginBottom: "16px" }}>
            Erro ao renderizar o sistema
          </h2>
          <pre style={{
            background: "#fff",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "16px",
            fontSize: "13px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "#7f1d1d",
          }}>
            {String(this.state.error)}
            {this.state.info?.componentStack}
          </pre>
          <button
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <CadastrosProvider>
            <App />
          </CadastrosProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
