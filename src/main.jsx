import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from "@react-oauth/google"
import { applyThemePalette } from "./themePalettes.js"

const accentMigration = { indigo: "royal-futuristic", cyan: "royal-futuristic", rose: "midnight-luxury", emerald: "royal-emerald", "elegant-light": "pearl-sage" }
const allowedAccents = new Set(["royal-emerald", "midnight-luxury", "royal-futuristic", "pearl-sage", "champagne-pearl", "arctic-silver"])
const allowedChatSizes = new Set(["compact", "default", "large"])
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "30640422083-i8htrvkvjgjq26nlo3ecb950ohdt5em9.apps.googleusercontent.com"
try {
  const savedAccent = localStorage.getItem("ai-assistant-accent")
  const accent = accentMigration[savedAccent] || (allowedAccents.has(savedAccent) ? savedAccent : "royal-emerald")
  applyThemePalette(accent)
  if (accent !== savedAccent) localStorage.setItem("ai-assistant-accent", accent)
  const savedChatSize = localStorage.getItem("ai-assistant-chat-size")
  if (allowedChatSizes.has(savedChatSize)) document.documentElement.dataset.chatSize = savedChatSize
  let savedPreferences = {}
  try {
    savedPreferences = JSON.parse(localStorage.getItem("ai-assistant-preferences") || "{}") || {}
  } catch {
    // Keep the selected palette even if older preference data is malformed.
  }
  if (savedPreferences.reduceMotion) document.documentElement.dataset.reduceMotion = "true"
  if (savedPreferences.highContrast) document.documentElement.dataset.highContrast = "true"
} catch {
  applyThemePalette("royal-emerald")
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
