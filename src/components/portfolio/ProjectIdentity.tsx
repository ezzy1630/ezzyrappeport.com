import Image from "next/image";
import type { ProjectMediaAsset, ProjectSlug } from "@/lib/portfolio/content";
import styles from "./ProjectsSection.module.css";

type ProjectIdentityProps = {
  slug: Exclude<ProjectSlug, "velox">;
  media: ProjectMediaAsset;
  className?: string;
};

type MarkProps = Pick<ProjectIdentityProps, "className">;

export default function ProjectIdentity({ slug, media, className }: ProjectIdentityProps) {
  if (slug === "argyph") {
    return (
      <span className={`${styles.argyphPoster} ${className ?? ""}`} data-project-identity={slug}>
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          sizes="(max-width: 900px) 70vw, (max-width: 1440px) 36vw, 520px"
          className={styles.argyphPosterImage}
        />
      </span>
    );
  }

  const props = { className, "data-project-identity": slug };
  switch (slug) {
    case "monkeyclaw": return <MonkeyClawMark {...props} />;
    case "etch": return <EtchMark {...props} />;
    case "flowe": return <FloweMark {...props} />;
    case "nexarad": return <NexaRadMark {...props} />;
    case "mathpilot": return <MathPilotMark {...props} />;
  }
}

function MonkeyClawMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} data-project-identity="monkeyclaw" viewBox="0 0 760 390" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mc-core" x1="265" y1="77" x2="501" y2="306" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B8FFF4" /><stop offset="0.38" stopColor="#38D7C7" /><stop offset="1" stopColor="#076E78" />
        </linearGradient>
        <linearGradient id="mc-edge" x1="274" y1="104" x2="477" y2="292" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EAFFFC" /><stop offset="1" stopColor="#1A8D91" />
        </linearGradient>
        <filter id="mc-shadow" x="-30%" y="-35%" width="160%" height="180%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="19" stdDeviation="15" floodColor="#0A6D73" floodOpacity="0.25" />
        </filter>
        <filter id="mc-glow" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <ellipse cx="380" cy="326" rx="252" ry="26" fill="#078B91" fillOpacity="0.11" />
      <g stroke="#159FA1" strokeLinecap="round" strokeOpacity="0.25">
        <path d="M92 230H224L270 188" /><path d="M668 230H536L490 188" />
        <path d="M145 100L246 156" /><path d="M615 100L514 156" />
      </g>
      <g fill="#45E1D1"><circle cx="90" cy="230" r="5" /><circle cx="670" cy="230" r="5" /><circle cx="145" cy="100" r="4" /><circle cx="615" cy="100" r="4" /></g>
      <circle cx="380" cy="198" r="105" fill="#25D4C6" fillOpacity="0.17" filter="url(#mc-glow)" />
      <g filter="url(#mc-shadow)">
        <path data-identity-piece="ear-left" d="M250 134L203 153L181 205L219 238L272 215L278 165L250 134Z" fill="#0A5965" stroke="url(#mc-edge)" strokeWidth="3" />
        <path data-identity-piece="ear-right" d="M510 134L557 153L579 205L541 238L488 215L482 165L510 134Z" fill="#0A5965" stroke="url(#mc-edge)" strokeWidth="3" />
        <path data-identity-piece="head" d="M380 74L477 130L501 223L434 297H326L259 223L283 130L380 74Z" fill="url(#mc-core)" stroke="url(#mc-edge)" strokeWidth="4" />
        <path d="M303 145L351 173L337 207H296L279 183L303 145Z" fill="#021B25" fillOpacity="0.88" />
        <path d="M457 145L409 173L423 207H464L481 183L457 145Z" fill="#021B25" fillOpacity="0.88" />
        <path d="M344 238L380 211L416 238L398 270H362L344 238Z" fill="#021B25" fillOpacity="0.88" />
        <path d="M323 111L380 145L437 111" stroke="#E8FFFB" strokeOpacity="0.6" strokeWidth="4" />
        <path d="M305 281L352 247M455 281L408 247" stroke="#073B48" strokeOpacity="0.46" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g fill="#DFFFFA"><circle cx="320" cy="181" r="6" /><circle cx="440" cy="181" r="6" /></g>
    </svg>
  );
}

function EtchMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} data-project-identity="etch" viewBox="0 0 760 390" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="etch-steel" x1="267" y1="63" x2="507" y2="296" gradientUnits="userSpaceOnUse"><stop stopColor="#FCFEFF" /><stop offset="0.38" stopColor="#B8CBEC" /><stop offset="1" stopColor="#4A6594" /></linearGradient>
        <linearGradient id="etch-dark" x1="327" y1="100" x2="468" y2="301" gradientUnits="userSpaceOnUse"><stop stopColor="#243A62" /><stop offset="1" stopColor="#071225" /></linearGradient>
        <filter id="etch-shadow" x="-35%" y="-35%" width="170%" height="180%" colorInterpolationFilters="sRGB"><feDropShadow dx="0" dy="20" stdDeviation="15" floodColor="#244A8B" floodOpacity="0.3" /></filter>
      </defs>
      <ellipse cx="381" cy="325" rx="235" ry="24" fill="#4E83D7" fillOpacity="0.1" />
      <g stroke="#6B95D8" strokeOpacity="0.22"><path d="M121 117H263V76" /><path d="M639 117H497V76" /><path d="M169 273H282V311" /><path d="M591 273H478V311" /></g>
      <g fill="#7AA9FF" fillOpacity="0.74"><circle cx="121" cy="117" r="4" /><circle cx="639" cy="117" r="4" /><circle cx="169" cy="273" r="4" /><circle cx="591" cy="273" r="4" /></g>
      <g data-identity-piece="nib" filter="url(#etch-shadow)">
        <path d="M380 54L504 163L447 301L380 337L313 301L256 163L380 54Z" fill="url(#etch-steel)" />
        <path d="M380 54L380 337L313 301L256 163L380 54Z" fill="#E7F0FF" fillOpacity="0.4" />
        <path d="M380 54L504 163L447 301L380 337V218L435 163L380 54Z" fill="url(#etch-dark)" />
        <path d="M313 301L380 218L447 301L380 337L313 301Z" fill="#08142B" />
        <path d="M280 164L380 112L480 164L431 196H329L280 164Z" fill="#F7FBFF" fillOpacity="0.8" />
        <path d="M329 196H431L380 218L329 196Z" fill="#6684B7" />
        <circle cx="380" cy="248" r="10" fill="#C6DBFF" /><circle cx="380" cy="248" r="4" fill="#142747" />
      </g>
      <path d="M334 126L380 100L426 126M303 279L380 307L457 279" stroke="#FFFFFF" strokeOpacity="0.42" strokeWidth="3" />
    </svg>
  );
}

function FloweMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} data-project-identity="flowe" viewBox="0 0 760 390" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flow-a" x1="151" y1="137" x2="592" y2="281" gradientUnits="userSpaceOnUse"><stop stopColor="#DDFBFF" /><stop offset="0.4" stopColor="#71D6F4" /><stop offset="1" stopColor="#2374D7" /></linearGradient>
        <linearGradient id="flow-b" x1="185" y1="115" x2="565" y2="292" gradientUnits="userSpaceOnUse"><stop stopColor="#4ED3F4" /><stop offset="1" stopColor="#3954D9" /></linearGradient>
        <filter id="flow-shadow" x="-20%" y="-35%" width="140%" height="180%" colorInterpolationFilters="sRGB"><feDropShadow dx="0" dy="20" stdDeviation="14" floodColor="#2764C8" floodOpacity="0.25" /></filter>
      </defs>
      <ellipse cx="380" cy="326" rx="264" ry="25" fill="#3B91E9" fillOpacity="0.1" />
      <g fill="#6FCDF6" fillOpacity="0.6"><circle cx="202" cy="123" r="5" /><circle cx="555" cy="107" r="4" /><circle cx="595" cy="257" r="5" /><circle cx="177" cy="279" r="4" /></g>
      <g data-identity-piece="flow" filter="url(#flow-shadow)">
        <path d="M132 212C191 133 270 117 347 162C418 204 455 253 560 159" stroke="url(#flow-a)" strokeWidth="32" strokeLinecap="round" />
        <path d="M156 270C249 319 321 292 378 232C434 173 479 121 602 142" stroke="url(#flow-b)" strokeWidth="28" strokeLinecap="round" />
        <path d="M247 138C313 108 384 116 432 166C471 206 484 250 530 276" stroke="#E7FCFF" strokeOpacity="0.8" strokeWidth="10" strokeLinecap="round" />
        <path d="M322 201C355 169 409 173 434 209C455 239 440 278 403 285C363 292 338 266 342 231" stroke="#0A4FA9" strokeOpacity="0.66" strokeWidth="16" strokeLinecap="round" />
      </g>
      <g data-identity-piece="signals" fill="#FFFFFF"><circle cx="247" cy="138" r="7" /><circle cx="530" cy="276" r="7" /><circle cx="342" cy="231" r="5" /></g>
    </svg>
  );
}

