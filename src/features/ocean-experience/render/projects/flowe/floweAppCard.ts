import {
  CanvasTexture,
  LinearFilter,
  MeshBasicMaterial,
  SRGBColorSpace,
} from "three";

export type FloweCardKind =
  | "brain"
  | "calendar"
  | "course"
  | "focus"
  | "review"
  | "study"
  | "sync"
  | "task";

export type FloweAppCardOptions = {
  readonly badge?: string;
  readonly kind: FloweCardKind;
  readonly lines?: readonly string[];
  readonly status?: string;
  readonly tone?: "gold" | "teal";
};

export type FloweAppCard = {
  readonly aspectRatio: number;
  readonly material: MeshBasicMaterial;
  readonly texture: CanvasTexture;
};

const CARD = {
  background: "rgba(1, 16, 36, 0.985)",
  border: "rgba(70, 150, 162, 0.34)",
  gold: "#CE9639",
  muted: "#B6C1C8",
  teal: "#258392",
  text: "#EAF0F3",
} as const;

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function drawIcon(
  context: CanvasRenderingContext2D,
  kind: FloweCardKind,
  x: number,
  y: number,
  accent: string,
): void {
  context.save();
  context.translate(x, y);
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 4;

  if (kind === "brain") {
    context.beginPath();
    context.arc(0, -2, 16, Math.PI * 0.1, Math.PI * 1.9);
    context.stroke();
    context.beginPath();
    context.moveTo(-8, -5);
    context.quadraticCurveTo(1, -14, 9, -4);
    context.quadraticCurveTo(2, 1, 8, 9);
    context.stroke();
  } else if (kind === "calendar") {
    context.strokeRect(-17, -14, 34, 30);
    context.beginPath();
    context.moveTo(-17, -5);
    context.lineTo(17, -5);
    context.moveTo(-9, -19);
    context.lineTo(-9, -10);
    context.moveTo(9, -19);
    context.lineTo(9, -10);
    context.stroke();
    context.fillRect(-9, 2, 6, 6);
  } else if (kind === "course") {
    context.beginPath();
    context.moveTo(-20, -8);
    context.lineTo(0, -18);
    context.lineTo(20, -8);
    context.lineTo(0, 2);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(-12, -1);
    context.lineTo(-12, 10);
    context.quadraticCurveTo(0, 18, 12, 10);
    context.lineTo(12, -1);
    context.stroke();
  } else if (kind === "focus") {
    context.beginPath();
    context.arc(0, 0, 17, -Math.PI / 2, Math.PI * 1.28);
    context.stroke();
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -10);
    context.moveTo(-5, -21);
    context.lineTo(5, -21);
    context.stroke();
  } else if (kind === "review") {
    context.beginPath();
    context.moveTo(-16, 1);
    context.lineTo(-5, 12);
    context.lineTo(18, -13);
    context.stroke();
  } else if (kind === "study") {
    context.beginPath();
    context.moveTo(-18, -13);
    context.lineTo(-2, -7);
    context.lineTo(-2, 15);
    context.lineTo(-18, 9);
    context.closePath();
    context.moveTo(18, -13);
    context.lineTo(2, -7);
    context.lineTo(2, 15);
    context.lineTo(18, 9);
    context.closePath();
    context.stroke();
  } else if (kind === "sync") {
    context.beginPath();
    context.arc(0, 0, 17, -Math.PI * 0.15, Math.PI * 0.75);
    context.stroke();
    context.beginPath();
    context.moveTo(-15, 10);
    context.lineTo(-21, 4);
    context.lineTo(-12, 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 17, Math.PI * 0.85, Math.PI * 1.75);
    context.stroke();
    context.beginPath();
    context.moveTo(15, -10);
    context.lineTo(21, -4);
    context.lineTo(12, -2);
    context.stroke();
  } else {
    context.strokeRect(-15, -16, 30, 32);
    context.beginPath();
    context.moveTo(-8, -7);
    context.lineTo(8, -7);
    context.moveTo(-8, 1);
    context.lineTo(8, 1);
    context.moveTo(-8, 9);
    context.lineTo(3, 9);
    context.stroke();
  }

  context.globalCompositeOperation = "destination-over";
  context.fillStyle = accent;
  context.globalAlpha = 0.92;
  context.beginPath();
  context.arc(0, 0, 30, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function createFloweAppCard(
  title: string,
  detail: string,
  options: FloweAppCardOptions,
): FloweAppCard {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = options.lines ? 340 : 200;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create FlowE app card");

  const accent = options.tone === "gold" ? CARD.gold : CARD.teal;
  context.clearRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 5, 5, 630, canvas.height - 10, 32);
  context.fillStyle = CARD.background;
  context.fill();
  context.strokeStyle = CARD.border;
  context.lineWidth = 2;
  context.stroke();

  drawIcon(context, options.kind, 66, options.lines ? 68 : 100, accent);

  if (options.badge) {
    context.font = '700 19px "Helvetica Neue", Arial, sans-serif';
    const badgeWidth = Math.min(176, context.measureText(options.badge).width + 34);
    roundedRect(context, 640 - badgeWidth - 24, 27, badgeWidth, 38, 19);
    context.fillStyle = `${accent}33`;
    context.fill();
    context.strokeStyle = `${accent}99`;
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = options.tone === "gold" ? "#F6D654" : "#85D3DE";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(options.badge, 640 - badgeWidth / 2 - 24, 46);
  }

  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = CARD.text;
  context.font = '600 38px "Helvetica Neue", Arial, sans-serif';
  context.fillText(title, 116, options.lines ? 68 : options.badge ? 88 : 76, 480);

  if (options.lines) {
    context.strokeStyle = "rgba(70, 150, 162, 0.22)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(36, 112);
    context.lineTo(604, 112);
    context.stroke();
    context.fillStyle = CARD.text;
    context.font = '500 30px "SFMono-Regular", Menlo, monospace';
    options.lines.slice(0, 4).forEach((line, index) => {
      context.fillText(line, 54, 151 + index * 43, 530);
    });
    if (options.status) {
      context.fillStyle = accent;
      context.beginPath();
      context.arc(56, 309, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = CARD.muted;
      context.font = '600 21px "Helvetica Neue", Arial, sans-serif';
      context.fillText(options.status, 76, 309, 500);
    }
  } else {
    context.fillStyle = CARD.muted;
    context.font = '500 26px "Helvetica Neue", Arial, sans-serif';
    context.fillText(detail, 116, options.badge ? 139 : 129, 480);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  return { aspectRatio: canvas.width / canvas.height, material, texture };
}
