import { useState, useEffect } from "react";

const T = {
  bg: "#0A0C10", surface: "#111318", border: "#1E2230",
  accent: "#4F8EF7", accentDim: "#1E3A6E", accentGlow: "rgba(79,142,247,0.18)",
  green: "#2DD4A0", amber: "#F5A623", red: "#FF5B5B",
  text: "#E8EAF0", muted: "#6B7280", subtle: "#1C2030",
};

function Badge({ color = T.accent, children }) {
  return <span style={{ background: color+"22", color, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>{children}</span>;
}

function Card({ children, style={}, onClick, hover=false }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:T.surface, border:`1px solid ${hov&&hover?T.accent+"66":T.border}`, borderRadius:14,
        transition:"border-color .2s, box-shadow .2s", boxShadow:hov&&hover?`0 0 24px ${T.accentGlow}`:"none",
        cursor:onClick?"pointer":"default", ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, variant="primary", onClick, style={}, disabled=false }) {
  const [hov, setHov] = useState(false);
  const base = { primary:{bg:T.accent,color:"#fff",border:T.accent}, ghost:{bg:"transparent",color:T.muted,border:T.border}, outline:{bg:"transparent",color:T.accent,border:T.accent}, danger:{bg:T.red,color:"#fff",border:T.red} }[variant];
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:hov?(variant==="ghost"?T.subtle:base.bg):(variant==="primary"||variant==="danger"?base.bg:"transparent"),
        color:variant==="ghost"&&hov?T.text:base.color, border:`1px solid ${base.border}`, borderRadius:10,
        padding:"8px 16px", fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?0.4:1, transition:"all .15s", fontFamily:"inherit", letterSpacing:0.3, ...style }}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type="text", style={} }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label style={{ fontSize:12, color:T.muted, fontWeight:600, letterSpacing:0.8, textTransform:"uppercase" }}>{label}</label>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", color:T.text, fontSize:14, fontFamily:"inherit", outline:"none", ...style }} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label style={{ fontSize:12, color:T.muted, fontWeight:600, letterSpacing:0.8, textTransform:"uppercase" }}>{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", color:T.text, fontSize:14, fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Spinner({ text="AI 생성 중…" }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, color:T.muted, fontSize:13 }}>
      <div style={{ width:18, height:18, border:`2px solid ${T.border}`, borderTop:`2px solid ${T.accent}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />
      {text}
    </div>
  );
}

const OSSP_OPTIONS = [
  { id:"waterfall", label:"Waterfall", desc:"전통적 순차 개발", phases:["요구분석","설계","구현","테스트","배포","유지보수"] },
  { id:"agile", label:"Agile/Scrum", desc:"반복·점진적 개발", phases:["스프린트 계획","백로그 관리","개발","리뷰","회고","릴리즈"] },
  { id:"devops", label:"DevOps", desc:"지속적 통합·배포", phases:["계획","코딩","빌드","테스트","배포","운영","모니터링"] },
];

const TAILORING_RULES = [
  { id:"doc_level", label:"문서화 수준", options:["최소","표준","상세"] },
  { id:"review_cycle", label:"리뷰 주기", options:["주간","격주","월간"] },
  { id:"test_level", label:"테스트 수준", options:["단위","통합","전체"] },
  { id:"risk", label:"위험 관리", options:["기본","강화","최고"] },
];

export default function ProGenesis() {
  const [page, setPage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [projectForm, setProjectForm] = useState({ name:"", client:"", type:"신규개발", startDate:"", endDate:"", pm:"" });
  const [selectedOSSP, setSelectedOSSP] = useState(null);
  const [customOSSP, setCustomOSSP] = useState([]);
  const [sdlcFactors, setSdlcFactors] = useState({ req_clarity:"보통", req_volatility:"보통", delivery:"단계적", risk:"보통", regulation:"보통", team:"집중" });
  const [selectedSDLC, setSelectedSDLC] = useState(null);
  const [sdlcRecommendation, setSdlcRecommendation] = useState(null);  // { recommended, reason, alternatives }
  const [recommending, setRecommending] = useState(false);
  const [tailoring, setTailoring] = useState({ doc_level:"표준", review_cycle:"격주", test_level:"통합", risk:"강화" });
  const [pdpData, setPdpData] = useState(null);
  const [wbsData, setWbsData] = useState(null);
  const [deliverablesData, setDeliverablesData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const nav = (p) => { setPage(p); setGenError(null); setMenuOpen(false); };

  useEffect(() => { fetchProjects(); fetchOSSP(); }, []);

  async function fetchOSSP() {
    try {
      const res = await fetch('/api/ossp');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomOSSP(data.map(o => ({
          id: o.id,
          label: o.name,                 // UI는 label 사용 → DB의 name 매핑
          version: o.version || '',
          desc: o.description || '',
          phases: Array.isArray(o.phases) ? o.phases : [],
          custom: true,
        })));
      }
    } catch (e) { console.error(e); }
  }

  async function addOSSP({ name, version, description, phases }) {
    const res = await fetch('/api/ossp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, version, description, phases }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '등록에 실패했습니다.');
    }
    const created = await res.json();
    await fetchOSSP();
    return created;   // 생성된 OSSP(id 포함) 반환 → 파일 업로드에 사용
  }

  async function deleteOSSP(id) {
    await fetch(`/api/ossp?id=${id}`, { method: 'DELETE' });
    await fetchOSSP();
  }

  async function fetchProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data.map(p => ({
          id:p.id, name:p.name, client:p.client, type:p.type,
          startDate:p.start_date, endDate:p.end_date, pm:p.pm, status:p.status,
          ossp:p.ossp, tailoring:p.tailoring, pdp:p.pdp, wbs:p.wbs, deliverables:p.deliverables,
          createdAt:new Date(p.created_at).toLocaleDateString("ko-KR"),
        })));
      }
    } catch(e) { console.error(e); }
    setLoadingProjects(false);
  }

  async function callClaude(prompt) {
  const res = await fetch("/api/chat", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ model:"claude-opus-4-8", max_tokens:4000,
      system:"You are a project management expert. Always respond with valid JSON only, no markdown, no preamble.",
      messages:[{ role:"user", content:prompt }] }),
  });

  const data = await res.json();

  // 에러 응답 방어: Anthropic/서버가 에러를 주면 content가 없음
  if (!res.ok || data.error || !data.content) {
    const msg = data?.detail?.error?.message || data?.error?.message || data?.error || `요청 실패 (status ${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const text = data.content?.map(b=>b.text||"").join("")||"";
  if (!text.trim()) throw new Error("AI 응답이 비어 있습니다.");

  return JSON.parse(text.replace(/```json|```/g,"").trim());
  }
  
  async function recommendSDLC() {
    setRecommending(true); setGenError(null); setSdlcRecommendation(null);
    try {
      const result = await callClaude(`당신은 PMBOK 8판에 정통한 프로젝트 관리 전문가입니다. 아래 프로젝트 특성에 맞는 SDLC(소프트웨어 개발 생애주기) 모델을 추천하세요.
프로젝트 유형: ${projectForm.type}
요구사항 명확성: ${sdlcFactors.req_clarity}
요구사항 변동성: ${sdlcFactors.req_volatility}
인도(딜리버리) 방식: ${sdlcFactors.delivery}
리스크 수준: ${sdlcFactors.risk}
규제/컴플라이언스: ${sdlcFactors.regulation}
팀 구성: ${sdlcFactors.team}
후보 모델: Waterfall(폭포수), V-Model, Iterative(반복형), Incremental(점진형), Spiral(나선형), Agile/Scrum, DevOps
PMBOK의 예측형↔적응형 스펙트럼과 요구 변동성·인도 빈도·리스크·규제·팀 분산도를 근거로 판단하세요.
JSON만 출력: {"recommended":{"id":"string(영문 소문자, 예: waterfall)","label":"string","approach":"예측형|적응형|하이브리드"},"reason":"string(한국어 2~3문장, PMBOK 요인 근거 명시)","alternatives":[{"id":"string","label":"string","note":"string(언제 이 대안이 더 나은지 한국어 1문장)"}]}`);
      setSdlcRecommendation(result);
      if (result?.recommended) setSelectedSDLC(result.recommended);
    } catch(e) { setGenError("SDLC 추천 실패: "+e.message); }
    setRecommending(false);
  }

  async function generatePDP() {
    setGenerating(true); setGenError(null); setPdpData(null);
    try {
      const result = await callClaude(`프로젝트명: ${projectForm.name}, 고객사: ${projectForm.client}, 유형: ${projectForm.type}, SDLC: ${selectedSDLC?.label||"미지정"}, OSSP: ${selectedOSSP?.label}, 기간: ${projectForm.startDate}~${projectForm.endDate}, PM: ${projectForm.pm}, 테일러링: ${JSON.stringify(tailoring)}
PDP JSON: {"overview":{"purpose":"string","scope":"string","objectives":["string"]},"organization":{"pm":"string","roles":[{"role":"string","name":"string","responsibility":"string"}]},"schedule":{"phases":[{"phase":"string","start":"YYYY-MM-DD","end":"YYYY-MM-DD","deliverable":"string"}]},"risks":[{"id":"string","description":"string","level":"상|중|하","mitigation":"string"}],"quality":{"metrics":[{"metric":"string","target":"string"}]}}`);
      setPdpData(result);
    } catch(e) { setGenError("PDP 생성 실패: "+e.message); }
    setGenerating(false);
  }

  async function generateWBS() {
    setGenerating(true); setGenError(null); setWbsData(null);
    try {
      const result = await callClaude(`프로젝트: ${projectForm.name}, OSSP: ${selectedOSSP?.label}(${selectedOSSP?.phases?.join(",")}), 기간: ${projectForm.startDate}~${projectForm.endDate}
WBS JSON(5~7 phase, 각 3~5 subtask): {"tasks":[{"id":"string","wbsCode":"string","phase":"string","subtasks":[{"id":"string","wbsCode":"string","task":"string","duration":"string","assignee":"string","status":"대기|진행|완료"}],"duration":"string"}]}`);
      setWbsData(result);
    } catch(e) { setGenError("WBS 생성 실패: "+e.message); }
    setGenerating(false);
  }

  async function generateDeliverables() {
    setGenerating(true); setGenError(null); setDeliverablesData(null);
    try {
      const result = await callClaude(`SI 착수/계획 산출물 패키지 JSON. 프로젝트: ${projectForm.name}, OSSP: ${selectedOSSP?.label}, 테일러링: ${JSON.stringify(tailoring)}
{"categories":[{"id":"string","name":"string","icon":"이모지","documents":[{"id":"string","name":"string","code":"string","purpose":"string","template":"목차1;목차2;목차3","priority":"필수|권장|선택","estimatedPages":5,"owner":"string"}]}],"summary":{"totalDocs":15,"mandatoryCount":10,"estimatedDays":14}}
4개 카테고리: 착수문서(🚀), 계획문서(📋), 기술문서(🔧), 품질/위험문서(🛡). 각 3~5개 문서.`);
      setDeliverablesData(result);
    } catch(e) { setGenError("산출물 생성 실패: "+e.message); }
    setGenerating(false);
  }

  async function finishProject() {
    const newProject = {
      name:projectForm.name, client:projectForm.client, type:projectForm.type,
      start_date:projectForm.startDate, end_date:projectForm.endDate, pm:projectForm.pm,
      status:"진행중", ossp:selectedOSSP,
      // sdlc 전용 컬럼 없이 tailoring(JSON)에 함께 보존 → DB 스키마 변경 불필요
      tailoring:{ ...tailoring, sdlc:selectedSDLC, sdlc_factors:sdlcFactors },
      pdp:pdpData, wbs:wbsData, deliverables:deliverablesData,
    };
    try {
      await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newProject) });
      await fetchProjects();
    } catch(e) { console.error(e); }
    setWizardStep(0); setProjectForm({ name:"",client:"",type:"신규개발",startDate:"",endDate:"",pm:"" });
    setSelectedOSSP(null); setTailoring({ doc_level:"표준",review_cycle:"격주",test_level:"통합",risk:"강화" });
    setSelectedSDLC(null); setSdlcRecommendation(null);
    setSdlcFactors({ req_clarity:"보통", req_volatility:"보통", delivery:"단계적", risk:"보통", regulation:"보통", team:"집중" });
    setPdpData(null); setWbsData(null); setDeliverablesData(null);
    nav("dashboard");
  }

  async function deleteProject(id) {
    await fetch(`/api/projects?id=${id}`, { method:'DELETE' });
    await fetchProjects();
    nav("dashboard");
  }

  const pages = {
    dashboard: <Dashboard projects={projects} loading={loadingProjects} nav={nav} setCurrentProject={setCurrentProject} />,
    new_project: <NewProjectWizard step={wizardStep} setStep={setWizardStep} form={projectForm} setForm={setProjectForm}
      selectedOSSP={selectedOSSP} setSelectedOSSP={setSelectedOSSP} tailoring={tailoring} setTailoring={setTailoring}
      pdpData={pdpData} wbsData={wbsData} deliverablesData={deliverablesData} generating={generating} genError={genError}
      onGeneratePDP={generatePDP} onGenerateWBS={generateWBS} onGenerateDeliverables={generateDeliverables}
      onFinish={finishProject} nav={nav} customOSSP={customOSSP}
      sdlcFactors={sdlcFactors} setSdlcFactors={setSdlcFactors}
      selectedSDLC={selectedSDLC} setSelectedSDLC={setSelectedSDLC}
      sdlcRecommendation={sdlcRecommendation} recommending={recommending} onRecommendSDLC={recommendSDLC} />,
    project_detail: <ProjectDetail project={currentProject} nav={nav} onDelete={deleteProject} />,
    ossp: <OSSPPage nav={nav} customOSSP={customOSSP} onAdd={addOSSP} onDelete={deleteOSSP} />,
  };

  const navItems = [{id:"dashboard",icon:"⊞",label:"대시보드"},{id:"new_project",icon:"+",label:"새 프로젝트"},{id:"ossp",icon:"◈",label:"OSSP 라이브러리"}];

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Sans','Apple SD Gothic Neo',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:${T.bg}} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        input,select{color-scheme:dark} input::placeholder{color:${T.muted}} button:focus{outline:none}
        @media(min-width:768px){ .layout{ flex-direction:row !important; } .sidebar{ display:flex !important; } .mobile-header{ display:none !important; } .main-content{ padding:32px 40px !important; } }
      `}</style>

      {/* 모바일 헤더 */}
      <div className="mobile-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:T.surface, borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:`linear-gradient(135deg,${T.accent},#7C3AED)`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#fff" }}>P</div>
          <div style={{ fontSize:14, fontWeight:700 }}>ProGenesis</div>
        </div>
        <button onClick={()=>setMenuOpen(!menuOpen)} style={{ background:"none", border:"none", color:T.text, fontSize:22, cursor:"pointer", padding:"4px 8px" }}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"8px 12px", zIndex:99 }}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>nav(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:page===item.id?T.accentGlow:"transparent", color:page===item.id?T.accent:T.muted, border:"none", cursor:"pointer", fontSize:14, fontWeight:page===item.id?600:400, fontFamily:"inherit", width:"100%", marginBottom:4 }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
          <div style={{ padding:"10px 12px", borderTop:`1px solid ${T.border}`, marginTop:4, fontSize:12, color:T.muted }}>
            전체 프로젝트 <span style={{ color:T.accent, fontWeight:700 }}>{projects.length}건</span>
          </div>
        </div>
      )}

      <div className="layout" style={{ display:"flex", flex:1 }}>
        {/* PC 사이드바 */}
        <aside className="sidebar" style={{ display:"none", width:220, background:T.surface, borderRight:`1px solid ${T.border}`, flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
          <div style={{ padding:"0 20px 24px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, background:`linear-gradient(135deg,${T.accent},#7C3AED)`, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:800, color:"#fff" }}>P</div>
              <div><div style={{ fontSize:15, fontWeight:700, letterSpacing:-0.3 }}>ProGenesis</div><div style={{ fontSize:10, color:T.muted }}>v2.1 · AI Platform</div></div>
            </div>
          </div>
          <nav style={{ padding:"14px 10px", flex:1, display:"flex", flexDirection:"column", gap:2 }}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>nav(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:10, background:page===item.id?T.accentGlow:"transparent", color:page===item.id?T.accent:T.muted, border:page===item.id?`1px solid ${T.accentDim}`:"1px solid transparent", cursor:"pointer", fontSize:13, fontWeight:page===item.id?600:400, fontFamily:"inherit", transition:"all .15s", textAlign:"left", width:"100%" }}>
                <span style={{ fontSize:15 }}>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>전체 프로젝트</div>
            <div style={{ fontSize:24, fontWeight:700 }}>{projects.length}<span style={{ fontSize:13, color:T.muted, fontWeight:400 }}> 건</span></div>
          </div>
        </aside>

        <main style={{ flex:1, overflow:"auto", animation:"fadeIn .3s ease" }}>
          {pages[page]||pages.dashboard}
        </main>
      </div>
    </div>
  );
}

function Dashboard({ projects, loading, nav, setCurrentProject }) {
  const stats = [
    { label:"전체 프로젝트", value:projects.length, color:T.accent },
    { label:"PDP 생성", value:projects.filter(p=>p.pdp).length, color:T.green },
    { label:"WBS 생성", value:projects.filter(p=>p.wbs).length, color:T.amber },
    { label:"초기 산출물", value:projects.filter(p=>p.deliverables).length, color:"#C084FC" },
  ];
  return (
    <div style={{ padding:"20px 16px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:-0.5, marginBottom:4 }}>프로젝트 착수 자동화 플랫폼</h1>
        <p style={{ color:T.muted, fontSize:12 }}>OSSP 테일러링 → PDP → WBS → 착수 산출물까지 AI로 완성</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:20 }}>
        {stats.map(s=><Card key={s.label} style={{ padding:"14px 16px" }}><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{s.label}</div><div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div></Card>)}
      </div>
      <Card style={{ padding:18, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:600 }}>프로젝트 목록</h2>
          <Btn onClick={()=>nav("new_project")} style={{ fontSize:12, padding:"6px 12px" }}>+ 새 프로젝트</Btn>
        </div>
        {loading ? (
          <div style={{ textAlign:"center", padding:"32px 0" }}><Spinner text="프로젝트 불러오는 중…" /></div>
        ) : projects.length===0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:T.muted }}>
            <div style={{ fontSize:28, marginBottom:8 }}>◈</div>
            <div style={{ fontSize:13, marginBottom:14 }}>아직 등록된 프로젝트가 없습니다.</div>
            <Btn onClick={()=>nav("new_project")}>첫 프로젝트 시작하기</Btn>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {projects.map(p=>(
              <div key={p.id} onClick={()=>{ setCurrentProject(p); nav("project_detail"); }}
                style={{ padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}`, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{p.name}</div>
                  <Badge color={T.accent}>{p.status}</Badge>
                </div>
                <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>{p.client} · {p.ossp?.label} · {p.createdAt}</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {p.pdp && <Badge color={T.green}>PDP</Badge>}
                  {p.wbs && <Badge color={T.amber}>WBS</Badge>}
                  {p.deliverables && <Badge color="#C084FC">산출물</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card style={{ padding:18 }}>
        <h2 style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>추천 시작 흐름</h2>
        {["프로젝트 기본정보 입력","OSSP 선택 & 테일러링","PDP 자동 생성 (AI)","WBS 자동 생성 (AI)","착수/계획 산출물 생성 (AI)","프로젝트 착수 완료"].map((s,i)=>(
          <div key={s} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:T.accentDim, color:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</div>
            <div style={{ fontSize:12, color:T.muted, lineHeight:1.5 }}>{s}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function NewProjectWizard({ step, setStep, form, setForm, selectedOSSP, setSelectedOSSP, tailoring, setTailoring, pdpData, wbsData, deliverablesData, generating, genError, onGeneratePDP, onGenerateWBS, onGenerateDeliverables, onFinish, nav, customOSSP, sdlcFactors, setSdlcFactors, selectedSDLC, setSelectedSDLC, sdlcRecommendation, recommending, onRecommendSDLC }) {
  const steps = ["기본정보","SDLC","OSSP","테일러링","PDP","WBS","산출물","완료"];
  const canNext = [
    form.name&&form.client&&form.startDate&&form.endDate&&form.pm,  // 0 기본정보
    !!selectedSDLC,                                                  // 1 SDLC
    !!selectedOSSP,                                                  // 2 OSSP
    true,                                                           // 3 테일러링
    !!pdpData,                                                      // 4 PDP
    !!wbsData,                                                      // 5 WBS
    !!deliverablesData,                                             // 6 산출물
    true,                                                           // 7 완료
  ];
  return (
    <div style={{ padding:"16px", maxWidth:960, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div><h1 style={{ fontSize:17, fontWeight:700 }}>새 프로젝트 생성</h1><p style={{ fontSize:11, color:T.muted }}>STEP {step+1}/{steps.length} — {steps[step]}</p></div>
      </div>
      {/* 진행 표시 */}
      <div style={{ display:"flex", gap:0, marginBottom:24, position:"relative" }}>
        <div style={{ position:"absolute", top:11, left:11, right:11, height:2, background:T.border, zIndex:0 }} />
        <div style={{ position:"absolute", top:11, left:11, height:2, background:T.accent, zIndex:1, transition:"width .4s", width:`${(step/(steps.length-1))*(100-20/steps.length)}%` }} />
        {steps.map((s,i)=>(
          <div key={s} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, position:"relative", zIndex:2 }}>
            <div style={{ width:22, height:22, borderRadius:"50%", background:i<step?T.accent:i===step?T.accent:T.surface, border:`2px solid ${i<=step?T.accent:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:i<=step?"#fff":T.muted }}>{i<step?"✓":i+1}</div>
            <span style={{ fontSize:9, color:i===step?T.accent:T.muted, fontWeight:i===step?600:400, textAlign:"center" }}>{s}</span>
          </div>
        ))}
      </div>
      <Card style={{ padding:20, minHeight:300, marginBottom:16 }}>
        {step===0 && <StepInfo form={form} setForm={setForm} />}
        {step===1 && <StepSDLC factors={sdlcFactors} setFactors={setSdlcFactors} selected={selectedSDLC} setSelected={setSelectedSDLC} recommendation={sdlcRecommendation} recommending={recommending} genError={genError} onRecommend={onRecommendSDLC} />}
        {step===2 && <StepOSSP selected={selectedOSSP} setSelected={setSelectedOSSP} customOSSP={customOSSP} sdlc={selectedSDLC} />}
        {step===3 && <StepTailoring tailoring={tailoring} setTailoring={setTailoring} ossp={selectedOSSP} />}
        {step===4 && <StepPDP pdpData={pdpData} generating={generating} genError={genError} onGenerate={onGeneratePDP} />}
        {step===5 && <StepWBS wbsData={wbsData} generating={generating} genError={genError} onGenerate={onGenerateWBS} />}
        {step===6 && <StepDeliverables deliverablesData={deliverablesData} generating={generating} genError={genError} onGenerate={onGenerateDeliverables} />}
        {step===7 && <StepReview form={form} sdlc={selectedSDLC} ossp={selectedOSSP} pdpData={pdpData} wbsData={wbsData} deliverablesData={deliverablesData} />}
      </Card>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <Btn variant="ghost" onClick={()=>step>0?setStep(s=>s-1):nav("dashboard")}>← 이전</Btn>
        {step<steps.length-1 ? <Btn disabled={!canNext[step]} onClick={()=>setStep(s=>s+1)}>다음 →</Btn> : <Btn onClick={onFinish}>✓ 완료</Btn>}
      </div>
    </div>
  );
}

