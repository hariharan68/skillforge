import axios from "axios";
import type {
  Achievement,
  AnswerHistoryItem,
  BackupInfo,
  BookmarkItem,
  ComboData,
  DashboardData,
  HourData,
  InventoryItem,
  LeaderboardRow,
  Mission,
  MissionHistoryResponse,
  MonthlyReport,
  NotificationList,
  ProfileData,
  RadarSkill,
  ReportCard,
  SearchResult,
  SeasonalEvent,
  SettingsData,
  Skill,
  StreakDay,
  SubmitResult,
  TrendPoint,
  WeeklyReport,
  WeeklyChallengeData,
  TopicHeatmapRow,
  VelocityPoint,
  MistakePattern,
  RetentionItem,
  SessionQuality,
  StudyResourceData,
  LootBoxResult,
  StreakStatus,
  AdaptiveDifficulty,
  PublicProfile,
  CommentData,
  FeatureUnlock,
  XpDecayItem,
  StreakMilestone,
  BreadcrumbItem,
  SeasonData,
  SeasonHistoryItem,
  SeasonResetResult,
} from "./types";

// Re-export all types so existing imports from "../api/client" keep working
export type {
  Achievement,
  AnswerHistoryItem,
  BackupInfo,
  BookmarkItem,
  ComboData,
  DashboardData,
  HourData,
  InventoryItem,
  LeaderboardRow,
  Mission,
  MissionHistoryResponse,
  MonthlyReport,
  NotificationItem,
  NotificationList,
  ProfileData,
  RadarSkill,
  ReportCard,
  SearchResult,
  SeasonalEvent,
  SettingsData,
  Skill,
  StreakDay,
  SubmitResult,
  TrendPoint,
  WeeklyReport,
  // V2 types
  WeeklyChallengeData,
  TopicHeatmapRow,
  VelocityPoint,
  MistakePattern,
  RetentionItem,
  SessionQuality,
  StudyResourceData,
  LootBoxResult,
  StreakStatus,
  AdaptiveDifficulty,
  PublicProfile,
  // V3 types
  CommentData,
  FeatureUnlock,
  XpDecayItem,
  StreakMilestone,
  BreadcrumbItem,
  // V4 types
  MissionShareData,
  WeeklyDigest,
  CommunityChallenge,
  SkillPrerequisiteData,
  LearningPath,
  SeasonData,
  SeasonHistoryItem,
  SeasonResetResult,
} from "./types";

const apiHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "127.0.0.1";

