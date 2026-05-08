import { useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import { getCommunityChallenge, claimCommunityChallenge, getDashboard, DashboardData } from "../api/client";
import type { CommunityChallenge } from "../api/types";

export default function CommunityChallenges() {
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);

  const load = () => {
    Promise.all([getCommunityChallenge(), getDashboard()])
      .then(([data, d]) => { setChallenges(data.challenges); setDash(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onClaim = async (index: number) => {
    setClaiming(index);
    try {
      await claimCommunityChallenge(index);
      load();
    } catch {}
    setClaiming(null);
  };

  if (loading) return <><Topbar title="Community Challenges" totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><main className="content"><div style={{ padding: 32 }}>Loading challenges...</div></main></>;

  return (
    <>
    <Topbar title="Community Challenges" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
    <main className="content">
      <div style={{ maxWidth: 800 }}>
        <div className="page-heading">
          <h1>Community Challenges</h1>
          <p>Weekly challenges to push your limits</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {challenges.map((c, i) => (
            <div key={i} style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{c.description}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>+{c.reward_xp} XP</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>{c.progress}/{c.target_value}</span>
                  <span>{c.progress_pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.progress_pct}%`, background: c.completed ? "var(--green)" : "var(--orange)", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
              </div>
              {c.completed && (
                <button
                  onClick={() => onClaim(i)}
                  disabled={claiming === i}
                  style={{ marginTop: 10, padding: "6px 16px", borderRadius: 8, border: "none", background: "var(--green)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {claiming === i ? "Claiming..." : "Claim Reward"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
    </>
  );
}
