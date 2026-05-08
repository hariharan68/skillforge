import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DashboardData,
  Mission,
  SubmitResult,
  Skill,
  CommentData,
  exportData,
  generateMissions,
  generateWithDifficulty,
  getDashboard,
  getSkills,
  getTodayMissions,
  retryMission,
  submitMission,
  toggleBookmark,
  reorderMissions,
  createCustomMission,
  generateChallenge,
  getCombo,
  ComboData,
  getHint,
  startChallengeTimer,
  getReviewMissions,
  scheduleReview,
  getAdaptiveDifficulty,
  getMissionComments,
  addMissionComment,
  generateVariant,
  exportPdfReport,
  calibrateDifficulty,
  getMissionShare,
} from "../api/client";
import { toastManager } from "../components/Toast";
import Topbar from "../components/Topbar";

const skillBgs: Record<string, string> = { Coding: "#DBEAFE", Trading: "#FEF3C7", Aptitude: "#F3E8FF", "General IQ": "#ECFDF5" };
const skillTextColors: Record<string, string> = { Coding: "#1D4ED8", Trading: "#92400E", Aptitude: "#6D28D9", "General IQ": "#065F46" };
const diffColors: Record<string, { bg: string; text: string }> = {
  easy: { bg: "#D1FAE5", text: "#065F46" },
  medium: { bg: "#FEF3C7", text: "#92400E" },
  hard: { bg: "#FEE2E2", text: "#991B1B" },
};

