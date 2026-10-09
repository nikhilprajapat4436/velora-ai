import { useState } from "react";
import "./Auth.css";
import { GoogleLogin } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import { Sparkles } from "lucide-react";
import { apiUrl } from "../../api";
import { getNativeGoogleCredential } from "../../nativeGoogleAuth";

function Login({ onRegister, onLoginSuccess, isIntroRevealing = false }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const isNativeApp = Capacitor.isNativePlatform();
  const finishLogin = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    onLoginSuccess();
  };

  const completeGoogleLogin = async (credential) => {
    const response = await fetch(apiUrl("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Google login failed");
    finishLogin(data);
  };

  const handleGoogleCredential = async (credential) => {
    setLoading(true);
    setMessage("");
    try {
      await completeGoogleLogin(credential);
    } catch (error) {
      setMessage(error.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNativeGoogleLogin = async () => {
    setLoading(true);
    setMessage("");
    try {
      const credential = await getNativeGoogleCredential();
      await completeGoogleLogin(credential);
    } catch (error) {
      const detail = String(error?.message || "").toLowerCase();
      if (detail.includes("cancel")) setMessage("Google sign-in was cancelled.");
      else if (detail.includes("28444") || detail.includes("developer console")) {
        setMessage("Google Sign-In needs the Android package and signing SHA-1 registered in Google Cloud.");
      } else {
        setMessage("Google sign-in could not finish. Check Android OAuth setup and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      finishLogin(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-container${isIntroRevealing ? " auth-page-reveal" : ""}`}>
      <main className="auth-layout">
        <section className="auth-panel">
          <div className="auth-brand"><span className="auth-brand-mark"><img src="/pwa-icon.svg" alt="" /></span><span>Velora AI</span></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <p className="auth-eyebrow">YOUR CREATIVE SPACE</p>
            <h1>Welcome back</h1>
            <p className="auth-description">Sign in to continue your conversations and creations.</p>

            <label className="auth-field"><span>Email address</span><input type="email" name="email" placeholder="you@example.com" autoComplete="email" value={formData.email} onChange={handleChange} required /></label>
            <label className="auth-field"><span>Password</span><input type="password" name="password" placeholder="Enter your password" autoComplete="current-password" value={formData.password} onChange={handleChange} required /></label>

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <div className="auth-divider"><span>or continue with</span></div>
            <div className="auth-google-button">
              {isNativeApp ? (
                <button className="auth-native-google-btn" type="button" onClick={handleNativeGoogleLogin} disabled={loading}>
                  <span className="auth-google-g" aria-hidden="true">G</span>
                  {loading ? "Connecting to Google…" : "Sign in with Google"}
                </button>
              ) : (
                <GoogleLogin
                  onSuccess={(credentialResponse) => void handleGoogleCredential(credentialResponse.credential)}
                  onError={() => setMessage("Google login failed")}
                  width="360"
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                />
              )}
            </div>

            {message && <p className="auth-message" role="alert">{message}</p>}
            <p className="auth-switch-row">New to Velora AI? <button type="button" className="auth-switch-btn" onClick={onRegister}>Create an account</button></p>
          </form>
        </section>

        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-visual-glow" />
          <div className="auth-visual-orbit auth-visual-orbit-one" />
          <div className="auth-visual-orbit auth-visual-orbit-two" />
          <div className="auth-visual-core"><Sparkles size={26} /></div>
          <div className="auth-visual-copy"><span>THINK · CREATE · EXPLORE</span><h2>Your ideas,<br />in motion.</h2><p>One thoughtful assistant for conversations, images, documents and more.</p></div>
          <div className="auth-visual-footer"><span className="auth-online-dot" />Ready when you are</div>
        </aside>
      </main>
    </div>
  );
}

export default Login;
