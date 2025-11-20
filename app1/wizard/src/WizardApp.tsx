import '../../wheel/src/styles.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

import PoolIndicatorEmbed from '../../PoolIndicator/src/PoolIndicatorEmbed';
import PoolWheelWidgetEmbed from '../../wheel/src/PoolWheelWidgetEmbed';
import PhoneForm from './components/PhoneForm';
import SmsForm from './components/SmsForm';
import Success from './components/Success';

// Импорт QR (Vite/webpack корректно вернёт URL)
import qrcodeSvg from './components/qrcode.svg';

type Step = 1 | 2 | 3 | 4 | 5 | 'payment';

function readEmbedConfigFromUrl() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const modeParam = sp.get("mode") || sp.get("layout");
    const bg = (sp.get("bg") || sp.get("background") || "").toLowerCase();
    const mode: "minimal" | "compact" = modeParam === "compact" ? "compact" : "minimal";
    const transparentBg = bg === "transparent" || bg === "none" || sp.get("noBg") === "1";
    const font = (sp.get("font") || "").toLowerCase();
    const panel = (sp.get("panel") ?? (mode === "compact" ? "1" : "0")) !== "0";
    const color = (sp.get("color") || "#ffffff").replace("#", "");
    const cardHeight = sp.get("cardHeight") || undefined;
    const height = sp.get("height") || undefined;
    return { mode, transparentBg, font, panel, color, cardHeight, height };
  } catch (e) {
    return { mode: "minimal", transparentBg: false, font: "", panel: true, color: "ffffff", cardHeight: undefined, height: undefined };
  }
}

/* --- Fetch logger types & installer (unchanged) --- */
type FetchLogEntry = { id: string; ts: string; method?: string; url?: string; requestHeaders?: Record<string, any>; requestBody?: any; status?: number | null; statusText?: string | null; responseHeaders?: Record<string, string | undefined>; responseText?: string | null; error?: string | null; durationMs?: number | null; };
function short(s?: string | null, max = 200) { if (!s) return ""; if (s.length <= max) return s; return s.slice(0, max) + `... (${s.length} chars)`; }
function installFetchLogger() {
  if ((window as any).__PW_FETCH_LOG_INSTALLED__) return;
  (window as any).__PW_FETCH_LOG_INSTALLED__ = true;
  const _fetch = window.fetch.bind(window);
  (window as any).__PW_FETCH_LOG_PUSH__ = (entry: FetchLogEntry) => { (window as any).__PW_FETCH_LOG_QUEUE__ = (window as any).__PW_FETCH_LOG_QUEUE__ || []; (window as any).__PW_FETCH_LOG_QUEUE__.push(entry); };
  window.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const id = Math.random().toString(36).slice(2, 9);
    const tsStart = Date.now();
    const method = (init && init.method) || (typeof input === "string" ? "GET" : (input as Request).method) || "GET";
    const url = typeof input === "string" ? input : (input as Request).url;
    const headersObj: Record<string, any> = {};
    try {
      const initHeaders = init?.headers;
      if (initHeaders) {
        if (initHeaders instanceof Headers) initHeaders.forEach((v, k) => headersObj[k] = v);
        else if (Array.isArray(initHeaders)) initHeaders.forEach(([k, v]: any) => headersObj[k] = v);
        else Object.assign(headersObj, initHeaders);
      }
    } catch (e) {}
    const reqBody = init && init.body ? (typeof init.body === "string" ? init.body : (init.body as any)) : undefined;
    const entryBase: FetchLogEntry = { id, ts: new Date().toISOString(), method, url, requestHeaders: headersObj, requestBody: typeof reqBody === "string" ? reqBody : (reqBody ? JSON.stringify(reqBody) : undefined), status: null, statusText: null, responseHeaders: {}, responseText: null, error: null, durationMs: null };
    try {
      const resp = await _fetch(input, init);
      const ms = Date.now() - tsStart;
      entryBase.status = resp.status;
      entryBase.statusText = resp.statusText;
      try { resp.headers.forEach((v,k)=>{ (entryBase.responseHeaders!)[k]=v; }); } catch(e){}
      try { entryBase.responseText = await resp.clone().text(); } catch(e){ entryBase.responseText = `<<unable to read body>>`; }
      entryBase.durationMs = ms;
      try { (window as any).__PW_FETCH_LOG_PUSH__ && (window as any).__PW_FETCH_LOG_PUSH__(entryBase); } catch (e){}
      return resp;
    } catch (err:any) {
      const ms = Date.now() - tsStart;
      entryBase.error = String(err?.message || err);
      entryBase.durationMs = ms;
      try { (window as any).__PW_FETCH_LOG_PUSH__ && (window as any).__PW_FETCH_LOG_PUSH__(entryBase); } catch (e){}
      throw err;
    }
  };
}

