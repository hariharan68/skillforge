import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getDashboard } from "../api/client";

function SvgIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { to: "/missions", label: "Missions", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { to: "/skills", label: "Skill Tree", icon: "M6 3v12M18 9a3 3 0 01-3 3h-6M6 9l6-6" },
  { to: "/answer-history", label: "Answers", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { to: "/feature-unlocks", label: "Unlocks", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { to: "/xp-decay", label: "XP Decay", icon: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" },
  { to: "/learning-paths", label: "Paths", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { to: "/community-challenges", label: "Challenges", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { to: "/weekly-digest", label: "Digest", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { to: "/seasons", label: "Seasons", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
  { to: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const MOBILE_NAV_KEYS = ["/", "/missions", "/skills", "/settings"];

export default function Sidebar() {
  const [rank, setRank] = useState("Rookie");
  const [avgLevel, setAvgLevel] = useState(1);
  const [avatar, setAvatar] = useState("⚡");
  const [displayName, setDisplayName] = useState("Hari");

  useEffect(() => {
    getDashboard()
      .then((d) => {
        setRank(d.rank);
        setAvgLevel(d.avg_level);
        setAvatar(d.avatar || "⚡");
        setDisplayName(d.display_name || "Hari");
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
            </svg>
          </div>
          <span className="sidebar-brand-text">SkillForge</span>
        </div>

        <NavLink to="/profile" className="sidebar-profile" style={{ textDecoration: "none" }}>
          <div className="sidebar-avatar">{avatar}</div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{displayName}</div>
            <div className="sidebar-profile-rank">LVL {avgLevel} · {rank}</div>
          </div>
        </NavLink>

        <NavLink to="/missions" style={{ textDecoration: "none" }}>
          <button className="sidebar-quest-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Quest
          </button>
        </NavLink>
      </div>

      <nav className="sidebar-nav sidebar-nav-desktop">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}
          >
            <SvgIcon d={item.icon} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <nav className="sidebar-nav sidebar-nav-mobile">
        {NAV_ITEMS.filter((item) => MOBILE_NAV_KEYS.includes(item.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}
          >
            <SvgIcon d={item.icon} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
