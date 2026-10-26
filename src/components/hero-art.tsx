// The hero illustration, drawn in SVG: a resume page, a lens revealing the visible text, and soft rounded shapes.
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 440" className={className} role="img" aria-label="A resume under a magnifying lens">
      <defs>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#5a4a2a" floodOpacity="0.18" />
        </filter>
        <radialGradient id="paper" cx="35%" cy="25%" r="90%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efe7d3" />
        </radialGradient>
        <radialGradient id="lav" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#d9cdfa" />
          <stop offset="1" stopColor="#9c85e0" />
        </radialGradient>
        <radialGradient id="peach" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffd0b2" />
          <stop offset="1" stopColor="#f2915c" />
        </radialGradient>
        <radialGradient id="ochre" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#f8d98a" />
          <stop offset="1" stopColor="#d49d26" />
        </radialGradient>
        <radialGradient id="pink" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ff8fb5" />
          <stop offset="1" stopColor="#e8306f" />
        </radialGradient>
        <radialGradient id="glass" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#f1ecff" stopOpacity="0.85" />
        </radialGradient>
        <clipPath id="lens"><circle cx="318" cy="196" r="78" /></clipPath>
      </defs>

      <ellipse cx="400" cy="360" rx="70" ry="64" fill="url(#peach)" filter="url(#soft)" />
      <circle cx="96" cy="118" r="40" fill="url(#ochre)" filter="url(#soft)" />
      <rect x="54" y="300" width="96" height="96" rx="30" fill="url(#pink)" filter="url(#soft)" transform="rotate(-14 102 348)" />

      <g filter="url(#soft)" transform="rotate(-6 250 220)">
        <rect x="140" y="50" width="230" height="300" rx="22" fill="url(#paper)" />
        <circle cx="182" cy="96" r="18" fill="#1a3a3a" />
        <rect x="210" y="86" width="110" height="10" rx="5" fill="#0a0a0a" />
        <rect x="210" y="104" width="74" height="8" rx="4" fill="#9a9a9a" />
        {[146, 168, 190, 232, 254, 276, 298].map((y, i) => (
          <rect key={y} x="166" y={y} width={i % 3 === 2 ? 120 : 176} height="8" rx="4" fill="#d8cfb8" />
        ))}
        <rect x="166" y="212" width="150" height="6" rx="3" fill="#ff4d8b" opacity="0.18" />
      </g>

      <g filter="url(#soft)">
        <rect x="372" y="262" width="34" height="120" rx="17" fill="url(#lav)" transform="rotate(-40 389 322)" />
        <circle cx="318" cy="196" r="94" fill="url(#lav)" />
        <circle cx="318" cy="196" r="78" fill="url(#glass)" />
      </g>
      <g clipPath="url(#lens)" transform="rotate(-6 250 220)">
        <rect x="166" y="146" width="176" height="9" rx="4.5" fill="#0a0a0a" opacity="0.75" />
        <rect x="166" y="168" width="176" height="9" rx="4.5" fill="#0a0a0a" opacity="0.75" />
        <rect x="166" y="190" width="120" height="9" rx="4.5" fill="#0a0a0a" opacity="0.75" />
        <rect x="166" y="211" width="160" height="9" rx="4.5" fill="#ff4d8b" />
        <rect x="166" y="232" width="176" height="9" rx="4.5" fill="#0a0a0a" opacity="0.75" />
      </g>
      <ellipse cx="288" cy="160" rx="22" ry="12" fill="#fff" opacity="0.7" transform="rotate(-30 288 160)" />
    </svg>
  );
}
