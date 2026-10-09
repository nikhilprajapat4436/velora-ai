import { Sparkles } from "lucide-react";
import "./AuthIntro.css";

function AuthIntro({ isLeaving = false }) {
  return (
    <div className={`auth-intro-overlay${isLeaving ? " is-leaving" : ""}`} aria-label="Loading Velora AI" role="status">
      <div className="auth-intro-scene" aria-hidden="true">
        <div className="auth-intro-orbit auth-intro-orbit-one" />
        <div className="auth-intro-orbit auth-intro-orbit-two" />
        <div className="auth-intro-orbit auth-intro-orbit-three" />
        <span className="auth-intro-particle auth-intro-particle-one" />
        <span className="auth-intro-particle auth-intro-particle-two" />
        <span className="auth-intro-particle auth-intro-particle-three" />
        <div className="auth-intro-core"><Sparkles size={31} strokeWidth={1.6} /></div>
      </div>
      <div className="auth-intro-brand"><span>Velora</span> AI</div>
      <p className="auth-intro-caption">A little space for big ideas</p>
      <div className="auth-intro-progress" aria-hidden="true"><span /></div>
    </div>
  );
}

export default AuthIntro;
