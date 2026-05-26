import { useState, useMemo, useEffect, useCallback } from "react";
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from "recharts";
import { supabase } from "./supabase";
import Auth from "./Auth";

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;900&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;} input[type=date]{color-scheme:dark;color:#f0eaff;} input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.8) sepia(0.3) saturate(2) hue-rotate(180deg);cursor:pointer;opacity:0.8;}
    body{background:#0d0d1f;}
    ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#0d0d1f} ::-webkit-scrollbar-thumb{background:#2a2a5a;border-radius:99px}
    select option{background:#1e1e3a;color:#f0eaff} button:active{opacity:0.75} input[type=range]{height:4px}
  `}</style>
);

const Hub = ({ onSelect, onSignOut, syncing }) => (
  <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 20% 10%,#1a1a4e 0%,#0d0d1f 60%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'DM Mono',monospace"}}>
    <GlobalStyles/>
    <div style={{textAlign:"center",marginBottom:48}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:700,color:"#f0eaff",lineHeight:1}}>Mi Hub</div>
      <div style={{fontSize:11,letterSpacing:4,color:"#e2c97e",marginTop:8,textTransform:"uppercase"}}>Elige un módulo</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:16,width:"100%",maxWidth:400}}>
      <button onClick={()=>onSelect("personal")} style={{background:"linear-gradient(135deg,#1e1e3a 0%,#16213e 100%)",border:"1px solid #2a2a5a",borderRadius:20,padding:"28px 24px",cursor:"pointer",textAlign:"left",transition:"transform .2s, box-shadow .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 40px #0008";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
        <div style={{fontSize:34,marginBottom:10}}>👤</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#f0eaff",marginBottom:6}}>Desarrollo Personal</div>
        <div style={{fontSize:11,color:"#7777aa",lineHeight:1.7}}>Metas · Tareas · Objetivos<br/>Seguimiento diario y streaks</div>
        <div style={{marginTop:14,fontSize:11,color:"#7eb8e2",borderBottom:"1px solid #7eb8e244",display:"inline-block"}}>Entrar →</div>
      </button>
      <button onClick={()=>onSelect("finanzas")} style={{background:"linear-gradient(135deg,#0e1e18 0%,#0a1a14 100%)",border:"1px solid #1a3028",borderRadius:20,padding:"28px 24px",cursor:"pointer",textAlign:"left",transition:"transform .2s, box-shadow .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 40px #0008";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
        <div style={{fontSize:34,marginBottom:10}}>💰</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#e8e4dc",marginBottom:6}}>Finanzas</div>
        <div style={{fontSize:11,color:"#3a6a4a",lineHeight:1.7}}>Ingresos · Gastos · Deudas<br/>Metas de ahorro · Presupuesto</div>
        <div style={{marginTop:14,fontSize:11,color:"#7ee2a8",borderBottom:"1px solid #7ee2a844",display:"inline-block"}}>Entrar →</div>
      </button>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",maxWidth:400,marginTop:32}}>
      <div style={{fontSize:9,color:syncing?"#7eb8e2":"#2a2a5a",transition:"color 0.3s"}}>{syncing?"⟳ sincronizando...":"● sincronizado"}</div>
      <button onClick={onSignOut} style={{background:"#ffffff08",border:"1px solid #2a2a5a",borderRadius:8,color:"#888",padding:"6px 14px",cursor:"pointer",fontSize:10}}>Salir</button>
    </div>
  </div>
);

/* ── PERSONAL TRACKER ── */
const CATEGORIES=["🎯 Meta","📋 Tarea","⭐ Objetivo"];
const PRIORITIES=["Alta","Media","Baja"];
const PRIORITY_COLORS={"Alta":"#e27e7e","Media":"#e2c97e","Baja":"#a8d5a2"};
const WINDOW_OPTIONS=[7,14,21];
const META_COLOR="#c084fc",OBJ_COLOR="#fb923c",TAREA_COLOR="#7eb8e2";
function getLastDays(n){const days=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}return days;}
function formatDay(s){const d=new Date(s+"T12:00:00");return{day:d.toLocaleDateString("es",{weekday:"short"}).slice(0,3),num:d.getDate()}}
function isToday(s){return s===new Date().toISOString().slice(0,10)}
function calcStreak(checks,days){let n=0;for(let i=days.length-1;i>=0;i--){if(checks[days[i]])n++;else break}return n}
function linearRegression(data){const n=data.length;if(n<2)return data.map(()=>null);const sx=data.reduce((s,_,i)=>s+i,0),sy=data.reduce((s,d)=>s+(d.pct??0),0),sxy=data.reduce((s,d,i)=>s+i*(d.pct??0),0),sx2=data.reduce((s,_,i)=>s+i*i,0);const slope=(n*sxy-sx*sy)/(n*sx2-sx*sx),intercept=(sy-slope*sx)/n;return data.map((_,i)=>Math.max(0,Math.min(100,Math.round(intercept+slope*i))))}
function daysRemaining(due){if(!due)return null;const today=new Date();today.setHours(0,0,0,0);return Math.round((new Date(due+"T00:00:00")-today)/86400000)}
function getItemProgress(item){if(item.category==="📋 Tarea")return null;if(item.trackMode==="toggle")return item.completed?100:0;return item.progressPct??0}
function DueBadge({due}){if(!due)return null;const diff=daysRemaining(due);const color=diff<0?"#e27e7e":diff<=7?"#e2c97e":"#7eb8e2";const label=diff<0?`Venció hace ${Math.abs(diff)}d`:diff===0?"Vence hoy":`${diff}d restantes`;return<span style={{fontSize:10,color,background:color+"18",border:`1px solid ${color}44`,borderRadius:6,padding:"2px 7px",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>📅 {label}</span>}
function StreakBadge({streak}){if(streak<2)return null;return<span style={{background:"linear-gradient(90deg,#e2c97e44,#e27e7e44)",color:"#e2c97e",border:"1px solid #e2c97e44",borderRadius:99,padding:"1px 8px",fontSize:10,fontFamily:"'DM Mono',monospace",marginLeft:6}}>🔥 {streak}d</span>}
function DailyGrid({checks,days,onToggle}){return<div style={{display:"flex",gap:5,marginTop:10}}>{days.map(d=>{const checked=checks[d],today=isToday(d),{day,num}=formatDay(d);return<div key={d} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1}}><span style={{fontSize:9,color:today?"#7eb8e2":"#555",fontFamily:"'DM Mono',monospace",textTransform:"uppercase"}}>{day}</span><button onClick={()=>onToggle(d)} style={{width:28,height:28,borderRadius:8,border:today?"1.5px solid #7eb8e2":"1.5px solid #2a2a5a",background:checked?"linear-gradient(135deg,#7eb8e2,#7ee2a8)":today?"#7eb8e210":"#ffffff06",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,transition:"all 0.15s",boxShadow:checked?"0 0 8px #7ee2a855":"none"}}>{checked?"✓":<span style={{color:today?"#7eb8e2":"#333",fontSize:10}}>{num}</span>}</button></div>})}</div>}
function MetaObjetivoIndicator({item,onUpdate}){const isMeta=item.category==="🎯 Meta";const accentColor=isMeta?META_COLOR:OBJ_COLOR;if(item.trackMode==="toggle"){return<div style={{marginTop:12,display:"flex",alignItems:"center",gap:10}}><button onClick={()=>onUpdate({...item,completed:!item.completed})} style={{display:"flex",alignItems:"center",gap:8,background:item.completed?accentColor+"22":"#ffffff08",border:`1.5px solid ${item.completed?accentColor:"#2a2a5a"}`,borderRadius:10,padding:"8px 16px",cursor:"pointer",transition:"all 0.2s"}}><div style={{width:18,height:18,borderRadius:5,background:item.completed?accentColor:"transparent",border:`2px solid ${item.completed?accentColor:"#444"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#0d0d1f",transition:"all 0.15s"}}>{item.completed?"✓":""}</div><span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:item.completed?accentColor:"#666"}}>{item.completed?"Completado":"Pendiente"}</span></button></div>}const pct=item.progressPct??0;return<div style={{marginTop:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:10,color:"#666",fontFamily:"'DM Mono',monospace"}}>Avance</span><span style={{fontSize:13,fontFamily:"'Playfair Display',serif",color:accentColor,fontWeight:700}}>{pct}%</span></div><input type="range" min={0} max={100} value={pct} onChange={e=>onUpdate({...item,progressPct:Number(e.target.value)})} style={{width:"100%",accentColor,cursor:"pointer"}}/><div style={{background:"#1a1a2e",borderRadius:99,height:6,overflow:"hidden",marginTop:4}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${accentColor},${accentColor}88)`,borderRadius:99,transition:"width 0.3s"}}/></div></div>}
function ItemCard({item,days,onToggle,onUpdate,onEdit,onDelete}){const isTarea=item.category==="📋 Tarea";const streak=isTarea?calcStreak(item.checks,days):0;const totalChecked=isTarea?days.filter(d=>item.checks[d]).length:0;const progress=isTarea&&days.length>0?Math.round((totalChecked/days.length)*100):0;return<div style={{background:"linear-gradient(135deg,#1e1e3a 0%,#16213e 100%)",border:"1px solid #2a2a5a",borderRadius:16,padding:"16px 18px",marginBottom:14,transition:"transform 0.2s,box-shadow 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px #0009"}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{flex:1}}><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}><span style={{fontSize:10,color:"#aaa",background:"#ffffff10",borderRadius:6,padding:"2px 7px",fontFamily:"'DM Mono',monospace"}}>{item.category}</span><span style={{fontSize:10,color:PRIORITY_COLORS[item.priority],background:PRIORITY_COLORS[item.priority]+"22",borderRadius:6,padding:"2px 7px",fontFamily:"'DM Mono',monospace"}}>↑ {item.priority}</span></div><div style={{display:"flex",alignItems:"center"}}><span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#f0eaff",fontWeight:600}}>{item.title}</span>{isTarea&&<StreakBadge streak={streak}/>}</div>{item.notes&&<div style={{fontSize:11,color:"#666",fontFamily:"'DM Mono',monospace",marginTop:2}}>{item.notes}</div>}{item.due&&<div style={{marginTop:5}}><DueBadge due={item.due}/></div>}</div><div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}><button onClick={()=>onEdit(item)} style={{background:"#ffffff08",border:"none",borderRadius:7,color:"#888",padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button><button onClick={()=>onDelete(item.id)} style={{background:"#e27e7e15",border:"none",borderRadius:7,color:"#e27e7e",padding:"4px 8px",cursor:"pointer",fontSize:12}}>🗑</button></div></div>{isTarea?(<><DailyGrid checks={item.checks} days={days} onToggle={d=>onToggle(item.id,d)}/><div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}><div style={{flex:1,background:"#1a1a2e",borderRadius:99,height:5,overflow:"hidden"}}><div style={{width:`${progress}%`,height:"100%",background:progress===100?"linear-gradient(90deg,#7ee2a8,#a8ffc4)":"linear-gradient(90deg,#7eb8e2,#7ee2a8)",borderRadius:99,transition:"width 0.4s"}}/></div><span style={{fontSize:10,color:"#666",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{totalChecked}/{days.length} días</span></div></>):(<MetaObjetivoIndicator item={item} onUpdate={onUpdate}/>)}</div>}
function CustomTooltip({active,payload,label}){if(!active||!payload?.length)return null;return<div style={{background:"#1e1e3a",border:"1px solid #2a2a5a",borderRadius:10,padding:"10px 14px",fontFamily:"'DM Mono',monospace",fontSize:11}}><div style={{color:"#888",marginBottom:4}}>{label}</div>{payload.map(p=><div key={p.name} style={{color:p.color,marginBottom:2}}>{p.name}: <strong>{p.value??"—"}{typeof p.value==="number"?"%":""}</strong></div>)}</div>}
function ProgressChart({items,days}){const tareas=items.filter(i=>i.category==="📋 Tarea");const data=useMemo(()=>days.map(d=>{const{day,num}=formatDay(d);const checked=tareas.filter(i=>i.checks[d]).length;const pct=tareas.length>0?Math.round((checked/tareas.length)*100):0;return{label:`${day} ${num}`,pct}}),[tareas,days]);const trend=linearRegression(data);const dataT=data.map((d,i)=>({...d,tendencia:trend[i]}));const avg=data.length?Math.round(data.reduce((s,d)=>s+d.pct,0)/data.length):0;const lastPct=data[data.length-1]?.pct??0;const trendColor=(trend[trend.length-1]??0)>(trend[0]??0)?"#7ee2a8":(trend[trend.length-1]??0)<(trend[0]??0)?"#e27e7e":"#e2c97e";const trendDir=(trend[trend.length-1]??0)>(trend[0]??0)?"↑":(trend[trend.length-1]??0)<(trend[0]??0)?"↓":"→";return<div style={{background:"linear-gradient(135deg,#1e1e3a 0%,#16213e 100%)",border:"1px solid #2a2a5a",borderRadius:16,padding:"20px 18px",marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}><div><div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#f0eaff",fontWeight:600}}>📋 Tareas diarias</div><div style={{fontSize:10,color:"#555",fontFamily:"'DM Mono',monospace",marginTop:2}}>% completadas por día</div></div><div style={{display:"flex",gap:10}}>{[{v:`${lastPct}%`,c:TAREA_COLOR,s:"hoy"},{v:trendDir,c:trendColor,s:"tendencia"},{v:`${avg}%`,c:"#e2c97e",s:"promedio"}].map(x=><div key={x.s} style={{textAlign:"center"}}><div style={{fontSize:17,fontFamily:"'Playfair Display',serif",color:x.c,fontWeight:700}}>{x.v}</div><div style={{fontSize:9,color:"#555"}}>{x.s}</div></div>)}</div></div><ResponsiveContainer width="100%" height={160}><ComposedChart data={dataT} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a5a" vertical={false}/><XAxis dataKey="label" tick={{fill:"#555",fontSize:9,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={false} interval={days.length>14?2:0}/><YAxis domain={[0,100]} tick={{fill:"#555",fontSize:9,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/><Tooltip content={<CustomTooltip/>}/><ReferenceLine y={avg} stroke="#e2c97e" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5}/><Bar dataKey="pct" name="Completado" radius={[5,5,0,0]} fill="url(#barGradT)" maxBarSize={32}/><Line dataKey="tendencia" name="Tendencia" type="monotone" stroke={trendColor} strokeWidth={2} dot={false}/><defs><linearGradient id="barGradT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TAREA_COLOR} stopOpacity={0.9}/><stop offset="100%" stopColor="#7ee2a8" stopOpacity={0.4}/></linearGradient></defs></ComposedChart></ResponsiveContainer></div>}
function MetasObjetivosChart({items}){const data=useMemo(()=>items.filter(i=>i.category==="🎯 Meta"||i.category==="⭐ Objetivo").map(i=>({name:i.title.length>22?i.title.slice(0,20)+"…":i.title,fullName:i.title,pct:getItemProgress(i)??0,cat:i.category,color:i.category==="🎯 Meta"?META_COLOR:OBJ_COLOR})),[items]);if(data.length===0)return null;const metaCount=data.filter(d=>d.cat==="🎯 Meta").length,objCount=data.filter(d=>d.cat==="⭐ Objetivo").length;const metaAvg=metaCount?Math.round(data.filter(d=>d.cat==="🎯 Meta").reduce((s,d)=>s+d.pct,0)/metaCount):0;const objAvg=objCount?Math.round(data.filter(d=>d.cat==="⭐ Objetivo").reduce((s,d)=>s+d.pct,0)/objCount):0;return<div style={{background:"linear-gradient(135deg,#1e1e3a 0%,#16213e 100%)",border:"1px solid #2a2a5a",borderRadius:16,padding:"20px 18px",marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}><div><div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#f0eaff",fontWeight:600}}>🎯 Metas & Objetivos</div><div style={{fontSize:10,color:"#555",fontFamily:"'DM Mono',monospace",marginTop:2}}>avance por elemento</div></div><div style={{display:"flex",gap:10}}>{metaCount>0&&<div style={{textAlign:"center"}}><div style={{fontSize:17,fontFamily:"'Playfair Display',serif",color:META_COLOR,fontWeight:700}}>{metaAvg}%</div><div style={{fontSize:9,color:"#555"}}>metas</div></div>}{objCount>0&&<div style={{textAlign:"center"}}><div style={{fontSize:17,fontFamily:"'Playfair Display',serif",color:OBJ_COLOR,fontWeight:700}}>{objAvg}%</div><div style={{fontSize:9,color:"#555"}}>objetivos</div></div>}</div></div><ResponsiveContainer width="100%" height={Math.max(120,data.length*38)}><ComposedChart data={data} layout="vertical" margin={{top:0,right:30,left:10,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a5a" horizontal={false}/><XAxis type="number" domain={[0,100]} tick={{fill:"#555",fontSize:9,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/><YAxis type="category" dataKey="name" tick={{fill:"#aaa",fontSize:10,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={false} width={160}/><Tooltip content={({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0].payload;return<div style={{background:"#1e1e3a",border:"1px solid #2a2a5a",borderRadius:10,padding:"10px 14px",fontFamily:"'DM Mono',monospace",fontSize:11}}><div style={{color:"#aaa",marginBottom:4}}>{d.fullName}</div><div style={{color:d.color,fontWeight:700}}>{d.pct}%</div><div style={{color:"#555",marginTop:2}}>{d.cat}</div></div>}}/><Bar dataKey="pct" name="Avance" radius={[0,6,6,0]} maxBarSize={22}>{data.map((entry,i)=><Cell key={i} fill={entry.color} fillOpacity={0.85}/>)}</Bar></ComposedChart></ResponsiveContainer><div style={{display:"flex",gap:16,marginTop:10,justifyContent:"center"}}><div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#666",fontFamily:"'DM Mono',monospace"}}><div style={{width:12,height:10,borderRadius:3,background:META_COLOR}}/>🎯 Meta</div><div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#666",fontFamily:"'DM Mono',monospace"}}><div style={{width:12,height:10,borderRadius:3,background:OBJ_COLOR}}/>⭐ Objetivo</div></div></div>}
const MEDALS=["🥇","🥈","🥉"],MEDAL_COLORS=["#e2c97e","#c0c0c0","#cd7f32"],MEDAL_BG=["#e2c97e18","#c0c0c018","#cd7f3218"],MEDAL_BORDER=["#e2c97e55","#c0c0c055","#cd7f3255"];
function Top3({items,days}){const ranked=useMemo(()=>[...items.filter(i=>i.category==="📋 Tarea")].map(i=>({...i,checked:days.filter(d=>i.checks[d]).length})).sort((a,b)=>b.checked-a.checked).slice(0,3).filter(i=>i.checked>0),[items,days]);if(ranked.length===0)return null;return<div style={{background:"linear-gradient(135deg,#1e1e3a 0%,#16213e 100%)",border:"1px solid #2a2a5a",borderRadius:16,padding:"18px 18px 14px",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span style={{fontSize:15}}>🏆</span><span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#f0eaff",fontWeight:600}}>Top 3 tareas</span><span style={{fontSize:10,color:"#555",fontFamily:"'DM Mono',monospace"}}>últimos {days.length}d</span></div><div style={{display:"flex",flexDirection:"column",gap:9}}>{ranked.map((item,idx)=>{const pct=Math.round((item.checked/days.length)*100);return<div key={item.id} style={{display:"flex",alignItems:"center",gap:12,background:MEDAL_BG[idx],border:`1px solid ${MEDAL_BORDER[idx]}`,borderRadius:11,padding:"10px 14px"}}><span style={{fontSize:20,flexShrink:0}}>{MEDALS[idx]}</span><div style={{flex:1,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#f0eaff",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title}</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:MEDAL_COLORS[idx],flexShrink:0,marginLeft:8,fontWeight:700}}>{item.checked}/{days.length}d</span></div><div style={{background:"#1a1a2e",borderRadius:99,height:5,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${MEDAL_COLORS[idx]}cc,${MEDAL_COLORS[idx]}66)`,borderRadius:99}}/></div></div></div>})}</div></div>}
function Modal({item,onClose,onSave}){const blank={title:"",category:CATEGORIES[0],priority:PRIORITIES[0],notes:"",due:"",checks:{},trackMode:"toggle",completed:false,progressPct:0};const[form,setForm]=useState(item||blank);const set=(f,v)=>setForm(p=>({...p,[f]:v}));const inp={width:"100%",background:"#0d0d1f",border:"1px solid #2a2a5a",borderRadius:9,padding:"10px 14px",color:"#f0eaff",fontFamily:"'DM Mono',monospace",fontSize:13,outline:"none",boxSizing:"border-box"};const lbl={fontSize:11,color:"#888",fontFamily:"'DM Mono',monospace",marginBottom:4,display:"block"};const isMetaOrObj=form.category==="🎯 Meta"||form.category==="⭐ Objetivo";const accentColor=form.category==="🎯 Meta"?META_COLOR:OBJ_COLOR;return<div style={{position:"fixed",inset:0,background:"#000b",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}><div style={{background:"linear-gradient(135deg,#1e1e3a,#12122a)",border:"1px solid #2a2a5a",borderRadius:18,padding:28,width:"100%",maxWidth:440}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#f0eaff",marginBottom:20}}>{item?"Editar":"Nuevo elemento"}</div><div style={{marginBottom:14}}><label style={lbl}>Título</label><input style={inp} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="¿Qué quieres lograr?"/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><div><label style={lbl}>Categoría</label><select style={inp} value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div><div><label style={lbl}>Prioridad</label><select style={inp} value={form.priority} onChange={e=>set("priority",e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div></div>{isMetaOrObj&&<><div style={{marginBottom:14}}><label style={lbl}>Fecha límite</label><input type="date" style={inp} value={form.due||""} onChange={e=>set("due",e.target.value)}/>{form.due&&<div style={{marginTop:6}}><DueBadge due={form.due}/></div>}</div><div style={{marginBottom:14}}><label style={lbl}>Indicador de progreso</label><div style={{display:"flex",gap:8}}>{[{v:"toggle",label:"✓ Completado / Pendiente"},{v:"percent",label:"% Avance manual"}].map(opt=><button key={opt.v} onClick={()=>set("trackMode",opt.v)} style={{flex:1,padding:"10px 8px",borderRadius:10,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",border:`1.5px solid ${form.trackMode===opt.v?accentColor:"#2a2a5a"}`,background:form.trackMode===opt.v?accentColor+"22":"#ffffff08",color:form.trackMode===opt.v?accentColor:"#666",fontWeight:form.trackMode===opt.v?700:400,transition:"all 0.15s"}}>{opt.label}</button>)}</div></div>{form.trackMode==="percent"&&<div style={{marginBottom:14}}><label style={lbl}>Avance actual: {form.progressPct??0}%</label><input type="range" min={0} max={100} value={form.progressPct??0} onChange={e=>set("progressPct",Number(e.target.value))} style={{width:"100%",accentColor}}/></div>}</>}<div style={{marginBottom:22}}><label style={lbl}>Notas</label><textarea style={{...inp,resize:"vertical",minHeight:56}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Contexto o detalles..."/></div><div style={{display:"flex",gap:10}}><button onClick={onClose} style={{flex:1,background:"#ffffff10",border:"none",borderRadius:10,color:"#aaa",padding:"12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:13}}>Cancelar</button><button onClick={()=>form.title.trim()&&onSave(form)} style={{flex:2,background:"linear-gradient(90deg,#7eb8e2,#7ee2a8)",border:"none",borderRadius:10,color:"#0d0d1f",padding:"12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700}}>{item?"Guardar":"Crear"}</button></div></div></div>}
const initialItems=[{id:1,title:"Leer 20 minutos",category:"📋 Tarea",priority:"Alta",notes:"Hábito de lectura diaria",checks:{},due:""},{id:2,title:"Aprender idioma",category:"⭐ Objetivo",priority:"Media",notes:"Vocabulario básico",checks:{},due:"2026-12-31",trackMode:"percent",progressPct:10},{id:3,title:"Bienestar físico",category:"🎯 Meta",priority:"Alta",notes:"Salud general",checks:{},due:"2026-12-31",trackMode:"toggle",completed:false},{id:4,title:"Ejercicio diario",category:"📋 Tarea",priority:"Alta",notes:"30 min mínimo",checks:{},due:""}];

const PersonalTracker=({session,onBack,onSignOut,syncing,setSyncing})=>{
  const[items,setItemsRaw]=useState(initialItems);const[nextId,setNextId]=useState(10);const[windowDays,setWindowDays]=useState(7);const[showCharts,setShowCharts]=useState(true);const[showModal,setShowModal]=useState(false);const[editItem,setEditItem]=useState(null);const[filterCat,setFilterCat]=useState("Todos");
  useEffect(()=>{if(!session)return;const load=async()=>{const{data}=await supabase.from("items").select("data").eq("user_id",session.user.id).order("updated_at",{ascending:false}).limit(1).maybeSingle();if(data?.data){setItemsRaw(data.data.items??initialItems);setNextId(data.data.nextId??10);setWindowDays(data.data.windowDays??7);setShowCharts(data.data.showCharts??true)}};load()},[session]);
  const saveToSupabase=useCallback(async(newState)=>{if(!session)return;setSyncing(true);try{const{data:ex}=await supabase.from("items").select("id").eq("user_id",session.user.id).maybeSingle();if(ex){await supabase.from("items").update({data:newState,updated_at:new Date().toISOString()}).eq("user_id",session.user.id)}else{await supabase.from("items").insert({user_id:session.user.id,data:newState,updated_at:new Date().toISOString()})}}catch(e){console.error(e)}finally{setSyncing(false)}},[session,setSyncing]);
  const setItems=(v)=>{const next=typeof v==="function"?v(items):v;setItemsRaw(next);saveToSupabase({items:next,nextId,windowDays,showCharts})};
  const days=useMemo(()=>getLastDays(windowDays),[windowDays]);
  const tareas=items.filter(i=>i.category==="📋 Tarea");const filtered=items.filter(i=>filterCat==="Todos"||i.category===filterCat);const todayKey=new Date().toISOString().slice(0,10);const todayChecked=tareas.filter(i=>i.checks[todayKey]).length;const totalChecked=tareas.reduce((a,i)=>a+days.filter(d=>i.checks[d]).length,0);const globalRate=tareas.length&&days.length?Math.round((totalChecked/(tareas.length*days.length))*100):0;
  const handleToggle=(id,d)=>{const next=items.map(i=>i.id===id?{...i,checks:{...i.checks,[d]:!i.checks[d]}}:i);setItemsRaw(next);saveToSupabase({items:next,nextId,windowDays,showCharts})};
  const handleUpdate=(updated)=>{const next=items.map(i=>i.id===updated.id?updated:i);setItemsRaw(next);saveToSupabase({items:next,nextId,windowDays,showCharts})};
  const handleSave=(form)=>{let next,newNextId=nextId;if(form.id){next=items.map(i=>i.id===form.id?form:i)}else{next=[...items,{...form,id:nextId,checks:{}}];newNextId=nextId+1};setItemsRaw(next);setNextId(newNextId);saveToSupabase({items:next,nextId:newNextId,windowDays,showCharts});setShowModal(false);setEditItem(null)};
  const chipStyle=(active,color)=>({background:active?(color?color+"33":"linear-gradient(90deg,#7eb8e2,#7ee2a8)"):"#ffffff10",color:active?(color||"#0d0d1f"):"#aaa",border:active&&color?`1px solid ${color}66`:"none",borderRadius:99,padding:"5px 13px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:active?700:400,transition:"all 0.18s"});
  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 20% 10%,#1a1a4e 0%,#0d0d1f 60%)",fontFamily:"'DM Mono',monospace",padding:"30px 20px"}}>
      <div style={{maxWidth:560,margin:"0 auto"}}>
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontFamily:"'DM Mono',monospace",fontSize:11,cursor:"pointer",marginBottom:6,padding:0}}>← Hub</button>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:"#f0eaff",fontWeight:700,lineHeight:1.1}}>Mi Desarrollo<br/><span style={{background:"linear-gradient(90deg,#7eb8e2,#7ee2a8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Personal</span></div>
              <div style={{color:"#555",fontSize:11,marginTop:5}}>Disciplina · Enfoque · Crecimiento</div>
              <div style={{fontSize:9,color:syncing?"#7eb8e2":"#2a2a5a",marginTop:3,transition:"color 0.3s"}}>{syncing?"⟳ sincronizando...":"● sincronizado"}</div>
            </div>
            <button onClick={onSignOut} style={{background:"#ffffff08",border:"1px solid #2a2a5a",borderRadius:8,color:"#555",padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,flexShrink:0,marginTop:4}}>Salir</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>{[{label:"Tareas hoy",value:`${todayChecked}/${tareas.length}`,color:TAREA_COLOR,sub:"completadas"},{label:`Consistencia ${windowDays}d`,value:`${globalRate}%`,color:"#7ee2a8",sub:"tareas"},{label:"Total items",value:items.length,color:"#e2c97e",sub:"activos"}].map(s=><div key={s.label} style={{background:"#1e1e3a",border:"1px solid #2a2a5a",borderRadius:12,padding:"13px 10px",textAlign:"center"}}><div style={{fontSize:9,color:"#555",marginBottom:2}}>{s.label}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:s.color,fontWeight:700}}>{s.value}</div><div style={{fontSize:9,color:"#444",marginTop:1}}>{s.sub}</div></div>)}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button style={chipStyle(filterCat==="Todos")} onClick={()=>setFilterCat("Todos")}>Todos</button>
            <button style={chipStyle(filterCat==="🎯 Meta",META_COLOR)} onClick={()=>setFilterCat("🎯 Meta")}>🎯 Meta</button>
            <button style={chipStyle(filterCat==="📋 Tarea")} onClick={()=>setFilterCat("📋 Tarea")}>📋 Tarea</button>
            <button style={chipStyle(filterCat==="⭐ Objetivo",OBJ_COLOR)} onClick={()=>setFilterCat("⭐ Objetivo")}>⭐ Objetivo</button>
          </div>
          <div style={{display:"flex",gap:5}}>
            {WINDOW_OPTIONS.map(w=><button key={w} style={{...chipStyle(windowDays===w),padding:"4px 10px",fontSize:10}} onClick={()=>setWindowDays(w)}>{w}d</button>)}
            <button style={{...chipStyle(showCharts),padding:"4px 10px",fontSize:10}} onClick={()=>setShowCharts(v=>!v)}>📊</button>
          </div>
        </div>
        {showCharts&&<><ProgressChart items={items} days={days}/><MetasObjetivosChart items={items}/></>}
        <Top3 items={items} days={days}/>
        <div style={{fontSize:10,color:"#444",fontFamily:"'DM Mono',monospace",marginBottom:12,textAlign:"right"}}>toca una casilla para marcar el día ✓</div>
        <div style={{marginBottom:20}}>
          {filtered.length===0&&<div style={{color:"#555",textAlign:"center",padding:"40px 0",fontSize:12}}>No hay elementos.</div>}
          {filtered.map(item=><ItemCard key={item.id} item={item} days={days} onToggle={handleToggle} onUpdate={handleUpdate} onEdit={i=>{setEditItem(i);setShowModal(true)}} onDelete={id=>setItems(items.filter(i=>i.id!==id))}/>)}
        </div>
        <button onClick={()=>{setEditItem(null);setShowModal(true)}} style={{width:"100%",background:"linear-gradient(90deg,#7eb8e2,#7ee2a8)",border:"none",borderRadius:12,padding:"15px",cursor:"pointer",fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0d0d1f"}}>+ Agregar elemento</button>
      </div>
      {showModal&&<Modal item={editItem} onClose={()=>{setShowModal(false);setEditItem(null)}} onSave={handleSave}/>}
    </div>
  );
};

/* ── FINANCE TRACKER ── */
const FT={bg:"#0a0a14",card:"#12121e",border:"#1e1e30",a1:"#7eb8e2",a2:"#7ee2a8",a3:"#e2c97e",a4:"#e27e9a",a5:"#b07ee2",text:"#e8e4dc",muted:"#9999bb",f1:"'Playfair Display',serif",f2:"'DM Mono',monospace",f3:"'DM Sans',sans-serif"};
const fmt=(n)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(n||0);
const fmtP=(n)=>`${Math.round(n||0)}%`;
const uid=()=>Math.random().toString(36).slice(2,9);
const FLS="fintrack_v2";
const fLoad=()=>{try{const r=localStorage.getItem(FLS);return r?JSON.parse(r):null;}catch{return null;}};
const fSave=(s)=>{try{localStorage.setItem(FLS,JSON.stringify(s));}catch{}};
const CAT_COLORS={Salario:FT.a2,Freelance:FT.a2,Negocio:FT.a2,"Inversión":FT.a2,Otro:FT.muted,Renta:FT.a4,Comida:FT.a3,Transporte:FT.a1,Salud:FT.a4,Entretenimiento:FT.a5,Ropa:FT.a3,"Educación":FT.a1,Deudas:FT.a4,Ahorro:FT.a2,Servicios:FT.muted};
const REC_LABEL={unica:"Única vez",semanal:"Semanal",quincenal:"Quincenal",mensual:"Mensual"};
const REC_COLOR={unica:FT.muted,semanal:FT.a1,quincenal:FT.a5,mensual:FT.a3};
const ING_CATS=["Salario","Freelance","Negocio","Inversión","Otro"];
const GAS_CATS=["Renta","Comida","Transporte","Salud","Entretenimiento","Ropa","Educación","Deudas","Ahorro","Servicios","Otro"];

/* ── FIX 1: generateInstances respects startDate ── */
function generateInstances(t,year,month){
  const{id,recurrence,startDate,amount,type,category,desc}=t;
  if(!startDate)return[];
  const anchor=new Date(startDate+"T00:00:00");
  const instances=[];
  const addIfOnOrAfterStart=(inst)=>{
    const d=new Date(inst.date+"T00:00:00");
    if(d>=anchor)instances.push(inst);
  };
  if(recurrence==="unica"){
    if(anchor.getFullYear()===year&&anchor.getMonth()===month){
      instances.push({id:`${id}_unica`,templateId:id,type,category,desc,amount,date:startDate,recurrence,auto:true});
    }
    return instances;
  }
  const daysInMonth=new Date(year,month+1,0).getDate();
  if(recurrence==="mensual"){
    const day=Math.min(anchor.getDate(),daysInMonth);
    addIfOnOrAfterStart({id:`${id}_m${year}${month}`,templateId:id,type,category,desc,amount,date:new Date(year,month,day).toISOString().slice(0,10),recurrence,auto:true});
    return instances;
  }
  if(recurrence==="quincenal"){
    [1,16].forEach(d=>{
      addIfOnOrAfterStart({id:`${id}_q${year}${month}${d}`,templateId:id,type,category,desc,amount,date:new Date(year,month,Math.min(d,daysInMonth)).toISOString().slice(0,10),recurrence,auto:true});
    });
    return instances;
  }
  if(recurrence==="semanal"){
    let cur=new Date(anchor);
    const mS=new Date(year,month,1),mE=new Date(year,month,daysInMonth);
    while(cur>mE)cur.setDate(cur.getDate()-7);
    while(cur<mS)cur.setDate(cur.getDate()+7);
    let idx=0;
    while(cur<=mE){
      if(cur.getMonth()===month&&cur.getFullYear()===year){
        addIfOnOrAfterStart({id:`${id}_w${year}${month}${idx}`,templateId:id,type,category,desc,amount,date:cur.toISOString().slice(0,10),recurrence,auto:true});
      }
      cur.setDate(cur.getDate()+7);idx++;
    }
  }
  return instances;
}

const FPill=({children,color=FT.a1,small=false})=><span style={{display:"inline-block",padding:small?"2px 8px":"4px 12px",borderRadius:20,background:`${color}18`,border:`1px solid ${color}44`,color,fontSize:small?10:11,fontFamily:FT.f2,letterSpacing:1,textTransform:"uppercase"}}>{children}</span>;
const FCard=({children,style={}})=><div style={{background:FT.card,border:`1px solid ${FT.border}`,borderRadius:16,padding:20,...style}}>{children}</div>;
const FInput=({label,value,onChange,type="text",placeholder=""})=><div style={{marginBottom:12}}>{label&&<div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>{label}</div>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"10px 14px",background:"#0d0d1a",border:`1px solid ${FT.border}`,borderRadius:10,color:FT.text,fontFamily:FT.f3,fontSize:14,outline:"none"}}/></div>;
const FSelect=({label,value,onChange,options})=><div style={{marginBottom:12}}>{label&&<div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>{label}</div>}<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 14px",background:"#0d0d1a",border:`1px solid ${FT.border}`,borderRadius:10,color:FT.text,fontFamily:FT.f3,fontSize:14,outline:"none"}}>{options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}</select></div>;
const FBar=({pct,color=FT.a2,height=8})=><div style={{background:FT.border,borderRadius:99,height,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${color}99,${color})`,borderRadius:99,transition:"width .6s ease"}}/></div>;
const FModal=({title,children,onClose})=><div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div style={{background:FT.card,border:`1px solid ${FT.border}`,borderRadius:20,padding:24,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontFamily:FT.f1,fontSize:20,fontWeight:700,color:"#e8e4dc"}}>{title}</div><button onClick={onClose} style={{background:"none",border:"none",color:"#aaaacc",fontSize:20,cursor:"pointer"}}>✕</button></div>{children}</div></div>;
const FBtn=({children,onClick,color=FT.a1,outline=false,small=false,style={}})=><button onClick={onClick} style={{padding:small?"8px 16px":"12px 20px",background:outline?"transparent":`linear-gradient(135deg,${color}cc,${color})`,border:`1.5px solid ${color}`,borderRadius:10,color:outline?color:"#0a0a14",fontFamily:FT.f3,fontSize:small?12:14,fontWeight:600,cursor:"pointer",...style}}>{children}</button>;

/* ── FIX 2: category resets when type changes ── */
const FinanceTmplForm=({init,onSave,onClose,title})=>{
  const[form,setForm]=useState(init);
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const cats=form.type==="ingreso"?ING_CATS:GAS_CATS;
  const handleTypeChange=(v)=>setForm(f=>({...f,type:v,category:v==="ingreso"?ING_CATS[0]:GAS_CATS[0]}));
  return<FModal title={title} onClose={onClose}>
    <FSelect label="Tipo" value={form.type} onChange={handleTypeChange} options={[{value:"gasto",label:"Gasto"},{value:"ingreso",label:"Ingreso"}]}/>
    <FSelect label="Categoría" value={form.category} onChange={v=>setF("category",v)} options={cats.map(c=>({value:c,label:c}))}/>
    <FInput label="Descripción" value={form.desc} onChange={v=>setF("desc",v)} placeholder="ej. Salario semanal"/>
    <FInput label="Monto (MXN)" type="number" value={form.amount} onChange={v=>setF("amount",v)} placeholder="0"/>
    <FSelect label="Recurrencia" value={form.recurrence} onChange={v=>setF("recurrence",v)} options={[{value:"unica",label:"Única vez"},{value:"semanal",label:"Semanal"},{value:"quincenal",label:"Quincenal"},{value:"mensual",label:"Mensual"}]}/>
    <FInput label={form.recurrence==="unica"?"Fecha":"Fecha de inicio"} type="date" value={form.startDate} onChange={v=>setF("startDate",v)}/>
    <div style={{display:"flex",gap:8}}>
      <FBtn onClick={()=>{if(form.desc&&form.amount&&form.startDate)onSave({...form,amount:parseFloat(form.amount)||0});}} color={form.type==="ingreso"?FT.a2:FT.a4} style={{flex:1}}>Guardar</FBtn>
      <FBtn onClick={onClose} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn>
    </div>
  </FModal>;
};

const FIN_DEF={templates:[{id:uid(),type:"ingreso",category:"Salario",desc:"Salario semanal",amount:4500,recurrence:"semanal",startDate:"2026-05-01"},{id:uid(),type:"gasto",category:"Renta",desc:"Renta departamento",amount:5500,recurrence:"mensual",startDate:"2026-05-01"},{id:uid(),type:"gasto",category:"Comida",desc:"Super semanal",amount:900,recurrence:"semanal",startDate:"2026-05-03"}],manualTx:[],debts:[],goals:[],budgets:[],wishlist:[]};

const FinDashboard=({state,allTx})=>{
  const{debts,goals,budgets}=state;
  const now=new Date();
  const mTx=allTx.filter(t=>{const d=new Date(t.date+"T12:00:00");return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const ing=mTx.filter(t=>t.type==="ingreso").reduce((a,t)=>a+t.amount,0);
  const gas=mTx.filter(t=>t.type==="gasto").reduce((a,t)=>a+t.amount,0);
  const bal=ing-gas;
  const tDeu=debts.reduce((a,d)=>a+(d.total-d.paid),0);
  const tAho=goals.reduce((a,g)=>a+g.saved,0);
  const sr=ing>0?((ing-gas)/ing)*100:0;
  const byCat={};mTx.filter(t=>t.type==="gasto").forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
  const catArr=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const lastTx=[...allTx].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
  return(
    <div>
      <div style={{fontFamily:FT.f1,fontSize:26,fontWeight:900,color:"#e8e4dc",marginBottom:4}}>Resumen Financiero</div>
      <div style={{fontFamily:FT.f2,fontSize:11,color:"#aaaacc",marginBottom:20,letterSpacing:1}}>{now.toLocaleString("es-MX",{month:"long",year:"numeric"}).toUpperCase()}</div>

      {/* KPIs row */}
      <div className="fin-widget-grid-3" style={{marginBottom:14}}>
        {[{label:"Ingresos",val:fmt(ing),color:FT.a2,icon:"↑"},{label:"Gastos",val:fmt(gas),color:FT.a4,icon:"↓"},{label:"Balance",val:fmt(bal),color:bal>=0?FT.a2:FT.a4,icon:"⊙"},{label:"Tasa ahorro",val:fmtP(sr),color:FT.a3,icon:"◈"},{label:"Deuda total",val:fmt(tDeu),color:FT.a4,icon:"⊗"},{label:"Total ahorrado",val:fmt(tAho),color:FT.a2,icon:"◎"}].map(k=>(
          <FCard key={k.label} style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{k.label}</div>
                <div style={{fontFamily:FT.f1,fontSize:20,fontWeight:700,color:k.color}}>{k.val}</div>
              </div>
              <span style={{fontSize:18,color:k.color,opacity:.6}}>{k.icon}</span>
            </div>
          </FCard>
        ))}
      </div>

      {/* Middle row: top gastos + últimos movimientos */}
      <div className="fin-widget-grid" style={{marginBottom:14}}>
        {catArr.length>0&&(
          <FCard>
            <div style={{fontFamily:FT.f2,fontSize:11,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>Top gastos del mes</div>
            {catArr.map(([cat,amt])=>(
              <div key={cat} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,color:"#e8e4dc"}}>{cat}</span>
                  <span style={{fontSize:13,fontFamily:FT.f2,color:CAT_COLORS[cat]||FT.muted}}>{fmt(amt)}</span>
                </div>
                <FBar pct={gas>0?(amt/gas)*100:0} color={CAT_COLORS[cat]||FT.muted}/>
              </div>
            ))}
          </FCard>
        )}
        <FCard>
          <div style={{fontFamily:FT.f2,fontSize:11,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>Últimos movimientos</div>
          {lastTx.length===0&&<div style={{color:"#aaaacc",fontSize:12,fontFamily:FT.f2,textAlign:"center",padding:"16px 0"}}>Sin movimientos aún</div>}
          {lastTx.map(t=>(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1e1e30"}}>
              <div>
                <div style={{color:"#e8e4dc",fontSize:13,fontFamily:FT.f3}}>{t.desc||t.category}</div>
                <div style={{color:CAT_COLORS[t.category]||"#aaaacc",fontSize:10,fontFamily:FT.f2}}>{t.category} · {t.date}</div>
              </div>
              <div style={{fontFamily:FT.f1,fontSize:15,fontWeight:700,color:t.type==="ingreso"?FT.a2:FT.a4}}>
                {t.type==="ingreso"?"+":"-"}{fmt(t.amount)}
              </div>
            </div>
          ))}
        </FCard>
      </div>

      {/* Presupuestos */}
      {budgets.length>0&&(
        <FCard>
          <div style={{fontFamily:FT.f2,fontSize:11,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>Presupuestos</div>
          <div className="fin-widget-grid">
            {budgets.map(b=>{
              const sp=mTx.filter(t=>t.type==="gasto"&&t.category===b.category).reduce((a,t)=>a+t.amount,0);
              const pct=b.limit>0?(sp/b.limit)*100:0;const ov=pct>100;
              return(
                <div key={b.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,color:"#e8e4dc"}}>{b.category}</span>
                    <span style={{fontSize:12,fontFamily:FT.f2,color:ov?FT.a4:"#aaaacc"}}>{fmt(sp)}/{fmt(b.limit)}{ov?" ⚠️":""}</span>
                  </div>
                  <FBar pct={pct} color={ov?FT.a4:b.color}/>
                </div>
              );
            })}
          </div>
        </FCard>
      )}
    </div>
  );
};

const FinTransactions=({state,setState,allTx})=>{const[view,setView]=useState("movimientos");const[modal,setModal]=useState(false);const[editTmpl,setEditTmpl]=useState(null);const[manualModal,setManualModal]=useState(false);const[editManual,setEditManual]=useState(null);const[filter,setFilter]=useState("todos");const[filterMonth,setFilterMonth]=useState("all");const[mf,setMFRaw]=useState({type:"gasto",category:"Comida",desc:"",amount:"",date:new Date().toISOString().slice(0,10),recurrence:"unica"});const setMF=(k,v)=>setMFRaw(f=>({...f,[k]:v}));const months=useMemo(()=>{const s=new Set(allTx.map(t=>t.date.slice(0,7)));return["all",...[...s].sort().reverse()];},[allTx]);const visible=allTx.filter(t=>filter==="todos"||t.type===filter).filter(t=>filterMonth==="all"||t.date.startsWith(filterMonth)).sort((a,b)=>new Date(b.date)-new Date(a.date));const tmplDef={type:"gasto",category:"Comida",desc:"",amount:"",recurrence:"mensual",startDate:new Date().toISOString().slice(0,10)};const saveTmpl=(data)=>{const tmpl={...data,id:editTmpl?editTmpl.id:uid()};setState(s=>({...s,templates:editTmpl?s.templates.map(t=>t.id===editTmpl.id?tmpl:t):[tmpl,...s.templates]}));setModal(false);setEditTmpl(null);};const delTmpl=(id)=>setState(s=>({...s,templates:s.templates.filter(t=>t.id!==id)}));const saveManual=()=>{if(!mf.amount||!mf.date)return;const tx={...mf,amount:parseFloat(mf.amount)||0,id:editManual?editManual.id:uid(),auto:false};setState(s=>({...s,manualTx:editManual?s.manualTx.map(t=>t.id===editManual.id?tx:t):[tx,...s.manualTx]}));setManualModal(false);};const delManual=(id)=>setState(s=>({...s,manualTx:s.manualTx.filter(t=>t.id!==id)}));return<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:FT.f1,fontSize:24,fontWeight:900,color:"#e8e4dc"}}>Movimientos</div><div style={{display:"flex",gap:8}}><FBtn onClick={()=>{setEditManual(null);setMFRaw({type:"gasto",category:"Comida",desc:"",amount:"",date:new Date().toISOString().slice(0,10),recurrence:"unica"});setManualModal(true);}} color={FT.a2} small>+ Único</FBtn><FBtn onClick={()=>{setEditTmpl(null);setModal(true);}} color={FT.a5} small>+ Recurrente</FBtn></div></div><div style={{display:"flex",gap:8,marginBottom:16}}>{[{id:"movimientos",label:"Historial"},{id:"recurrentes",label:"Plantillas"}].map(s=><button key={s.id} onClick={()=>setView(s.id)} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${view===s.id?FT.a1:FT.border}`,background:view===s.id?`${FT.a1}18`:"transparent",color:view===s.id?FT.a1:"#aaaacc",fontFamily:FT.f2,fontSize:11,cursor:"pointer"}}>{s.label}</button>)}</div>{view==="movimientos"&&<><div style={{display:"flex",gap:6,marginBottom:10}}>{["todos","ingreso","gasto"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filter===f?FT.a1:FT.border}`,background:filter===f?`${FT.a1}18`:"transparent",color:filter===f?FT.a1:"#aaaacc",fontFamily:FT.f2,fontSize:10,cursor:"pointer",textTransform:"uppercase",letterSpacing:1}}>{f}</button>)}</div><select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{width:"100%",padding:"8px 14px",background:"#0d0d1a",border:`1px solid ${FT.border}`,borderRadius:10,color:FT.text,fontFamily:FT.f3,fontSize:13,marginBottom:12,outline:"none"}}><option value="all">Todos los meses</option>{months.filter(m=>m!=="all").map(m=><option key={m} value={m}>{m}</option>)}</select>{visible.length===0&&<div style={{textAlign:"center",color:"#aaaacc",padding:"40px 0",fontFamily:FT.f2,fontSize:12}}>Sin transacciones</div>}{visible.map(t=><FCard key={t.id} style={{marginBottom:8,padding:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}><FPill color={t.type==="ingreso"?FT.a2:FT.a4} small>{t.type}</FPill><FPill color={REC_COLOR[t.recurrence]||FT.muted} small>{REC_LABEL[t.recurrence]||t.recurrence}</FPill><span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>{t.date}</span></div><div style={{fontFamily:FT.f3,fontSize:14,fontWeight:500,marginBottom:2,color:"#e8e4dc"}}>{t.desc||t.category}</div><div style={{fontFamily:FT.f2,fontSize:10,color:CAT_COLORS[t.category]||"#aaaacc"}}>{t.category}</div>{t.auto&&<div style={{fontFamily:FT.f2,fontSize:9,color:"#7777aa",marginTop:2}}>◈ Auto-generado</div>}</div><div style={{textAlign:"right"}}><div style={{fontFamily:FT.f1,fontSize:16,fontWeight:700,color:t.type==="ingreso"?FT.a2:FT.a4,marginBottom:t.auto?0:8}}>{t.type==="ingreso"?"+":"-"}{fmt(t.amount)}</div>{!t.auto&&<div style={{display:"flex",gap:6,marginTop:6}}><button onClick={()=>{setEditManual(t);setMFRaw({...t,amount:String(t.amount)});setManualModal(true);}} style={{background:"none",border:`1px solid ${FT.border}`,borderRadius:6,padding:"3px 8px",color:"#aaaacc",fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>delManual(t.id)} style={{background:"none",border:`1px solid ${FT.a4}44`,borderRadius:6,padding:"3px 8px",color:FT.a4,fontSize:11,cursor:"pointer"}}>✕</button></div>}</div></div></FCard>)}</>}{view==="recurrentes"&&<><FCard style={{marginBottom:12,padding:14,border:`1px solid ${FT.a5}33`}}><div style={{fontFamily:FT.f2,fontSize:10,color:FT.a5,letterSpacing:1,marginBottom:4}}>¿CÓMO FUNCIONA?</div><div style={{fontFamily:FT.f3,fontSize:12,color:"#aaaacc",lineHeight:1.6}}>Define aquí tus ingresos y gastos recurrentes. La app genera automáticamente las entradas de cada mes a partir de la fecha de inicio.</div></FCard>{state.templates.length===0&&<div style={{textAlign:"center",color:"#aaaacc",padding:"40px 0",fontFamily:FT.f2,fontSize:12}}>Sin plantillas aún</div>}{state.templates.map(t=><FCard key={t.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{flex:1}}><div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}><FPill color={t.type==="ingreso"?FT.a2:FT.a4} small>{t.type}</FPill><FPill color={REC_COLOR[t.recurrence]} small>{REC_LABEL[t.recurrence]}</FPill></div><div style={{fontFamily:FT.f1,fontSize:16,fontWeight:700,marginBottom:2,color:"#e8e4dc"}}>{t.desc}</div><div style={{fontFamily:FT.f2,fontSize:11,color:CAT_COLORS[t.category]||"#aaaacc",marginBottom:4}}>{t.category}</div><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>Inicio: {t.startDate}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:FT.f1,fontSize:18,fontWeight:700,color:t.type==="ingreso"?FT.a2:FT.a4,marginBottom:8}}>{fmt(t.amount)}</div><div style={{display:"flex",gap:6}}><button onClick={()=>{setEditTmpl(t);setModal(true);}} style={{background:"none",border:`1px solid ${FT.border}`,borderRadius:6,padding:"3px 8px",color:"#aaaacc",fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>delTmpl(t.id)} style={{background:"none",border:`1px solid ${FT.a4}44`,borderRadius:6,padding:"3px 8px",color:FT.a4,fontSize:11,cursor:"pointer"}}>✕</button></div></div></div></FCard>)}</>}{modal&&<FinanceTmplForm init={editTmpl?{...editTmpl,amount:String(editTmpl.amount)}:{...tmplDef}} title={editTmpl?"Editar plantilla":"Nueva plantilla"} onSave={saveTmpl} onClose={()=>{setModal(false);setEditTmpl(null);}}/>}{manualModal&&<FModal title={editManual?"Editar movimiento":"Nuevo movimiento"} onClose={()=>setManualModal(false)}><FSelect label="Tipo" value={mf.type} onChange={v=>setMF("type",v)} options={[{value:"gasto",label:"Gasto"},{value:"ingreso",label:"Ingreso"}]}/><FSelect label="Categoría" value={mf.category} onChange={v=>setMF("category",v)} options={(mf.type==="ingreso"?ING_CATS:GAS_CATS).map(c=>({value:c,label:c}))}/><FInput label="Descripción" value={mf.desc} onChange={v=>setMF("desc",v)} placeholder="Opcional"/><FInput label="Monto (MXN)" type="number" value={mf.amount} onChange={v=>setMF("amount",v)} placeholder="0"/><FInput label="Fecha" type="date" value={mf.date} onChange={v=>setMF("date",v)}/><div style={{display:"flex",gap:8}}><FBtn onClick={saveManual} color={mf.type==="ingreso"?FT.a2:FT.a4} style={{flex:1}}>Guardar</FBtn><FBtn onClick={()=>setManualModal(false)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}</div>;};

const FinDebts=({state,setState})=>{const[modal,setModal]=useState(false);const[edit,setEdit]=useState(null);const[payModal,setPayModal]=useState(null);const[payAmt,setPayAmt]=useState("");const[form,setForm]=useState({name:"",total:"",paid:"",rate:"",minPay:"",color:FT.a4});const setF=(k,v)=>setForm(f=>({...f,[k]:v}));const COLS=[FT.a4,FT.a5,FT.a1,FT.a3,FT.a2];const save=()=>{if(!form.name||!form.total)return;const d={...form,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0,rate:parseFloat(form.rate)||0,minPay:parseFloat(form.minPay)||0,id:edit?edit.id:uid()};setState(s=>({...s,debts:edit?s.debts.map(x=>x.id===edit.id?d:x):[d,...s.debts]}));setModal(false);};const del=(id)=>setState(s=>({...s,debts:s.debts.filter(d=>d.id!==id)}));const applyPay=()=>{const amt=parseFloat(payAmt)||0;if(!amt||!payModal)return;setState(s=>({...s,debts:s.debts.map(d=>d.id===payModal.id?{...d,paid:Math.min(d.total,d.paid+amt)}:d)}));setPayModal(null);setPayAmt("");};return<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontFamily:FT.f1,fontSize:24,fontWeight:900,color:"#e8e4dc"}}>Deudas</div><FBtn onClick={()=>{setEdit(null);setForm({name:"",total:"",paid:"",rate:"",minPay:"",color:FT.a4});setModal(true);}} color={FT.a4} small>+ Nueva</FBtn></div>{state.debts.length===0&&<div style={{textAlign:"center",color:"#aaaacc",padding:"40px 0",fontFamily:FT.f2,fontSize:12}}>Sin deudas 🎉</div>}{state.debts.map(d=>{const pend=d.total-d.paid,pct=(d.paid/d.total)*100;return<FCard key={d.id} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}><div><div style={{fontFamily:FT.f1,fontSize:17,fontWeight:700,marginBottom:4,color:"#e8e4dc"}}>{d.name}</div><div style={{display:"flex",gap:8}}>{d.rate>0&&<FPill color={FT.a4} small>TAE {d.rate}%</FPill>}{d.minPay>0&&<FPill color={FT.muted} small>Mín {fmt(d.minPay)}/mes</FPill>}</div></div><div style={{display:"flex",gap:6}}><button onClick={()=>{setEdit(d);setForm({...d,total:String(d.total),paid:String(d.paid),rate:String(d.rate),minPay:String(d.minPay)});setModal(true);}} style={{background:"none",border:`1px solid ${FT.border}`,borderRadius:6,padding:"3px 8px",color:"#aaaacc",fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>del(d.id)} style={{background:"none",border:`1px solid ${FT.a4}44`,borderRadius:6,padding:"3px 8px",color:FT.a4,fontSize:11,cursor:"pointer"}}>✕</button></div></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase"}}>Pendiente</div><div style={{fontFamily:FT.f1,fontSize:20,fontWeight:700,color:d.color||FT.a4}}>{fmt(pend)}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase"}}>Pagado</div><div style={{fontFamily:FT.f1,fontSize:16,fontWeight:700,color:FT.a2}}>{fmt(d.paid)}</div></div></div><FBar pct={pct} color={d.color||FT.a4}/><div style={{display:"flex",justifyContent:"space-between",marginTop:6,marginBottom:12}}><span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>{fmtP(pct)} pagado</span><span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>Total {fmt(d.total)}</span></div><FBtn onClick={()=>{setPayModal(d);setPayAmt("");}} color={FT.a2} small style={{width:"100%"}}>+ Registrar pago</FBtn></FCard>})}{modal&&<FModal title={edit?"Editar deuda":"Nueva deuda"} onClose={()=>setModal(false)}><FInput label="Nombre" value={form.name} onChange={v=>setF("name",v)} placeholder="ej. Tarjeta Bancomer"/><FInput label="Deuda total" type="number" value={form.total} onChange={v=>setF("total",v)} placeholder="0"/><FInput label="Ya pagado" type="number" value={form.paid} onChange={v=>setF("paid",v)} placeholder="0"/><FInput label="Tasa anual (%)" type="number" value={form.rate} onChange={v=>setF("rate",v)} placeholder="0"/><FInput label="Pago mínimo mensual" type="number" value={form.minPay} onChange={v=>setF("minPay",v)} placeholder="0"/><div style={{marginBottom:12}}><div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Color</div><div style={{display:"flex",gap:8}}>{COLS.map(c=><button key={c} onClick={()=>setF("color",c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"2px solid #fff":"2px solid transparent",cursor:"pointer"}}/>)}</div></div><div style={{display:"flex",gap:8}}><FBtn onClick={save} color={FT.a4} style={{flex:1}}>Guardar</FBtn><FBtn onClick={()=>setModal(false)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}{payModal&&<FModal title={`Pago: ${payModal.name}`} onClose={()=>setPayModal(null)}><div style={{textAlign:"center",marginBottom:16}}><div style={{fontFamily:FT.f2,fontSize:11,color:"#aaaacc",marginBottom:4,letterSpacing:1}}>PENDIENTE</div><div style={{fontFamily:FT.f1,fontSize:28,fontWeight:900,color:FT.a4}}>{fmt(payModal.total-payModal.paid)}</div></div><FInput label="Monto del pago" type="number" value={payAmt} onChange={setPayAmt} placeholder="0"/><div style={{display:"flex",gap:8}}><FBtn onClick={applyPay} color={FT.a2} style={{flex:1}}>Registrar</FBtn><FBtn onClick={()=>setPayModal(null)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}</div>;};

const FinGoals=({state,setState})=>{const[modal,setModal]=useState(false);const[edit,setEdit]=useState(null);const[depModal,setDepModal]=useState(null);const[depAmt,setDepAmt]=useState("");const[form,setForm]=useState({name:"",target:"",saved:"",deadline:"",color:FT.a2,icon:"🎯"});const setF=(k,v)=>setForm(f=>({...f,[k]:v}));const COLS=[FT.a2,FT.a1,FT.a3,FT.a5,FT.a4];const ICONS=["🎯","✈️","🏠","🛡️","🎓","💻","🚗","💍","🌴","💰"];const save=()=>{if(!form.name||!form.target)return;const g={...form,target:parseFloat(form.target)||0,saved:parseFloat(form.saved)||0,id:edit?edit.id:uid()};setState(s=>({...s,goals:edit?s.goals.map(x=>x.id===edit.id?g:x):[g,...s.goals]}));setModal(false);};const del=(id)=>setState(s=>({...s,goals:s.goals.filter(g=>g.id!==id)}));const applyDep=()=>{const amt=parseFloat(depAmt)||0;if(!amt||!depModal)return;setState(s=>({...s,goals:s.goals.map(g=>g.id===depModal.id?{...g,saved:Math.min(g.target,g.saved+amt)}:g)}));setDepModal(null);setDepAmt("");};return<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontFamily:FT.f1,fontSize:24,fontWeight:900,color:"#e8e4dc"}}>Metas de ahorro</div><FBtn onClick={()=>{setEdit(null);setForm({name:"",target:"",saved:"",deadline:"",color:FT.a2,icon:"🎯"});setModal(true);}} color={FT.a2} small>+ Nueva</FBtn></div>{state.goals.length===0&&<div style={{textAlign:"center",color:"#aaaacc",padding:"40px 0",fontFamily:FT.f2,fontSize:12}}>Sin metas aún</div>}{state.goals.map(g=>{const pct=(g.saved/g.target)*100,done=pct>=100;const dl=g.deadline?Math.ceil((new Date(g.deadline)-new Date())/86400000):null;return<FCard key={g.id} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{g.icon}</span><div><div style={{fontFamily:FT.f1,fontSize:17,fontWeight:700,color:"#e8e4dc"}}>{g.name}</div>{g.deadline&&<div style={{fontFamily:FT.f2,fontSize:10,color:dl<30?FT.a4:"#aaaacc",marginTop:2}}>{done?"¡Completada! 🎉":dl<0?"Vencida":dl===0?"Hoy":dl<30?`${dl} días`:`Hasta ${g.deadline}`}</div>}</div></div><div style={{display:"flex",gap:6}}><button onClick={()=>{setEdit(g);setForm({...g,target:String(g.target),saved:String(g.saved)});setModal(true);}} style={{background:"none",border:`1px solid ${FT.border}`,borderRadius:6,padding:"3px 8px",color:"#aaaacc",fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>del(g.id)} style={{background:"none",border:`1px solid ${FT.a4}44`,borderRadius:6,padding:"3px 8px",color:FT.a4,fontSize:11,cursor:"pointer"}}>✕</button></div></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase"}}>Ahorrado</div><div style={{fontFamily:FT.f1,fontSize:20,fontWeight:700,color:g.color}}>{fmt(g.saved)}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase"}}>Meta</div><div style={{fontFamily:FT.f1,fontSize:16,fontWeight:700,color:"#aaaacc"}}>{fmt(g.target)}</div></div></div><FBar pct={pct} color={done?"#ffd700":g.color} height={10}/><div style={{display:"flex",justifyContent:"space-between",marginTop:6,marginBottom:done?0:12}}><span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>{fmtP(pct)}</span>{!done&&<span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>Faltan {fmt(g.target-g.saved)}</span>}</div>{!done&&<FBtn onClick={()=>{setDepModal(g);setDepAmt("");}} color={g.color} small style={{width:"100%"}}>+ Depositar</FBtn>}</FCard>})}{modal&&<FModal title={edit?"Editar meta":"Nueva meta"} onClose={()=>setModal(false)}><FInput label="Nombre" value={form.name} onChange={v=>setF("name",v)} placeholder="ej. Fondo de emergencia"/><FInput label="Meta (MXN)" type="number" value={form.target} onChange={v=>setF("target",v)} placeholder="0"/><FInput label="Ya ahorrado" type="number" value={form.saved} onChange={v=>setF("saved",v)} placeholder="0"/><FInput label="Fecha límite" type="date" value={form.deadline} onChange={v=>setF("deadline",v)}/><div style={{marginBottom:12}}><div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Ícono</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{ICONS.map(i=><button key={i} onClick={()=>setF("icon",i)} style={{fontSize:20,padding:4,background:form.icon===i?FT.border:"#ffffff12",border:"1px solid #2a2a4a",borderRadius:6,cursor:"pointer"}}>{i}</button>)}</div></div><div style={{marginBottom:12}}><div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Color</div><div style={{display:"flex",gap:8}}>{COLS.map(c=><button key={c} onClick={()=>setF("color",c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"2px solid #fff":"2px solid transparent",cursor:"pointer"}}/>)}</div></div><div style={{display:"flex",gap:8}}><FBtn onClick={save} color={FT.a2} style={{flex:1}}>Guardar</FBtn><FBtn onClick={()=>setModal(false)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}{depModal&&<FModal title={`Depositar: ${depModal.name}`} onClose={()=>setDepModal(null)}><div style={{textAlign:"center",marginBottom:16}}><div style={{fontFamily:FT.f2,fontSize:11,color:"#aaaacc",marginBottom:4,letterSpacing:1}}>FALTA</div><div style={{fontFamily:FT.f1,fontSize:28,fontWeight:900,color:depModal.color}}>{fmt(depModal.target-depModal.saved)}</div></div><FInput label="Cantidad" type="number" value={depAmt} onChange={setDepAmt} placeholder="0"/><div style={{display:"flex",gap:8}}><FBtn onClick={applyDep} color={FT.a2} style={{flex:1}}>Depositar</FBtn><FBtn onClick={()=>setDepModal(null)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}</div>;};

const FinBudgets=({state,setState,allTx})=>{const[modal,setModal]=useState(false);const[edit,setEdit]=useState(null);const[form,setForm]=useState({category:"Comida",limit:"",color:FT.a1});const setF=(k,v)=>setForm(f=>({...f,[k]:v}));const now=new Date();const mTx=allTx.filter(t=>{const d=new Date(t.date+"T12:00:00");return t.type==="gasto"&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});const CATS=["Renta","Comida","Transporte","Salud","Entretenimiento","Ropa","Educación","Deudas","Ahorro","Servicios","Otro"];const COLS=[FT.a1,FT.a2,FT.a3,FT.a4,FT.a5];const tB=state.budgets.reduce((a,b)=>a+b.limit,0);const tS=state.budgets.reduce((a,b)=>a+mTx.filter(t=>t.category===b.category).reduce((x,t)=>x+t.amount,0),0);const save=()=>{if(!form.limit)return;const b={...form,limit:parseFloat(form.limit)||0,id:edit?edit.id:uid()};setState(s=>({...s,budgets:edit?s.budgets.map(x=>x.id===edit.id?b:x):[b,...s.budgets]}));setModal(false);};const del=(id)=>setState(s=>({...s,budgets:s.budgets.filter(b=>b.id!==id)}));return<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontFamily:FT.f1,fontSize:24,fontWeight:900,color:"#e8e4dc"}}>Presupuesto</div><FBtn onClick={()=>{setEdit(null);setForm({category:"Comida",limit:"",color:FT.a1});setModal(true);}} color={FT.a1} small>+ Categoría</FBtn></div><FCard style={{marginBottom:16,padding:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase"}}>Gastado</div><div style={{fontFamily:FT.f1,fontSize:22,fontWeight:900,color:tS>tB?FT.a4:FT.a2}}>{fmt(tS)}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1,textTransform:"uppercase"}}>Presupuestado</div><div style={{fontFamily:FT.f1,fontSize:18,fontWeight:700,color:"#aaaacc"}}>{fmt(tB)}</div></div></div><FBar pct={tB>0?(tS/tB)*100:0} color={tS>tB?FT.a4:FT.a1} height={10}/><div style={{marginTop:6,fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>{now.toLocaleString("es-MX",{month:"long"}).toUpperCase()} · Disponible {fmt(Math.max(0,tB-tS))}</div></FCard>{state.budgets.length===0&&<div style={{textAlign:"center",color:"#aaaacc",padding:"40px 0",fontFamily:FT.f2,fontSize:12}}>Sin categorías</div>}{state.budgets.map(b=>{const sp=mTx.filter(t=>t.category===b.category).reduce((a,t)=>a+t.amount,0);const pct=b.limit>0?(sp/b.limit)*100:0,over=pct>100;return<FCard key={b.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{fontFamily:FT.f1,fontSize:16,fontWeight:700,color:"#e8e4dc"}}>{b.category}</div><div style={{fontFamily:FT.f2,fontSize:11,color:over?FT.a4:"#aaaacc",marginTop:2}}>{over?`Excediste por ${fmt(sp-b.limit)}`:`Disponible ${fmt(Math.max(0,b.limit-sp))}`}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}>{over&&<span>⚠️</span>}<button onClick={()=>{setEdit(b);setForm({...b,limit:String(b.limit)});setModal(true);}} style={{background:"none",border:`1px solid ${FT.border}`,borderRadius:6,padding:"3px 8px",color:"#aaaacc",fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>del(b.id)} style={{background:"none",border:`1px solid ${FT.a4}44`,borderRadius:6,padding:"3px 8px",color:FT.a4,fontSize:11,cursor:"pointer"}}>✕</button></div></div><FBar pct={pct} color={over?FT.a4:b.color}/><div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{fontFamily:FT.f2,fontSize:10,color:over?FT.a4:"#aaaacc"}}>{fmt(sp)} gastado</span><span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>Límite {fmt(b.limit)}</span></div></FCard>})}{modal&&<FModal title={edit?"Editar":"Nueva categoría"} onClose={()=>setModal(false)}><FSelect label="Categoría" value={form.category} onChange={v=>setF("category",v)} options={CATS.map(c=>({value:c,label:c}))}/><FInput label="Límite mensual" type="number" value={form.limit} onChange={v=>setF("limit",v)} placeholder="0"/><div style={{marginBottom:12}}><div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Color</div><div style={{display:"flex",gap:8}}>{COLS.map(c=><button key={c} onClick={()=>setF("color",c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"2px solid #fff":"2px solid transparent",cursor:"pointer"}}/>)}</div></div><div style={{display:"flex",gap:8}}><FBtn onClick={save} color={FT.a1} style={{flex:1}}>Guardar</FBtn><FBtn onClick={()=>setModal(false)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}</div>;};

const FinWishlist=({state,setState})=>{const[modal,setModal]=useState(false);const[edit,setEdit]=useState(null);const[form,setForm]=useState({name:"",price:"",priority:"media",saved:"",link:"",notes:"",img:""});const setF=(k,v)=>setForm(f=>({...f,[k]:v}));const PC={alta:FT.a4,media:FT.a3,baja:FT.a2};const sorted=[...state.wishlist].sort((a,b)=>({alta:0,media:1,baja:2}[a.priority]||1)-({alta:0,media:1,baja:2}[b.priority]||1));const save=()=>{if(!form.name||!form.price)return;const w={...form,price:parseFloat(form.price)||0,saved:parseFloat(form.saved)||0,id:edit?edit.id:uid()};setState(s=>({...s,wishlist:edit?s.wishlist.map(x=>x.id===edit.id?w:x):[w,...s.wishlist]}));setModal(false);};const del=(id)=>setState(s=>({...s,wishlist:s.wishlist.filter(w=>w.id!==id)}));const buy=(id)=>setState(s=>({...s,wishlist:s.wishlist.map(w=>w.id===id?{...w,bought:!w.bought}:w)}));return<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontFamily:FT.f1,fontSize:24,fontWeight:900,color:"#e8e4dc"}}>Lista de deseos</div><FBtn onClick={()=>{setEdit(null);setForm({name:"",price:"",priority:"media",saved:"",link:"",notes:"",img:""});setModal(true);}} color={FT.a3} small>+ Agregar</FBtn></div>{sorted.length===0&&<div style={{textAlign:"center",color:"#aaaacc",padding:"40px 0",fontFamily:FT.f2,fontSize:12}}>Tu lista está vacía</div>}{sorted.map(w=>{const pct=w.price>0?(w.saved/w.price)*100:0;return<FCard key={w.id} style={{marginBottom:10,opacity:w.bought?.6:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:10}}><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}><div style={{fontFamily:FT.f1,fontSize:16,fontWeight:700,color:w.bought?"#9999bb":"#e8e4dc",textDecoration:w.bought?"line-through":"none"}}>{w.name}</div><FPill color={PC[w.priority]||FT.muted} small>{w.priority}</FPill></div>{w.notes&&<div style={{fontFamily:FT.f3,fontSize:12,color:"#aaaacc",marginTop:2}}>{w.notes}</div>}{w.link&&<a href={w.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:6,fontSize:11,fontFamily:FT.f2,color:FT.a1,textDecoration:"none",borderBottom:`1px solid ${FT.a1}55`}}>🔗 Ver producto →</a>}</div><div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}><div style={{display:"flex",gap:5}}><button onClick={()=>buy(w.id)} style={{background:"none",border:`1px solid ${w.bought?FT.a2:FT.border}`,borderRadius:6,padding:"3px 8px",color:w.bought?FT.a2:"#9999bb",fontSize:11,cursor:"pointer"}}>{w.bought?"✓":"○"}</button><button onClick={()=>{setEdit(w);setForm({...w,price:String(w.price),saved:String(w.saved),img:w.img||""});setModal(true);}} style={{background:"none",border:`1px solid ${FT.border}`,borderRadius:6,padding:"3px 8px",color:"#9999bb",fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>del(w.id)} style={{background:"none",border:`1px solid ${FT.a4}44`,borderRadius:6,padding:"3px 8px",color:FT.a4,fontSize:11,cursor:"pointer"}}>✕</button></div>{w.img&&<img src={w.img} alt={w.name} style={{width:120,height:90,objectFit:"cover",borderRadius:8,border:`1px solid ${FT.border}`}}/>}</div></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div style={{fontFamily:FT.f1,fontSize:18,fontWeight:700,color:FT.a3}}>{fmt(w.price)}</div>{w.saved>0&&<div style={{fontFamily:FT.f2,fontSize:12,color:FT.a2}}>Ahorrado {fmt(w.saved)}</div>}</div>{w.saved>0&&<><FBar pct={pct} color={FT.a3}/><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>{fmtP(pct)}</span>{w.price-w.saved>0&&<span style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc"}}>Faltan {fmt(w.price-w.saved)}</span>}</div></>}</FCard>})}{modal&&<FModal title={edit?"Editar artículo":"Nuevo artículo"} onClose={()=>setModal(false)}><FInput label="Nombre" value={form.name} onChange={v=>setF("name",v)} placeholder="¿Qué quieres comprar?"/><FInput label="Precio (MXN)" type="number" value={form.price} onChange={v=>setF("price",v)} placeholder="0"/><FSelect label="Prioridad" value={form.priority} onChange={v=>setF("priority",v)} options={[{value:"alta",label:"Alta"},{value:"media",label:"Media"},{value:"baja",label:"Baja"}]}/><FInput label="Ya ahorrado" type="number" value={form.saved} onChange={v=>setF("saved",v)} placeholder="0"/><FInput label="Link (opcional)" value={form.link} onChange={v=>setF("link",v)} placeholder="https://..."/><FInput label="Notas" value={form.notes} onChange={v=>setF("notes",v)} placeholder="Opcional"/><div style={{marginBottom:12}}><div style={{fontSize:11,fontFamily:FT.f2,color:"#aaaacc",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>Imagen (opcional)</div><label style={{display:"block",cursor:"pointer"}}><div style={{width:"100%",padding:"10px 14px",background:"#0d0d1a",border:`1px solid ${FT.border}`,borderRadius:10,color:"#9999bb",fontFamily:FT.f3,fontSize:13,textAlign:"center"}}>{form.img?"✓ Imagen seleccionada — toca para cambiar":"📁 Seleccionar imagen del dispositivo"}</div><input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>setF("img",ev.target.result);reader.readAsDataURL(file);}}/></label>{form.img&&<img src={form.img} alt="preview" style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:8,marginTop:8,border:`1px solid ${FT.border}`}}/>}{form.img&&<button onClick={()=>setF("img","")} style={{background:"none",border:"none",color:FT.a4,fontSize:11,cursor:"pointer",marginTop:4,fontFamily:FT.f2}}>✕ Quitar imagen</button>}</div><div style={{display:"flex",gap:8}}><FBtn onClick={save} color={FT.a3} style={{flex:1}}>Guardar</FBtn><FBtn onClick={()=>setModal(false)} color={FT.muted} outline style={{flex:1}}>Cancelar</FBtn></div></FModal>}</div>;};

const FIN_TABS=[{id:"dashboard",label:"Resumen",icon:"◈"},{id:"transactions",label:"Movimientos",icon:"⇅"},{id:"debts",label:"Deudas",icon:"⊗"},{id:"goals",label:"Metas",icon:"◎"},{id:"budgets",label:"Presupuesto",icon:"▦"},{id:"wishlist",label:"Deseos",icon:"♡"}];

const FIN_SIDEBAR_STYLE = `
  .fin-layout { display: flex; flex-direction: column; min-height: 100vh; background: #0a0a14; }
  .fin-sidebar { display: none; }
  .fin-mobile-nav { display: flex; position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: #0e0e1a; border-top: 1px solid #1e1e30; z-index: 20; }
  .fin-main { padding: 0 16px 80px; max-width: 560px; margin: 0 auto; width: 100%; }
  .fin-topbar { display: block; }
  @media (min-width: 768px) {
    .fin-layout { flex-direction: row; }
    .fin-sidebar { display: flex; flex-direction: column; width: 180px; min-height: 100vh; background: #0d0d1a; border-right: 1px solid #1e1e30; position: sticky; top: 0; height: 100vh; overflow-y: auto; flex-shrink: 0; z-index: 20; }
    .fin-mobile-nav { display: none; }
    .fin-main { max-width: 100%; margin: 0; padding: 24px 28px 40px; flex: 1; overflow-y: auto; }
    .fin-topbar { display: none; }
    .fin-widget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .fin-widget-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .fin-widget-full { grid-column: 1 / -1; }
    .fin-widget-left { grid-column: 1 / 2; }
    .fin-widget-right { grid-column: 2 / 3; }
  }
  @media (max-width: 767px) {
    .fin-widget-grid, .fin-widget-grid-3 { display: block; }
  }
`;

const FinanceTracker=({onBack})=>{
  const[state,setStateRaw]=useState(()=>fLoad()??FIN_DEF);
  const[tab,setTab]=useState("dashboard");
  const setState=(upd)=>setStateRaw(prev=>{const next=typeof upd==="function"?upd(prev):upd;fSave(next);return next;});
  const allTx=useMemo(()=>{const now=new Date();const today=now.toISOString().slice(0,10);const instances=[];for(let offset=-2;offset<=1;offset++){const d=new Date(now.getFullYear(),now.getMonth()+offset,1);state.templates.forEach(t=>generateInstances(t,d.getFullYear(),d.getMonth()).forEach(i=>instances.push(i)));}const all=[...instances,...state.manualTx];return all.filter(t=>t.date<=today);},[state.templates,state.manualTx]);

  const tabProps={state,setState,allTx};
  const today=new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase();

  return(
    <div className="fin-layout">
      <style>{FIN_SIDEBAR_STYLE}</style>

      {/* ── SIDEBAR (desktop only) ── */}
      <div className="fin-sidebar">
        <div style={{padding:"24px 16px 16px"}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#7ee2a8",fontFamily:FT.f2,fontSize:10,cursor:"pointer",marginBottom:16,padding:0,display:"block"}}>← Hub</button>
          <div style={{fontFamily:FT.f1,fontSize:20,fontWeight:900,color:"#e8e4dc",lineHeight:1}}>Finance</div>
          <div style={{fontFamily:FT.f2,fontSize:9,color:FT.a3,letterSpacing:3,marginTop:4}}>TRACKER · MXN</div>
          <div style={{fontFamily:FT.f2,fontSize:9,color:"#555",marginTop:6}}>{today}</div>
        </div>
        <div style={{borderTop:"1px solid #1e1e30",padding:"12px 8px",flex:1}}>
          {FIN_TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",
              background:tab===t.id?`${FT.a1}18`:"none",border:"none",
              borderRadius:8,cursor:"pointer",marginBottom:2,textAlign:"left",
              color:tab===t.id?FT.a1:"#8888aa",transition:"all .15s"
            }}>
              <span style={{fontSize:15,lineHeight:1,flexShrink:0}}>{t.icon}</span>
              <span style={{fontFamily:FT.f2,fontSize:11}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MOBILE TOPBAR ── */}
      <div className="fin-topbar" style={{padding:"24px 20px 16px",background:`linear-gradient(180deg,#0a0a14ee,transparent)`,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#7ee2a8",fontFamily:FT.f2,fontSize:11,cursor:"pointer",marginBottom:6,padding:0}}>← Hub</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{fontFamily:FT.f1,fontSize:26,fontWeight:900,color:"#e8e4dc",lineHeight:1}}>Finance</div>
            <div style={{fontFamily:FT.f2,fontSize:11,color:FT.a3,letterSpacing:3,marginTop:2}}>TRACKER · MXN</div>
          </div>
          <div style={{fontFamily:FT.f2,fontSize:10,color:"#aaaacc",letterSpacing:1}}>{today}</div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="fin-main">
        {tab==="dashboard"&&<FinDashboard {...tabProps}/>}
        {tab==="transactions"&&<FinTransactions {...tabProps}/>}
        {tab==="debts"&&<FinDebts state={state} setState={setState}/>}
        {tab==="goals"&&<FinGoals state={state} setState={setState}/>}
        {tab==="budgets"&&<FinBudgets {...tabProps}/>}
        {tab==="wishlist"&&<FinWishlist state={state} setState={setState}/>}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="fin-mobile-nav">
        {FIN_TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 2px 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:tab===t.id?FT.a1:"#8888aa"}}>
          <span style={{fontSize:16,lineHeight:1}}>{t.icon}</span>
          <span style={{fontFamily:FT.f2,fontSize:9,letterSpacing:.5}}>{t.label}</span>
        </button>)}
      </div>
    </div>
  );
};

export default function App(){
  const[session,setSession]=useState(undefined);
  const[screen,setScreen]=useState("hub");
  const[syncing,setSyncing]=useState(false);
  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe();},[]);
  if(session===undefined)return<div style={{minHeight:"100vh",background:"#0d0d1f",display:"flex",alignItems:"center",justifyContent:"center"}}><GlobalStyles/><div style={{color:"#555",fontFamily:"'DM Mono',monospace",fontSize:13}}>Cargando...</div></div>;
  if(!session)return<><GlobalStyles/><Auth/></>;
  const handleSignOut=()=>supabase.auth.signOut();
  if(screen==="personal")return<PersonalTracker session={session} onBack={()=>setScreen("hub")} onSignOut={handleSignOut} syncing={syncing} setSyncing={setSyncing}/>;
  if(screen==="finanzas")return<FinanceTracker onBack={()=>setScreen("hub")}/>;
  return<Hub onSelect={setScreen} onSignOut={handleSignOut} syncing={syncing}/>;
}