/* ----------------------------- Inline DebugPanel ----------------------------- */
function DebugPanel({ visible, onClose, getAppState }: { visible: boolean; onClose: () => void; getAppState: () => any; }) {
  const [logs, setLogs] = useState<FetchLogEntry[]>(() => { const q = (window as any).__PW_FETCH_LOG_QUEUE__ || []; (window as any).__PW_FETCH_LOG_QUEUE__ = []; return Array.isArray(q) ? q.slice().reverse() : []; });
  const pushRef = useRef<(e: FetchLogEntry)=>void|null>(null);
  useEffect(() => { installFetchLogger(); pushRef.current = (entry)=> setLogs(s=>[entry,...s].slice(0,500)); (window as any).__PW_FETCH_LOG_PUSH__ = (entry:FetchLogEntry)=>{ try{ pushRef.current && pushRef.current(entry);}catch{} }; return ()=>{ (window as any).__PW_FETCH_LOG_PUSH__=(entry)=>{ (window as any).__PW_FETCH_LOG_QUEUE__=(window as any).__PW_FETCH_LOG_QUEUE__||[]; (window as any).__PW_FETCH_LOG_QUEUE__.push(entry); }; }; }, []);
  const [filter, setFilter] = useState<string>(""); const [showResp, setShowResp] = useState(true); const appState = getAppState();
  function clearLogs(){ setLogs([]); } function exportLogs(){ const blob = new Blob([JSON.stringify(logs,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`pw-fetch-logs-${new Date().toISOString()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
  async function runTestConfirm(){ try{ const phone = prompt("Phone to test:", appState.phone||""); if(!phone) return; const base = (window as any).__PW_API_BASE__ || "/catalog/api-backend/api"; const url = `${base}/confirm_phone`; const resp = await fetch(url,{method:'POST', headers:{"Content-Type":"application/json"}, body: JSON.stringify({phone, method:'sms'})}); const text = await resp.text(); alert(`Response ${resp.status}: ${short(text,2000)}`); }catch(e:any){ alert("Test failed: " + (e?.message||String(e))); } }
  if(!visible) return null;
  return (
    <div style={{ position:'fixed', right:12, bottom:12, width:820, height:520, zIndex:2147483646, boxShadow:'0 8px 30px rgba(0,0,0,0.35)', borderRadius:12, overflow:'hidden', background:'#0b1220', color:'#dbeafe', fontFamily:'Menlo,monospace', fontSize:12 }}>
      <div style={{ display:'flex', gap:8, padding:8, alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontWeight:700, fontSize:13 }}>PW Debug Panel</div>
        <div style={{ opacity:0.8, fontSize:11 }}>{new Date().toLocaleString()}</div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={runTestConfirm} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6 }}>Run confirm_phone</button>
          <button onClick={exportLogs} style={{ background:'transparent', color:'#a6b9d9', border:'1px solid rgba(255,255,255,0.04)', padding:'6px 8px', borderRadius:6 }}>Export</button>
          <button onClick={clearLogs} style={{ background:'transparent', color:'#fca5a5', border:'1px solid rgba(255,255,255,0.04)', padding:'6px 8px', borderRadius:6 }}>Clear</button>
          <button onClick={onClose} style={{ background:'transparent', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6 }}>Close</button>
        </div>
      </div>
      <div style={{ display:'flex', height:'calc(100% - 44px)' }}>
        <div style={{ width:360, borderRight:'1px solid rgba(255,255,255,0.03)', padding:10, overflow:'auto' }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700 }}>App state</div>
            <pre style={{ whiteSpace:'pre-wrap', color:'#dbeafe', background:'rgba(255,255,255,0.02)', padding:8, borderRadius:6 }}>{JSON.stringify(appState,null,2)}</pre>
            <div style={{ marginTop:8, display:'flex', gap:6 }}>
              <button onClick={()=>{ try{ window.location.reload(); }catch{} }} style={{ padding:'6px 8px', borderRadius:6 }}>Reload page</button>
              <button onClick={()=>{ try{ localStorage.clear(); alert('localStorage cleared'); }catch(e){ alert(String(e)); } }} style={{ padding:'6px 8px', borderRadius:6 }}>Clear localStorage</button>
              <button onClick={()=>{ try{ alert(JSON.stringify(Object.fromEntries(Object.entries(localStorage)), null, 2)); }catch(e){ alert(String(e)); } }} style={{ padding:'6px 8px', borderRadius:6 }}>Show localStorage</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Recent messages / events</div>
            <div style={{ fontSize:11, color:'#9fb3d6' }}>- Window messages (postMessage & custom events)</div>
            <div style={{ marginTop:8 }}>
              <button onClick={()=>{ try{ window.parent.postMessage?.({ type:'dvvs:debug:dump', payload:getAppState() }, '*'); alert('Posted dvvs:debug:dump to parent'); }catch(e){ alert('Post failed: '+String(e)); } }} style={{ padding:'6px 8px', borderRadius:6 }}>Post debug dump to parent</button>
            </div>
          </div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:8, borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', gap:8, alignItems:'center' }}>
            <input placeholder="filter URL / method / status" value={filter} onChange={(e)=>setFilter(e.target.value)} style={{ flex:1, padding:6, borderRadius:6, border:'1px solid rgba(255,255,255,0.04)', background:'transparent', color:'#dbeafe' }} />
            <label style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="checkbox" checked={showResp} onChange={(e)=>setShowResp(e.target.checked)} /> show responses
            </label>
          </div>
          <div style={{ overflow:'auto', padding:8, flex:1 }}>
            {logs.filter(l => { if(!filter) return true; const q = filter.toLowerCase(); return String(l.url||'').toLowerCase().includes(q) || String(l.method||'').toLowerCase().includes(q) || String(l.status||'').toLowerCase().includes(q) || String(l.requestBody||'').toLowerCase().includes(q) || String(l.responseText||'').toLowerCase().includes(q); }).map(l=>(
              <div key={l.id} style={{ marginBottom:10, padding:8, borderRadius:6, background:'rgba(255,255,255,0.02)' }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ fontWeight:700 }}>{l.method||'GET'}</div>
                  <div style={{ color:'#9fb3d6', fontSize:12, flex:1 }}>{short(l.url||'',180)}</div>
                  <div style={{ minWidth:72, textAlign:'right', fontWeight:700, color: l.status && l.status>=200 && l.status<300 ? '#4ade80' : '#f87171' }}>{l.status ?? '-'}</div>
                </div>
                <div style={{ marginTop:6, fontSize:11, color:'#9fb3d6' }}><div>ts: {l.ts} · duration: {l.durationMs ?? '-' }ms</div></div>
                <div style={{ marginTop:8, fontSize:12 }}>
                  <div style={{ fontSize:11, color:'#a6c0e8' }}>Request:</div>
                  <pre style={{ whiteSpace:'pre-wrap', maxHeight:120, overflow:'auto', background:'rgba(0,0,0,0.25)', padding:8, borderRadius:6 }}>{short(l.requestBody ?? JSON.stringify(l.requestHeaders || {}), 2000)}</pre>
                </div>
                {showResp && (<div style={{ marginTop:8 }}><div style={{ fontSize:11, color:'#a6c0e8' }}>Response:</div><pre style={{ whiteSpace:'pre-wrap', maxHeight:220, overflow:'auto', background:'rgba(0,0,0,0.25)', padding:8, borderRadius:6 }}>{short(l.responseText ?? l.error ?? String(l.statusText||''), 8000)}</pre></div>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Inline temporary Payment component ----------------------------- */

function Payment({ bookingId, amount, qrPath, onPaid }: { bookingId: string; amount: number; qrPath?: string; onPaid?: (res:any) => void }) {
  const qr = qrPath || qrcodeSvg;
  // Make payment panel visually above debug panel and clickable
  const panelStyle: React.CSSProperties = { position: 'relative', zIndex: 2147483648, pointerEvents: 'auto', background: 'transparent', paddingTop: 24 };
  return (
    <div style={{ maxWidth: 760, margin: "20px auto", textAlign: "center", padding: 12 }}>
      <div style={panelStyle}>
        <h2 style={{ marginBottom: 12 }}>Оплата (тест)</h2>
        <div style={{ marginBottom: 12 }}>Booking: <strong>{bookingId}</strong></div>
        <div style={{ marginBottom: 12 }}>Сумма: <strong>{amount} руб</strong></div>
        <div style={{ marginBottom: 12 }}>
          <img src={qr} alt="QR" style={{ width: 240, height: 240, borderRadius: 6 }} onError={(e)=>{ console.error('QR load error', e); }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <a href="https://payment.alfabank.ru/sc/YtqrJuXMxIjZREIz" target="_blank" rel="noreferrer">
            <button type="button" style={{ padding: "10px 18px", borderRadius: 8, background: "#0b5cff", color: "#fff", border: "none", fontWeight: 700 }}>Оплатить в Альфа</button>
          </a>
          <button
            type="button"
            onClick={() => { console.log('Payment.markPaid clicked', { bookingId, amount }); onPaid && onPaid({ ok: true, bookingId, amount }); }}
            style={{ padding: "10px 18px", borderRadius: 8, background: "#10b981", color: "#fff", border: "none", fontWeight: 700 }}
          >
            Пометить как оплачено
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- WizardApp (main) ----------------------------- */

const WizardApp: React.FC = () => {
  const urlCfg = useMemo(() => readEmbedConfigFromUrl(), []);
  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [client, setClient] = useState<any>(null);

  const [phone, setPhone] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  const [debugVisible, setDebugVisible] = useState<boolean>(Boolean(new URLSearchParams(window.location.search).get('pw_debug')));
  const PAYMENT_TEST_AMOUNT = 800;

  useEffect(() => {
    try {
      const p = localStorage.getItem('pw:phone'); if (p) setPhone(p);
      const prevStart = localStorage.getItem('pw:selectedStart'); const prevAppt = localStorage.getItem('pw:selectedAppointmentId');
      if (prevStart) { const dt = new Date(prevStart); if (!isNaN(dt.getTime())) { setSelectedDate(dt.toISOString().slice(0,10)); setSelectedHour(dt.getHours()); setSelectedSlot({ start_date: prevStart, appointment_id: prevAppt||undefined }); } }
    } catch {}
  }, []);

  useEffect(()=>{ if (selectedDate && selectedHour != null) { try { localStorage.setItem('pw:selectedStart', `${selectedDate}T${String(selectedHour).padStart(2,'0')}:00:00`); } catch{} } }, [selectedDate, selectedHour]);

  const onMessage = useCallback((ev: MessageEvent) => {
    if (!ev.data || typeof ev.data !== 'object') return;
    const { type, payload } = ev.data as any;
    if (type === 'dvvs:openBooking' && payload) {
      if (payload.start) { const dt = new Date(payload.start); if (!isNaN(dt.getTime())) { const startIso = payload.start; const appt = payload.appointment_id || localStorage.getItem('pw:selectedAppointmentId') || undefined; setSelectedDate(dt.toISOString().slice(0,10)); setSelectedHour(dt.getHours()); setSelectedSlot({ start_date: startIso, appointment_id: appt }); setStep(3); return; } }
      setStep(2); return;
    }
    if (type === 'pw:openWheel' && (ev as any).data && (ev as any).data.href) {
      try { const href = (ev as any).data.href as string; const url = new URL(href, window.location.href); const start = url.searchParams.get('start'); const appt = url.searchParams.get('appointment_id') || localStorage.getItem('pw:selectedAppointmentId') || undefined; if (start) { const dt = new Date(start); if (!isNaN(dt.getTime())) { setSelectedDate(dt.toISOString().slice(0,10)); setSelectedHour(dt.getHours()); setSelectedSlot({ start_date: start, appointment_id: appt }); setStep(3); return; } } } catch(e) {}
      setStep(2); return;
    }
    if (type === 'dvvs:booking:success' && payload && payload.client) { setClient(payload.client); setStep(5); }
  }, []);

  useEffect(()=>{ window.addEventListener('message', onMessage); return ()=> window.removeEventListener('message', onMessage); }, [onMessage]);

  const handleOpenWheel = useCallback((href:string) => {
    try { const url = new URL(href, window.location.href); const start = url.searchParams.get('start'); const appt = url.searchParams.get('appointment_id') || localStorage.getItem('pw:selectedAppointmentId') || undefined; if (start) { const dt = new Date(start); if (!isNaN(dt.getTime())) { setSelectedDate(dt.toISOString().slice(0,10)); setSelectedHour(dt.getHours()); setSelectedSlot({ start_date: start, appointment_id: appt }); setStep(3); return; } } } catch(e){} setStep(2);
  }, []);

  const handleSlotSelected = useCallback((dateIso:string, hour:number) => {
    let appt: string|undefined = undefined; try{ appt = localStorage.getItem('pw:selectedAppointmentId') || undefined; }catch{}
    const start = `${dateIso}T${String(hour).padStart(2,'0')}:00:00`;
    setSelectedDate(dateIso); setSelectedHour(hour); setSelectedSlot({ start_date: start, appointment_id: appt }); try{ localStorage.setItem('pw:selectedStart', start); }catch{}; setStep(3);
  }, []);

  const isWheelStep = step === 2;
  const containerStyle = useMemo<React.CSSProperties>(() => isWheelStep ? { width:'100%', maxWidth:980, margin:'0 auto' } : { maxWidth:640, margin:'0 auto' }, [isWheelStep]);

  function getSelectedSlot(){ if (selectedSlot && (selectedSlot.appointment_id || selectedSlot.start_date)) return selectedSlot; if (selectedDate && selectedHour != null) { const start = `${selectedDate}T${String(selectedHour).padStart(2,'0')}:00:00`; const appt = (()=>{ try{ return localStorage.getItem('pw:selectedAppointmentId')||undefined; }catch{return undefined;} })(); return { start_date: start, appointment_id: appt }; } return null; }

  function onNewBookingReset(){ setStep(1); setClient(null); setSelectedDate(null); setSelectedHour(null); setSelectedSlot(null); setPhone(""); setRequestId(""); try{ localStorage.removeItem('pw:phone'); localStorage.removeItem('pw:requestId'); localStorage.removeItem('pw:selectedStart'); localStorage.removeItem('pw:selectedAppointmentId'); }catch{} }

  const getAppState = useCallback(()=>({ step, selectedDate, selectedHour, selectedSlot, phone, requestId, localStorage: (()=>{ try{ const o:Record<string,string>={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k) o[k]=localStorage.getItem(k)||'';} return o;}catch{return{}} })(), PW_API_BASE:(window as any).__PW_API_BASE__||null, href: window.location.href, userAgent: navigator.userAgent }), [step, selectedDate, selectedHour, selectedSlot, phone, requestId]);

  // fixed payment button (always on top)
  const paymentButton = (
    <div style={{ position:'fixed', top:84, left:'50%', transform:'translateX(-50%)', zIndex:2147483649, pointerEvents:'auto' }}>
      <button onClick={()=>setStep('payment')} style={{ padding:'14px 28px', fontWeight:800, fontSize:16, background:'#0b5cff', color:'#fff', border:'none', borderRadius:12, cursor:'pointer', boxShadow:'0 10px 30px rgba(11,92,255,0.18)'}}>🔥 Перейти к оплате (тест)</button>
    </div>
  );

  return (
    <div className="wiz-root">
      <div className="wiz-container" style={containerStyle}>
        {step === 1 && (<><div style={{ position:'relative', zIndex:2147483645 }}>{paymentButton}<div className="indicator-wrapper"><PoolIndicatorEmbed apiBase="/catalog/api-backend" onOpenWheel={handleOpenWheel} width="100%" height={urlCfg.height} cardHeight={urlCfg.cardHeight} bg={urlCfg.transparentBg? 'transparent': undefined} panel={urlCfg.panel} font={urlCfg.font} color={urlCfg.color} /></div></div></>)}

        {step === 2 && (<PoolWheelWidgetEmbed mode={urlCfg.mode} font={urlCfg.font} panel={urlCfg.panel} transparentBg={urlCfg.transparentBg} color={"#"+(urlCfg.color||"ffffff")} onSelectSlot={handleSlotSelected} />)}

        {step === 3 && (<PhoneForm slot={getSelectedSlot()} initialPhone={phone} onBack={()=>setStep(2)} onSubmit={({phone:p, requestId:rid})=>{ setPhone(p); setRequestId(rid); setStep(4); }} />)}

        {step === 4 && (<SmsForm slot={getSelectedSlot()} phone={phone} requestId={requestId} onBack={()=>setStep(3)} confirmDelayMs={800} onComplete={(res)=>{ setClient(res?.bookingResult ?? res); setStep(5); }} />)}

        {step === 5 && (<Success client={client} onNewBooking={onNewBookingReset} />)}

        {step === 'payment' && (<Payment bookingId={`TEST-${Date.now()}`} amount={PAYMENT_TEST_AMOUNT} qrPath={qrcodeSvg} onPaid={(res)=>{ console.log('onPaid from WizardApp', res); alert('Оплата (тест) подтверждена'); setStep(1); }} />)}
      </div>

      <div>
        <button onClick={()=>setDebugVisible(v=>!v)} title="Toggle debug panel" style={{ position:'fixed', right:16, bottom:16, zIndex:2147483647, padding:'10px 12px', borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background: debugVisible ? '#ef4444' : '#111827', color:'#fff', cursor:'pointer', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>{ debugVisible ? 'Debug (ON)' : 'Debug' }</button>
        <DebugPanel visible={debugVisible} onClose={()=>setDebugVisible(false)} getAppState={getAppState} />
      </div>
    </div>
  );
};

export default WizardApp;