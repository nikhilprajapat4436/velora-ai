import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, X } from "lucide-react";
import "./AndroidDownloadPrompt.css";

const DISMISS_KEY = "velora-android-download-dismissed-until";
const DISMISS_DAYS = 30;
const APK_URL = "https://github.com/nikhilprajapat4436/velora-ai/releases/latest/download/VeloraAI.apk";

function AndroidDownloadPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isAndroidBrowser = /android/i.test(navigator.userAgent) && !Capacitor.isNativePlatform();
    if (!isAndroidBrowser) return;

    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 2400;
    const timer = window.setTimeout(() => {
      try {
        const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
        setVisible(Date.now() >= dismissedUntil);
      } catch {
        setVisible(true);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // Dismiss the prompt for this render even if storage is unavailable.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="android-download-prompt" aria-label="Velora AI Android app">
      <div className="android-download-copy">
        <span className="android-download-icon"><Download size={17} /></span>
        <span><strong>Velora AI for Android</strong><small>Get the app for a smoother mobile experience.</small></span>
      </div>
      <a className="android-download-action" href={APK_URL} download="VeloraAI.apk">
        Download APK
      </a>
      <button className="android-download-dismiss" type="button" onClick={dismiss} aria-label="Dismiss app download suggestion" title="Dismiss">
        <X size={17} />
      </button>
    </aside>
  );
}

export default AndroidDownloadPrompt;
