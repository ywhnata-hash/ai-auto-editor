'use client';
import {useState} from 'react';
const API='http://127.0.0.1:8000';
type Decision={id:string;label:string;reason:string;start:number;end:number;status:string};
type Project={id:string;name:string;duration:number;width:number;height:number;fps:string;status:string;decisions:Decision[];transcription_note?:string;error?:string;has_audio?:boolean};
type Settings={brightness:number;contrast:number;saturation:number;warmth:number;sharpen:number;vignette:number;noise_reduction:boolean;voice_clarity:boolean;fade_seconds:number};
const defaults:Settings={brightness:0,contrast:1,saturation:1,warmth:0,sharpen:0,vignette:0,noise_reduction:true,voice_clarity:true,fade_seconds:.5};
export default function Home(){
 const [file,setFile]=useState<File|null>(null),[p,setP]=useState<Project|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[settings,setSettings]=useState<Settings>(defaults);
 function change<K extends keyof Settings>(key:K,value:Settings[K]){setSettings(s=>({...s,[key]:value}))}
 async function upload(){if(!file)return;setBusy(true);setMsg('جاري رفع الفيديو...');try{let fd=new FormData();fd.append('file',file);let r=await fetch(API+'/api/projects',{method:'POST',body:fd});if(!r.ok)throw new Error(await r.text());setP(await r.json());setMsg('تم رفع الفيديو وفحص بياناته.')}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
 async function analyze(){if(!p)return;setBusy(true);try{await fetch(API+`/api/projects/${p.id}/analyze`,{method:'POST'});setMsg('بدأ التحليل. يتم تحديث الحالة تلقائيًا.');let timer=setInterval(async()=>{try{let r=await fetch(API+`/api/projects/${p.id}`);let d=await r.json();setP(d);if(['analyzed','error'].includes(d.status)){clearInterval(timer);setBusy(false);setMsg(d.status==='error'?'حدث خطأ أثناء التحليل':'اكتمل التحليل. راجع اقتراحات القص وإعدادات المعالجة قبل التصدير.')}}catch{clearInterval(timer);setBusy(false)}},2500)}catch(e:any){setBusy(false);setMsg(e.message)}}
 async function decide(d:Decision,status:string){let r=await fetch(API+`/api/projects/${p!.id}/decisions/${d.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(!r.ok){setMsg(await r.text());return}let x=await fetch(API+`/api/projects/${p!.id}`);setP(await x.json())}
 async function exportVideo(){if(!p)return;setBusy(true);setMsg('جاري تطبيق المعالجة والتصدير...');try{let r=await fetch(API+`/api/projects/${p.id}/export`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});if(!r.ok)throw new Error(await r.text());let d=await r.json();setMsg('اكتمل التصدير والتحقق من ملف MP4. استخدم روابط التنزيل بالأسفل.');window.open(API+d.video,'_blank');}catch(e:any){setMsg('فشل التصدير: '+e.message)}finally{setBusy(false)}}
 return <main dir="rtl"><header><h1>AI Auto Editor <span className="tag">Studio 0.2</span></h1><p className="muted">استوديو مونتاج بمراجعة يدوية ومعالجة فعلية عبر FFmpeg</p></header>
 <section className="panel"><h2>1. ارفع الفيديو</h2><input type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="btn" disabled={!file||busy} onClick={upload}>رفع وإنشاء مشروع</button></section>
 {p&&<><section className="panel"><h2>المشروع: {p.name}</h2><p>المدة: {p.duration.toFixed(1)} ثانية · الدقة: {p.width}×{p.height} · FPS: {p.fps} · الصوت: {p.has_audio?'موجود':'غير موجود'}</p><p>الحالة: <b>{p.status}</b></p><button className="btn" disabled={busy||p.status==='analyzing'} onClick={analyze}>تحليل السكتات</button>{p.transcription_note&&<p className="muted">{p.transcription_note}</p>}{p.error&&<p className="error">{p.error}</p>}</section>
 <section className="panel"><h2>2. مراجعة القصات</h2><p className="muted">لن يتم حذف أي سكتة إلا بعد موافقتك.</p>{(p.decisions||[]).length===0?<p className="muted">لا توجد اقتراحات بعد.</p>:p.decisions.map(d=><div className="decision" key={d.id}><div><b>{d.label}</b><div className="muted">{d.start.toFixed(2)}s – {d.end.toFixed(2)}s · {d.reason}</div></div><div><span className="tag">{d.status}</span><button className="btn" disabled={busy} onClick={()=>decide(d,'approved')}>موافقة</button><button className="btn secondary" disabled={busy} onClick={()=>decide(d,'rejected')}>رفض</button></div></div>)}</section>
 <section className="panel"><h2>3. معالجة الصورة والألوان</h2><p className="muted">هذه تحكمات فعلية في فلاتر FFmpeg، وليست مجرد إعدادات شكلية.</p>
 <Control label="الإضاءة" value={settings.brightness} min={-.3} max={.3} step={.01} onChange={v=>change('brightness',v)}/>
 <Control label="التباين" value={settings.contrast} min={.5} max={2} step={.05} onChange={v=>change('contrast',v)}/>
 <Control label="التشبع اللوني" value={settings.saturation} min={0} max={2} step={.05} onChange={v=>change('saturation',v)}/>
 <Control label="دفء الألوان" value={settings.warmth} min={-1} max={1} step={.05} onChange={v=>change('warmth',v)}/>
 <Control label="حدة التفاصيل" value={settings.sharpen} min={0} max={1} step={.05} onChange={v=>change('sharpen',v)}/>
 <Control label="Vignette" value={settings.vignette} min={0} max={1} step={.05} onChange={v=>change('vignette',v)}/>
 </section>
 <section className="panel"><h2>4. تحسين الصوت والانتقالات</h2>
 <label className="check"><input type="checkbox" checked={settings.noise_reduction} onChange={e=>change('noise_reduction',e.target.checked)}/> تقليل الضوضاء الخلفية (FFmpeg afftdn)</label>
 <label className="check"><input type="checkbox" checked={settings.voice_clarity} onChange={e=>change('voice_clarity',e.target.checked)}/> تحسين وضوح الصوت وضغط ديناميكي وتصفية الترددات</label>
 <Control label="Fade دخول وخروج (ثانية)" value={settings.fade_seconds} min={0} max={3} step={.1} onChange={v=>change('fade_seconds',v)}/>
 <p className="muted">الـFade الحالي انتقال دخول وخروج للفيديو والصوت. الانتقالات بين كل لقطة وأخرى، والمؤثرات الحركية المتقدمة، مرحلة تطوير لاحقة وليست مفعّلة بعد.</p>
 </section>
 <section className="panel"><h2>5. التصدير</h2><button className="btn" disabled={busy||p.status!=='analyzed'} onClick={exportVideo}>تطبيق الإعدادات وتصدير MP4</button><button className="btn secondary" onClick={()=>setSettings(defaults)} disabled={busy}>إعادة ضبط المعالجة</button></section></>}
 {msg&&<section className="panel status">{msg}</section>}
 <p className="muted foot">الإصدار الحالي يطبق تصحيح الألوان، فلاتر الصوت، وFade حقيقي عند التصدير. لا يدّعي بعد إنشاء مونتاج إبداعي تلقائي أو توليد B-roll أو كابتشن عربي.</p></main>
}
function Control({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void}){
 return <div className="control"><div><label>{label}</label><output>{value.toFixed(2)}</output></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></div>
}
