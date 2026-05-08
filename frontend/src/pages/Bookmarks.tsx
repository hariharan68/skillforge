import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { getBookmarks, toggleBookmark, getDashboard, BookmarkItem, DashboardData } from "../api/client";

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    const [b, d] = await Promise.all([getBookmarks(), getDashboard()]);
    setBookmarks(b.bookmarks);
    setDash(d);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const onRemove = async (missionId: number) => {
    await toggleBookmark(missionId);
    flash("Bookmark removed.");
    await load();
  };

  return (
    <>
      <Topbar title="Bookmarks" totalXp={dash?.total_xp || 0} rank={dash?.rank || "Rookie"} rankProgressPct={dash?.rank_progress_pct || 0} nextRankXp={dash?.next_rank_xp || 500} streak={dash?.current_streak || 0} streakMultiplier={dash?.streak_multiplier || 1} />
      <main className="content">
        <div className="page-heading">
          <h1>Bookmarks</h1>
          <p>Missions saved for later review</p>
        </div>

        {bookmarks.length === 0 && <div className="card" style={{ color: "var(--text-muted)" }}>No bookmarks yet. Bookmark missions from the Missions page!</div>}

        {bookmarks.map((b) => {
          const m = b.mission;
          return (
            <div key={b.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/missions?mission=${m.id}`)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{m.text}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`tag tag-${m.skill_name.toLowerCase().replace(/\s+/g, "-")}`}>{m.skill_icon} {m.skill_name}</span>
                    <span className={`tag tag-${m.difficulty}`}>{m.difficulty}</span>
                    {m.score != null && <span style={{ fontSize: 12, fontWeight: 700, color: m.score >= 75 ? "var(--green)" : "var(--orange)" }}>Score: {m.score}/100</span>}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.date}</span>
                  </div>
                  {m.feedback && <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>{m.feedback.slice(0, 150)}...</div>}
                </div>
                <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onRemove(m.id)}>Remove</button>
              </div>
            </div>
          );
        })}

        {toast && <div className="app-toast">{toast}</div>}
      </main>
    </>
  );
}
