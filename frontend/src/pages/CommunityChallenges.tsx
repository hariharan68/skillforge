import { useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import { getCommunityChallenge, claimCommunityChallenge, getDashboard, DashboardData } from "../api/client";
import type { CommunityChallenge } from "../api/types";

const cardColors = [
  { bg: "#EEF2FF", accent: "#6366F1", light: "#E0E7FF", gradient: "linear-gradient(135deg, #6366F1, #818CF8)" },
  { bg: "#FFF7ED", accent: "#EA580C", light: "#FFEDD5", gradient: "linear-gradient(135deg, #EA580C, #FB923C)" },
  { bg: "#ECFDF5", accent: "#059669", light: "#D1FAE5", gradient: "linear-gradient(135deg, #059669, #34D399)" },
  { bg: "#FDF2F8", accent: "#DB2777", light: "#FCE7F3", gradient: "linear-gradient(135deg, #DB2777, #F472B6)" },
  { bg: "#FFFBEB", accent: "#D97706", light: "#FEF3C7", gradient: "linear-gradient(135deg, #D97706, #FBBF24)" },
  { bg: "#F0F9FF", accent: "#0284C7", light: "#E0F2FE", gradient: "linear-gradient(135deg, #0284C7, #38BDF8)" },
];

const difficultyMap: Record<string, { label: string; color: string }> = {
  missions_completed: { label: "Missions", color: "#6366F1" },
  perfect_score: { label: "Precision", color: "#EA580C" },
  all_rounder: { label: "Variety", color: "#059669" },
  hard_missions: { label: "Hard Mode", color: "#DB2777" },
  streak: { label: "Consistency", color: "#D97706" },
  xp_earned: { label: "XP Grind", color: "#0284C7" },
  reviews: { label: "Review", color: "#6366F1" },
  early_missions: { label: "Early Bird", color: "#EA580C" },
  no_hints: { label: "No Hints", color: "#059669" },
  combo: { label: "Combo", color: "#DB2777" },
};

export default function CommunityChallenges() {
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

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

  const selectedChallenge = selected !== null ? challenges[selected] : null;
  const selectedColor = selected !== null ? cardColors[selected % cardColors.length] : null;

  if (loading) return <><Topbar title="Community Challenges" totalXp={0} rank="Rookie" rankProgressPct={0} nextRankXp={500} streak={0} streakMultiplier={1} /><main className="content"><div style={{ padding: 32 }}>Loading challenges...</div></main></>;

  return (
    <>
    <Topbar title="Community Challenges" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
    <main className="content">
      <style>{`
        @keyframes cc-pop { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cc-detail-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes cc-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes cc-shine { from { left: -100%; } to { left: 200%; } }
        @keyframes cc-progress-fill { from { width: 0%; } }
        @keyframes cc-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes cc-ring-pulse { 0% { box-shadow: 0 0 0 0 var(--ring-color); } 70% { box-shadow: 0 0 0 8px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

        .cc-card {
          animation: cc-pop 0.4s ease-out both;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .cc-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: inherit;
          border: 2px solid transparent;
          transition: border-color 0.25s ease;
          pointer-events: none;
        }
        .cc-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 12px 28px rgba(0,0,0,0.1) !important;
        }
        .cc-card.cc-selected {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
        }
        .cc-card.cc-selected::after {
          border-color: var(--card-accent);
        }

        .cc-detail-panel {
          animation: cc-detail-in 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        .cc-claim-btn {
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .cc-claim-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }
        .cc-claim-btn:active:not(:disabled) { transform: scale(0.97); }
        .cc-claim-btn::after {
          content: '';
          position: absolute;
          top: 0; width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: cc-shine 2s ease-in-out infinite;
        }

        .cc-stat-card {
          transition: transform 0.2s ease;
        }
        .cc-stat-card:hover {
          transform: translateY(-2px);
        }

        .cc-empty-icon {
          animation: cc-float 3s ease-in-out infinite;
        }

        .cc-progress-ring {
          animation: cc-ring-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div style={{ display: "flex", gap: 24, maxWidth: 1200, width: "100%" }}>
        {/* Left: Challenge Cards */}
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div className="page-heading" style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Community Challenges</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
              Weekly challenges to push your limits — click a card to see details
            </p>
          </div>

          {/* Summary Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Total", value: challenges.length, icon: "🎯", color: "#6366F1" },
              { label: "Completed", value: challenges.filter(c => c.completed).length, icon: "✅", color: "#059669" },
              { label: "In Progress", value: challenges.filter(c => !c.completed && c.progress > 0).length, icon: "⚡", color: "#EA580C" },
            ].map((s, i) => (
              <div key={i} className="cc-stat-card" style={{
                flex: 1, background: "var(--card-bg, #fff)", borderRadius: 12, padding: "10px 14px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, background: s.color + "14",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Challenge Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {challenges.map((c, i) => {
              const color = cardColors[i % cardColors.length];
              const isSelected = selected === i;
              return (
                <div
                  key={i}
                  className={`cc-card${isSelected ? " cc-selected" : ""}`}
                  onClick={() => setSelected(isSelected ? null : i)}
                  style={{
                    // @ts-ignore
                    "--card-accent": color.accent,
                    background: color.bg,
                    borderRadius: 14,
                    padding: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    animationDelay: `${i * 0.06}s`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Icon + XP row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, background: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                    }}>
                      {c.icon}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: color.accent,
                      background: "#fff", borderRadius: 12, padding: "3px 9px",
                    }}>
                      +{c.reward_xp} XP
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{c.title}</span>
                      {c.completed && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: "#fff", background: color.accent,
                          borderRadius: 10, padding: "1px 6px",
                        }}>DONE</span>
                      )}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>{c.description}</p>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, color: "var(--text-dim)" }}>
                      <span style={{ fontWeight: 600 }}>{c.progress}/{c.target_value}</span>
                      <span style={{ fontWeight: 700, color: color.accent }}>{c.progress_pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "#fff", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${c.progress_pct}%`,
                        background: color.accent, borderRadius: 3, transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {challenges.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim)" }}>
              <div className="cc-empty-icon" style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
              <p style={{ fontWeight: 700, fontSize: 15 }}>No challenges this week</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Check back next week for new challenges!</p>
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div style={{ width: 380, flexShrink: 0, position: "sticky", top: 80, alignSelf: "flex-start" }}>
          {selectedChallenge && selectedColor ? (
            <div key={selected} className="cc-detail-panel" style={{
              background: "var(--card-bg, #fff)",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}>
              {/* Header Banner */}
              <div style={{
                background: selectedColor.gradient,
                padding: "28px 24px 24px",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Decorative circles */}
                <div style={{
                  position: "absolute", top: -20, right: -20,
                  width: 100, height: 100, borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                }} />
                <div style={{
                  position: "absolute", bottom: -30, left: -10,
                  width: 70, height: 70, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                }} />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 28, marginBottom: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}>
                    {selectedChallenge.icon}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>
                    {selectedChallenge.title}
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
                    {selectedChallenge.description}
                  </p>
                </div>
              </div>

              {/* Detail Body */}
              <div style={{ padding: "20px 24px 24px" }}>
                {/* Progress Circle & Stats */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
                  {/* Circular Progress */}
                  <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke={selectedColor.light} strokeWidth="7" />
                      <circle
                        cx="40" cy="40" r="34" fill="none"
                        stroke={selectedColor.accent} strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - selectedChallenge.progress_pct / 100)}`}
                        transform="rotate(-90 40 40)"
                        style={{ transition: "stroke-dashoffset 0.8s ease" }}
                      />
                    </svg>
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      flexDirection: "column",
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: selectedColor.accent, lineHeight: 1 }}>
                        {selectedChallenge.progress_pct}%
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600, marginBottom: 6 }}>Progress</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
                      {selectedChallenge.progress}
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-dim)" }}> / {selectedChallenge.target_value}</span>
                    </div>
                    <div style={{
                      marginTop: 8, height: 6, borderRadius: 3, background: selectedColor.light, overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", width: `${selectedChallenge.progress_pct}%`,
                        background: selectedColor.gradient, borderRadius: 3,
                        animation: "cc-progress-fill 0.8s ease-out",
                      }} />
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                  <div style={{
                    background: selectedColor.bg, borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Reward</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: selectedColor.accent, marginTop: 4 }}>+{selectedChallenge.reward_xp} XP</div>
                  </div>
                  <div style={{
                    background: selectedColor.bg, borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Category</div>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: (difficultyMap[selectedChallenge.target_type] || { color: selectedColor.accent }).color,
                      marginTop: 6,
                    }}>
                      {(difficultyMap[selectedChallenge.target_type] || { label: "Challenge" }).label}
                    </div>
                  </div>
                  <div style={{
                    background: selectedColor.bg, borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</div>
                    <div style={{
                      fontSize: 13, fontWeight: 700, marginTop: 6,
                      color: selectedChallenge.completed ? "#059669" : selectedChallenge.progress > 0 ? "#D97706" : "var(--text-dim)",
                    }}>
                      {selectedChallenge.completed ? "✅ Completed" : selectedChallenge.progress > 0 ? "⚡ In Progress" : "🔒 Not Started"}
                    </div>
                  </div>
                  <div style={{
                    background: selectedColor.bg, borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Deadline</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>
                      {new Date(selectedChallenge.week_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>

                {/* Milestones */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Milestones</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[0.25, 0.5, 0.75, 1].map((pct, mi) => {
                      const milestone = Math.ceil(selectedChallenge.target_value * pct);
                      const reached = selectedChallenge.progress >= milestone;
                      return (
                        <div key={mi} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: reached ? selectedColor.accent : selectedColor.light,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: reached ? "#fff" : "var(--text-dim)", fontWeight: 700,
                            transition: "all 0.3s ease",
                          }}>
                            {reached ? "✓" : mi + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600,
                              color: reached ? "var(--text)" : "var(--text-dim)",
                            }}>
                              Reach {milestone} {selectedChallenge.target_type.replace(/_/g, " ")}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: reached ? selectedColor.accent : "var(--text-dim)",
                          }}>
                            {Math.round(pct * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Claim Button */}
                {selectedChallenge.completed && (
                  <button
                    className="cc-claim-btn"
                    onClick={() => selected !== null && onClaim(selected)}
                    disabled={claiming === selected}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                      background: selectedColor.gradient, color: "#fff",
                      fontWeight: 800, fontSize: 15, cursor: claiming === selected ? "not-allowed" : "pointer",
                      opacity: claiming === selected ? 0.7 : 1,
                      letterSpacing: 0.3,
                    }}
                  >
                    {claiming === selected ? "Claiming..." : "🎉 Claim Reward"}
                  </button>
                )}

                {!selectedChallenge.completed && (
                  <div style={{
                    width: "100%", padding: "14px 0", borderRadius: 14,
                    background: selectedColor.light, color: selectedColor.accent,
                    fontWeight: 700, fontSize: 14, textAlign: "center",
                  }}>
                    {selectedChallenge.progress > 0
                      ? `${selectedChallenge.target_value - selectedChallenge.progress} more to go!`
                      : "Start this challenge!"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty Detail State */
            <div style={{
              background: "var(--card-bg, #fff)", borderRadius: 20,
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              padding: "60px 32px", textAlign: "center",
            }}>
              <div className="cc-empty-icon" style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
                Select a Challenge
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                Click on any challenge card to view detailed progress, milestones, and rewards.
              </p>

              {/* Quick Stats */}
              <div style={{
                marginTop: 28, padding: "16px 20px", background: "#F8FAFC",
                borderRadius: 14, textAlign: "left",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                  This Week's Overview
                </div>
                {challenges.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>Total XP Available</span>
                      <span style={{ fontWeight: 700, color: "#6366F1" }}>
                        {challenges.reduce((sum, c) => sum + c.reward_xp, 0)} XP
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>Average Progress</span>
                      <span style={{ fontWeight: 700, color: "#059669" }}>
                        {Math.round(challenges.reduce((sum, c) => sum + c.progress_pct, 0) / challenges.length)}%
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>Week Ends</span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>
                        {challenges[0] ? new Date(challenges[0].week_end).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  );
}
