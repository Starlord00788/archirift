/** The Archirift mark: a blueprint block split by a glowing rift. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--flow)" />
          <stop offset="1" stopColor="var(--player)" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="26" height="26" rx="7" fill="none" stroke="url(#logo-gradient)" strokeWidth="2.2" />
      <path d="M9 22 L13 13 L16 18 L19 9 L23 22" fill="none" stroke="url(#logo-gradient)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="9" r="1.8" fill="var(--pink)" />
    </svg>
  );
}
