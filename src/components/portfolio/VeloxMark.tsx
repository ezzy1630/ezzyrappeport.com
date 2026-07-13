import styles from "./ProjectsSection.module.css";

type VeloxMarkProps = {
  className?: string;
};

/**
 * A native, layered version of the Velox signal mark. Keeping the three forms
 * separate lets the page light and move them like objects instead of treating
 * the identity as one flat bitmap.
 */
export default function VeloxMark({ className }: VeloxMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 760 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="velox-pale" x1="44" y1="48" x2="250" y2="244" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F4F5FF" />
          <stop offset="0.42" stopColor="#D9DCFF" />
          <stop offset="1" stopColor="#A7A9F4" />
        </linearGradient>
        <linearGradient id="velox-mid" x1="210" y1="40" x2="438" y2="252" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D5D6FF" />
          <stop offset="0.44" stopColor="#9694F7" />
          <stop offset="1" stopColor="#5650CF" />
        </linearGradient>
        <linearGradient id="velox-lead" x1="422" y1="36" x2="698" y2="260" gradientUnits="userSpaceOnUse">
          <stop stopColor="#777BFF" />
          <stop offset="0.38" stopColor="#3838F0" />
          <stop offset="1" stopColor="#2311A8" />
        </linearGradient>
        <linearGradient id="velox-edge" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#F0F0FF" stopOpacity="0.88" />
          <stop offset="1" stopColor="#5147D6" stopOpacity="0.38" />
        </linearGradient>
        <filter id="velox-shadow-soft" x="-40%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="#4345A8" floodOpacity="0.17" />
        </filter>
        <filter id="velox-shadow-mid" x="-40%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="19" stdDeviation="14" floodColor="#3335A2" floodOpacity="0.23" />
        </filter>
        <filter id="velox-shadow-lead" x="-40%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="22" stdDeviation="15" floodColor="#2625A2" floodOpacity="0.3" />
        </filter>
      </defs>

      <ellipse cx="382" cy="248" rx="286" ry="26" fill="#3334B2" fillOpacity="0.09" />

      <g className={styles.veloxSignalPale} filter="url(#velox-shadow-soft)">
        <path d="M58 61L181 150L58 239L98 150L58 61Z" fill="url(#velox-pale)" />
        <path d="M58 61L181 150L170 159L96 112L58 61Z" fill="#FFFFFF" fillOpacity="0.72" />
        <path d="M181 150L58 239L98 150L170 141L181 150Z" fill="#7775D8" fillOpacity="0.25" />
      </g>

      <g className={styles.veloxSignalMid} filter="url(#velox-shadow-mid)">
        <path d="M226 50L372 150L226 250L274 150L226 50Z" fill="url(#velox-mid)" />
        <path d="M226 50L372 150L360 159L273 106L226 50Z" fill="#F0F0FF" fillOpacity="0.68" />
        <path d="M372 150L226 250L274 150L360 141L372 150Z" fill="#38339B" fillOpacity="0.3" />
      </g>

      <g className={styles.veloxSignalLead} filter="url(#velox-shadow-lead)">
        <path d="M427 38L628 150L427 262L493 150L427 38Z" fill="url(#velox-lead)" />
        <path d="M427 38L628 150L615 160L492 94L427 38Z" fill="#C9CAFF" fillOpacity="0.62" />
        <path d="M628 150L427 262L493 150L615 140L628 150Z" fill="#160A76" fillOpacity="0.38" />
        <path d="M451 66L593 150L503 150L451 66Z" fill="url(#velox-edge)" fillOpacity="0.34" />
      </g>
    </svg>
  );
}
