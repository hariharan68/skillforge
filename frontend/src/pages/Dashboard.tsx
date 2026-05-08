import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import RightPanel from "../components/RightPanel";
import {
  Achievement, getAchievements, getDashboard, DashboardData, getWeeklyReport, WeeklyReport,
  getHeatmap, getGoal, setGoal, getSkillRadar, RadarSkill, getStreakCalendar, StreakDay,
  getPerformanceTrends, TrendPoint, getTimeOfDay, HourData,
  getWeeklyChallenge, WeeklyChallengeData, getSkillRetention, RetentionItem,
  getTopicHeatmap, TopicHeatmapRow, getLearningVelocity, VelocityPoint,
  getMistakePatterns, MistakePattern, getStreakStatus, StreakStatus,
} from "../api/client";

const skillColors: Record<string, string> = {
  Coding: "#3B82F6", Trading: "#F97316", Aptitude: "#8B5CF6", "General IQ": "#16A34A",
};
const skillBgs: Record<string, string> = {
  Coding: "#DBEAFE", Trading: "#FEF3C7", Aptitude: "#F3E8FF", "General IQ": "#ECFDF5",
};
const skillTextColors: Record<string, string> = {
  Coding: "#1D4ED8", Trading: "#92400E", Aptitude: "#6D28D9", "General IQ": "#065F46",
};

function SkeletonLoader() {
  return (
    <main className="content">
      <div className="skeleton skeleton-title" style={{ width: "30%" }} />
      <div className="skeleton skeleton-text" style={{ width: "50%" }} />
      <div className="stats-grid" style={{ marginTop: 16 }}>
        {[1, 2, 3, 4].map((i) => (<div key={i} className="skeleton skeleton-card" />))}
      </div>
      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    </main>
  );
}

function HeatmapCalendar({ days }: { days: { date: string; xp: number }[] }) {
  const getLevel = (xp: number) => {
    if (xp === 0) return "";
    if (xp < 50) return "l1";
    if (xp < 150) return "l2";
    if (xp < 300) return "l3";
    return "l4";
  };
  const recent = days.slice(-140);
  return (
    <div>
      <div className="heatmap-grid">
        {recent.map((d) => (<div key={d.date} className={`heatmap-cell ${getLevel(d.xp)}`} title={`${d.date}: ${d.xp} XP`} />))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>20 weeks ago</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Less</span>
          <div className="heatmap-cell" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell l1" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell l2" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell l3" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell l4" style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>More</span>
        </div>
      </div>
    </div>
  );
}

function RadarChart({ skills }: { skills: RadarSkill[] }) {
  if (skills.length < 3) return null;
  const size = 200, cx = size / 2, cy = size / 2, r = 80;
  const n = skills.length;
  const angleStep = (2 * Math.PI) / n;
  const levels = [25, 50, 75, 100];

  const getPoint = (idx: number, val: number) => {
    const angle = angleStep * idx - Math.PI / 2;
    const dist = (val / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const dataPoints = skills.map((s, i) => getPoint(i, s.normalized));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 220, margin: "0 auto", display: "block" }}>
      {levels.map((l) => {
        const pts = skills.map((_, i) => getPoint(i, l));
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";
        return <path key={l} d={path} fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.5" />;
      })}
      {skills.map((_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="1" opacity="0.3" />;
      })}
      <path d={dataPath} fill="rgba(22, 163, 74, 0.2)" stroke="var(--green)" strokeWidth="2" />
      {dataPoints.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--green)" />))}
      {skills.map((s, i) => {
        const p = getPoint(i, 120);
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill="var(--text-dim)" fontWeight="600">{s.icon} {s.name}</text>;
      })}
    </svg>
  );
}

