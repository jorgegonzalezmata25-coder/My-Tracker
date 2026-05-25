import { useState } from 'react'
import { supabase } from './supabase'
export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inp = { width:'100%',background:'#0d0d1f',border:'1px solid #2a2a5a',borderRadius:9,padding:'12px 14px',color:'#f0eaff',fontFamily:"'DM Mono',monospace",fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:12 }
  const handleSubmit = async () => {
    setLoading(true);setError('');setMessage('')
    if (mode==='login') { const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message) }
    else { const {error}=await supabase.auth.signUp({email,password});if(error)setError(error.message);else setMessage('Cuenta creada, revisa tu correo.') }
    setLoading(false)
  }
  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at 20% 10%,#1a1a4e 0%,#0d0d1f 60%)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono:wght@300;400;500&display=swap');*{box-sizing:border-box}`}</style>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:'#f0eaff',fontWeight:700,marginBottom:6}}>Mi Desarrollo<br/><span style={{background:'linear-gradient(90deg,#7eb8e2,#7ee2a8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Personal</span></div>
        <div style={{color:'#555',fontSize:11,fontFamily:"'DM Mono',monospace",marginBottom:32}}>Disciplina · Enfoque · Crecimiento</div>
        <div style={{background:'linear-gradient(135deg,#1e1e3a,#16213e)',border:'1px solid #2a2a5a',borderRadius:18,padding:28}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#f0eaff',marginBottom:20}}>{mode==='login'?'Iniciar sesión':'Crear cuenta'}</div>
          <input style={inp} type="email" placeholder="Correo electrónico" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input style={inp} type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
          {error&&<div style={{color:'#e27e7e',fontSize:11,fontFamily:"'DM Mono',monospace",marginBottom:12}}>{error}</div>}
          {message&&<div style={{color:'#7ee2a8',fontSize:11,fontFamily:"'DM Mono',monospace",marginBottom:12}}>{message}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{width:'100%',background:'linear-gradient(90deg,#7eb8e2,#7ee2a8)',border:'none',borderRadius:10,padding:'13px',fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:'#0d0d1f',cursor:'pointer',marginBottom:14,opacity:loading?0.6:1}}>{loading?'Cargando...':mode==='login'?'Entrar':'Crear cuenta'}</button>
          <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('')}} style={{width:'100%',background:'none',border:'none',color:'#555',fontFamily:"'DM Mono',monospace",fontSize:11,cursor:'pointer',textDecoration:'underline'}}>{mode==='login'?'¿No tienes cuenta? Crear una':'¿Ya tienes cuenta? Iniciar sesión'}</button>
        </div>
      </div>
    </div>
  )
}
