import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { getWeeklyReport, getDashboard, WeeklyReport, DashboardData } from "../api/client";

export default function Report() {
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [w, d] = await Promise.all([getWeeklyReport(), getDashboard()]);
      setData(w);
      setDash(d);
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Failed to load report");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const maxXp = Math.max(1, ...(data?.daily.map((d) => d.xp) || [0]));

  return (
    <>
      <Topbar
        title="Weekly Report"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        {err && (
          <div className="card" style={{ borderLeft: "3px solid var(--red)", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: "var(--red)", marginBottom: 4 }}>Error</div>
            <div style={{ color: "var(--text-dim)" }}>{err}</div>
          </div>
        )}
        {!data ? (
          <div className="card" style={{ color: "var(--text-muted)" }}>Loading<span className="loading-dots" /></div>
        ) : (
          <>
            <div className="page-heading">
              <h1>Weekly Report</h1>
              <p>Your performance over the last 7 days</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#DCFCE7" }}>&#9889;</div>
                <div className="stat-value">{data.total_week_xp.toLocaleString()}</div>
                <div className="stat-label">Week XP</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#DBEAFE" }}>&#127919;</div>
                <div className="stat-value">{data.total_week_missions}</div>
                <div className="stat-label">Missions Done</div>
                <div className="stat-sub" style={{ color: "var(--text-dim)" }}>Generated: {data.missions_generated}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#FEF3C7" }}>&#128293;</div>
                <div className="stat-value">{data.current_streak}</div>
                <div className="stat-label">Current Streak</div>
                <div className="stat-sub" style={{ color: "var(--text-dim)" }}>Longest: {data.longest_streak}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#F3E8FF" }}>&#127942;</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {data.top_achievement ? `${data.top_achievement.icon} ${data.top_achievement.name}` : "—"}
                </div>
                <div className="stat-label">Top Badge</div>
              </div>
            </div>

            <div className="two-col">
              {/* Daily XP Chart */}
              <div className="card">
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                  Daily XP — Last 7 Days
                </div>
                <div className="chart-bar-container">
                  {data.daily.map((d) => (
                    <div key={d.date} className="chart-bar-item">
                      <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
                        {d.xp > 0 ? d.xp : ""}
                      </span>
                      <div
                        className="chart-bar"
                        style={{
                          height: `${Math.max((d.xp / maxXp) * 120, 4)}px`,
                          background: "var(--green)",
                          opacity: d.xp === 0 ? 0.2 : 1,
                        }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skill Breakdown */}
              <div className="card">
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                  Skill Breakdown — This Week
                </div>
                {data.skill_breakdown.length === 0 && (
                  <div style={{ color: "var(--text-muted)" }}>No data yet.</div>
                )}
                {data.skill_breakdown.map((s) => {
                  const maxSkillXp = Math.max(1, ...data.skill_breakdown.map((x) => x.xp_this_week));
                  const pct = Math.min(100, (s.xp_this_week / maxSkillXp) * 100);
                  return (
                    <div className="skill-row" key={s.id}>
                      <div className="skill-head">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{s.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                          {s.xp_this_week.toLocaleString()} XP
                        </span>
                      </div>
                      <div className="skill-bar">
                        <div className="skill-bar-fill" style={{ width: `${pct}%`, background: "var(--green)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {data.weakest_skill && (
              <div className="card" style={{ marginTop: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                  Recommendation
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Your weakest skill is <strong style={{ color: "var(--green)" }}>
                    {data.weakest_skill.icon} {data.weakest_skill.name}
                  </strong> with only {data.weakest_skill.xp.toLocaleString()} XP. Focus here next
                  week to rebalance your growth.
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
