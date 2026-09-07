'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './WaterHero.module.css';
import type { createWaterStudy } from './scene';

export default function WaterHero(){
  const host=useRef<HTMLDivElement>(null);
  const controls=useRef<Awaited<ReturnType<typeof createWaterStudy>>|null>(null);
  const [allowData,setAllowData]=useState(false);
  const [staticOnly,setStaticOnly]=useState(false);
  const [ready,setReady]=useState(false);
  const [paused,setPaused]=useState(false);
  const [touch,setTouch]=useState(false);
  const [failed,setFailed]=useState(false);
  const [capture,setCapture]=useState<string|null>(null);
  const [debug,setDebug]=useState(false);
  useEffect(()=>{
    let ended=false;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    setPaused(media.matches);
    setDebug(new URLSearchParams(location.search).has('capture'));
    const unavailable=()=>{setReady(false);setFailed(true);};
    const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
    if(connection?.saveData&&!allowData){setStaticOnly(true);return;}
    setStaticOnly(false);
    import('./scene').then(({createWaterStudy})=>ended||!host.current?null:createWaterStudy(host.current,unavailable)).then(value=>{
      if(!value)return;
      if(ended){value.dispose();return;}
      controls.current=value;setReady(true);
    }).catch(()=>{if(!ended)unavailable();});
    const preference=()=>{setPaused(media.matches);controls.current?.pause(media.matches);};
    media.addEventListener('change',preference);
    return()=>{ended=true;media.removeEventListener('change',preference);controls.current?.dispose();controls.current=null;};
  },[allowData]);
  return <div className={styles.hero} data-touch-mode={touch}>
    <div className={styles.world} ref={host}><picture className={styles.poster}><source media="(max-width: 600px)" srcSet="/assets/hero/water-study-mobile.webp"/><img src="/assets/hero/water-study-desktop.webp" alt=""/></picture></div>
    {(staticOnly||failed)&&<div className={styles.fallback}><p>{staticOnly?'Still view · data-saving mode':'Still view · interactive scene unavailable'}</p>{staticOnly&&<button onClick={()=>setAllowData(true)}>Load interactive scene</button>}</div>}
      {ready&&<details className={styles.sceneOptions}>
        <summary>Scene settings</summary>
        <div className={styles.controls}>
          <button onClick={()=>{const next=!paused;setPaused(next);controls.current?.pause(next);}}>{paused?'Resume motion':'Pause motion'}</button>
          <button onClick={()=>controls.current?.wave()}>Make a ripple</button>
          <button onClick={()=>controls.current?.reset()}>Reset scene</button>
          <button className={styles.touch} aria-pressed={touch} onClick={()=>{setTouch(!touch);controls.current?.touch(!touch);}}>{touch?'Enable scrolling':'Enable touch play'}</button>
          {debug&&<button onClick={()=>setCapture(controls.current?.capture()??null)}>Capture scene</button>}
          {capture&&<a href={capture} download="water-study.png">Download capture</a>}
        </div>
      </details>}
  </div>;
}