export const api = axios.create({
  baseURL: `http://${apiHost}:8000/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ---------- Dashboard ----------
export const getDashboard = () => api.get<DashboardData>("/dashboard").then((r) => r.data);

// ---------- Skills ----------
export const getSkills = () => api.get<Skill[]>("/skills").then((r) => r.data);
export const createSkill = (name: string, icon: string) =>
  api.post<Skill>("/skills", { name, icon }).then((r) => r.data);
export const deleteSkill = (id: number) => api.delete(`/skills/${id}`).then((r) => r.data);
export const updateSkill = (id: number, name?: string, icon?: string) =>
  api.put<Skill>(`/skills/${id}`, { name, icon }).then((r) => r.data);

// ---------- Missions ----------
export const getTodayMissions = () => api.get<Mission[]>("/missions/today").then((r) => r.data);
export const generateMissions = () =>
  api.post<{ ok: boolean; count: number; missions: Mission[] }>("/missions/generate").then((r) => r.data);
export const submitMission = (id: number, answer: string) =>
  api.post<SubmitResult>(`/missions/${id}/submit`, { answer }).then((r) => r.data);
export const retryMission = (id: number, answer: string) =>
  api.post<SubmitResult>(`/missions/${id}/retry`, { answer }).then((r) => r.data);
export const getMissionHistory = (params?: {
  skill_id?: number; start_date?: string; end_date?: string; page?: number;
}) =>
  api.get<MissionHistoryResponse>("/missions/history", { params }).then((r) => r.data);

// ---------- Achievements ----------
export const getAchievements = () => api.get<Achievement[]>("/achievements").then((r) => r.data);

// ---------- Notifications ----------
export const getNotifications = () => api.get<NotificationList>("/notifications").then((r) => r.data);
export const getAllNotifications = () => api.get<NotificationList>("/notifications/all").then((r) => r.data);
export const markNotificationsRead = () => api.put("/notifications/read").then((r) => r.data);
export const sendTestNotification = () => api.post("/notifications/test").then((r) => r.data);

// ---------- Reports ----------
export const getWeeklyReport = () => api.get<WeeklyReport>("/report/weekly").then((r) => r.data);
export const getMonthlyReport = () => api.get<MonthlyReport>("/report/monthly").then((r) => r.data);
export const getReportCard = () => api.get<ReportCard>("/report/card").then((r) => r.data);

// ---------- Settings ----------
export const getSettings = () => api.get<SettingsData>("/settings").then((r) => r.data);
export const saveApiKey = (api_key: string, provider: string = "openai") =>
  api.post("/settings/apikey", { api_key, provider }).then((r) => r.data);
export const testApiKey = (api_key: string, provider: string = "openai") =>
  api.post("/settings/test-apikey", { api_key, provider }).then((r) => r.data);
export const setApiProvider = (provider: string) =>
  api.put("/settings/provider", { provider }).then((r) => r.data);
export const updateSchedule = (schedule: {
  morning_hour?: number;
  midday_hour?: number;
  evening_hour?: number;
  morning_enabled?: boolean;
  midday_enabled?: boolean;
  evening_enabled?: boolean;
  weekly_enabled?: boolean;
}) =>
  api.put("/settings/schedule", schedule).then((r) => r.data);
export const updateEmailSettings = (data: {
  email_address?: string;
  email_app_password?: string;
  email_notifications_enabled?: boolean;
}) =>
  api.put("/settings/email", data).then((r) => r.data);
export const testEmailSettings = () =>
  api.post("/settings/email/test").then((r) => r.data);
export const resetProgress = () => api.post("/settings/reset-progress").then((r) => r.data);
export const factoryReset = () => api.post("/settings/factory-reset").then((r) => r.data);

// ---------- Search ----------
export const searchApp = (q: string) =>
  api.get<{ items: SearchResult[] }>("/search", { params: { q } }).then((r) => r.data);

// ---------- Data Export ----------
export const exportData = () => api.get("/export").then((r) => r.data);

// ---------- Inventory ----------
export const getInventory = () => api.get<{ items: InventoryItem[] }>("/inventory").then((r) => r.data);
export const useInventoryItem = (key: string) => api.post(`/inventory/${key}/use`).then((r) => r.data);

// ---------- Leaderboard ----------
export const getLeaderboard = () =>
  api.get<{ rows: LeaderboardRow[]; podium: LeaderboardRow[]; current_week: LeaderboardRow | null }>("/leaderboard").then((r) => r.data);

// ---------- Scheduler ----------
export const runEveningReview = () => api.post("/scheduler/run-evening-review").then((r) => r.data);

// ---------- Heatmap ----------
export const getHeatmap = () => api.get<{ days: { date: string; xp: number }[] }>("/heatmap").then((r) => r.data);

// ---------- Daily Login ----------
export const claimDailyLogin = () => api.post<{ ok: boolean; message: string; xp_bonus: number; already_claimed: boolean }>("/daily-login").then((r) => r.data);

// ---------- Goals ----------
export const getGoal = () => api.get<{ weekly_xp_goal: number; week_xp: number; progress_pct: number }>("/goal").then((r) => r.data);
export const setGoal = (weekly_xp_goal: number) => api.put("/goal", { weekly_xp_goal }).then((r) => r.data);

// ---------- Theme ----------
export const getTheme = () => api.get<{ theme: string }>("/theme").then((r) => r.data);
export const setTheme = (theme: string) => api.put("/theme", { theme }).then((r) => r.data);

// ---------- Import ----------
export const importData = (data: any) => api.post("/import-data", data).then((r) => r.data);

// ---------- Generate with difficulty ----------
export const generateWithDifficulty = (difficulty?: string) =>
  api.post<{ ok: boolean; count: number; missions: Mission[] }>("/missions/generate-with-difficulty", { difficulty }).then((r) => r.data);

// ---------- #12: Mission Reorder ----------
export const reorderMissions = (mission_ids: number[]) =>
  api.put("/missions/reorder", { mission_ids }).then((r) => r.data);

// ---------- #14: Combo ----------
export const getCombo = () => api.get<ComboData>("/combo").then((r) => r.data);

// ---------- #15: Challenge Mode ----------
export const generateChallenge = () =>
  api.post<{ ok: boolean; mission?: Mission; message?: string }>("/missions/generate-challenge").then((r) => r.data);

// ---------- #17: Seasonal Events ----------
export const getEvents = () =>
  api.get<{ active: SeasonalEvent[]; upcoming: SeasonalEvent[]; past: SeasonalEvent[] }>("/events").then((r) => r.data);

// ---------- #18: Custom Missions ----------
export const createCustomMission = (skill_id: number, text: string, difficulty?: string, xp_reward?: number) =>
  api.post<{ ok: boolean; mission: Mission }>("/missions/custom", { skill_id, text, difficulty, xp_reward }).then((r) => r.data);

// ---------- #20: Skill Radar ----------
export const getSkillRadar = () =>
  api.get<{ skills: RadarSkill[]; max_xp: number }>("/skills/radar").then((r) => r.data);

// ---------- #21: Streak Calendar ----------
export const getStreakCalendar = () =>
  api.get<{ days: StreakDay[] }>("/streak-calendar").then((r) => r.data);

// ---------- #22: Performance Trends ----------
export const getPerformanceTrends = (skill_id?: number) =>
  api.get<{ trends: TrendPoint[] }>("/analytics/trends", { params: skill_id ? { skill_id } : {} }).then((r) => r.data);

// ---------- #23: Time-of-Day Analysis ----------
export const getTimeOfDay = () =>
  api.get<{ hours: HourData[]; best_hour: HourData | null }>("/analytics/time-of-day").then((r) => r.data);

// ---------- #24: Profile ----------
export const getProfile = () => api.get<ProfileData>("/profile").then((r) => r.data);
export const updateProfile = (data: { display_name?: string; bio?: string; avatar?: string; preferred_language?: string }) =>
  api.put("/profile", data).then((r) => r.data);

// ---------- #27: Bookmarks ----------
export const toggleBookmark = (mission_id: number) =>
  api.post<{ ok: boolean; bookmarked: boolean }>(`/missions/${mission_id}/bookmark`).then((r) => r.data);
export const getBookmarks = () =>
  api.get<{ bookmarks: BookmarkItem[] }>("/bookmarks").then((r) => r.data);

// ---------- #28: Answer History ----------
export const getAnswerHistory = (params?: { skill_id?: number; page?: number; per_page?: number }) =>
  api.get<{ total: number; page: number; per_page: number; items: AnswerHistoryItem[] }>("/answer-history", { params }).then((r) => r.data);

// ---------- #30: Language ----------
export const setLanguage = (language: string) =>
  api.put("/settings/language", { language }).then((r) => r.data);

// ---------- #32: Backup ----------
export const createBackup = () => api.post<{ ok: boolean; message: string; timestamp: string }>("/backup").then((r) => r.data);
export const listBackups = () => api.get<{ backups: BackupInfo[] }>("/backups").then((r) => r.data);
export const toggleAutoBackup = () => api.put<{ ok: boolean; auto_backup_enabled: boolean }>("/settings/auto-backup").then((r) => r.data);

// ========== V2 API Functions ==========

// ---------- #9: Spaced Repetition ----------
export const getReviewMissions = () => api.get<{ missions: Mission[] }>("/missions/review").then((r) => r.data);
export const scheduleReview = (missionId: number) => api.post<{ ok: boolean; next_review_date: string; days: number }>(`/missions/${missionId}/schedule-review`).then((r) => r.data);

// ---------- #10: Challenge Timer ----------
export const startChallengeTimer = (missionId: number) => api.post<{ ok: boolean; started_at: string; time_limit: number }>(`/missions/${missionId}/start-timer`).then((r) => r.data);

// ---------- #11: Adaptive Difficulty ----------
export const getAdaptiveDifficulty = () => api.get<AdaptiveDifficulty>("/adaptive-difficulty").then((r) => r.data);

// ---------- #12: AI Hint System ----------
export const getHint = (missionId: number) => api.post<{ ok: boolean; hint: string; xp_penalty: string; hints_remaining: number }>(`/missions/${missionId}/hint`).then((r) => r.data);

// ---------- #15: Streak Freeze ----------
export const useStreakFreeze = () => api.post<{ ok: boolean; freezes_remaining: number; message: string }>("/streak/freeze").then((r) => r.data);
export const getStreakStatus = () => api.get<StreakStatus>("/streak/status").then((r) => r.data);

// ---------- #17: Mission Tags ----------
export const updateMissionTags = (missionId: number, tags: string[]) => api.put(`/missions/${missionId}/tags`, { tags }).then((r) => r.data);
export const getAllTags = () => api.get<{ tags: string[] }>("/missions/tags").then((r) => r.data);

// ---------- #18: Study Resources ----------
export const getResources = (skillId?: number) => api.get<{ resources: StudyResourceData[] }>("/resources", { params: skillId ? { skill_id: skillId } : {} }).then((r) => r.data);
export const addResource = (data: { skill_id?: number; title: string; url: string; resource_type?: string }) => api.post("/resources", data).then((r) => r.data);
export const deleteResource = (id: number) => api.delete(`/resources/${id}`).then((r) => r.data);

// ---------- #20: Onboarding ----------
export const getOnboarding = () => api.get<{ done: boolean }>("/onboarding").then((r) => r.data);
export const completeOnboarding = () => api.post("/onboarding/complete").then((r) => r.data);

// ---------- #23: Weekly Challenges ----------
export const getWeeklyChallenge = () => api.get<WeeklyChallengeData>("/weekly-challenge").then((r) => r.data);

// ---------- #25: All Achievements (with secrets) ----------
export const getAllAchievements = () => api.get<Achievement[]>("/achievements/all").then((r) => r.data);

// ---------- #30: Loot Box ----------
export const openLootBox = () => api.post<LootBoxResult>("/loot-box").then((r) => r.data);

// ---------- #31: Topic Heatmap ----------
export const getTopicHeatmap = () => api.get<{ grid: TopicHeatmapRow[]; difficulties: string[] }>("/analytics/topic-heatmap").then((r) => r.data);

// ---------- #32: Learning Velocity ----------
export const getLearningVelocity = () => api.get<{ velocity: VelocityPoint[] }>("/analytics/velocity").then((r) => r.data);

// ---------- #33: Mistake Patterns ----------
export const getMistakePatterns = () => api.get<{ patterns: MistakePattern[] }>("/analytics/mistakes").then((r) => r.data);

// ---------- #34: Skill Retention ----------
export const getSkillRetention = () => api.get<{ retention: RetentionItem[] }>("/analytics/retention").then((r) => r.data);

// ---------- #35: Session Quality ----------
export const getSessionQuality = () => api.get<SessionQuality>("/analytics/session-quality").then((r) => r.data);

// ---------- #37: Goal Streak ----------
export const getGoalStreak = () => api.get<{ goal_streak: number; weekly_xp_goal: number }>("/goal-streak").then((r) => r.data);

// ---------- #43: Public Profile ----------
export const getPublicProfile = () => api.get<PublicProfile>("/profile/public").then((r) => r.data);

// ========== V3 API Functions ==========

// ---------- #14: Mission Comments ----------
export const getMissionComments = (missionId: number) => api.get<{ comments: CommentData[] }>(`/missions/${missionId}/comments`).then((r) => r.data);
export const addMissionComment = (missionId: number, text: string) => api.post<{ ok: boolean; comment: CommentData }>(`/missions/${missionId}/comments`, { text }).then((r) => r.data);
export const deleteComment = (commentId: number) => api.delete(`/comments/${commentId}`).then((r) => r.data);

// ---------- #16: Mission Variants ----------
export const generateVariant = (missionId: number) => api.post<{ ok: boolean; variant: Mission }>(`/missions/${missionId}/variant`).then((r) => r.data);

// ---------- #26: Feature Unlock Tree ----------
export const getFeatureUnlocks = () => api.get<{ total_xp: number; features: FeatureUnlock[] }>("/feature-unlocks").then((r) => r.data);

// ---------- #28: XP Decay Prevention ----------
export const getXpDecay = () => api.get<{ at_risk: XpDecayItem[] }>("/xp-decay").then((r) => r.data);
export const applyXpDecay = () => api.post<{ ok: boolean; decayed: number }>("/xp-decay/apply").then((r) => r.data);

// ---------- #55: Difficulty Auto-Calibration ----------
export const calibrateDifficulty = () => api.post<{ ok: boolean; avg_score: number; adjustment: string; new_difficulty: string }>("/difficulty/calibrate").then((r) => r.data);

// ---------- #3: Breadcrumb Navigation ----------
export const getBreadcrumb = (path: string) => api.get<{ crumbs: BreadcrumbItem[] }>("/breadcrumb", { params: { path } }).then((r) => r.data);

// ---------- #19: PDF Report Export ----------
export const exportPdfReport = () => api.get("/report/pdf", { responseType: "text" }).then((r) => r.data);

// ---------- #21: Streak Milestones ----------
export const getStreakMilestones = () => api.get<{ milestones: StreakMilestone[] }>("/streak/milestones").then((r) => r.data);

// ========== V4 API Functions ==========

import type {
  MissionShareData,
  WeeklyDigest,
  CommunityChallenge,
  SkillPrerequisiteData,
  LearningPath,
} from "./types";

// ---------- #40: Mission Sharing ----------
export const getMissionShare = (missionId: number) =>
  api.get<MissionShareData>(`/missions/${missionId}/share`).then((r) => r.data);

// ---------- #56: Mission Dependencies ----------
export const setMissionDependency = (missionId: number, prerequisiteId: number | null) =>
  api.put(`/missions/${missionId}/dependency`, { prerequisite_id: prerequisiteId }).then((r) => r.data);

// ---------- #36: Weekly Email Digest ----------
export const getWeeklyDigest = () =>
  api.get<WeeklyDigest>("/digest/weekly").then((r) => r.data);

// ---------- #42: Community Challenges ----------
export const getCommunityChallenge = () =>
  api.get<{ challenges: CommunityChallenge[] }>("/community-challenges").then((r) => r.data);
export const claimCommunityChallenge = (index: number) =>
  api.post(`/community-challenges/${index}/claim`).then((r) => r.data);

// ---------- #13: Skill Prerequisites ----------
export const getSkillPrerequisites = () =>
  api.get<{ prerequisites: SkillPrerequisiteData[] }>("/skill-prerequisites").then((r) => r.data);
export const addSkillPrerequisite = (skillId: number, requiredSkillId: number, requiredLevel: number) =>
  api.post("/skill-prerequisites", { skill_id: skillId, required_skill_id: requiredSkillId, required_level: requiredLevel }).then((r) => r.data);
export const removeSkillPrerequisite = (skillId: number, requiredSkillId: number) =>
  api.delete(`/skill-prerequisites/${skillId}/${requiredSkillId}`).then((r) => r.data);

// ---------- #54: Curated Learning Paths ----------
export const getLearningPaths = () =>
  api.get<{ paths: LearningPath[] }>("/learning-paths").then((r) => r.data);

// ---------- #24: Seasons ----------
export const getCurrentSeason = () =>
  api.get<SeasonData>("/seasons/current").then((r) => r.data);
export const getSeasonHistory = () =>
  api.get<{ seasons: SeasonHistoryItem[] }>("/seasons/history").then((r) => r.data);
export const triggerSeasonReset = () =>
  api.post<SeasonResetResult>("/seasons/reset").then((r) => r.data);
