import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import {
  DashboardData,
  Mission,
  Skill,
  BackupInfo,
  createSkill,
  deleteSkill,
  exportData,
  generateMissions,
  getDashboard,
  getSettings,
  getSkills,
  getTodayMissions,
  resetProgress,
  factoryReset,
  runEveningReview,
  saveApiKey,
  sendTestNotification,
  testApiKey,
  setApiProvider,
  updateSchedule,
  updateEmailSettings,
  testEmailSettings,
  updateSkill,
  getTheme,
  setTheme as setThemeApi,
  getGoal,
  setGoal as setGoalApi,
  importData,

  createBackup,
  listBackups,
  toggleAutoBackup,
  getStreakStatus,
  useStreakFreeze,
  StreakStatus,
} from "../api/client";


export default function Settings() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [todayMissions, setTodayMissions] = useState<Mission[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [maskedOpenai, setMaskedOpenai] = useState<string | null>(null);
  const [maskedGemini, setMaskedGemini] = useState<string | null>(null);
  const [maskedClaude, setMaskedClaude] = useState<string | null>(null);
  const [maskedGroq, setMaskedGroq] = useState<string | null>(null);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasClaudeKey, setHasClaudeKey] = useState(false);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [activeProvider, setActiveProvider] = useState<"openai" | "gemini" | "claude" | "groq">("openai");
  const [newSkill, setNewSkill] = useState("");
  const [newIcon, setNewIcon] = useState("🎯");
  const [msg, setMsg] = useState("");
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [morningHour, setMorningHour] = useState(8);
  const [middayHour, setMiddayHour] = useState(13);
  const [eveningHour, setEveningHour] = useState(20);
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [middayEnabled, setMiddayEnabled] = useState(true);
  const [eveningEnabled, setEveningEnabled] = useState(true);
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [darkMode, setDarkMode] = useState(document.body.classList.contains("dark"));
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [goalInput, setGoalInput] = useState("");
  const [autoBackup, setAutoBackup] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailAppPassword, setEmailAppPassword] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [hasEmailPassword, setHasEmailPassword] = useState(false);

  const [activeSection, setActiveSection] = useState("api");

  const load = async () => {
    const [s, d, settings, m] = await Promise.all([
      getSkills(), getDashboard(), getSettings(), getTodayMissions(),
    ]);
    setSkills(s);
    setDash(d);
    setMaskedOpenai(settings.masked_openai_key);
    setMaskedGemini(settings.masked_gemini_key);
    setMaskedClaude(settings.masked_claude_key);
    setMaskedGroq(settings.masked_groq_key);
    setHasOpenaiKey(settings.has_openai_key);
    setHasGeminiKey(settings.has_gemini_key);
    setHasClaudeKey(settings.has_claude_key);
    setHasGroqKey(settings.has_groq_key);
    setActiveProvider(settings.api_provider || "openai");
    setTodayMissions(m);
    setMorningHour(settings.morning_hour ?? 8);
    setMiddayHour(settings.midday_hour ?? 13);
    setEveningHour(settings.evening_hour ?? 20);
    setMorningEnabled(settings.morning_enabled);
    setMiddayEnabled(settings.midday_enabled);
    setEveningEnabled(settings.evening_enabled);
    setWeeklyEnabled(settings.weekly_enabled);

    setAutoBackup(settings.auto_backup_enabled || false);
    setEmailAddress(settings.email_address || "");
    setHasEmailPassword(settings.has_email_password || false);
    setEmailEnabled(settings.email_notifications_enabled || false);
    getTheme().then((t) => setDarkMode(t.theme === "dark")).catch(() => {});
    getGoal().then((g) => { setWeeklyGoal(g.weekly_xp_goal); setGoalInput(String(g.weekly_xp_goal || "")); }).catch(() => {});
    listBackups().then((b) => setBackups(b.backups)).catch(() => {});
    getStreakStatus().then(setStreakStatus).catch(() => {});
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const flash = (text: string, duration = 3000) => {
    setMsg(text);
    setTimeout(() => setMsg(""), duration);
  };

  const withWork = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
    } catch (e: any) {
      flash("Failed: " + (e?.response?.data?.detail || e?.message || "unknown"), 5000);
    } finally {
      setWorking(false);
    }
  };

  const onSaveOpenaiKey = async () => withWork(async () => {
    await saveApiKey(apiKey.trim(), "openai");
    setApiKey("");
    flash("OpenAI API key validated and saved.");
    await load();
  });

  const onTestOpenaiKey = async () => withWork(async () => {
    await testApiKey(apiKey.trim(), "openai");
    flash("OpenAI API key connection works.");
  });

  const onSaveGeminiKey = async () => withWork(async () => {
    await saveApiKey(geminiKey.trim(), "gemini");
    setGeminiKey("");
    flash("Gemini API key validated and saved.");
    await load();
  });

  const onTestGeminiKey = async () => withWork(async () => {
    await testApiKey(geminiKey.trim(), "gemini");
    flash("Gemini API key connection works.");
  });

  const onSaveClaudeKey = async () => withWork(async () => {
    await saveApiKey(claudeKey.trim(), "claude");
    setClaudeKey("");
    flash("Claude API key saved.");
    await load();
  });

  const onTestClaudeKey = async () => withWork(async () => {
    await testApiKey(claudeKey.trim(), "claude");
    flash("Claude API key connection works.");
  });

  const onSaveGroqKey = async () => withWork(async () => {
    await saveApiKey(groqKey.trim(), "groq");
    setGroqKey("");
    flash("Groq API key saved.");
    await load();
  });

  const onTestGroqKey = async () => withWork(async () => {
    await testApiKey(groqKey.trim(), "groq");
    flash("Groq API key connection works.");
  });

  const onSwitchProvider = async (provider: "openai" | "gemini" | "claude" | "groq") => withWork(async () => {
    await setApiProvider(provider);
    setActiveProvider(provider);
    const labels: Record<string, string> = { openai: "OpenAI", gemini: "Google Gemini", claude: "Claude (Anthropic)", groq: "Groq (Free)" };
    flash(`Switched to ${labels[provider]}.`);
  });

  const onAddSkill = async () => withWork(async () => {
    await createSkill(newSkill.trim(), newIcon || "🎯");
    setNewSkill("");
    setNewIcon("🎯");
    flash("Skill added.");
    await load();
  });

  const onDelete = async (id: number) => withWork(async () => {
    await deleteSkill(id);
    flash("Skill deleted.");
    await load();
  });

  const onStartEdit = (s: Skill) => {
    setEditing(s.id);
    setEditName(s.name);
    setEditIcon(s.icon);
  };

  const onSaveEdit = async () => withWork(async () => {
    if (!editing) return;
    await updateSkill(editing, editName.trim() || undefined, editIcon || undefined);
    setEditing(null);
    flash("Skill updated.");
    await load();
  });

  const onGen = async () => withWork(async () => {
    if (todayMissions.length > 0) flash("Replacing pending missions for today.");
    const r = await generateMissions();
    flash(`Generated ${r.count} missions.`);
    await load();
  });

  const onExport = async () => withWork(async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skillforge-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Data exported.");
  });

  const onSaveSchedule = async () => withWork(async () => {
    await updateSchedule({
      morning_hour: morningHour,
      midday_hour: middayHour,
      evening_hour: eveningHour,
      morning_enabled: morningEnabled,
      midday_enabled: middayEnabled,
      evening_enabled: eveningEnabled,
      weekly_enabled: weeklyEnabled,
    });
    flash("Schedule updated.");
    await load();
  });

  const onReset = async () => withWork(async () => {
    await resetProgress();
    setConfirmReset(false);
    flash("Progress reset.");
    await load();
  });

  const onFactoryReset = async () => withWork(async () => {
    await factoryReset();
    setConfirmFactoryReset(false);
    flash("Factory reset complete. Reloading...");
    setTimeout(() => window.location.reload(), 1500);
  });

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    document.body.classList.toggle("dark", next);
    localStorage.setItem("sf-theme", next ? "dark" : "light");
    await setThemeApi(next ? "dark" : "light");
  };

  const onSaveGoal = async () => withWork(async () => {
    const val = parseInt(goalInput);
    if (isNaN(val) || val < 0) return;
    await setGoalApi(val);
    setWeeklyGoal(val);
    flash("Weekly goal updated.");
  });


  const onBackup = async () => withWork(async () => {
    await createBackup();
    flash("Backup created.");
    listBackups().then((b) => setBackups(b.backups)).catch(() => {});
  });

  const onToggleAutoBackup = async () => {
    try {
      const res = await toggleAutoBackup();
      setAutoBackup(res.auto_backup_enabled);
      flash(res.auto_backup_enabled ? "Auto-backup enabled." : "Auto-backup disabled.");
    } catch {
      flash("Failed to toggle auto-backup.");
    }
  };

  const onUseStreakFreeze = async () => withWork(async () => {
    const res = await useStreakFreeze();
    flash(res.message);
    getStreakStatus().then(setStreakStatus).catch(() => {});
  });

  const onImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importData(data);
        flash("Data imported successfully. Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } catch (e: any) {
        flash("Import failed: " + (e?.message || "invalid file"), 5000);
      }
    };
    input.click();
  };

  const jump = (key: string) => {
    setActiveSection(key);
  };

  return (
    <>
      <Topbar
        title="Settings"
        totalXp={dash?.total_xp || 0}
        rank={dash?.rank || "Rookie"}
        rankProgressPct={dash?.rank_progress_pct || 0}
        nextRankXp={dash?.next_rank_xp || 500}
        streak={dash?.current_streak || 0}
        streakMultiplier={dash?.streak_multiplier || 1}
      />
      <main className="content">
        <div className="settings-page">
          <aside className="settings-menu">
            <button className={activeSection === "api" ? "active" : ""} onClick={() => jump("api")}>API Configuration</button>
            <button className={activeSection === "skills" ? "active" : ""} onClick={() => jump("skills")}>Skill Management</button>
            <button className={activeSection === "schedule" ? "active" : ""} onClick={() => jump("schedule")}>Scheduler</button>
            <button className={activeSection === "appearance" ? "active" : ""} onClick={() => jump("appearance")}>Appearance</button>

            <button className={activeSection === "streak" ? "active" : ""} onClick={() => jump("streak")}>Streak Protection</button>
            <button className={activeSection === "backup" ? "active" : ""} onClick={() => jump("backup")}>Backup</button>
            <button className={activeSection === "account" ? "active" : ""} onClick={() => jump("account")}>Account</button>
          </aside>

          <section className="settings-main">
            <div className="page-heading compact">
              <h1>Settings</h1>
            </div>

            {activeSection === "api" && <div className="api-settings-section">
              {/* Provider Selector */}
              <div className="card settings-card api-provider-card">
                <div className="card-title">Active AI Provider</div>
                <div className="muted">Select which AI provider to use for mission generation and grading</div>
                <div className="api-provider-grid">
                  {([
                    { id: "openai" as const, label: "OpenAI", desc: "GPT-4o / GPT-3.5", hasKey: hasOpenaiKey, icon: "O" },
                    { id: "gemini" as const, label: "Gemini", desc: "Google AI (Free tier)", hasKey: hasGeminiKey, icon: "G" },
                    { id: "claude" as const, label: "Claude", desc: "Anthropic", hasKey: hasClaudeKey, icon: "C" },
                    { id: "groq" as const, label: "Groq", desc: "Llama 3 (Free)", hasKey: hasGroqKey, icon: "Q" },
                  ]).map((p) => (
                    <button
                      key={p.id}
                      className={`api-provider-btn ${activeProvider === p.id ? "active" : ""} ${!p.hasKey ? "no-key" : ""}`}
                      onClick={() => onSwitchProvider(p.id)}
                      disabled={working || !p.hasKey}
                    >
                      <span className="api-provider-icon">{p.icon}</span>
                      <span className="api-provider-info">
                        <span className="api-provider-name">{p.label}</span>
                        <span className="api-provider-desc">{p.desc}</span>
                      </span>
                      {activeProvider === p.id && <span className="api-provider-badge">Active</span>}
                      {!p.hasKey && <span className="api-provider-badge no-key-badge">No Key</span>}
                      {p.hasKey && activeProvider !== p.id && <span className="api-provider-badge ready-badge">Ready</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* OpenAI Key */}
              <div className={`card settings-card api-key-card ${hasOpenaiKey ? "has-key" : ""}`}>
                <div className="api-key-header">
                  <div>
                    <div className="card-title">OpenAI API Key</div>
                    <div className="muted">For GPT-3.5 / GPT-4o powered missions and grading</div>
                  </div>
                  {hasOpenaiKey && <span className="api-key-status connected">Connected</span>}
                </div>
                <div className="api-key-input-row">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey((e.target as HTMLInputElement).value)}
                    placeholder={hasOpenaiKey ? "Paste new key to replace..." : "sk-xxxxxxxxxxxxxxxxxxxxxxxx"}
                  />
                </div>
                {hasOpenaiKey && <div className="api-key-masked">Stored: {maskedOpenai}</div>}
                <div className="api-key-actions">
                  <button className="btn btn-primary" onClick={onSaveOpenaiKey} disabled={working || !apiKey.trim()}>Save Key</button>
                  <button className="btn btn-outline" onClick={onTestOpenaiKey} disabled={working || !apiKey.trim()}>Test Connection</button>
                </div>
              </div>

              {/* Gemini Key */}
              <div className={`card settings-card api-key-card ${hasGeminiKey ? "has-key" : ""}`}>
                <div className="api-key-header">
                  <div>
                    <div className="card-title">Google Gemini API Key</div>
                    <div className="muted">For Gemini-powered missions and grading</div>
                  </div>
                  {hasGeminiKey && <span className="api-key-status connected">Connected</span>}
                </div>
                <div className="api-key-input-row">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey((e.target as HTMLInputElement).value)}
                    placeholder={hasGeminiKey ? "Paste new key to replace..." : "AIzaSy..."}
                  />
                </div>
                {hasGeminiKey && <div className="api-key-masked">Stored: {maskedGemini}</div>}
                <div className="api-key-actions">
                  <button className="btn btn-primary" onClick={onSaveGeminiKey} disabled={working || !geminiKey.trim()}>Save Key</button>
                  <button className="btn btn-outline" onClick={onTestGeminiKey} disabled={working || !geminiKey.trim()}>Test Connection</button>
                </div>
              </div>

              {/* Claude Key */}
              <div className={`card settings-card api-key-card ${hasClaudeKey ? "has-key" : ""}`}>
                <div className="api-key-header">
                  <div>
                    <div className="card-title">Claude API Key (Anthropic)</div>
                    <div className="muted">For Claude Haiku / Sonnet powered missions and grading</div>
                  </div>
                  {hasClaudeKey && <span className="api-key-status connected">Connected</span>}
                </div>
                <div className="api-key-input-row">
                  <input
                    type="password"
                    value={claudeKey}
                    onChange={(e) => setClaudeKey((e.target as HTMLInputElement).value)}
                    placeholder={hasClaudeKey ? "Paste new key to replace..." : "sk-ant-api03-..."}
                  />
                </div>
                {hasClaudeKey && <div className="api-key-masked">Stored: {maskedClaude}</div>}
                <div className="api-key-actions">
                  <button className="btn btn-primary" onClick={onSaveClaudeKey} disabled={working || !claudeKey.trim()}>Save Key</button>
                  <button className="btn btn-outline" onClick={onTestClaudeKey} disabled={working || !claudeKey.trim()}>Test Connection</button>
                </div>
              </div>

              {/* Groq Key */}
              <div className={`card settings-card api-key-card ${hasGroqKey ? "has-key" : ""}`}>
                <div className="api-key-header">
                  <div>
                    <div className="card-title">Groq API Key (FREE)</div>
                    <div className="muted">Llama 3.1 / 3.3 powered - completely free, fast inference</div>
                  </div>
                  {hasGroqKey && <span className="api-key-status connected">Connected</span>}
                </div>
                <div className="api-key-input-row">
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey((e.target as HTMLInputElement).value)}
                    placeholder={hasGroqKey ? "Paste new key to replace..." : "gsk_xxxxxxxxxxxxxxxxxxxxxxxx"}
                  />
                </div>
                {hasGroqKey && <div className="api-key-masked">Stored: {maskedGroq}</div>}
                <div className="api-key-actions">
                  <button className="btn btn-primary" onClick={onSaveGroqKey} disabled={working || !groqKey.trim()}>Save Key</button>
                  <button className="btn btn-outline" onClick={onTestGroqKey} disabled={working || !groqKey.trim()}>Test Connection</button>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-dim)" }}>
                  Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>console.groq.com/keys</a>
                </div>
              </div>

              {/* Info note */}
              <div className="api-info-note">
                <strong>Tip:</strong> Groq is completely FREE with generous rate limits. Get a key at console.groq.com/keys and select Groq as your provider. The app will automatically fall back to other configured providers if the active one fails.
              </div>
            </div>}

            {activeSection === "skills" && <div className="card settings-card">
              <div className="card-title">Manage Skills</div>
              <ul className="skill-list refined">
                {skills.map((s) => (
                  <li key={s.id}>
                    {editing === s.id ? (
                      <div className="row" style={{ flex: 1, gap: 8 }}>
                        <input value={editIcon} onChange={(e) => setEditIcon((e.target as HTMLInputElement).value)} style={{ width: 58 }} maxLength={2} />
                        <input value={editName} onChange={(e) => setEditName((e.target as HTMLInputElement).value)} style={{ flex: 1 }} />
                        <button className="btn btn-primary" onClick={onSaveEdit} disabled={working}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="skill-list-name"><span>{s.icon}</span>{s.name}</span>
                        <div className="row" style={{ gap: 14 }}>
                          <span className="mini-level">LVL {s.level}</span>
                          <span className="muted">{s.mission_count} missions</span>
                          <button className="icon-link" onClick={() => onStartEdit(s)}>Edit</button>
                          <button className="icon-link danger" onClick={() => onDelete(s.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="add-skill-row">
                <input value={newIcon} onChange={(e) => setNewIcon((e.target as HTMLInputElement).value)} maxLength={2} />
                <input value={newSkill} onChange={(e) => setNewSkill((e.target as HTMLInputElement).value)} placeholder="Skill name" />
                <button className="btn btn-primary" onClick={onAddSkill} disabled={working || !newSkill.trim()}>Add</button>
              </div>
            </div>}

            {activeSection === "schedule" && <div className="card settings-card">
              <div className="card-title">Auto-Scheduler</div>
              <div className="schedule-list">
                <label>Morning missions ({String(morningHour).padStart(2, "0")}:00)<input type="checkbox" checked={morningEnabled} onChange={(e) => setMorningEnabled(e.target.checked)} /></label>
                <label>Mid-day reminder ({String(middayHour).padStart(2, "0")}:00)<input type="checkbox" checked={middayEnabled} onChange={(e) => setMiddayEnabled(e.target.checked)} /></label>
                <label>Evening review ({String(eveningHour).padStart(2, "0")}:00)<input type="checkbox" checked={eveningEnabled} onChange={(e) => setEveningEnabled(e.target.checked)} /></label>
                <label>Weekly report (Sunday 09:00)<input type="checkbox" checked={weeklyEnabled} onChange={(e) => setWeeklyEnabled(e.target.checked)} /></label>
              </div>
              <div className="schedule-inputs">
                <input type="number" min={0} max={23} value={morningHour} onChange={(e) => setMorningHour(Number((e.target as HTMLInputElement).value))} />
                <input type="number" min={0} max={23} value={middayHour} onChange={(e) => setMiddayHour(Number((e.target as HTMLInputElement).value))} />
                <input type="number" min={0} max={23} value={eveningHour} onChange={(e) => setEveningHour(Number((e.target as HTMLInputElement).value))} />
                <button className="btn btn-primary" onClick={onSaveSchedule} disabled={working}>Save Schedule</button>
              </div>

            </div>}

            {activeSection === "schedule" && <div className={`card settings-card api-key-card ${emailEnabled && hasEmailPassword && emailAddress ? "has-key" : ""}`}>
              <div className="api-key-header">
                <div>
                  <div className="card-title">Email Notifications</div>
                  <div className="muted">Receive scheduled notifications via Gmail</div>
                </div>
                {emailEnabled && hasEmailPassword && emailAddress ? (
                  <span className="api-key-status connected">Active</span>
                ) : hasEmailPassword && emailAddress ? (
                  <span className="api-key-status" style={{ background: "var(--bg-dim, #F1F5F9)", color: "var(--text-dim, #64748B)" }}>Paused</span>
                ) : null}
              </div>

              <div className="setting-row" style={{ justifyContent: "space-between", marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Enable Email</div>
                  <div className="muted" style={{ fontSize: 11 }}>Send morning, midday, and evening notifications to your inbox</div>
                </div>
                <div className={`toggle ${emailEnabled ? "on" : "off"}`} onClick={() => setEmailEnabled(!emailEnabled)}>
                  <div className="toggle-knob" />
                </div>
              </div>

              <div className="api-key-input-row">
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress((e.target as HTMLInputElement).value)}
                  placeholder="your.email@gmail.com"
                />
              </div>
              <div className="api-key-input-row" style={{ marginTop: 8 }}>
                <input
                  type="password"
                  value={emailAppPassword}
                  onChange={(e) => setEmailAppPassword((e.target as HTMLInputElement).value)}
                  placeholder={hasEmailPassword ? "App Password saved (enter new to change)" : "Gmail App Password"}
                />
              </div>
              {!hasEmailPassword && (
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Generate an App Password at{" "}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "var(--primary, #6366f1)" }}>
                    Google Account &rarr; App Passwords
                  </a>
                </div>
              )}

              <div className="api-key-actions">
                <button
                  className="btn btn-primary"
                  disabled={working || !emailAddress.trim() || (!hasEmailPassword && !emailAppPassword.trim())}
                  onClick={() => withWork(async () => {
                    const payload: Record<string, any> = {
                      email_address: emailAddress.trim(),
                      email_notifications_enabled: emailEnabled,
                    };
                    if (emailAppPassword) payload.email_app_password = emailAppPassword;
                    await updateEmailSettings(payload);
                    setEmailAppPassword("");
                    setHasEmailPassword(true);
                    flash("Email settings saved.");
                    await load();
                  })}
                >Save</button>
                <button
                  className="btn btn-outline"
                  disabled={working || !hasEmailPassword || !emailAddress.trim()}
                  onClick={() => withWork(async () => {
                    const res = await testEmailSettings();
                    flash(res.message);
                  })}
                >Test Connection</button>
              </div>
            </div>}

            {/* Appearance */}
            {activeSection === "appearance" && <div className="card settings-card">
              <div className="card-title">Appearance</div>
              <div className="setting-row" style={{ justifyContent: "space-between", marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Dark Mode</div>
                  <div className="muted" style={{ fontSize: 11 }}>Switch between light and dark theme</div>
                </div>
                <div className={`toggle ${darkMode ? "on" : "off"}`} onClick={toggleDarkMode}>
                  <div className="toggle-knob" />
                </div>
              </div>
              <div className="setting-row" style={{ justifyContent: "space-between", marginTop: 18 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Weekly XP Goal</div>
                  <div className="muted" style={{ fontSize: 11 }}>Set a target to track on the dashboard</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                    style={{ width: 80, padding: "6px 8px", fontSize: 12 }} min={0} placeholder="500" />
                  <button className="btn btn-primary" onClick={onSaveGoal} disabled={working}
                    style={{ padding: "4px 12px", minHeight: 28, fontSize: 12 }}>Save</button>
                </div>
              </div>
            </div>}


            {/* Streak Protection (#15) */}
            {activeSection === "streak" && <div className="card settings-card">
              <div className="card-title">Streak Protection</div>
              <div className="muted">Use streak freezes to protect your streak when you miss a day</div>
              {streakStatus && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--orange)" }}>{streakStatus.current_streak}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Current Streak</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{streakStatus.longest_streak}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Longest Streak</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--blue)" }}>{streakStatus.freezes_remaining}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Freezes Left</div>
                    </div>
                  </div>
                  <div className="setting-row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                        Streak Shield {streakStatus.streak_shield_active ? <span className="streak-shield" style={{ marginLeft: 8 }}>&#128737; Active</span> : ""}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {streakStatus.freezes_remaining > 0
                          ? `You have ${streakStatus.freezes_remaining} freeze(s) available`
                          : "No freezes available. Earn more through achievements!"}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={onUseStreakFreeze}
                      disabled={working || streakStatus.freezes_remaining <= 0}
                      style={{ fontSize: 12, padding: "6px 14px" }}
                    >
                      Use Freeze
                    </button>
                  </div>
                </div>
              )}
            </div>}

            {/* Backup */}
            {activeSection === "backup" && <div className="card settings-card">
              <div className="card-title">Database Backup</div>
              <div className="setting-row" style={{ justifyContent: "space-between", marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Auto-Backup</div>
                  <div className="muted" style={{ fontSize: 11 }}>Automatically backup database daily</div>
                </div>
                <div className={`toggle ${autoBackup ? "on" : "off"}`} onClick={onToggleAutoBackup}>
                  <div className="toggle-knob" />
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn btn-primary" onClick={onBackup} disabled={working} style={{ padding: "6px 14px", fontSize: 12 }}>Create Backup Now</button>
              </div>
              {backups.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>Recent Backups</div>
                  {backups.slice(0, 5).map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                      {b.filename} — {b.size_kb} KB — {b.created}
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {activeSection === "account" && <>
              <div className="card settings-card danger-zone">
                <div>
                  <div className="card-title">Danger Zone</div>
                  <p className="muted">This action cannot be undone. Export your data first if you want a backup.</p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset All Progress</button>
                  <button className="btn btn-danger" style={{ background: "#7F1D1D" }} onClick={() => setConfirmFactoryReset(true)}>Full Factory Reset</button>
                </div>
              </div>

              <div className="card settings-card">
                <div className="card-title">Manual Controls</div>
                <button className="btn btn-primary full" onClick={onGen} disabled={working}>Generate Today's Missions</button>
                <button className="btn btn-outline full" onClick={() => withWork(async () => { await runEveningReview(); flash("Evening review ran."); })} disabled={working}>Run Evening Review Now</button>
                <button className="btn btn-outline full" onClick={() => withWork(async () => { await sendTestNotification(); flash("Test notification sent."); })} disabled={working}>Send Test Notification</button>
                <button className="btn btn-outline full" onClick={onExport} disabled={working}>Export Data</button>
                <button className="btn btn-outline full" onClick={onImport} disabled={working}>Import Data</button>
              </div>
            </>}

            {msg && <div className="card settings-card toast-card">{msg}</div>}
          </section>
        </div>
      </main>
      {confirmReset && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <h3>Reset All Progress?</h3>
            <p>This permanently clears missions, scores, XP, notifications, achievements, and inventory progress.</p>
            <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={onReset} disabled={working}>Reset Progress</button>
            </div>
          </div>
        </div>
      )}
      {confirmFactoryReset && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <h3>Full Factory Reset?</h3>
            <p>This permanently deletes ALL data including skills, missions, API keys, and settings. This cannot be undone.</p>
            <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setConfirmFactoryReset(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "#7F1D1D" }} onClick={onFactoryReset} disabled={working}>Factory Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
