// ---------- SkillForge OS — Shared Types ----------

export interface Skill {
  id: number;
  name: string;
  icon: string;
  xp: number;
  level: number;
  mission_count: number;
  xp_in_level: number;
  xp_for_next: number;
  level_low: number;
  level_high: number;
  best_score: number;
  xp_this_week: number;
}

export interface Mission {
  id: number;
  skill_id: number;
  skill_name: string;
  skill_icon: string;
  text: string;
  xp_reward: number;
  date: string | null;
  status: "pending" | "submitted" | "graded";
  difficulty: "easy" | "medium" | "hard";
  retry_count?: number;
  score?: number | null;
  feedback?: string | null;
  xp_earned?: number | null;
  answer?: string | null;
  bookmarked?: boolean;
  is_custom?: boolean;
  sort_order?: number;
  language?: string;
  is_challenge?: boolean;
  challenge_time_limit?: number;
  submitted_at?: string | null;
  tags?: string[];
  hint_used?: boolean;
  challenge_started_at?: string | null;
  prerequisite_id?: number | null;
  prerequisite_met?: boolean;
}

export interface DashboardData {
  total_xp: number;
  rank: string;
  rank_progress_pct: number;
  next_rank_xp: number;
  current_streak: number;
  longest_streak: number;
  streak_multiplier: number;
  today_missions_total: number;
  today_missions_completed: number;
  avg_level: number;
  skills: Skill[];
  today_missions: Mission[];
  recent_notifications: NotificationItem[];
  combo_count?: number;
  display_name?: string;
  avatar?: string;
}

export interface Achievement {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
  secret?: boolean;
  rarity?: string;
}

export interface NotificationItem {
  id: number;
  message: string;
  type: string;
  read: boolean;
  created_at: string | null;
}

export interface NotificationList {
  unread_count: number;
  items: NotificationItem[];
}

export interface WeeklyReport {
  total_week_xp: number;
  total_week_missions: number;
  missions_generated: number;
  current_streak: number;
  longest_streak: number;
  daily: { date: string; day: string; xp: number; missions: number }[];
  skill_breakdown: { id: number; name: string; icon: string; xp_this_week: number }[];
  weakest_skill: { id: number; name: string; icon: string; xp: number } | null;
  top_achievement: { key: string; name: string; icon: string; unlocked_at: string | null } | null;
}

export interface SubmitResult {
  mission_id: number;
  score: number;
  grade_label: string;
  feedback: string;
  xp_earned: number;
  streak_multiplier: number;
  combo_count?: number;
  combo_multiplier?: number;
  new_total_xp: number;
  new_rank: string;
  new_skill_xp: number;
  new_skill_level: number;
  level_up?: boolean;
  retry_count?: number;
  is_retry?: boolean;
  unlocked_achievements: { key: string; name: string; description: string; icon: string }[];
}

export interface MissionHistoryResponse {
  total: number;
  page: number;
  per_page: number;
  missions: Mission[];
}

export interface SettingsData {
  has_api_key: boolean;
  masked_api_key: string | null;
  has_openai_key: boolean;
  masked_openai_key: string | null;
  has_gemini_key: boolean;
  masked_gemini_key: string | null;
  has_claude_key: boolean;
  masked_claude_key: string | null;
  has_groq_key: boolean;
  masked_groq_key: string | null;
  api_provider: "openai" | "gemini" | "claude" | "groq";
  morning_hour: number;
  midday_hour: number;
  evening_hour: number;
  morning_enabled: boolean;
  midday_enabled: boolean;
  evening_enabled: boolean;
  weekly_enabled: boolean;
  xp_booster_active: boolean;
  streak_shield_active: boolean;
  auto_backup_enabled?: boolean;
  preferred_language?: string;
  email_address?: string;
  has_email_password?: boolean;
  email_notifications_enabled?: boolean;
}

export interface InventoryItem {
  id: number;
  key: string;
  name: string;
  type: "powerup" | "report" | "badge" | string;
  quantity: number;
  metadata: string;
  usable: boolean;
  active: boolean;
  earned_at: string | null;
  used_at: string | null;
}

export interface LeaderboardRow {
  rank: number;
  week: string;
  start_date: string;
  end_date: string;
  total_xp: number;
  missions: number;
  streak: number;
  best_score: number;
  current: boolean;
}

export interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  path: string;
}

export interface MonthlyReport {
  month: string;
  total_month_xp: number;
  total_month_missions: number;
  current_streak: number;
  longest_streak: number;
  daily: { date: string; day: string; xp: number; missions: number }[];
  skill_breakdown: { id: number; name: string; icon: string; total_xp: number; xp_this_month: number; level: number }[];
  best_day: { date: string; day: string; xp: number; missions: number } | null;
  avg_score: number;
  total_xp: number;
  rank: string;
}

export interface ProfileData {
  display_name: string;
  bio: string;
  avatar: string;
  total_xp: number;
  rank: string;
  rank_progress_pct: number;
  current_streak: number;
  longest_streak: number;
  total_missions: number;
  skills_count: number;
  achievements_unlocked: number;
  achievements_total: number;
  member_since: string;
  preferred_language: string;
}

export interface RadarSkill {
  name: string;
  icon: string;
  xp: number;
  level: number;
  normalized: number;
}

export interface StreakDay {
  date: string;
  active: boolean;
  missions: number;
}

export interface TrendPoint {
  date: string;
  avg_score: number;
  xp: number;
  missions: number;
}

export interface HourData {
  hour: number;
  label: string;
  avg_score: number;
  count: number;
  xp: number;
}

export interface ReportCard {
  display_name: string;
  avatar: string;
  rank: string;
  total_xp: number;
  week_xp: number;
  week_missions: number;
  avg_score: number;
  current_streak: number;
  top_skills: { name: string; icon: string; level: number }[];
  week_label: string;
}

