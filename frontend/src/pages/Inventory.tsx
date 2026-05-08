import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import {
  DashboardData,
  InventoryItem,
  getDashboard,
  getInventory,
  useInventoryItem,
} from "../api/client";

const itemVisuals: Record<string, { icon: string; bg: string; sub: string }> = {
  xp_booster: { icon: "🎯", bg: "#DBEAFE", sub: "2x XP for next mission" },
  streak_shield: { icon: "🛡️", bg: "#DCFCE7", sub: "Protect streak for 1 day" },
  weekly_report: { icon: "📋", bg: "#F3E8FF", sub: "Latest weekly summary" },
  badge_on_fire: { icon: "🏆", bg: "#FEF3C7", sub: "Earned badge" },
  monthly_report: { icon: "📊", bg: "#F3E8FF", sub: "Latest monthly summary" },
};

export default function Inventory() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    const [d, inv] = await Promise.all([getDashboard(), getInventory()]);
    setDash(d);
    setItems(inv.items);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const onUse = async (item: InventoryItem) => {
    setWorking(item.key);
    try {
      const res = await useInventoryItem(item.key);
      flash(res.message || `${item.name} activated.`);
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.detail || e?.message || "Could not use item.");
    } finally {
      setWorking(null);
    }
  };

  const visible = filter === "All"
    ? items
    : items.filter((item) => {
      if (filter === "Power-ups") return item.type === "powerup";
      if (filter === "Badges") return item.type === "badge";
      return item.type === "report";
    });

  return (
    <>
      <Topbar
        title="Inventory"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="page-heading">
          <h1>Inventory</h1>
          <p>Earned items & power-ups</p>
        </div>

        <div className="pill-tabs">
          {["All", "Power-ups", "Badges", "Reports"].map((tab) => (
            <button key={tab} className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>
              {tab}
            </button>
          ))}
        </div>

        <div className="inventory-grid">
          {visible.map((item) => {
            const visual = itemVisuals[item.key] || { icon: "🎁", bg: "#F3E8FF", sub: item.type };
            const disabled = !item.usable || item.quantity <= 0 || item.active || working === item.key;
            return (
              <div className="inventory-card" key={item.key}>
                {item.quantity > 0 && <span className="inventory-count">{item.quantity}</span>}
                <div className="inventory-icon" style={{ background: visual.bg }}>{visual.icon}</div>
                <h3>{item.name}</h3>
                <p>{item.active ? "Active" : visual.sub}</p>
                {item.usable && (
                  <button className="btn btn-primary" disabled={disabled} onClick={() => onUse(item)}>
                    {item.active ? "Active" : working === item.key ? "Using..." : item.quantity > 0 ? "Use" : "Empty"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {toast && <div className="app-toast">{toast}</div>}
      </main>
    </>
  );
}
