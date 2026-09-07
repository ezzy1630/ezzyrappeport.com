'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './WaterHero.module.css';
import type { createWaterStudy } from './scene';

export default function WaterHero({ showTitle = true }: { showTitle?: boolean }){
  const host=useRef<HTMLDivElement>(null);
  const options=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const close=(event:PointerEvent)=>{
      if(event.target instanceof Node && !options.current?.contains(event.target) && options.current){
        options.current.open=false;
      }
    };
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[]);
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
    const unavailable=()=>{if(ended)return;controls.current=null;setReady(false);setFailed(true);setTouch(false);};
    const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
    if(connection?.saveData&&!allowData){setStaticOnly(true);return;}
    setStaticOnly(false);
    import('./scene').then(({createWaterStudy})=>ended||!host.current?null:createWaterStudy(host.current,unavailable,showTitle)).then(value=>{
      if(!value)return;
      if(ended){value.dispose();return;}
      controls.current=value;setFailed(false);setReady(true);
    }).catch(()=>{if(!ended)unavailable();});
    const preference=()=>{setPaused(media.matches);controls.current?.pause(media.matches);if(media.matches){setTouch(false);controls.current?.touch(false);}};
    media.addEventListener('change',preference);
    return()=>{ended=true;media.removeEventListener('change',preference);controls.current?.dispose();controls.current=null;};
  },[allowData,showTitle]);
  return <div className={styles.hero} data-touch-mode={touch} data-ready={ready} data-paused={paused}>
    <div className={styles.world} ref={host} data-ready={ready}/>{showTitle&&<picture className={styles.poster}><source media="(max-width: 600px)" srcSet="/assets/hero/water-study-mobile.webp"/><source media="(max-width: 900px)" srcSet="/assets/hero/water-study-tablet.webp"/><img src="/assets/hero/water-study-desktop.webp" alt="" fetchPriority="high"/></picture>}<div className={styles.veil} aria-hidden="true"/>{showTitle&&<div className={styles.arrivalLight} aria-hidden="true"/>}
    {(staticOnly||failed)&&<div className={styles.fallback}><p>{staticOnly?'Still view · data-saving mode':'Still view · interactive scene unavailable'}</p>{staticOnly&&<button onClick={()=>setAllowData(true)}>Load interactive scene</button>}</div>}
      {ready&&showTitle&&<div className={styles.hint} aria-hidden="true">Move to stir. Click to ripple. Drag & release.</div>}
      {ready&&<details ref={options} data-water-controls className={styles.sceneOptions} onKeyDown={event=>{
        if(event.key==='Escape' && options.current){
          options.current.open=false;
          options.current.querySelector('summary')?.focus();
        }
      }}>
        <summary><span className={styles.motionDot} aria-hidden="true"/>{paused?'Motion paused':'Scene settings'}</summary>
        <div className={styles.controls}>
          <button onClick={()=>{const next=!paused;setPaused(next);controls.current?.pause(next);if(next){setTouch(false);controls.current?.touch(false);}}}>{paused?'Resume motion':'Pause motion'}</button>
          <button disabled={paused} onClick={()=>controls.current?.wave()}>Make a ripple</button>
          <button onClick={()=>controls.current?.reset()}>Reset scene</button>
          <button className={styles.touch} disabled={paused} aria-pressed={touch} onClick={()=>{setTouch(!touch);controls.current?.touch(!touch);}}>{touch?'Enable scrolling':'Enable touch play'}</button>
          {debug&&<button onClick={()=>setCapture(controls.current?.capture()??null)}>Capture scene</button>}
          {capture&&<a href={capture} download="water-study.png">Download capture</a>}
        </div>
      </details>}
  </div>;
}
