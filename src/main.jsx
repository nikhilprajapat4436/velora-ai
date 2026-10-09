import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from "@capacitor/core"
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from "@react-oauth/google"
import { applyInterfaceColors, readInterfaceColors } from "./colorPreferences.js"

const allowedChatSizes = new Set(["compact", "default", "large"])
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "30640422083-i8htrvkvjgjq26nlo3ecb950ohdt5em9.apps.googleusercontent.com"
try {
  localStorage.removeItem("ai-assistant-accent")
  delete document.documentElement.dataset.accent
  delete document.documentElement.dataset.theme
  applyInterfaceColors(readInterfaceColors())
  const savedChatSize = localStorage.getItem("ai-assistant-chat-size")
  if (allowedChatSizes.has(savedChatSize)) document.documentElement.dataset.chatSize = savedChatSize
  let savedPreferences = {}
  try {
    savedPreferences = JSON.parse(localStorage.getItem("ai-assistant-preferences") || "{}") || {}
  } catch {
    // Keep the default appearance if older preference data is malformed.
  }
  if (savedPreferences.reduceMotion) document.documentElement.dataset.reduceMotion = "true"
  if (savedPreferences.highContrast) document.documentElement.dataset.highContrast = "true"
} catch {
  applyInterfaceColors()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {Capacitor.isNativePlatform()
      ? <App />
      : <GoogleOAuthProvider clientId={googleClientId}><App /></GoogleOAuthProvider>}
  </StrictMode>,
)

const isNativeApp = Capacitor.isNativePlatform()

if (import.meta.env.PROD && !isNativeApp && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

if (isNativeApp && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => caches.keys())
    .then((cacheKeys) => Promise.all(
      cacheKeys
        .filter((key) => key.startsWith("velora-ai-shell-") || key.startsWith("ai-assistant-shell-"))
        .map((key) => caches.delete(key)),
    ))
    .catch((error) => console.warn("Could not clear the old web cache in the Android app:", error));
}