export interface AnswerHistoryItem {
  mission_id: number;
  skill_name: string;
  skill_icon: string;
  text: string;
  difficulty: string;
  answer: string;
  score: number;
  feedback: string;
  xp_earned: number;
  submitted_at: string | null;
  date: string | null;
}

export interface BookmarkItem {
  id: number;
  mission: Mission;
  created_at: string | null;
}

export interface SeasonalEvent {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  event_type: string;
  start_date: string;
  end_date: string;
  bonus_xp_pct: number;
  badge_key: string | null;
  active: boolean;
}

export interface ComboData {
  combo_count: number;
  combo_multiplier: number;
  time_remaining: number;
}

export interface BackupInfo {
  filename: string;
  size_kb: number;
  created: string;
}

// ---------- V2 Types ----------

export interface WeeklyChallengeData {
  id: number;
  title: string;
  description: string;
  target_type: string;
  target_value: number;
  progress: number;
  progress_pct: number;
  completed: boolean;
  completed_at: string | null;
  reward_xp: number;
  week_start: string;
  week_end: string;
}

export interface TopicHeatmapRow {
  skill_name: string;
  skill_icon: string;
  cells: { difficulty: string; avg_score: number; count: number }[];
}

export interface VelocityPoint {
  date: string;
  xp: number;
  missions: number;
  xp_per_hour: number;
}

export interface MistakePattern {
  skill_name: string;
  skill_icon: string;
  total_missions: number;
  low_score_count: number;
  struggle_pct: number;
  avg_score: number;
}

export interface RetentionItem {
  skill_name: string;
  skill_icon: string;
  last_practiced: string | null;
  days_since: number | null;
  status: "fresh" | "stale" | "rusty";
}

export interface SessionQuality {
  by_day_of_week: { day: string; day_num: number; avg_score: number; count: number }[];
  best_day: { day: string; avg_score: number; count: number } | null;
}

export interface StudyResourceData {
  id: number;
  skill_id: number | null;
  title: string;
  url: string;
  resource_type: string;
  created_at: string | null;
}

export interface LootBoxResult {
  ok: boolean;
  item: { name: string; key: string; type: string; rarity: string };
}

export interface StreakStatus {
  current_streak: number;
  longest_streak: number;
  streak_shield_active: boolean;
  freezes_remaining: number;
  last_active: string | null;
}

export interface AdaptiveDifficulty {
  avg_score_7d: number;
  recommended_difficulty: string;
}

export interface PublicProfile {
  display_name: string;
  avatar: string;
  rank: string;
  total_xp: number;
  current_streak: number;
  total_missions: number;
  achievements_unlocked: number;
  top_skills: { name: string; icon: string; level: number }[];
  member_since: string;
}

// ---------- V3 Types ----------

export interface CommentData {
  id: number;
  mission_id: number;
  text: string;
  author: string;
  created_at: string | null;
}

export interface FeatureUnlock {
  key: string;
  name: string;
  icon: string;
  xp_required: number;
  unlocked: boolean;
}

export interface XpDecayItem {
  skill_name: string;
  skill_icon: string;
  skill_id: number;
  days_inactive: number;
  current_xp: number;
  xp_at_risk: number;
}

export interface StreakMilestone {
  days: number;
  label: string;
  icon: string;
  achieved: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}

// ---------- V4 Types ----------

export interface MissionShareData {
  mission_text: string;
  skill_name: string;
  skill_icon: string;
  difficulty: string;
  xp_reward: number;
  player_name: string;
  player_avatar: string;
  player_rank: string;
  score?: number;
  xp_earned?: number;
  grade_label?: string;
  feedback?: string;
  share_text: string;
  share_url: string;
}

export interface WeeklyDigest {
  week_xp: number;
  week_missions: number;
  avg_score: number;
  current_streak: number;
  rank: string;
  top_skills: { name: string; icon: string; level: number }[];
  daily: { date: string; day: string; xp: number }[];
  html: string;
}

export interface CommunityChallenge {
  title: string;
  description: string;
  target_type: string;
  target_value: number;
  reward_xp: number;
  icon: string;
  progress: number;
  progress_pct: number;
  completed: boolean;
  week_start: string;
  week_end: string;
}

export interface SkillPrerequisiteData {
  skill_id: number;
  required_skill_id: number;
  required_level: number;
  skill_name: string;
  skill_icon: string;
  required_skill_name: string;
  required_skill_icon: string;
  current_level: number;
  met: boolean;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  skills: string[];
  milestones: { level: number; title: string; description: string; completed: boolean }[];
  progress_pct: number;
  completed_milestones: number;
  total_milestones: number;
  current_level: number;
}

// ---------- Seasons (#24) ----------

export interface SeasonData {
  id: number;
  number: number;
  name: string;
  icon: string;
  start_date: string;
  end_date: string;
  days_left: number;
  progress_pct: number;
  starting_xp: number;
  current_xp: number;
  season_xp: number;
  peak_xp: number;
  peak_rank: string;
  current_rank: string;
  missions_completed: number;
  active: boolean;
}

export interface SeasonHistoryItem {
  id: number;
  number: number;
  name: string;
  icon: string;
  start_date: string;
  end_date: string;
  starting_xp: number;
  ending_xp: number;
  ending_rank: string;
  peak_xp: number;
  peak_rank: string;
  missions_completed: number;
  badge_awarded: string | null;
  active: boolean;
}

export interface SeasonResetResult {
  ok: boolean;
  message: string;
  old_xp: number;
  new_xp: number;
  xp_lost: number;
  old_rank: string;
  new_rank: string;
  peak_rank: string;
  badge_awarded: string;
}
