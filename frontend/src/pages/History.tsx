import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import {
  getMissionHistory,
  getSkills,
  getDashboard,
  Mission,
  Skill,
  DashboardData,
} from "../api/client";

export default function History() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [skillFilter, setSkillFilter] = useState<number | undefined>();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const perPage = 10;

  const load = async (p = page) => {
    setLoading(true);
    try {
      const [hist, sk, d] = await Promise.all([
        getMissionHistory({
          skill_id: skillFilter,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page: p,
        }),
        getSkills(),
        getDashboard(),
      ]);
      setMissions(hist.missions);
      setTotal(hist.total);
      setSkills(sk);
      setDash(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    setPage(1);
  }, [skillFilter, startDate, endDate]);

  useEffect(() => {
    load(page);
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <Topbar
        title="Mission History"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="page-heading">
          <h1>Mission History</h1>
          <p>All your graded missions</p>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Filters</div>
          <div className="history-filters">
            <div style={{ minWidth: 160 }}>
              <label className="form-label">Skill</label>
              <select
                value={skillFilter ?? ""}
                onChange={(e) =>
                  setSkillFilter(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">All Skills</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <label className="form-label">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate((e.target as HTMLInputElement).value)}
              />
            </div>
            <div style={{ minWidth: 150 }}>
              <label className="form-label">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ color: "var(--text-muted)" }}>
            Loading<span className="loading-dots" />
          </div>
        ) : missions.length === 0 ? (
          <div className="card" style={{ color: "var(--text-muted)" }}>No graded missions found.</div>
        ) : (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-dim)", fontWeight: 600 }}>
              {total} mission{total !== 1 ? "s" : ""} found — Page {page}/{totalPages}
            </div>

            {missions.map((m) => {
              const good = (m.score ?? 0) >= 75;
              return (
                <div className="card mission-card" key={m.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <span className={`tag tag-${m.skill_name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {m.skill_icon} {m.skill_name}
                    </span>
                    <span className={`tag tag-${m.difficulty}`}>
                      {m.difficulty.toUpperCase()}
                    </span>
                    <span className="tag tag-xp">+{m.xp_earned ?? 0} XP</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
                      {m.date}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 12, lineHeight: 1.5 }}>{m.text}</div>
                  <div style={{
                    background: good ? "var(--green-bg)" : "#FEF2F2",
                    borderLeft: `3px solid ${good ? "var(--green)" : "var(--red)"}`,
                    borderRadius: 8, padding: 14,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: good ? "var(--green)" : "var(--red)" }}>
                          {m.score ?? 0}
                        </span>
                        <span style={{ fontSize: 14, color: "var(--text-dim)" }}>/100</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>XP Earned</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--green)" }}>
                          +{m.xp_earned ?? 0}
                        </div>
                      </div>
                    </div>
                    {m.feedback && (
                      <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
                        {m.feedback}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 18, alignItems: "center" }}>
              <button
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 600 }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
