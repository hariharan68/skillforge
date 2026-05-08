import { useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import { getWeeklyDigest, getDashboard, DashboardData } from "../api/client";
import type { WeeklyDigest as DigestType } from "../api/types";

export default function WeeklyDigest() {
  const [digest, setDigest] = useState<DigestType | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHtml, setShowHtml] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([getWeeklyDigest(), getDashboard()])
      .then(([d, da]) => { setDigest(d); setDash(da); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopyHtml = () => {
    if (digest?.html) {
      navigator.clipboard.writeText(digest.html).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (loading) return <><Topbar title="Weekly Digest" totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><main className="content"><div className="spinner" style={{ margin: "40px auto" }} /></main></>;
  if (!digest) return <><Topbar title="Weekly Digest" totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><main className="content"><p>Could not load digest.</p></main></>;

  return (
    <>
    <Topbar title="Weekly Digest" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
    <main className="content">
      <div className="page-heading">
        <h1>Weekly Digest</h1>
        <p>Your weekly performance summary — copy the HTML to send as an email.</p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{digest.week_xp}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>XP Earned</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--blue)" }}>{digest.week_missions}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Missions</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--purple)" }}>{digest.avg_score}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Avg Score</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--orange)" }}>{digest.current_streak}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Streak</div>
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Daily Activity</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {digest.daily.map((d) => {
            const maxXp = Math.max(...digest.daily.map((x) => x.xp), 1);
            const h = Math.max(4, (d.xp / maxXp) * 80);
            return (
              <div key={d.date} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ background: "var(--green)", height: h, borderRadius: 4, marginBottom: 4, transition: "height 0.3s" }} />
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{d.day}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.xp} XP</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Skills */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Top Skills</h3>
        {digest.top_skills.map((s) => (
          <div key={s.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span>{s.icon} {s.name}</span>
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Level {s.level}</span>
          </div>
        ))}
      </div>

      {/* Email HTML Preview & Copy */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>Email Digest</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => setShowHtml(!showHtml)}>
              {showHtml ? "Hide Preview" : "Show Preview"}
            </button>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleCopyHtml}>
              {copied ? "Copied!" : "Copy HTML"}
            </button>
          </div>
        </div>
        {showHtml && (
          <div
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--card)", maxHeight: 500, overflow: "auto" }}
            dangerouslySetInnerHTML={{ __html: digest.html }}
          />
        )}
      </div>
    </main>
    </>
  );
}