export default function Missions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, SubmitResult>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [err, setErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [levelUp, setLevelUp] = useState<{ skill: string; level: number } | null>(null);
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState("today");
  const [toast, setToast] = useState("");
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [difficultyChoice, setDifficultyChoice] = useState<string>("");
  const [combo, setCombo] = useState<ComboData | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSkillId, setCustomSkillId] = useState<number>(0);
  const [customText, setCustomText] = useState("");
  const [customDiff, setCustomDiff] = useState("medium");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [hints, setHints] = useState<Record<number, string>>({});
  const [hintLoading, setHintLoading] = useState<Record<number, boolean>>({});
  const [timers, setTimers] = useState<Record<number, number>>({});
  const [reviewMissions, setReviewMissions] = useState<Mission[]>([]);
  const [recommendedDiff, setRecommendedDiff] = useState("");
  const [comments, setComments] = useState<Record<number, CommentData[]>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [variantLoading, setVariantLoading] = useState<Record<number, boolean>>({});
  const [sharedMission, setSharedMission] = useState<{ text: string; skill: string; difficulty: string; xp: number } | null>(null);

  const flash = (message: string, duration = 3000) => {
    setToast(message);
    setTimeout(() => setToast(""), duration);
  };

  const load = async () => {
    try {
      const [m, d, s] = await Promise.all([getTodayMissions(), getDashboard(), getSkills()]);
      setMissions(m);
      setDash(d);
      setSkills(s);
      if (customSkillId === 0 && s.length > 0) setCustomSkillId(s[0].id);
      const missionId = Number(searchParams.get("mission"));
      if (missionId) setExpanded((prev) => ({ ...prev, [missionId]: true }));
      const sharedId = Number(searchParams.get("shared"));
      if (sharedId) {
        getMissionShare(sharedId).then((data) => setSharedMission({ text: data.mission_text, skill: `${data.skill_icon} ${data.skill_name}`, difficulty: data.difficulty, xp: data.xp_reward })).catch(() => {});
      }
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Failed to load missions");
    }
    getCombo().then(setCombo).catch(() => {});
    getReviewMissions().then((r) => setReviewMissions(r.missions)).catch(() => {});
    getAdaptiveDifficulty().then((r) => setRecommendedDiff(r.recommended_difficulty)).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [searchParams]);

  const playSound = (type: "grade" | "levelup" | "achievement") => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = type === "achievement" ? 0.1 : 0.15;
      osc.frequency.value = type === "achievement" ? 784 : 523;
      osc.type = type === "levelup" ? "triangle" : "sine";
      osc.start();
      osc.stop(ctx.currentTime + (type === "levelup" ? 0.5 : 0.2));
    } catch {
      // Audio is optional.
    }
  };

  const handleGradeResult = (res: SubmitResult, missionId: number) => {
    setResults((r) => ({ ...r, [missionId]: res }));
    playSound("grade");
    if (res.level_up) {
      const m = missions.find((mission) => mission.id === missionId);
      setLevelUp({ skill: m?.skill_name || "Skill", level: res.new_skill_level });
      playSound("levelup");
      setTimeout(() => setLevelUp(null), 4000);
    }
    if (res.unlocked_achievements?.length) playSound("achievement");
  };

  const onSubmit = async (id: number) => {
    const ans = (answers[id] || "").trim();
    if (!ans) {
      flash("Please write an answer before submitting.");
      return;
    }
    setGrading((g) => ({ ...g, [id]: true }));
    try {
      const res = await submitMission(id, ans);
      handleGradeResult(res, id);
      const comboMsg = res.combo_count && res.combo_count >= 3 ? ` | Combo x${res.combo_count}!` : "";
      flash(`Mission graded: ${res.score}/100, +${res.xp_earned} XP.${comboMsg}`);
      await load();
    } catch (e: any) {
      flash("Submission failed: " + (e?.response?.data?.detail || e?.message || "unknown"), 5000);
    } finally {
      setGrading((g) => ({ ...g, [id]: false }));
    }
  };

  const onRetry = async (id: number) => {
    const ans = (answers[id] || "").trim();
    if (!ans) {
      flash("Please write a new answer before retrying.");
      return;
    }
    setRetrying((r) => ({ ...r, [id]: true }));
    try {
      const res = await retryMission(id, ans);
      handleGradeResult(res, id);
      flash(`Retry graded: ${res.score}/100, +${res.xp_earned} XP.`);
      await load();
    } catch (e: any) {
      flash("Retry failed: " + (e?.response?.data?.detail || e?.message || "unknown"), 5000);
    } finally {
      setRetrying((r) => ({ ...r, [id]: false }));
    }
  };

  const onGenerate = async () => {
    if (missions.length > 0 && !confirmGenerate) {
      setConfirmGenerate(true);
      return;
    }
    setConfirmGenerate(false);
    setGenerating(true);
    try {
      if (difficultyChoice) {
        await generateWithDifficulty(difficultyChoice);
      } else {
        await generateMissions();
      }
      flash("Missions generated.");
      await load();
    } catch (e: any) {
      flash("Generation failed: " + (e?.response?.data?.detail || e?.message || "unknown"), 5000);
    } finally {
      setGenerating(false);
    }
  };

  const onExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skillforge-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("Data exported.");
    } catch (e: any) {
      flash("Export failed: " + (e?.message || "unknown"), 5000);
    }
  };

  const onBookmark = async (id: number) => {
    try {
      const res = await toggleBookmark(id);
      flash(res.bookmarked ? "Mission bookmarked!" : "Bookmark removed.");
      await load();
    } catch {
      flash("Bookmark failed.");
    }
  };

  const onChallenge = async () => {
    setChallengeLoading(true);
    try {
      const res = await generateChallenge();
      if (res.ok && res.mission) {
        flash("Challenge mission generated! 1.5x XP, 5 min limit.");
        await load();
      } else {
        flash(res.message || "Could not generate challenge.");
      }
    } catch (e: any) {
      flash("Challenge failed: " + (e?.response?.data?.detail || e?.message || "unknown"), 5000);
    } finally {
      setChallengeLoading(false);
    }
  };

  const onCreateCustom = async () => {
    if (!customText.trim()) return;
    try {
      await createCustomMission(customSkillId, customText.trim(), customDiff);
      flash("Custom mission created!");
      setCustomText("");
      setShowCustomForm(false);
      await load();
    } catch (e: any) {
      flash("Failed: " + (e?.response?.data?.detail || e?.message || "unknown"), 5000);
    }
  };

  // #12: AI Hint System
  const onHint = async (id: number) => {
    setHintLoading((h) => ({ ...h, [id]: true }));
    try {
      const res = await getHint(id);
      setHints((h) => ({ ...h, [id]: res.hint }));
      flash(`Hint revealed (-10% XP). ${res.hints_remaining} hints remaining today.`);
    } catch (e: any) {
      flash(e?.response?.data?.detail || "Could not get hint.");
    } finally {
      setHintLoading((h) => ({ ...h, [id]: false }));
    }
  };

  // #10: Challenge Timer
  const onStartTimer = async (id: number, timeLimit: number) => {
    try {
      await startChallengeTimer(id);
      setTimers((t) => ({ ...t, [id]: timeLimit }));
      const interval = setInterval(() => {
        setTimers((t) => {
          const remaining = (t[id] || 0) - 1;
          if (remaining <= 0) {
            clearInterval(interval);
            flash("Time's up! Challenge expired.");
            return { ...t, [id]: 0 };
          }
          return { ...t, [id]: remaining };
        });
      }, 1000);
    } catch {
      flash("Could not start timer.");
    }
  };

  // #9: Spaced Repetition
  const onScheduleReview = async (id: number) => {
    try {
      const res = await scheduleReview(id);
      flash(`Scheduled for review in ${res.days} days.`);
      await load();
    } catch {
      flash("Could not schedule review.");
    }
  };

  // Drag & drop
  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const reordered = [...missions];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setMissions(reordered);
    setDragIdx(null);
    try {
      await reorderMissions(reordered.map((m) => m.id));
    } catch {
      flash("Reorder failed.");
      await load();
    }
  };

  // #14: Mission Comments
  const onToggleComments = async (id: number) => {
    const show = !showComments[id];
    setShowComments((s) => ({ ...s, [id]: show }));
    if (show && !comments[id]) {
      try {
        const res = await getMissionComments(id);
        setComments((c) => ({ ...c, [id]: res.comments }));
      } catch { /* ignore */ }
    }
  };

  const onAddComment = async (id: number) => {
    const text = (commentText[id] || "").trim();
    if (!text) return;
    try {
      const res = await addMissionComment(id, text);
      setComments((c) => ({ ...c, [id]: [...(c[id] || []), res.comment] }));
      setCommentText((t) => ({ ...t, [id]: "" }));
      toastManager.show("Comment added!", "success");
    } catch { toastManager.show("Failed to add comment.", "error"); }
  };

  // #16: Mission Variants
  const onGenerateVariant = async (id: number) => {
    setVariantLoading((v) => ({ ...v, [id]: true }));
    try {
      await generateVariant(id);
      toastManager.show("Variant mission created!", "success");
      await load();
    } catch (e: any) {
      toastManager.show(e?.response?.data?.detail || "Could not generate variant.", "error");
    } finally {
      setVariantLoading((v) => ({ ...v, [id]: false }));
    }
  };

  // #19: PDF Report Export
  const onPdfExport = async () => {
    try {
      const html = await exportPdfReport();
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
      toastManager.show("PDF report opened in new tab.", "success");
    } catch { toastManager.show("PDF export failed.", "error"); }
  };

  // #55: Calibrate difficulty
  const onCalibrate = async () => {
    try {
      const res = await calibrateDifficulty();
      toastManager.show(`Difficulty calibrated: ${res.adjustment}. Now: ${res.new_difficulty}`, "info");
      setRecommendedDiff(res.new_difficulty);
    } catch { toastManager.show("Calibration failed.", "error"); }
  };

  const filteredMissions = missions.filter((m) => {
    if (activeTab === "overview" || activeTab === "today") return true;
    if (activeTab === "pending") return m.status !== "graded";
    if (activeTab === "graded") return m.status === "graded";
    return m.skill_name.toLowerCase() === activeTab;
  });
  const pending = filteredMissions.filter((m) => m.status !== "graded");
  const completed = filteredMissions.filter((m) => m.status === "graded");
  const completedCount = missions.filter((m) => m.status === "graded").length;
  const total = missions.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const tabs = ["Overview", "Today", "Pending", "Graded", "Review", "Trading", "Coding", "Aptitude"];

  return (
    <>
      <Topbar
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        {sharedMission && (
          <div style={{ background: "linear-gradient(135deg, #EDE9FE, #DBEAFE)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4 }}>Shared Mission</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{sharedMission.text}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "var(--card)", fontWeight: 500 }}>{sharedMission.skill}</span>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "var(--card)", fontWeight: 500 }}>{sharedMission.difficulty}</span>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{sharedMission.xp} XP</span>
                </div>
              </div>
              <button onClick={() => setSharedMission(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>×</button>
            </div>
          </div>
        )}
        <div className="mission-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="back-arrow" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </span>
            <span className="page-title-inline">Daily Missions</span>
            <span style={{ background: "#FEF3C7", color: "#92400E", padding: "4px 12px", borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
              &#128293; {dash?.current_streak || 0} Days
            </span>
            {combo && combo.combo_count >= 3 && (
              <span className="combo-badge">
                &#9889; Combo x{combo.combo_count} ({combo.combo_multiplier}x)
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={difficultyChoice}
              onChange={(e) => setDifficultyChoice(e.target.value)}
              style={{ padding: "6px 10px", fontSize: 12, width: "auto", minWidth: 90 }}
            >
              <option value="">Mixed{recommendedDiff ? ` (AI: ${recommendedDiff})` : ""}</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button className="btn btn-outline" onClick={() => setShowCustomForm(!showCustomForm)}>Custom</button>
            <button className="btn btn-outline" onClick={onChallenge} disabled={challengeLoading}>
              {challengeLoading ? "..." : "⚡ Challenge"}
            </button>
            <button className="btn btn-outline" onClick={onExport}>Export</button>
            <button className="btn btn-outline" onClick={onPdfExport}>PDF</button>
            <button className="btn btn-outline" onClick={onCalibrate} title="Auto-calibrate difficulty based on scores">Calibrate</button>
            <button className="btn btn-primary" onClick={onGenerate} disabled={generating}>
              {generating ? "Generating..." : "+ Generate"}
            </button>
          </div>
        </div>

        {/* Custom Mission Form */}
        {showCustomForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Create Custom Mission</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 140px" }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Skill</label>
                <select value={customSkillId} onChange={(e) => setCustomSkillId(Number(e.target.value))} style={{ width: "100%", padding: "6px 8px", fontSize: 12 }}>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 100px" }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Difficulty</label>
                <select value={customDiff} onChange={(e) => setCustomDiff(e.target.value)} style={{ width: "100%", padding: "6px 8px", fontSize: 12 }}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Question</label>
                <input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Enter your custom mission question..." style={{ width: "100%", padding: "6px 8px", fontSize: 12 }} />
              </div>
              <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={onCreateCustom} disabled={!customText.trim()}>Create</button>
            </div>
          </div>
        )}

        <div className="tab-bar">
          {tabs.map((t) => (
            <button
              key={t}
              className={`tab-item ${activeTab === t.toLowerCase() ? "active" : ""}`}
              onClick={() => setActiveTab(t.toLowerCase())}
            >
              {t}
            </button>
          ))}
        </div>

        {err && (
          <div className="card" style={{ borderLeft: "3px solid #EF4444", marginBottom: 14 }}>
            <div style={{ fontWeight: 600, color: "#EF4444" }}>Error</div>
            <div style={{ color: "var(--text-dim)" }}>{err}</div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Today's Progress</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{completedCount}/{total} Missions Completed</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{pct}%</span>
          </div>
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #16A34A 0%, #F97316 70%, #DC2626 100%)" }} />
          </div>
        </div>

        {pending.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Pending
            </div>
            {pending.map((m, idx) => (
              <div
                key={m.id}
                draggable
                onDragStart={() => onDragStart(missions.indexOf(m))}
                onDragOver={onDragOver}
                onDrop={() => onDrop(missions.indexOf(m))}
                style={{ opacity: dragIdx === missions.indexOf(m) ? 0.5 : 1 }}
              >
                <MissionCard
                  m={m}
                  ans={answers[m.id] || ""}
                  res={results[m.id]}
                  isGrading={grading[m.id] || false}
                  isRetrying={retrying[m.id] || false}
                  isExpanded={expanded[m.id] || false}
                  onToggleExpand={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}
                  onAnswerChange={(val) => setAnswers((a) => ({ ...a, [m.id]: val }))}
                  onSubmit={() => onSubmit(m.id)}
                  onRetry={() => onRetry(m.id)}
                  onBookmark={() => onBookmark(m.id)}
                  hint={hints[m.id]}
                  hintLoading={hintLoading[m.id]}
                  onHint={() => onHint(m.id)}
                  timer={timers[m.id]}
                  onStartTimer={() => onStartTimer(m.id, m.challenge_time_limit || 300)}
                  onScheduleReview={() => onScheduleReview(m.id)}
                  commentsData={comments[m.id]}
                  commentTextVal={commentText[m.id]}
                  showCommentsFlag={showComments[m.id]}
                  onToggleComments={() => onToggleComments(m.id)}
                  onCommentTextChange={(val) => setCommentText((t) => ({ ...t, [m.id]: val }))}
                  onAddComment={() => onAddComment(m.id)}
                  variantLoading={variantLoading[m.id]}
                  onGenerateVariant={() => onGenerateVariant(m.id)}
                />
              </div>
            ))}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, marginTop: 20 }}>
              Completed
            </div>
            {completed.map((m) => (
              <MissionCard
                key={m.id}
                m={m}
                ans={answers[m.id] || ""}
                res={results[m.id]}
                isGrading={false}
                isRetrying={retrying[m.id] || false}
                isExpanded={expanded[m.id] || false}
                onToggleExpand={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}
                onAnswerChange={(val) => setAnswers((a) => ({ ...a, [m.id]: val }))}
                onSubmit={() => onSubmit(m.id)}
                onRetry={() => onRetry(m.id)}
                onBookmark={() => onBookmark(m.id)}
                onScheduleReview={() => onScheduleReview(m.id)}
                commentsData={comments[m.id]}
                commentTextVal={commentText[m.id]}
                showCommentsFlag={showComments[m.id]}
                onToggleComments={() => onToggleComments(m.id)}
                onCommentTextChange={(val) => setCommentText((t) => ({ ...t, [m.id]: val }))}
                onAddComment={() => onAddComment(m.id)}
                variantLoading={variantLoading[m.id]}
                onGenerateVariant={() => onGenerateVariant(m.id)}
              />
            ))}
          </>
        )}

        {/* #9: Spaced Repetition Review Missions */}
        {activeTab === "review" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Due for Review ({reviewMissions.length})
            </div>
            {reviewMissions.length === 0 && <div className="card" style={{ color: "var(--text-muted)" }}>No missions due for review. Complete and schedule missions for spaced repetition.</div>}
            {reviewMissions.map((m) => (
              <MissionCard
                key={m.id} m={m} ans={answers[m.id] || ""} res={results[m.id]} isGrading={grading[m.id] || false} isRetrying={retrying[m.id] || false}
                isExpanded={expanded[m.id] || false} onToggleExpand={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}
                onAnswerChange={(val) => setAnswers((a) => ({ ...a, [m.id]: val }))} onSubmit={() => onSubmit(m.id)} onRetry={() => onRetry(m.id)} onBookmark={() => onBookmark(m.id)}
              />
            ))}
          </>
        )}

        {missions.length === 0 && activeTab !== "review" && (
          <div className="card" style={{ color: "var(--text-muted)" }}>
            No missions for today. Click "Generate Missions" or set your OpenAI key in Settings.
          </div>
        )}
        {filteredMissions.length === 0 && missions.length > 0 && (
          <div className="card" style={{ color: "var(--text-muted)" }}>No missions match this tab.</div>
        )}
      </main>

      {levelUp && (
        <div className="level-up-overlay">
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#11088;</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#16A34A" }}>LEVEL UP!</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
            {levelUp.skill} is now Level {levelUp.level}
          </div>
        </div>
      )}
      {toast && <div className="app-toast">{toast}</div>}
      {confirmGenerate && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <h3>Generate Missions?</h3>
            <p>This will replace pending missions for today. Graded missions stay safe.</p>
            <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setConfirmGenerate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={onGenerate}>Generate</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  // Simple markdown: **bold**, `code`, ```code blocks```, line breaks
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, "");
          return <pre key={i} style={{ background: "var(--bg)", padding: 10, borderRadius: 6, fontSize: 12, overflowX: "auto", margin: "6px 0" }}><code>{code}</code></pre>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} style={{ background: "var(--bg)", padding: "2px 5px", borderRadius: 4, fontSize: 12 }}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function MissionCard({
  m, ans, res, isGrading, isRetrying, isExpanded, onToggleExpand, onAnswerChange, onSubmit, onRetry, onBookmark,
  hint, hintLoading: hintLoadingProp, onHint, timer, onStartTimer, onScheduleReview,
  commentsData, commentTextVal, showCommentsFlag, onToggleComments, onCommentTextChange, onAddComment,
  variantLoading: variantLoadingProp, onGenerateVariant,
}: {
  m: Mission;
  ans: string;
  res?: SubmitResult;
  isGrading: boolean;
  isRetrying: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAnswerChange: (v: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onBookmark: () => void;
  hint?: string;
  hintLoading?: boolean;
  onHint?: () => void;
  timer?: number;
  onStartTimer?: () => void;
  onScheduleReview?: () => void;
  commentsData?: CommentData[];
  commentTextVal?: string;
  showCommentsFlag?: boolean;
  onToggleComments?: () => void;
  onCommentTextChange?: (v: string) => void;
  onAddComment?: () => void;
  variantLoading?: boolean;
  onGenerateVariant?: () => void;
}) {
  const isGraded = m.status === "graded";
  const canRetry = isGraded && (m.score ?? 100) < 60 && (m.retry_count ?? 0) < 2;
  const dc = diffColors[m.difficulty] || { bg: "var(--bg)", text: "var(--text-secondary, #374151)" };
  const score = res?.score ?? m.score ?? 0;

  return (
    <div className={`mission-card ${isGraded ? "done" : ""} ${m.is_challenge ? "challenge" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className={`checkbox ${isGraded ? "checked" : "unchecked"}`}>
          {isGraded && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, cursor: !isGraded ? "pointer" : "default" }} onClick={() => !isGraded && onToggleExpand()}>
          <div style={{ fontSize: 15, fontWeight: 600, color: isGraded && !res ? "var(--text-muted)" : "var(--ink)", textDecoration: isGraded && !res ? "line-through" : "none" }}>
            {m.text}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: skillBgs[m.skill_name] || "#ECFDF5", color: skillTextColors[m.skill_name] || "#065F46", fontWeight: 500 }}>
              {m.skill_icon} {m.skill_name}
            </span>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: dc.bg, color: dc.text, fontWeight: 500 }}>
              {m.difficulty}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.xp_reward} XP</span>
            {m.is_challenge && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>⚡ Challenge</span>}
            {m.is_custom && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#F3E8FF", color: "#6D28D9", fontWeight: 600 }}>Custom</span>}
            {m.hint_used && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>Hint Used</span>}
            {m.prerequisite_id && !m.prerequisite_met && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#FEE2E2", color: "#991B1B", fontWeight: 600 }}>🔒 Locked</span>}
            {(m.tags || []).map((tag) => (
              <span key={tag} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--border)", color: "var(--text-dim)" }}>{tag}</span>
            ))}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onBookmark(); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: m.bookmarked ? "var(--orange)" : "var(--text-muted)", padding: 4 }}
          title={m.bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          {m.bookmarked ? "★" : "☆"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const url = `${window.location.origin}/missions?shared=${m.id}`;
            navigator.clipboard.writeText(url).then(() => {
              const el = e.currentTarget;
              el.textContent = "✓";
              setTimeout(() => { el.textContent = "↗"; }, 1500);
            });
          }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)", padding: 4 }}
          title="Share mission"
        >
          ↗
        </button>
        <span className="tag tag-xp" style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          +{m.xp_reward} XP
        </span>
      </div>

      {isExpanded && !isGraded && !isGrading && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {/* #10: Challenge Timer */}
          {m.is_challenge && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {timer !== undefined && timer > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: timer < 60 ? "var(--red)" : "var(--orange)", fontFamily: "monospace" }}>
                    {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>remaining</span>
                </div>
              ) : timer === 0 ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>Time expired!</span>
              ) : (
                <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={onStartTimer}>
                  Start Timer ({(m.challenge_time_limit || 300) / 60} min)
                </button>
              )}
            </div>
          )}
          {/* #12: AI Hint */}
          {!hint && onHint && (
            <button className="btn btn-outline" style={{ fontSize: 11, padding: "4px 10px", marginBottom: 8 }} onClick={onHint} disabled={hintLoadingProp}>
              {hintLoadingProp ? "Getting hint..." : "💡 Get Hint (-10% XP)"}
            </button>
          )}
          {hint && (
            <div style={{ background: "var(--orange-light)", borderLeft: "3px solid var(--orange)", padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
              💡 {hint}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>Your Answer</div>
          <textarea
            value={ans}
            onChange={(e) => onAnswerChange(e.target.value)}
            onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter" && ans.trim()) { e.preventDefault(); onSubmit(); } }}
            placeholder="Type your answer here... (Ctrl+Enter to submit). Supports **bold**, `code`, and ```code blocks```."
            style={{ width: "100%", minHeight: 100, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "Inter, monospace", resize: "vertical", outline: "none", boxSizing: "border-box", color: "var(--ink)" }}
          />
          {ans.trim() && (
            <div style={{ marginTop: 8, padding: 10, background: "var(--bg)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Preview</div>
              <SimpleMarkdown text={ans} />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ans.length} chars</span>
            <button className="btn btn-primary" onClick={onSubmit} disabled={!ans.trim()}>
              Submit for Grading
            </button>
          </div>
        </div>
      )}

      {isGrading && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center", padding: "24px 0" }}>
          <div className="spinner" style={{ margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, color: "var(--text-dim)", fontStyle: "italic" }}>AI grading your answer...</div>
        </div>
      )}

      {(res || isGraded) && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", animation: "score-reveal 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, border: `3px solid ${score >= 75 ? "var(--green)" : score >= 50 ? "var(--orange)" : "var(--red)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{score}</span>
              <span style={{ fontSize: 9, color: "var(--text-dim)" }}>/100</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: score >= 75 ? "var(--green)" : "var(--orange)" }}>
                {res?.grade_label || (score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Average" : "Poor")}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", marginTop: 2 }}>
                +{res?.xp_earned ?? m.xp_earned ?? 0} XP earned
              </div>
              {res?.combo_count && res.combo_count >= 3 && (
                <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 2, fontWeight: 700 }}>Combo x{res.combo_count} ({res.combo_multiplier}x XP)</div>
              )}
              {res?.is_retry && <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 2 }}>Retry: 50% XP</div>}
            </div>
          </div>
          <div style={{ background: "var(--green-bg)", borderLeft: "3px solid var(--green)", padding: 12, borderRadius: 6, marginTop: 12, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
            <SimpleMarkdown text={res?.feedback ?? m.feedback ?? ""} />
          </div>
          {res?.unlocked_achievements && res.unlocked_achievements.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#F97316", marginBottom: 6 }}>Achievements Unlocked</div>
              {res.unlocked_achievements.map((a) => (
                <div key={a.key} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{a.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* #9: Schedule for Spaced Repetition Review */}
          {isGraded && onScheduleReview && (
            <button className="btn btn-outline" style={{ fontSize: 11, padding: "4px 10px", marginTop: 10 }} onClick={onScheduleReview}>
              📅 Schedule Review
            </button>
          )}
          {/* #16: Generate Variant */}
          {isGraded && onGenerateVariant && (
            <button className="btn btn-outline" style={{ fontSize: 11, padding: "4px 10px", marginTop: 6, marginLeft: 6 }} onClick={onGenerateVariant} disabled={variantLoadingProp}>
              {variantLoadingProp ? "Generating..." : "🔄 Create Variant"}
            </button>
          )}
          {/* #14: Comments Section */}
          {onToggleComments && (
            <button className="btn btn-outline" style={{ fontSize: 11, padding: "4px 10px", marginTop: 6, marginLeft: 6 }} onClick={onToggleComments}>
              💬 Comments {commentsData?.length ? `(${commentsData.length})` : ""}
            </button>
          )}
          {showCommentsFlag && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--bg)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Discussion</div>
              {(!commentsData || commentsData.length === 0) && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>No comments yet. Start the discussion!</div>
              )}
              {commentsData?.map((c) => (
                <div key={c.id} style={{ marginBottom: 8, padding: "6px 10px", background: "var(--card)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{c.text}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  value={commentTextVal || ""}
                  onChange={(e) => onCommentTextChange?.(e.target.value)}
                  placeholder="Add a comment..."
                  style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
                  onKeyDown={(e) => { if (e.key === "Enter" && (commentTextVal || "").trim()) { e.preventDefault(); onAddComment?.(); } }}
                />
                <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 12px" }} onClick={onAddComment} disabled={!(commentTextVal || "").trim()}>Post</button>
              </div>
            </div>
          )}
          {canRetry && !res && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                Score below 60: you can retry this mission for 50% XP.
              </div>
              <textarea
                placeholder="Write an improved answer..."
                value={ans}
                onChange={(e) => onAnswerChange(e.target.value)}
                disabled={isRetrying}
                style={{ width: "100%", minHeight: 100, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter", resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
              <button className="btn btn-outline" style={{ marginTop: 8 }} disabled={isRetrying || !ans.trim()} onClick={onRetry}>
                {isRetrying ? <>Retrying<span className="loading-dots" /></> : "Retry (50% XP)"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