function StepInfo({ form, setForm }) {
  const f = k => v => setForm(p=>({...p,[k]:v}));
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>프로젝트 기본 정보</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <Input label="프로젝트명 *" value={form.name} onChange={f("name")} placeholder="예: 스마트팩토리 MES 고도화" />
        <Input label="고객사 *" value={form.client} onChange={f("client")} placeholder="예: (주)한국제조" />
        <Select label="프로젝트 유형" value={form.type} onChange={f("type")} options={["신규개발","고도화","유지보수","컨설팅"].map(v=>({value:v,label:v}))} />
        <Input label="PM *" value={form.pm} onChange={f("pm")} placeholder="예: 홍길동" />
        <Input label="시작일 *" type="date" value={form.startDate} onChange={f("startDate")} />
        <Input label="종료일 *" type="date" value={form.endDate} onChange={f("endDate")} />
      </div>
    </div>
  );
}

// SDLC 모델 목록 (구체 모델 수준)
const SDLC_MODELS = [
  { id:"waterfall",   label:"Waterfall (폭포수)",   approach:"예측형",   desc:"요구가 명확하고 변동이 적은 순차 개발" },
  { id:"v-model",     label:"V-Model (검증형)",      approach:"예측형",   desc:"단계별 검증·확인을 중시(규제·안전 중요)" },
  { id:"iterative",   label:"Iterative (반복형)",    approach:"하이브리드", desc:"핵심부터 만들고 반복 보완" },
  { id:"incremental", label:"Incremental (점진형)",  approach:"하이브리드", desc:"기능 묶음을 점진적으로 인도" },
  { id:"spiral",      label:"Spiral (나선형)",       approach:"하이브리드", desc:"리스크가 큰 대형/불확실 프로젝트" },
  { id:"agile",       label:"Agile/Scrum",          approach:"적응형",   desc:"요구 변동이 크고 잦은 인도가 필요" },
  { id:"devops",      label:"DevOps",               approach:"적응형",   desc:"지속적 통합·배포·운영 자동화" },
];

