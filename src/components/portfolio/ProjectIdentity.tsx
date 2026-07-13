import type { ProjectMediaAsset, ProjectSlug } from "@/lib/portfolio/content";
import styles from "./ProjectsSection.module.css";

type IdentitySlug = Exclude<ProjectSlug, "velox">;

type ProjectIdentityProps = {
  slug: IdentitySlug;
  media: ProjectMediaAsset;
  className?: string;
};

type MarkProps = {
  className?: string;
};

export default function ProjectIdentity({ slug, media, className }: ProjectIdentityProps) {
  switch (slug) {
    case "monkeyclaw":
      return <MonkeyClawMark media={media} className={className} />;
    case "etch":
      return <EtchMark className={className} />;
    case "flowe":
      return <FloweMark media={media} className={className} />;
    case "argyph":
      return <ArgyphMark media={media} className={className} />;
    case "nexarad":
      return <NexaRadMark media={media} className={className} />;
    case "mathpilot":
      return <MathPilotMark className={className} />;
  }
}

function MarkShell({
  slug,
  label,
  className,
  children,
}: MarkProps & { slug: IdentitySlug; label: string; children: React.ReactNode }) {
  return (
    <span className={`${styles.identityStage} ${className ?? ""}`} data-project-identity={slug}>
      <svg
        className={styles.identityCanvas}
        viewBox="0 0 760 300"
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
      >
        {children}
      </svg>
    </span>
  );
}

function Shadow({ color }: { color: string }) {
  return <ellipse className={styles.identityShadow} cx="380" cy="263" rx="205" ry="19" fill={color} fillOpacity="0.1" />;
}

function MonkeyClawMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="monkeyclaw" label="MonkeyClaw monkey head mark" className={className}>
      <defs>
        <filter id="monkey-native" x="-35%" y="-35%" width="170%" height="185%" colorInterpolationFilters="sRGB">
          <feColorMatrix result="monkey-tone" type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.24  0 0 0 0 0.28  -4 3 3 0 -0.08" />
          <feMorphology in="monkey-tone" operator="dilate" radius="0.7" />
          <feDropShadow dx="0" dy="17" stdDeviation="13" floodColor="#08777D" floodOpacity="0.3" />
        </filter>
        <clipPath id="monkey-native-crop"><rect x="58" y="8" width="644" height="230" /></clipPath>
      </defs>
      <Shadow color="#087B80" />
      <g className={styles.identityMark} clipPath="url(#monkey-native-crop)">
        <image href={media.src} x="30" y="-18" width="700" height="700" preserveAspectRatio="xMidYMid meet" filter="url(#monkey-native)" />
      </g>
    </MarkShell>
  );
}

function EtchMark({ className }: MarkProps) {
  return (
    <MarkShell slug="etch" label="Etch angular pen nib mark" className={className}>
      <defs>
        <linearGradient id="etch-light" x1="380" y1="25" x2="380" y2="267" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F4FAFF" /><stop offset="0.42" stopColor="#9DBCE8" /><stop offset="1" stopColor="#315B9D" />
        </linearGradient>
        <linearGradient id="etch-dark" x1="340" y1="80" x2="435" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#557DB9" /><stop offset="1" stopColor="#0A234A" />
        </linearGradient>
        <filter id="etch-depth" x="-45%" y="-35%" width="190%" height="185%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="17" stdDeviation="12" floodColor="#214E8D" floodOpacity="0.3" />
        </filter>
      </defs>
      <Shadow color="#315F9E" />
      <g className={styles.identityMark} filter="url(#etch-depth)">
        <g transform="translate(165 -45) scale(.42)" stroke="#071A38" strokeLinejoin="round" strokeWidth="14">
          <path className={styles.etchBlade} d="M692 126 563 157 418 461 497 421Z" fill="url(#etch-light)" />
          <path className={styles.etchBlade} d="M692 126 588 315 508 444 497 421Z" fill="#DCEAFF" />
          <path className={styles.etchBladeInset} d="M662 178 584 455 537 519 499 468Z" fill="#7799CD" />
          <path d="M418 461 499 468 537 519 565 578 512 622Z" fill="#90AED8" />
          <path d="M376 531 464 479 512 622 437 655Z" fill="#E8F2FF" />
          <path d="M376 531 336 861 437 655Z" fill="url(#etch-light)" />
          <path d="M512 622 565 578 494 711 411 800Z" fill="#B8CEE9" />
          <path d="M437 655 512 622 411 800 336 861Z" fill="url(#etch-dark)" />
          <path d="M337 861 418 686" stroke="#071A38" strokeWidth="20" strokeLinecap="round" />
          <circle cx="409" cy="690" r="28" fill="#071A38" stroke="none" />
        </g>
      </g>
    </MarkShell>
  );
}

function FloweMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="flowe" label="FlowE E-shaped brain mark" className={className}>
      <defs>
        <filter id="flowe-source" x="-35%" y="-35%" width="170%" height="185%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.42 1.42 0.22 0 -0.42" />
          <feDropShadow dx="0" dy="17" stdDeviation="13" floodColor="#246FC5" floodOpacity="0.27" />
        </filter>
      </defs>
      <Shadow color="#2A78C8" />
      <image className={styles.identityMark} href={media.src} x="200" y="-4" width="360" height="360" preserveAspectRatio="xMidYMid meet" filter="url(#flowe-source)" />
    </MarkShell>
  );
}

function ArgyphMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="argyph" label="Argyph angular A shield mark" className={className}>
      <defs>
        <filter id="argyph-native" x="-45%" y="-40%" width="190%" height="190%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.4 1.35 0.25 0 -0.3" />
          <feDropShadow dx="0" dy="17" stdDeviation="13" floodColor="#40579F" floodOpacity="0.28" />
        </filter>
        <clipPath id="argyph-native-crop"><rect x="250" y="12" width="260" height="205" /></clipPath>
      </defs>
      <Shadow color="#596FC0" />
      <g className={styles.identityMark} clipPath="url(#argyph-native-crop)">
        <image href={media.src} x="-182" y="-120" width="1125" height="1125" preserveAspectRatio="xMidYMid meet" filter="url(#argyph-native)" />
      </g>
    </MarkShell>
  );
}

function NexaRadMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="nexarad" label="NexaRad rib and evidence spine mark" className={className}>
      <defs>
        <filter id="nexa-native" x="-45%" y="-35%" width="190%" height="185%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.42 1.42 0.22 0 -0.36" />
          <feDropShadow dx="0" dy="14" stdDeviation="11" floodColor="#315D9E" floodOpacity="0.27" />
        </filter>
      </defs>
      <Shadow color="#4774B8" />
      <image className={styles.identityMark} href={media.src} x="180" y="-30" width="400" height="400" preserveAspectRatio="xMidYMid meet" filter="url(#nexa-native)" />
    </MarkShell>
  );
}

function MathPilotMark({ className }: MarkProps) {
  return (
    <MarkShell slug="mathpilot" label="MathPilot integral and mastery curve mark" className={className}>
      <defs>
        <linearGradient id="math-integral" x1="284" y1="42" x2="438" y2="257" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EFF9FF" /><stop offset="0.46" stopColor="#82C4F7" /><stop offset="1" stopColor="#2478DA" />
        </linearGradient>
        <linearGradient id="math-curve" x1="182" y1="238" x2="584" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3EA9EF" /><stop offset="1" stopColor="#E5F7FF" />
        </linearGradient>
        <filter id="math-depth" x="-35%" y="-40%" width="170%" height="190%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="#2175C6" floodOpacity="0.27" />
        </filter>
      </defs>
      <Shadow color="#2C83D3" />
      <g className={styles.identityMark} fill="none" filter="url(#math-depth)">
        <path className={styles.mathIntegral} d="M375 39C329 39 312 76 308 129L299 205C295 241 280 259 248 268" stroke="url(#math-integral)" strokeWidth="29" strokeLinecap="round" />
        <path className={styles.mathCurve} d="M178 244C258 217 310 242 360 199C426 143 468 92 590 63" stroke="url(#math-curve)" strokeWidth="10" strokeLinecap="round" />
        <path className={styles.mathCurveHighlight} d="M184 243C264 199 322 262 382 187C442 113 488 84 590 63" stroke="#F2FBFF" strokeOpacity="0.48" strokeWidth="2" />
        <g className={styles.mathPoints} fill="#176FCA" stroke="#E5F7FF" strokeWidth="3">
          <circle cx="277" cy="222" r="8" /><circle cx="382" cy="187" r="8" /><circle cx="539" cy="77" r="8" />
        </g>
      </g>
    </MarkShell>
  );
}
