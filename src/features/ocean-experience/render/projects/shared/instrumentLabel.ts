import {
  CanvasTexture,
  LinearFilter,
  MeshBasicMaterial,
  SRGBColorSpace,
} from "three";

export type InstrumentLabelPalette = {
  accent: string;
  background: string;
  foreground: string;
  muted: string;
};

export type InstrumentLabel = {
  material: MeshBasicMaterial;
  texture: CanvasTexture;
};

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

export function createInstrumentLabel(
  title: string,
  detail: string,
  palette: InstrumentLabelPalette,
): InstrumentLabel {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create project instrument label");

  context.clearRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 4, 4, 504, 152, 26);
  context.fillStyle = palette.background;
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 2;
  context.stroke();

  roundedRect(context, 24, 30, 8, 100, 4);
  context.fillStyle = palette.accent;
  context.fill();

  context.textBaseline = "middle";
  context.fillStyle = palette.foreground;
  context.font = '600 34px "Helvetica Neue", Arial, sans-serif';
  context.fillText(title, 54, 61, 420);
  context.fillStyle = palette.muted;
  context.font = '500 24px "Helvetica Neue", Arial, sans-serif';
  context.fillText(detail, 54, 108, 420);

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
  return { material, texture };
}
