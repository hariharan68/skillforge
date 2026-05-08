import { NotificationItem } from "../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  rank: string;
  totalXp: number;
  nextRankXp: number;
  rankProgressPct: number;
  streak: number;
  recentNotifications: NotificationItem[];
}

export default function RightPanel({
  open,
  onClose,
  rank,
  totalXp,
  nextRankXp,
  rankProgressPct,
  streak,
  recentNotifications,
}: Props) {
  const typeIcons: Record<string, { icon: string; bg: string }> = {
    achievement: { icon: "\uD83C\uDFC6", bg: "#FEF3C7" },
    alert: { icon: "\uD83D\uDCC8", bg: "#DCFCE7" },
    mission: { icon: "\uD83C\uDFAF", bg: "#DBEAFE" },
    reminder: { icon: "\uD83D\uDD14", bg: "#F3E8FF" },
  };

  return (
    <>
      {open && <div className="right-panel-backdrop" onClick={onClose} />}
      <div className={`right-panel ${open ? "" : "closed"}`}>
        {/* Rank Card */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 60, height: 60, borderRadius: 30, margin: "0 auto",
              background: "linear-gradient(135deg, #8B5CF6, #16A34A)", padding: 3,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 74, height: 74, borderRadius: 37, background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
              }}
            >
              &#128737;&#65039;
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 8 }}>{rank} Rank</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#F97316", marginTop: 4 }}>
            &#128293; {streak} Day Streak
          </div>
          <div style={{ height: 1, background: "#E5E7EB", margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B7280" }}>
            <span>Progress</span>
            <span>{totalXp.toLocaleString()} / {nextRankXp.toLocaleString()} XP</span>
          </div>
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, rankProgressPct)}%`, background: "#16A34A" }}
            />
          </div>
        </div>

        {/* Live Updates */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Live Updates
            </span>
          </div>
          {recentNotifications.length === 0 && (
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>No recent updates</div>
          )}
          {recentNotifications.slice(0, 5).map((n) => {
            const ti = typeIcons[n.type] || { icon: "\uD83D\uDD14", bg: "#F3F4F6" };
            return (
              <div
                key={n.id}
                style={{
                  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12,
                  display: "flex", gap: 10, marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 16, background: ti.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0,
                  }}
                >
                  {ti.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
