'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { bio, projects } from '@/lib/portfolio/content';
import { featuredPresentation } from '../playground/catalog';
import styles from './WaterStudy.module.css';
import type { createWaterStudy } from './scene';

export default function WaterStudy(){
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
    // The document transition also works when WebGL fails or data saving keeps the poster.
    const update=()=>host.current?.parentElement?.style.setProperty('--departure',String(Math.min(1,Math.max(0,scrollY/innerHeight))));
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
    return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
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
  return <main className={styles.study} id="top">
    <a className={styles.skip} href="#selected-work">Skip to selected work</a>
    <div className={styles.world} ref={host}><picture className={styles.poster}><source media="(max-width: 600px)" srcSet="/assets/hero/water-study-mobile.webp"/><img src="/assets/hero/water-study-desktop.webp" alt=""/></picture></div>
    <header className={styles.header}>
      <a href="#top" aria-label="Ezzy Rappeport, back to top">ER<span> / </span></a>
      <nav aria-label="Portfolio"><a href="#selected-work">Selected work</a><a href={`mailto:${bio.email}`}>Get in touch ↗</a></nav>
    </header>
    <section className={styles.opening} aria-labelledby="name">
      <h1 id="name" className="sr-only">Ezzy Rappeport — Software Engineer</h1>
      <div className={styles.caption}>
        <p className={styles.eyebrow}>SOFTWARE ENGINEER / AI SYSTEMS</p>
        <p className={styles.intro}>{bio.heroSentence}</p>
        <a className={styles.explore} href="#selected-work">Explore my work <span aria-hidden="true">↓</span></a>
        {(staticOnly||failed)&&<p className={styles.status}>{staticOnly?'Still view · data-saving mode': 'Still view · interactive scene unavailable'}</p>}
        {staticOnly&&<button className={styles.load} onClick={()=>setAllowData(true)}>Load interactive scene</button>}
      </div>
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
    </section>
    <section id="selected-work" tabIndex={-1} className={styles.work} aria-labelledby="work-title">
      <div className={styles.workHeading}><p className={styles.eyebrow}>01 / SELECTED WORK</p><h2 id="work-title">From an idea<br/>to something useful.</h2><p>AI systems, developer tools, and things I wanted to exist.</p></div>
      <div className={styles.projects}>
        {(['monkeyclaw','flowe','etch','argyph'] as const).map((slug,index)=>{
          const project=projects.find(p=>p.slug===slug);
          const presentation=featuredPresentation[slug];
          if(!project)return null;
          return <Link className={styles.project} href={`/project/${slug}`} prefetch={false} key={slug}>
            <div className={styles.projectImage} data-project={slug}><Image src={presentation.cover} alt={presentation.alt} fill sizes="(max-width: 700px) 88vw, 44vw"/><span>{presentation.mediaLabel}</span></div>
            <div className={styles.projectTitle}><span>0{index+1}</span><h3>{project.title}</h3><span aria-hidden="true">↗</span></div>
            <p>{presentation.purpose}</p><span className={styles.caseLink}>View case study ↗</span>
          </Link>;
        })}
      </div>
      <footer className={styles.footer}><p>Have something in mind?</p><a href={`mailto:${bio.email}`}>Let’s talk. ↗</a><div><Link href="/resume">Résumé</Link><Link href="/#about">More about me</Link><a href="#top">Back to the surface ↑</a></div></footer>
    </section>
  </main>;
}
