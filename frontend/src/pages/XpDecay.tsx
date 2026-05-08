import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { getDashboard, getXpDecay, applyXpDecay, DashboardData, XpDecayItem } from "../api/client";

const retentionClass = (days: number) =>
  days <= 3 ? "retention-fresh" : days <= 7 ? "retention-stale" : "retention-rusty";

export default function XpDecay() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [atRisk, setAtRisk] = useState<XpDecayItem[]>([]);
  const [toast, setToast] = useState("");
  const nav = useNavigate();

  const load = async () => {
    const [d, decay] = await Promise.all([getDashboard(), getXpDecay()]);
    setDash(d);
    setAtRisk(decay.at_risk);
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleDecay = async () => {
    if (!confirm("This will apply XP decay to all at-risk skills. Continue?")) return;
    try {
      await applyXpDecay();
      flash("Decay applied.");
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.detail || "Failed to apply decay.");
    }
  };

  return (
    <>
      <Topbar
        title="XP Decay"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="page-heading">
          <h1>XP Decay</h1>
          <p>Practice inactive skills to prevent XP loss</p>
        </div>

        {atRisk.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <h3 style={{ marginTop: 8 }}>All skills are active!</h3>
            <p style={{ color: "var(--text-dim)" }}>Keep practicing to stay sharp.</p>
          </div>
        ) : (
          <>
            <div className="inventory-grid">
              {atRisk.map((s) => (
                <div className="card" key={s.skill_id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 28, width: 44, height: 44, borderRadius: 12, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {s.skill_icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.skill_name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                      {s.days_inactive}d inactive &middot; {s.current_xp} XP
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 13 }}>-{s.xp_at_risk} XP</span>
                      <span className={retentionClass(s.days_inactive)} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>
                        {s.days_inactive <= 3 ? "Fresh" : s.days_inactive <= 7 ? "Stale" : "Rusty"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => nav("/missions")}>Practice Now</button>
              <button className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={handleDecay}>Simulate Decay</button>
            </div>
          </>
        )}
        {toast && <div className="app-toast">{toast}</div>}
      </main>
    </>
  );
}
