import type { Metadata } from 'next';
import Portfolio from '@/components/playground/Portfolio';
export const metadata: Metadata = {title:'Water study — Ezzy Rappeport',robots:{index:false,follow:false}};
export default function Page(){return <Portfolio/>;}
