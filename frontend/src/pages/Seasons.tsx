import { useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import { getCurrentSeason, getSeasonHistory, triggerSeasonReset, getDashboard } from "../api/client";
import type { DashboardData, SeasonData, SeasonHistoryItem, SeasonResetResult } from "../api/types";

const RANK_COLORS: Record<string, string> = {
  Rookie: "#9CA3AF",
  Apprentice: "#3B82F6",
  Skilled: "#8B5CF6",
  Expert: "#F59E0B",
  Master: "#EF4444",
  Legend: "#F97316",
};

export default function Seasons() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [history, setHistory] = useState<SeasonHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetResult, setResetResult] = useState<SeasonResetResult | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = () => {
    Promise.all([getDashboard(), getCurrentSeason(), getSeasonHistory()])
      .then(([d, s, h]) => { setDash(d); setSeason(s); setHistory(h.seasons); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onReset = async () => {
    setResetting(true);
    try {
      const result = await triggerSeasonReset();
      setResetResult(result);
      setConfirmReset(false);
      load();
    } catch {}
    setResetting(false);
  };

  if (loading) return (
    <>
      <Topbar title="Seasons" totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} />
      <main className="content"><div style={{ padding: 32 }}>Loading seasons...</div></main>
    </>
  );

  const pastSeasons = history.filter(s => !s.active);

  return (
    <>
      <Topbar title="Seasons" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
      <main className="content">
        <div style={{ maxWidth: 800 }}>
          <div className="page-heading">
            <h1>Seasons</h1>
            <p>Monthly rank resets keep you climbing</p>
          </div>

          {/* Current Season Card */}
          {season && (
            <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 40 }}>{season.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{season.name}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                    {season.start_date} — {season.end_date} &middot; {season.days_left} days left
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: RANK_COLORS[season.current_rank] || "var(--text)" }}>
                    {season.current_rank}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Current Rank</div>
                </div>
              </div>

              {/* Season Progress Bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
                  <span>Season Progress</span>
                  <span>{season.progress_pct}%</span>
                </div>
                <div style={{ background: "var(--border)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${season.progress_pct}%`, height: "100%", background: "linear-gradient(90deg, #3B82F6, #8B5CF6)", borderRadius: 6, transition: "width 0.5s" }} />
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Season XP", value: season.season_xp.toLocaleString(), color: "var(--green, #16A34A)" },
                  { label: "Missions", value: season.missions_completed.toString(), color: "#3B82F6" },
                  { label: "Peak Rank", value: season.peak_rank, color: RANK_COLORS[season.peak_rank] || "var(--text)" },
                  { label: "Peak XP", value: season.peak_xp.toLocaleString(), color: "#F59E0B" },
                ].map((stat, i) => (
                  <div key={i} style={{ background: "var(--bg, #F9FAFB)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* End Season Button */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: 13 }}
                  onClick={() => setConfirmReset(true)}
                >
                  End Season Early
                </button>
              </div>
            </div>
          )}

          {/* How It Works */}
          <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>How Seasons Work</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 13 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>📅</div>
                <div style={{ fontWeight: 600 }}>Monthly Reset</div>
                <div style={{ color: "var(--text-dim)", fontSize: 12 }}>New season every month</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>📉</div>
                <div style={{ fontWeight: 600 }}>Soft Reset</div>
                <div style={{ color: "var(--text-dim)", fontSize: 12 }}>Keep 70% of your XP</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>🏅</div>
                <div style={{ fontWeight: 600 }}>Season Badge</div>
                <div style={{ color: "var(--text-dim)", fontSize: 12 }}>Earn a badge each season</div>
              </div>
            </div>
          </div>

          {/* Past Seasons */}
          {pastSeasons.length > 0 && (
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Past Seasons</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pastSeasons.map((s) => (
                  <div key={s.id} style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                      <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                        {s.start_date} — {s.end_date}
                      </div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontWeight: 700, color: RANK_COLORS[s.peak_rank] || "var(--text)" }}>{s.peak_rank}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Peak Rank</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontWeight: 700, color: "var(--green, #16A34A)" }}>{(s.ending_xp - s.starting_xp).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>XP Earned</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 50 }}>
                      <div style={{ fontWeight: 700 }}>{s.missions_completed}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Missions</div>
                    </div>
                    {s.badge_awarded && <span style={{ fontSize: 22 }} title="Season Badge">🏅</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastSeasons.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-dim)", fontSize: 14 }}>
              This is your first season. Complete it to start building your season history!
            </div>
          )}
        </div>
      </main>

      {/* Confirm Reset Modal */}
      {confirmReset && (
        <div className="modal-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>End Season Early?</h3>
            <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
              This will finalize {season?.name}, award your season badge, and apply a soft XP reset (keep 70%).
              A new season will begin immediately.
            </p>
            <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={onReset} disabled={resetting}>
                {resetting ? "Resetting..." : "End Season"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Result Modal */}
      {resetResult && (
        <div className="modal-backdrop" onClick={() => setResetResult(null)}>
          <div className="confirm-modal" style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <h3 style={{ color: "var(--green, #16A34A)" }}>{resetResult.message}</h3>
            <p style={{ fontSize: 14, marginBottom: 4 }}>Peak Rank: <strong style={{ color: RANK_COLORS[resetResult.peak_rank] }}>{resetResult.peak_rank}</strong></p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>XP: {resetResult.old_xp.toLocaleString()} → {resetResult.new_xp.toLocaleString()} <span style={{ color: "#EF4444" }}>(-{resetResult.xp_lost.toLocaleString()})</span></p>
            <p style={{ fontSize: 14 }}>Rank: {resetResult.old_rank} → {resetResult.new_rank}</p>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>Season badge added to your inventory!</p>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setResetResult(null)}>
              Start New Season!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
