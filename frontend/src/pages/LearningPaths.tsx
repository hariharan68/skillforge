import { useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import { getLearningPaths, getDashboard, DashboardData } from "../api/client";
import type { LearningPath } from "../api/types";

export default function LearningPaths() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getLearningPaths(), getDashboard()])
      .then(([r, d]) => { setPaths(r.paths); setDash(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><Topbar title="Learning Paths" totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><main className="content"><div className="spinner" style={{ margin: "40px auto" }} /></main></>;

  return (
    <>
    <Topbar title="Learning Paths" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
    <main className="content">
      <div className="page-heading">
        <h1>Learning Paths</h1>
        <p>Curated paths to guide your skill development from beginner to master.</p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {paths.map((path) => (
          <div key={path.id} className="card" style={{ padding: 20 }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              onClick={() => setExpanded(expanded === path.id ? null : path.id)}
            >
              <span style={{ fontSize: 36 }}>{path.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{path.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{path.description}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Skills: {path.skills.join(", ")} | {path.completed_milestones}/{path.total_milestones} milestones
                </div>
              </div>
              <div style={{ textAlign: "center", minWidth: 60 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: path.progress_pct === 100 ? "var(--green)" : "var(--blue)" }}>
                  {path.progress_pct}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>complete</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ margin: "12px 0 0", background: "var(--border)", borderRadius: 6, height: 6, overflow: "hidden" }}>
              <div style={{
                width: `${path.progress_pct}%`,
                height: "100%",
                background: path.progress_pct === 100 ? "var(--green)" : "linear-gradient(90deg, var(--blue), var(--purple))",
                borderRadius: 6,
                transition: "width 0.3s",
              }} />
            </div>

            {/* Milestones (expanded) */}
            {expanded === path.id && (
              <div style={{ marginTop: 16 }}>
                {path.milestones.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: i < path.milestones.length - 1 ? "1px solid var(--border)" : "none",
                      opacity: m.completed ? 1 : 0.6,
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      display: "grid", placeItems: "center",
                      background: m.completed ? "var(--green)" : "var(--border)",
                      color: m.completed ? "#fff" : "var(--text-dim)",
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {m.completed ? "✓" : m.level}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{m.description}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Level {m.level} required</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
    </>
  );
}
