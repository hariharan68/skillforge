/**
 * React Query hooks (#44) — reduce redundant API calls with caching.
 * Pages can gradually migrate from direct API calls to these hooks.
 */
import { useQuery } from "@tanstack/react-query";
import {
  getDashboard,
  getSkills,
  getTodayMissions,
  getAchievements,
  getInventory,
  getLeaderboard,
  getProfile,
  getWeeklyReport,
  getMonthlyReport,
  getNotifications,
  getCombo,
  getWeeklyChallenge,
  getStreakStatus,
  getFeatureUnlocks,
  getXpDecay,
  getSkillRetention,
  getTopicHeatmap,
  getLearningVelocity,
  getMistakePatterns,
  getSessionQuality,
  getGoalStreak,
  getStreakMilestones,
  getBookmarks,
} from "./client";

export const useDashboard = () =>
  useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });

export const useSkills = () =>
  useQuery({ queryKey: ["skills"], queryFn: getSkills });

export const useTodayMissions = () =>
  useQuery({ queryKey: ["todayMissions"], queryFn: getTodayMissions });

export const useAchievements = () =>
  useQuery({ queryKey: ["achievements"], queryFn: getAchievements });

export const useInventory = () =>
  useQuery({ queryKey: ["inventory"], queryFn: getInventory });

export const useLeaderboard = () =>
  useQuery({ queryKey: ["leaderboard"], queryFn: getLeaderboard });

export const useProfile = () =>
  useQuery({ queryKey: ["profile"], queryFn: getProfile });

export const useWeeklyReport = () =>
  useQuery({ queryKey: ["weeklyReport"], queryFn: getWeeklyReport });

export const useMonthlyReport = () =>
  useQuery({ queryKey: ["monthlyReport"], queryFn: getMonthlyReport });

export const useNotifications = () =>
  useQuery({ queryKey: ["notifications"], queryFn: getNotifications, refetchInterval: 30_000 });

export const useCombo = () =>
  useQuery({ queryKey: ["combo"], queryFn: getCombo });

export const useWeeklyChallenge = () =>
  useQuery({ queryKey: ["weeklyChallenge"], queryFn: getWeeklyChallenge });

export const useStreakStatus = () =>
  useQuery({ queryKey: ["streakStatus"], queryFn: getStreakStatus });

export const useFeatureUnlocks = () =>
  useQuery({ queryKey: ["featureUnlocks"], queryFn: getFeatureUnlocks });

export const useXpDecay = () =>
  useQuery({ queryKey: ["xpDecay"], queryFn: getXpDecay });

export const useSkillRetention = () =>
  useQuery({ queryKey: ["skillRetention"], queryFn: getSkillRetention });

export const useTopicHeatmap = () =>
  useQuery({ queryKey: ["topicHeatmap"], queryFn: getTopicHeatmap });

export const useLearningVelocity = () =>
  useQuery({ queryKey: ["learningVelocity"], queryFn: getLearningVelocity });

export const useMistakePatterns = () =>
  useQuery({ queryKey: ["mistakePatterns"], queryFn: getMistakePatterns });

export const useSessionQuality = () =>
  useQuery({ queryKey: ["sessionQuality"], queryFn: getSessionQuality });

export const useGoalStreak = () =>
  useQuery({ queryKey: ["goalStreak"], queryFn: getGoalStreak });

export const useStreakMilestones = () =>
  useQuery({ queryKey: ["streakMilestones"], queryFn: getStreakMilestones });

export const useBookmarks = () =>
  useQuery({ queryKey: ["bookmarks"], queryFn: getBookmarks });
