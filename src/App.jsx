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
  const [tailoring, setTailoring] = useState({ doc_level:"표준", review_cycle:"격주", test_level:"통합", risk:"강화" });
  const [pdpData, setPdpData] = useState(null);
  const [wbsData, setWbsData] = useState(null);
  const [deliverablesData, setDeliverablesData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const nav = (p) => { setPage(p); setGenError(null); setMenuOpen(false); };

  useEffect(() => { fetchProjects(); }, []);

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
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:4000,
        system:"You are a project management expert. Always respond with valid JSON only, no markdown, no preamble.",
        messages:[{ role:"user", content:prompt }] }),
    });
    const data = await res.json();
    const text = data.content?.map(b=>b.text||"").join("")||"";
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  }

  async function generatePDP() {
    setGenerating(true); setGenError(null); setPdpData(null);
    try {
      const result = await callClaude(`프로젝트명: ${projectForm.name}, 고객사: ${projectForm.client}, 유형: ${projectForm.type}, OSSP: ${selectedOSSP?.label}, 기간: ${projectForm.startDate}~${projectForm.endDate}, PM: ${projectForm.pm}, 테일러링: ${JSON.stringify(tailoring)}
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
      status:"진행중", ossp:selectedOSSP, tailoring, pdp:pdpData, wbs:wbsData, deliverables:deliverablesData,
    };
    try {
      await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newProject) });
      await fetchProjects();
    } catch(e) { console.error(e); }
    setWizardStep(0); setProjectForm({ name:"",client:"",type:"신규개발",startDate:"",endDate:"",pm:"" });
    setSelectedOSSP(null); setTailoring({ doc_level:"표준",review_cycle:"격주",test_level:"통합",risk:"강화" });
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
      onFinish={finishProject} nav={nav} />,
    project_detail: <ProjectDetail project={currentProject} nav={nav} onDelete={deleteProject} />,
    ossp: <OSSPPage nav={nav} />,
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

function NewProjectWizard({ step, setStep, form, setForm, selectedOSSP, setSelectedOSSP, tailoring, setTailoring, pdpData, wbsData, deliverablesData, generating, genError, onGeneratePDP, onGenerateWBS, onGenerateDeliverables, onFinish, nav }) {
  const steps = ["기본정보","OSSP","테일러링","PDP","WBS","산출물","완료"];
  const canNext = [form.name&&form.client&&form.startDate&&form.endDate&&form.pm, !!selectedOSSP, true, !!pdpData, !!wbsData, !!deliverablesData, true];
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
        {step===1 && <StepOSSP selected={selectedOSSP} setSelected={setSelectedOSSP} />}
        {step===2 && <StepTailoring tailoring={tailoring} setTailoring={setTailoring} ossp={selectedOSSP} />}
        {step===3 && <StepPDP pdpData={pdpData} generating={generating} genError={genError} onGenerate={onGeneratePDP} />}
        {step===4 && <StepWBS wbsData={wbsData} generating={generating} genError={genError} onGenerate={onGenerateWBS} />}
        {step===5 && <StepDeliverables deliverablesData={deliverablesData} generating={generating} genError={genError} onGenerate={onGenerateDeliverables} />}
        {step===6 && <StepReview form={form} ossp={selectedOSSP} pdpData={pdpData} wbsData={wbsData} deliverablesData={deliverablesData} />}
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

function StepOSSP({ selected, setSelected }) {
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>OSSP 방법론 선택</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:16 }}>프로젝트에 적합한 개발 방법론을 선택하세요.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {OSSP_OPTIONS.map(o=>(
          <div key={o.id} onClick={()=>setSelected(o)} style={{ padding:16, borderRadius:12, border:`2px solid ${selected?.id===o.id?T.accent:T.border}`, background:selected?.id===o.id?T.accentGlow:T.bg, cursor:"pointer", transition:"all .2s" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:4, color:selected?.id===o.id?T.accent:T.text }}>{o.label}</div>
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

function StepReview({ form, ossp, pdpData, wbsData, deliverablesData }) {
  const items = [
    {label:"프로젝트명",value:form.name},{label:"고객사",value:form.client},
    {label:"유형",value:form.type},{label:"PM",value:form.pm},
    {label:"기간",value:`${form.startDate}~${form.endDate}`},{label:"OSSP",value:ossp?.label},
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

function OSSPPage({ nav }) {
  return (
    <div style={{ padding:"16px", maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div><h1 style={{ fontSize:17, fontWeight:700 }}>OSSP 라이브러리</h1><p style={{ fontSize:11, color:T.muted }}>지원되는 개발 방법론 및 단계 구성</p></div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {OSSP_OPTIONS.map(o=>(
          <Card key={o.id} style={{ padding:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div><div style={{ fontSize:16, fontWeight:700, marginBottom:3 }}>{o.label}</div><div style={{ fontSize:12, color:T.muted }}>{o.desc}</div></div>
              <Btn variant="outline" onClick={()=>nav("new_project")} style={{ fontSize:11, padding:"5px 10px" }}>시작</Btn>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {o.phases.map((ph,i)=>(
                <div key={ph} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ padding:"4px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, fontSize:11 }}><span style={{ color:T.accent, marginRight:4 }}>{i+1}.</span>{ph}</div>
                  {i<o.phases.length-1 && <span style={{ color:T.border, fontSize:10 }}>→</span>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
