import type { WaterField } from '../playground/water-field';

// A slow cross-current bends the wave coordinates without moving the whole image as one sheet.
export const waterWarp = {xAmplitude:.24,xFrequency:.72,xRate:.12,yAmplitude:.18,yFrequency:.61,yRate:-.09} as const;

// Shared spectral components: incommensurate directions avoid a repeating cell lattice.
export const waterWaves = [
  {x:1.15,y:.48,amplitude:.047,rate:-.38},
  {x:-.65,y:1.72,amplitude:.025,rate:-.46},
  {x:5.7,y:2.1,amplitude:.018,rate:-.72},
  {x:-3.2,y:6.3,amplitude:.013,rate:-.63},
  {x:8.1,y:-2.7,amplitude:.005,rate:.84},
  {x:2.8,y:-8.3,amplitude:.004,rate:.94},
] as const;

/** Shared with the optical shader and refracted pointer picking. */
export function surfaceHeight(field: WaterField, x:number,y:number,time:number){
  const calm=.68+.30*(1-Math.exp(-((x*.40)**2+(y*.70)**2)));
  let swell=0;
  const qx=x+waterWarp.xAmplitude*Math.sin(y*waterWarp.xFrequency+time*waterWarp.xRate);
  const qy=y+waterWarp.yAmplitude*Math.sin(x*waterWarp.yFrequency+time*waterWarp.yRate);
  for(const wave of waterWaves)swell+=wave.amplitude*Math.sin(qx*wave.x+qy*wave.y+time*wave.rate);
  return field.sample(x,y)*2.2+calm*swell;
}
export function refractDirection(direction:readonly number[],normal:readonly number[],eta=1/1.333){
  const dot=direction[0]*normal[0]+direction[1]*normal[1]+direction[2]*normal[2];
  const k=1-eta*eta*(1-dot*dot);
  if(k<0)return null;
  const f=eta*dot+Math.sqrt(k);
  return [eta*direction[0]-f*normal[0],eta*direction[1]-f*normal[1],eta*direction[2]-f*normal[2]] as const;
}
