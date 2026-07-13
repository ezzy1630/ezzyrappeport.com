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
          <stop stopColor="#ECFAFF" />
          <stop offset="0.42" stopColor="#BDEAFF" />
          <stop offset="1" stopColor="#76BDE8" />
        </linearGradient>
        <linearGradient id="velox-mid" x1="210" y1="40" x2="438" y2="252" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B6ECFF" />
          <stop offset="0.44" stopColor="#58C4F4" />
          <stop offset="1" stopColor="#157FC4" />
        </linearGradient>
        <linearGradient id="velox-lead" x1="422" y1="36" x2="698" y2="260" gradientUnits="userSpaceOnUse">
          <stop stopColor="#48D4FF" />
          <stop offset="0.38" stopColor="#0E9EED" />
          <stop offset="1" stopColor="#0758B9" />
        </linearGradient>
        <linearGradient id="velox-edge" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#E7FAFF" stopOpacity="0.86" />
          <stop offset="1" stopColor="#2B7DB5" stopOpacity="0.34" />
        </linearGradient>
        <filter id="velox-shadow-soft" x="-40%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#135B91" floodOpacity="0.18" />
        </filter>
        <filter id="velox-shadow-mid" x="-40%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="21" stdDeviation="17" floodColor="#07598F" floodOpacity="0.25" />
        </filter>
        <filter id="velox-shadow-lead" x="-40%" y="-45%" width="190%" height="210%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="24" stdDeviation="18" floodColor="#034D93" floodOpacity="0.34" />
        </filter>
      </defs>

      <ellipse cx="382" cy="248" rx="286" ry="30" fill="#0B70B8" fillOpacity="0.1" />

      <g className={styles.veloxSignalPale} filter="url(#velox-shadow-soft)">
        <path d="M58 61L181 150L58 239L98 150L58 61Z" fill="url(#velox-pale)" />
        <path d="M58 61L181 150L170 159L96 112L58 61Z" fill="#F3FCFF" fillOpacity="0.74" />
        <path d="M181 150L58 239L98 150L170 141L181 150Z" fill="#4D9ED0" fillOpacity="0.24" />
      </g>

      <g className={styles.veloxSignalMid} filter="url(#velox-shadow-mid)">
        <path d="M226 50L372 150L226 250L274 150L226 50Z" fill="url(#velox-mid)" />
        <path d="M226 50L372 150L360 159L273 106L226 50Z" fill="#D7F6FF" fillOpacity="0.64" />
        <path d="M372 150L226 250L274 150L360 141L372 150Z" fill="#075D9E" fillOpacity="0.28" />
      </g>

      <g className={styles.veloxSignalLead} filter="url(#velox-shadow-lead)">
        <path d="M427 38L628 150L427 262L493 150L427 38Z" fill="url(#velox-lead)" />
        <path d="M427 38L628 150L615 160L492 94L427 38Z" fill="#BEEFFF" fillOpacity="0.58" />
        <path d="M628 150L427 262L493 150L615 140L628 150Z" fill="#06478E" fillOpacity="0.34" />
        <path d="M451 66L593 150L503 150L451 66Z" fill="url(#velox-edge)" fillOpacity="0.34" />
      </g>
    </svg>
  );
}
