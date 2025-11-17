import React, { useEffect, useState } from "react";

interface Props {
  phone: string;
  smsCode?: string;
  setSmsCode?: (v: string) => void;
  onSend?: () => Promise<void> | void;
  onComplete?: (code: string) => Promise<void> | void;
  loading?: boolean;
  helper?: string;
}

export default function SmsCodeInput({ phone, smsCode = "", setSmsCode, onSend, onComplete, loading = false, helper }: Props) {
  const [code, setCode] = useState<string>(smsCode);
  useEffect(()=> setCode(smsCode), [smsCode]);
  useEffect(()=> { if(setSmsCode) setSmsCode(code); }, [code]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>){
    const v = e.target.value.replace(/\D/g, "").slice(0,4);
    setCode(v);
    if(v.length === 4 && onComplete) onComplete(v);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ marginBottom:8 }}>Код отправлен на {phone}</div>
      <input value={code} onChange={onChange} maxLength={4} style={{ fontSize:24, padding:"8px 12px", textAlign:"center", width:140 }} />
      {helper && <div style={{ color:"red" }}>{helper}</div>}
      <div style={{ marginTop:12, display:"flex", gap:10 }}>
        <button onClick={()=> onComplete && onComplete(code)} disabled={loading} style={{ padding:"8px 16px" }}>Подтвердить</button>
        <button onClick={()=> onSend && onSend()} disabled={loading} style={{ padding:"8px 16px" }}>Отправить ещё раз</button>
      </div>
    </div>
  );
}