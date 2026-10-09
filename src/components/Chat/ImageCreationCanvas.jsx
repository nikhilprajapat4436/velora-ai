import { Sparkles } from "lucide-react";
import "./ImageCreationCanvas.css";

function ImageCreationCanvas({ prompt, phase }) {
  return (
    <section className={`image-creation-card image-phase-${phase}`} role="status" aria-live="polite" aria-label="AI image generation in progress">
      <div className="image-creation-heading">
        <span className="image-creation-mark"><Sparkles size={15} /></span>
        <div><strong>{phase === "understanding" ? "Understanding your prompt" : phase === "rendering" ? "Refining the image" : "Creating your image"}</strong><span>{prompt}</span></div>
      </div>
      <div className="image-creation-canvas" aria-hidden="true">
        <div className="creation-energy" />
        <div className="creation-shape creation-shape-one" />
        <div className="creation-shape creation-shape-two" />
        <div className="creation-scan" />
        <i className="creation-particle particle-one" /><i className="creation-particle particle-two" /><i className="creation-particle particle-three" /><i className="creation-particle particle-four" />
        <span className="creation-corner corner-one" /><span className="creation-corner corner-two" /><span className="creation-corner corner-three" /><span className="creation-corner corner-four" />
      </div>
      <div className="image-creation-footer"><span className="creation-state-dot" />Neural visual synthesis</div>
    </section>
  );
}

export default ImageCreationCanvas;
