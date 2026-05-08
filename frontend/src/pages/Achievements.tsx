import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { getAllAchievements, getDashboard, Achievement, DashboardData } from "../api/client";

const RARITY_COLORS: Record<string, { bg: string; text: string }> = {
  common: { bg: "#E5E7EB", text: "#6B7280" },
  rare: { bg: "#DBEAFE", text: "#1D4ED8" },
  epic: { bg: "#F3E8FF", text: "#7C3AED" },
  legendary: { bg: "#FEF3C7", text: "#B45309" },
};

export default function Achievements() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try {
      const [a, d] = await Promise.all([getAllAchievements(), getDashboard()]);
      setItems(a);
      setDash(d);
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Failed to load achievements");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unlockedCount = items.filter((a) => a.unlocked).length;
  const filtered = filter === "all" ? items
    : filter === "unlocked" ? items.filter((a) => a.unlocked)
    : filter === "locked" ? items.filter((a) => !a.unlocked)
    : filter === "secret" ? items.filter((a) => a.secret)
    : items.filter((a) => (a.rarity || "common") === filter);

  return (
    <>
      <Topbar
        title="Achievements"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        {err && (
          <div className="card" style={{ borderLeft: "3px solid var(--red)", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: "var(--red)", marginBottom: 4 }}>Error</div>
            <div style={{ color: "var(--text-dim)" }}>{err}</div>
          </div>
        )}

        <div className="page-heading">
          <h1>Achievements</h1>
          <p>{unlockedCount} / {items.length} Unlocked</p>
        </div>

        {/* Filters */}
        <div className="pill-tabs" style={{ marginBottom: 16 }}>
          {["All", "Unlocked", "Locked", "Secret", "Rare", "Epic", "Legendary"].map((f) => (
            <button
              key={f}
              className={filter === f.toLowerCase() ? "active" : ""}
              onClick={() => setFilter(f.toLowerCase())}
            >{f}</button>
          ))}
        </div>

        <div className="ach-grid">
          {filtered.map((a) => {
            const rarity = RARITY_COLORS[a.rarity || "common"] || RARITY_COLORS.common;
            return (
              <div key={a.id} className={"card ach-card" + (a.unlocked ? " unlocked" : " locked")} style={a.rarity === "legendary" && a.unlocked ? { border: "2px solid #F59E0B" } : {}}>
                <div style={{
                  width: 48, height: 48, borderRadius: 24,
                  background: a.unlocked ? "#DCFCE7" : "#F3F4F6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, flexShrink: 0,
                  filter: a.unlocked ? "none" : "grayscale(1)",
                }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: a.unlocked ? "var(--text)" : "var(--text-muted)" }}>
                      {a.name}
                    </span>
                    {a.secret && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#F3E8FF", color: "#7C3AED", fontWeight: 600 }}>Secret</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{a.description}</div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      background: a.unlocked ? "#DCFCE7" : "#F3F4F6",
                      color: a.unlocked ? "#16A34A" : "#9CA3AF",
                    }}>
                      {a.unlocked ? "UNLOCKED" : "LOCKED"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: rarity.bg, color: rarity.text, textTransform: "uppercase" }}>
                      {a.rarity || "common"}
                    </span>
                    {a.unlocked && a.unlocked_at && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(a.unlocked_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
