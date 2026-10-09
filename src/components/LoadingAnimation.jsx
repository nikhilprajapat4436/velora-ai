import { Sparkles } from "lucide-react";
import "./LoadingAnimation.css";

function LoadingAnimation({ message = "Loading…", compact = false }) {
  return (
    <div className={`premium-loader${compact ? " premium-loader-compact" : ""}`} role="status" aria-live="polite">
      <div className="premium-loader-orbit" aria-hidden="true">
        <span className="premium-loader-orbit-ring premium-loader-ring-one" />
        <span className="premium-loader-orbit-ring premium-loader-ring-two" />
        <span className="premium-loader-signal premium-loader-signal-one" />
        <span className="premium-loader-signal premium-loader-signal-two" />
        <span className="premium-loader-core"><Sparkles size={22} strokeWidth={1.6} /></span>
      </div>
      <span className="premium-loader-message">{message}</span>
      <span className="premium-loader-track" aria-hidden="true"><span /></span>
    </div>
  );
}

export default LoadingAnimation;
