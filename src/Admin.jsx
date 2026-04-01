import { useState, useEffect } from "react";

const T = {
  bg: "#0A0C10", surface: "#111318", border: "#1E2230",
  accent: "#4F8EF7", accentDim: "#1E3A6E", accentGlow: "rgba(79,142,247,0.18)",
  green: "#2DD4A0", amber: "#F5A623", red: "#FF5B5B",
  text: "#E8EAF0", muted: "#6B7280", subtle: "#1C2030",
};

function Card({ children, style={} }) {
  return <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, ...style }}>{children}</div>;
}

function Btn({ children, variant="primary", onClick, style={}, disabled=false }) {
  const base = { primary:{bg:T.accent,color:"#fff",border:T.accent}, ghost:{bg:"transparent",color:T.muted,border:T.border}, outline:{bg:"transparent",color:T.accent,border:T.accent}, danger:{bg:T.red,color:"#fff",border:T.red} }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:base.bg, color:base.color, border:`1px solid ${base.border}`, borderRadius:9, padding:"7px 16px", fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, fontFamily:"inherit", ...style }}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type="text" }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {label && <label style={{ fontSize:11, color:T.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>{label}</label>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, padding:"9px 12px", color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />
    </div>
  );
}

// ── 로그인 ─────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      localStorage.setItem('admin_token', data.token);
      onLogin(data.token);
    } catch(e) { setError('로그인 중 오류가 발생했습니다.'); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0} input{color-scheme:dark}`}</style>
      <Card style={{ padding:40, width:400 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:48, height:48, background:`linear-gradient(135deg,${T.accent},#7C3AED)`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:800, color:"#fff", margin:"0 auto 12px" }}>P</div>
          <div style={{ fontSize:20, fontWeight:700 }}>ProGenesis 관리자</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>관리자 계정으로 로그인하세요</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Input label="이메일" value={email} onChange={setEmail} placeholder="admin@example.com" type="email" />
          <Input label="비밀번호" value={password} onChange={setPassword} placeholder="비밀번호 입력" type="password" />
          {error && <div style={{ color:T.red, fontSize:12, padding:"8px 12px", background:T.red+"11", borderRadius:8 }}>{error}</div>}
          <Btn onClick={handleLogin} disabled={loading||!email||!password} style={{ padding:"11px 0", width:"100%", marginTop:4 }}>
            {loading ? "로그인 중..." : "로그인"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ── 메인 관리자 앱 ──────────────────────────────────────────────
export default function AdminApp() {
  const [token, setToken] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (t) {
      fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: t }),
      }).then(r => r.json()).then(d => {
        if (!d.error) setToken(t);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else setLoading(false);
  }, []);

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  if (loading) return <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", color:T.muted, fontFamily:"sans-serif" }}>로딩 중...</div>;
  if (!token) return <AdminLogin onLogin={setToken} />;

  const navItems = [
    { id:"dashboard", icon:"⊞", label:"대시보드" },
    { id:"methodology", icon:"◈", label:"개발 방법론" },
    { id:"ossp", icon:"📋", label:"OSSP 관리" },
    { id:"files", icon:"📁", label:"파일 관리" },
  ];

  const pages = {
    dashboard: <AdminDashboard token={token} setPage={setPage} />,
    methodology: <MethodologyManager token={token} />,
    ossp: <OsspManager token={token} />,
    files: <FileManager token={token} />,
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:${T.bg}} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px} input,select{color-scheme:dark} input::placeholder{color:${T.muted}} button:focus{outline:none}`}</style>
      <aside style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
        <div style={{ padding:"0 20px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, background:`linear-gradient(135deg,${T.accent},#7C3AED)`, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:800, color:"#fff" }}>P</div>
            <div><div style={{ fontSize:14, fontWeight:700 }}>ProGenesis</div><div style={{ fontSize:10, color:T.muted }}>관리자 페이지</div></div>
          </div>
        </div>
        <nav style={{ padding:"14px 10px", flex:1, display:"flex", flexDirection:"column", gap:2 }}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:10, background:page===item.id?T.accentGlow:"transparent", color:page===item.id?T.accent:T.muted, border:page===item.id?`1px solid ${T.accentDim}`:"1px solid transparent", cursor:"pointer", fontSize:13, fontWeight:page===item.id?600:400, fontFamily:"inherit", textAlign:"left", width:"100%" }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}` }}>
          <button onClick={logout} style={{ width:"100%", padding:"8px 0", background:"transparent", border:`1px solid ${T.border}`, borderRadius:9, color:T.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>로그아웃</button>
        </div>
      </aside>
      <main style={{ flex:1, overflow:"auto" }}>{pages[page]||pages.dashboard}</main>
    </div>
  );
}

// ── 대시보드 ────────────────────────────────────────────────────
function AdminDashboard({ token, setPage }) {
  const [stats, setStats] = useState({ methodologies:0, ossp:0, files:0 });

  useEffect(() => {
    async function load() {
      const [m, o, f] = await Promise.all([
        fetch('/api/admin-data?table=methodologies', { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
        fetch('/api/admin-data?table=ossp', { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
        fetch('/api/admin-data?table=ossp_files', { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
      ]);
      setStats({ methodologies:Array.isArray(m)?m.length:0, ossp:Array.isArray(o)?o.length:0, files:Array.isArray(f)?f.length:0 });
    }
    load();
  }, [token]);

  const cards = [
    { label:"개발 방법론", value:stats.methodologies, color:T.accent, page:"methodology", desc:"Waterfall, Agile 등" },
    { label:"OSSP 방법론", value:stats.ossp, color:T.green, page:"ossp", desc:"정보공학방법론 등" },
    { label:"등록 파일", value:stats.files, color:T.amber, page:"files", desc:"산출물 템플릿 등" },
  ];

  return (
    <div style={{ padding:"32px 36px" }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>관리자 대시보드</h1>
        <p style={{ color:T.muted, fontSize:13 }}>ProGenesis 방법론 및 파일을 관리합니다.</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:32 }}>
        {cards.map(c=>(
          <Card key={c.label} style={{ padding:"20px 24px", cursor:"pointer", transition:"border-color .2s" }}
            onClick={()=>setPage(c.page)}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent+"66"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:32, fontWeight:700, color:c.color, lineHeight:1, marginBottom:6 }}>{c.value}</div>
            <div style={{ fontSize:11, color:T.muted }}>{c.desc}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding:24 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>빠른 시작</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { step:"1", text:"개발 방법론 등록 (Waterfall, Agile, DevOps)", page:"methodology" },
            { step:"2", text:"OSSP 방법론 등록 (정보공학방법론 v2.0)", page:"ossp" },
            { step:"3", text:"산출물 단계 및 테일러링 규칙 설정", page:"ossp" },
            { step:"4", text:"파일 업로드 (절차서, 산출물 템플릿 등)", page:"files" },
          ].map(item=>(
            <div key={item.step} onClick={()=>setPage(item.page)} style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 16px", background:T.bg, borderRadius:10, cursor:"pointer", border:`1px solid ${T.border}` }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent+"66"}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:T.accentDim, color:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>{item.step}</div>
              <div style={{ fontSize:13 }}>{item.text}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── 개발 방법론 관리 ─────────────────────────────────────────────
function MethodologyManager({ token }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name:'', description:'' });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await fetch('/api/admin-data?table=methodologies', { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json());
    if (Array.isArray(data)) setItems(data);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setLoading(true);
    const action = editing ? 'update' : 'create';
    const body = { action, table:'methodologies', data:{ ...form, order_num: items.length+1 } };
    if (editing) body.id = editing;
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(body) });
    setForm({ name:'', description:'' }); setEditing(null);
    await load(); setLoading(false);
  }

  async function remove(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ action:'delete', table:'methodologies', id }) });
    await load();
  }

  async function toggleActive(item) {
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ action:'update', table:'methodologies', id:item.id, data:{ is_active:!item.is_active } }) });
    await load();
  }

  function startEdit(item) {
    setEditing(item.id);
    setForm({ name:item.name, description:item.description||'' });
  }

  return (
    <div style={{ padding:"32px 36px", maxWidth:800 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>개발 방법론 관리</h1>
        <p style={{ color:T.muted, fontSize:13 }}>Waterfall, Agile/Scrum, DevOps 등 개발 방법론을 관리합니다.</p>
      </div>

      {/* 등록/수정 폼 */}
      <Card style={{ padding:24, marginBottom:24 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>{editing ? "방법론 수정" : "새 방법론 등록"}</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Input label="방법론 이름 *" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="예: Waterfall" />
          <Input label="설명" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="예: 전통적 순차 개발 방법론" />
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={save} disabled={!form.name||loading}>{editing?"수정 저장":"등록"}</Btn>
            {editing && <Btn variant="ghost" onClick={()=>{ setEditing(null); setForm({ name:'', description:'' }); }}>취소</Btn>}
          </div>
        </div>
      </Card>

      {/* 목록 */}
      <Card style={{ padding:24 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>등록된 방법론 ({items.length}개)</h2>
        {items.length===0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:13 }}>등록된 방법론이 없습니다.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {items.map(item=>(
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontWeight:600, fontSize:14 }}>{item.name}</span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:5, background:item.is_active?T.green+"22":T.muted+"22", color:item.is_active?T.green:T.muted, fontWeight:700 }}>
                      {item.is_active ? "활성" : "비활성"}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:T.muted }}>{item.description}</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn variant="outline" onClick={()=>startEdit(item)} style={{ fontSize:11, padding:"5px 10px" }}>수정</Btn>
                  <Btn variant="ghost" onClick={()=>toggleActive(item)} style={{ fontSize:11, padding:"5px 10px" }}>{item.is_active?"비활성화":"활성화"}</Btn>
                  <Btn variant="danger" onClick={()=>remove(item.id)} style={{ fontSize:11, padding:"5px 10px" }}>삭제</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── OSSP 관리 ───────────────────────────────────────────────────
function OsspManager({ token }) {
  const [osspList, setOsspList] = useState([]);
  const [selectedOssp, setSelectedOssp] = useState(null);
  const [phases, setPhases] = useState([]);
  const [form, setForm] = useState({ name:'', version:'', description:'' });
  const [phaseForm, setPhaseForm] = useState({ code:'', name:'' });
  const [editingOssp, setEditingOssp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('ossp');

  async function loadOssp() {
    const data = await fetch('/api/admin-data?table=ossp', { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json());
    if (Array.isArray(data)) setOsspList(data);
  }

  async function loadPhases(osspId) {
    const data = await fetch(`/api/admin-data?table=ossp_phases&filter=ossp_id=eq.${osspId}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json());
    if (Array.isArray(data)) setPhases(data);
  }

  useEffect(() => { loadOssp(); }, []);
  useEffect(() => { if (selectedOssp) loadPhases(selectedOssp.id); }, [selectedOssp]);

  async function saveOssp() {
    setLoading(true);
    const action = editingOssp ? 'update' : 'create';
    const body = { action, table:'ossp', data:form };
    if (editingOssp) body.id = editingOssp;
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify(body) });
    setForm({ name:'', version:'', description:'' }); setEditingOssp(null);
    await loadOssp(); setLoading(false);
  }

  async function savePhase() {
    setLoading(true);
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body:JSON.stringify({ action:'create', table:'ossp_phases', data:{ ...phaseForm, ossp_id:selectedOssp.id, order_num:phases.length+1 } }) });
    setPhaseForm({ code:'', name:'' });
    await loadPhases(selectedOssp.id); setLoading(false);
  }

  async function deletePhase(id) {
    if (!confirm('단계를 삭제하시겠습니까?')) return;
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ action:'delete', table:'ossp_phases', id }) });
    await loadPhases(selectedOssp.id);
  }

  async function deleteOssp(id) {
    if (!confirm('OSSP를 삭제하시겠습니까? 관련 단계와 산출물도 모두 삭제됩니다.')) return;
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ action:'delete', table:'ossp', id }) });
    setSelectedOssp(null); await loadOssp();
  }

  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>OSSP 방법론 관리</h1>
        <p style={{ color:T.muted, fontSize:13 }}>정보공학방법론 등 OSSP 방법론과 단계를 관리합니다.</p>
      </div>

      <div style={{ display:"flex", gap:3, marginBottom:24, background:T.surface, borderRadius:10, padding:3, border:`1px solid ${T.border}`, width:"fit-content" }}>
        {[["ossp","OSSP 목록"],["phases","단계 관리"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"7px 20px", borderRadius:8, fontSize:13, fontWeight:tab===id?700:400, background:tab===id?T.accent:"transparent", color:tab===id?"#fff":T.muted, border:"none", cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
        ))}
      </div>

      {tab==="ossp" && (
        <>
          <Card style={{ padding:24, marginBottom:20 }}>
            <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>{editingOssp?"OSSP 수정":"새 OSSP 등록"}</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <Input label="방법론 이름 *" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="예: 정보공학방법론" />
                <Input label="버전" value={form.version} onChange={v=>setForm(p=>({...p,version:v}))} placeholder="예: v2.0" />
              </div>
              <Input label="설명" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="예: 정보공학(IE) 기반 SI 프로젝트 개발 방법론" />
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={saveOssp} disabled={!form.name||loading}>{editingOssp?"수정 저장":"등록"}</Btn>
                {editingOssp && <Btn variant="ghost" onClick={()=>{ setEditingOssp(null); setForm({ name:'', version:'', description:'' }); }}>취소</Btn>}
              </div>
            </div>
          </Card>

          <Card style={{ padding:24 }}>
            <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>등록된 OSSP ({osspList.length}개)</h2>
            {osspList.length===0 ? (
              <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:13 }}>등록된 OSSP가 없습니다.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {osspList.map(item=>(
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:T.bg, borderRadius:10, border:`1px solid ${selectedOssp?.id===item.id?T.accent:T.border}`, cursor:"pointer" }}
                    onClick={()=>{ setSelectedOssp(item); setTab('phases'); }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{item.name} <span style={{ fontSize:12, color:T.muted }}>{item.version}</span></div>
                      <div style={{ fontSize:12, color:T.muted }}>{item.description}</div>
                    </div>
                    <div style={{ display:"flex", gap:6 }} onClick={e=>e.stopPropagation()}>
                      <Btn variant="outline" onClick={()=>{ setEditingOssp(item.id); setForm({ name:item.name, version:item.version||'', description:item.description||'' }); }} style={{ fontSize:11, padding:"5px 10px" }}>수정</Btn>
                      <Btn variant="ghost" onClick={()=>{ setSelectedOssp(item); setTab('phases'); }} style={{ fontSize:11, padding:"5px 10px" }}>단계관리</Btn>
                      <Btn variant="danger" onClick={()=>deleteOssp(item.id)} style={{ fontSize:11, padding:"5px 10px" }}>삭제</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab==="phases" && (
        <>
          {!selectedOssp ? (
            <Card style={{ padding:32, textAlign:"center" }}>
              <div style={{ color:T.muted, fontSize:13 }}>OSSP 목록에서 방법론을 선택하세요.</div>
              <Btn variant="ghost" onClick={()=>setTab('ossp')} style={{ marginTop:12 }}>← OSSP 목록으로</Btn>
            </Card>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                <Btn variant="ghost" onClick={()=>setTab('ossp')}>← 목록으로</Btn>
                <div>
                  <div style={{ fontSize:16, fontWeight:700 }}>{selectedOssp.name} {selectedOssp.version}</div>
                  <div style={{ fontSize:12, color:T.muted }}>단계 관리</div>
                </div>
              </div>

              <Card style={{ padding:24, marginBottom:20 }}>
                <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>단계 추가</h2>
                <div style={{ display:"flex", gap:14, alignItems:"flex-end" }}>
                  <div style={{ flex:"0 0 120px" }}><Input label="단계 코드" value={phaseForm.code} onChange={v=>setPhaseForm(p=>({...p,code:v}))} placeholder="예: 1000" /></div>
                  <div style={{ flex:1 }}><Input label="단계명 *" value={phaseForm.name} onChange={v=>setPhaseForm(p=>({...p,name:v}))} placeholder="예: 요구정의" /></div>
                  <Btn onClick={savePhase} disabled={!phaseForm.name||loading}>추가</Btn>
                </div>
              </Card>

              <Card style={{ padding:24 }}>
                <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>등록된 단계 ({phases.length}개)</h2>
                {phases.length===0 ? (
                  <div style={{ textAlign:"center", padding:"24px 0", color:T.muted, fontSize:13 }}>등록된 단계가 없습니다.</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {phases.map((ph,i)=>(
                      <div key={ph.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:11, color:T.muted, width:20, textAlign:"center" }}>{i+1}</span>
                        <span style={{ fontFamily:"monospace", fontSize:11, color:T.accent, background:T.accentDim, padding:"2px 8px", borderRadius:5 }}>{ph.code}</span>
                        <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{ph.name}</span>
                        <Btn variant="danger" onClick={()=>deletePhase(ph.id)} style={{ fontSize:11, padding:"5px 10px" }}>삭제</Btn>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── 파일 관리 ───────────────────────────────────────────────────
function FileManager({ token }) {
  const [osspList, setOsspList] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedOsspId, setSelectedOsspId] = useState('');
  const [category, setCategory] = useState('00.개요서');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const CATEGORIES = ['00.개요서','01.절차서','02.산출물템플릿','03.기법','04.체크리스트','05.테일러링가이드','06.산출물흐름도'];
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    fetch('/api/admin-data?table=ossp', { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setOsspList(d); });
  }, []);

  useEffect(() => {
    if (!selectedOsspId) return;
    fetch(`/api/admin-data?table=ossp_files&filter=ossp_id=eq.${selectedOsspId}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setFiles(d); });
  }, [selectedOsspId]);

  async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file || !selectedOsspId) return;
    setUploading(true);
    setUploadProgress('파일 업로드 중...');
    try {
      const filePath = `${selectedOsspId}/${category}/${file.name}`;
      // Supabase Storage에 직접 업로드
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/ossp-files/${filePath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY, 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('업로드 실패');
      setUploadProgress('DB에 파일 정보 저장 중...');
      // DB에 파일 정보 저장
      await fetch('/api/admin-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ action:'create', table:'ossp_files', data:{
          ossp_id: selectedOsspId, category, file_name: file.name,
          file_url: filePath, file_type: file.type, file_size: file.size,
        }}),
      });
      setUploadProgress('완료!');
      // 파일 목록 새로고침
      const updated = await fetch(`/api/admin-data?table=ossp_files&filter=ossp_id=eq.${selectedOsspId}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json());
      if (Array.isArray(updated)) setFiles(updated);
      e.target.value = '';
      setTimeout(() => setUploadProgress(''), 2000);
    } catch(err) {
      setUploadProgress('오류: ' + err.message);
    }
    setUploading(false);
  }

  async function deleteFile(file) {
    if (!confirm(`"${file.file_name}" 파일을 삭제하시겠습니까?`)) return;
    await fetch(`/api/admin-files?path=${file.file_url}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
    await fetch('/api/admin-data', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ action:'delete', table:'ossp_files', id:file.id }) });
    const updated = await fetch(`/api/admin-data?table=ossp_files&filter=ossp_id=eq.${selectedOsspId}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json());
    if (Array.isArray(updated)) setFiles(updated);
  }

  async function getSignedUrl(filePath) {
    const res = await fetch(`/api/admin-files?path=${filePath}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json());
    if (res.url) window.open(res.url, '_blank');
  }

  const filesByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = files.filter(f => f.category === cat);
    return acc;
  }, {});

  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>파일 관리</h1>
        <p style={{ color:T.muted, fontSize:13 }}>OSSP 방법론 관련 파일을 업로드하고 관리합니다.</p>
      </div>

      <Card style={{ padding:24, marginBottom:20 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>파일 업로드</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <label style={{ fontSize:11, color:T.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>OSSP 방법론 선택 *</label>
            <select value={selectedOsspId} onChange={e=>setSelectedOsspId(e.target.value)}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, padding:"9px 12px", color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }}>
              <option value="">선택하세요</option>
              {osspList.map(o=><option key={o.id} value={o.id}>{o.name} {o.version}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <label style={{ fontSize:11, color:T.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>카테고리 선택 *</label>
            <select value={category} onChange={e=>setCategory(e.target.value)}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, padding:"9px 12px", color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <label style={{ fontSize:11, color:T.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>파일 선택 *</label>
            <input type="file" onChange={uploadFile} disabled={!selectedOsspId||uploading}
              style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, padding:"9px 12px", color:T.text, fontSize:13, fontFamily:"inherit", cursor:"pointer" }} />
          </div>
          {uploadProgress && (
            <div style={{ padding:"10px 14px", background:uploadProgress.startsWith('오류')?T.red+"11":T.accentGlow, borderRadius:8, fontSize:13, color:uploadProgress.startsWith('오류')?T.red:T.accent }}>
              {uploadProgress}
            </div>
          )}
        </div>
      </Card>

      {selectedOsspId && (
        <Card style={{ padding:24 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>
            {osspList.find(o=>o.id===selectedOsspId)?.name} 파일 목록 ({files.length}개)
          </h2>
          {CATEGORIES.map(cat=>(
            filesByCategory[cat]?.length > 0 && (
              <div key={cat} style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:8, padding:"4px 10px", background:T.accentDim, borderRadius:6, display:"inline-block" }}>{cat}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {filesByCategory[cat].map(file=>(
                    <div key={file.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:T.bg, borderRadius:9, border:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:16 }}>{file.file_type?.includes('pdf')?'📄':file.file_type?.includes('word')||file.file_name?.endsWith('.docx')?'📝':'📊'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{file.file_name}</div>
                        <div style={{ fontSize:11, color:T.muted }}>{file.file_type} · {file.file_size ? (file.file_size/1024).toFixed(1)+'KB' : ''}</div>
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <Btn variant="outline" onClick={()=>getSignedUrl(file.file_url)} style={{ fontSize:11, padding:"4px 10px" }}>미리보기</Btn>
                        <Btn variant="danger" onClick={()=>deleteFile(file)} style={{ fontSize:11, padding:"4px 10px" }}>삭제</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
          {files.length===0 && (
            <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:13 }}>업로드된 파일이 없습니다.</div>
          )}
        </Card>
      )}
    </div>
  );
}
