import type { ProjectMediaAsset, ProjectSlug } from "@/lib/portfolio/content";
import styles from "./ProjectsSection.module.css";

type IdentitySlug = Exclude<ProjectSlug, "velox">;

type ProjectIdentityProps = {
  slug: IdentitySlug;
  media: ProjectMediaAsset;
  className?: string;
};

type MarkProps = { className?: string };

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
        viewBox="0 0 760 320"
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
      >
        {children}
      </svg>
    </span>
  );
}

function MonkeyClawMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="monkeyclaw" label="MonkeyClaw geometric monkey head mark" className={className}>
      <defs>
        <filter id="monkey-extract" x="-35%" y="-35%" width="170%" height="190%" colorInterpolationFilters="sRGB">
          <feColorMatrix
            result="monkey-alpha"
            type="matrix"
            values="0 0 0 0 0.018  0 0 0 0 0.19  0 0 0 0 0.22  -3.6 3 3 0 -0.08"
          />
          <feMorphology in="monkey-alpha" operator="dilate" radius="1.05" result="monkey-weight" />
          <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#087A80" floodOpacity="0.2" />
        </filter>
        <filter id="monkey-echo" x="-35%" y="-35%" width="170%" height="190%" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.22  0 0 0 0 0.82  0 0 0 0 0.78  -3.6 3 3 0 -0.08"
          />
          <feMorphology operator="dilate" radius="1.6" />
        </filter>
        <clipPath id="monkey-head-crop"><rect x="74" y="0" width="612" height="221" /></clipPath>
        <linearGradient id="monkey-floor" x1="190" y1="0" x2="574" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5ADFD6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#11777B" stopOpacity="0.26" />
          <stop offset="1" stopColor="#5ADFD6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className={styles.monkeyFloor} d="M170 260C282 244 478 244 590 260C478 276 282 276 170 260Z" fill="url(#monkey-floor)" />
      <g className={styles.monkeyEcho} clipPath="url(#monkey-head-crop)" opacity="0.13" transform="translate(7 4)">
        <image href={media.src} x="-70" y="-150" width="900" height="900" preserveAspectRatio="xMidYMid meet" filter="url(#monkey-echo)" />
      </g>
      <g className={styles.identityMark} clipPath="url(#monkey-head-crop)">
        <image href={media.src} x="-70" y="-150" width="900" height="900" preserveAspectRatio="xMidYMid meet" filter="url(#monkey-extract)" />
      </g>
    </MarkShell>
  );
}

function EtchMark({ className }: MarkProps) {
  return (
    <MarkShell slug="etch" label="Etch precision pen nib mark" className={className}>
      <defs>
        <linearGradient id="etch-white-metal" x1="390" y1="22" x2="358" y2="296" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" /><stop offset="0.3" stopColor="#DCEAFF" /><stop offset="0.67" stopColor="#799DD5" /><stop offset="1" stopColor="#244D8C" />
        </linearGradient>
        <linearGradient id="etch-blue-metal" x1="330" y1="70" x2="448" y2="280" gradientUnits="userSpaceOnUse">
          <stop stopColor="#AFCBFA" /><stop offset="0.48" stopColor="#507DC2" /><stop offset="1" stopColor="#0A2A60" />
        </linearGradient>
        <linearGradient id="etch-core-metal" x1="370" y1="106" x2="418" y2="253" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7FBFF" /><stop offset="0.55" stopColor="#A7BFE2" /><stop offset="1" stopColor="#5B78A7" />
        </linearGradient>
        <filter id="etch-depth" x="-45%" y="-38%" width="190%" height="196%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="16" stdDeviation="10" floodColor="#173F7A" floodOpacity="0.25" />
        </filter>
        <linearGradient id="etch-ground" x1="240" y1="0" x2="525" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B87C9" stopOpacity="0" /><stop offset="0.52" stopColor="#1D4F93" stopOpacity="0.2" /><stop offset="1" stopColor="#5B87C9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className={styles.etchGround} d="M227 272C310 259 457 259 540 272C457 284 310 284 227 272Z" fill="url(#etch-ground)" />
      <g transform="translate(149 -52) scale(.465)">
        <g className={styles.identityMark} filter="url(#etch-depth)">
          <g stroke="#071A3C" strokeLinejoin="round" strokeWidth="11">
            <path className={styles.etchBlade} d="M692 126 563 157 418 461 497 421Z" fill="url(#etch-white-metal)" />
            <path className={styles.etchBlade} d="M692 126 588 315 508 444 497 421Z" fill="#EAF3FF" />
            <path className={styles.etchBladeInset} d="M662 178 584 455 537 519 499 468Z" fill="url(#etch-blue-metal)" />
            <path d="M418 461 499 468 537 519 565 578 512 622Z" fill="#86A8D8" />
            <path d="M376 531 464 479 512 622 437 655Z" fill="url(#etch-core-metal)" />
            <path d="M376 531 336 861 437 655Z" fill="url(#etch-white-metal)" />
            <path d="M512 622 565 578 494 711 411 800Z" fill="#B9D0EF" />
            <path d="M437 655 512 622 411 800 336 861Z" fill="url(#etch-blue-metal)" />
          </g>
          <path d="M337 861 418 686" stroke="#071A3C" strokeWidth="18" strokeLinecap="round" />
          <circle cx="409" cy="690" r="27" fill="#071A3C" />
          <path d="M418 461 499 468 662 178M537 519 584 455 662 178" fill="none" stroke="#071A3C" strokeWidth="8" strokeLinejoin="round" />
          <path d="M651 151 578 176 457 427" fill="none" stroke="#FFFFFF" strokeOpacity="0.72" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
    </MarkShell>
  );
}

function FloweMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="flowe" label="FlowE E-shaped brain mark" className={className}>
      <defs>
        <filter id="flowe-mask-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.95 0.95 0.95 0 -1.2" />
          <feMorphology operator="dilate" radius="0.35" />
        </filter>
        <mask id="flowe-native-mask" maskUnits="userSpaceOnUse" x="172" y="-18" width="416" height="416">
          <image href={media.src} x="184" y="-12" width="392" height="392" filter="url(#flowe-mask-filter)" />
        </mask>
        <linearGradient id="flowe-pearl" x1="258" y1="41" x2="487" y2="275" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9F3FC" /><stop offset="0.22" stopColor="#BCD9F0" /><stop offset="0.55" stopColor="#7EA6CF" /><stop offset="0.82" stopColor="#4B73A7" /><stop offset="1" stopColor="#294E7F" />
        </linearGradient>
        <linearGradient id="flowe-sheen" x1="244" y1="54" x2="500" y2="249" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.9" /><stop offset="0.42" stopColor="#C8F1FF" stopOpacity="0.12" /><stop offset="1" stopColor="#4D81CD" stopOpacity="0.42" />
        </linearGradient>
        <filter id="flowe-depth" x="-45%" y="-45%" width="190%" height="205%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="15" stdDeviation="11" floodColor="#255A9A" floodOpacity="0.25" />
        </filter>
      </defs>
      <ellipse className={styles.floweGround} cx="380" cy="274" rx="151" ry="12" fill="#316DAF" fillOpacity="0.11" />
      <g className={styles.identityMark} mask="url(#flowe-native-mask)" filter="url(#flowe-depth)">
        <rect x="176" y="-8" width="408" height="392" fill="url(#flowe-pearl)" />
        <path className={styles.floweSheen} d="M205 54C315 7 469 21 548 102C472 76 333 90 236 166Z" fill="url(#flowe-sheen)" />
      </g>
    </MarkShell>
  );
}

function ArgyphMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="argyph" label="Argyph angular A shield mark" className={className}>
      <defs>
        <filter id="argyph-mask-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.5 0.65 1.1 0 -0.35" />
        </filter>
        <mask id="argyph-native-mask" maskUnits="userSpaceOnUse" x="214" y="16" width="332" height="280">
          <g clipPath="url(#argyph-symbol-crop)">
            <image href={media.src} x="-519" y="-213" width="1800" height="1800" filter="url(#argyph-mask-filter)" />
          </g>
        </mask>
        <clipPath id="argyph-symbol-crop"><rect x="214" y="16" width="332" height="280" /></clipPath>
        <linearGradient id="argyph-facet" x1="278" y1="27" x2="486" y2="285" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CAD9FF" /><stop offset="0.29" stopColor="#829EE9" /><stop offset="0.62" stopColor="#506FBE" /><stop offset="1" stopColor="#293F8D" />
        </linearGradient>
        <linearGradient id="argyph-sheen" x1="277" y1="36" x2="496" y2="224" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.75" /><stop offset="0.42" stopColor="#AFC3FF" stopOpacity="0.18" /><stop offset="1" stopColor="#526CC1" stopOpacity="0" />
        </linearGradient>
        <filter id="argyph-depth" x="-45%" y="-45%" width="190%" height="205%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="16" stdDeviation="11" floodColor="#3D51A2" floodOpacity="0.25" />
        </filter>
      </defs>
      <path className={styles.argyphGround} d="M222 275C316 260 444 260 538 275C444 289 316 289 222 275Z" fill="#566FC0" fillOpacity="0.1" />
      <g className={styles.identityMark} mask="url(#argyph-native-mask)" filter="url(#argyph-depth)">
        <rect x="208" y="8" width="344" height="292" fill="url(#argyph-facet)" />
        <path className={styles.argyphSheen} d="M225 49 367 7 540 89 459 129 317 93Z" fill="url(#argyph-sheen)" />
      </g>
    </MarkShell>
  );
}

