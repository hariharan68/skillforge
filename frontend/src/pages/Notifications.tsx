import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import {
  DashboardData,
  getAllNotifications,
  getDashboard,
  markNotificationsRead,
  NotificationItem,
} from "../api/client";

export default function Notifications() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const [d, n] = await Promise.all([getDashboard(), getAllNotifications()]);
    setDash(d);
    setItems(n.items);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const visible = filter === "all" ? items : items.filter((item) => item.type === filter);

  return (
    <>
      <Topbar
        title="Notifications"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="page-heading">
          <h1>Notifications</h1>
          <p>All updates from missions, streaks, achievements, and reports</p>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <div className="pill-tabs" style={{ marginBottom: 0 }}>
            {["all", "mission", "achievement", "streak", "report", "info"].map((tab) => (
              <button key={tab} className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-outline" onClick={async () => { await markNotificationsRead(); await load(); }}>
            Mark All Read
          </button>
        </div>
        <div className="card notification-list">
          {visible.length === 0 && <div className="muted">No notifications.</div>}
          {visible.map((item) => (
            <div key={item.id} className={`notification-row ${item.read ? "" : "unread"}`}>
              <strong>{item.message}</strong>
              <span>{item.type.toUpperCase()} {item.created_at ? `· ${new Date(item.created_at).toLocaleString()}` : ""}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

