import { useState } from "react";
import "./Auth.css";
import { Sparkles } from "lucide-react";
import { apiUrl } from "../../api";

function Register({ onLogin , onRegisterSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
      const response = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      localStorage.setItem("token", data.token);
localStorage.setItem("user", JSON.stringify(data.user));
onRegisterSuccess();

setMessage("Registration successful!");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <main className="auth-layout auth-layout-register">
        <section className="auth-panel">
          <div className="auth-brand"><span className="auth-brand-mark"><img src="/pwa-icon.svg" alt="" /></span><span>Velora AI</span></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <p className="auth-eyebrow">START SOMETHING NEW</p>
            <h1>Create your account</h1>
            <p className="auth-description">Make a space for your ideas, questions and creative work.</p>

            <label className="auth-field"><span>Your name</span><input type="text" name="name" placeholder="How should we call you?" autoComplete="name" value={formData.name} onChange={handleChange} minLength={2} maxLength={40} required /></label>
            <label className="auth-field"><span>Email address</span><input type="email" name="email" placeholder="you@example.com" autoComplete="email" value={formData.email} onChange={handleChange} required /></label>
            <label className="auth-field"><span>Password</span><input type="password" name="password" placeholder="Create a password" autoComplete="new-password" value={formData.password} onChange={handleChange} required /></label>

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
            {message && <p className="auth-message" role="alert">{message}</p>}
            <p className="auth-switch-row">Already have an account? <button type="button" className="auth-switch-btn" onClick={onLogin}>Sign in</button></p>
          </form>
        </section>

        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-visual-glow" />
          <div className="auth-visual-orbit auth-visual-orbit-one" />
          <div className="auth-visual-orbit auth-visual-orbit-two" />
          <div className="auth-visual-core"><Sparkles size={26} /></div>
          <div className="auth-visual-copy"><span>THINK · CREATE · EXPLORE</span><h2>A fresh space<br />for your ideas.</h2><p>Bring your questions, plans and imagination together with AI.</p></div>
          <div className="auth-visual-footer"><span className="auth-online-dot" />Ready when you are</div>
        </aside>
      </main>
    </div>
  );
}

export default Register;
