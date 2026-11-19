export function PotIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="76"
      height="86"
      viewBox="0 0 76 86"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 14h62v12H7zM10 26l10 52h36l10-52M7 19h62"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function BotanicalIllustration() {
  return (
    <svg
      className="botanical-illustration"
      width="180"
      height="180"
      viewBox="0 0 180 180"
      fill="none"
      aria-hidden="true"
    >
      {[32, 76, 120].map((x, i) => (
        <g key={x} stroke={i === 1 ? "#789464" : "#afc195"} strokeWidth="1.7">
          <path d={`M${x} 8 Q${x + 11} 60 ${x + 6} 174`} />
          <path
            d={`M${x + 6} 53 C${x - 34} 51 ${x - 24} 25 ${x + 3} 37 M${x + 8} 89 C${x + 49} 82 ${x + 34} 57 ${x + 6} 68 M${x + 8} 130 C${x - 32} 125 ${x - 29} 96 ${x + 7} 105`}
          />
        </g>
      ))}
    </svg>
  );
}
