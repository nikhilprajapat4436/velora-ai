import { useEffect, useState } from "react";
import { Accessibility, Brain, Check, Download, ImagePlus, KeyRound, MessageSquare, Palette, Save, ShieldCheck, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { apiUrl } from "../../api";
import MemoryManagement from "../MemoryManagement/MemoryManagement";
import { applyThemePalette, themePalettes } from "../../themePalettes";
import "./Settings.css";

const avatarOptions = ["🌙", "🚀", "🦊", "🐼", "🐯", "🐸", "🐧", "🐨"];
const chatSizeOptions = [
  { id: "compact", label: "Compact", description: "Smaller message text" },
  { id: "default", label: "Default", description: "Balanced reading size" },
  { id: "large", label: "Large", description: "Larger, easier-to-read text" },
];
const defaultPreferences = {
  language: "auto",
  length: "balanced",
  tone: "friendly",
  model: "openai/gpt-oss-120b",
  sendOnEnter: true,
  autoScroll: true,
  memoryEnabled: true,
  reduceMotion: false,
  highContrast: false,
  imageAspectRatio: "square",
  imageQuality: "standard",
  notifications: false,
};

function readPreferences() {
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem("ai-assistant-preferences") || "{}"),
    };
  } catch {
    return defaultPreferences;
  }
}

