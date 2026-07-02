"use client";

/**
 * SvgFilters
 * ----------
 * Hidden inline SVG containing shared filter/primitive definitions:
 *  - liquidBlobFilter: feTurbulence + feDisplacementMap for organic edges
 *  - softGlow: feGaussianBlur for ambient glow halos
 *
 * Referenced via CSS `filter: url(#liquidBlobFilter)` or via SVG `filter=""`.
 */
export default function SvgFilters() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter id="liquidBlobFilter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>

        <filter id="textDisplace" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.010 0.015"
            numOctaves="2"
            seed="3"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              values="0.009 0.014;0.012 0.017;0.009 0.014"
              dur="9s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <linearGradient id="pearlGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#edf1f7" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#dde4ee" stopOpacity="0.5" />
        </linearGradient>
      </defs>
    </svg>
  );
}
