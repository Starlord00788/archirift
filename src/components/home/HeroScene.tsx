/**
 * The hero illustration: a tiny system with live traffic. Requests flow from users through a load
 * balancer to servers, a cache and a database, while a rift flickers across the old monolith.
 * Pure SVG + SMIL, so it costs no JavaScript; reduced-motion users get a still frame.
 */
const PATHS = [
  "M 60 70 C 120 70, 130 160, 190 160",
  "M 60 160 L 190 160",
  "M 60 250 C 120 250, 130 160, 190 160",
  "M 250 160 C 290 160, 300 80, 340 80",
  "M 250 160 L 340 160",
  "M 250 160 C 290 160, 300 240, 340 240",
  "M 400 80 C 440 80, 450 120, 480 120",
  "M 400 160 C 440 160, 450 120, 480 120",
  "M 400 240 C 440 240, 450 210, 480 210",
  "M 400 160 C 440 160, 450 210, 480 210",
];

const COLOURS = ["var(--flow)", "var(--player)", "var(--pink)", "var(--lime)"];

export function HeroScene() {
  return (
    <svg viewBox="0 0 560 320" className="h-auto w-full" role="img" aria-label="Animated sketch: users send requests through a load balancer to three servers, a cache and a database.">
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--flow)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--flow)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rift" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--pink)" />
          <stop offset="1" stopColor="var(--player)" />
        </linearGradient>
      </defs>
      <circle cx="300" cy="160" r="170" fill="url(#hero-glow)" />

      {PATHS.map((d) => (
        <path key={d} d={d} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="4 5" />
      ))}

      <g className="motion-only">
      {PATHS.map((d, i) =>
        [0, 1].map((k) => (
          <circle key={`${i}-${k}`} r="3.4" fill={COLOURS[(i + k) % COLOURS.length]}>
            <animateMotion dur={`${1.6 + (i % 3) * 0.35}s`} begin={`${(i * 0.23 + k * 0.8) % 2}s`} repeatCount="indefinite" path={d} />
          </circle>
        )),
      )}
      </g>

      {/* Users */}
      {[70, 160, 250].map((y) => (
        <g key={y} transform={`translate(30 ${y - 18})`}>
          <rect width="34" height="36" rx="17" fill="var(--surface)" stroke="var(--ink-quiet)" strokeWidth="1.4" />
          <circle cx="17" cy="13" r="5" fill="none" stroke="var(--ink-quiet)" strokeWidth="1.4" />
          <path d="M 8 30 C 10 22, 24 22, 26 30" fill="none" stroke="var(--ink-quiet)" strokeWidth="1.4" />
        </g>
      ))}

      {/* Load balancer */}
      <g transform="translate(190 130)">
        <rect width="60" height="60" rx="14" fill="var(--surface)" stroke="var(--flow)" strokeWidth="2" />
        <path d="M 14 30 H 30 M 30 30 L 46 18 M 30 30 L 46 42 M 30 30 H 46" stroke="var(--flow)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <text x="30" y="76" textAnchor="middle" fontSize="10" fill="var(--ink-quiet)" className="font-mono">
          load balancer
        </text>
      </g>

      {/* Servers */}
      {[80, 160, 240].map((y, i) => (
        <g key={y} transform={`translate(340 ${y - 22})`}>
          <rect width="60" height="44" rx="9" fill="var(--surface)" stroke="var(--player)" strokeWidth="1.6" />
          <rect x="10" y="12" width="40" height="6" rx="3" fill="var(--player)" opacity="0.35" />
          <rect x="10" y="24" width="40" height="6" rx="3" fill="var(--player)" opacity="0.35" />
          <circle cx="48" cy="15" r="2" fill="var(--good)">
            <animate attributeName="opacity" values="1;0.2;1" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* Cache */}
      <g transform="translate(480 96)">
        <rect width="58" height="48" rx="14" fill="var(--surface)" stroke="var(--lime)" strokeWidth="1.6" />
        <path d="M 31 10 L 22 26 H 30 L 27 38 L 37 21 H 29 Z" fill="var(--lime)" />
      </g>

      {/* Database with a rift that keeps trying to open */}
      <g transform="translate(480 186)">
        <ellipse cx="29" cy="8" rx="29" ry="8" fill="var(--surface)" stroke="var(--warn)" strokeWidth="1.6" />
        <path d="M 0 8 V 44 C 0 54, 58 54, 58 44 V 8" fill="var(--surface)" stroke="var(--warn)" strokeWidth="1.6" />
        <path d="M 0 26 C 0 36, 58 36, 58 26" fill="none" stroke="var(--warn)" strokeWidth="1.2" opacity="0.6" />
        <path d="M 18 14 L 28 26 L 22 32 L 36 46" fill="none" stroke="url(#rift)" strokeWidth="2.4" strokeLinecap="round">
          <animate attributeName="opacity" values="0;1;0.2;0" dur="3.2s" repeatCount="indefinite" />
        </path>
      </g>

      <text x="500" y="300" textAnchor="middle" fontSize="10" fill="var(--ink-quiet)" className="font-mono">
        cache + database
      </text>
      <text x="370" y="300" textAnchor="middle" fontSize="10" fill="var(--ink-quiet)" className="font-mono">
        app servers
      </text>
    </svg>
  );
}
