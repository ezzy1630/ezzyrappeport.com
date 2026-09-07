import { DataUtils } from 'three';
import type { WaterField } from '../playground/water-field';

/** Half-float height and world-space gradients avoid 8-bit steps in refracted light. */
export function encodeOpticalField(field:WaterField,width:number,height:number,pixels:Uint16Array){
  const {columns,rows}=field;
  const dx=width/(columns-1),dy=height/(rows-1);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const i=y*columns+x;
    const left=field.height[y*columns+Math.max(0,x-1)];
    const right=field.height[y*columns+Math.min(columns-1,x+1)];
    const down=field.height[Math.max(0,y-1)*columns+x];
    const up=field.height[Math.min(rows-1,y+1)*columns+x];
    pixels[i*4]=DataUtils.toHalfFloat(field.height[i]*2.2);
    pixels[i*4+1]=DataUtils.toHalfFloat((right-left)/(2*dx)*2.2);
    pixels[i*4+2]=DataUtils.toHalfFloat((up-down)/(2*dy)*2.2);
  }
}
