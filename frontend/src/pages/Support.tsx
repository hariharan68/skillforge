import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { DashboardData, getDashboard, api } from "../api/client";

export default function Support() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [apiKeyStatus, setApiKeyStatus] = useState<"checking" | "set" | "missing">("checking");
  const [dbSize, setDbSize] = useState<string>("");
  const [toast, setToast] = useState("");
  const navigate = useNavigate();

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const checkBackend = async () => {
    setBackendStatus("checking");
    try {
      await api.get("/dashboard");
      setBackendStatus("online");
    } catch {
      setBackendStatus("offline");
    }
  };

  const checkApiKey = async () => {
    setApiKeyStatus("checking");
    try {
      const res = await api.get("/settings");
      setApiKeyStatus(res.data.has_api_key ? "set" : "missing");
    } catch {
      setApiKeyStatus("missing");
    }
  };

  const checkDb = async () => {
    try {
      const res = await api.get("/export");
      const size = JSON.stringify(res.data).length;
      setDbSize(size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} bytes`);
    } catch {
      setDbSize("Unknown");
    }
  };

  useEffect(() => {
    getDashboard().then(setDash).catch(() => undefined);
    checkBackend();
    checkApiKey();
    checkDb();
  }, []);

  const statusDot = (status: string) => {
    const color = status === "online" || status === "set" ? "#16A34A" : status === "checking" ? "#F97316" : "#EF4444";
    return { width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 } as const;
  };

  return (
    <>
      <Topbar
        title="Support"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="page-heading">
          <h1>Support</h1>
          <p>System health checks and quick actions</p>
        </div>

        {/* Health Checks */}
        <div className="card" style={{ marginBottom: 14, padding: 18 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>System Health</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={statusDot(backendStatus)} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Backend Server</span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {backendStatus === "checking" ? "Checking..." : backendStatus === "online" ? "Running on :8000" : "Offline"}
                </span>
              </div>
              <button className="btn btn-outline" style={{ padding: "4px 12px", minHeight: 28, fontSize: 12 }} onClick={checkBackend}>
                Re-check
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={statusDot(apiKeyStatus)} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>OpenAI API Key</span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {apiKeyStatus === "checking" ? "Checking..." : apiKeyStatus === "set" ? "Configured" : "Not set"}
                </span>
              </div>
              {apiKeyStatus === "missing" && (
                <button className="btn btn-primary" style={{ padding: "4px 12px", minHeight: 28, fontSize: 12 }} onClick={() => navigate("/settings")}>
                  Set Key
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={statusDot("online")} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Database</span>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>SQLite · {dbSize || "..."}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ marginBottom: 14, padding: 18 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Quick Actions</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => navigate("/missions")}>Go to Missions</button>
            <button className="btn btn-outline" onClick={() => navigate("/settings")}>Open Settings</button>
            <button className="btn btn-outline" onClick={async () => {
              try {
                const data = await api.get("/export");
                const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `skillforge-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                flash("Data exported successfully.");
              } catch {
                flash("Export failed.");
              }
            }}>Export Data</button>
            <button className="btn btn-outline" onClick={() => { checkBackend(); checkApiKey(); checkDb(); flash("Health checks refreshed."); }}>
              Refresh All Checks
            </button>
          </div>
        </div>

        {/* Help */}
        <div className="card support-card" style={{ padding: 18 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Help</div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Backend</h3>
          <p>Run the backend on port 8000. The frontend calls the API using the same browser host.</p>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>OpenAI Key</h3>
          <p>Use Settings to test and save your API key before generating AI missions.</p>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Progress Data</h3>
          <p>SQLite data lives locally in the backend folder. Use Settings export before resetting progress.</p>
        </div>
        {toast && <div className="app-toast">{toast}</div>}
      </main>
    </>
  );
}