function AvatarPreview({ value, name }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isPreset = value?.startsWith("preset:");

  if (isPreset) {
    return <span className="settings-avatar-emoji">{value.slice(7)}</span>;
  }

  if (value && !imageFailed) {
    return (
      <img
        className="settings-avatar-image"
        src={value}
        alt=""
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <span className="settings-avatar-emoji settings-avatar-initial">{name?.trim()?.charAt(0).toUpperCase() || "U"}</span>;
}

function Settings({ user, onUserUpdated, onBack, onClearChatHistory, onLogout, onAccountDeleted }) {
  const [section, setSection] = useState("profile");
  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || `preset:${avatarOptions[0]}`);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [preferences, setPreferences] = useState(readPreferences);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [accountStatus, setAccountStatus] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [accent, setAccent] = useState(() => {
    try {
      const savedAccent = localStorage.getItem("ai-assistant-accent");
      if (savedAccent === "elegant-light") return "pearl-sage";
      if (savedAccent === "indigo") return "royal-futuristic";
      if (savedAccent === "cyan") return "royal-futuristic";
      if (savedAccent === "rose") return "midnight-luxury";
      if (savedAccent === "emerald") return "royal-emerald";
      return themePalettes.some((option) => option.id === savedAccent) ? savedAccent : "royal-emerald";
    } catch {
      return "royal-emerald";
    }
  });
  const [chatSize, setChatSize] = useState(() => {
    try {
      const savedSize = localStorage.getItem("ai-assistant-chat-size");
      return chatSizeOptions.some((option) => option.id === savedSize) ? savedSize : "default";
    } catch {
      return "default";
    }
  });

  useEffect(() => {
    applyThemePalette(accent);
    try {
      localStorage.setItem("ai-assistant-accent", accent);
    } catch {
      // Accent still applies for this session when browser storage is unavailable.
    }
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.chatSize = chatSize;
    try {
      localStorage.setItem("ai-assistant-chat-size", chatSize);
    } catch {
      // Apply the selected text size for this session if storage is unavailable.
    }
  }, [chatSize]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = preferences.reduceMotion ? "true" : "false";
    document.documentElement.dataset.highContrast = preferences.highContrast ? "true" : "false";
  }, [preferences.reduceMotion, preferences.highContrast]);

  const selectAccent = (accentId) => {
    setAccent(accentId);
  };

  const savePreferences = (event) => {
    event.preventDefault();
    try {
      localStorage.setItem("ai-assistant-preferences", JSON.stringify(preferences));
      setPreferencesSaved(true);
    } catch {
      setPreferencesSaved(false);
    }
  };

  const updatePreference = (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      localStorage.setItem("ai-assistant-preferences", JSON.stringify(updated));
      setPreferencesSaved(true);
    } catch {
      setPreferencesSaved(false);
    }
  };

  const requestNotifications = async (enabled) => {
    if (!enabled) {
      updatePreference("notifications", false);
      return;
    }
    if (!("Notification" in window)) {
      setAccountStatus({ type: "error", text: "Notifications are not supported by this browser." });
      return;
    }
    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") {
        updatePreference("notifications", false);
        setAccountStatus({ type: "error", text: "Allow notifications in your browser to enable this option." });
        return;
      }
      updatePreference("notifications", true);
    } catch {
      updatePreference("notifications", false);
      setAccountStatus({ type: "error", text: "The browser could not enable notifications." });
    }
  };

  const fetchAccountAction = async (path, method, body) => {
    const response = await fetch(apiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  const downloadAccountData = async () => {
    setAccountBusy(true);
    setAccountStatus(null);
    try {
      const data = await fetchAccountAction("/api/auth/export", "GET");
      const exportData = {
        ...data,
        localPreferences: {
          responseAndAccessibility: JSON.parse(localStorage.getItem("ai-assistant-preferences") || "{}"),
          palette: localStorage.getItem("ai-assistant-accent"),
          chatTextSize: localStorage.getItem("ai-assistant-chat-size"),
        },
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ai-assistant-data-export.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAccountStatus({ type: "success", text: "Your account data export has been downloaded." });
    } catch (error) {
      setAccountStatus({ type: "error", text: error.message });
    } finally {
      setAccountBusy(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setAccountBusy(true);
    setAccountStatus(null);
    try {
      await fetchAccountAction("/api/auth/password", "PUT", { currentPassword, newPassword });
      setAccountStatus({ type: "success", text: "Password changed. Signing you out so you can sign in with the new password." });
      window.setTimeout(() => onLogout?.({ skipSave: true }), 900);
    } catch (error) {
      setAccountStatus({ type: "error", text: error.message });
    } finally {
      setAccountBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    setAccountBusy(true);
    setAccountStatus(null);
    try {
      await fetchAccountAction("/api/auth/logout-all", "POST", {});
      onLogout?.({ skipSave: true });
    } catch (error) {
      setAccountStatus({ type: "error", text: error.message });
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    if (!window.confirm("This permanently deletes your account, chats, uploaded documents, images, and AI memories. Continue?")) return;
    setAccountBusy(true);
    setAccountStatus(null);
    try {
      await fetchAccountAction("/api/auth/account", "DELETE", { confirmation: deleteConfirmation, password: deletePassword });
      onAccountDeleted?.();
    } catch (error) {
      setAccountStatus({ type: "error", text: error.message });
      setAccountBusy(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setStatus(null);
    setSaving(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/auth/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, avatar }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not update your profile");
      }

      onUserUpdated(data.user);
      setName(data.user.name);
      setAvatar(data.user.avatar || `preset:${avatarOptions[0]}`);
      setStatus({ type: "success", text: "Profile saved successfully." });
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="settings-page">
      <aside className="settings-nav">
        <div className="settings-nav-heading">
          <span className="settings-nav-icon"><UserRound size={18} /></span>
          <div>
            <strong>Settings</strong>
            <span>Manage your assistant</span>
          </div>
        </div>

        <p className="settings-nav-label">PREFERENCES</p>
        <button
          type="button"
          className={`settings-nav-item ${section === "profile" ? "active" : ""}`}
          onClick={() => setSection("profile")}
        >
          <UserRound size={17} />
          <span>Profile</span>
        </button>
        <button
          type="button"
          className={`settings-nav-item ${section === "memory" ? "active" : ""}`}
          onClick={() => setSection("memory")}
        >
          <Brain size={17} />
          <span>AI Memory</span>
        </button>
        <button
          type="button"
          className={`settings-nav-item ${section === "response" ? "active" : ""}`}
          onClick={() => setSection("response")}
        >
          <SlidersHorizontal size={17} />
          <span>Response style</span>
        </button>
        <button type="button" className={`settings-nav-item ${section === "chat" ? "active" : ""}`} onClick={() => setSection("chat")}>
          <MessageSquare size={17} /><span>Chat controls</span>
        </button>
        <button type="button" className={`settings-nav-item ${section === "privacy" ? "active" : ""}`} onClick={() => setSection("privacy")}>
          <ShieldCheck size={17} /><span>Privacy & data</span>
        </button>
        <button type="button" className={`settings-nav-item ${section === "accessibility" ? "active" : ""}`} onClick={() => setSection("accessibility")}>
          <Accessibility size={17} /><span>Accessibility</span>
        </button>
        <button type="button" className={`settings-nav-item ${section === "images" ? "active" : ""}`} onClick={() => setSection("images")}>
          <ImagePlus size={17} /><span>Image generation</span>
        </button>
        <button type="button" className={`settings-nav-item ${section === "security" ? "active" : ""}`} onClick={() => setSection("security")}>
          <KeyRound size={17} /><span>Security</span>
        </button>
        <button
          type="button"
          className={`settings-nav-item ${section === "appearance" ? "active" : ""}`}
          onClick={() => setSection("appearance")}
        >
          <Palette size={17} />
          <span>Appearance</span>
        </button>

        <button type="button" className="settings-back-btn" onClick={onBack}>
          Back to chat
        </button>
      </aside>

      <section className="settings-main">
        {section === "memory" ? (
          <MemoryManagement onBack={() => setSection("profile")} />
        ) : section === "appearance" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header">
              <p className="settings-eyebrow">PERSONALIZATION</p>
              <h1>Appearance</h1>
          <p>Choose a complete visual theme for your assistant.</p>
            </header>

            <section className="settings-profile-card settings-appearance-card">
              <div className="settings-card-heading">
                <div>
                  <h2>Color palette</h2>
                  <p>Each palette updates the complete interface and AI animations immediately.</p>
                </div>
              </div>
              <div className="settings-theme-options" role="group" aria-label="Color palette">
                {themePalettes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`settings-theme-option ${accent === option.id ? "selected" : ""}`}
                    aria-pressed={accent === option.id}
                    onClick={() => selectAccent(option.id)}
                  >
                    <span className="settings-theme-swatch palette-theme-swatch" style={{ "--swatch-color": option.color, "--swatch-base": option.base, "--swatch-primary": option.primary, "--swatch-soft": option.soft }}>
                      {accent === option.id && <Check size={16} />}
                    </span>
                    <span>{option.label}</span>
                    <small className="settings-theme-mode">{option.mode === "dark" ? "Dark" : "Light"}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-profile-card settings-appearance-card settings-chat-size-card">
              <div className="settings-card-heading">
                <div>
                  <h2>Chat text size</h2>
                  <p>Adjust message text size on this device.</p>
                </div>
              </div>
              <div className="settings-size-options" role="group" aria-label="Chat text size">
                {chatSizeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`settings-size-option ${chatSize === option.id ? "selected" : ""}`}
                    aria-pressed={chatSize === option.id}
                    onClick={() => setChatSize(option.id)}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : section === "response" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header">
              <p className="settings-eyebrow">PERSONALIZATION</p>
              <h1>Response style</h1>
              <p>Choose how the assistant should answer your messages.</p>
            </header>

            <form className="settings-profile-card settings-preferences-card" onSubmit={savePreferences}>
              <label className="settings-preference-row" htmlFor="preference-language">
                <span>
                  <strong>Reply language</strong>
                  <small>Choose a language or follow your message.</small>
                </span>
                <select
                  id="preference-language"
                  value={preferences.language}
                  onChange={(event) => {
                    setPreferences({ ...preferences, language: event.target.value });
                    setPreferencesSaved(false);
                  }}
                >
                  <option value="auto">Automatic</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                </select>
              </label>

              <label className="settings-preference-row" htmlFor="preference-length">
                <span>
                  <strong>Answer length</strong>
                  <small>Set the usual amount of detail.</small>
                </span>
                <select
                  id="preference-length"
                  value={preferences.length}
                  onChange={(event) => {
                    setPreferences({ ...preferences, length: event.target.value });
                    setPreferencesSaved(false);
                  }}
                >
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>

              <label className="settings-preference-row" htmlFor="preference-tone">
                <span>
                  <strong>Tone</strong>
                  <small>Pick the assistant&apos;s default tone.</small>
                </span>
                <select
                  id="preference-tone"
                  value={preferences.tone}
                  onChange={(event) => {
                    setPreferences({ ...preferences, tone: event.target.value });
                    setPreferencesSaved(false);
                  }}
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                </select>
              </label>

              <label className="settings-preference-row" htmlFor="preference-model">
                <span>
                  <strong>AI model</strong>
                  <small>Select which available model answers text chats.</small>
                </span>
                <select
                  id="preference-model"
                  value={preferences.model}
                  onChange={(event) => {
                    setPreferences({ ...preferences, model: event.target.value });
                    setPreferencesSaved(false);
                  }}
                >
                  <option value="openai/gpt-oss-120b">GPT OSS 120B</option>
                  <option value="qwen/qwen3.8-27b">Qwen 3.8 27B</option>
                </select>
              </label>

              {preferencesSaved && (
                <p className="settings-status success" role="status">
                  Preferences saved on this device.
                </p>
              )}

              <div className="settings-form-actions">
                <button className="settings-save-btn" type="submit">
                  <Save size={16} />
                  <span>Save preferences</span>
                </button>
              </div>
            </form>
          </div>
        ) : section === "chat" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header"><p className="settings-eyebrow">CHAT PREFERENCES</p><h1>Chat controls</h1><p>Choose how the chat input and conversation view behave.</p></header>
            <form className="settings-profile-card settings-preferences-card" onSubmit={savePreferences}>
              <label className="settings-toggle-row"><span><strong>Enter sends message</strong><small>Turn off to use Enter for a new line. Shift + Enter always adds a line.</small></span><input type="checkbox" checked={preferences.sendOnEnter} onChange={(event) => updatePreference("sendOnEnter", event.target.checked)} /></label>
              <label className="settings-toggle-row"><span><strong>Keep view at latest message</strong><small>Automatically scroll down as replies arrive.</small></span><input type="checkbox" checked={preferences.autoScroll} onChange={(event) => updatePreference("autoScroll", event.target.checked)} /></label>
              <label className="settings-toggle-row"><span><strong>Completion notifications</strong><small>Show a browser notification when a reply finishes while this tab is in the background.</small></span><input type="checkbox" checked={preferences.notifications} onChange={(event) => void requestNotifications(event.target.checked)} /></label>
              {accountStatus && <p className={`settings-status ${accountStatus.type}`} role="status">{accountStatus.text}</p>}
              {preferencesSaved && <p className="settings-status success" role="status">Chat controls saved on this device.</p>}
              <div className="settings-form-actions"><button className="settings-save-btn" type="submit"><Save size={16} /><span>Save preferences</span></button></div>
            </form>
          </div>
        ) : section === "privacy" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header"><p className="settings-eyebrow">YOUR DATA</p><h1>Privacy & data</h1><p>Control AI memory, manage stored chats, and export your information.</p></header>
            <section className="settings-profile-card settings-preferences-card">
              <label className="settings-toggle-row"><span><strong>AI memory</strong><small>When enabled, the assistant can save and use useful details from chats.</small></span><input type="checkbox" checked={preferences.memoryEnabled} onChange={(event) => updatePreference("memoryEnabled", event.target.checked)} /></label>
              <div className="settings-privacy-action"><span><strong>Clear chat history</strong><small>Permanently remove all saved conversations and their stored image attachments.</small></span><button type="button" className="settings-danger-btn" onClick={async () => { if (!window.confirm("Delete all saved chats and their images? This cannot be undone.")) return; setAccountBusy(true); setAccountStatus(null); try { await onClearChatHistory?.(); setAccountStatus({ type: "success", text: "Chat history cleared." }); } catch (error) { setAccountStatus({ type: "error", text: error.message }); } finally { setAccountBusy(false); } }} disabled={accountBusy}><Trash2 size={15} />Clear chats</button></div>
              <div className="settings-privacy-action"><span><strong>Clear AI memories</strong><small>Delete details the assistant has saved for personalization.</small></span><button type="button" className="settings-danger-btn" onClick={async () => { if (!window.confirm("Delete all AI memories?")) return; setAccountBusy(true); setAccountStatus(null); try { await fetchAccountAction("/api/memories", "DELETE"); setAccountStatus({ type: "success", text: "AI memories cleared." }); } catch (error) { setAccountStatus({ type: "error", text: error.message }); } finally { setAccountBusy(false); } }} disabled={accountBusy}><Trash2 size={15} />Clear memories</button></div>
              <div className="settings-privacy-action"><span><strong>Export account data</strong><small>Download your profile, conversations, uploaded documents and memories as JSON.</small></span><button type="button" className="settings-secondary-btn" onClick={downloadAccountData} disabled={accountBusy}><Download size={15} />Download export</button></div>
              {accountStatus && <p className={`settings-status ${accountStatus.type}`} role="status">{accountStatus.text}</p>}
              {preferencesSaved && <p className="settings-status success" role="status">Privacy preferences saved on this device.</p>}
              <div className="settings-form-actions"><button className="settings-save-btn" type="button" onClick={savePreferences}><Save size={16} /><span>Save preferences</span></button></div>
            </section>
          </div>
        ) : section === "accessibility" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header"><p className="settings-eyebrow">INCLUSIVE DESIGN</p><h1>Accessibility</h1><p>Reduce decorative movement and improve contrast across the interface.</p></header>
            <form className="settings-profile-card settings-preferences-card" onSubmit={savePreferences}>
              <label className="settings-toggle-row"><span><strong>Reduce motion</strong><small>Pause decorative animations and use immediate scrolling.</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => updatePreference("reduceMotion", event.target.checked)} /></label>
              <label className="settings-toggle-row"><span><strong>High contrast</strong><small>Strengthen text, borders, and keyboard focus visibility.</small></span><input type="checkbox" checked={preferences.highContrast} onChange={(event) => updatePreference("highContrast", event.target.checked)} /></label>
              {preferencesSaved && <p className="settings-status success" role="status">Accessibility preferences saved on this device.</p>}
              <div className="settings-form-actions"><button className="settings-save-btn" type="submit"><Save size={16} /><span>Save preferences</span></button></div>
            </form>
          </div>
        ) : section === "images" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header"><p className="settings-eyebrow">CREATION DEFAULTS</p><h1>Image generation</h1><p>Set your preferred image shape and render detail.</p></header>
            <form className="settings-profile-card settings-preferences-card" onSubmit={savePreferences}>
              <label className="settings-preference-row" htmlFor="image-aspect-ratio"><span><strong>Aspect ratio</strong><small>Used for future generated images.</small></span><select id="image-aspect-ratio" value={preferences.imageAspectRatio} onChange={(event) => updatePreference("imageAspectRatio", event.target.value)}><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
              <label className="settings-preference-row" htmlFor="image-quality"><span><strong>Render quality</strong><small>Higher detail can take longer and use more provider resources.</small></span><select id="image-quality" value={preferences.imageQuality} onChange={(event) => updatePreference("imageQuality", event.target.value)}><option value="draft">Draft · faster</option><option value="standard">Standard</option><option value="high">High detail</option></select></label>
              {preferencesSaved && <p className="settings-status success" role="status">Image preferences saved on this device.</p>}
              <div className="settings-form-actions"><button className="settings-save-btn" type="submit"><Save size={16} /><span>Save preferences</span></button></div>
            </form>
          </div>
        ) : section === "security" ? (
          <div className="settings-profile-page">
            <header className="settings-page-header"><p className="settings-eyebrow">ACCOUNT PROTECTION</p><h1>Security</h1><p>Update your password, manage active sessions, or delete your account.</p></header>
            {user?.provider === "google" ? (
              <section className="settings-profile-card settings-preferences-card"><div className="settings-card-heading"><div><h2>Password</h2><p>Your account uses Google sign-in. Manage its password and recovery options in your Google account.</p></div></div></section>
            ) : <form className="settings-profile-card settings-preferences-card" onSubmit={handlePasswordChange}>
              <div className="settings-card-heading"><div><h2>Change password</h2><p>Changing your password signs out all current sessions.</p></div></div>
              <label className="settings-field-label" htmlFor="current-password">Current password</label><input id="current-password" className="settings-name-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              <label className="settings-field-label settings-password-next" htmlFor="new-password">New password</label><input id="new-password" className="settings-name-input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              <div className="settings-form-actions"><button className="settings-save-btn" type="submit" disabled={accountBusy}><KeyRound size={16} /><span>Change password</span></button></div>
            </form>}
            <section className="settings-profile-card settings-security-actions"><div className="settings-privacy-action"><span><strong>Sign out from all devices</strong><small>Revoke every active sign-in session, including this one.</small></span><button type="button" className="settings-secondary-btn" onClick={handleLogoutAll} disabled={accountBusy}><UserRound size={15} />Sign out everywhere</button></div>
              <form onSubmit={handleDeleteAccount} className="settings-delete-account"><div className="settings-card-heading"><div><h2>Delete account</h2><p>This permanently removes your account and associated chats, documents, images, and memories.</p></div></div><label className="settings-field-label" htmlFor="delete-confirmation">Type your account email to confirm</label><input id="delete-confirmation" className="settings-name-input" type="email" autoComplete="email" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} required /><label className="settings-field-label settings-password-next" htmlFor="delete-password">Password (required for email/password accounts)</label><input id="delete-password" className="settings-name-input" type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /><div className="settings-form-actions"><button className="settings-danger-btn" type="submit" disabled={accountBusy || deleteConfirmation.toLowerCase() !== String(user?.email || "").toLowerCase()}><Trash2 size={15} /><span>Delete my account</span></button></div></form>
            </section>
            {accountStatus && <p className={`settings-status ${accountStatus.type}`} role="status">{accountStatus.text}</p>}
          </div>
        ) : (
          <div className="settings-profile-page">
            <header className="settings-page-header">
              <p className="settings-eyebrow">YOUR ACCOUNT</p>
              <h1>Profile</h1>
              <p>Personalize how your account appears in the assistant.</p>
            </header>

            <form className="settings-profile-card" onSubmit={saveProfile}>
              <div className="settings-card-heading">
                <div>
                  <h2>Profile details</h2>
                  <p>Your name and avatar are shown in the sidebar.</p>
                </div>
                <div className="settings-profile-preview">
                  <AvatarPreview key={avatar} value={avatar} name={name} />
                </div>
              </div>

              <label className="settings-field-label" htmlFor="settings-name">
                Display name
              </label>
              <input
                id="settings-name"
                className="settings-name-input"
                type="text"
                minLength={2}
                maxLength={40}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />

              <div className="settings-field-label settings-avatar-label">Choose an avatar</div>
              <div className="settings-avatar-grid" role="group" aria-label="Choose an avatar">
                {avatarOptions.map((option) => {
                  const value = `preset:${option}`;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`settings-avatar-option ${avatar === value ? "selected" : ""}`}
                      aria-label={`Select ${option} avatar`}
                      aria-pressed={avatar === value}
                      onClick={() => setAvatar(value)}
                    >
                      <span>{option}</span>
                      {avatar === value && <Check size={14} />}
                    </button>
                  );
                })}
                {user?.avatar?.startsWith("https://") && (
                  <button
                    type="button"
                    className={`settings-avatar-option settings-google-avatar ${avatar === user.avatar ? "selected" : ""}`}
                    aria-label="Use your Google profile photo"
                    aria-pressed={avatar === user.avatar}
                    onClick={() => setAvatar(user.avatar)}
                  >
                    <AvatarPreview key={user.avatar} value={user.avatar} name={name} />
                    {avatar === user.avatar && <Check size={14} />}
                  </button>
                )}
              </div>

              <div className="settings-readonly-field">
                <span>Email address</span>
                <strong>{user?.email || "Not available"}</strong>
              </div>

              {status && (
                <p className={`settings-status ${status.type}`} role="status">
                  {status.text}
                </p>
              )}

              <div className="settings-form-actions">
                <button className="settings-save-btn" type="submit" disabled={saving || !name.trim()}>
                  <Save size={16} />
                  <span>{saving ? "Saving..." : "Save changes"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

export default Settings;
