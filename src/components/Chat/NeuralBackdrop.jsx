import "./NeuralBackdrop.css";

const links = [
  ["M 80 90 C 190 30, 245 145, 355 90"],
  ["M 355 90 C 445 30, 530 110, 650 70"],
  ["M 80 90 C 190 155, 255 220, 355 180"],
  ["M 355 180 C 445 125, 535 190, 650 150"],
  ["M 355 90 C 335 125, 340 145, 355 180"],
  ["M 650 70 C 730 115, 770 170, 850 150"],
  ["M 650 150 C 730 205, 770 95, 850 150"],
  ["M 80 90 C 75 190, 180 260, 285 245"],
  ["M 285 245 C 405 265, 500 205, 650 150"],
  ["M 355 90 C 470 5, 550 20, 650 70"],
];

const nodes = [
  [80, 90], [285, 245], [355, 90], [355, 180], [650, 70], [650, 150], [850, 150],
];

function NeuralBackdrop({ active }) {
  return (
    <div className={`neural-backdrop ${active ? "is-active" : ""}`} aria-hidden="true">
      <div className="neural-core" />
      <div className="neural-orbit neural-orbit-outer" />
      <div className="neural-orbit neural-orbit-inner" />
      <svg viewBox="0 0 930 320" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="neural-glow"><stop stopColor="var(--app-ai-glow)" stopOpacity=".3" /><stop offset="1" stopColor="var(--app-ai-glow)" stopOpacity="0" /></radialGradient>
        </defs>
        {links.map(([path]) => <path className="neural-link" d={path} key={path} />)}
        {nodes.map(([cx, cy]) => <g key={`${cx}-${cy}`}><circle className="neural-node-halo" cx={cx} cy={cy} r="12" /><circle className="neural-node" cx={cx} cy={cy} r="2.7" /></g>)}
        {links.map((_, index) => (
          <circle className="neural-particle" r={index % 2 ? "1.9" : "1.5"} key={index}>
            <animateMotion dur={`${active ? 4 + index * 0.35 : 8 + index * 0.8}s`} begin={`${index * -1.3}s`} repeatCount="indefinite" path={links[index][0]} />
          </circle>
        ))}
        <circle cx="355" cy="135" r="82" fill="url(#neural-glow)" />
      </svg>
    </div>
  );
}

export default NeuralBackdrop;
