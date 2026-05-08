import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { getFeatureUnlocks, getDashboard, FeatureUnlock, DashboardData } from "../api/client";

export default function FeatureUnlocks() {
  const [features, setFeatures] = useState<FeatureUnlock[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [fu, d] = await Promise.all([getFeatureUnlocks(), getDashboard()]);
        setFeatures(fu.features.sort((a, b) => a.xp_required - b.xp_required));
        setTotalXp(fu.total_xp);
        setDash(d);
      } catch (e: any) {
        setErr(e?.message || "Failed to load feature unlocks");
      }
    })();
  }, []);

  return (
    <>
      <Topbar
        title="Feature Unlocks"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        {err && (
          <div className="card" style={{ borderColor: "rgba(239,68,68,0.35)", marginBottom: 14 }}>
            <div className="card-title" style={{ color: "var(--red)" }}>Error</div>
            <div>{err}</div>
          </div>
        )}
        <div className="page-heading">
          <h1>Feature Unlocks</h1>
          <p>Earn XP to unlock new features</p>
        </div>
        <div style={{ margin: "0 0 18px", color: "var(--text-secondary)", fontSize: 14 }}>
          Total XP: <strong style={{ color: "var(--green)" }}>{totalXp.toLocaleString()}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {features.map((f) => {
            const pct = Math.min(100, (totalXp / f.xp_required) * 100);
            return (
              <div
                key={f.key}
                className="card"
                style={{
                  borderLeft: `3px ${f.unlocked ? "solid var(--green)" : "dashed var(--border)"}`,
                  opacity: f.unlocked ? 1 : 0.55,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 28, filter: f.unlocked ? "none" : "grayscale(1)" }}>
                    {f.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {f.unlocked
                        ? "Unlocked"
                        : `Requires ${f.xp_required.toLocaleString()} XP`}
                    </div>
                  </div>
                </div>
                <div className="skill-bar" style={{ height: 6 }}>
                  <div
                    className="skill-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: f.unlocked ? "var(--green)" : "var(--text-secondary)",
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, textAlign: "right" }}>
                  {totalXp.toLocaleString()} / {f.xp_required.toLocaleString()} XP
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
