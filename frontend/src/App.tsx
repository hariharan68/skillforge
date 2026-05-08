import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import Breadcrumb from "./components/Breadcrumb";
import { ToastContainer } from "./components/Toast";
import { claimDailyLogin, getTheme, getOnboarding, completeOnboarding, generateMissions, getStreakMilestones } from "./api/client";

// Code splitting (#45) - lazy load all pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Missions = lazy(() => import("./pages/Missions"));
const Skills = lazy(() => import("./pages/Skills"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Settings = lazy(() => import("./pages/Settings"));
const Report = lazy(() => import("./pages/Report"));
const History = lazy(() => import("./pages/History"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Support = lazy(() => import("./pages/Support"));
const MonthlyReport = lazy(() => import("./pages/MonthlyReport"));
const Profile = lazy(() => import("./pages/Profile"));
const AnswerHistory = lazy(() => import("./pages/AnswerHistory"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const FeatureUnlocks = lazy(() => import("./pages/FeatureUnlocks"));
const XpDecay = lazy(() => import("./pages/XpDecay"));
const CommunityChallenges = lazy(() => import("./pages/CommunityChallenges"));
const LearningPaths = lazy(() => import("./pages/LearningPaths"));
const WeeklyDigest = lazy(() => import("./pages/WeeklyDigest"));
const Seasons = lazy(() => import("./pages/Seasons"));

// Motivational quotes
const QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
];

function Confetti() {
  const colors = ["#16A34A", "#F97316", "#3B82F6", "#8B5CF6", "#EF4444", "#FACC15"];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 1.5,
    size: 6 + Math.random() * 6,
  }));
  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}
    </>
  );
}

// Loading fallback for Suspense
function PageLoader() {
  return (
    <main className="content" style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 12px" }} />
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading<span className="loading-dots" /></div>
      </div>
    </main>
  );
}

