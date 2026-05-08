import { useLocation, useNavigate } from "react-router-dom";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  missions: "Missions",
  skills: "Skills",
  achievements: "Achievements",
  settings: "Settings",
  report: "Weekly Report",
  "monthly-report": "Monthly Report",
  history: "History",
  inventory: "Inventory",
  leaderboard: "Leaderboard",
  notifications: "Notifications",
  profile: "Profile",
  "answer-history": "Answer History",
  bookmarks: "Bookmarks",
  support: "Support",
};

export default function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();

  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs: { label: string; path: string }[] = [
    { label: "Dashboard", path: "/" },
  ];

  segments.forEach((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const label = ROUTE_LABELS[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, path });
  });

  // On dashboard, don't render breadcrumb
  if (crumbs.length === 1) return null;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--text-dim)",
        padding: "4px 0",
        lineHeight: 1,
      }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: "var(--text-dim)", opacity: 0.5 }}>/</span>}
            {isLast ? (
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{crumb.label}</span>
            ) : (
              <span
                onClick={() => navigate(crumb.path)}
                style={{
                  color: "var(--green)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
