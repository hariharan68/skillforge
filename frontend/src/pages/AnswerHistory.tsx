import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { getAnswerHistory, getDashboard, getSkills, AnswerHistoryItem, DashboardData, Skill } from "../api/client";

export default function AnswerHistory() {
  const [items, setItems] = useState<AnswerHistoryItem[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [skillFilter, setSkillFilter] = useState<number | undefined>();
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    const [d, s, h] = await Promise.all([
      getDashboard(),
      getSkills(),
      getAnswerHistory({ skill_id: skillFilter, page, per_page: 15 }),
    ]);
    setDash(d);
    setSkills(s);
    setItems(h.items);
    setTotal(h.total);
  };

  useEffect(() => { load().catch(() => {}); }, [page, skillFilter]);

  const totalPages = Math.ceil(total / 15);

  return (
    <>
      <Topbar title="Answer History" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
      <main className="content">
        <div className="page-heading">
          <h1>Answer History</h1>
          <p>Review your past answers and AI feedback</p>
        </div>

        {/* Filters */}
        <div className="pill-tabs" style={{ marginBottom: 16 }}>
          <button className={!skillFilter ? "active" : ""} onClick={() => { setSkillFilter(undefined); setPage(1); }}>All Skills</button>
          {skills.map((s) => (
            <button key={s.id} className={skillFilter === s.id ? "active" : ""} onClick={() => { setSkillFilter(s.id); setPage(1); }}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{total} answers found</div>

        {items.map((item, idx) => (
          <div key={idx} className="card" style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{item.text.length > 100 ? item.text.slice(0, 100) + "..." : item.text}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={`tag tag-${item.skill_name.toLowerCase().replace(/\s+/g, "-")}`}>{item.skill_icon} {item.skill_name}</span>
                  <span className={`tag tag-${item.difficulty}`}>{item.difficulty}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.date}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: item.score >= 75 ? "var(--green)" : item.score >= 50 ? "var(--orange)" : "var(--red)" }}>{item.score}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>/100</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--green)" }}>+{item.xp_earned} XP</div>
              </div>
            </div>

            {expanded === idx && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 4 }}>Your Answer</div>
                  <div style={{ fontSize: 13, color: "var(--text)", background: "var(--bg)", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.answer}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 4 }}>AI Feedback</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--green-bg)", padding: 12, borderRadius: 8, borderLeft: "3px solid var(--green)", fontStyle: "italic", lineHeight: 1.5 }}>{item.feedback}</div>
                </div>
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && <div className="card" style={{ color: "var(--text-muted)" }}>No answer history yet. Complete some missions first!</div>}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span style={{ fontSize: 13, color: "var(--text-dim)", padding: "8px 0" }}>Page {page} of {totalPages}</span>
            <button className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </main>
    </>
  );
}