// Onboarding steps
const ONBOARDING_STEPS = [
  { icon: "\u{1F680}", title: "Welcome to SkillForge!", desc: "Your AI-powered learning companion. Complete daily missions, earn XP, and level up your skills." },
  { icon: "\u{1F3AF}", title: "Set Up Your Skills", desc: "Go to Settings and add the skills you want to practice. Each skill tracks its own XP and level." },
  { icon: "\u{1F4DD}", title: "Complete Missions", desc: "Every day, AI generates personalized missions for each skill. Submit answers to earn XP and get AI feedback." },
  { icon: "\u{1F525}", title: "Build Streaks & Combos", desc: "Complete missions daily to build streaks (XP multiplier!) and chain combos for even more rewards." },
  { icon: "\u{1F3C6}", title: "You're Ready!", desc: "Unlock achievements, climb the leaderboard, and track your growth. Let's get started!" },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loginReward, setLoginReward] = useState<{ show: boolean; xp: number; message: string }>({ show: false, xp: 0, message: "" });
  const [showConfetti, setShowConfetti] = useState(false);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [pageTransition, setPageTransition] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [streakMilestone, setStreakMilestone] = useState<{ days: number; label: string; icon: string } | null>(null);

  // Animated page transitions
  useEffect(() => {
    setPageTransition(true);
    const t = setTimeout(() => setPageTransition(false), 300);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Load theme on mount
  useEffect(() => {
    getTheme().then((res) => {
      if (res.theme === "dark") {
        document.body.classList.add("dark");
        localStorage.setItem("sf-theme", "dark");
      }
    }).catch(() => {});
  }, []);

  // Onboarding check (#20)
  useEffect(() => {
    getOnboarding().then((res) => {
      if (!res.done) setShowOnboarding(true);
    }).catch(() => {});
  }, []);

  // Daily login reward
  useEffect(() => {
    const claimed = localStorage.getItem("sf-login-date");
    const today = new Date().toISOString().slice(0, 10);
    if (claimed === today) return;

    claimDailyLogin().then((res) => {
      localStorage.setItem("sf-login-date", today);
      if (!res.already_claimed && res.xp_bonus > 0) {
        setLoginReward({ show: true, xp: res.xp_bonus, message: res.message });
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setTimeout(() => setLoginReward((r) => ({ ...r, show: false })), 4000);
      }
    }).catch(() => {});
  }, []);

  // Check streak milestones (#21)
  useEffect(() => {
    getStreakMilestones().then((res) => {
      const justAchieved = res.milestones.find(
        (m: any) => m.achieved && !localStorage.getItem(`sf-milestone-${m.days}`)
      );
      if (justAchieved) {
        localStorage.setItem(`sf-milestone-${justAchieved.days}`, "true");
        setStreakMilestone(justAchieved);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
        setTimeout(() => setStreakMilestone(null), 6000);
      }
    }).catch(() => {});
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const pages = ["/", "/missions", "/skills", "/inventory", "/leaderboard", "/report", "/settings", "/profile", "/bookmarks"];
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < pages.length) {
        e.preventDefault();
        navigate(pages[idx]);
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const finishOnboarding = async () => {
    setShowOnboarding(false);
    try { await completeOnboarding(); } catch {}
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className={`page-wrapper ${pageTransition ? "page-enter" : "page-active"}`}>
        <div style={{ padding: "0 22px" }}><Breadcrumb /></div>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard quote={quote} />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/history" element={<History />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/report" element={<Report />} />
              <Route path="/monthly-report" element={<MonthlyReport />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/answer-history" element={<AnswerHistory />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/support" element={<Support />} />
              <Route path="/feature-unlocks" element={<FeatureUnlocks />} />
              <Route path="/xp-decay" element={<XpDecay />} />
              <Route path="/community-challenges" element={<CommunityChallenges />} />
              <Route path="/learning-paths" element={<LearningPaths />} />
              <Route path="/weekly-digest" element={<WeeklyDigest />} />
              <Route path="/seasons" element={<Seasons />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Floating Action Button (#5) */}
      <button className="fab" onClick={() => setFabOpen(!fabOpen)} title="Quick Actions">
        {fabOpen ? "\u2715" : "\u26A1"}
      </button>
      {fabOpen && (
        <div className="fab-menu">
          <button className="fab-item" onClick={() => { setFabOpen(false); navigate("/missions"); }}>
            <span>&#128203;</span> View Missions
          </button>
          <button className="fab-item" onClick={async () => { setFabOpen(false); try { await generateMissions(); navigate("/missions"); } catch {} }}>
            <span>&#9889;</span> Generate Missions
          </button>
          <button className="fab-item" onClick={() => { setFabOpen(false); navigate("/skills"); }}>
            <span>&#127919;</span> My Skills
          </button>
          <button className="fab-item" onClick={() => { setFabOpen(false); navigate("/achievements"); }}>
            <span>&#127942;</span> Achievements
          </button>
          <button className="fab-item" onClick={() => { setFabOpen(false); navigate("/profile"); }}>
            <span>&#128100;</span> Profile
          </button>
        </div>
      )}

      {/* Onboarding Wizard (#20) */}
      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <div style={{ fontSize: 56, marginBottom: 12 }}>{ONBOARDING_STEPS[onboardingStep].icon}</div>
            <h2>{ONBOARDING_STEPS[onboardingStep].title}</h2>
            <p>{ONBOARDING_STEPS[onboardingStep].desc}</p>
            <div className="onboarding-steps">
              {ONBOARDING_STEPS.map((_, i) => (
                <div key={i} className={`onboarding-dot ${i === onboardingStep ? "active" : ""}`} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {onboardingStep > 0 && (
                <button className="btn btn-outline" onClick={() => setOnboardingStep(onboardingStep - 1)}>Back</button>
              )}
              {onboardingStep < ONBOARDING_STEPS.length - 1 ? (
                <button className="btn btn-primary" onClick={() => setOnboardingStep(onboardingStep + 1)}>Next</button>
              ) : (
                <button className="btn btn-primary" onClick={finishOnboarding}>Get Started!</button>
              )}
              <button className="btn btn-outline" onClick={finishOnboarding} style={{ fontSize: 12 }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Login Reward Popup */}
      {loginReward.show && (
        <div className="modal-backdrop" onClick={() => setLoginReward((r) => ({ ...r, show: false }))}>
          <div className="confirm-modal" style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>&#127873;</div>
            <h3 style={{ color: "var(--green)" }}>Daily Login Bonus!</h3>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>+{loginReward.xp} XP</p>
            <p style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic", marginTop: 12 }}>
              "{quote.text}" — {quote.author}
            </p>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setLoginReward((r) => ({ ...r, show: false }))}>
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Streak Milestone Celebration (#21) */}
      {streakMilestone && (
        <div className="modal-backdrop" onClick={() => setStreakMilestone(null)}>
          <div className="confirm-modal streak-milestone" onClick={(e) => e.stopPropagation()}>
            <div className="milestone-icon">{streakMilestone.icon}</div>
            <h3 style={{ color: "var(--green)", fontSize: 22 }}>Streak Milestone!</h3>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{streakMilestone.label}</p>
            <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
              {streakMilestone.days}-day streak achieved!
            </p>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setStreakMilestone(null)}>
              Awesome!
            </button>
          </div>
        </div>
      )}

      <ToastContainer />
      {showConfetti && <Confetti />}
    </div>
  );
}
