'use client';
import {useState} from 'react';
const API='http://127.0.0.1:8000';
type Decision={id:string;label:string;reason:string;start:number;end:number;status:string};
type Project={id:string;name:string;duration:number;width:number;height:number;fps:string;status:string;decisions:Decision[];transcription_note?:string;error?:string};
export default function Home(){
 const [file,setFile]=useState<File|null>(null),[p,setP]=useState<Project|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function upload(){if(!file)return;setBusy(true);setMsg('جاري رفع الفيديو...');try{let fd=new FormData();fd.append('file',file);let r=await fetch(API+'/api/projects',{method:'POST',body:fd});if(!r.ok)throw new Error(await r.text());setP(await r.json());setMsg('تم رفع الفيديو وفحص بياناته.');}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
 async function analyze(){if(!p)return;await fetch(API+`/api/projects/${p.id}/analyze`,{method:'POST'});setMsg('بدأ التحليل. يتم تحديث الحالة تلقائيًا.');let timer=setInterval(async()=>{let r=await fetch(API+`/api/projects/${p.id}`);let d=await r.json();setP(d);if(['analyzed','error'].includes(d.status)){clearInterval(timer);setMsg(d.status==='error'?'حدث خطأ أثناء التحليل':'اكتمل التحليل. راجع اقتراحات القص قبل التصدير.')}},2500)}
 async function decide(d:Decision,status:string){await fetch(API+`/api/projects/${p!.id}/decisions/${d.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});let r=await fetch(API+`/api/projects/${p!.id}`);setP(await r.json())}
 async function exportVideo(){setBusy(true);setMsg('جاري تنفيذ التصدير...');try{let r=await fetch(API+`/api/projects/${p!.id}/export`,{method:'POST'});if(!r.ok)throw new Error(await r.text());let d=await r.json();setMsg('اكتمل التصدير:');window.open(API+d.video,'_blank');window.open(API+d.project,'_blank');window.open(API+d.srt,'_blank')}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
 return <main><h1>AI Auto Editor <span className="tag">MVP 0.1</span></h1><p className="muted">مساعد مونتاج ذكي — عربي · Social · Hybrid</p>
 <section className="panel"><h2>1. ارفع الفيديو</h2><input type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="btn" disabled={!file||busy} onClick={upload}>رفع وإنشاء مشروع</button></section>
 {p&&<><section className="panel"><h2>المشروع: {p.name}</h2><p>المدة: {p.duration.toFixed(1)} ثانية · الدقة: {p.width}×{p.height} · FPS: {p.fps}</p><p>الحالة: <b>{p.status}</b></p><button className="btn" disabled={busy||p.status==='analyzing'} onClick={analyze}>تحليل الفيديو</button>{p.transcription_note&&<p className="muted">{p.transcription_note}</p>}{p.error&&<p>{p.error}</p>}</section>
 <section className="panel"><h2>2. مراجعة اقتراحات القص</h2><p className="muted">اقتراحات السكتات لا تُحذف تلقائيًا. وافق فقط على الأجزاء التي تريد حذفها.</p>{(p.decisions||[]).length===0?<p className="muted">لا توجد اقتراحات بعد.</p>:p.decisions.map(d=><div className="decision" key={d.id}><div><b>{d.label}</b><div className="muted">{d.start.toFixed(2)}s – {d.end.toFixed(2)}s · {d.reason}</div></div><div><span className="tag">{d.status}</span><button className="btn" onClick={()=>decide(d,'approved')}>موافقة</button><button className="btn" onClick={()=>decide(d,'rejected')}>رفض</button></div></div>)}</section>
 <section className="panel"><h2>3. التصدير</h2><button className="btn" disabled={busy||p.status!=='analyzed'} onClick={exportVideo}>تصدير MP4 + Project + SRT</button></section></>}
 {msg&&<section className="panel">{msg}</section>}
 <p className="muted">تنبيه: هذه نسخة تأسيسية. راجع كل اقتراح قبل اعتماده. لا يوجد بعد اختيار B-roll أو توليد مونتاج بصري تلقائي.</p></main>
}
