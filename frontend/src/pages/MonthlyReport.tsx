import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { getMonthlyReport, getDashboard, MonthlyReport as MonthlyReportType, DashboardData } from "../api/client";

export default function MonthlyReport() {
  const [data, setData] = useState<MonthlyReportType | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([getMonthlyReport(), getDashboard()])
      .then(([m, d]) => { setData(m); setDash(d); })
      .catch((e) => setErr(e?.message || "Failed to load"));
  }, []);

  const maxXp = Math.max(1, ...(data?.daily.map((d) => d.xp) || [0]));

  return (
    <>
      <Topbar title="Monthly Report" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
      <main className="content">
        {err && <div className="card" style={{ borderLeft: "3px solid var(--red)", marginBottom: 14 }}><div style={{ fontWeight: 700, color: "var(--red)" }}>Error</div><div style={{ color: "var(--text-dim)" }}>{err}</div></div>}
        {!data ? (
          <div className="card" style={{ color: "var(--text-muted)" }}>Loading<span className="loading-dots" /></div>
        ) : (
          <>
            <div className="page-heading">
              <h1>Monthly Report — {data.month}</h1>
              <p>Your performance this month</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#DCFCE7" }}>&#9889;</div>
                <div className="stat-value">{data.total_month_xp.toLocaleString()}</div>
                <div className="stat-label">Month XP</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#DBEAFE" }}>&#127919;</div>
                <div className="stat-value">{data.total_month_missions}</div>
                <div className="stat-label">Missions Done</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#FEF3C7" }}>&#128293;</div>
                <div className="stat-value">{data.current_streak}</div>
                <div className="stat-label">Current Streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#F3E8FF" }}>&#127942;</div>
                <div className="stat-value">{data.avg_score}</div>
                <div className="stat-label">Avg Score</div>
              </div>
            </div>

            {/* Daily XP Chart */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Daily XP — {data.month}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120, overflowX: "auto" }}>
                {data.daily.map((d) => (
                  <div key={d.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 16, flex: 1 }}>
                    <div style={{ width: "100%", maxWidth: 20, height: `${Math.max((d.xp / maxXp) * 100, 2)}px`, background: "var(--green)", borderRadius: 2, opacity: d.xp === 0 ? 0.15 : 1 }} title={`${d.date}: ${d.xp} XP`} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{data.daily[0]?.date}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{data.daily[data.daily.length - 1]?.date}</span>
              </div>
            </div>

            {/* Best Day */}
            {data.best_day && data.best_day.xp > 0 && (
              <div className="card" style={{ marginBottom: 14, background: "var(--green-bg)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>Best Day: {data.best_day.date}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{data.best_day.xp} XP earned, {data.best_day.missions} missions completed</div>
              </div>
            )}

            {/* Skill Breakdown */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Skill Breakdown — This Month</div>
              {data.skill_breakdown.map((s) => {
                const maxSkillXp = Math.max(1, ...data.skill_breakdown.map((x) => x.xp_this_month));
                const pct = Math.min(100, (s.xp_this_month / maxSkillXp) * 100);
                return (
                  <div className="skill-row" key={s.id}>
                    <div className="skill-head">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{s.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>LVL {s.level}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{s.xp_this_month.toLocaleString()} XP</span>
                    </div>
                    <div className="skill-bar"><div className="skill-bar-fill" style={{ width: `${pct}%`, background: "var(--green)" }} /></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
