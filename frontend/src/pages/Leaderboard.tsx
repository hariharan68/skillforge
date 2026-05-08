import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { DashboardData, LeaderboardRow, getDashboard, getLeaderboard } from "../api/client";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [podium, setPodium] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    Promise.all([getDashboard(), getLeaderboard()])
      .then(([d, board]) => {
        setDash(d);
        setRows(board.rows);
        setPodium(board.podium);
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <Topbar
        title="Leaderboard"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="page-heading">
          <h1>Leaderboard</h1>
          <p>Your personal records</p>
        </div>

        <div className="podium-row">
          {podium.map((item, index) => (
            <div className={`podium-card ${item.current ? "active" : ""}`} key={item.start_date}>
              <div className="podium-medal">{medals[index] || item.rank}</div>
              <strong>{item.week}</strong>
              <span>{item.total_xp.toLocaleString()} XP</span>
            </div>
          ))}
        </div>

        <div className="card leaderboard-card">
          <table className="lb-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Week</th>
                <th>Total XP</th>
                <th>Missions</th>
                <th>Streak</th>
                <th>Best Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.start_date} className={row.current ? "current" : ""}>
                  <td>{medals[row.rank - 1] || row.rank}</td>
                  <td>{row.week}</td>
                  <td className="xp-cell">{row.total_xp.toLocaleString()}</td>
                  <td>{row.missions}</td>
                  <td className="streak-cell">{row.streak} days</td>
                  <td>{row.best_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
