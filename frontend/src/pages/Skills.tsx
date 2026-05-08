import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { getSkills, getDashboard, Skill, DashboardData } from "../api/client";

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [s, d] = await Promise.all([getSkills(), getDashboard()]);
      setSkills(s);
      setDash(d);
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Failed to load skills");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const avgLevel = skills.length
    ? (skills.reduce((sum, skill) => sum + skill.level, 0) / skills.length).toFixed(1)
    : "0";

  return (
    <>
      <Topbar
        title="Skill Tree"
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
            <div>{err || "Could not load data. Is the backend running?"}</div>
          </div>
        )}

        <div className="page-heading">
          <h1>Skill Tree</h1>
          <p>Track your mastery across all disciplines</p>
        </div>
        <div className="summary-pills">
          <span>{skills.length} Active Skills</span>
          <span>Avg Level {avgLevel}</span>
          <span>Total XP: {(dash?.total_xp || 0).toLocaleString()}</span>
        </div>

        <div className="skill-grid">
          {skills.map((s) => {
            const blocks = Array.from({ length: 10 }, (_, i) => i < s.level);
            const span = Math.max(1, s.level_high - s.level_low);
            const pct = Math.max(0, Math.min(100, (s.xp_in_level / span) * 100));
            const tone = s.name.toLowerCase().replace(/\s+/g, "-");
            return (
              <div className="card skill-card" key={s.id}>
                <div className="sc-head">
                  <div className={`sc-icon skill-bg-${tone}`}>{s.icon}</div>
                  <span className={`skill-level-badge skill-tone-${tone}`}>LVL {s.level}</span>
                </div>
                <div className="sc-name">{s.name}</div>
                <div className="sc-sub">{s.xp.toLocaleString()} / {s.level_high.toLocaleString()} XP</div>
                <div className="skill-bar large">
                  <div className={`skill-bar-fill skill-fill-${tone}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="blocks">
                  {blocks.map((filled, i) => (
                    <div key={i} className={`block ${filled ? `filled skill-fill-${tone}` : ""}`} />
                  ))}
                </div>
                <div className="sc-xp">
                  {s.xp_for_next > 0
                    ? `${s.xp_for_next.toLocaleString()} XP to next level`
                    : "Max level"}
                </div>
                <div className="skill-card-stats">
                  <span><strong>{s.mission_count}</strong>Missions</span>
                  <span><strong>{s.best_score || 0}</strong>Best Score</span>
                  <span><strong>+{(s.xp_this_week || 0).toLocaleString()}</strong>This Week</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