function NexaRadMark({ media, className }: MarkProps & { media: ProjectMediaAsset }) {
  return (
    <MarkShell slug="nexarad" label="NexaRad rib and evidence spine mark" className={className}>
      <defs>
        <filter id="nexa-mask-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.55 0.7 1 0 -0.37" />
        </filter>
        <mask id="nexa-native-mask" maskUnits="userSpaceOnUse" x="154" y="-26" width="452" height="452">
          <image href={media.src} x="154" y="-26" width="452" height="452" filter="url(#nexa-mask-filter)" />
        </mask>
        <linearGradient id="nexa-bone" x1="227" y1="28" x2="529" y2="298" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFE1F6" /><stop offset="0.25" stopColor="#9CBDE9" /><stop offset="0.58" stopColor="#5D89CB" /><stop offset="1" stopColor="#294F91" />
        </linearGradient>
        <linearGradient id="nexa-scan" x1="240" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0" /><stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.66" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id="nexa-depth" x="-45%" y="-35%" width="190%" height="190%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="13" stdDeviation="9" floodColor="#315B99" floodOpacity="0.22" />
        </filter>
      </defs>
      <path className={styles.nexaGround} d="M205 278C305 263 455 263 555 278C455 292 305 292 205 278Z" fill="#4C73B3" fillOpacity="0.1" />
      <g className={styles.identityMark} mask="url(#nexa-native-mask)" filter="url(#nexa-depth)">
        <rect x="150" y="-28" width="460" height="460" fill="url(#nexa-bone)" />
        <rect className={styles.nexaScan} x="170" y="34" width="420" height="20" rx="10" fill="url(#nexa-scan)" />
      </g>
    </MarkShell>
  );
}

function MathPilotMark({ className }: MarkProps) {
  return (
    <MarkShell slug="mathpilot" label="MathPilot integral and mastery trajectory mark" className={className}>
      <defs>
        <linearGradient id="math-integral" x1="286" y1="28" x2="391" y2="290" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" /><stop offset="0.28" stopColor="#D7EEFF" /><stop offset="0.68" stopColor="#76B5EE" /><stop offset="1" stopColor="#2475C9" />
        </linearGradient>
        <linearGradient id="math-curve" x1="160" y1="246" x2="602" y2="69" gradientUnits="userSpaceOnUse">
          <stop stopColor="#167BD2" /><stop offset="0.46" stopColor="#5AB7EC" /><stop offset="1" stopColor="#DDF6FF" />
        </linearGradient>
        <filter id="math-depth" x="-35%" y="-45%" width="170%" height="205%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="14" stdDeviation="9" floodColor="#1A69B3" floodOpacity="0.24" />
        </filter>
      </defs>
      <path className={styles.mathGround} d="M162 278C270 263 474 263 598 278C474 292 270 292 162 278Z" fill="#2E83CB" fillOpacity="0.1" />
      <g className={styles.identityMark} fill="none" filter="url(#math-depth)">
        <path className={styles.mathIntegral} d="M382 38C334 24 309 67 306 128L299 210C295 255 275 283 238 278" stroke="#2C75BB" strokeOpacity="0.36" strokeWidth="38" strokeLinecap="round" />
        <path className={styles.mathIntegral} d="M382 35C337 31 321 69 317 128L309 210C305 248 289 268 256 275" stroke="url(#math-integral)" strokeWidth="27" strokeLinecap="round" />
        <path className={styles.mathIntegralHighlight} d="M375 43C342 42 332 74 329 129" stroke="#FFFFFF" strokeOpacity="0.68" strokeWidth="5" strokeLinecap="round" />
        <path className={styles.mathCurve} d="M161 250C232 220 286 238 338 218C406 192 441 119 489 89C522 68 557 61 602 63" stroke="#1E6DB8" strokeOpacity="0.3" strokeWidth="15" strokeLinecap="round" />
        <path className={styles.mathCurve} d="M161 246C232 216 287 236 337 214C403 185 440 115 487 85C521 63 558 56 602 59" stroke="url(#math-curve)" strokeWidth="8" strokeLinecap="round" />
        <path className={styles.mathCurveHighlight} d="M168 242C238 215 287 232 337 210C402 182 441 111 487 82C521 61 557 54 596 57" stroke="#FFFFFF" strokeOpacity="0.66" strokeWidth="2" strokeLinecap="round" />
        <g className={styles.mathPoints}>
          <circle cx="266" cy="226" r="10" fill="#176AC0" stroke="#EFF9FF" strokeWidth="4" />
          <circle cx="397" cy="175" r="10" fill="#176AC0" stroke="#EFF9FF" strokeWidth="4" />
          <circle cx="548" cy="61" r="10" fill="#176AC0" stroke="#EFF9FF" strokeWidth="4" />
        </g>
      </g>
    </MarkShell>
  );
}