const SDLC_FACTORS = [
  { id:"req_clarity",    label:"요구사항 명확성",   options:["낮음","보통","높음"] },
  { id:"req_volatility", label:"요구사항 변동성",   options:["낮음","보통","높음"] },
  { id:"delivery",       label:"인도 방식",         options:["일괄","단계적","빈번"] },
  { id:"risk",           label:"리스크 수준",       options:["낮음","보통","높음"] },
  { id:"regulation",     label:"규제/컴플라이언스", options:["없음","보통","엄격"] },
  { id:"team",           label:"팀 구성",           options:["집중","혼합","분산"] },
];

function StepSDLC({ factors, setFactors, selected, setSelected, recommendation, recommending, genError, onRecommend }) {
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>SDLC(개발 생애주기) 선택</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:16 }}>프로젝트 특성을 입력하면 PMBOK 기준으로 적합한 모델을 추천합니다. 최종 선택은 직접 확정하세요.</p>

      {/* 프로젝트 특성 입력 */}
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:16 }}>
        {SDLC_FACTORS.map(f=>(
          <div key={f.id}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>{f.label}</div>
            <div style={{ display:"flex", gap:8 }}>
              {f.options.map(opt=>(
                <button key={opt} onClick={()=>setFactors(s=>({...s,[f.id]:opt}))}
                  style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:12, fontFamily:"inherit",
                    background:factors[f.id]===opt?T.accent:T.bg, color:factors[f.id]===opt?"#fff":T.muted,
                    border:`1px solid ${factors[f.id]===opt?T.accent:T.border}`, cursor:"pointer",
                    fontWeight:factors[f.id]===opt?600:400 }}>{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:16 }}>
        <Btn onClick={onRecommend} disabled={recommending} style={{ fontSize:12, padding:"8px 14px" }}>
          {recommending ? "분석 중…" : "⚡ AI 추천 받기"}
        </Btn>
      </div>
      {recommending && <Spinner text="PMBOK 기준으로 분석 중…" />}
      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9, marginBottom:12 }}>{genError}</div>}

      {/* 추천 근거 */}
      {recommendation?.recommended && (
        <div style={{ marginBottom:16, animation:"fadeIn .4s" }}>
          <Card style={{ padding:14, background:T.bg, border:`1px solid ${T.accent}55` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <Badge color={T.green}>AI 추천</Badge>
              <span style={{ fontWeight:700, fontSize:14 }}>{recommendation.recommended.label}</span>
              {recommendation.recommended.approach && <Badge color={T.accent}>{recommendation.recommended.approach}</Badge>}
            </div>
            <div style={{ fontSize:12, color:T.text, lineHeight:1.7 }}>{recommendation.reason}</div>
            {recommendation.alternatives?.length > 0 && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:6 }}>대안</div>
                {recommendation.alternatives.map((a,i)=>(
                  <div key={i} style={{ fontSize:11, color:T.muted, marginBottom:4 }}>
                    <span style={{ color:T.accent, fontWeight:600 }}>{a.label}</span> — {a.note}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 최종 모델 선택 (사용자 확정) */}
      <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginBottom:8 }}>SDLC 모델 확정</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        {SDLC_MODELS.map(m=>{
          const isRec = recommendation?.recommended?.id === m.id;
          const isSel = selected?.id === m.id;
          return (
            <div key={m.id} onClick={()=>setSelected(m)}
              style={{ padding:"12px 14px", borderRadius:10, cursor:"pointer", transition:"all .15s",
                border:`2px solid ${isSel?T.accent:T.border}`, background:isSel?T.accentGlow:T.bg }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3, flexWrap:"wrap" }}>
                <span style={{ fontWeight:700, fontSize:13, color:isSel?T.accent:T.text }}>{m.label}</span>
                {isRec && <Badge color={T.green}>추천</Badge>}
              </div>
              <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{m.desc}</div>
              <Badge color={isSel?T.accent:T.muted}>{m.approach}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepOSSP({ selected, setSelected, customOSSP=[], sdlc }) {
  // SDLC와 같은 접근(또는 같은 모델 id)을 가진 OSSP를 상단으로 정렬
  const base = [...OSSP_OPTIONS, ...customOSSP];
  const matchesSDLC = (o) => sdlc && (o.id === sdlc.id || (o.approach && o.approach === sdlc.approach));
  const options = [...base].sort((a,b)=> (matchesSDLC(b)?1:0) - (matchesSDLC(a)?1:0));
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>OSSP 방법론 선택</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:12 }}>프로젝트에 적합한 개발 방법론을 선택하세요.</p>
      {sdlc && (
        <div style={{ fontSize:11, color:T.muted, marginBottom:16, padding:"8px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8 }}>
          선택한 SDLC: <span style={{ color:T.accent, fontWeight:600 }}>{sdlc.label}</span>
          {sdlc.approach && <span> ({sdlc.approach})</span>} — 이 방식에 어울리는 OSSP를 위쪽에 정렬했습니다.
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {options.map(o=>(
          <div key={o.id} onClick={()=>setSelected(o)} style={{ padding:16, borderRadius:12, border:`2px solid ${selected?.id===o.id?T.accent:T.border}`, background:selected?.id===o.id?T.accentGlow:T.bg, cursor:"pointer", transition:"all .2s" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontWeight:700, fontSize:14, color:selected?.id===o.id?T.accent:T.text }}>{o.label}</span>
              {o.custom && <Badge color={T.green}>사내</Badge>}
              {matchesSDLC(o) && <Badge color={T.amber}>SDLC 적합</Badge>}
            </div>
            <div style={{ fontSize:11, color:T.muted, marginBottom:10 }}>{o.desc}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>{o.phases.map(ph=><Badge key={ph} color={selected?.id===o.id?T.accent:T.muted}>{ph}</Badge>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepTailoring({ tailoring, setTailoring, ossp }) {
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>OSSP 테일러링</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:16 }}>선택: <span style={{ color:T.accent, fontWeight:600 }}>{ossp?.label}</span></p>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {TAILORING_RULES.map(rule=>(
          <div key={rule.id}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>{rule.label}</div>
            <div style={{ display:"flex", gap:8 }}>
              {rule.options.map(opt=>(
                <button key={opt} onClick={()=>setTailoring(t=>({...t,[rule.id]:opt}))} style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontFamily:"inherit", background:tailoring[rule.id]===opt?T.accent:T.bg, color:tailoring[rule.id]===opt?"#fff":T.muted, border:`1px solid ${tailoring[rule.id]===opt?T.accent:T.border}`, cursor:"pointer", transition:"all .15s", fontWeight:tailoring[rule.id]===opt?600:400 }}>{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPDP({ pdpData, generating, genError, onGenerate }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>PDP 자동 생성</h2><p style={{ fontSize:11, color:T.muted }}>AI가 프로젝트 개발 계획서를 작성합니다.</p></div>
        {!pdpData && <Btn onClick={onGenerate} disabled={generating} style={{ fontSize:12, padding:"7px 12px" }}>⚡ AI 생성</Btn>}
      </div>
      {generating && <Spinner />}
      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9 }}>{genError}</div>}
      {pdpData && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"fadeIn .4s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <Badge color={T.green}>✓ PDP 생성 완료</Badge>
            <Btn variant="outline" onClick={onGenerate} style={{ fontSize:11, padding:"4px 10px" }}>재생성</Btn>
          </div>
          <Card style={{ padding:14, background:T.bg }}><div style={{ fontSize:11, color:T.muted, marginBottom:4, fontWeight:600 }}>목적</div><div style={{ fontSize:12, color:T.text, lineHeight:1.7 }}>{pdpData.overview?.purpose}</div></Card>
          <Card style={{ padding:14, background:T.bg }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:8, fontWeight:600 }}>일정 단계</div>
            {pdpData.schedule?.phases?.map((ph,i)=><div key={i} style={{ fontSize:11, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}><span style={{ color:T.accent, marginRight:6 }}>■</span>{ph.phase} <span style={{ color:T.muted }}>({ph.start?.slice(5)}~{ph.end?.slice(5)})</span></div>)}
          </Card>
        </div>
      )}
    </div>
  );
}

function StepWBS({ wbsData, generating, genError, onGenerate }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>WBS 자동 생성</h2><p style={{ fontSize:11, color:T.muted }}>AI가 작업 분류 구조를 생성합니다.</p></div>
        {!wbsData && <Btn onClick={onGenerate} disabled={generating} style={{ fontSize:12, padding:"7px 12px" }}>⚡ AI 생성</Btn>}
      </div>
      {generating && <Spinner />}
      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9 }}>{genError}</div>}
      {wbsData && (
        <div style={{ animation:"fadeIn .4s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <Badge color={T.green}>✓ WBS 생성 완료</Badge>
            <Btn variant="outline" onClick={onGenerate} style={{ fontSize:11, padding:"4px 10px" }}>재생성</Btn>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflow:"auto" }}>
            {wbsData.tasks?.map(t=>(
              <Card key={t.id} style={{ padding:12, background:T.bg }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:10, color:T.accent, fontFamily:"monospace", background:T.accentDim, padding:"2px 6px", borderRadius:4 }}>{t.wbsCode}</span>
                  <span style={{ fontWeight:600, fontSize:13 }}>{t.phase}</span>
                  <span style={{ fontSize:11, color:T.muted, marginLeft:"auto" }}>{t.duration}</span>
                </div>
                {t.subtasks?.map(s=><div key={s.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 8px", background:T.surface, borderRadius:6, fontSize:11, marginBottom:3 }}><span style={{ color:T.muted, fontFamily:"monospace", fontSize:9 }}>{s.wbsCode}</span><span style={{ flex:1 }}>{s.task}</span><Badge color={s.status==="완료"?T.green:s.status==="진행"?T.amber:T.muted}>{s.status}</Badge></div>)}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepDeliverables({ deliverablesData, generating, genError, onGenerate }) {
  const [expandedCat, setExpandedCat] = useState(null);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>착수 산출물 자동생성</h2><p style={{ fontSize:11, color:T.muted }}>AI가 초기 문서 패키지를 구성합니다.</p></div>
        {!deliverablesData && <Btn onClick={onGenerate} disabled={generating} style={{ fontSize:12, padding:"7px 12px" }}>⚡ AI 생성</Btn>}
      </div>
      {generating && <Spinner />}
      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9 }}>{genError}</div>}
      {deliverablesData && (
        <div style={{ animation:"fadeIn .4s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <Badge color={T.green}>✓ 산출물 생성 완료</Badge>
            <Btn variant="outline" onClick={onGenerate} style={{ fontSize:11, padding:"4px 10px" }}>재생성</Btn>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {[{label:"전체",value:deliverablesData.summary?.totalDocs,color:T.accent},{label:"필수",value:deliverablesData.summary?.mandatoryCount,color:T.red},{label:"소요일",value:deliverablesData.summary?.estimatedDays+"일",color:T.amber}].map(s=>(
              <div key={s.label} style={{ flex:1, padding:"8px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, textAlign:"center" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:240, overflow:"auto" }}>
            {deliverablesData.categories?.map(cat=>(
              <div key={cat.id} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
                <div onClick={()=>setExpandedCat(expandedCat===cat.id?null:cat.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", cursor:"pointer" }}>
                  <span>{cat.icon}</span>
                  <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{cat.name}</span>
                  <span style={{ fontSize:11, color:T.muted }}>{cat.documents?.length}건 {expandedCat===cat.id?"▲":"▼"}</span>
                </div>
                {expandedCat===cat.id && cat.documents?.map(doc=>(
                  <div key={doc.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px", borderTop:`1px solid ${T.border}` }}>
                    <span style={{ fontFamily:"monospace", fontSize:9, color:T.accent, background:T.accentDim, padding:"2px 5px", borderRadius:4, flexShrink:0, marginTop:2 }}>{doc.code}</span>
                    <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600 }}>{doc.name}</div><div style={{ fontSize:10, color:T.muted }}>{doc.purpose}</div></div>
                    <Badge color={doc.priority==="필수"?T.red:doc.priority==="권장"?T.amber:T.muted}>{doc.priority}</Badge>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepReview({ form, sdlc, ossp, pdpData, wbsData, deliverablesData }) {
  const items = [
    {label:"프로젝트명",value:form.name},{label:"고객사",value:form.client},
    {label:"유형",value:form.type},{label:"PM",value:form.pm},
    {label:"기간",value:`${form.startDate}~${form.endDate}`},
    {label:"SDLC",value:sdlc?.label},{label:"OSSP",value:ossp?.label},
    {label:"PDP",value:pdpData?"✓ 생성완료":"—"},{label:"WBS",value:wbsData?`✓ ${wbsData.tasks?.length}개 단계`:"—"},
    {label:"초기 산출물",value:deliverablesData?`✓ ${deliverablesData.summary?.totalDocs}건`:"—"},
  ];
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>최종 확인</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map(item=>(
          <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:0.5 }}>{item.label}</div>
            <div style={{ fontSize:12, fontWeight:600, color:item.value?.startsWith("✓")?T.green:T.text }}>{item.value||"—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectDetail({ project, nav, onDelete }) {
  const [tab, setTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!project) return <div style={{ padding:40, color:T.muted }}>프로젝트를 선택하세요.</div>;
  return (
    <div style={{ padding:"16px", maxWidth:1000, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div style={{ flex:1 }}><h1 style={{ fontSize:17, fontWeight:700 }}>{project.name}</h1><p style={{ fontSize:11, color:T.muted }}>{project.client} · {project.ossp?.label} · PM: {project.pm}</p></div>
        {confirmDelete
          ? <div style={{ display:"flex", gap:6 }}><Btn variant="danger" onClick={()=>onDelete(project.id)} style={{ fontSize:12, padding:"6px 10px" }}>삭제확인</Btn><Btn variant="ghost" onClick={()=>setConfirmDelete(false)} style={{ fontSize:12, padding:"6px 10px" }}>취소</Btn></div>
          : <Btn variant="ghost" onClick={()=>setConfirmDelete(true)} style={{ color:T.red, fontSize:12, padding:"6px 10px" }}>삭제</Btn>
        }
      </div>
      <div style={{ display:"flex", gap:3, marginBottom:16, background:T.surface, borderRadius:10, padding:3, border:`1px solid ${T.border}` }}>
        {[["overview","개요"],["pdp","PDP"],["wbs","WBS"],["deliverables","산출물"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"7px 0", borderRadius:7, fontSize:12, fontWeight:tab===id?700:400, background:tab===id?T.accent:"transparent", color:tab===id?"#fff":T.muted, border:"none", cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
        ))}
      </div>
      {tab==="overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[["기간",`${project.startDate} ~ ${project.endDate}`],["유형",project.type],["OSSP",project.ossp?.label],["문서화 수준",project.tailoring?.doc_level],["리뷰 주기",project.tailoring?.review_cycle],["테스트 수준",project.tailoring?.test_level]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:T.surface, borderRadius:10, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase" }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {tab==="pdp" && project.pdp && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Card style={{ padding:16 }}><div style={{ fontSize:11, color:T.muted, marginBottom:6, fontWeight:600 }}>목적</div><div style={{ fontSize:13, lineHeight:1.7 }}>{project.pdp.overview?.purpose}</div></Card>
          <Card style={{ padding:16 }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:8, fontWeight:600 }}>추진 목표</div>
            {project.pdp.overview?.objectives?.map((o,i)=><div key={i} style={{ fontSize:12, padding:"5px 0", borderBottom:`1px solid ${T.border}`, display:"flex", gap:8 }}><span style={{ color:T.accent }}>▸</span>{o}</div>)}
          </Card>
          <Card style={{ padding:16 }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:8, fontWeight:600 }}>일정 계획</div>
            {project.pdp.schedule?.phases?.map((ph,i)=><div key={i} style={{ fontSize:12, padding:"5px 0", borderBottom:`1px solid ${T.border}` }}><span style={{ color:T.accent, fontWeight:600 }}>{ph.phase}</span><div style={{ color:T.muted, fontSize:11 }}>{ph.start} ~ {ph.end}</div></div>)}
          </Card>
          <Card style={{ padding:16 }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:8, fontWeight:600 }}>위험 관리</div>
            {project.pdp.risks?.map((r,i)=><div key={i} style={{ fontSize:12, padding:"5px 0", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between" }}><span>{r.description?.substring(0,30)}…</span><Badge color={r.level==="상"?T.red:r.level==="중"?T.amber:T.green}>{r.level}</Badge></div>)}
          </Card>
        </div>
      )}
      {tab==="wbs" && project.wbs && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {project.wbs.tasks?.map(t=>(
            <Card key={t.id} style={{ padding:14 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}><span style={{ fontSize:10, color:T.accent, fontFamily:"monospace", background:T.accentDim, padding:"2px 8px", borderRadius:5 }}>{t.wbsCode}</span><span style={{ fontWeight:700, fontSize:14 }}>{t.phase}</span><span style={{ fontSize:11, color:T.muted, marginLeft:"auto" }}>{t.duration}</span></div>
              {t.subtasks?.map(s=><div key={s.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px", background:T.bg, borderRadius:6, fontSize:11, marginBottom:3 }}><span style={{ color:T.muted, fontFamily:"monospace", fontSize:9 }}>{s.wbsCode}</span><span style={{ flex:1 }}>{s.task}</span><Badge color={s.status==="완료"?T.green:s.status==="진행"?T.amber:T.muted}>{s.status}</Badge></div>)}
            </Card>
          ))}
        </div>
      )}
      {tab==="deliverables" && project.deliverables && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", gap:10 }}>
            {[{label:"전체",value:project.deliverables.summary?.totalDocs,color:T.accent},{label:"필수",value:project.deliverables.summary?.mandatoryCount,color:T.red},{label:"소요일",value:project.deliverables.summary?.estimatedDays+"일",color:T.amber}].map(s=>(
              <Card key={s.label} style={{ flex:1, padding:"12px 14px", textAlign:"center" }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{s.label}</div><div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div></Card>
            ))}
          </div>
          {project.deliverables.categories?.map(cat=>(
            <Card key={cat.id} style={{ padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}><span style={{ fontSize:18 }}>{cat.icon}</span><span style={{ fontWeight:700, fontSize:14 }}>{cat.name}</span><span style={{ fontSize:11, color:T.muted, marginLeft:"auto" }}>{cat.documents?.length}건</span></div>
              {cat.documents?.map(doc=>(
                <div key={doc.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0", borderTop:`1px solid ${T.border}` }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:T.accent, background:T.accentDim, padding:"2px 5px", borderRadius:4, flexShrink:0, marginTop:2 }}>{doc.code}</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{doc.name}</div><div style={{ fontSize:10, color:T.muted }}>{doc.purpose}</div></div>
                  <Badge color={doc.priority==="필수"?T.red:doc.priority==="권장"?T.amber:T.muted}>{doc.priority}</Badge>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const OSSP_ASSET_CATEGORIES = [
  "개요서","절차서","산출물템플릿","기법",
  "체크리스트","테일러링가이드","산출물흐름도","교육교재",
];

// 평평한 파일 목록(file_name에 "폴더/하위/파일.ext" 경로 포함 가능)을
// 폴더 트리 구조로 변환한다.
function buildFileTree(files) {
  const root = { folders: {}, files: [] };
  for (const f of files) {
    const parts = String(f.file_name || "").split("/");
    const fileName = parts.pop();           // 마지막은 실제 파일명
    let node = root;
    for (const part of parts) {             // 중간 경로는 폴더
      if (!part) continue;
      node.folders[part] = node.folders[part] || { folders: {}, files: [] };
      node = node.folders[part];
    }
    node.files.push({ ...f, _displayName: fileName });
  }
  return root;
}

// 폴더 트리를 접고 펴며 렌더링. 폴더 경로별 펼침 상태는 상위에서 관리.
function FileTree({ node, depth, openMap, toggle, onDownload, onRemove, selected, onToggleSelect, onBulkSelect, pathKey="" }) {
  const folderNames = Object.keys(node.folders).sort((a,b)=>a.localeCompare(b,'ko'));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
      {folderNames.map(name => {
        const childPath = pathKey ? `${pathKey}/${name}` : name;
        const isOpen = openMap[childPath] !== false;  // 기본 펼침
        const child = node.folders[name];
        const count = countFiles(child);
        const ids = collectFileIds(child);
        const allChecked = ids.length > 0 && ids.every(id => selected[id]);
        const someChecked = ids.some(id => selected[id]) && !allChecked;
        return (
          <div key={childPath}>
            <div style={{ display:"flex", alignItems:"center", gap:4,
                paddingLeft: depth*12, fontSize:11, color:T.text, fontWeight:600 }}>
              <input type="checkbox" checked={allChecked}
                ref={el=>{ if(el) el.indeterminate = someChecked; }}
                onChange={e=>onBulkSelect(ids, e.target.checked)}
                onClick={e=>e.stopPropagation()}
                style={{ cursor:"pointer", width:13, height:13, flexShrink:0 }} />
              <span onClick={()=>toggle(childPath)} style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer", overflow:"hidden" }}>
                <span style={{ color:T.muted, fontSize:9 }}>{isOpen ? "▼" : "▶"}</span>
                <span style={{ color:T.amber }}>📁</span>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
                <span style={{ color:T.muted, fontWeight:400, fontSize:9 }}>({count})</span>
              </span>
            </div>
            {isOpen && (
              <FileTree node={child} depth={depth+1} openMap={openMap} toggle={toggle}
                onDownload={onDownload} onRemove={onRemove}
                selected={selected} onToggleSelect={onToggleSelect} onBulkSelect={onBulkSelect}
                pathKey={childPath} />
            )}
          </div>
        );
      })}
      {node.files.map(f => (
        <div key={f.id} style={{ display:"flex", alignItems:"center", gap:6, paddingLeft: depth*12 + 14 }}>
          <input type="checkbox" checked={!!selected[f.id]}
            onChange={()=>onToggleSelect(f.id)}
            style={{ cursor:"pointer", width:13, height:13, flexShrink:0 }} />
          <span onClick={()=>onDownload(f)} title={f.file_name}
            style={{ fontSize:11, color:T.accent, cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
            {f._displayName}
          </span>
          <span onClick={()=>onRemove(f)} style={{ fontSize:11, color:T.red, cursor:"pointer", flexShrink:0 }}>×</span>
        </div>
      ))}
    </div>
  );
}

function countFiles(node) {
  let n = node.files.length;
  for (const k of Object.keys(node.folders)) n += countFiles(node.folders[k]);
  return n;
}

// 한 폴더(노드) 하위의 모든 파일 id를 수집 (폴더 일괄 선택용)
function collectFileIds(node) {
  let ids = node.files.map(f => f.id);
  for (const k of Object.keys(node.folders)) ids = ids.concat(collectFileIds(node.folders[k]));
  return ids;
}

// 드롭된 항목(파일/폴더)을 재귀적으로 읽어 File 배열로 변환.
// 폴더 내부 파일에는 상대경로를 _relPath로 기록한다.
function readEntry(entry, path = "") {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => {
          try { file._relPath = path + file.name; } catch (_) {}
          resolve([file]);
        },
        () => resolve([])
      );
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            const nested = await Promise.all(
              all.map((e) => readEntry(e, path + entry.name + "/"))
            );
            resolve(nested.flat());
          } else {
            all.push(...entries);
            readBatch();   // 폴더에 항목이 많으면 여러 번 호출해야 함
          }
        }, () => resolve([]));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

// DataTransfer에서 파일+폴더를 모두 수집
async function collectDroppedFiles(dataTransfer) {
  const items = dataTransfer.items;
  // webkitGetAsEntry 지원 시 폴더까지 재귀 수집
  if (items && items.length && items[0].webkitGetAsEntry) {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    const groups = await Promise.all(entries.map((e) => readEntry(e)));
    return groups.flat();
  }
  // 미지원 브라우저: 평면 파일 목록만
  return Array.from(dataTransfer.files || []);
}

// 한 OSSP의 8가지 자산 파일 관리 패널
function OSSPAssets({ osspId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);   // 업로드 중인 category
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState(null);
  const [dragCat, setDragCat] = useState(null);  // 드래그 오버 중인 category
  const [openMap, setOpenMap] = useState({});    // 폴더 경로별 펼침 상태
  const [selected, setSelected] = useState({});  // 선택된 파일 id 맵 (다중 삭제용)
  const toggleFolder = (path) => setOpenMap(m => ({ ...m, [path]: m[path] === false ? true : false }));

  async function onDrop(category, e) {
    e.preventDefault();
    setDragCat(null);
    if (busy) return;
    try {
      const collected = await collectDroppedFiles(e.dataTransfer);
      if (collected.length === 0) { setErr("올릴 파일을 찾지 못했습니다."); return; }
      await uploadMany(category, collected);
    } catch (ex) {
      setErr(ex.message || "드롭 처리 실패");
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ossp-files?ossp_id=${osspId}`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [osspId]);

  // 여러 파일을 순차 업로드 (폴더 업로드 포함)
  // 직접 업로드 방식: 서명 URL 발급 → Supabase Storage로 직접 PUT → 메타데이터 commit.
  // 파일 바이너리가 Vercel 함수를 거치지 않으므로 4.5MB 한도(413)를 우회한다.
  async function uploadMany(category, fileList) {
    const arr = Array.from(fileList || []).filter(f => f && f.size >= 0);
    if (arr.length === 0) return;
    setBusy(category); setErr(null);
    setProgress({ done: 0, total: arr.length });
    const failed = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      try {
        // 상대경로 보존: + 폴더 버튼(webkitRelativePath) 또는 드롭(_relPath)
        const rel = (file._relPath && file._relPath !== file.name)
          ? file._relPath
          : (file.webkitRelativePath && file.webkitRelativePath !== file.name
              ? file.webkitRelativePath : file.name);

        // 1) 서명된 업로드 URL 발급
        const signRes = await fetch("/api/ossp-files", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sign-upload", ossp_id: osspId, category, file_name: rel }),
        });
        if (!signRes.ok) {
          const e = await signRes.json().catch(()=>({}));
          throw new Error(e.error || "업로드 URL 발급 실패");
        }
        const { storage_path, upload_url } = await signRes.json();

        // 2) Supabase Storage로 파일 직접 PUT (Vercel 함수 우회)
        const putRes = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) {
          const t = await putRes.text().catch(()=> "");
          throw new Error(`Storage 업로드 실패 (${putRes.status}) ${t.slice(0,120)}`);
        }

        // 3) 메타데이터 기록
        const commitRes = await fetch("/api/ossp-files", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "commit", ossp_id: osspId, category,
            file_name: rel, storage_path, file_type: file.type, file_size: file.size,
          }),
        });
        if (!commitRes.ok) {
          const e = await commitRes.json().catch(()=>({}));
          throw new Error(e.error || "메타데이터 저장 실패");
        }
      } catch (e) {
        failed.push(`${file.name}: ${e.message}`);
      }
      setProgress({ done: i + 1, total: arr.length });
    }
    if (failed.length) setErr(`${failed.length}개 실패 — ${failed.slice(0,3).join(" / ")}${failed.length>3?" …":""}`);
    await load();
    setBusy(null);
    setProgress({ done: 0, total: 0 });
  }

  async function download(f) {
    try {
      const res = await fetch(`/api/ossp-files?path=${encodeURIComponent(f.file_url)}&name=${encodeURIComponent(f.file_name)}`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
      else setErr("다운로드 링크 발급 실패");
    } catch (e) { setErr(e.message); }
  }

  async function removeFile(f) {
    if (!confirm(`'${f.file_name}'을(를) 삭제할까요?`)) return;
    try {
      await fetch(`/api/ossp-files?id=${f.id}&path=${encodeURIComponent(f.file_url)}`, { method: "DELETE" });
      await load();
    } catch (e) { setErr(e.message); }
  }

  // 선택된 여러 파일을 한 번에 삭제
  async function removeMany(fileList) {
    const arr = (fileList || []).filter(Boolean);
    if (arr.length === 0) return;
    if (!confirm(`선택한 ${arr.length}개 파일을 삭제할까요?`)) return;
    setErr(null);
    const failed = [];
    for (const f of arr) {
      try {
        await fetch(`/api/ossp-files?id=${f.id}&path=${encodeURIComponent(f.file_url)}`, { method: "DELETE" });
      } catch (e) { failed.push(`${f.file_name}: ${e.message}`); }
    }
    if (failed.length) setErr(`${failed.length}개 삭제 실패 — ${failed.slice(0,3).join(" / ")}${failed.length>3?" …":""}`);
    setSelected({});
    await load();
  }

  // 선택 토글
  const toggleSelect = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  // 특정 파일 묶음을 한꺼번에 선택/해제 (폴더 체크박스용)
  const setSelectBulk = (ids, value) =>
    setSelected(s => { const n = { ...s }; ids.forEach(id => { n[id] = value; }); return n; });

  const byCat = {};
  files.forEach(f => { (byCat[f.category] = byCat[f.category] || []).push(f); });

  const selectedFiles = files.filter(f => selected[f.id]);

  return (
    <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.muted }}>표준 프로세스 자산 (8종)</div>
        {selectedFiles.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:T.accent, fontWeight:600 }}>{selectedFiles.length}개 선택됨</span>
            <Btn variant="ghost" onClick={()=>setSelected({})} style={{ fontSize:11, padding:"4px 10px" }}>선택 해제</Btn>
            <Btn variant="danger" onClick={()=>removeMany(selectedFiles)} style={{ fontSize:11, padding:"4px 10px" }}>선택 삭제</Btn>
          </div>
        )}
      </div>
      {err && <div style={{ color:T.red, fontSize:11, marginBottom:8 }}>{err}</div>}
      {loading ? <Spinner text="자산 불러오는 중…" /> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
          {OSSP_ASSET_CATEGORIES.map(cat => (
            <div key={cat}
              onDragOver={e=>{ e.preventDefault(); if(!busy) setDragCat(cat); }}
              onDragLeave={e=>{ e.preventDefault(); setDragCat(c=>c===cat?null:c); }}
              onDrop={e=>onDrop(cat, e)}
              style={{
                background: dragCat===cat ? T.accentGlow : T.bg,
                border:`1px ${dragCat===cat ? "dashed" : "solid"} ${dragCat===cat ? T.accent : T.border}`,
                borderRadius:8, padding:"10px 12px", transition:"all .15s",
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:600 }}>{cat}</span>
                {busy===cat ? (
                  <span style={{ fontSize:10, color:T.accent, fontWeight:600 }}>
                    업로드 중… {progress.done}/{progress.total}
                  </span>
                ) : (
                  <span style={{ display:"flex", gap:8 }}>
                    <label style={{ fontSize:10, color:T.accent, cursor:"pointer", fontWeight:600 }}>
                      + 파일
                      <input type="file" multiple style={{ display:"none" }} disabled={!!busy}
                        onChange={e=>{ uploadMany(cat, e.target.files); e.target.value=""; }} />
                    </label>
                    <label style={{ fontSize:10, color:T.muted, cursor:"pointer", fontWeight:600 }}>
                      + 폴더
                      <input type="file" multiple style={{ display:"none" }} disabled={!!busy}
                        ref={el=>{ if(el){ el.webkitdirectory=true; el.directory=true; } }}
                        onChange={e=>{ uploadMany(cat, e.target.files); e.target.value=""; }} />
                    </label>
                  </span>
                )}
              </div>
              {dragCat===cat ? (
                <div style={{ fontSize:11, color:T.accent, fontWeight:600, padding:"6px 0" }}>여기에 놓으면 업로드됩니다</div>
              ) : (byCat[cat]||[]).length === 0 ? (
                <div style={{ fontSize:10, color:T.muted }}>등록된 파일 없음 · 파일·폴더를 끌어다 놓으세요</div>
              ) : (
                <FileTree
                  node={buildFileTree(byCat[cat]||[])}
                  depth={0}
                  openMap={openMap}
                  toggle={toggleFolder}
                  onDownload={download}
                  onRemove={removeFile}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onBulkSelect={setSelectBulk}
                  pathKey={cat}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OSSPPage({ nav, customOSSP=[], onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [version, setVersion] = useState("");
  const [desc, setDesc] = useState("");
  const [phaseText, setPhaseText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);  // 펼쳐진 OSSP id

  function reset() { setLabel(""); setVersion(""); setDesc(""); setPhaseText(""); setError(null); }

  async function submit() {
    const phases = phaseText.split(",").map(s=>s.trim()).filter(Boolean);
    if (!label.trim()) { setError("이름을 입력하세요."); return; }
    if (phases.length === 0) { setError("단계를 1개 이상 입력하세요. (쉼표로 구분)"); return; }
    setSaving(true); setError(null);
    try {
      await onAdd({ name: label.trim(), version: version.trim(), description: desc.trim(), phases });
      reset(); setShowForm(false);
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const renderCard = (o, deletable) => {
    const isOpen = expanded === o.id;
    return (
      <Card key={o.id} style={{ padding:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <span style={{ fontSize:16, fontWeight:700 }}>{o.label}</span>
              {o.version && <Badge color={T.accent}>{o.version}</Badge>}
              {deletable && <Badge color={T.green}>사내</Badge>}
            </div>
            <div style={{ fontSize:12, color:T.muted }}>{o.desc}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {deletable && (
              <Btn variant="outline" onClick={()=>setExpanded(isOpen ? null : o.id)} style={{ fontSize:11, padding:"5px 10px" }}>
                {isOpen ? "자산 닫기" : "자산 관리"}
              </Btn>
            )}
            <Btn variant="outline" onClick={()=>nav("new_project")} style={{ fontSize:11, padding:"5px 10px" }}>시작</Btn>
            {deletable && (
              <Btn variant="outline" onClick={()=>{ if(confirm(`'${o.label}'을(를) 삭제할까요? 등록된 파일도 함께 삭제됩니다.`)) onDelete(o.id); }} style={{ fontSize:11, padding:"5px 10px", color:T.red, borderColor:T.red+"55" }}>삭제</Btn>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {o.phases.map((ph,i)=>(
            <div key={ph+i} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ padding:"4px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, fontSize:11 }}><span style={{ color:T.accent, marginRight:4 }}>{i+1}.</span>{ph}</div>
              {i<o.phases.length-1 && <span style={{ color:T.border, fontSize:10 }}>→</span>}
            </div>
          ))}
        </div>
        {deletable && isOpen && <OSSPAssets osspId={o.id} />}
      </Card>
    );
  };

  return (
    <div style={{ padding:"16px", maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div style={{ flex:1 }}><h1 style={{ fontSize:17, fontWeight:700 }}>OSSP 라이브러리</h1><p style={{ fontSize:11, color:T.muted }}>조직 표준 프로세스 및 자산 구성</p></div>
        <Btn variant="primary" onClick={()=>{ setShowForm(v=>!v); reset(); }} style={{ fontSize:12, padding:"7px 14px" }}>{showForm ? "취소" : "+ OSSP 등록"}</Btn>
      </div>

      {showForm && (
        <Card style={{ padding:18, marginBottom:18, border:`1px solid ${T.accent}55` }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>회사 OSSP 등록</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Input label="이름" value={label} onChange={setLabel} placeholder="예: 정보공학 기반 SI 개발 방법론" />
            <Input label="버전" value={version} onChange={setVersion} placeholder="예: V1.0" />
            <Input label="설명" value={desc} onChange={setDesc} placeholder="예: 검증 중심 단계별 개발" />
            <Input label="단계 (쉼표로 구분)" value={phaseText} onChange={setPhaseText} placeholder="요구분석, 설계, 구현, 단위테스트, 통합테스트, 인수" />
            {phaseText.trim() && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {phaseText.split(",").map(s=>s.trim()).filter(Boolean).map((ph,i)=><Badge key={i}>{i+1}. {ph}</Badge>)}
              </div>
            )}
            <div style={{ fontSize:11, color:T.muted }}>※ 등록 후 카드의 '자산 관리'에서 개요서·절차서·템플릿 등 8종 파일을 올릴 수 있습니다.</div>
            {error && <div style={{ color:T.red, fontSize:12 }}>{error}</div>}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="primary" onClick={submit} disabled={saving} style={{ fontSize:12, padding:"8px 16px" }}>{saving ? "저장 중…" : "저장"}</Btn>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {customOSSP.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginTop:4 }}>회사 등록 OSSP</div>
            {customOSSP.map(o=>renderCard(o, true))}
            <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginTop:8 }}>기본 제공</div>
          </>
        )}
        {OSSP_OPTIONS.map(o=>renderCard(o, false))}
      </div>
    </div>
  );
}
