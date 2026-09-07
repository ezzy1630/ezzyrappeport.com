import type { WaterField } from '../playground/water-field';

/** Local surface slope transfers a traveling wave's momentum into floating glass. */
export function waveResponse(field:WaterField,x:number,y:number,mass:number){
  const span=.14;
  const slopeX=(field.sample(x+span,y)-field.sample(x-span,y))/(2*span);
  const slopeY=(field.sample(x,y+span)-field.sample(x,y-span))/(2*span);
  const clamp=(value:number,limit:number)=>Math.max(-limit,Math.min(limit,value));
  return {
    ax:clamp(-slopeX*18/mass,2.5),ay:clamp(-slopeY*18/mass,2.5),
    lift:clamp(field.sample(x,y)*3,.09),
    tiltX:clamp(slopeY*1.8,.16),tiltY:clamp(-slopeX*1.8,.16),
  };
}

/** A displaced trough and two trailing crests carry motion into neighboring letters. */
export function addWake(field:WaterField,x:number,y:number,vx:number,vy:number,dt:number){
  const speed=Math.hypot(vx,vy);
  if(speed<=.015)return;
  const strength=Math.min(.09,speed*.05)*dt*60;
  const wakeX=-vx/speed*.22,wakeY=-vy/speed*.22;
  field.disturb(x,y,-strength,.22);
  field.disturb(x+wakeX-wakeY*.6,y+wakeY+wakeX*.6,strength*.42,.18);
  field.disturb(x+wakeX+wakeY*.6,y+wakeY-wakeX*.6,strength*.42,.18);
}