function NexaRadMark({ className }: MarkProps) {
  const rows = [0, 1, 2, 3, 4, 5, 6];
  return (
    <svg aria-hidden="true" className={className} data-project-identity="nexarad" viewBox="0 0 760 390" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nexa-bone" x1="278" y1="78" x2="480" y2="315" gradientUnits="userSpaceOnUse"><stop stopColor="#EFF7FF" /><stop offset="0.42" stopColor="#A9C5FF" /><stop offset="1" stopColor="#5D82D9" /></linearGradient>
        <linearGradient id="nexa-spine" x1="380" y1="87" x2="380" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#F5FAFF" /><stop offset="1" stopColor="#7D9CE6" /></linearGradient>
        <filter id="nexa-glow" x="-60%" y="-30%" width="220%" height="170%" colorInterpolationFilters="sRGB"><feDropShadow dx="0" dy="11" stdDeviation="10" floodColor="#5B8BE5" floodOpacity="0.32" /></filter>
      </defs>
      <ellipse cx="380" cy="326" rx="210" ry="23" fill="#719DDF" fillOpacity="0.12" />
      <rect x="310" y="51" width="140" height="283" rx="70" fill="#73A0F4" fillOpacity="0.06" />
      <g data-identity-piece="scan" filter="url(#nexa-glow)">
        {rows.map((row) => {
          const y = 76 + row * 34;
          return (
            <g key={row} opacity={1 - row * 0.055}>
              <path d={`M340 ${y}C310 ${y - 7} 276 ${y + 1} 267 ${y + 19}C281 ${y + 31} 311 ${y + 32} 340 ${y + 24}`} fill="url(#nexa-bone)" />
              <path d={`M420 ${y}C450 ${y - 7} 484 ${y + 1} 493 ${y + 19}C479 ${y + 31} 449 ${y + 32} 420 ${y + 24}`} fill="url(#nexa-bone)" />
              <rect x="363" y={y - 4} width="34" height="31" rx="13" fill="url(#nexa-spine)" />
              <path d={`M352 ${y + 11}H408`} stroke="#E7F2FF" strokeOpacity="0.62" strokeWidth="2" />
            </g>
          );
        })}
      </g>
      <path d="M212 167H548" stroke="#C7DCFF" strokeOpacity="0.26" strokeWidth="2" strokeDasharray="7 11" />
    </svg>
  );
}

function MathPilotMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} data-project-identity="mathpilot" viewBox="0 0 760 390" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="math-ink" x1="263" y1="88" x2="461" y2="302" gradientUnits="userSpaceOnUse"><stop stopColor="#F5FBFF" /><stop offset="0.48" stopColor="#9DD5FF" /><stop offset="1" stopColor="#2E83ED" /></linearGradient>
        <linearGradient id="math-curve" x1="176" y1="283" x2="594" y2="105" gradientUnits="userSpaceOnUse"><stop stopColor="#4BB7FF" /><stop offset="1" stopColor="#F0FAFF" /></linearGradient>
        <filter id="math-shadow" x="-35%" y="-35%" width="170%" height="180%" colorInterpolationFilters="sRGB"><feDropShadow dx="0" dy="18" stdDeviation="13" floodColor="#1474D9" floodOpacity="0.26" /></filter>
      </defs>
      <ellipse cx="380" cy="326" rx="245" ry="24" fill="#2C8BEE" fillOpacity="0.11" />
      <g stroke="#72B7FF" strokeOpacity="0.16"><path d="M180 290H596" /><path d="M208 252H568" /><path d="M236 214H540" /><path d="M264 176H512" /></g>
      <g data-identity-piece="integral" filter="url(#math-shadow)">
        <path d="M368 87C324 87 309 123 306 173L297 248C294 282 282 299 253 307" stroke="url(#math-ink)" strokeWidth="25" strokeLinecap="round" />
        <path d="M253 307C282 299 294 282 297 248L306 173C309 123 324 87 368 87" stroke="#F6FCFF" strokeOpacity="0.44" strokeWidth="5" strokeLinecap="round" />
        <path d="M196 285C270 258 312 279 357 241C420 188 457 135 579 104" stroke="url(#math-curve)" strokeWidth="9" strokeLinecap="round" />
        <path d="M203 286C274 238 324 301 381 230C437 160 479 132 577 105" stroke="#E2F7FF" strokeOpacity="0.42" strokeWidth="2" />
      </g>
      <g data-identity-piece="points" fill="#0B65C8" stroke="#DDF4FF" strokeWidth="3"><circle cx="281" cy="264" r="8" /><circle cx="381" cy="230" r="8" /><circle cx="530" cy="122" r="8" /></g>
    </svg>
  );
}