function StreakCalendarView({ days }: { days: StreakDay[] }) {
  const recent = days.slice(-90);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {recent.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.missions} missions`} style={{
            width: 12, height: 12, borderRadius: 2,
            background: d.active ? "var(--green)" : "var(--border)",
            opacity: d.active ? 1 : 0.4,
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>90 days ago</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Today</span>
      </div>
    </div>
  );
}

function TrendChart({ trends }: { trends: TrendPoint[] }) {
  if (trends.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 12 }}>No data yet</div>;
  const maxScore = Math.max(1, ...trends.map((t) => t.avg_score));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
      {trends.map((t) => (
        <div key={t.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{
            width: "100%", maxWidth: 16,
            height: `${Math.max((t.avg_score / maxScore) * 70, 2)}px`,
            background: t.avg_score >= 75 ? "var(--green)" : t.avg_score >= 50 ? "var(--orange)" : "var(--red)",
            borderRadius: 2,
          }} title={`${t.date}: ${t.avg_score} avg`} />
        </div>
      ))}
    </div>
  );
}

function TimeOfDayChart({ hours }: { hours: HourData[] }) {
  const maxCount = Math.max(1, ...hours.map((h) => h.count));
  const active = hours.filter((h) => h.count > 0);
  if (active.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 12 }}>No data yet</div>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 60 }}>
      {hours.map((h) => (
        <div key={h.hour} style={{
          flex: 1,
          height: `${Math.max((h.count / maxCount) * 50, h.count > 0 ? 4 : 1)}px`,
          background: h.count > 0 ? (h.avg_score >= 75 ? "var(--green)" : "var(--blue)") : "var(--border)",
          borderRadius: 1, opacity: h.count === 0 ? 0.3 : 1,
        }} title={`${h.label}: ${h.count} missions, avg ${h.avg_score}`} />
      ))}
    </div>
  );
}

interface DashboardProps {
  quote?: { text: string; author: string };
}

export default function Dashboard({ quote }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [heatmapDays, setHeatmapDays] = useState<{ date: string; xp: number }[]>([]);
  const [goal, setGoalData] = useState<{ weekly_xp_goal: number; week_xp: number; progress_pct: number } | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [radarSkills, setRadarSkills] = useState<RadarSkill[]>([]);
  const [streakDays, setStreakDays] = useState<StreakDay[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [hours, setHours] = useState<HourData[]>([]);
  const [bestHour, setBestHour] = useState<HourData | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallengeData | null>(null);
  const [retention, setRetention] = useState<RetentionItem[]>([]);
  const [topicGrid, setTopicGrid] = useState<TopicHeatmapRow[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [mistakes, setMistakes] = useState<MistakePattern[]>([]);
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [d, w, a, h, g, radar, streak, trend, tod] = await Promise.all([
        getDashboard(), getWeeklyReport(), getAchievements(), getHeatmap(), getGoal(),
        getSkillRadar(), getStreakCalendar(), getPerformanceTrends(), getTimeOfDay(),
      ]);
      setData(d);
      setWeekly(w);
      setAchievements(a);
      setHeatmapDays(h.days);
      setGoalData(g);
      setRadarSkills(radar.skills);
      setStreakDays(streak.days);
      setTrends(trend.trends);
      setHours(tod.hours);
      setBestHour(tod.best_hour);
      // Load v2 data (non-blocking)
      getWeeklyChallenge().then(setWeeklyChallenge).catch(() => {});
      getSkillRetention().then((r) => setRetention(r.retention)).catch(() => {});
      getTopicHeatmap().then((r) => setTopicGrid(r.grid)).catch(() => {});
      getLearningVelocity().then((r) => setVelocity(r.velocity)).catch(() => {});
      getMistakePatterns().then((r) => setMistakes(r.patterns)).catch(() => {});
      getStreakStatus().then(setStreakStatus).catch(() => {});
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const saveGoal = async () => {
    const val = parseInt(goalInput);
    if (isNaN(val) || val < 0) return;
    await setGoal(val);
    setEditingGoal(false);
    await load();
  };

  if (loading || !data) {
    return (<><Topbar totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><SkeletonLoader /></>);
  }
  if (err) {
    return (<><Topbar totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><main className="content"><div className="card" style={{ borderLeft: "3px solid #EF4444" }}><div style={{ fontWeight: 600, color: "#EF4444", marginBottom: 4 }}>Error</div><div style={{ color: "var(--text-dim)" }}>{err || "Could not load."}</div></div></main></>);
  }

  const maxXp = Math.max(1, ...(weekly?.daily.map((d) => d.xp) || [0]));
  const displayName = data.display_name || "Hari";

  const statCards = [
    { icon: "\u26A1", bg: "#DCFCE7", value: data.total_xp.toLocaleString(), label: "TOTAL XP", sub: `Rank: ${data.rank}`, subColor: "var(--green)" },
    { icon: "\uD83D\uDD25", bg: "#FEF3C7", value: String(data.current_streak), label: "DAY STREAK", sub: `Longest: ${data.longest_streak} \u00B7 x${data.streak_multiplier}`, subColor: "var(--orange)" },
    { icon: "\uD83C\uDFAF", bg: "#DBEAFE", value: `${data.today_missions_completed}/${data.today_missions_total || 3}`, label: "MISSIONS TODAY", sub: data.combo_count && data.combo_count >= 3 ? `Combo x${data.combo_count}!` : "AI Graded", subColor: data.combo_count && data.combo_count >= 3 ? "var(--orange)" : "var(--text-dim)" },
    { icon: "\uD83D\uDCCA", bg: "#F3E8FF", value: String(data.avg_level), label: "AVG SKILL LEVEL", sub: `Across ${data.skills.length} skills`, subColor: "var(--text-dim)" },
  ];

  return (
    <>
      <Topbar totalXp={data.total_xp} rank={data.rank} rankProgressPct={data.rank_progress_pct} nextRankXp={data.next_rank_xp} streak={data.current_streak} streakMultiplier={data.streak_multiplier} showRightPanel={showPanel} onToggleRightPanel={() => setShowPanel(!showPanel)} />
      <main className="content">
        {/* Greeting + Quote */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            {(() => { const h = new Date().getHours(); return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"; })()}, {displayName} &#128075;
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {data.today_missions_total - data.today_missions_completed} missions waiting
          </p>
          {quote && (<p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 6 }}>"{quote.text}" — {quote.author}</p>)}
        </div>

        {/* Goal Tracker */}
        {goal && goal.weekly_xp_goal > 0 && (
          <div className="card" style={{ marginBottom: 14, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Weekly Goal: {goal.week_xp.toLocaleString()} / {goal.weekly_xp_goal.toLocaleString()} XP</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: goal.progress_pct >= 100 ? "var(--green)" : "var(--text-dim)" }}>{goal.progress_pct >= 100 ? "Goal reached!" : `${goal.progress_pct}%`}</span>
            </div>
            <div className="goal-bar"><div className="goal-bar-fill" style={{ width: `${Math.min(100, goal.progress_pct)}%` }} /></div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="stats-grid">
          {statCards.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-sub" style={{ color: s.subColor }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="two-col">
          {/* Skill Overview */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Skill Overview</span>
              <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 500, cursor: "pointer" }} onClick={() => navigate("/skills")}>Manage &rarr;</span>
            </div>
            {data.skills.map((sk) => {
              const span = Math.max(1, sk.level_high - sk.level_low);
              const pct = Math.max(0, Math.min(100, (sk.xp_in_level / span) * 100));
              return (
                <div className="skill-row" key={sk.id}>
                  <div className="skill-head">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{sk.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{sk.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: skillTextColors[sk.name] || "#065F46", background: skillBgs[sk.name] || "#ECFDF5", padding: "2px 6px", borderRadius: 4 }}>LVL {sk.level}</span>
                  </div>
                  <div className="skill-bar"><div className="skill-bar-fill" style={{ width: `${pct}%`, background: skillColors[sk.name] || "var(--green)" }} /></div>
                  <div className="skill-xp-text">{sk.xp.toLocaleString()} XP</div>
                </div>
              );
            })}
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Weekly Activity */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Weekly Activity</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>This Week</span>
              </div>
              <div className="chart-bar-container">
                {(weekly?.daily || []).map((d) => (
                  <div key={d.date} className="chart-bar-item">
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500 }}>{d.xp > 0 ? d.xp : ""}</span>
                    <div className="chart-bar" style={{ height: `${Math.max((d.xp / maxXp) * 110, 4)}px`, background: "var(--green)", opacity: d.xp === 0 ? 0.2 : 1 }} />
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.day}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--green)" }}>Total this week: {(weekly?.daily || []).reduce((a, b) => a + b.xp, 0).toLocaleString()} XP</div>
            </div>

            {/* Achievements */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Recent Achievements</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {achievements.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 14, background: a.unlocked ? "var(--green-light)" : "var(--border)", opacity: a.unlocked ? 1 : 0.5, whiteSpace: "nowrap", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, filter: a.unlocked ? "none" : "grayscale(1)" }}>{a.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: a.unlocked ? "var(--ink)" : "var(--text-muted)" }}>{a.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--green)", fontWeight: 500, cursor: "pointer" }} onClick={() => navigate("/achievements")}>View All &rarr;</div>
            </div>
          </div>
        </div>

        {/* Radar Chart + Streak Calendar */}
        <div className="two-col" style={{ marginTop: 14 }}>
          {/* Skill Radar Chart (#20) */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Skill Radar</div>
            <RadarChart skills={radarSkills} />
          </div>

          {/* Streak Calendar (#21) */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Streak Calendar</div>
            <StreakCalendarView days={streakDays} />
            <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Active days: {streakDays.filter((d) => d.active).length}</span>
              <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>Current: {data.current_streak} days</span>
            </div>
          </div>
        </div>

        {/* Performance Trends + Time of Day */}
        <div className="two-col" style={{ marginTop: 14 }}>
          {/* Performance Trends (#22) */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Score Trends (30d)</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{trends.length} days with data</span>
            </div>
            <TrendChart trends={trends} />
          </div>

          {/* Time of Day (#23) */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Time of Day</span>
              {bestHour && bestHour.count > 0 && <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>Best: {bestHour.label} (avg {bestHour.avg_score})</span>}
            </div>
            <TimeOfDayChart hours={hours} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>00:00</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>12:00</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>23:00</span>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        {heatmapDays.length > 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Activity Heatmap</div>
            <HeatmapCalendar days={heatmapDays} />
          </div>
        )}

        {/* Goal Setting */}
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Weekly XP Goal</span>
            {!editingGoal ? (
              <button className="btn btn-outline" style={{ padding: "3px 10px", minHeight: 26, fontSize: 11 }} onClick={() => { setEditingGoal(true); setGoalInput(String(goal?.weekly_xp_goal || 500)); }}>{goal && goal.weekly_xp_goal > 0 ? "Edit" : "Set Goal"}</button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} style={{ width: 80, padding: "4px 8px", fontSize: 12 }} min={0} />
                <button className="btn btn-primary" style={{ padding: "3px 10px", minHeight: 26, fontSize: 11 }} onClick={saveGoal}>Save</button>
                <button className="btn btn-outline" style={{ padding: "3px 10px", minHeight: 26, fontSize: 11 }} onClick={() => setEditingGoal(false)}>Cancel</button>
              </div>
            )}
          </div>
          {goal && goal.weekly_xp_goal > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
                <span>{goal.week_xp.toLocaleString()} XP earned</span>
                <span>{goal.weekly_xp_goal.toLocaleString()} XP target</span>
              </div>
              <div className="goal-bar"><div className="goal-bar-fill" style={{ width: `${Math.min(100, goal.progress_pct)}%` }} /></div>
            </div>
          )}
          {(!goal || goal.weekly_xp_goal === 0) && !editingGoal && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Set a weekly XP target to track your progress.</div>
          )}
        </div>

        {/* #23: Weekly Challenge */}
        {weeklyChallenge && (
          <div className="card" style={{ marginTop: 14, borderLeft: weeklyChallenge.completed ? "3px solid var(--green)" : "3px solid var(--orange)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Weekly Challenge: {weeklyChallenge.title}</span>
                {weeklyChallenge.completed && <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700, marginLeft: 8 }}>COMPLETED!</span>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>+{weeklyChallenge.reward_xp} XP</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>{weeklyChallenge.description}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
              <span>{weeklyChallenge.progress} / {weeklyChallenge.target_value}</span>
              <span>{weeklyChallenge.progress_pct}%</span>
            </div>
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${weeklyChallenge.progress_pct}%`, background: weeklyChallenge.completed ? "var(--green)" : "var(--orange)" }} /></div>
          </div>
        )}

        {/* #34: Skill Retention + #33: Mistake Patterns */}
        <div className="two-col" style={{ marginTop: 14 }}>
          {/* Skill Retention */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Skill Retention</div>
            {retention.map((r) => (
              <div key={r.skill_name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12 }}>{r.skill_icon} {r.skill_name}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: r.status === "fresh" ? "var(--green-bg)" : r.status === "stale" ? "var(--orange-light)" : "var(--red-light)",
                  color: r.status === "fresh" ? "var(--green)" : r.status === "stale" ? "var(--orange)" : "var(--red)",
                }}>
                  {r.days_since !== null ? `${r.days_since}d ago` : "Never"}
                </span>
              </div>
            ))}
          </div>

          {/* Mistake Patterns */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Weak Areas</div>
            {mistakes.filter((m) => m.struggle_pct > 0).slice(0, 4).map((m) => (
              <div key={m.skill_name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12 }}>{m.skill_icon} {m.skill_name}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: m.struggle_pct > 30 ? "var(--red)" : "var(--orange)" }}>{m.struggle_pct}% struggle</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>avg {m.avg_score}/100</div>
                </div>
              </div>
            ))}
            {mistakes.filter((m) => m.struggle_pct > 0).length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No weak areas detected yet!</div>}
          </div>
        </div>

        {/* #31: Topic Heatmap */}
        {topicGrid.length > 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Topic Heatmap (Skill x Difficulty)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-dim)", fontWeight: 600 }}>Skill</th>
                    {["Easy", "Medium", "Hard"].map((d) => (
                      <th key={d} style={{ textAlign: "center", padding: "6px 10px", color: "var(--text-dim)", fontWeight: 600 }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topicGrid.map((row) => (
                    <tr key={row.skill_name}>
                      <td style={{ padding: "6px 10px", fontWeight: 500 }}>{row.skill_icon} {row.skill_name}</td>
                      {row.cells.map((cell) => {
                        const bg = cell.count === 0 ? "var(--border)" : cell.avg_score >= 75 ? "var(--green-bg)" : cell.avg_score >= 50 ? "var(--orange-light)" : "var(--red-light)";
                        const color = cell.count === 0 ? "var(--text-muted)" : cell.avg_score >= 75 ? "var(--green)" : cell.avg_score >= 50 ? "var(--orange)" : "var(--red)";
                        return (
                          <td key={cell.difficulty} style={{ textAlign: "center", padding: "6px 10px" }}>
                            <div style={{ background: bg, color, borderRadius: 6, padding: "4px 8px", fontWeight: 700, fontSize: 13 }}>
                              {cell.count > 0 ? cell.avg_score : "—"}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{cell.count} done</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* #32: Learning Velocity */}
        {velocity.length > 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Learning Velocity (XP/hour)</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{velocity.length} days</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
              {velocity.map((v) => {
                const maxVel = Math.max(1, ...velocity.map((p) => p.xp_per_hour));
                return (
                  <div key={v.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: "100%", maxWidth: 16, borderRadius: 2,
                      height: `${Math.max((v.xp_per_hour / maxVel) * 70, 2)}px`,
                      background: v.xp_per_hour > 200 ? "var(--green)" : "var(--blue)",
                    }} title={`${v.date}: ${v.xp_per_hour} XP/hr`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* #15: Streak Freeze Status */}
        {streakStatus && (
          <div className="card" style={{ marginTop: 14, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Streak Protection</span>
              <div style={{ display: "flex", gap: 12 }}>
                {streakStatus.streak_shield_active && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--green-bg)", color: "var(--green)", fontWeight: 600 }}>Shield Active</span>}
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{streakStatus.freezes_remaining} freeze(s) available</span>
              </div>
            </div>
          </div>
        )}

        {/* Today's Missions */}
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Today's Missions</div>
          {data.today_missions.length === 0 && (<div style={{ color: "var(--text-muted)", fontSize: 12 }}>No missions yet. Generate them from Settings or wait for the scheduler.</div>)}
          {data.today_missions.map((m, i) => (
            <div key={m.id} onClick={() => navigate(`/missions?mission=${m.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
              <div className={`checkbox ${m.status === "graded" ? "checked" : "unchecked"}`}>
                {m.status === "graded" && (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: m.status === "graded" ? "var(--text-muted)" : "var(--ink)", textDecoration: m.status === "graded" ? "line-through" : "none" }}>
                  {m.text.length > 80 ? m.text.slice(0, 80) + "\u2026" : m.text}
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={`tag tag-${m.skill_name.toLowerCase().replace(/\s+/g, "-")}`}>{m.skill_icon} {m.skill_name}</span>
                  <span className={`tag tag-${m.difficulty}`}>{m.difficulty}</span>
                  {m.is_challenge && <span className="tag" style={{ background: "#FEE2E2", color: "#991B1B" }}>Challenge</span>}
                  {m.bookmarked && <span style={{ fontSize: 12 }}>&#128278;</span>}
                </div>
              </div>
              <span className="tag tag-xp" style={{ padding: "3px 10px", borderRadius: 6 }}>+{m.xp_reward} XP</span>
            </div>
          ))}
        </div>
      </main>

      <RightPanel open={showPanel} onClose={() => setShowPanel(false)} rank={data.rank} totalXp={data.total_xp} nextRankXp={data.next_rank_xp} rankProgressPct={data.rank_progress_pct} streak={data.current_streak} recentNotifications={data.recent_notifications || []} />
    </>
  );
}
