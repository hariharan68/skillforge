import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  getTodayMissions,
  markNotificationsRead,
  NotificationList,
  SearchResult,
  searchApp,
  setTheme as setThemeApi,
} from "../api/client";

interface Props {
  title?: string;
  totalXp: number;
  rank: string;
  rankProgressPct: number;
  nextRankXp: number;
  streak: number;
  streakMultiplier: number;
  showRightPanel?: boolean;
  onToggleRightPanel?: () => void;
}

export default function Topbar({
  title,
  totalXp,
  rank,
  rankProgressPct,
  nextRankXp,
  streak,
  streakMultiplier,
  showRightPanel,
  onToggleRightPanel,
}: Props) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState("all");
  const [notifs, setNotifs] = useState<NotificationList>({ unread_count: 0, items: [] });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [toast, setToast] = useState("");
  const [streakHover, setStreakHover] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(document.body.classList.contains("dark"));

  const loadNotifs = async () => {
    try {
      const data = await getNotifications();
      setNotifs(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      try {
        const data = await searchApp(q);
        setResults(data.items);
        setSearchOpen(true);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  const claimXp = async () => {
    try {
      const missions = await getTodayMissions();
      const firstPending = missions.find((m) => m.status !== "graded");
      if (firstPending) {
        navigate(`/missions?mission=${firstPending.id}`);
        return;
      }
      showToast("No unclaimed XP right now.");
    } catch {
      showToast("Could not check missions.");
    }
  };

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    document.body.classList.toggle("dark", next);
    localStorage.setItem("sf-theme", next ? "dark" : "light");
    await setThemeApi(next ? "dark" : "light").catch(() => {});
  };

  const toggleNotifs = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && notifs.unread_count > 0) {
      try {
        await markNotificationsRead();
        await loadNotifs();
      } catch {
        // ignore
      }
    }
  };

  const typeIcons: Record<string, { icon: string; bg: string }> = {
    achievement: { icon: "\uD83C\uDFC6", bg: "#FEF3C7" },
    alert: { icon: "\uD83D\uDCC8", bg: "#DCFCE7" },
    info: { icon: "\uD83D\uDD14", bg: "#F3F4F6" },
    mission: { icon: "\uD83C\uDFAF", bg: "#DBEAFE" },
    report: { icon: "\uD83D\uDCCA", bg: "#F3E8FF" },
    streak: { icon: "\uD83D\uDD25", bg: "#FEF3C7" },
  };

  const filteredNotifs = notifFilter === "all"
    ? notifs.items
    : notifs.items.filter((n) => n.type === notifFilter);

  return (
    <header className="topbar">
      {/* Search */}
      <div className="topbar-left">
        {title && <div className="topbar-title">{title}</div>}
        <div className="topbar-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            placeholder="Search..."
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                navigate(results[0].path);
                setSearchOpen(false);
                setQuery("");
              }
              if (e.key === "Escape") setSearchOpen(false);
            }}
          />
          {searchOpen && query.trim() && (
            <div className="search-panel">
              {results.length === 0 && <div className="search-empty">No matches</div>}
              {results.map((item, index) => (
                <button
                  key={`${item.type}-${item.title}-${index}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    navigate(item.path);
                    setSearchOpen(false);
                    setQuery("");
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.type} · {item.subtitle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        {/* Streak pill - clickable, navigates to report */}
        <div
          className="streak-pill-wrap"
          onMouseEnter={() => setStreakHover(true)}
          onMouseLeave={() => setStreakHover(false)}
          onClick={() => navigate("/report")}
          style={{ position: "relative", cursor: "pointer" }}
        >
          <span className="streak-pill" title={`${streak} day streak · x${streakMultiplier} multiplier`}>
            &#128293; {streak} Streak
          </span>
          {streakHover && (
            <div className="streak-tooltip">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>&#128293; {streak} Day Streak</div>
              <div>Multiplier: x{streakMultiplier}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#16A34A" }}>Click for Weekly Report</div>
            </div>
          )}
        </div>

        <button className="claim-xp-btn" onClick={claimXp}>Claim XP</button>

        {/* Notifications */}
        <div className="notif-wrap">
          <button className="notif-btn" onClick={toggleNotifs} title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {notifs.unread_count > 0 && <span className="badge">{notifs.unread_count}</span>}
          </button>
          {notifOpen && (
            <>
              <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
              <div className="notif-panel">
                <div className="notif-panel-header">
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Notifications</span>
                  <span
                    style={{ fontSize: 12, color: "#16A34A", cursor: "pointer", fontWeight: 500 }}
                    onClick={async () => {
                      await markNotificationsRead();
                      await loadNotifs();
                    }}
                  >
                    Mark All Read
                  </span>
                </div>
                <div className="notif-panel-filters">
                  {["All", "Mission", "Achievement", "Streak", "Report", "Info"].map((f) => (
                    <button
                      key={f}
                      className={`notif-filter-btn ${notifFilter === f.toLowerCase() ? "active" : ""}`}
                      onClick={() => setNotifFilter(f.toLowerCase())}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {filteredNotifs.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No notifications</div>
                  )}
                  {filteredNotifs.map((n) => {
                    const ti = typeIcons[n.type] || { icon: "\uD83D\uDD14", bg: "#F3F4F6" };
                    return (
                      <div key={n.id} className="notif-item">
                        <div
                          style={{
                            width: 36, height: 36, borderRadius: 18, background: ti.bg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, flexShrink: 0,
                          }}
                        >
                          {ti.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: !n.read ? "var(--ink)" : "var(--text-dim)" }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {n.type.toUpperCase()} {n.created_at ? ` · ${new Date(n.created_at).toLocaleString()}` : ""}
                          </div>
                        </div>
                        {!n.read && (
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#16A34A", marginTop: 4, flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="notif-panel-footer">
                  <span
                    style={{ fontSize: 13, color: "#16A34A", fontWeight: 500, cursor: "pointer" }}
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/notifications");
                    }}
                  >
                    View All Notifications &rarr;
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rank Toggle */}
        <div
          className={`rank-toggle ${showRightPanel ? "active" : ""}`}
          onClick={onToggleRightPanel}
        >
          <span style={{ fontSize: 13 }}>&#128737;&#65039;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: showRightPanel ? "#16A34A" : "#6B7280" }}>
            {rank}
          </span>
        </div>

        {/* Dark Mode Toggle */}
        <button
          className="dark-mode-toggle"
          onClick={toggleDarkMode}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        {/* Avatar */}
        <div className="avatar-wrap" style={{ position: "relative" }}>
          <div className="avatar" onClick={() => setAvatarOpen(!avatarOpen)} style={{ cursor: "pointer" }}>H</div>
          {avatarOpen && (
            <>
              <div className="notif-backdrop" onClick={() => setAvatarOpen(false)} />
              <div className="avatar-menu">
                <div className="avatar-menu-header">
                  <div className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>H</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Hari</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim, #64748b)" }}>LVL {Math.floor(totalXp / 100)} &middot; {rank}</div>
                  </div>
                </div>
                <div className="avatar-menu-divider" />
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/profile"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile
                </button>
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/report"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Weekly Report
                </button>
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/leaderboard"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z"/><path d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10"/><path d="M15 19V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  Leaderboard
                </button>
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/bookmarks"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                  Bookmarks
                </button>
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/inventory"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                  Inventory
                </button>
                <div className="avatar-menu-divider" />
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/settings"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  Settings
                </button>
                <button className="avatar-menu-item" onClick={() => { setAvatarOpen(false); navigate("/support"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Help & Support
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {toast && <div className="app-toast">{toast}</div>}
    </header>
  );
}
