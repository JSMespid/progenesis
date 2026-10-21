import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SDLC_FACTOR_CRITERIA } from './sdlcFactorCriteria';
import TailoringGuideModal from './TailoringGuideModal';
import { TAILORING_GUIDES, getGuideForOSSP as baseGuideForOSSP, mapMgmtOutput } from './tailoringGuides';
import { PROCESS_TAILORING_GUIDE, processMark, processKey, resolveProcessTailoring } from './processTailoringGuide';
import * as AE from './aspiceEngineering';

// ── 과제 유형(track) — 새 프로젝트 시작 화면에서 결정, ASPICE 여부의 유일한 기준 ──
// 선택한 OSSP에는 guideId가 붙어 저장되어, 이후 모든 테일러링 가이드 판정이 과제 유형을 따른다.
// track이 없는 기존 프로젝트는 종전처럼 OSSP(이름에 ASPICE·자동차 포함 여부)로 판정한다.
const PROJECT_TRACKS = [
  { id: "standard", icon: "🏢", label: "일반 SI 과제", desc: "공공·금융·기업 정보시스템 구축 — PMBOK 기반, 정보공학/UML·Agile·DevOps 등", note: "요구사항은 산출물 단계의 시스템 요구사항 명세서 행에서 AI로 작성" },
  { id: "aspice", icon: "🚗", label: "ASPICE 자동차 과제", desc: "차량 전장 시스템·SW 개발 — Automotive SPICE 3.1 / 4.0", note: "요구 도출·명세부터 설계·검증·추적성까지 V-모델에서 작성" },
];
function getGuideForOSSP(ossp) {
  if (ossp && ossp.guideId && TAILORING_GUIDES[ossp.guideId]) return TAILORING_GUIDES[ossp.guideId];
  return baseGuideForOSSP(ossp);
}
// 과제 유형에 맞춰 OSSP에 붙일 가이드 ID (null = OSSP 고유 가이드 그대로)
function trackGuideId(track, ossp) {
  if (track === "aspice") return "aspice";
  if (track === "standard" && baseGuideForOSSP(ossp || {})?.id === "aspice") return "ie";
  return null;
}
const isAspiceOSSP = o => baseGuideForOSSP(o || {})?.id === "aspice";
// ASPICE 목표 능력수준 — 테일러링 가이드의 능력수준 값(scale)과 1:1 대응
//   CL1·CL2: 조직 표준 프로세스 테일러링·PDP 불필요 → [기본정보 → 적용 범위 → WBS → 산출물 → 완료]
//   CL3    : 테일러링·PDP 필요(PA 3.2 프로세스 전개) → [기본정보 → 테일러링 → PDP → WBS → 산출물 → 완료]
const ASPICE_CLS = [
  { id: "CL1", scale: "소형", label: "CL1", desc: "프로세스 결과물(WP) 작성 중심" },
  { id: "CL2", scale: "중형", label: "CL2", desc: "+ 계획·모니터링, 산출물 검토·관리 (가장 흔함)" },
  { id: "CL3", scale: "(초)대형", label: "CL3", desc: "+ 조직 표준 프로세스 테일러링·PDP" },
];
const aspiceClOf = form => ASPICE_CLS.some(c => c.id === form?.aspiceCL) ? form.aspiceCL : "CL2";
const clScale = cl => (ASPICE_CLS.find(c => c.id === cl) || ASPICE_CLS[1]).scale;
// ASPICE 적용 프로세스 범위 — 매트릭스 비고(note)의 프로세스 표기로 산출물을 묶는다 (위에서부터 첫 일치)
const ASPICE_SCOPE_GROUPS = [
  { id: "REU",  label: "REU.2 재사용 (파생·Carry-over 개발)", re: /REU\.2/, on: false },
  { id: "ACQ",  label: "ACQ.4 공급자 모니터링 (협력사 개발)", re: /^ACQ\./, on: false },
  { id: "VAL",  label: "VAL.1 밸리데이션 (실차 검증)", re: /^VAL\./, on: false },
  { id: "MAN5", label: "MAN.5 리스크 관리 (VDA 범위 외)", re: /^MAN\.5/, on: false },
  { id: "MAN3", label: "MAN.3 프로젝트 관리", re: /^MAN\.3/, on: true, lock: true },
  { id: "SUP",  label: "SUP.1·8·9·10 품질보증·형상·문제·변경", re: /^(SUP\.|PA 2\.2)/, on: true, lock: true },
  { id: "SYS",  label: "SYS.1~5 시스템 엔지니어링", re: /^SYS\./, on: true, lock: true },
  { id: "SWE",  label: "SWE.1~6 소프트웨어 엔지니어링", re: /^SWE\./, on: true },
  { id: "HWE",  label: "HWE.1~4 하드웨어 엔지니어링", re: /^HWE\./, on: false },
  { id: "SPL",  label: "SPL.2 제품 릴리즈", re: /^SPL\./, on: true },
];
// 개발 범위(form.aspiceDev): "SW" = SYS+SW / "HWSW" = SYS+SW+HW — SWE·HWE 범위의 단일 기준. 시스템(SYS.1~5)은 항상 포함.
// "HW"(HW만)는 ASPICE 심사에서 사실상 없는 형태라 선택지에서 뺐다. 구버전 저장 과제 호환용으로만 남기며(legacy), 그 과제를 열었을 때만 보인다.
// (내부 id "SW"·"HWSW"는 저장 데이터·적용 범위 역산과의 호환을 위해 그대로 둔다)
const ASPICE_DEVS = [
  { id: "SW",   label: "SYS + SW",      desc: "시스템(SYS.1~5)·SW(SWE.1~6) 개발 — HW는 별도 조직·협력사" },
  { id: "HWSW", label: "SYS + SW + HW", desc: "시스템(SYS.1~5)·SW(SWE.1~6)·HW(HWE.1~4) 일체 개발 (전장부품·제어기)" },
  { id: "HW",   label: "HW (구버전)",   desc: "HW만 개발 — 구버전 과제 호환용. SYS + SW + HW로 바꾸는 것을 권장합니다", legacy: true },
];
const aspiceDevChoices = cur => ASPICE_DEVS.filter(d => !d.legacy || d.id === cur);
// 프로젝트 유형 — 과제 유형(track)에 종속. 일반 SI는 사업 분류, ASPICE 자동차는 제품 개발 분류.
// 값(value)은 저장·AI 프롬프트·PDP 문구에 그대로 쓰이며, "신규개발"은 두 과제 유형 공통 기본값.
const PROJECT_TYPES = {
  si: [
    { value: "신규개발", label: "신규개발" },
    { value: "고도화",   label: "고도화" },
    { value: "유지보수", label: "유지보수" },
    { value: "컨설팅",   label: "컨설팅" },
  ],
  aspice: [
    { value: "신규개발",     label: "신규 개발",                   desc: "신규 제어기·신규 플랫폼 개발 — 표준 프로세스 범위 전체" },
    { value: "파생개발",     label: "파생 개발 (Carry-over·변형)", desc: "기존 제품·플랫폼 기반의 차종 적용·사양 변형 — REU.2 재사용 관리를 자동으로 적용 범위에 포함" },
    { value: "사양변경",     label: "사양 변경 (양산 설계 변경)",  desc: "양산 중인 제품의 고객 요청 변경(ECR·ECO) — 변경 영향 분석·추적성(SUP.10) 중심" },
    { value: "양산유지보수", label: "양산 유지보수",               desc: "SOP 이후 결함 수정·소규모 개선 — 문제해결(SUP.9)·형상관리(SUP.8) 중심" },
  ],
};
// ASPICE 매트릭스 기본값에서 SW 구성요소별로 작성하는 산출물 (나머지는 공통)
const ASPICE_PER_COMPONENT_CODES = ["SW3101", "SW4101", "SW4106"];
const projectTypesFor = track => PROJECT_TYPES[track === "aspice" ? "aspice" : "si"];
const fitProjectType = (track, type) => projectTypesFor(track).some(t => t.value === type) ? type : "신규개발";
const aspiceDevOf = form => ASPICE_DEVS.some(d => d.id === form?.aspiceDev) ? form.aspiceDev : "SW";
const devFromScope = sc => (sc && sc.HWE) ? (sc.SWE === false ? "HW" : "HWSW") : "SW";
const aspiceScopeDefault = (dev) => {
  const sc = Object.fromEntries(ASPICE_SCOPE_GROUPS.map(g => [g.id, g.on]));
  if (dev) { sc.SWE = dev !== "HW"; sc.HWE = dev !== "SW"; }
  return sc;
};
// 범위 판정 — 저장된 범위에 키가 없으면(구버전 저장본) 그 그룹의 기본값(on)을 따른다. HWE·ACQ 등 기본 꺼짐 그룹이 의도치 않게 켜지지 않도록.
const aspiceGroupOn = (scope, gid) => { const v = scope?.[gid]; if (v === undefined) return !!(ASPICE_SCOPE_GROUPS.find(g => g.id === gid) || {}).on; return v !== false; };
const aspiceRowGroup = d => (ASPICE_SCOPE_GROUPS.find(g => g.re && g.re.test(String(d.note || ""))) || {}).id || null;
// ── 관리활동 해석: 가이드에 mgmtActivities가 있으면(ASPICE) 그것을, 없으면 관리활동 테일러링 가이드(V2.0, CMMI SI용) ──
// ASPICE 항목의 필수(●)/선택(○)은 해당 산출물의 목표 능력수준 열(M/O), 적용 여부는 적용 범위와 선택 산출물 제외(excluded)를 따른다.
function resolveMgmt(tailoring, guide, procState) {
  if (!guide?.mgmtActivities) return resolveProcessTailoring(procState !== undefined ? procState : tailoring?.process);
  const scaleKey = { "(초)대형": "large", "중형": "medium", "소형": "small" }[tailoring?.scale || "중형"] || "medium";
  const scope = tailoring?.aspiceScope || aspiceScopeDefault();
  const excluded = tailoring?.excluded || {};
  const rowByName = new Map((guide.matrix || []).map(r => [r.name, r]));
  return guide.mgmtActivities.filter(a => aspiceGroupOn(scope, a.scope)).map(a => {
    const row = rowByName.get(a.output);
    const mk = row?.[scaleKey];
    const mark = mk === "M" ? "●" : "○";
    const applied = mark === "●" || !(row && excluded[row.code]);
    return { area: a.area, process: a.process, activity: "", outputs: a.output, guide: "", key: `am:${a.id}`, mark,
      l3: mark, l4: mark, l5: mark, applied, changed: false, status: applied ? "적용" : "미적용",
      reason: applied ? "" : "선택 산출물 미적용", outCode: row?.code || "" };
  });
}
// 관리활동 수준 표기: ASPICE는 목표 능력수준, 그 외는 관리 성숙도 수준(L3~L5)
const mgmtLevelLabel = (tailoring, guide) => guide?.mgmtActivities
  ? (guide.scaleOptions?.find(o => o.value === (tailoring?.scale || "중형"))?.label || "").split(" ·")[0] || "ASPICE"
  : (tailoring?.process?.level || "L3");

const T = {
  bg: "#0A0C10", surface: "#111318", border: "#1E2230",
  accent: "#4F8EF7", accentDim: "#1E3A6E", accentGlow: "rgba(79,142,247,0.18)",
  green: "#2DD4A0", amber: "#F5A623", red: "#FF5B5B",
  text: "#E8EAF0", muted: "#6B7280", subtle: "#1C2030",
};

function Badge({ color = T.accent, children }) {
  return <span style={{ background: color+"22", color, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", whiteSpace:"nowrap" }}>{children}</span>;
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

// ── 파일 끌어다 놓기(드래그앤드롭) 공용 영역 ──
// accept: <input accept>와 같은 형식(".dbc,.txt" / "image/png,image/jpeg" / "image/*"). 비우면 모든 파일.
// onFiles(File[]): 형식이 맞는 파일만 전달(multiple=false면 첫 1개). 형식이 맞지 않으면 영역 안에 안내만 표시.
// bare=true: 테두리·안내문 없이 감싸기만 하고, 끌고 들어올 때만 오버레이 표시.
const fileAccepts = (f, accept) => {
  const toks = String(accept || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!toks.length) return true;
  const name = String(f?.name || "").toLowerCase(), type = String(f?.type || "").toLowerCase();
  return toks.some(t => t.startsWith(".") ? name.endsWith(t)
    : t.endsWith("/*") ? type.startsWith(t.slice(0, -1)) : type === t);
};
// 기존 <input type="file"> onChange 핸들러를 그대로 재사용하기 위한 가짜 이벤트
const asFileEvent = files => ({ target: { files, value: "" } });
const dragHasFiles = e => [...(e.dataTransfer?.types || [])].includes("Files");

function FileDrop({ accept = "", multiple = false, onFiles, disabled = false, hint, dropLabel, bare = false, style = {}, children }) {
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState("");
  const depth = useRef(0);
  const msgTimer = useRef(null);
  useEffect(() => () => clearTimeout(msgTimer.current), []);
  const flashMsg = t => { setMsg(t); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(""), 4000); };
  const exts = String(accept || "").split(",").map(s => s.trim()).filter(Boolean)
    .map(t => t === "image/png" ? ".png" : t === "image/jpeg" ? ".jpg" : t).join(" · ");
  return (
    <div style={{ position: "relative", ...(bare ? {} : { border: `1px dashed ${over ? T.accent : T.border}`, borderRadius: 10, padding: "10px 12px", background: over ? T.accent + "0D" : "transparent", transition: "border-color .15s, background .15s" }), ...style }}
      onDragEnter={e => { if (!dragHasFiles(e) || disabled) return; e.preventDefault(); depth.current++; setOver(true); }}
      onDragOver={e => { if (!dragHasFiles(e) || disabled) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={e => { if (!dragHasFiles(e) || disabled) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
      onDrop={e => {
        if (!dragHasFiles(e) || disabled) return;
        e.preventDefault(); e.stopPropagation(); depth.current = 0; setOver(false);
        const all = [...(e.dataTransfer.files || [])];
        const ok = all.filter(f => fileAccepts(f, accept));
        if (!ok.length) { flashMsg(`지원하지 않는 형식입니다${exts ? ` (가능: ${exts})` : ""} — ${all.map(f => f.name).join(", ")}`); return; }
        if (ok.length < all.length) flashMsg(`형식이 맞지 않는 ${all.length - ok.length}개 파일은 제외했습니다.`);
        else if (!multiple && ok.length > 1) flashMsg(`파일 1개만 받습니다 — '${ok[0].name}'만 사용합니다.`);
        else setMsg("");
        onFiles?.(multiple ? ok : ok.slice(0, 1));
      }}>
      {children}
      {!bare && hint !== false && (
        <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>{hint || `또는 파일을 이 영역으로 끌어다 놓으세요${exts ? ` (${exts})` : ""}${multiple ? " · 여러 개 가능" : ""}`}</div>
      )}
      {msg && <div style={{ fontSize: 10.5, color: T.amber, marginTop: 6 }}>⚠ {msg}</div>}
      {over && (
        <div style={{ position: "absolute", inset: 0, zIndex: 3, borderRadius: 10, border: `2px dashed ${T.accent}`, background: T.bg + "E6", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 8, color: T.accent, fontSize: 12.5, fontWeight: 600, pointerEvents: "none" }}>
          📂 {dropLabel || "여기에 놓으세요"}
        </div>
      )}
    </div>
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

// 생성 진행 상황 표시 — 단계 라벨 + 퍼센트 바 (AI 호출처럼 오래 걸리는 작업용)
function GenProgressBar({ progress, subText }) {
  if (!progress) return null;
  const pct = Math.min(100, Math.round(progress.percent || 0));
  const done = pct >= 100;
  return (
    <div style={{ padding:"14px 16px", background:T.bg, border:`1px solid ${done ? T.green+"55" : T.border}`, borderRadius:10, marginBottom:12, animation:"fadeIn .3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:600, color: done ? T.green : T.text, minWidth:0 }}>
          {!done && <div style={{ width:14, height:14, border:`2px solid ${T.border}`, borderTop:`2px solid ${T.accent}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />}
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{done ? "✓ " : ""}{progress.label}</span>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color: done ? T.green : T.accent, fontFamily:"monospace", flexShrink:0 }}>{pct}%</div>
      </div>
      <div style={{ height:8, background:T.border, borderRadius:99, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background: done ? T.green : T.accent, borderRadius:99, transition:"width .4s ease" }} />
      </div>
      {subText && !done && <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>{subText}</div>}
    </div>
  );
}

const OSSP_OPTIONS = [
  { id:"waterfall", label:"Waterfall", desc:"전통적 순차 개발", phases:["요구분석","설계","구현","테스트","배포","유지보수"] },
  { id:"agile", label:"Agile/Scrum", desc:"반복·점진적 개발", phases:["스프린트 계획","백로그 관리","개발","리뷰","회고","릴리즈"] },
  { id:"devops", label:"DevOps", desc:"지속적 통합·배포", phases:["계획","코딩","빌드","테스트","배포","운영","모니터링"] },
];

// 기본 제공 방법론의 단계별 표준 산출물 프리셋 (PMBOK 8판 관점, QA 필수 산출물 포함)
// key는 방법론 label과 일치해야 함 (DB 시딩 name과 동일)
const BUILTIN_DELIVERABLES = {
  "Waterfall": {
    "요구분석": ["프로젝트 관리 계획서(PMP)", "요구사항 정의서", "요구사항 추적표(RTM)", "품질보증 계획서", "리스크 관리대장"],
    "설계":     ["아키텍처 설계서", "상세 설계서", "인터페이스 설계서", "DB 설계서(ERD)"],
    "구현":     ["프로그램 소스코드", "코딩 표준 준수 검토서", "단위테스트 결과서"],
    "테스트":   ["통합테스트 계획서/결과서", "테스트 케이스·시나리오", "결함 관리 대장"],
    "배포":     ["배포(이행) 계획서", "인수테스트 결과서", "사용자·운영자 매뉴얼", "릴리즈 노트"],
    "유지보수": ["변경 요청서(CR)", "형상관리 대장", "교훈(Lessons Learned) 보고서"],
  },
  "Agile/Scrum": {
    "스프린트 계획": ["스프린트 계획서", "스프린트 백로그", "완료 기준(DoD) 정의서"],
    "백로그 관리":   ["제품 백로그", "사용자 스토리", "스토리 맵"],
    "개발":          ["프로그램 소스코드", "단위테스트 코드", "번다운 차트"],
    "리뷰":          ["스프린트 리뷰 결과서", "제품 증분(Increment) 데모 자료"],
    "회고":          ["회고 결과서", "개선 액션 아이템 목록"],
    "릴리즈":        ["릴리즈 계획서", "릴리즈 노트", "배포 체크리스트"],
  },
  "DevOps": {
    "계획":     ["제품 로드맵", "SLO/SLA 정의서"],
    "코딩":     ["프로그램 소스코드", "코드 리뷰(PR) 기록", "코딩 표준 가이드"],
    "빌드":     ["CI 파이프라인 정의서", "빌드 결과 리포트"],
    "테스트":   ["자동화 테스트 스위트", "테스트 커버리지 리포트"],
    "배포":     ["CD 파이프라인 정의서", "배포 승인 기록", "롤백 절차서"],
    "운영":     ["운영 매뉴얼(Runbook)", "장애 대응 절차서"],
    "모니터링": ["모니터링 대시보드 정의서", "장애 회고 보고서(Postmortem)"],
  },
};

// 방법론별 테일러링 매트릭스와 가이드는 src/tailoringGuides.js로 이동 (TAILORING_GUIDES / getGuideForOSSP)

const TAILORING_RULES = [
  { id:"doc_level", label:"문서화 수준", options:["최소","표준","상세"] },
  { id:"review_cycle", label:"리뷰 주기", options:["주간","격주","월간"] },
  { id:"test_level", label:"테스트 수준", options:["단위","통합","전체"] },
  { id:"risk", label:"위험 관리", options:["기본","강화","최고"] },
];


// ── 세션·인증 공용 유틸 ──────────────────────────────────────────────
// 로그인 시 서버가 발급하는 토큰은 HMAC 서명된 무상태 토큰(payload.signature)이다.
// 클라이언트는 payload를 화면 표시(이름·역할)용으로만 디코딩하며, 실제 권한 판정은
// 항상 서버(api/_auth.js requireRole)가 수행한다.
// ── 제품 브랜드 ───────────────────────────────────────────────────────
// 화면·산출물에 노출되는 도구 이름은 반드시 이 상수만 사용한다 (문자열 하드코딩 금지).
const APP_NAME = "SPIDer QA Agent";
const APP_TAGLINE = "v1.0 · AI Platform";
const APP_MARK = "S";                       // 로고 이니셜

// localStorage 키 — 브랜드 변경에 따라 접두어를 spiderqa_ 로 통일
const AUTH_KEY = "spiderqa_auth";
const DRAFT_KEY = "spiderqa_wizard_draft";

// 구버전 키에서 1회 이관 — 이름 변경으로 로그인 세션·임시저장 초안이 사라지지 않도록 한다.
// (배포 후 1개 릴리스 주기가 지나면 이 블록과 아래 상수는 삭제해도 무방)
const _LEGACY_KEYS = [["progenesis_auth", AUTH_KEY], ["progenesis_wizard_draft", DRAFT_KEY], ["progenesis_pbs_noai", "spiderqa_pbs_noai"]];
(function migrateLocalKeys() {
  try {
    for (const [oldK, newK] of _LEGACY_KEYS) {
      const v = localStorage.getItem(oldK);
      if (v !== null && localStorage.getItem(newK) === null) localStorage.setItem(newK, v);
      if (v !== null) localStorage.removeItem(oldK);
    }
  } catch { /* 스토리지 접근 불가 환경 — 무시 */ }
})();

// ── 위저드 임시저장본: 여러 건 보관 (작성 중 항목마다 draftId) ──
// 이전에는 슬롯이 1개(DRAFT_KEY)라 새 프로젝트를 임시저장하면 기존 작성 중 과제가 덮어써져 사라졌다.
// 이제 spiderqa_wizard_drafts 배열에 건별로 보관하고, 구버전 단일 슬롯은 처음 읽을 때 배열로 이관한다.
const DRAFTS_KEY = "spiderqa_wizard_drafts";
const newDraftId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const draftHasContent = d => !!(d && (d.projectForm?.name || d.projectForm?.client || d.projectForm?.track || d.selectedOSSP || d.selectedSDLC));
function readDrafts() {
  let arr = [];
  try { const raw = localStorage.getItem(DRAFTS_KEY); const v = raw ? JSON.parse(raw) : []; if (Array.isArray(v)) arr = v.filter(d => d && typeof d === "object"); } catch (e) { console.error(e); }
  try {
    const legacy = localStorage.getItem(DRAFT_KEY);
    if (legacy) {
      const d = JSON.parse(legacy);
      if (d && typeof d === "object" && !arr.some(x => x.draftId && x.draftId === d.draftId)) {
        arr.push({ ...d, draftId: d.draftId || newDraftId() });
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr));
      }
      localStorage.removeItem(DRAFT_KEY);   // 이관 성공 후에만 제거 (setItem 실패 시 예외로 여기까지 오지 않음)
    }
  } catch (e) { console.error(e); }
  arr.forEach(d => { if (!d.draftId) d.draftId = newDraftId(); });
  return arr.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
}
function writeDrafts(arr) { localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr)); }   // 공간 부족 시 예외 — 호출부에서 처리

function b64urlDecode(s) {
  let x = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (x.length % 4) x += "=";
  const bin = atob(x);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// 저장된 토큰 → 세션 정보.
// 중요: 토큰을 해석하지 못하더라도 절대 로그아웃시키지 않는다.
//   - 구버전 고정 토큰이나 만료 토큰을 가진 사용자도 앱을 계속 쓰게 하고,
//     관리자 API가 필요한 순간에만 화면 안에서 재인증(ReauthCard)을 요구한다.
//   - 서버는 만료 후에도 유예기간(60일) 안이면 refresh로 세션을 연장해 준다.
function decodeSession(token) {
  const t = String(token || "");
  if (!t) return null;                       // 토큰 자체가 없을 때만 로그인 화면
  try {
    const p = JSON.parse(b64urlDecode(t.split(".")[0]));
    if (p && p.role) {
      const expired = !!(p.exp && Date.now() > p.exp);
      return { ...p, expired, needsReauth: expired };
    }
  } catch { /* 아래 레거시 처리로 진행 */ }
  // 구버전 토큰: 서명이 없어 서버 권한 판정이 불가하므로 '재인증 필요' 상태로 앱만 유지
  return { legacy: true, role: "legacy", login_id: "", name: "이전 세션", needsReauth: true };
}

function getToken() { try { return localStorage.getItem(AUTH_KEY) || ""; } catch { return ""; } }

// ── 전역 fetch 래퍼: /api/* 호출에 세션 토큰(Authorization: Bearer)을 자동으로 붙인다 ──
// 모든 API 엔드포인트가 세션 검증을 요구하므로, 개별 fetch 호출을 고치지 않아도 인증 헤더가 전달되게 한다.
// 401(UNAUTHENTICATED)이 오면 'spiderqa:unauth' 이벤트를 발생시켜 화면 안 재인증 카드를 띄운다 (로그아웃시키지 않음).
(function installAuthFetch() {
  if (typeof window === "undefined" || !window.fetch || window.fetch.__spiderAuth) return;
  const orig = window.fetch.bind(window);
  const wrapped = async (input, init = {}) => {
    let url = "";
    try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch { url = ""; }
    const isApi = /^\/api\//.test(url) || (typeof location !== "undefined" && url.startsWith(location.origin + "/api/"));
    if (!isApi) return orig(input, init);
    const headers = new Headers(init.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
    const t = getToken();
    if (t && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${t}`);
    const res = await orig(input, { ...init, headers });
    if (res.status === 401 && !/\/api\/login/.test(url)) {
      try { window.dispatchEvent(new CustomEvent("spiderqa:unauth")); } catch { /* 무시 */ }
    }
    return res;
  };
  wrapped.__spiderAuth = true;
  window.fetch = wrapped;
})();

// 인증 헤더를 붙여 호출하고 JSON을 반환. 실패 시 서버 메시지를 담은 Error를 throw.
async function apiFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; } }
  if (!res.ok) {
    const e = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    e.status = res.status; e.data = data;
    throw e;
  }
  return data;
}

// AI 호출 기본값 — 설정(설정 → AI 연동)에서 저장한 값으로 앱 기동 시 덮어쓴다.
// 기본 매개변수는 호출 시점에 평가되므로 이 객체를 갱신하면 이후 모든 호출에 반영된다.
const AI_DEFAULTS = { model: "claude-haiku-4-5-20251001", maxTokens: 8000 };

// PBS 추천의 AI 미사용 모드 설정 저장 키 (localStorage)
const PBS_NOAI_KEY = "spiderqa_pbs_noai";

// ══ 한국어 조사 처리 ════════════════════════════════════════════════
// OSSP명·가이드명처럼 값이 바뀌는 자리 뒤의 조사를 받침 유무로 자동 선택한다.
// 예) "정보공학기반 개발 방법론"을 / "애자일 프로세스"를
function hasJongseong(word) {
  // 닫는 괄호·따옴표·구두점은 건너뛰고 실제 마지막 글자로 판정
  //  예) 조직 표준 프로세스(OSSP) → P, "작성 가이드" → 드
  const s = String(word || "").trim().replace(/[)\]}>」』"'\s.,!?]+$/, "");
  const c = s.slice(-1);
  if (!c) return false;
  const code = c.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;   // 한글 음절: 종성 유무
  if (/[0-9]/.test(c)) return "013678".includes(c);      // 영·일·삼·육·칠·팔에 받침
  if (/[a-zA-Z]/.test(c)) return "lmnrLMNR".includes(c); // 엘·엠·엔·알에 받침
  return false;   // 그 외 기호는 받침 없음으로 간주
}
const josaEul = w => hasJongseong(w) ? "을" : "를";   // 목적격
const josaI   = w => hasJongseong(w) ? "이" : "가";   // 주격
const josaEun = w => hasJongseong(w) ? "은" : "는";   // 보조사

// ══ 프로젝트 수행 팀원 ══════════════════════════════════════════════
// 작업자 입력 정책은 MS Project·Smartsheet의 지배적 관행을 따른다.
//   · 작업자 란은 자유 입력 허용 (등록 인원 선택은 콤보박스로 편의 제공)
//   · 쉼표(,)로 복수 작업자 지정 — MS Project의 Resource Names 필드와 동일
//   · 미등록 인원을 입력하면 팀원 명단에 자동 등록 (MS Project 기본 동작)
//     자동 등록분은 "자동" 배지로 표시해 STEP 1에서 검토·정정할 수 있게 한다.
// 이유: 작업자는 로그인 계정이 아니라 문서에 기재되는 이름이므로, 계정 기반
//       도구(Jira·Asana)식 제한은 부적합하다. 착수 시점에 명단이 미확정인
//       경우가 많은 SI 프로젝트 특성상 입력 차단은 작업을 막는 부작용이 크다.
// 역할 목록 — 과제 유형(track)에 종속. 역할 칸은 자유 입력이며 목록은 입력 제안(datalist)이다.
// PM·PL·QA·CM·기타는 두 과제 유형 공통 표기(같은 문자열)로 두어 과제 유형을 바꿔도 그대로 맞는다.
const TEAM_ROLE_OPTIONS = ["PM", "PL", "품질보증담당자(QA)", "형상관리담당자(CM)",
  "분석/설계", "개발", "테스트", "아키텍트", "DBA", "인프라", "기술지원", "고객담당", "기타"];
// ASPICE 자동차 과제 — 역할 ↔ 주로 맡는 프로세스. when: 개발 범위·적용 범위에 따라 표시 여부 결정
const ASPICE_TEAM_ROLES = [
  { value: "PM",                  note: "MAN.3 프로젝트 관리" },
  { value: "SW PL",               note: "SW 개발 리드" },
  { value: "시스템 엔지니어",      note: "SYS.2·SYS.3 시스템 요구·아키텍처" },
  { value: "SW 아키텍트",          note: "SWE.2 SW 아키텍처" },
  { value: "SW 개발자",            note: "SWE.3·SWE.4 상세설계·구현·단위검증" },
  { value: "SW 통합·검증 담당",     note: "SWE.5·SWE.6 SW 통합·검증" },
  { value: "시스템 통합·검증 담당", note: "SYS.4·SYS.5 시스템 통합·검증" },
  { value: "HW 엔지니어",          note: "HWE.1~4 HW 엔지니어링", when: "HW" },
  { value: "품질보증담당자(QA)",   note: "SUP.1 품질보증" },
  { value: "형상관리담당자(CM)",   note: "SUP.8 형상관리 (SUP.9·10 겸임 흔함)" },
  { value: "협력사 관리 담당",      note: "ACQ.4 공급자 모니터링", when: "ACQ" },
  { value: "고객 대응(OEM·Tier1)", note: "고객 요구·변경 요청 창구" },
  { value: "기타",                note: "" },
];
// 두 과제 유형 모두에서 자연스러운 역할 — 과제 유형을 바꿔도 경고하지 않는다
const TEAM_ROLE_COMMON = ["PM", "PL", "품질보증담당자(QA)", "형상관리담당자(CM)", "기타"];
// 과제 유형·개발 범위·적용 범위에 맞는 역할 제안 목록 [{ value, note }]
function teamRolesFor(form, tailoring) {
  if (form?.track !== "aspice") return TEAM_ROLE_OPTIONS.map(v => ({ value: v, note: "" }));
  const dev = aspiceDevOf(form);
  const scope = tailoring?.aspiceScope || aspiceScopeDefault(dev);
  return ASPICE_TEAM_ROLES.filter(r => r.when === "HW" ? dev !== "SW" : r.when === "ACQ" ? aspiceGroupOn(scope, "ACQ") : true);
}
// 입력된 역할이 현재 과제 유형·범위와 어긋나면 사유를 돌려준다 (직접 입력한 고유 역할은 문제 삼지 않음)
function teamRoleMismatch(role, form, tailoring) {
  const r = String(role || "").trim();
  if (!r) return "";
  const cur = teamRolesFor(form, tailoring).map(x => x.value);
  if (cur.includes(r) || TEAM_ROLE_COMMON.includes(r)) return "";
  if (form?.track === "aspice") {
    if (TEAM_ROLE_OPTIONS.includes(r)) return "일반 SI 과제 역할";
    const a = ASPICE_TEAM_ROLES.find(x => x.value === r);
    if (a?.when === "HW") return "개발 범위에 HW가 없음";
    if (a?.when === "ACQ") return "적용 범위에 ACQ.4가 꺼져 있음";
    return "";
  }
  return ASPICE_TEAM_ROLES.some(x => x.value === r) ? "ASPICE 자동차 과제 역할" : "";
}

function newMemberId() { return "m" + Math.random().toString(36).slice(2, 9); }
// 이름 비교용 정규화 — 공백 차이("홍 길동" vs "홍길동")를 동일인으로 본다
const memberKey = n => String(n || "").replace(/\s/g, "");
// 이름이 입력된 팀원만 추출 (편집 중 빈 행 제외)
function teamNames(members) {
  const out = [], seen = new Set();
  (members || []).forEach(m => {
    const n = String(m?.name || "").trim();
    if (!n || seen.has(memberKey(n))) return;
    seen.add(memberKey(n)); out.push(n);
  });
  return out;
}
// 저장·전달용 정규화 — 빈 이름 행 제거, 동명이인 중복 병합
function normalizeMembers(list) {
  const out = [], seen = new Set();
  (list || []).forEach(m => {
    const name = String(m?.name || "").trim();
    if (!name || seen.has(memberKey(name))) return;
    seen.add(memberKey(name));
    out.push({ id: m?.id || newMemberId(), name, role: String(m?.role || "").trim(), org: String(m?.org || "").trim(), auto: !!m?.auto });
  });
  return out;
}
// 작업자 문자열 ↔ 배열 (쉼표 구분, MS Project Resource Names 규칙)
function parseAssignees(v) { return String(v || "").split(",").map(x => x.trim()).filter(Boolean); }
function joinAssignees(a) { return a.join(", "); }
// 작업자 문자열에서 팀원 명단에 없는 이름만 추출
function unknownAssignees(v, members) {
  const known = new Set(teamNames(members).map(memberKey));
  const seen = new Set(); const out = [];
  parseAssignees(v).forEach(n => { const k = memberKey(n); if (!known.has(k) && !seen.has(k)) { seen.add(k); out.push(n); } });
  return out;
}

// 작업자 입력 셀 — [자유 입력란] + [팀원 선택 팝업]
// 팝업에서 팀원을 체크/해제하면 쉼표로 이어붙이거나 제거한다(여러 명 연속 선택 가능).
// 표 컨테이너가 overflow:auto 라 팝업이 잘리지 않도록 document.body에 포털로 띄우고 position:fixed로 배치한다.
function AssigneeCell({ value, onChange, onCommit, members, inputStyle }) {
  const names = teamNames(members);
  const roleOf = {};
  (members || []).forEach(m => { const n = String(m?.name || "").trim(); if (n && !roleOf[memberKey(n)]) roleOf[memberKey(n)] = String(m?.role || "").trim(); });
  const cur = parseAssignees(value);
  const curKeys = new Set(cur.map(memberKey));
  const unknown = unknownAssignees(value, members);
  const warn = unknown.length > 0;
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);   // null = 닫힘, { left, top, width, maxH }
  const [hi, setHi] = useState(0);        // 키보드 강조 인덱스

  const openPop = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 190;
    const rowH = 30, want = Math.min(names.length, 8) * rowH + 38;
    const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
    const up = below < want && above > below;
    const maxH = Math.max(120, Math.min(want, up ? above : below));
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ left, width, maxH, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
    setHi(0);
  };
  const close = () => setPos(null);
  const toggle = (n) => {
    const k = memberKey(n);
    onChange(curKeys.has(k) ? joinAssignees(cur.filter(x => memberKey(x) !== k)) : joinAssignees([...cur, n]));
  };

  useEffect(() => {
    if (!pos) return;
    const onDown = e => { if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close(); };
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); close(); btnRef.current?.focus(); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;   // 입력란 타이핑과 충돌 방지
      else if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, names.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
      else if (e.key === "Enter" || e.key === " ") { if (names[hi]) { e.preventDefault(); toggle(names[hi]); } }
    };
    const onScroll = e => { if (!popRef.current?.contains(e.target)) close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  });

  const disabled = names.length === 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <input value={value || ""}
        onChange={e => onChange(e.target.value)}
        onBlur={() => onCommit?.()}
        placeholder={names.length ? "선택 또는 입력" : "예: 홍길동, 김철수"}
        title={warn ? `팀원 미등록: ${unknown.join(", ")} — 입력란을 벗어나면 팀원 명단에 자동 등록됩니다.`
                    : "쉼표(,)로 여러 명을 지정할 수 있습니다."}
        style={warn ? { ...inputStyle, borderBottom: `1px solid ${T.amber}`, color: T.amber } : inputStyle} />
      <button ref={btnRef} type="button" disabled={disabled}
        onClick={() => (pos ? close() : openPop())}
        title={names.length ? "등록된 팀원에서 선택 (여러 명 선택 가능)" : "STEP 1에서 팀원을 먼저 등록하세요"}
        style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: pos ? T.accent + "22" : "transparent", color: disabled ? T.border : T.accent,
          border: "none", borderRadius: 5, cursor: disabled ? "default" : "pointer", padding: 0, fontSize: 11, fontFamily: "inherit" }}>
        {pos ? "▴" : "▾"}
      </button>
      {pos && createPortal(
        <div ref={popRef} role="listbox" aria-multiselectable="true"
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH,
            zIndex: 1000, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "inherit" }}>
          <div style={{ padding: "7px 10px", fontSize: 10, color: T.muted, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
            <span>팀원 선택 · {cur.filter(n => names.some(x => memberKey(x) === memberKey(n))).length}명 지정</span>
            <span onClick={close} style={{ cursor: "pointer" }}>닫기</span>
          </div>
          <div style={{ overflowY: "auto", padding: 4 }}>
            {names.map((n, i) => {
              const on = curKeys.has(memberKey(n));
              const role = roleOf[memberKey(n)];
              return (
                <div key={n} role="option" aria-selected={on}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggle(n)}
                  style={{ display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 8px", borderRadius: 6, cursor: "pointer",
                    background: i === hi ? T.accent + "1F" : "transparent", color: on ? T.text : T.muted, fontSize: 12 }}>
                  <span style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 4, border: `1px solid ${on ? T.accent : T.border}`,
                    background: on ? T.accent : "transparent", color: "#fff", fontSize: 10, lineHeight: "13px", textAlign: "center" }}>{on ? "✓" : ""}</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: on ? 600 : 400 }}>{n}</span>
                  {role && <span style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{role}</span>}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// 문서 생성 공용 설정 — 설정(설정 → 조직·문서 기본값)에서 저장한 값을 앱 기동 시 주입한다.
// docxStdParts / getDocLogos / makePdpDocx / makeReqDocx 등 문서 생성 함수가 모두
// 이 단일 지점을 참조하므로, 호출부마다 meta를 다시 엮을 필요가 없다.
const DOC_SETTINGS = {
  orgName: "", orgNameEn: "", dept: "", docFooter: "",
  clientLogo: null, companyLogo: null,
  codePrefix: "", author: "", reviewer: "", approver: "", distribution: "",
};

function applyDocSettings(s) {
  const o = s?.organization || {}, d = s?.doc_defaults || {};
  Object.assign(DOC_SETTINGS, {
    orgName: o.orgName || "", orgNameEn: o.orgNameEn || "", dept: o.dept || "",
    docFooter: o.docFooter || "", clientLogo: o.clientLogo || null, companyLogo: o.companyLogo || null,
    codePrefix: d.codePrefix || "", author: d.author || "", reviewer: d.reviewer || "",
    approver: d.approver || "", distribution: d.distribution || "",
  });
}

// 문서번호에 조직 접두어 부여 (이미 접두어가 붙어 있으면 중복 부여하지 않음 — 멱등)
// 문서 메타 항목 해석 — 모든 항목에 동일한 우선순위를 적용한다.
//   위저드 입력값(meta.*) → 저장된 프로젝트(tailoring.docMeta) → 설정의 조직 기본값(DOC_SETTINGS)
// 실무 기준: 수행사명·부서는 조직 상수라 대부분 설정값을 그대로 쓰고(컨소시엄 등 예외만 위저드에서 지정),
//           문서번호 접두어는 사업마다 달라 위저드에서 지정하는 것이 일반적이다.
function docMetaValue(meta, key) {
  const dm = meta?.tailoring?.docMeta || {};
  return String(meta?.[key] || dm[key] || DOC_SETTINGS[key] || "").trim();
}

// 이 프로젝트에 적용될 문서번호 접두어
function docCodePrefix(meta) { return docMetaValue(meta, "codePrefix"); }

// 문서코드에 접두어 부여. 이미 접두어가 붙어 있으면 중복 부여하지 않는다(멱등).
function docCodeWithPrefix(code, meta) {
  const c = String(code || "").trim();
  const p = docCodePrefix(meta);
  if (!c || c === "-") return p || "-";
  if (!p || c === p || c.startsWith(p + "-")) return c;
  return `${p}-${c}`;
}

// 고객사 약칭 코드 — 접두어가 없을 때만 문서번호에 사용한다.
// 한글 상호를 그대로 자르면 "(주)한"처럼 깨지므로, 영문·숫자만 추출해 쓰고 없으면 PRJ로 대체한다.
function clientCode(client) {
  const alnum = String(client || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return alnum ? alnum.slice(0, 6) : "PRJ";
}

// 프로젝트 문서번호 조립.
//   접두어 있음 → {접두어}-{문서코드}-{연도}   (접두어가 사업을 식별하므로 고객사 코드 불필요)
//   접두어 없음 → {문서코드}-{고객사코드}-{연도}
function projectDocNo(meta, baseCode) {
  const year = new Date().getFullYear();
  const p = docCodePrefix(meta);
  return p ? `${p}-${baseCode}-${year}` : `${baseCode}-${clientCode(meta?.client)}-${year}`;
}

// 문서 작성/검토/승인자·작성조직 결정
function docApprovers(meta) {
  const org = docMetaValue(meta, "orgName");
  const dept = docMetaValue(meta, "dept");
  return {
    author: docMetaValue(meta, "author") || meta?.pm || "",
    reviewer: docMetaValue(meta, "reviewer"),
    approver: docMetaValue(meta, "approver"),
    orgNameEn: docMetaValue(meta, "orgNameEn"),
    org: [org, dept].filter(Boolean).join(" · "),
    distribution: docMetaValue(meta, "distribution"),
  };
}

// 위저드에서 프로젝트별로 덮어쓸 수 있는 문서 메타 필드
const DOC_OVERRIDE_FIELDS = ["codePrefix", "author", "reviewer", "approver", "distribution", "orgName", "orgNameEn", "dept"];

// ── 시스템명 ──────────────────────────────────────────────────────────
// 문서 머리말의 '시스템'란은 구축 대상 시스템의 이름이며 프로젝트(사업)명과 다르다.
// 프로젝트 고유값이므로 조직 기본값 체인(docMeta)에 태우지 않고 기본정보에서 직접 받는다.
// 비워두면 프로젝트명 끝의 사업 접미어를 떼어 도출한다.
//   "협력사 납품관리 시스템 구축" → "협력사 납품관리 시스템"
//   "차세대 ERP 구축 사업"        → "차세대 ERP"
// 긴 접미어를 먼저 검사한다 — "재구축"보다 "구축"이 먼저 걸리면 "…재"만 남는다
const PROJECT_NAME_SUFFIXES = ["고도화", "재구축", "프로젝트", "구축", "개발", "전환", "이행", "구현", "도입", "사업", "용역", "과업"]
  .sort((a, b) => b.length - a.length);
function deriveSystemName(projectName) {
  const src = String(projectName || "").trim();
  let s = src;
  for (let i = 0; i < 3; i++) {           // "…시스템 구축 사업"처럼 겹쳐 붙은 경우 대응
    const before = s;
    for (const suf of PROJECT_NAME_SUFFIXES) {
      const re = new RegExp(`[\\s·]*${suf}$`);
      if (!re.test(s)) continue;
      const cut = s.replace(re, "").trim();
      if (cut) { s = cut; break; }        // 전부 잘려 빈 값이 되면 자르지 않는다
    }
    if (s === before) break;
  }
  return s || src;
}
// meta는 위저드에서는 projectForm, 저장 프로젝트에서는 project 객체가 넘어온다
function systemNameOf(meta) {
  const v = String(meta?.systemName || meta?.tailoring?.systemName || "").trim();
  return v || deriveSystemName(meta?.name);
}
const DISTRIBUTION_OPTIONS = ["사내 한정", "고객사 공유", "대외비", "공개"];

const ROLE_LABELS = { admin: "관리자", pm: "PM", qa: "품질보증담당자", viewer: "조회 전용", legacy: "재인증 필요" };
// 실제로 부여 가능한 역할 (서버 _auth.js의 ROLES와 일치). legacy는 표시 전용이라 제외.
const ASSIGNABLE_ROLES = ["admin", "pm", "qa", "viewer"];
const ROLE_DESC = {
  admin: "설정·사용자·API 키를 포함한 전체 관리 권한",
  pm: "프로젝트 착수·WBS·산출물 생성 및 편집",
  qa: "품질보증 활동 수행 및 산출물 생성·검토",
  viewer: "프로젝트·라이브러리 조회만 가능",
  legacy: "이전 버전 세션 — 설정 기능 사용 시 재로그인이 필요합니다",
};

function LoginGate({ onSuccess }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!id || !pw) { setErr("아이디와 비밀번호를 입력하세요."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/login", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ id, pw }),
      });
      const data = await res.json().catch(()=>({}));
      if (res.ok && data.ok) { onSuccess(data.token, data.user); }
      else { setErr(data.error || "로그인에 실패했습니다."); }
    } catch(e){ setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:T.bg, color:T.text, fontFamily:"'DM Sans','Apple SD Gothic Neo',sans-serif", padding:16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:"100%", maxWidth:360, background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:32 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:18, color:"#fff" }}>{APP_MARK}</div>
          <div>
            <div style={{ fontSize:18, fontWeight:700 }}>{APP_NAME}</div>
            <div style={{ fontSize:11, color:T.muted }}>{APP_TAGLINE}</div>
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>로그인</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input value={id} onChange={e=>setId(e.target.value)} placeholder="아이디"
            onKeyDown={e=>{ if(e.key==="Enter") submit(); }}
            style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"11px 14px", color:T.text, fontSize:14, fontFamily:"inherit", outline:"none" }} />
          <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호" type="password"
            onKeyDown={e=>{ if(e.key==="Enter") submit(); }}
            style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"11px 14px", color:T.text, fontSize:14, fontFamily:"inherit", outline:"none" }} />
          {err && <div style={{ color:T.red, fontSize:12 }}>{err}</div>}
          <Btn onClick={submit} disabled={busy} style={{ marginTop:4, justifyContent:"center" }}>
            {busy ? "확인 중…" : "로그인"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// AI JSON 호출 (모듈 공용): /api/chat 프록시 → JSON 파싱·잘림 복구 — 컴포넌트 밖에서도 사용
async function callClaudeJson(prompt, maxTokens=AI_DEFAULTS.maxTokens, model=AI_DEFAULTS.model) {
  // /api/chat 는 조직의 Claude API 키를 소비하므로 서버에서 세션 토큰을 검증한다 → 인증 헤더 필수
  const _tk = getToken();
  const res = await fetch("/api/chat", {
    method:"POST",
    headers: _tk ? { "Content-Type":"application/json", "Authorization":`Bearer ${_tk}` }
                 : { "Content-Type":"application/json" },
    body:JSON.stringify({ model, max_tokens:maxTokens,
      system:"You are a project management expert. Always respond with valid JSON only, no markdown, no preamble. Keep string values concise to ensure the JSON is complete and not truncated.",
      messages:[{ role:"user", content:prompt }] }),
  });

  const data = await res.json();

  // 에러 응답 방어: Anthropic/서버가 에러를 주면 content가 없음
  if (!res.ok || data.error || !data.content) {
    if (res.status === 401) throw new Error("세션이 만료되었거나 유효하지 않습니다. 다시 로그인한 뒤 시도하세요.");
    if (res.status === 403) throw new Error("AI 생성 권한이 없습니다. (열람 전용 계정) 관리자에게 문의하세요.");
    const msg = data?.detail?.error?.message || data?.error?.message || data?.error || `요청 실패 (status ${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const text = data.content?.map(b=>b.text||"").join("")||"";
  if (!text.trim()) throw new Error("AI 응답이 비어 있습니다.");

  // JSON 파싱 방어: 모델이 마크다운/설명을 섞거나 응답이 잘려도 최대한 복구
  // 0) 문자열 내부의 리터럴 개행·탭·CR을 이스케이프로 정규화
  //    (모델이 작성 가이드를 따라 장문·다단 상세를 쓸 때 JSON 문자열에 실제 줄바꿈을 넣는 경우가 잦음 → JSON.parse 실패 원인)
  const escapeCtrlInStrings = (s) => {
    let out = "", inStr = false, esc = false;
    for (const ch of s) {
      if (inStr) {
        if (esc) { out += ch; esc = false; continue; }
        if (ch === "\\") { out += ch; esc = true; continue; }
        if (ch === '"') { inStr = false; out += ch; continue; }
        if (ch === "\n") { out += "\\n"; continue; }
        if (ch === "\r") { continue; }
        if (ch === "\t") { out += "\\t"; continue; }
        out += ch; continue;
      }
      if (ch === '"') inStr = true;
      out += ch;
    }
    return out;
  };
  const cleaned = escapeCtrlInStrings(text.replace(/```json|```/g,"").trim());
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 1) 첫 '{'부터 마지막 '}'까지 추출 재시도
  const start = cleaned.indexOf("{");
  let end = cleaned.lastIndexOf("}");
  if (start > -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
  }
  // 2) 응답이 중간에 잘린 경우: 문자열·배열·객체 상태를 추적해 순서대로 닫아 복구 시도
  //    (예: {"reason":"요구사항이 ← 문자열이 열린 채 잘려도 복구 가능)
  if (start > -1) {
    const frag = cleaned.slice(start);
    let inStr = false, esc = false;
    const stack = [];
    for (const ch of frag) {
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") stack.push("}");
        else if (ch === "[") stack.push("]");
        else if (ch === "}" || ch === "]") stack.pop();
      }
    }
    let repaired = frag;
    if (inStr) repaired += '"';                    // 열린 문자열 닫기
    repaired = repaired.replace(/,\s*$/, "");      // 끝에 남은 쉼표 제거
    repaired = repaired.replace(/:\s*$/, ':""');   // 값 없이 끝난 키 보정
    while (stack.length) repaired += stack.pop();  // 열린 배열/객체를 역순으로 닫기
    try { return JSON.parse(repaired); } catch (_) {}
  }
  // 3) 그래도 실패하면 원문 앞부분을 포함해 원인 파악을 돕는다
  throw new Error("AI 응답을 JSON으로 해석할 수 없습니다. 응답 일부: " + cleaned.slice(0, 120));
  }

export default function SpiderQaAgent() {
  // 세션: 저장된 토큰을 디코딩해 복원. 서명·만료가 깨진 구버전 토큰은 null이 되어
  // 자동으로 로그인 화면이 표시된다(강제 재로그인).
  const [session, setSession] = useState(() => decodeSession(getToken()));
  const authed = !!session;
  const role = session?.role || "viewer";
  const isAdmin = role === "admin";
  // 드롭 영역 밖에 파일을 놓으면 브라우저가 그 파일을 열어 화면을 떠나버림(작성 중 내용 유실) → 막음.
  // 드롭 영역(FileDrop·기존 영역)이 먼저 preventDefault 하므로 defaultPrevented면 건드리지 않는다.
  useEffect(() => {
    const guard = e => {
      if (e.defaultPrevented || !dragHasFiles(e)) return;
      e.preventDefault();
      if (e.type === "dragover" && e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => { window.removeEventListener("dragover", guard); window.removeEventListener("drop", guard); };
  }, []);

  const logout = () => { try { localStorage.removeItem(AUTH_KEY); } catch {} setSession(null); setAppSettings(null); setPage("dashboard"); };

  // 앱 전역 설정 (조직·문서 기본값, QA 기본정책, AI 모델). 로그인 후 1회 로드.
  const [appSettings, setAppSettings] = useState(null);
  const [settingsErr, setSettingsErr] = useState(null);

  async function fetchSettings({ applyDefaults = false } = {}) {
    if (!getToken()) return null;
    try {
      const s = await apiFetch("/api/settings");
      setAppSettings(s); setSettingsErr(null);
      if (s?.ai?.model) AI_DEFAULTS.model = s.ai.model;
      if (s?.ai?.maxTokens) AI_DEFAULTS.maxTokens = Number(s.ai.maxTokens) || AI_DEFAULTS.maxTokens;
      applyDocSettings(s);                       // 조직·문서 기본값을 문서 생성기에 주입
      if (applyDefaults) applySettingsDefaults(s);
      return s;
    } catch (e) {
      // 401이어도 로그아웃시키지 않는다. 세션만 '재인증 필요'로 표시하고 앱 사용은 유지.
      // 428(설정 테이블 미생성)은 설정 화면에서 설치 SQL을 안내한다.
      if (e.status === 401) setSession(p => (p && p.needsReauth ? p : { ...(p || {}), needsReauth: true }));
      setSettingsErr(e);
      return null;
    }
  }

  // QA 기본 정책·기본 로고를 신규 프로젝트 초기값에 반영 (진행 중 입력은 건드리지 않음)
  function applySettingsDefaults(s) {
    const q = s?.qa_defaults, o = s?.organization;
    if (q) {
      setTailoring(t => ({ ...t, scale: q.scale || t.scale, method: q.method || t.method,
        process: { ...(t.process || {}), level: q.processLevel || t.process?.level || "L3" } }));
      if (q.sdlcFactors && Object.keys(q.sdlcFactors).length) setSdlcFactors(f => ({ ...f, ...q.sdlcFactors }));
      if (Array.isArray(q.holidays) && q.holidays.length) setWbsSetup(w => (w.holidays?.length ? w : { ...w, holidays: q.holidays }));
    }
    if (o) {
      setProjectForm(p => ({ ...p,
        clientLogo: p.clientLogo || o.clientLogo || null,
        companyLogo: p.companyLogo || o.companyLogo || null }));
    }
  }

  const [page, setPage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [projectForm, setProjectForm] = useState({ name:"", client:"", type:"신규개발", systemName:"", startDate:"", endDate:"", pm:"",
    members:[],   // 프로젝트 수행 팀원 [{id,name,role,org,auto}] — WBS 작업자 콤보박스의 원천
    ...DOC_OVERRIDE_FIELDS.reduce((o,k)=>{ o[k]=""; return o; }, {}), clientLogo:null, companyLogo:null });
  const [selectedOSSP, setSelectedOSSP] = useState(null);
  const [customOSSP, setCustomOSSP] = useState([]);
  const [builtinOSSP, setBuiltinOSSP] = useState([]);   // DB에 시딩된 기본 제공 방법론 (자산 업로드용 UUID 보유)
  const [sdlcFactors, setSdlcFactors] = useState({ req_clarity:"보통", req_volatility:"보통", delivery:"단계적", risk:"보통", regulation:"보통", team:"집중" });
  const [selectedSDLC, setSelectedSDLC] = useState(null);
  const [sdlcRecommendation, setSdlcRecommendation] = useState(null);  // { recommended, reason, alternatives }
  const [recommending, setRecommending] = useState(false);
  const [tailoring, setTailoring] = useState({ scale:"중형", method:"UML", excluded:{}, doc_level:"표준", review_cycle:"격주", test_level:"통합", risk:"강화" });
  const [pdpData, setPdpData] = useState(null);
  const [wbsData, setWbsData] = useState(null);
  const [wbsSetup, setWbsSetup] = useState({ pbsText: "", selected: {} });   // PBS×FBS 매트릭스 설정
  // PBS 추천 AI 미사용 모드 — 체크 시 /api/chat 호출 없이 프로젝트 유형별 표준 프리셋을 즉시 적용
  // (폐쇄망 환경·감리 재현성 확보용. 브라우저에 설정을 영속시켜 프로젝트 간 유지)
  const [pbsNoAi, setPbsNoAi] = useState(() => { try { return localStorage.getItem(PBS_NOAI_KEY) === "1"; } catch { return false; } });
  function togglePbsNoAi(v) { setPbsNoAi(!!v); try { localStorage.setItem(PBS_NOAI_KEY, v ? "1" : "0"); } catch {} }
  const [deliverablesData, setDeliverablesData] = useState(null);
  const [requirements, setRequirements] = useState(null);   // AI 작성 요구사항: { items:[...], sourceName, updatedAt }
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [genProgress, setGenProgress] = useState(null);   // 산출물 생성 진행 상황: { percent, label }
  const [editingId, setEditingId] = useState(null);   // 완료된 프로젝트 수정 모드: 수정 대상 프로젝트 id
  const [savingProject, setSavingProject] = useState(false);   // 완료 버튼 비활성화용
  const savingRef = useRef(false);                             // 연타 즉시 차단용 (state보다 빠름)

  const nav = (p) => { setPage(p); setGenError(null); setMenuOpen(false); };

  useEffect(() => { fetchProjects(); fetchOSSP(); }, []);
  // 로그인 직후·세션 복원 시 전역 설정 로드 → AI 모델·기본 정책 적용
  useEffect(() => { if (session) fetchSettings({ applyDefaults: true }); }, [session?.uid, session?.needsReauth]);

  // 앱 기동 시 세션 자동 연장 — 만료됐어도 유예기간 안이면 서버가 재발급해 준다.
  // 실패해도 절대 로그아웃시키지 않고, 필요한 순간에만 화면 안에서 재인증을 요구한다.
  useEffect(() => {
    const t = getToken();
    if (!t || !t.includes(".")) return;   // 구버전 토큰은 연장 대상이 아님 (재인증 카드로 처리)
    (async () => {
      try {
        const r = await fetch("/api/login", { method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ action:"refresh", token:t }) });
        const d = await r.json().catch(()=>({}));
        if (r.ok && d.token) { try { localStorage.setItem(AUTH_KEY, d.token); } catch {} setSession(decodeSession(d.token)); }
      } catch { /* 네트워크 오류 시 기존 세션 유지 */ }
    })();
  }, []);

  // 어떤 API든 401이 오면 세션을 '재인증 필요'로 표시 (전역 fetch 래퍼가 발생시키는 이벤트)
  useEffect(() => {
    const onUnauth = () => setSession(p => (p && p.needsReauth ? p : { ...(p || {}), needsReauth: true }));
    window.addEventListener("spiderqa:unauth", onUnauth);
    return () => window.removeEventListener("spiderqa:unauth", onUnauth);
  }, []);
  // 화면 안에서 재로그인 (전체 로그아웃 없이 세션만 교체)
  const reauth = (token) => { try { localStorage.setItem(AUTH_KEY, token || ""); } catch {} setSession(decodeSession(token)); setSettingsErr(null); };

  async function fetchOSSP() {
    try {
      const res = await fetch('/api/ossp');
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped = data.map(o => ({
          id: o.id,
          label: o.name,                 // UI는 label 사용 → DB의 name 매핑
          version: o.version || '',
          desc: o.description || '',
          phases: Array.isArray(o.phases) ? o.phases : [],
          custom: !o.is_builtin,
          approach: /ASPICE|자동차|V-Model/i.test(o.name || '') ? '예측형' : undefined,   // 자동차 OSSP → 예측형 SDLC 적합 표시
          builtin: !!o.is_builtin,       // 기본 제공 여부 (서버 자동 시딩)
        }));
        setCustomOSSP(mapped.filter(o => !o.builtin));   // 위저드 StepOSSP 중복 방지: 사내 OSSP만
        setBuiltinOSSP(mapped.filter(o => o.builtin));
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

  async function callClaude(prompt, maxTokens=AI_DEFAULTS.maxTokens, model=AI_DEFAULTS.model) {
    return callClaudeJson(prompt, maxTokens, model);
  }
  
  // SDLC 추천 — AI 미사용. PMBOK 8판 개발접근법 선정 요인 기반 결정적 스코어링(ruleBasedSDLC)
  function recommendSDLC() {
    setRecommending(true); setGenError(null); setSdlcRecommendation(null);
    try {
      const result = ruleBasedSDLC(sdlcFactors, projectForm.type);
      setSdlcRecommendation(result);
      if (result?.recommended) setSelectedSDLC(result.recommended);
    } catch(e) { setGenError("SDLC 추천 실패: "+e.message); }
    setRecommending(false);
  }

  async function generatePDP() {
    setGenerating(true); setGenError(null); setPdpData(null);
    try {
      // 선택한 OSSP에 해당하는 테일러링 가이드로 확정 산출물을 단계별로 요약
      const guide = getGuideForOSSP(selectedOSSP);
      const scaleLabel = guide.scaleOptions?.find(o=>o.value===(tailoring.scale||"중형"))?.label || (tailoring.scale||"중형");
      const pdpNotes = tailoring.notes || {};
      const applied = classifyDeliverables(tailoring.scale||"중형", tailoring.method||"UML", guide, tailoring.aspiceScope)
        .filter(d => {
          if (d.required) return true;   // 필수(M) 산출물은 항상 적용 (테일러링 대상 아님)
          const ov = pdpNotes[`${d.phase}:${d.code}`]?.applied;   // PDP 화면에서 수정한 적용 여부 우선
          return ov !== undefined ? ov : !(tailoring.excluded||{})[d.code];
        });
      const byPhase = {};
      applied.forEach(d => { (byPhase[d.phase] = byPhase[d.phase] || []).push(d.name); });
      const tailoringSummary = Object.entries(byPhase)
        .map(([ph, names]) => `${ph}: ${names.join(", ")}`).join(" / ");

      // 프로세스 테일러링(관리 프로세스) 요약 — PDP 개요 작성 근거에 포함
      const procApplicable2 = resolveMgmt(tailoring, guide).filter(r => r.status !== "해당없음");
      const procChanged = procApplicable2.filter(r => r.status !== "적용");
      const procSummary = `${guide.mgmtActivities ? "ASPICE 관리활동 · 목표 " + mgmtLevelLabel(tailoring, guide) : "관리 성숙도 수준 " + (tailoring.process?.level||"L3")} · 적용대상 ${procApplicable2.length}건 (적용 ${procApplicable2.filter(r=>r.status==="적용").length} / 변경적용 ${procApplicable2.filter(r=>r.status==="변경적용").length} / 미적용 ${procApplicable2.filter(r=>r.status==="미적용").length})`
        + (procChanged.length ? ` — 변경·미적용: ${procChanged.slice(0,10).map(r=>`${r.process}${r.activity?"›"+r.activity:""}(${r.status}${r.reason?": "+r.reason:""})`).join(", ")}` : "");

      // PDP 개요 — AI 미사용. 테일러링 확정 결과를 근거로 표준 문안 템플릿으로 생성 (재현성·즉시성 확보)
      const phaseCount = Object.keys(byPhase).length;
      const level = mgmtLevelLabel(tailoring, guide);
      const levelWord = guide.mgmtActivities ? "목표 능력수준" : "관리 성숙도 수준";
      const designTxt = guide.hasDesignMethod ? `, 설계방식 ${tailoring.method||"UML"}` : "";
      const period = (projectForm.startDate && projectForm.endDate) ? `${projectForm.startDate}~${projectForm.endDate}` : "";
      const strictReg = sdlcFactors?.regulation === "엄격";
      const osspLabel = selectedOSSP?.label || "조직 표준 프로세스(OSSP)";
      const result = {
        overview: {
          purpose: `본 문서는 ${projectForm.client ? projectForm.client + " " : ""}"${projectForm.name}" 프로젝트(유형: ${projectForm.type})에 적용할 프로젝트 정의 프로세스(PDP)를 수립하기 위해, ${osspLabel}${josaEul(osspLabel)} 「${guide.title}」 기준으로 테일러링한 결과를 정의하는 것을 목적으로 한다. PMBOK® 8판의 테일러링 원칙에 따라 ${guide.scaleTitle || "프로젝트 규모"}(${scaleLabel})${designTxt} 등 프로젝트 특성을 반영하였다.`,
          scope: `적용 범위는 ${period ? "사업 기간(" + period + ") 중 " : ""}${selectedSDLC?.label || "선정 SDLC"} 기반 ${phaseCount}개 단계의 확정 산출물 ${applied.length}종과, 「${guide.title}」에 따른 관리활동(${levelWord} ${level}, 적용대상 ${procApplicable2.length}건)의 이행 활동 전체로 한다. 단계별 확정 산출물: ${tailoringSummary}`,
          objectives: [
            `테일러링 확정 산출물 ${applied.length}종의 단계별 작성·검토·승인 이행`,
            `필수(M) 산출물의 예외 없는 100% 작성 및 베이스라인 관리`,
            `관리활동 ${levelWord} ${level} 기준 이행 및 품질보증 활동 수행`,
            strictReg ? "법정 감리·인증 대응을 위한 프로세스 증적의 체계적 확보" : "PMBOK® 8판 품질 성과영역 기준의 예방 중심 품질 관리 정착",
          ],
        },
      };
      setPdpData(result);
    } catch(e) { setGenError("PDP 생성 실패: "+e.message); }
    setGenerating(false);
  }

  // PBS(Product Breakdown Structure) 초안 추천 — WBS 생성 자체는 매트릭스 기반 결정적 로직으로 수행
  // pbsNoAi(AI 미사용 모드)가 켜져 있으면 API 호출 없이 프로젝트 유형별 표준 프리셋을 그대로 적용한다.
  function applyPbsPreset() {
    const preset = projectForm.track === "aspice" ? aspicePbsPreset(projectForm) : (PBS_PRESETS[projectForm.type] || PBS_PRESETS["신규개발"]);
    setWbsSetup(s => ({ ...s, pbsText: preset.join("\n") }));
    return preset.length;
  }
  async function recommendPBS() {
    if (pbsNoAi) {   // AI 미사용 모드 — 즉시·결정적 적용 (동일 입력 → 동일 결과)
      setGenError(null);
      const n = applyPbsPreset();
      setGenProgress({ percent: 100, label: `AI 미사용 모드 · ${projectForm.type || "신규개발"} 표준 프리셋 ${n}개 요소를 적용했습니다. 내용을 편집해 사용하세요.` });
      setTimeout(() => setGenProgress(p => (p && p.percent >= 100 ? null : p)), 2500);
      return;
    }
    setGenerating(true); setGenError(null);
    if (projectForm.track === "aspice") {   // ASPICE 과제: 시스템 요소(HW·SW) 분해 — 개발 범위(SW / HW+SW / HW)를 반드시 반영
      try {
        const dev = aspiceDevOf(projectForm);
        const sys = (projectForm.systemName || projectForm.name || "대상 시스템").trim();
        const scopeRule = dev === "SW" ? "개발 범위는 SW만이다. L2는 'SW'만 사용한다 (HW는 고객·협력사 개발이므로 포함하지 않는다)."
          : dev === "HW" ? "개발 범위는 HW만이다. L2는 'HW'만 사용한다."
          : "개발 범위는 HW+SW다. L2에 'HW'와 'SW'를 모두 반드시 포함한다. HW는 회로 블록(예: MCU, 전원, 센싱·측정, 통신 트랜시버, 구동·출력, 보호·커넥터) 단위로, SW는 소프트웨어 컴포넌트(예: 애플리케이션 기능, 통신 스택, 진단, BSW·드라이버, 부트로더) 단위로 분해한다.";
        const result = await callClaude(`당신은 Automotive SPICE 4.0 SYS.3(시스템 아키텍처 설계)에 정통한 차량 전장 시스템 엔지니어입니다. 아래 과제의 PBS(제품 분해 구조)를 시스템 요소 단위로 작성하세요.
과제명: ${projectForm.name}, 시스템명: ${sys}, 고객사: ${projectForm.client}
규칙:
1) "${sys} > (HW 또는 SW) > 구성요소" 형식으로 한 줄에 하나씩 작성한다.
2) ${scopeRule}
3) 요구사항 분석·설계·구현·테스트·검증·문서 같은 개발 활동이나 단계는 쓰지 않는다 (활동은 산출물 매트릭스에서 WBS로 자동 생성된다). 제품의 물리적·논리적 구성요소만 쓴다.
4) 8~14줄, 한국어. 입력에 없는 부품 번호·수치는 만들지 않는다.
JSON만 출력: {"pbs":["string"]}`, 2000);
        const lines = cleanAspicePbs(result?.pbs, dev, sys);
        if (lines.length < 4) throw new Error("시스템 요소가 충분하지 않음");
        setWbsSetup(s => ({ ...s, pbsText: lines.join("\n") }));
      } catch (e) {
        applyPbsPreset();
        setGenError("AI PBS 추천 결과가 시스템 요소 기준에 맞지 않아 ASPICE 표준 프리셋을 적용했습니다. 내용을 편집해 사용하세요. (" + e.message + ")");
      }
      setGenerating(false);
      return;
    }
    try {
      const result = await callClaude(`당신은 PMBOK 8판에 정통한 프로젝트 관리 전문가입니다. 아래 프로젝트의 PBS(Product Breakdown Structure, 제품 분해 구조)를 작성하세요.
프로젝트명: ${projectForm.name}, 고객사: ${projectForm.client}, 유형: ${projectForm.type}, OSSP: ${selectedOSSP?.label||"-"}
규칙: 대상 시스템을 구성 요소로 분해하여 "L1 > L2 > L3" 형식으로 한 줄에 하나씩 작성. L3이 없으면 "L1 > L2"까지만. 여러 요소에 공통 적용되는 부분은 L2에 "공통" 사용 가능. 8~14줄, 한국어.
JSON만 출력: {"pbs":["string"]}`, 2000);
      if (Array.isArray(result?.pbs) && result.pbs.length) {
        setWbsSetup(s => ({ ...s, pbsText: result.pbs.join("\n") }));
      } else { throw new Error("PBS 응답 형식 오류"); }
    } catch(e) {
      // AI 실패 시 프로젝트 유형별 프리셋 PBS로 폴백 — 사용자가 편집하여 사용
      applyPbsPreset();
      setGenError("AI PBS 추천 실패로 기본 프리셋을 적용했습니다. 내용을 편집해 사용하세요. ("+e.message+")");
    }
    setGenerating(false);
  }

  async function generateDeliverables() {
    setGenerating(true); setGenError(null); setDeliverablesData(null);
    setGenProgress({ percent: 5, label: "WBS 산출물 수집 중…" });
    try {
      // ── WBS의 최하위 Task에 지정된 산출물을 그대로 수집 (단계별 카테고리, 단계 내 중복 제거) ──
      // WBS 화면에서 직접 수정·추가한 산출물명까지 그대로 반영된다.
      if (!wbsData?.tasks?.length) throw new Error("WBS가 없습니다. WBS 단계에서 먼저 WBS를 생성하세요.");

      // 우선순위(필수/선택)·코드 매핑용 참조: 방법론 테일러링 확정 산출물 + 관리 프로세스 산출물
      const guide = getGuideForOSSP(selectedOSSP);
      const pdpNotes = tailoring.notes || {};
      const methodApplied = classifyDeliverables(tailoring.scale||"중형", tailoring.method||"UML", guide, tailoring.aspiceScope)
        .filter(d => {
          if (d.required) return true;
          const ov = pdpNotes[`${d.phase}:${d.code}`]?.applied;
          return ov !== undefined ? ov : !(tailoring.excluded||{})[d.code];
        });
      const nameRef = new Map();   // 산출물명 → { code, required, mgmt }
      methodApplied.forEach(d => { if (!nameRef.has(d.name)) nameRef.set(d.name, { code:d.code, required:d.required, mgmt:false }); });
      const firstOut = (outputs) => {
        const toks = String(outputs||"").split(/,|\s\/\s/).map(x=>x.trim()).filter(Boolean);
        return toks.find(t => t.length >= 2 && t !== "예") || toks[0] || "";
      };
      resolveMgmt(tailoring, guide).filter(r => r.applied).forEach(r => {
        const n = mapMgmtOutput(firstOut(r.outputs), guide);
        if (n && !nameRef.has(n)) nameRef.set(n, { code:null, required: r.mark === "●", mgmt:true });
      });

      // ── 개수 대사(對査)용 집계 — 최하위 Task 1건 = 산출물 1건(1:1)이 원칙 ──
      let leafTotal = 0, leafWithDeliv = 0, dupIncluded = 0, pdpInjected = false, mgmtMerged = 0;
      // 단일 산출물 원칙: 관리활동 Task의 산출물이 개발산출물 Task에도 있으면 개발산출물 쪽 1건만 생성
      const devDelivNames = new Set();
      wbsData.tasks.forEach(t => { if (!t.mgmt) (t.subtasks || []).forEach(s => { const n = String(s.deliverable || "").trim(); if (n) devDelivNames.add(n); }); });
      wbsData.tasks.forEach(t => (t.subtasks || []).forEach(s => {
        leafTotal += 1;
        if (String(s.deliverable || "").trim()) leafWithDeliv += 1;
      }));

      const PHASE_ICONS = ["🛡","📌","📋","🔧","🧪","🚀","🛠","📈","🧭","📦"];
      // 같은 산출물명은 같은 코드를 공유 (동일 문서 유형이 여러 Task에서 산출되는 경우)
      let pmSeq = 0, dSeq = 0;
      const codeByName = new Map();
      const categories = wbsData.tasks.map((t, ti) => {
        const seen = new Set();
        const documents = [];
        (t.subtasks || []).forEach(s => {
          const name = String(s.deliverable || "").trim();
          if (!name) return;   // 산출물 미지정 Task만 제외 — 지정된 Task는 중복이라도 전부 1:1 반영
          if (t.mgmt && devDelivNames.has(name)) { mgmtMerged += 1; return; }   // 관리활동 산출물 → 개발산출물로 통합
          if (seen.has(name)) dupIncluded += 1; else seen.add(name);
          let code = codeByName.get(name);
          if (!code) {
            const ref = nameRef.get(name);
            code = ref?.code || (ref?.mgmt ? `PM${String(++pmSeq).padStart(2,"0")}` : `D${String(++dSeq).padStart(2,"0")}`);
            codeByName.set(name, code);
          }
          const ref = nameRef.get(name);
          documents.push({
            id: `${t.id}-${documents.length}`, code, name,
            wbsNo: s.wbsCode || "", taskName: s.task || "",
            purpose: `${t.phase} 단계 산출물`,
            priority: ref ? (ref.required ? "필수(M)" : "선택(O)") : "선택(O)",
          });
        });
        return { id: t.id, name: t.phase, icon: PHASE_ICONS[ti % PHASE_ICONS.length], documents };
      }).filter(c => c.documents.length > 0);

      // ── 테일러링결과서(PDP)는 프로젝트 계획수립 산출물에 항상 포함 (필수) ──
      //    단, ASPICE CL1·CL2 과제는 조직 표준 프로세스 테일러링을 하지 않으므로 포함하지 않는다
      if (!(projectForm.track === "aspice" && aspiceClOf(projectForm) !== "CL3")) {
        const PDP_DOC_NAME = "테일러링결과서";
        let planCat = categories.find(c => c.name === "프로젝트 계획수립");
        if (!planCat) {
          planCat = { id: "cat-plan", name: "프로젝트 계획수립", icon: "📌", documents: [] };
          categories.unshift(planCat);
        }
        if (!planCat.documents.some(d => d.name === PDP_DOC_NAME)) {
          pdpInjected = true;
          planCat.documents.unshift({
            id: `${planCat.id}-pdp`, code: "PDP", name: PDP_DOC_NAME,
            purpose: "OSSP를 테일러링가이드 기준으로 테일러링한 결과서",
            priority: "필수(M)",
          });
        }
      }

      const allDocs = categories.flatMap(c => c.documents);
      if (allDocs.length === 0) throw new Error("WBS에 산출물이 지정된 작업이 없습니다. WBS 단계의 산출물 열을 확인하세요.");
      const summary = {
        totalDocs: allDocs.length,
        mandatoryCount: allDocs.filter(d => String(d.priority||"").startsWith("필수")).length,
        source: "wbs",   // WBS 기반 생성 마커 — 구버전 생성분과 구분
        // 개수 대사 내역: 최하위 Task 수 → 산출물 지정(1:1 전부 반영) → PDP 추가 = totalDocs
        recon: { leafTotal, leafWithDeliv, dupIncluded, pdpInjected, mgmtMerged },
      };

      // ── 각 문서의 목적 설명(1문장) — AI 미사용. 산출물명 키워드 사전(deriveDeliverablePurpose)으로 결정적 생성 ──
      setGenProgress({ percent: 60, label: `산출물 ${allDocs.length}건의 목적 설명 생성 중…` });
      allDocs.forEach(d => { d.purpose = deriveDeliverablePurpose(d.name) || d.purpose; });
      setGenProgress({ percent: 100, label: "산출물 생성 완료" });
      setDeliverablesData({ categories, summary });
      setTimeout(() => setGenProgress(p => (p && p.percent >= 100 ? null : p)), 1500);
    } catch(e) {
      setGenProgress(null);
      setGenError("산출물 생성 실패: "+e.message);
    }
    setGenerating(false);
  }

  // ── 위저드 임시저장 (localStorage, 여러 건) — 지금 위저드에 열린 작성 건의 id는 draftIdRef ──
  // ref를 쓰는 이유: 자동 저장 타이머가 연달아 돌 때 state 반영 지연으로 같은 작성 건이 두 건으로 갈라지지 않도록.
  const draftIdRef = useRef(null);
  function saveDraft() {
    try {
      if (!draftIdRef.current) draftIdRef.current = newDraftId();
      const draft = {
        draftId: draftIdRef.current, editingId: editingId || null,   // 수정 중 저장본이면 원본 프로젝트 id를 함께 보관
        wizardStep, projectForm, selectedOSSP,
        sdlcFactors, selectedSDLC, sdlcRecommendation,
        tailoring, pdpData, wbsData, wbsSetup, deliverablesData, requirements,
        savedAt: new Date().toISOString(),
      };
      writeDrafts([draft, ...readDrafts().filter(d => d.draftId !== draft.draftId)]);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  // V-모델(요구사항·검토 결과·판정)이 바뀌면 임시저장본에 자동 저장 — 새로고침·탭 닫힘으로 AI 검토 결과를 잃지 않도록.
  // (서버 DB 저장은 기존대로 위저드 마지막 단계의 '완료'에서 한다)
  const draftTimer = useRef(null);
  const draftWarned = useRef(false);
  const prevReqRef = useRef(null);
  useEffect(() => {
    const prev = prevReqRef.current; prevReqRef.current = requirements;
    // 불러오기(프로젝트 수정 시작·임시저장본 복원)로 처음 채워진 경우는 저장하지 않고, 위저드 안에서 바뀐 경우만 저장
    if (!requirements?.aspice || !prev) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const ok = saveDraft();
      if (!ok && !draftWarned.current) {
        draftWarned.current = true;
        alert("브라우저 임시저장 공간이 부족해 V-모델 작업 내용을 자동 저장하지 못했습니다.\n작업을 잃지 않으려면 위저드 마지막 단계에서 '완료'로 서버에 저장하세요.");
      }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [requirements]);   // eslint-disable-line react-hooks/exhaustive-deps

  function loadDrafts() { return readDrafts().filter(draftHasContent); }
  function loadDraft(id) { return id ? (readDrafts().find(d => d.draftId === id) || null) : null; }

  // 해당 작성 건 1개만 지운다 (다른 작성 중 항목은 보존)
  function clearDraft(id) {
    if (!id) return;
    try { writeDrafts(readDrafts().filter(d => d.draftId !== id)); } catch (e) { console.error(e); }
  }

  function restoreDraft(id) {
    const d = loadDraft(id);
    if (!d) return;
    clearTimeout(draftTimer.current);
    draftIdRef.current = d.draftId;
    // 저장본에 기록된 수정 대상만 복원 — 직전에 열어둔 다른 수정 모드가 남아 '완료' 시 엉뚱한 프로젝트를 지우지 않도록
    setEditingId(d.editingId || null);
    setGenError(null);
    setWizardStep(d.wizardStep || 0);
    if (d.projectForm) setProjectForm(d.projectForm);
    setSelectedOSSP(d.selectedOSSP || null);
    if (d.sdlcFactors) setSdlcFactors(d.sdlcFactors);
    setSelectedSDLC(d.selectedSDLC || null);
    setSdlcRecommendation(d.sdlcRecommendation || null);
    if (d.tailoring) setTailoring(d.tailoring);
    setPdpData(d.pdpData || null);
    setWbsData(d.wbsData || null);
    setWbsSetup(d.wbsSetup || { pbsText: "", selected: {} });
    setDeliverablesData(d.deliverablesData || null);
    setRequirements(d.requirements || null);
  }

  // 완료(저장)된 프로젝트를 위저드로 다시 열어 수정 — 저장된 데이터를 위저드 상태로 복원
  function editProject(p) {
    clearTimeout(draftTimer.current);
    // 같은 프로젝트를 수정하다 임시저장한 건이 있으면 그 슬롯을 이어서 쓴다 (작성 중 항목이 중복으로 쌓이지 않도록)
    draftIdRef.current = (readDrafts().find(d => d.editingId === p.id) || {}).draftId || null;
    setEditingId(p.id);
    const dm = p.tailoring?.docMeta || {};
    setProjectForm({ name:p.name||"", client:p.client||"", type:p.type||"신규개발", systemName:p.tailoring?.systemName||"",
      startDate:p.startDate||"", endDate:p.endDate||"", pm:p.pm||"",
      members: normalizeMembers(p.tailoring?.members),
      ...DOC_OVERRIDE_FIELDS.reduce((o,k)=>{ o[k]=dm[k]||""; return o; }, {}),
      clientLogo:p.tailoring?.logos?.client||null, companyLogo:p.tailoring?.logos?.company||null,
      track:p.tailoring?.track||"", aspiceVersion:p.tailoring?.aspiceVersion||"", aspiceCL:p.tailoring?.aspiceCL||"" });
    setSelectedOSSP(p.ossp||null);
    const t = p.tailoring || {};
    setSelectedSDLC(t.sdlc||null);
    setSdlcFactors(t.sdlc_factors||{ req_clarity:"보통", req_volatility:"보통", delivery:"단계적", risk:"보통", regulation:"보통", team:"집중" });
    setSdlcRecommendation(null);
    setTailoring({ scale:"중형", method:"UML", excluded:{}, doc_level:"표준", review_cycle:"격주", test_level:"통합", risk:"강화", ...t });
    setPdpData(p.pdp||null);
    setWbsData(p.wbs||null);
    // 매트릭스 선택(selected·common)은 WBS 생성 시 wbsData에 함께 저장됨 — 구버전 프로젝트(미저장)는 빈 매트릭스로 복원
    setWbsSetup({ pbsText:p.wbs?.pbsText||"", selected:p.wbs?.selected||{}, common:p.wbs?.common||{}, holidays:p.wbs?.holidays||[] });
    setDeliverablesData(p.deliverables||null);
    setRequirements(p.tailoring?.requirements || null);
    setGenError(null);
    setWizardStep(7);   // 완료(최종 확인) 단계에서 시작 — 상단 스텝을 눌러 어느 단계로든 이동 가능
    nav("new_project");
  }

  async function finishProject() {
    // 중복 저장 방지: 응답을 기다리는 동안 "완료" 버튼을 다시 눌러도 POST가 재발행되지 않도록
    // ref로 즉시 잠근다. (state는 다음 렌더까지 반영이 지연되어 연타를 막지 못한다)
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingProject(true);
    const newProject = {
      name:projectForm.name, client:projectForm.client, type:projectForm.type,
      start_date:projectForm.startDate, end_date:projectForm.endDate, pm:projectForm.pm,
      status:"진행중", ossp:selectedOSSP,
      // sdlc 전용 컬럼 없이 tailoring(JSON)에 함께 보존 → DB 스키마 변경 불필요
      tailoring:{ ...tailoring, sdlc:selectedSDLC, sdlc_factors:sdlcFactors, requirements: requirements||null,
        // 과제 유형(일반 SI / ASPICE)과 ASPICE 적용 기준 — tailoring(JSON)에 보존 (DB 스키마 변경 없음)
        track: projectForm.track || "", aspiceVersion: projectForm.aspiceVersion || "", aspiceCL: projectForm.track === "aspice" ? aspiceClOf(projectForm) : "",
        // 시스템명 — 전용 컬럼 없이 tailoring(JSON)에 보존 (DB 스키마 변경 불필요)
        systemName: String(projectForm.systemName || "").trim(),
        // 수행 팀원 명단 — 전용 컬럼 없이 tailoring(JSON)에 보존
        members: normalizeMembers(projectForm.members),
        logos:{ client:projectForm.clientLogo||null, company:projectForm.companyLogo||null },
        // 프로젝트별 문서 메타 오버라이드 — 저장 후 재다운로드 시에도 동일하게 적용된다
        docMeta:DOC_OVERRIDE_FIELDS.reduce((o,k)=>{ o[k]=projectForm[k]||""; return o; }, {}) },
      pdp:pdpData, wbs:wbsData, deliverables:deliverablesData,
    };
    try {
      const res = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newProject) });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        alert("프로젝트 저장에 실패했습니다: " + (err.error || `HTTP ${res.status}`) + "\n작성 내용은 그대로 유지됩니다.");
        savingRef.current = false; setSavingProject(false);
        return;   // 위저드 상태를 비우지 않고 그대로 두어 재시도할 수 있게 한다
      }
      // 수정 모드: 새 버전 저장이 성공한 경우에만 기존 프로젝트 제거 (실패 시 데이터 유실 방지)
      // 삭제가 실패하면 구버전이 남아 목록에 중복으로 보이므로 조용히 넘기지 않고 알린다.
      if (editingId) {
        const del = await fetch(`/api/projects?id=${editingId}`, { method:'DELETE' });
        if (!del.ok) {
          const derr = await del.json().catch(()=>({}));
          alert("새 버전은 저장되었으나 이전 버전 삭제에 실패했습니다: " + (derr.error || `HTTP ${del.status}`) +
            "\n목록에 같은 이름이 두 건 보일 수 있습니다. 이전 버전을 직접 삭제해 주세요.");
        }
      }
      await fetchProjects();
    } catch(e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다: " + e.message + "\n작성 내용은 그대로 유지됩니다.");
      savingRef.current = false; setSavingProject(false);
      return;
    }
    const doneDraftId = draftIdRef.current;
    resetWizardState();
    clearDraft(doneDraftId);   // 완료된 작성 건의 임시저장본만 제거 (다른 작성 중 항목은 보존)
    savingRef.current = false; setSavingProject(false);
    nav("dashboard");
  }

  // 위저드 메모리 상태 초기화 — 완료 저장 후, 작성 중 항목 삭제 시 공통 사용
  function resetWizardState() {
    clearTimeout(draftTimer.current);
    draftIdRef.current = null;   // 다음 임시저장은 새 작성 건으로
    setEditingId(null);
    setWizardStep(0); setProjectForm({ name:"",client:"",type:"신규개발",systemName:"",startDate:"",endDate:"",pm:"",
      ...DOC_OVERRIDE_FIELDS.reduce((o,k)=>{ o[k]=""; return o; }, {}) });
    setTimeout(()=>{ if (appSettings) applySettingsDefaults(appSettings); }, 0);   // 설정의 QA 기본정책·기본 로고 재적용
    setSelectedOSSP(null); setTailoring({ scale:"중형", method:"UML", excluded:{}, doc_level:"표준",review_cycle:"격주",test_level:"통합",risk:"강화" });
    setSelectedSDLC(null); setSdlcRecommendation(null);
    setSdlcFactors({ req_clarity:"보통", req_volatility:"보통", delivery:"단계적", risk:"보통", regulation:"보통", team:"집중" });
    setPdpData(null); setWbsData(null); setWbsSetup({ pbsText: "", selected: {} }); setDeliverablesData(null); setRequirements(null);
  }

  // ── '새 프로젝트' 진입: 항상 빈 위저드로 시작 ──
  // (이전에는 nav("new_project")만 호출해 메모리에 남은 위저드 상태 — 이어서 작성한 초안·수정 중이던 프로젝트 — 가 그대로 보였다)
  // 작성 중이던 내용은 자기 임시저장 슬롯에 보존한 뒤 비운다 — 작성 중 항목은 여러 건 보관되며 대시보드에서 골라 이어서 작성한다.
  const [wizardKey, setWizardKey] = useState(0);   // 위저드 재마운트용 — 내부 상태(복원 안내 등)를 새로 초기화
  function startNewProject() {
    const dirty = !!(projectForm.name || projectForm.client || projectForm.track || selectedOSSP || selectedSDLC || pdpData || wbsData || deliverablesData || requirements);
    // 작성(수정) 중이던 내용은 자기 슬롯에 임시저장한 뒤 비운다 — 수정 건은 원본 id를 함께 저장하므로 이어서 작성해도 중복 저장되지 않는다
    if (dirty && !saveDraft()) {
      if (!confirm("작성 중인 내용을 임시저장하지 못했습니다(브라우저 저장 공간 부족).\n이대로 새 프로젝트를 시작하면 작성 내용이 사라집니다. 계속할까요?")) return;
    }
    resetWizardState();
    setGenError(null);
    setWizardKey(k => k + 1);
    nav("new_project");
  }
  // 하위 화면에 넘기는 nav — '새 프로젝트' 이동만 startNewProject로 보낸다 (이어서 작성·수정 진입은 기존 nav 그대로)
  const navFromMenu = (p) => (p === "new_project" ? startNewProject() : nav(p));

  // 삭제 진행 표시 (작성 중 항목·저장된 프로젝트 공통)
  const [busyOp, setBusyOp] = useState(null);   // { label, percent, error? }
  const [, setDraftVer] = useState(0);          // 작성 중 항목 삭제 후 대시보드 즉시 갱신용
  const finishBusy = (label) => { setBusyOp({ label, percent: 100 }); setTimeout(() => setBusyOp(null), 900); };

  // 작성 중(임시저장) 항목 삭제: 브라우저 임시저장본 + 메모리의 위저드 상태를 함께 비운다.
  // (이전에는 임시저장본만 지우고 화면을 다시 그리지 않아, 카드가 남고 '새 프로젝트'에 이전 입력값이 보였다)
  function discardDraft(id) {
    setBusyOp({ label: "작성 중인 내용 삭제 중…", percent: 40 });
    clearDraft(id);
    if (draftIdRef.current === id) resetWizardState();   // 지금 위저드에 열린 작성 건일 때만 메모리 상태도 비운다
    setBusyOp({ label: "작성 중인 내용 삭제 중…", percent: 80 });
    setDraftVer(v => v + 1);
    finishBusy(loadDraft(id) ? "삭제 확인 실패 — 새로고침 후 다시 시도하세요" : "작성 중인 내용을 삭제했습니다");
  }

  async function deleteProject(id) {
    if (busyOp) return;
    setBusyOp({ label: "프로젝트 삭제 중…", percent: 25 });
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method:'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      setBusyOp({ label: "목록 새로고침 중…", percent: 70 });
      await fetchProjects();
      if (currentProject && currentProject.id === id) setCurrentProject(null);
      nav("dashboard");
      finishBusy("프로젝트를 삭제했습니다");
    } catch (e) {
      setBusyOp(null);
      alert("삭제하지 못했습니다: " + e.message + "\n권한(조회자 계정은 삭제 불가)이나 네트워크 상태를 확인해 주세요.");
    }
  }

  const pages = {
    dashboard: <Dashboard projects={projects} loading={loadingProjects} nav={navFromMenu} setCurrentProject={setCurrentProject} canCreate={role !== "viewer"} onDelete={deleteProject}
      drafts={loadDrafts()} onContinueDraft={(id)=>{ restoreDraft(id); setWizardKey(k => k + 1); nav("new_project"); }} onDiscardDraft={discardDraft} />,
    new_project: <NewProjectWizard key={wizardKey} step={wizardStep} setStep={setWizardStep} form={projectForm} setForm={setProjectForm}
      selectedOSSP={selectedOSSP} setSelectedOSSP={setSelectedOSSP} tailoring={tailoring} setTailoring={setTailoring}
      pdpData={pdpData} wbsData={wbsData} deliverablesData={deliverablesData} generating={generating} genError={genError} genProgress={genProgress}
      onGeneratePDP={generatePDP} onRecommendPBS={recommendPBS} setWbsData={setWbsData}
      pbsNoAi={pbsNoAi} onTogglePbsNoAi={togglePbsNoAi}
      wbsSetup={wbsSetup} setWbsSetup={setWbsSetup} onGenerateDeliverables={generateDeliverables}
      requirements={requirements} setRequirements={setRequirements}
      onFinish={finishProject} nav={nav} customOSSP={customOSSP}
      sdlcFactors={sdlcFactors} setSdlcFactors={setSdlcFactors}
      selectedSDLC={selectedSDLC} setSelectedSDLC={setSelectedSDLC}
      sdlcRecommendation={sdlcRecommendation} recommending={recommending} onRecommendSDLC={recommendSDLC}
      editing={!!editingId} saving={savingProject}
      onSaveDraft={saveDraft} loadDrafts={loadDrafts} onRestoreDraft={(id)=>{ restoreDraft(id); setWizardKey(k => k + 1); }} />,
    project_detail: <ProjectDetail project={currentProject} nav={nav} onDelete={deleteProject} onEdit={editProject} />,
    ossp: <OSSPPage nav={navFromMenu} customOSSP={customOSSP} builtinOSSP={builtinOSSP} onAdd={addOSSP} onDelete={deleteOSSP} />,
    regulation: <LibraryPage nav={nav} kind="regulation"
      title="규제 (Regulation / Compliance)" subtitle="프로젝트가 준수해야 할 규제·컴플라이언스 자산"
      categories={["법령/규정","감독규정","인증/심사기준","보안/개인정보","산업표준","기타"]} />,
    best_practice: <LibraryPage nav={nav} kind="best_practice"
      title="Best Practice 산출물" subtitle="모범 산출물 사례 라이브러리"
      categories={["요구정의","분석","설계","구축","운영전환","공통/기타"]} />,
    settings: <SettingsPage nav={nav} session={session} settings={appSettings} settingsErr={settingsErr}
      onReload={fetchSettings} onApplyDefaults={applySettingsDefaults} onLogout={logout} onReauth={reauth} />,
  };

  // 조회 전용(viewer) 계정에는 생성 기능을 노출하지 않음
  const navItems = [
    {id:"dashboard",icon:"⊞",label:"대시보드"},
    ...(role === "viewer" ? [] : [{id:"new_project",icon:"+",label:"새 프로젝트"}]),
    {id:"ossp",icon:"◈",label:"OSSP 라이브러리"},
    {id:"regulation",icon:"§",label:"규제 (Regulation)"},
    {id:"best_practice",icon:"★",label:"Best Practice 산출물"},
    {id:"settings",icon:"⚙",label:"설정"},
  ];

  // 로그인 전이면 로그인 화면만 표시
  if (!authed) {
    return <LoginGate onSuccess={(token)=>{ try { localStorage.setItem(AUTH_KEY, token||""); } catch {} setSession(decodeSession(token)); }} />;
  }

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
          <div style={{ width:30, height:30, background:`linear-gradient(135deg,${T.accent},#7C3AED)`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#fff" }}>{APP_MARK}</div>
          <div style={{ fontSize:14, fontWeight:700 }}>{APP_NAME}</div>
        </div>
        <button onClick={()=>setMenuOpen(!menuOpen)} style={{ background:"none", border:"none", color:T.text, fontSize:22, cursor:"pointer", padding:"4px 8px" }}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"8px 12px", zIndex:99 }}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>navFromMenu(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:page===item.id?T.accentGlow:"transparent", color:page===item.id?T.accent:T.muted, border:"none", cursor:"pointer", fontSize:14, fontWeight:page===item.id?600:400, fontFamily:"inherit", width:"100%", marginBottom:4 }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
          <div style={{ padding:"10px 12px", borderTop:`1px solid ${T.border}`, marginTop:4, fontSize:12, color:T.muted, display:"flex", justifyContent:"space-between", gap:8 }}>
            <span>전체 프로젝트 <span style={{ color:T.accent, fontWeight:700 }}>{projects.length}건</span></span>
            <span>{session?.name || session?.login_id} · {ROLE_LABELS[role] || role}</span>
          </div>
          <button onClick={logout} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, background:"transparent", color:T.muted, border:"none", cursor:"pointer", fontSize:14, fontFamily:"inherit", width:"100%" }}>
            <span>⏻</span> 로그아웃
          </button>
        </div>
      )}

      <div className="layout" style={{ display:"flex", flex:1 }}>
        {/* PC 사이드바 */}
        <aside className="sidebar" style={{ display:"none", width:220, background:T.surface, borderRight:`1px solid ${T.border}`, flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
          <div style={{ padding:"0 20px 24px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, background:`linear-gradient(135deg,${T.accent},#7C3AED)`, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:800, color:"#fff" }}>{APP_MARK}</div>
              <div><div style={{ fontSize:15, fontWeight:700, letterSpacing:-0.3 }}>{APP_NAME}</div><div style={{ fontSize:10, color:T.muted }}>{APP_TAGLINE}</div></div>
            </div>
          </div>
          <nav style={{ padding:"14px 10px", flex:1, display:"flex", flexDirection:"column", gap:2 }}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>navFromMenu(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:10, background:page===item.id?T.accentGlow:"transparent", color:page===item.id?T.accent:T.muted, border:page===item.id?`1px solid ${T.accentDim}`:"1px solid transparent", cursor:"pointer", fontSize:13, fontWeight:page===item.id?600:400, fontFamily:"inherit", transition:"all .15s", textAlign:"left", width:"100%" }}>
                <span style={{ fontSize:15 }}>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>전체 프로젝트</div>
            <div style={{ fontSize:24, fontWeight:700 }}>{projects.length}<span style={{ fontSize:13, color:T.muted, fontWeight:400 }}> 건</span></div>
            {/* 로그인 계정 — 이름·역할 표시 (권한 판정은 서버가 수행) */}
            <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:T.accentDim, color:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                {String(session?.name || session?.login_id || "?").trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{session?.name || session?.login_id}</div>
                <div style={{ fontSize:9.5, color:T.muted }}>{ROLE_LABELS[role] || role}</div>
              </div>
            </div>
            <button onClick={logout} style={{ marginTop:12, display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:8, background:"transparent", color:T.muted, border:`1px solid ${T.border}`, cursor:"pointer", fontSize:12, fontFamily:"inherit", width:"100%" }}>
              <span>⏻</span> 로그아웃
            </button>
            {/* 상표 귀속 문구 (PMI Trademark Usage Guidelines 준수) */}
            <div style={{ marginTop:12, fontSize:8.5, color:T.muted, lineHeight:1.5, opacity:.8 }}>
              PMBOK is a registered mark of Project Management Institute, Inc. 본 서비스는 PMI와 제휴·보증 관계가 없습니다.
            </div>
          </div>
        </aside>

        <main style={{ flex:1, overflow:"auto", animation:"fadeIn .3s ease" }}>
          {pages[page]||pages.dashboard}
          {busyOp && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
              <div style={{ width:"100%", maxWidth:420 }}><GenProgressBar progress={busyOp} subText="창을 닫지 마세요" /></div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── 프로젝트 진행 단계 ────────────────────────────────────────────────
// DB의 status 컬럼은 저장 시 "진행중"으로 고정되어 실제 상태를 나타내지 못한다.
// 대신 저장된 산출물 유무로 착수 8단계 중 어디까지 왔는지를 그때그때 도출한다.
// (새 컬럼·새 API 없이 이미 있는 데이터만으로 결정되므로 항상 실제와 일치한다)
function projectStage(p) {
  if (p?.deliverables) return { label: "착수 완료",     color: T.green };
  if (p?.wbs)          return { label: "산출물 단계",   color: "#C084FC" };
  if (p?.pdp)          return { label: "WBS 단계",      color: T.amber };
  if (p?.tailoring?.sdlc || p?.ossp) return { label: "테일러링 단계", color: T.accent };
  return { label: "기본정보 단계", color: T.muted };
}

function Dashboard({ projects, loading, nav, setCurrentProject, drafts = [], onContinueDraft, onDiscardDraft, canCreate = true, onDelete }) {
  const hasDraft = drafts.length > 0;
  const stats = [
    { label:"전체 프로젝트", value:projects.length, color:T.accent },
    { label:"PDP 생성", value:projects.filter(p=>p.pdp).length, color:T.green },
    { label:"WBS 생성", value:projects.filter(p=>p.wbs).length, color:T.amber },
    { label:"산출물", value:projects.filter(p=>p.deliverables).length, color:"#C084FC" },
  ];
  const STEP_LABELS = ["기본정보","SDLC","OSSP","테일러링","PDP","WBS","산출물","완료"];
  return (
    <div style={{ padding:"20px 16px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:-0.5, marginBottom:4 }}>프로젝트 착수 자동화 플랫폼</h1>
        <p style={{ color:T.muted, fontSize:12 }}>OSSP 테일러링 → PDP → WBS → 산출물까지 AI로 완성</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:20 }}>
        {stats.map(s=><Card key={s.label} style={{ padding:"14px 16px" }}><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{s.label}</div><div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div></Card>)}
      </div>
      <Card style={{ padding:18, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:600 }}>프로젝트 목록</h2>
          {canCreate && <Btn onClick={()=>nav("new_project")} style={{ fontSize:12, padding:"6px 12px" }}>+ 새 프로젝트</Btn>}
        </div>
        {loading ? (
          <div style={{ textAlign:"center", padding:"32px 0" }}><Spinner text="프로젝트 불러오는 중…" /></div>
        ) : (projects.length===0 && !hasDraft) ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:T.muted }}>
            <div style={{ fontSize:28, marginBottom:8 }}>◈</div>
            <div style={{ fontSize:13, marginBottom:14 }}>아직 등록된 프로젝트가 없습니다.</div>
            {canCreate && <Btn onClick={()=>nav("new_project")}>첫 프로젝트 시작하기</Btn>}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {/* 작성 중(임시저장) 항목 */}
            {drafts.map(draft => (
              <div key={draft.draftId} onClick={()=>onContinueDraft(draft.draftId)}
                style={{ padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px dashed ${T.amber}88`, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{draft.projectForm?.name || "(제목 미입력)"}</div>
                  <span style={{ display:"flex", gap:4 }}>{draft.editingId && <Badge color={T.accent}>수정 중</Badge>}<Badge color={T.amber}>작성 중</Badge></span>
                </div>
                <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>
                  {draft.projectForm?.client || "고객사 미입력"}
                  {draft.selectedSDLC?.label && ` · ${draft.selectedSDLC.label}`}
                  {typeof draft.wizardStep === "number" && ` · ${STEP_LABELS[draft.wizardStep]||""} 단계`}
                  {draft.savedAt && ` · ${new Date(draft.savedAt).toLocaleString("ko-KR")} 저장`}
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <Btn variant="primary" onClick={(e)=>{ e.stopPropagation(); onContinueDraft(draft.draftId); }} style={{ fontSize:11, padding:"4px 10px" }}>이어서 작성</Btn>
                  <Btn variant="ghost" onClick={(e)=>{ e.stopPropagation(); if(confirm(`「${draft.projectForm?.name || "제목 미입력"}」 작성 중인 내용을 삭제할까요?`)) onDiscardDraft(draft.draftId); }} style={{ fontSize:11, padding:"4px 10px" }}>삭제</Btn>
                </div>
              </div>
            ))}
            {/* 같은 이름·고객사가 2건 이상이면 정리하도록 안내 (과거 중복 저장분) */}
            {(() => {
              const cnt = {};
              projects.forEach(p => { const k = `${p.name}|${p.client}`; cnt[k] = (cnt[k]||0)+1; });
              const dupN = Object.values(cnt).filter(c => c > 1).reduce((s,c)=>s+(c-1), 0);
              return dupN > 0 ? (
                <div style={{ padding:"10px 14px", background:T.amber+"14", border:`1px solid ${T.amber}44`,
                  borderRadius:10, fontSize:11.5, color:T.text, lineHeight:1.7, marginBottom:4 }}>
                  이름과 고객사가 같은 프로젝트가 <b>{dupN}건</b> 중복되어 있습니다.
                  각 항목 우측의 ✕ 버튼으로 불필요한 건을 정리하세요.
                </div>
              ) : null;
            })()}
            {projects.map(p=>{
              const stage = projectStage(p);
              return (
              <div key={p.id} onClick={()=>{ setCurrentProject(p); nav("project_detail"); }}
                style={{ padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}`, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:8 }}>
                  <div style={{ fontWeight:600, fontSize:14, minWidth:0 }}>{p.name}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                    <Badge color={stage.color}>{stage.label}</Badge>
                    {/* 목록에서 바로 삭제 — 중복 항목 정리용. 카드 클릭(상세 이동)과 겹치지 않도록 전파를 막는다 */}
                    {canCreate && onDelete && (
                      <button title="이 프로젝트 삭제"
                        onClick={e=>{ e.stopPropagation();
                          if (confirm(`"${p.name}" (${p.client||"-"} · ${p.createdAt})을(를) 삭제합니다.\n되돌릴 수 없습니다. 계속할까요?`)) onDelete(p.id); }}
                        style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.muted,
                          cursor:"pointer", fontSize:11, lineHeight:1, padding:"4px 7px", fontFamily:"inherit" }}>✕</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>{p.client} · {p.ossp?.label} · {p.createdAt}</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {p.pdp && <Badge color={T.green}>PDP</Badge>}
                  {p.wbs && <Badge color={T.amber}>WBS</Badge>}
                  {p.deliverables && <Badge color="#C084FC">산출물</Badge>}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card style={{ padding:18 }}>
        <h2 style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>추천 시작 흐름</h2>
        {[
          ["프로젝트 기본정보 입력", "고객사·기간·PM·팀원·문서 설정"],
          ["SDLC 추천·확정", "PMBOK® 8판 선정 요인 규칙 기반"],
          ["OSSP 선택", "조직 표준 프로세스"],
          ["테일러링", "개발산출물 · 관리활동"],
          ["PDP 자동 생성", "테일러링결과서"],
          ["WBS 자동 생성", "산출물 × 시스템 구성요소 (구성요소 AI 추천 선택)"],
          ["산출물 생성", "OSSP 템플릿 기반 (요구사항 AI 작성 선택)"],
          ["프로젝트 착수 완료", ""],
        ].map(([s, sub], i)=>(
          <div key={s} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:T.accentDim, color:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</div>
            <div style={{ lineHeight:1.4 }}>
              <div style={{ fontSize:12, color:T.muted }}>{s}</div>
              {sub && <div style={{ fontSize:10, color:T.muted, opacity:0.7, marginTop:1 }}>{sub}</div>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function NewProjectWizard({ step, setStep, form, setForm, selectedOSSP, setSelectedOSSP, tailoring, setTailoring, pdpData, wbsData, deliverablesData, generating, genError, genProgress, onGeneratePDP, onRecommendPBS, pbsNoAi, onTogglePbsNoAi, setWbsData, wbsSetup, setWbsSetup, onGenerateDeliverables, requirements, setRequirements, onFinish, nav, customOSSP, sdlcFactors, setSdlcFactors, selectedSDLC, setSelectedSDLC, sdlcRecommendation, recommending, onRecommendSDLC, editing, saving, onSaveDraft, loadDrafts, onRestoreDraft }) {
  const STEP_NAMES = ["기본정보","SDLC","OSSP","테일러링","PDP","WBS","산출물","완료"];
  // 과제 유형·목표 능력수준에 따라 보이는 단계(내부 단계 번호 0~7 중 일부)
  const isAspiceTrack = form.track === "aspice";
  const cl = aspiceClOf(form);
  const seq = !isAspiceTrack ? [0,1,2,3,4,5,6,7] : cl === "CL3" ? [0,3,4,5,6,7] : [0,3,5,6,7];
  const stepName = i => (isAspiceTrack && i === 3 && cl !== "CL3") ? "적용 범위" : STEP_NAMES[i];
  const steps = seq.map(stepName);
  const pos = Math.max(0, seq.indexOf(step));
  const canNext = [
    form.name&&form.client&&form.startDate&&form.endDate&&form.pm,  // 0 기본정보
    !!selectedSDLC,                                                  // 1 SDLC
    !!selectedOSSP,                                                  // 2 OSSP
    true,                                                           // 3 테일러링 / ASPICE CL1·2 적용 범위
    !!pdpData,                                                      // 4 PDP
    !!wbsData,                                                      // 5 WBS
    !!deliverablesData,                                             // 6 산출물
    true,                                                           // 7 완료
  ];
  const [saveMsg, setSaveMsg] = useState("");
  // 과제 유형이 정해지면 선택한 OSSP에 해당 가이드를 붙인다 (유형이 ASPICE 판정의 유일한 기준)
  useEffect(() => {
    if (!selectedOSSP || !form.track) return;
    const gid = trackGuideId(form.track, selectedOSSP);
    if ((selectedOSSP.guideId || null) !== gid) setSelectedOSSP({ ...selectedOSSP, guideId: gid || undefined });
  }, [form.track, selectedOSSP]);
  function chooseTrack(track, aspiceVersion, aspiceCL, aspiceDev) {
    setForm(p => ({ ...p, track, aspiceVersion: track === "aspice" ? (aspiceVersion || p.aspiceVersion || "both") : "",
      aspiceCL: track === "aspice" ? (aspiceCL || p.aspiceCL || "CL2") : "",
      aspiceDev: track === "aspice" ? (aspiceDev || p.aspiceDev || "SW") : "",
      type: fitProjectType(track, p.type) }));   // 과제 유형이 바뀌면 그 유형에 없는 프로젝트 유형은 '신규개발'로 정리
    // ASPICE: 규제 수준을 '엄격'으로 두어 SDLC 추천이 V-Model로 가도록 (사용자가 바꾼 값은 유지)
    if (track === "aspice" && sdlcFactors?.regulation === "보통" && !selectedSDLC) setSdlcFactors(f => ({ ...f, regulation: "엄격" }));
  }
  const showTrackPicker = !editing && !form.track && step === 0 && !form.name;
  // 현재 단계가 시퀀스에 없으면(유형·능력수준 변경, 구버전 임시저장본) 다음 유효 단계로 이동
  useEffect(() => { if (!seq.includes(step)) setStep(seq.find(i => i > step) ?? seq[seq.length - 1]); }, [seq.join(","), step]);
  // ASPICE: 건너뛰는 SDLC·OSSP 값을 자동 지정, 목표 능력수준 → 테일러링 능력수준 값, 프로세스 범위 기본값
  useEffect(() => {
    if (!isAspiceTrack) return;
    const vm = SDLC_MODELS.find(m => m.id === "v-model");
    if (vm && selectedSDLC?.id !== "v-model") setSelectedSDLC(vm);
    if (!selectedOSSP || getGuideForOSSP(selectedOSSP)?.id !== "aspice") {
      const cands = [...OSSP_OPTIONS, ...(customOSSP || [])].filter(isAspiceOSSP);
      const pick = cands[0] || { id: "aspice-std", label: "자동차 SW 개발 표준프로세스(ASPICE)", desc: "내장 ASPICE 표준 프로세스", phases: TAILORING_GUIDES.aspice.phaseOrder };
      setSelectedOSSP({ ...pick, guideId: "aspice" });
    }
    setTailoring(t => {
      const scale = clScale(cl);
      if (t.scale === scale && t.aspiceScope) return t;
      return { ...t, scale, aspiceScope: t.aspiceScope || aspiceScopeDefault(form.aspiceDev) };
    });
  }, [isAspiceTrack, cl, selectedOSSP, selectedSDLC]);
  // 개발 범위(SW / HW+SW / HW) → 적용 범위의 SWE·HWE. 개발 범위 값이 없던 기존 과제는 저장된 적용 범위에서 역산해 채운다.
  useEffect(() => {
    if (!isAspiceTrack) return;
    if (!form.aspiceDev) {
      if (tailoring?.aspiceScope) setForm(p => p.aspiceDev ? p : { ...p, aspiceDev: devFromScope(tailoring.aspiceScope) });
      return;
    }
    const want = { SWE: form.aspiceDev !== "HW", HWE: form.aspiceDev !== "SW" };
    setTailoring(t => {
      const sc = t.aspiceScope || aspiceScopeDefault(form.aspiceDev);
      if (t.aspiceScope && (sc.SWE !== false) === want.SWE && !!sc.HWE === want.HWE) return t;
      return { ...t, aspiceScope: { ...sc, ...want } };
    });
  }, [isAspiceTrack, form.aspiceDev, !!tailoring?.aspiceScope]);
  // 파생 개발 ↔ REU.2 재사용: 파생 개발로 바꾸면 REU.2를 켜고, 다른 유형으로 바꾸면 자동으로 켠 경우에만 끈다.
  // (사용자가 적용 범위에서 직접 켜고 끈 값은 reuAuto=false로 남아 유형을 바꿔도 건드리지 않는다)
  const prevTypeRef = useRef(form.type);
  useEffect(() => {
    const prev = prevTypeRef.current; prevTypeRef.current = form.type;
    if (!isAspiceTrack || prev === form.type) return;
    const toDerived = form.type === "파생개발", fromDerived = prev === "파생개발";
    if (!toDerived && !fromDerived) return;
    setTailoring(t => {
      const sc = t.aspiceScope || aspiceScopeDefault(form.aspiceDev);
      if (toDerived) return sc.REU ? t : { ...t, reuAuto: true, aspiceScope: { ...sc, REU: true } };   // 이미 켜져 있으면 그대로(자동 표시 안 함)
      if (!t.reuAuto) return t;
      return { ...t, reuAuto: false, aspiceScope: { ...sc, REU: false } };
    });
  }, [isAspiceTrack, form.type]);   // eslint-disable-line react-hooks/exhaustive-deps
  // 빈 위저드로 들어오면 작성 중 항목(여러 건) 안내 — 고르면 이어서 작성, '닫기'는 안내만 닫는다 (임시저장본은 지우지 않음)
  const [draftList, setDraftList] = useState(() => {
    const ds = loadDrafts ? loadDrafts() : [];
    return ds.length && !form.name && !form.track ? ds : null;
  });

  function handleSave() {
    if (onSaveDraft && onSaveDraft()) {
      setSaveMsg("임시저장됨");
      setTimeout(()=>setSaveMsg(""), 2000);
    }
  }
  return (
    <div style={{ padding:"16px", maxWidth:960, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div style={{ flex:1 }}><h1 style={{ fontSize:17, fontWeight:700 }}>{editing ? "프로젝트 수정" : "새 프로젝트 생성"}</h1><p style={{ fontSize:11, color:T.muted }}>STEP {pos+1}/{steps.length} — {steps[pos]}{isAspiceTrack ? ` · ASPICE ${cl}` : ""}</p></div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {editing && <Badge color={T.amber}>수정 모드</Badge>}
          {saveMsg && <span style={{ fontSize:11, color:T.green, fontWeight:600 }}>✓ {saveMsg}</span>}
          <Btn variant="outline" onClick={handleSave} style={{ fontSize:12, padding:"6px 12px" }}>임시저장</Btn>
        </div>
      </div>

      {/* 임시저장본 복원 안내 */}
      {draftList && (
        <Card style={{ padding:14, marginBottom:16, border:`1px solid ${T.accent}55`, background:T.bg }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:8 }}>
            <div style={{ fontSize:12, color:T.text }}>작성 중인 항목이 {draftList.length}건 있습니다. 이어서 작성하려면 고르고, 새로 시작하려면 닫으세요 (작성 중 항목은 지워지지 않습니다).</div>
            <Btn variant="ghost" onClick={()=>setDraftList(null)} style={{ fontSize:11, padding:"5px 10px" }}>닫고 새로 시작</Btn>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {draftList.slice(0, 5).map(d => (
              <div key={d.draftId} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                <Btn variant="primary" onClick={()=>{ onRestoreDraft && onRestoreDraft(d.draftId); }} style={{ fontSize:11, padding:"3px 10px" }}>이어서 작성</Btn>
                <b>{d.projectForm?.name || "(제목 미입력)"}</b>
                <span style={{ color:T.muted }}>{d.projectForm?.client || "고객사 미입력"}{d.savedAt ? ` · ${new Date(d.savedAt).toLocaleString("ko-KR")}` : ""}</span>
              </div>))}
            {draftList.length > 5 && <div style={{ fontSize:11, color:T.muted }}>외 {draftList.length - 5}건은 대시보드에서 볼 수 있습니다.</div>}
          </div>
        </Card>
      )}
      {showTrackPicker && <TrackPicker onChoose={chooseTrack} />}
      {!showTrackPicker && (<>
      {/* 진행 표시 */}
      <div style={{ display:"flex", gap:0, marginBottom:24, position:"relative" }}>
        <div style={{ position:"absolute", top:11, left:11, right:11, height:2, background:T.border, zIndex:0 }} />
        <div style={{ position:"absolute", top:11, left:11, height:2, background:T.accent, zIndex:1, transition:"width .4s", width:`${(pos/(steps.length-1))*(100-20/steps.length)}%` }} />
        {steps.map((s,k)=>{
          const i = seq[k];
          // 이동 허용: 과거/현재 단계는 항상, 미래 단계는 그 직전까지(보이는 단계만) 모든 완료조건을 만족할 때만
          const canJump = k <= pos || seq.slice(0, k).every(j => canNext[j]);
          return (
            <div key={s} onClick={()=>{ if(i!==step && canJump) setStep(i); }}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, position:"relative", zIndex:2, cursor:canJump?"pointer":"not-allowed" }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:i<=step?T.accent:T.surface, border:`2px solid ${i<=step?T.accent:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:i<=step?"#fff":T.muted, transition:"all .15s" }}>{i<step?"✓":k+1}</div>
              <span style={{ fontSize:9, color:i===step?T.accent:T.muted, fontWeight:i===step?600:400, textAlign:"center" }}>{s}</span>
            </div>
          );
        })}
      </div>
      <Card style={{ padding:20, minHeight:300, marginBottom:16 }}>
        {step===0 && <StepInfo form={form} setForm={setForm} onChooseTrack={chooseTrack} osspChosen={!!selectedOSSP} tailoring={tailoring} />}
        {step===1 && <StepSDLC factors={sdlcFactors} setFactors={setSdlcFactors} selected={selectedSDLC} setSelected={setSelectedSDLC} recommendation={sdlcRecommendation} recommending={recommending} genError={genError} onRecommend={onRecommendSDLC} />}
        {step===2 && <StepOSSP selected={selectedOSSP} setSelected={setSelectedOSSP} customOSSP={customOSSP} sdlc={selectedSDLC} track={form.track} />}
        {step===3 && isAspiceTrack && cl !== "CL3" && <AspiceScopeStep form={form} onDevChange={dev => setForm(p => ({ ...p, aspiceDev: dev }))} tailoring={tailoring} setTailoring={setTailoring} ossp={selectedOSSP} setOssp={setSelectedOSSP} customOSSP={customOSSP} />}
        {step===3 && isAspiceTrack && cl === "CL3" && <AspiceProcessPanel form={form} onDevChange={dev => setForm(p => ({ ...p, aspiceDev: dev }))} tailoring={tailoring} setTailoring={setTailoring} ossp={selectedOSSP} setOssp={setSelectedOSSP} customOSSP={customOSSP} />}
        {step===3 && !(isAspiceTrack && cl !== "CL3") && <StepTailoring tailoring={tailoring} setTailoring={setTailoring} ossp={selectedOSSP} />}
        {step===4 && <StepPDP pdpData={pdpData} generating={generating} genError={genError} onGenerate={onGeneratePDP} tailoring={tailoring} setTailoring={setTailoring} ossp={selectedOSSP} sdlc={selectedSDLC} form={form} />}
        {step===5 && <StepWBS wbsData={wbsData} setWbsData={setWbsData} generating={generating} genError={genError} genProgress={genProgress} onRecommendPBS={onRecommendPBS} pbsNoAi={pbsNoAi} onTogglePbsNoAi={onTogglePbsNoAi} wbsSetup={wbsSetup} setWbsSetup={setWbsSetup} tailoring={tailoring} ossp={selectedOSSP} form={form} setForm={setForm} />}
        {step===6 && <StepDeliverables deliverablesData={deliverablesData} generating={generating} genProgress={genProgress} genError={genError} onGenerate={onGenerateDeliverables} form={form} wbs={wbsData} requirements={requirements} setRequirements={setRequirements} pdpCtx={{ ossp:selectedOSSP, sdlc:selectedSDLC, tailoring, pdp:pdpData, requirements }} />}
        {step===7 && <StepReview form={form} sdlc={selectedSDLC} ossp={selectedOSSP} tailoring={tailoring} pdpData={pdpData} wbsData={wbsData} deliverablesData={deliverablesData} />}
      </Card>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <Btn variant="ghost" onClick={()=>pos>0?setStep(seq[pos-1]):nav("dashboard")}>← 이전</Btn>
        {pos<seq.length-1
          ? <Btn disabled={!canNext[step]} onClick={()=>setStep(seq[pos+1])}>다음 →</Btn>
          : <Btn onClick={onFinish} disabled={saving}>{saving ? "저장 중…" : (editing ? "✓ 수정 저장" : "✓ 완료")}</Btn>}
      </div>
      </>)}
    </div>
  );
}

// ── 새 프로젝트 시작 화면: 과제 유형 선택 (기본정보 이전) ──
function TrackPicker({ onChoose }) {
  const [ver, setVer] = useState("both");
  const [cl, setCl] = useState("CL2");
  const [dev, setDev] = useState("SW");
  return (
    <Card style={{ padding:24, marginBottom:16 }}>
      <h2 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>어떤 과제인가요?</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:18 }}>과제 유형에 따라 추천 SDLC·OSSP와 요구사항 작성 위치가 달라집니다. 기본정보 단계에서 언제든 바꿀 수 있습니다.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:14 }}>
        {PROJECT_TRACKS.map(t => (
          <div key={t.id} style={{ padding:18, borderRadius:12, border:`2px solid ${T.border}`, background:T.bg, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:28 }}>{t.icon}</div>
            <div style={{ fontSize:15, fontWeight:700 }}>{t.label}</div>
            <div style={{ fontSize:12, color:T.muted, lineHeight:1.5 }}>{t.desc}</div>
            <div style={{ fontSize:11.5, color:T.accent, lineHeight:1.5 }}>→ {t.note}</div>
            {t.id === "aspice" && (
              <div style={{ marginTop:4 }}>
                <div style={{ fontSize:10.5, color:T.muted, marginBottom:5 }}>적용 기준 (고객사 심사 버전) — 나중에 V-모델에서 변경 가능</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {AE.ASPICE_VERSIONS.map(v => (
                    <button key={v.id} onClick={() => setVer(v.id)} title={v.desc}
                      style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${ver === v.id ? T.accent : T.border}`, background: ver === v.id ? T.accent : "transparent", color: ver === v.id ? "#fff" : T.muted }}>{v.label}</button>
                  ))}
                </div>
                <div style={{ fontSize:10.5, color:T.muted, margin:"10px 0 5px" }}>목표 능력수준 — CL1·CL2는 테일러링·PDP 단계 없이 진행합니다</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {ASPICE_CLS.map(c => (
                    <button key={c.id} onClick={() => setCl(c.id)} title={c.desc}
                      style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${cl === c.id ? T.accent : T.border}`, background: cl === c.id ? T.accent : "transparent", color: cl === c.id ? "#fff" : T.muted }}>{c.label}</button>
                  ))}
                </div>
                <div style={{ fontSize:10.5, color:T.muted, marginTop:5 }}>{ASPICE_CLS.find(c => c.id === cl)?.desc}</div>
                <div style={{ fontSize:10.5, color:T.muted, margin:"10px 0 5px" }}>개발 범위 — 시스템(SYS.1~5)은 항상 포함됩니다. HW를 포함하면 HWE.1~4 산출물이 WBS·산출물 목록과 V-모델에 함께 들어갑니다</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {aspiceDevChoices(dev).map(d => (
                    <button key={d.id} onClick={() => setDev(d.id)} title={d.desc}
                      style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${dev === d.id ? T.accent : T.border}`, background: dev === d.id ? T.accent : "transparent", color: dev === d.id ? "#fff" : T.muted }}>{d.label}</button>
                  ))}
                </div>
                <div style={{ fontSize:10.5, color:T.muted, marginTop:5 }}>{ASPICE_DEVS.find(d => d.id === dev)?.desc}{dev !== "SW" && ver !== "4.0" ? " · 3.1 심사에서는 HWE를 PAM 확장으로 표기" : ""}</div>
              </div>
            )}
            <div style={{ flex:1 }} />
            <Btn onClick={() => onChoose(t.id, t.id === "aspice" ? ver : "", t.id === "aspice" ? cl : "", t.id === "aspice" ? dev : "")} style={{ fontSize:12.5, padding:"8px 14px", marginTop:6 }}>이 유형으로 시작 →</Btn>
          </div>
        ))}
      </div>
    </Card>
  );
}
// ── ASPICE: OSSP 자동 지정 + 적용 프로세스 범위 (CL1·2 '적용 범위' 단계, CL3 테일러링 단계 상단 공통) ──
function AspiceProcessPanel({ form, onDevChange, tailoring, setTailoring, ossp, setOssp, customOSSP }) {
  const cands = [...OSSP_OPTIONS, ...(customOSSP || [])].filter(isAspiceOSSP);
  const scope = tailoring?.aspiceScope || aspiceScopeDefault(form?.aspiceDev);
  const [devMsg, setDevMsg] = useState("");
  const guide = TAILORING_GUIDES.aspice;
  const scaleKey = { "(초)대형": "large", "중형": "medium", "소형": "small" }[clScale(aspiceClOf(form))];
  const countOf = gid => guide.matrix.filter(d => aspiceRowGroup(d) === gid && d[scaleKey] && d[scaleKey] !== "-").length;
  const toggle = gid => {
    // SWE·HWE는 개발 범위(form.aspiceDev)가 기준 — 바꾸면 기본정보의 개발 범위·V-모델 SW/HW 범위와 함께 바뀐다
    if ((gid === "SWE" || gid === "HWE") && onDevChange) {
      const cur = { SWE: aspiceGroupOn(scope, "SWE"), HWE: aspiceGroupOn(scope, "HWE") };
      const next = { ...cur, [gid]: !cur[gid] };
      if (!next.SWE && !next.HWE) { setDevMsg("SW와 HW를 모두 뺄 수는 없습니다. 개발 범위는 SYS + SW 또는 SYS + SW + HW 중 하나입니다."); return; }
      // SW 엔지니어링은 해제 불가 — HW만 개발하는 범위는 더 이상 선택지로 두지 않는다 (구버전 HW 과제는 SWE를 켜는 방향만 허용)
      if (gid === "SWE" && cur.SWE) { setDevMsg("SW 엔지니어링(SWE.1~6)은 뺄 수 없습니다. 개발 범위는 SYS + SW 또는 SYS + SW + HW 중 하나입니다."); return; }
      setDevMsg("");
      onDevChange(next.SWE && next.HWE ? "HWSW" : next.HWE ? "HW" : "SW");
      return;
    }
    setTailoring(t => ({ ...t, ...(gid === "REU" ? { reuAuto: false } : {}), aspiceScope: { ...(t.aspiceScope || aspiceScopeDefault(form?.aspiceDev)), [gid]: !(t.aspiceScope || aspiceScopeDefault(form?.aspiceDev))[gid] } }));
  };
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, color:T.muted, marginBottom:10, padding:"8px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span>조직 표준 프로세스:</span>
        {cands.length > 1
          ? <select value={ossp?.id || ""} onChange={e => { const o = cands.find(c => c.id === e.target.value); if (o) setOssp({ ...o, guideId: "aspice" }); }} style={{ fontSize:12, padding:"4px 8px", background:T.surface, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, fontFamily:"inherit" }}>
              {cands.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          : <b style={{ color:T.accent }}>{ossp?.label || "—"}</b>}
        <span>· 생명주기 <b style={{ color:T.text }}>V-Model</b> (자동 지정)</span>
        <span>· 목표 <b style={{ color:T.text }}>{aspiceClOf(form)}</b> · {(AE.ASPICE_VERSIONS.find(v => v.id === (form.aspiceVersion || "both")) || {}).label}</span>
      </div>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>적용 프로세스 범위</div>
      <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>VDA 범위를 기준으로 일반적인 공급사 과제에 맞춰 기본 선택되어 있습니다 (협력사 개발이면 ACQ.4를 켜세요). 해당 없는 프로세스는 해제하면 그 산출물이 목록에서 빠집니다. SW·HW 범위는 기본정보의 개발 범위와 연동되며, V-모델 적용 범위와 WBS·산출물 목록에 함께 반영됩니다.</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:6 }}>
        {["MAN3","SUP","SYS","SWE","HWE","SPL","ACQ","VAL","REU","MAN5"].map(id => ASPICE_SCOPE_GROUPS.find(g => g.id === id)).map(g => {
          const on = !!g.lock || aspiceGroupOn(scope, g.id);
          const n = countOf(g.id);
          return (
            <label key={g.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, border:`1px solid ${on ? T.accent+"88" : T.border}`, background: on ? T.accentGlow : T.bg, cursor: g.lock ? "default" : "pointer", fontSize:12, color: on ? T.text : T.muted }}>
              <input type="checkbox" checked={on} disabled={g.lock} onChange={() => !g.lock && toggle(g.id)} />
              <span style={{ flex:1 }}>{g.label}{g.lock && <span style={{ color:T.muted, fontSize:10.5 }}> · 필수</span>}</span>
              {g.id === "HWE" && (form?.aspiceVersion || "both") !== "4.0" && <span title="3.1 PRM에는 HWE가 없어 4.0 HWE.1~4를 PAM 확장으로 준용합니다" style={{ fontSize:10, color:T.amber }}>3.1: PAM 확장</span>}
              <span style={{ fontSize:10.5, color:T.muted }}>{g.note || (n ? `산출물 ${n}종` : "")}</span>
            </label>
          );
        })}
      </div>
      {devMsg && <div style={{ fontSize:11, color:T.amber, marginTop:6 }}>⚠ {devMsg}</div>}
    </div>
  );
}
// ── ASPICE 관리활동 목록 — 적용 범위·목표 능력수준에서 결정 (선택 ○ 항목은 해당 산출물 적용/제외와 연동) ──
function AspiceMgmtList({ tailoring, setTailoring, guide, editable }) {
  const items = resolveMgmt(tailoring, guide);
  const byArea = {}; items.forEach(r => { (byArea[r.area] = byArea[r.area] || []).push(r); });
  const toggle = code => code && setTailoring(t => ({ ...t, excluded: { ...(t.excluded || {}), [code]: !(t.excluded || {})[code] } }));
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>관리활동 <span style={{ fontSize:11, color:T.muted, fontWeight:400 }}>적용 {items.filter(r => r.applied).length}/{items.length}건 · 목표 {mgmtLevelLabel(tailoring, guide)}</span></div>
      <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>ASPICE 과제는 CMMI SI용 관리활동 가이드 대신 적용 프로세스 범위(MAN.3·SUP.1·8·9·10, 해당 시 ACQ.4·MAN.5)의 관리활동을 WBS 앞부분에 반영합니다. 필수(●)/선택(○)은 해당 산출물의 목표 능력수준 기준을 따르며{editable ? ", 선택 항목은 눌러서 적용/제외합니다(산출물 목록과 연동)" : ""}.</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", gap:8 }}>
        {Object.entries(byArea).map(([area, rs]) => (
          <div key={area} style={{ padding:"8px 10px", border:`1px solid ${T.border}`, borderRadius:8, background:T.bg }}>
            <div style={{ fontSize:11.5, fontWeight:700, color:T.accent, marginBottom:4 }}>{area}</div>
            {rs.map(r => (
              <div key={r.key} onClick={() => editable && r.mark === "○" && toggle(r.outCode)}
                style={{ display:"flex", gap:6, alignItems:"baseline", fontSize:11.5, padding:"2px 0", cursor: editable && r.mark === "○" ? "pointer" : "default", color: r.applied ? T.text : T.muted, textDecoration: r.applied ? "none" : "line-through" }}>
                <span style={{ color: r.mark === "●" ? T.accent : T.amber, flexShrink:0 }}>{r.mark}</span>
                <span style={{ flex:1 }}>{r.process}</span>
                <span style={{ fontSize:10, color:T.muted, flexShrink:0 }}>→ {r.outputs}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
// CL1·CL2 '적용 범위' 단계 — 테일러링·PDP 대신 프로세스 범위와 선택 산출물만 정한다
function AspiceScopeStep({ form, onDevChange, tailoring, setTailoring, ossp, setOssp, customOSSP }) {
  const cl = aspiceClOf(form);
  const guide = TAILORING_GUIDES.aspice;
  const list = classifyDeliverables(clScale(cl), "UML", guide, tailoring?.aspiceScope || aspiceScopeDefault());
  const excluded = tailoring?.excluded || {};
  const req = list.filter(d => d.required), opt = list.filter(d => !d.required);
  const applied = req.length + opt.filter(d => !excluded[d.code]).length;
  const toggleEx = code => setTailoring(t => ({ ...t, excluded: { ...(t.excluded || {}), [code]: !(t.excluded || {})[code] } }));
  const byPhase = {}; list.forEach(d => { (byPhase[d.phase] = byPhase[d.phase] || []).push(d); });
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>적용 범위</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:12 }}>목표 {cl}은 조직 표준 프로세스 테일러링과 테일러링 결과서(PDP)가 필요하지 않습니다. 대상 프로세스와 산출물만 정하면 다음 단계에서 WBS를 만듭니다. {cl === "CL1" ? "CL1은 각 프로세스의 결과물(WP) 작성에 집중하며, 검토 기록 등 관리 증적은 선택(O)입니다." : "CL2는 표준 산출물을 전면 적용하며, 계획·모니터링(PA 2.1)과 산출물 검토·관리(PA 2.2) 증적을 포함합니다."}</p>
      <AspiceProcessPanel form={form} onDevChange={onDevChange} tailoring={tailoring} setTailoring={setTailoring} ossp={ossp} setOssp={setOssp} customOSSP={customOSSP} />
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>산출물</div>
        <div style={{ fontSize:11, color:T.muted }}>적용 {applied}종 = 필수(M) {req.length} + 선택(O) {opt.length - opt.filter(d => excluded[d.code]).length}/{opt.length}{opt.length ? " — 선택 산출물은 눌러서 적용/제외" : ""}</div>
      </div>
      {(guide.phaseOrder || Object.keys(byPhase)).filter(ph => byPhase[ph]).map(ph => (
        <div key={ph} style={{ marginBottom:8 }}>
          <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>{ph}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {byPhase[ph].map(d => {
              const off = !d.required && excluded[d.code];
              return (
                <button key={d.code} onClick={() => !d.required && toggleEx(d.code)} title={d.note || ""}
                  style={{ fontSize:11, padding:"4px 9px", borderRadius:6, fontFamily:"inherit", cursor: d.required ? "default" : "pointer", border:`1px solid ${d.required ? T.accent+"66" : off ? T.border : T.amber+"88"}`, background: off ? "transparent" : d.required ? T.accent+"14" : T.amber+"14", color: off ? T.muted : T.text, textDecoration: off ? "line-through" : "none" }}>
                  {d.name} <span style={{ fontSize:9.5, color: d.required ? T.accent : T.amber }}>{d.required ? "M" : "O"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginTop:14 }}><AspiceMgmtList tailoring={tailoring} setTailoring={setTailoring} guide={guide} editable /></div>
      <div style={{ fontSize:11, color:T.muted, marginTop:10, padding:"8px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8 }}>적용 프로세스 범위와 생명주기(V-Model)는 MAN.3 프로젝트 계획서에 기술합니다.</div>
    </div>
  );
}

// 기본정보 단계 상단: 과제 유형 확인·변경
function TrackField({ form, onChooseTrack, osspChosen }) {
  const [warn, setWarn] = useState(false);
  return (
    <div style={{ padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:10 }}>
      <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>과제 유형 {!form.track && <span style={{ color:T.amber }}>— 미지정 (선택한 OSSP로 자동 판정 중)</span>}</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
        {PROJECT_TRACKS.map(t => (
          <button key={t.id} onClick={() => { if (form.track !== t.id) { onChooseTrack(t.id); if (osspChosen) setWarn(true); } }}
            style={{ fontSize:12, padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${form.track === t.id ? T.accent : T.border}`, background: form.track === t.id ? T.accent : "transparent", color: form.track === t.id ? "#fff" : T.text }}>{t.icon} {t.label}</button>
        ))}
        {form.track === "aspice" && (
          <select value={form.aspiceVersion || "both"} onChange={e => onChooseTrack("aspice", e.target.value)} style={{ fontSize:11.5, padding:"5px 8px", background:T.surface, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, fontFamily:"inherit" }}>
            {AE.ASPICE_VERSIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        )}
        {form.track === "aspice" && (
          <select value={aspiceDevOf(form)} onChange={e => { onChooseTrack("aspice", form.aspiceVersion, aspiceClOf(form), e.target.value); setWarn(true); }} title="개발 범위 — SWE·HWE 적용 범위" style={{ fontSize:11.5, padding:"5px 8px", background:T.surface, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, fontFamily:"inherit" }}>
            {aspiceDevChoices(aspiceDevOf(form)).map(d => <option key={d.id} value={d.id}>개발 범위: {d.label} — {d.desc}</option>)}
          </select>
        )}
        {form.track === "aspice" && (
          <select value={aspiceClOf(form)} onChange={e => { onChooseTrack("aspice", form.aspiceVersion, e.target.value); setWarn(true); }} title="목표 능력수준" style={{ fontSize:11.5, padding:"5px 8px", background:T.surface, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, fontFamily:"inherit" }}>
            {ASPICE_CLS.map(c => <option key={c.id} value={c.id}>목표 {c.label} — {c.desc}</option>)}
          </select>
        )}
      </div>
      {form.track === "aspice" && <div style={{ fontSize:10.5, color:T.muted, marginTop:6 }}>진행 단계: {aspiceClOf(form) === "CL3" ? "기본정보 → 테일러링 → PDP → WBS → 산출물 → 완료" : "기본정보 → 적용 범위 → WBS → 산출물 → 완료 (테일러링·PDP 불필요)"}</div>}
      {warn && <div style={{ fontSize:11, color:T.amber, marginTop:6 }}>⚠ 과제 유형·능력수준·개발 범위가 바뀌면 적용되는 테일러링 가이드와 진행 단계가 달라집니다. 이미 진행한 OSSP·테일러링·PDP 단계를 다시 확인해 주세요. 작성한 요구사항과 V-모델 데이터는 그대로 보존됩니다.</div>}
    </div>
  );
}

// ── 이번 프로젝트 문서 설정 ────────────────────────────────────────────
// 설정(설정 → 조직·문서 기본값)이 조직 표준이고, 여기가 프로젝트 테일러링에 해당한다.
// 비워두면 설정값이 그대로 쓰이므로, 실무상 다른 값이 필요한 항목만 채우면 된다.
//   · 문서번호 접두어 — 사업마다 다름 → 기본 노출
//   · 작성/검토/승인자, 배포구분 — 프로젝트마다 다름 → 기본 노출
//   · 수행사명·부서 — 조직 상수 → 접어 둠(컨소시엄·공동수급 등 예외 시에만 사용)
function ProjectDocSettings({ form, setForm, f }) {
  const [openOrg, setOpenOrg] = useState(false);
  const ph = (v, fallback) => (v ? `설정 기본값: ${v}` : fallback);
  const effPrefix = (form.codePrefix || DOC_SETTINGS.codePrefix || "").trim();
  const effOrg = [form.orgName || DOC_SETTINGS.orgName, form.dept || DOC_SETTINGS.dept].filter(Boolean).join(" · ");
  const orgOverridden = !!(form.orgName || form.orgNameEn || form.dept);

  return (
    <div>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>이번 프로젝트 문서 설정 (선택)</div>
      <div style={{ fontSize:10, color:T.muted, marginBottom:10, lineHeight:1.6 }}>
        산출물 문서의 표지·문서정보표·승인란에 기재됩니다. 비워두면 설정의 조직 기본값이 그대로 사용됩니다.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
        <Input label="문서번호 접두어" value={form.codePrefix||""} onChange={f("codePrefix")}
          placeholder={ph(DOC_SETTINGS.codePrefix, "예: ITG-QA")} />
        <Input label="작성자" value={form.author||""} onChange={f("author")}
          placeholder={ph(DOC_SETTINGS.author, form.pm ? `미입력 시 PM(${form.pm})` : "예: 품질보증담당자")} />
        <Input label="검토자" value={form.reviewer||""} onChange={f("reviewer")}
          placeholder={ph(DOC_SETTINGS.reviewer, "예: PM")} />
        <Input label="승인자" value={form.approver||""} onChange={f("approver")}
          placeholder={ph(DOC_SETTINGS.approver, "예: 사업총괄")} />
        <Select label="배포 구분" value={form.distribution||""} onChange={f("distribution")}
          options={[{ value:"", label:`설정 기본값 사용${DOC_SETTINGS.distribution ? ` (${DOC_SETTINGS.distribution})` : ""}` },
            ...DISTRIBUTION_OPTIONS.map(v=>({ value:v, label:v }))]} />
      </div>

      {/* 문서번호 미리보기 — 접두어 유무에 따라 실제 조립 결과가 달라지므로 즉시 보여준다 */}
      <div style={{ marginTop:10, padding:"8px 12px", background:T.bg, borderRadius:8, fontSize:10.5, color:T.muted, lineHeight:1.7 }}>
        문서번호 미리보기 —{" "}
        <span style={{ color:T.text, fontFamily:"monospace" }}>{projectDocNo({ ...form }, "PDP")}</span>
        {!effPrefix && <span style={{ marginLeft:8 }}>※ 접두어를 입력하면 고객사 코드 대신 접두어가 사용됩니다.</span>}
      </div>

      {/* 수행사 정보 — 조직 상수라 평소에는 접어 둔다 */}
      <button onClick={()=>setOpenOrg(o=>!o)}
        style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, padding:"8px 12px", width:"100%",
          background:"transparent", border:`1px solid ${T.border}`, borderRadius:9, cursor:"pointer",
          color:T.muted, fontSize:11, fontFamily:"inherit", textAlign:"left" }}>
        <span style={{ fontSize:10 }}>{openOrg ? "▾" : "▸"}</span>
        <span>수행사 정보 재지정</span>
        <span style={{ marginLeft:"auto", color: orgOverridden ? T.amber : T.muted }}>
          {orgOverridden ? "이 프로젝트에서 변경됨" : (effOrg ? `설정값 사용 — ${effOrg}` : "설정에 미등록")}
        </span>
      </button>
      {openOrg && (
        <div style={{ marginTop:10, padding:14, border:`1px dashed ${T.border}`, borderRadius:10 }}>
          <div style={{ fontSize:10, color:T.muted, marginBottom:10, lineHeight:1.6 }}>
            공동수급·컨소시엄처럼 이 사업의 주관사가 평소와 다를 때만 입력하세요. 비워두면 설정값이 사용됩니다.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            <Input label="수행사명 (국문)" value={form.orgName||""} onChange={f("orgName")}
              placeholder={ph(DOC_SETTINGS.orgName, "우리 회사 상호")} />
            <Input label="수행사명 (영문)" value={form.orgNameEn||""} onChange={f("orgNameEn")}
              placeholder={ph(DOC_SETTINGS.orgNameEn, "영문 상호")} />
            <Input label="담당 부서" value={form.dept||""} onChange={f("dept")}
              placeholder={ph(DOC_SETTINGS.dept, "예: 품질보증팀 (QA)")} />
          </div>
          {orgOverridden && (
            <button onClick={()=>setForm(p=>({ ...p, orgName:"", orgNameEn:"", dept:"" }))}
              style={{ marginTop:12, background:"none", border:`1px solid ${T.border}`, borderRadius:7,
                color:T.muted, cursor:"pointer", fontSize:11, padding:"5px 12px", fontFamily:"inherit" }}>
              설정 기본값으로 되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 프로젝트 수행 팀원 등록 — WBS 작업자 콤보박스의 원천 명단
function TeamMembersEditor({ form, setForm, tailoring }) {
  const roleOpts = teamRolesFor(form, tailoring);
  const isAspice = form?.track === "aspice";
  const members = form.members || [];
  const setMembers = updater => setForm(p => ({ ...p, members: typeof updater === "function" ? updater(p.members || []) : updater }));
  const upd = (id, k, v) => setMembers(ms => ms.map(m => m.id === id ? { ...m, [k]: v, ...(k === "name" ? { auto: false } : {}) } : m));
  const del = id => setMembers(ms => ms.filter(m => m.id !== id));
  const add = (name = "") => setMembers(ms => [...ms, { id: newMemberId(), name, role: "", org: "", auto: false }]);
  // PM을 팀원으로 편입 — 기본정보에 입력한 PM 이름을 그대로 사용
  const pmName = String(form.pm || "").trim();
  const pmRegistered = pmName && teamNames(members).some(n => memberKey(n) === memberKey(pmName));
  const autoCount = members.filter(m => m.auto && String(m.name || "").trim()).length;

  const cellInp = { width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 6, color: T.text, fontSize: 11.5, fontFamily: "inherit", outline: "none", padding: "6px 8px" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          프로젝트 수행 팀원 <span style={{ color: T.muted, fontWeight: 400 }}>(선택) · {teamNames(members).length}명</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {pmName && !pmRegistered && (
            <button onClick={() => setMembers(ms => [...ms, { id: newMemberId(), name: pmName, role: "PM", org: "", auto: false }])}
              style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 7, color: T.accent,
                cursor: "pointer", fontSize: 11, padding: "4px 10px", fontFamily: "inherit" }}>+ PM 추가</button>
          )}
          <button onClick={() => add()}
            style={{ background: "none", border: `1px solid ${T.accent}`, borderRadius: 7, color: T.accent,
              cursor: "pointer", fontSize: 11, padding: "4px 10px", fontFamily: "inherit" }}>+ 팀원 추가</button>
        </div>
      </div>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 8, lineHeight: 1.6 }}>
        여기 등록한 인원이 WBS 일정 계획의 <b style={{ color: T.text }}>작업자</b> 콤보박스와 엑셀 워크북의 드롭다운에 나타납니다.
        작업자 란에서 미등록 인원을 직접 입력하면 이 명단에 자동 등록되며 <b style={{ color: T.amber }}>자동</b> 배지로 표시됩니다.
      </div>
      {members.length === 0 ? (
        <div style={{ fontSize: 11, color: T.muted, padding: "14px 12px", background: T.bg,
          border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          등록된 팀원이 없습니다. 지금 등록하지 않아도 WBS 단계에서 작업자를 직접 입력할 수 있습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: T.muted, paddingRight: 30 }}>
            <div style={{ flex: 2, minWidth: 90 }}>이름 *</div>
            <div style={{ flex: 2, minWidth: 90 }}>역할</div>
            <div style={{ flex: 2, minWidth: 90 }}>소속</div>
          </div>
          {members.map(m => (
            <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ flex: 2, minWidth: 90, position: "relative" }}>
                <input value={m.name || ""} onChange={e => upd(m.id, "name", e.target.value)} placeholder="예: 홍길동"
                  style={m.auto ? { ...cellInp, borderColor: T.amber + "88", paddingRight: 40 } : cellInp} />
                {m.auto && <span title="WBS 작업자 란에서 자동 등록된 인원입니다. 이름·역할을 확인해 주세요."
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9,
                    color: T.amber, border: `1px solid ${T.amber}66`, borderRadius: 4, padding: "1px 4px" }}>자동</span>}
              </div>
              <div style={{ flex: 2, minWidth: 90 }}>
                {(() => { const why = teamRoleMismatch(m.role, form, tailoring); return (<>
                <input value={m.role || ""} onChange={e => upd(m.id, "role", e.target.value)} list="spq-team-roles"
                  placeholder={isAspice ? "예: SW 개발자" : "예: 개발"} title={why ? `현재 과제와 맞지 않는 역할입니다 — ${why}` : ""}
                  style={why ? { ...cellInp, borderColor: T.amber + "88" } : cellInp} />
                {why && <div style={{ fontSize: 9.5, color: T.amber, marginTop: 2 }}>⚠ {why}</div>}
                </>); })()}
              </div>
              <div style={{ flex: 2, minWidth: 90 }}>
                <input value={m.org || ""} onChange={e => upd(m.id, "org", e.target.value)}
                  placeholder="예: DX사업본부" style={cellInp} />
              </div>
              <button onClick={() => del(m.id)} title="이 팀원 삭제"
                style={{ width: 24, flexShrink: 0, background: "none", border: "none", color: T.red,
                  cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 0 }}>×</button>
            </div>
          ))}
          <datalist id="spq-team-roles">{roleOpts.map(r => <option key={r.value} value={r.value}>{r.note || undefined}</option>)}</datalist>
          {(() => { const n = members.filter(m => teamRoleMismatch(m.role, form, tailoring)).length; return n > 0 && (
            <div style={{ fontSize: 10, color: T.amber }}>
              ⚠ 현재 과제({isAspice ? "ASPICE 자동차" : "일반 SI"})와 맞지 않는 역할 {n}건 — 역할 칸을 눌러 목록에서 다시 골라 주세요. 값은 자동으로 바꾸지 않습니다.
            </div>); })()}
          {autoCount > 0 && (
            <div style={{ fontSize: 10, color: T.amber }}>
              ⚠ 자동 등록 {autoCount}명 — 오타로 등록된 이름이 없는지 확인하세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepInfo({ form, setForm, onChooseTrack, osspChosen, tailoring }) {
  const f = k => v => setForm(p=>({...p,[k]:v}));
  // 로고 업로드: dataURL + 원본 크기(폭/높이) 저장 — docx 임베드 시 비율 유지에 사용
  const readLogo = k => e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) { alert("로고 이미지는 1MB 이하로 올려주세요."); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const dataUrl = rd.result;
      const img = new Image();
      img.onload = () => setForm(p => ({ ...p, [k]: { dataUrl, w: img.naturalWidth || 300, h: img.naturalHeight || 100 } }));
      img.onerror = () => alert("이미지를 읽을 수 없습니다. PNG 또는 JPG 파일을 사용해 주세요.");
      img.src = dataUrl;
    };
    rd.readAsDataURL(file);
  };
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>프로젝트 기본 정보</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {onChooseTrack && <TrackField form={form} onChooseTrack={onChooseTrack} osspChosen={osspChosen} />}
        <Input label="프로젝트명 *" value={form.name} onChange={f("name")} placeholder="예: 스마트팩토리 MES 고도화" />
        <div>
          <Input label="시스템명" value={form.systemName} onChange={f("systemName")}
            placeholder={form.name ? `비워두면 "${deriveSystemName(form.name)}"` : "예: 스마트팩토리 MES"} />
          <div style={{ fontSize:10, color:T.muted, marginTop:5, lineHeight:1.6 }}>
            산출물 문서 머리말의 <b style={{ color:T.text }}>시스템</b>란에 기재됩니다. 구축 대상 시스템의 이름이며 사업명과 다를 수 있습니다.
            비워두면 프로젝트명에서 구축·고도화 같은 사업 접미어를 떼어 자동으로 채웁니다.
          </div>
        </div>
        <div>
          <Input label="고객사(발주처) *" value={form.client} onChange={f("client")} placeholder="예: (주)한국제조" />
          <div style={{ fontSize:10, color:T.muted, marginTop:5, lineHeight:1.6 }}>
            사업을 발주한 회사입니다. 우리 회사(수행사) 상호는 설정 → 조직·문서 기본값에서 관리합니다
            {DOC_SETTINGS.orgName ? <> — 현재 <b style={{ color:T.text }}>{DOC_SETTINGS.orgName}</b></> : null}.
          </div>
        </div>
        <div>
          <Select label="프로젝트 유형" value={fitProjectType(form.track, form.type)} onChange={f("type")} options={projectTypesFor(form.track).map(t=>({value:t.value,label:t.label}))} />
          {form.track === "aspice" && <div style={{ fontSize:10, color:T.muted, marginTop:5, lineHeight:1.6 }}>{projectTypesFor("aspice").find(t => t.value === fitProjectType("aspice", form.type))?.desc}</div>}
        </div>
        <Input label="PM *" value={form.pm} onChange={f("pm")} placeholder="예: 홍길동" />
        <TeamMembersEditor form={form} setForm={setForm} tailoring={tailoring} />
        <Input label="시작일 *" type="date" value={form.startDate} onChange={f("startDate")} />
        <Input label="종료일 *" type="date" value={form.endDate} onChange={f("endDate")} />
        {/* 이번 프로젝트 문서 설정 — 비워둔 항목은 설정(설정 → 조직·문서 기본값)의 값이 사용된다.
            접두어·담당자는 사업마다 달라 펼쳐 두고, 조직 상수(수행사명·부서)는 접어 둔다. */}
        <ProjectDocSettings form={form} setForm={setForm} f={f} />
        <div>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>문서 로고</div>
          <div style={{ fontSize:10, color:T.muted, marginBottom:8 }}>
            산출물 문서(docx)의 표지와 문서 정보 표에 삽입됩니다. (PNG/JPG · 1MB 이하)
            {(DOC_SETTINGS.clientLogo || DOC_SETTINGS.companyLogo) && " 비워두면 설정의 조직 기본 로고가 사용됩니다."}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {[["clientLogo","고객사(발주처) 로고"],["companyLogo","우리회사(수행사) 로고"]].map(([k,label])=>(
              <FileDrop key={k} bare accept="image/png,image/jpeg" onFiles={fs => readLogo(k)(asFileEvent(fs))} dropLabel={`여기에 놓으면 ${label}로 지정합니다 (PNG · JPG)`}
                style={{ flex:1, minWidth:220, border:`1px dashed ${T.border}`, borderRadius:10, padding:12 }}>
                <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>{label} <span style={{ fontSize:10 }}>· 끌어다 놓기 가능</span></div>
                {form[k]?.dataUrl ? (
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <img src={form[k].dataUrl} alt={label} style={{ height:34, maxWidth:170, objectFit:"contain", background:"#fff", borderRadius:6, padding:"2px 6px" }} />
                    <button onClick={()=>setForm(p=>({ ...p, [k]:null }))}
                      style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.red, cursor:"pointer", fontSize:11, padding:"4px 10px", fontFamily:"inherit" }}>제거</button>
                  </div>
                ) : (
                  <label style={{ display:"inline-block", cursor:"pointer", fontSize:12, color:T.accent, border:`1px solid ${T.accent}`, borderRadius:8, padding:"6px 12px" }}>
                    이미지 선택
                    <input type="file" accept="image/png,image/jpeg" onChange={readLogo(k)} style={{ display:"none" }} />
                  </label>
                )}
              </FileDrop>
            ))}
          </div>
        </div>
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

// ── SDLC 규칙 기반 추천 엔진 (AI 미사용) ──────────────────────────────
// PMBOK 8판 개발접근법 선정 요인을 예측형(−)↔적응형(+) 스펙트럼 점수로 환산 후
// 접근법 구간 → 세부 모델 분기 규칙으로 결정. 입력 조합이 유한(3^6)하므로 완전 결정적.
const SDLC_SCORES = {
  req_clarity:    { 낮음:+2, 보통:0, 높음:-2 },
  req_volatility: { 낮음:-2, 보통:0, 높음:+2 },
  delivery:       { 일괄:-2, 단계적:+1, 빈번:+2 },
  risk:           { 낮음:0,  보통:0, 높음:+1 },   // 높은 리스크는 반복·검증 강화 방향
  regulation:     { 없음:+1, 보통:0, 엄격:-2 },
  team:           { 집중:+1, 혼합:0, 분산:-1 },
};
function ruleBasedSDLC(f, projectType) {
  const score = Object.entries(SDLC_SCORES)
    .reduce((s,[k,m]) => s + (m[f[k]] ?? 0), 0);
  let approach = score <= -3 ? "예측형" : score >= 3 ? "적응형" : "하이브리드";

  // 접근법 내 세부 모델 분기
  let id;
  // 리스크 주도 우선 규칙: 리스크 높음 + 요구 불명확(+빈번 인도 아님) → 접근법 구간과 무관하게 나선형
  if (f.risk === "높음" && f.req_clarity === "낮음" && f.delivery !== "빈번") {
    id = "spiral"; approach = "하이브리드";
  } else if (approach === "예측형") {
    id = (f.regulation === "엄격" || f.risk === "높음") ? "v-model" : "waterfall";
  } else if (approach === "적응형") {
    id = (f.delivery === "빈번" && (projectType === "유지보수" || projectType === "고도화")) ? "devops" : "agile";
  } else {
    if (f.risk === "높음" && f.req_clarity === "낮음") id = "spiral";
    else if (f.delivery === "단계적") id = "incremental";
    else id = "iterative";
  }
  const model = SDLC_MODELS.find(m => m.id === id);

  const MODEL_REASON = {
    "waterfall":   "요구가 명확·안정적이고 일괄 인도 구조이므로 순차 개발이 효율적입니다.",
    "v-model":     "규제·리스크 요건이 높아 단계별 검증(V&V)과 증적 확보가 중요하므로 V-Model이 적합합니다.",
    "spiral":      "요구 불확실성과 리스크가 모두 커 리스크 분석 주도의 반복 접근이 필요합니다.",
    "incremental": "기능 묶음 단위의 단계적 인도 구조에 맞춰 점진적으로 인도하는 방식이 적합합니다.",
    "iterative":   "핵심 기능부터 구현 후 반복 보완하는 균형적 접근이 적합합니다.",
    "agile":       "요구 변동이 크고 잦은 인도가 필요하므로 짧은 반복 주기의 적응형 개발이 적합합니다.",
    "devops":      "운영 중 시스템의 지속 개선·배포가 핵심이므로 CI/CD 기반 DevOps가 적합합니다.",
  };
  const reason = `요구사항 명확성 '${f.req_clarity}'·변동성 '${f.req_volatility}', 인도 방식 '${f.delivery}', 리스크 '${f.risk}', 규제 '${f.regulation}', 팀 구성 '${f.team}'을 PMBOK® 8판 개발접근법 선정 요인에 대입한 결과 스펙트럼 점수 ${score>0?"+":""}${score}점으로 ${approach} 접근이 적합합니다. ${MODEL_REASON[id]}`;

  // 대안 2종 — 인접 접근법 중심 규칙
  const ALT_NOTE = {
    "waterfall":   "규제·리스크가 완화되면 관리 부담이 적은 폭포수가 더 효율적입니다.",
    "v-model":     "법정 감리·인증 요건이 추가되면 단계별 검증 증적이 강한 V-Model이 더 낫습니다.",
    "spiral":      "리스크가 더 커지거나 요구가 더 불명확해지면 리스크 주도 나선형이 더 낫습니다.",
    "incremental": "고객이 기능 묶음별 조기 오픈을 원하면 점진형 인도가 더 낫습니다.",
    "iterative":   "핵심 기능 우선 검증이 중요해지면 반복형이 더 낫습니다.",
    "agile":       "요구 변동이 더 커지고 고객 협업이 긴밀하면 Agile/Scrum이 더 낫습니다.",
    "devops":      "운영 이관 후에도 지속 배포가 이어지면 DevOps 전환이 더 낫습니다.",
  };
  const altIds = SDLC_MODELS.filter(m => m.id !== id)
    .sort((a,b) => {
      const rank = m2 => (m2.approach === approach ? 0 : m2.approach === "하이브리드" || approach === "하이브리드" ? 1 : 2);
      return rank(a) - rank(b);
    }).slice(0,2);
  const alternatives = altIds.map(m => ({ id:m.id, label:m.label, note:ALT_NOTE[m.id] }));

  return { recommended: { id, label: model?.label || id, approach }, reason, alternatives };
}

// ── 산출물 목적 사전 (AI 미사용) — 산출물명 키워드 매칭으로 1문장 결정적 생성 ──
const PURPOSE_RULES = [
  [/사업수행계획|수행계획서/, "프로젝트 수행 범위·일정·체계 확정"],
  [/테일러링결과|PDP/i,      "OSSP 테일러링 결과의 공식 정의"],
  [/WBS|작업분류/i,          "작업 분해 및 일정 기준선 수립"],
  [/요구사항\s*정의/,        "이해관계자 요구의 식별·확정"],
  [/요구사항\s*명세/,        "요구의 구현·검증 가능 수준 상세화"],
  [/요구사항\s*추적|RTM/i,   "요구-설계-시험 간 추적성 확보"],
  [/인터페이스\s*정의/,      "대내외 연계 규격의 확정"],
  [/아키텍처|구조\s*설계/,   "시스템 구조·기술 방식 확정"],
  [/화면\s*설계|UI/i,        "사용자 화면 명세 및 합의"],
  [/(DB|데이터베이스|ERD).*(설계)|테이블\s*정의/i, "데이터 구조 설계의 확정"],
  [/프로그램\s*명세|컴포넌트\s*설계|상세\s*설계/, "구현 단위 설계 명세 확정"],
  [/단위\s*(시험|테스트)/,   "구현 단위의 결함 조기 검출"],
  [/통합\s*(시험|테스트)/,   "모듈 간 연동 정합성 검증"],
  [/시스템\s*(시험|테스트)/, "요구 충족 여부의 종합 검증"],
  [/인수\s*(시험|테스트)/,   "고객 관점 최종 승인 근거 확보"],
  [/(시험|테스트)\s*계획/,   "시험 범위·전략·기준 사전 정의"],
  [/(시험|테스트)\s*결과/,   "시험 수행 증적 및 결함 조치 확인"],
  [/전환\s*계획|이행\s*계획/, "운영 전환 절차·리스크 사전 정의"],
  [/전환\s*결과|이행\s*결과/, "전환 수행 결과의 검증·승인"],
  [/교육/,                    "사용자·운영자 역량 이전"],
  [/운영\s*(매뉴얼|지침)/,   "운영 절차의 표준화·이관"],
  [/사용자\s*매뉴얼/,        "사용자 활용 방법 안내"],
  [/완료\s*보고|종료\s*보고/, "사업 결과의 공식 보고·승인"],
  [/회의록/,                  "의사결정 사항의 기록·공유"],
  [/(진척|주간|월간).*(보고)/, "진척 현황 공유 및 이슈 조기 식별"],
  [/위험|리스크/,             "위험 식별·대응의 체계적 관리"],
  [/이슈/,                    "이슈 추적 및 해결 이력 관리"],
  [/변경\s*(요청|관리)/,     "변경의 통제된 평가·승인"],
  [/형상|베이스라인/,         "산출물 형상의 무결성 유지"],
  [/품질보증|QA\s*계획/i,    "품질 활동 계획·기준 수립"],
  [/검토\s*(결과|보고)|검수/, "산출물 적합성의 공식 확인"],
  [/감리/,                    "법정 감리 대응 증적 확보"],
  [/보안/,                    "보안 요건 이행의 확인·증적화"],
];
function deriveDeliverablePurpose(name) {
  const n = String(name || "");
  for (const [re, purpose] of PURPOSE_RULES) if (re.test(n)) return purpose;
  return `${n} 작성을 통한 단계 품질 확보`;
}

// ── ASPICE 과제 PBS — 시스템 요소(HW·SW) 기준. 개발 범위(SW / HW+SW / HW)에 따라 HW·SW 분기를 결정한다 ──
const ASPICE_PBS_HW = ["MCU 회로", "전원 회로", "센싱·측정 회로", "통신 트랜시버", "구동·출력 회로", "보호·커넥터 회로"];
const ASPICE_PBS_SW = ["애플리케이션 기능 SWC", "통신 스택(CAN/LIN)", "진단(UDS)", "BSW·드라이버", "부트로더"];
function aspicePbsPreset(form) {
  const dev = aspiceDevOf(form), sys = String(form?.systemName || form?.name || "대상 시스템").trim();
  return [...(dev !== "HW" ? ASPICE_PBS_SW.map(x => `${sys} > SW > ${x}`) : []), ...(dev !== "SW" ? ASPICE_PBS_HW.map(x => `${sys} > HW > ${x}`) : [])];
}
// AI가 낸 PBS를 시스템 요소 기준으로 정리: 활동·단계 노드 제거, 개발 범위 밖 분기 제거, HW 포함 과제에 HW가 없으면 표준 HW 요소 보충
const PBS_ACTIVITY_RE = /요구사항|분석|설계|구현|테스트|시험|검증|문서|지원|교육|개발$/;
function cleanAspicePbs(list, dev, sys) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(raw => {
    const parts = String(raw || "").split(">").map(x => x.trim()).filter(Boolean);
    if (parts.length < 2) return;
    if (parts.slice(1).some(p => PBS_ACTIVITY_RE.test(p))) return;           // 활동·단계 노드
    const lv = /^HW$|하드웨어/i.test(parts[1]) ? "HW" : /^SW$|소프트웨어/i.test(parts[1]) ? "SW" : null;
    if (!lv) return;                                                        // HW/SW 분기가 아닌 노드
    if ((lv === "HW" && dev === "SW") || (lv === "SW" && dev === "HW")) return;
    const line = [sys, lv, ...parts.slice(2)].join(" > ");
    if (!out.includes(line)) out.push(line);
  });
  // 범위 안의 분기(HW·SW)마다 요소가 3개 미만이면 표준 요소로 보충 (AI가 낸 고유 요소는 유지)
  for (const [lv, std, on] of [["HW", ASPICE_PBS_HW, dev !== "SW"], ["SW", ASPICE_PBS_SW, dev !== "HW"]]) {
    if (!on) continue;
    const have = out.filter(l => l.split(" > ")[1] === lv).length;
    if (have < 3) std.slice(0, Math.max(0, std.length - have)).forEach(x => { const l = `${sys} > ${lv} > ${x}`; if (!out.includes(l)) out.push(l); });
  }
  return out;
}

// ── PBS 프리셋 (AI 실패 시 폴백) — 프로젝트 유형별 기본 제품 분해 구조 ──
const PBS_PRESETS = {
  "신규개발": [
    "응용시스템 > 사용자 포털 > 메인/안내",
    "응용시스템 > 사용자 포털 > 업무 신청/조회",
    "응용시스템 > 관리자 시스템 > 기준정보 관리",
    "응용시스템 > 관리자 시스템 > 사용자/권한 관리",
    "응용시스템 > 공통 > 인증/보안",
    "응용시스템 > 공통 > 코드/파일 관리",
    "연계 > 대내외 인터페이스",
    "데이터 > DB 구축",
    "기반환경 > 서버/네트워크 구성",
  ],
  "고도화": [
    "개선대상 > 사용자 기능 개선",
    "개선대상 > 관리자 기능 개선",
    "개선대상 > 공통 > 성능/보안 개선",
    "신규기능 > 추가 업무 기능",
    "연계 > 인터페이스 신설/변경",
    "데이터 > 데이터 이행/정비",
    "기반환경 > 인프라 증설/전환",
  ],
  "유지보수": [
    "운영지원 > 장애 대응",
    "운영지원 > 정기 점검/백업",
    "개선 > 기능 개선(SR)",
    "개선 > 성능/보안 패치",
    "데이터 > 데이터 정비/추출 지원",
    "공통 > 형상/배포 관리",
  ],
  "컨설팅": [
    "현황분석 > 업무 현황 분석",
    "현황분석 > 시스템/인프라 진단",
    "목표수립 > 목표모델(To-Be) 정의",
    "목표수립 > 개선과제 도출",
    "이행계획 > 로드맵/우선순위",
    "이행계획 > 소요예산/조직 방안",
  ],
};

function StepSDLC({ factors, setFactors, selected, setSelected, recommendation, recommending, genError, onRecommend }) {
  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>SDLC(개발 생애주기) 선택</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:16 }}>프로젝트 특성을 입력하면 PMBOK® 8판 기준으로 적합한 모델을 추천합니다. 최종 선택은 직접 확정하세요.</p>

      {/* 프로젝트 특성 입력 — 각 버튼 아래에 판정 기준 표시 */}
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:16 }}>
        {SDLC_FACTORS.map(f=>{
          const crit = SDLC_FACTOR_CRITERIA[f.id];
          return (
            <div key={f.id}>
              <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{f.label}</div>
              {crit?.help && <div style={{ fontSize:10, color:T.muted, marginBottom:6 }}>{crit.help}</div>}
              <div style={{ display:"flex", gap:8, alignItems:"stretch" }}>
                {f.options.map(opt=>{
                  const on = factors[f.id]===opt;
                  return (
                    <div key={opt} style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                      <button onClick={()=>setFactors(s=>({...s,[f.id]:opt}))}
                        style={{ width:"100%", padding:"7px 0", borderRadius:8, fontSize:12, fontFamily:"inherit",
                          background:on?T.accent:T.bg, color:on?"#fff":T.muted,
                          border:`1px solid ${on?T.accent:T.border}`, cursor:"pointer",
                          fontWeight:on?600:400 }}>{opt}</button>
                      {crit?.options?.[opt] && (
                        <div style={{ fontSize:9.5, color:on?T.text:T.muted, lineHeight:1.5, padding:"0 2px" }}>
                          {crit.options[opt]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom:16 }}>
        <Btn onClick={onRecommend} disabled={recommending} style={{ fontSize:12, padding:"8px 14px" }}>
          {recommending ? "분석 중…" : "⚡ PMBOK® 기준 추천"}
        </Btn>
      </div>

      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9, marginBottom:12 }}>{genError}</div>}

      {/* 추천 근거 */}
      {recommendation?.recommended && (
        <div style={{ marginBottom:16, animation:"fadeIn .4s" }}>
          <Card style={{ padding:14, background:T.bg, border:`1px solid ${T.accent}55` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <Badge color={T.green}>PMBOK® 기준 추천</Badge>
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
      {/* 상표 귀속 문구 — PMBOK® 마크가 표시되는 화면에 상시 노출 (모바일 포함) */}
      <div style={{ marginTop:16, fontSize:9, color:T.muted, lineHeight:1.5, opacity:.8 }}>
        PMBOK is a registered mark of Project Management Institute, Inc. 본 서비스는 PMI와 제휴·보증 관계가 없습니다.
      </div>
    </div>
  );
}

function StepOSSP({ selected, setSelected, customOSSP=[], sdlc, track }) {
  // SDLC와 같은 접근(또는 같은 모델 id)을 가진 OSSP를 상단으로 정렬
  const all = [...OSSP_OPTIONS, ...customOSSP];
  // 과제 유형별 필터: ASPICE → ASPICE로 식별되는 OSSP, 일반 SI → 그 외. 해당 OSSP가 없거나 '모두 보기'면 전체 표시
  const [showAll, setShowAll] = useState(false);
  const fits = o => track === "aspice" ? isAspiceOSSP(o) : track === "standard" ? !isAspiceOSSP(o) : true;
  const fitting = all.filter(fits);
  const base = (showAll || !fitting.length) ? all : fitting;
  const hidden = all.length - base.length;
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
      {track && (
        <div style={{ fontSize:11, color:T.muted, marginBottom:12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span>{track === "aspice" ? "🚗 ASPICE 자동차 과제" : "🏢 일반 SI 과제"}에 맞는 OSSP만 표시합니다{track === "aspice" && !fitting.length ? " — ASPICE로 식별되는 OSSP가 없어 전체를 표시합니다. 고른 OSSP에는 ASPICE 테일러링 가이드가 적용됩니다." : ""}</span>
          {(hidden > 0 || showAll) && fitting.length > 0 && <button onClick={()=>setShowAll(v=>!v)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:11, padding:"2px 8px", fontFamily:"inherit" }}>{showAll ? "유형에 맞는 OSSP만" : `다른 OSSP ${hidden}개도 보기`}</button>}
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {options.map(o=>(
          <div key={o.id} onClick={()=>setSelected(track ? { ...o, guideId: trackGuideId(track, o) || undefined } : o)} style={{ padding:16, borderRadius:12, border:`2px solid ${selected?.id===o.id?T.accent:T.border}`, background:selected?.id===o.id?T.accentGlow:T.bg, cursor:"pointer", transition:"all .2s" }}>
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

// 규모/설계방식/방법론 가이드에 따라 산출물을 필수(M)/선택(O)/제외로 분류
function classifyDeliverables(scale, method, guide, aspiceScope) {
  const g = guide || TAILORING_GUIDES.ie;
  const inScope = d => {
    if (g.id !== "aspice" || !aspiceScope) return true;
    const grp = aspiceRowGroup(d);
    return !grp || aspiceGroupOn(aspiceScope, grp);
  };
  const scaleKey = scale === "(초)대형" ? "large" : scale === "중형" ? "medium" : "small";
  const result = [];
  for (const d of g.matrix) {
    // 설계방식(UML/IE) 개념이 있는 가이드만 방식 필터 적용, '공통'은 항상 포함
    if (g.hasDesignMethod && d.method !== "공통" && d.method !== method) continue;
    const mark = d[scaleKey];
    if (!mark || mark === "-") continue;
    if (!inScope(d)) continue;   // ASPICE: 적용 범위에서 뺀 프로세스의 산출물 제외
    result.push({ ...d, required: mark === "M" });
  }
  return result;
}

// 테일러링 단계 — [방법론 테일러링(산출물)] / [프로세스 테일러링(관리 프로세스)] 두 탭으로 구성
function StepTailoring({ tailoring, setTailoring, ossp }) {
  const [tTab, setTTab] = useState("method");
  const procLevel = tailoring?.process?.level || "L3";
  return (
    <div>
      <div style={{ display:"flex", gap:3, marginBottom:16, background:T.bg, borderRadius:10, padding:3, border:`1px solid ${T.border}` }}>
        {[["method","개발산출물 테일러링"],["process","관리활동 테일러링"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTTab(id)}
            style={{ flex:1, padding:"8px 0", borderRadius:7, fontSize:12, fontWeight:tTab===id?700:400,
              background:tTab===id?T.accent:"transparent", color:tTab===id?"#fff":T.muted,
              border:"none", cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
        ))}
      </div>
      {tTab==="method"
        ? <MethodologyTailoring tailoring={tailoring} setTailoring={setTailoring} ossp={ossp} />
        : getGuideForOSSP(ossp)?.mgmtActivities
          ? <AspiceMgmtList tailoring={tailoring} setTailoring={setTailoring} guide={getGuideForOSSP(ossp)} editable />
          : <StepProcessTailoring tailoring={tailoring} setTailoring={setTailoring} />}
    </div>
  );
}

// 프로세스 테일러링 가이드 전문 열람 모달 (원본 xls의 수행 방법·목적·매트릭스 전체)
function ProcessGuideModal({ onClose }) {
  const G = PROCESS_TAILORING_GUIDE;
  const byArea = {};
  G.items.forEach(it => { (byArea[it.area] = byArea[it.area] || []).push(it); });
  const markCell = (m) => (
    <td style={{ ...cell, textAlign:"center", fontWeight:700, color:m==="●"?T.accent:m==="○"?T.amber:T.muted }}>{m}</td>
  );
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, width:"100%", maxWidth:1000, maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>{G.title.replace("프로세스 테일러링", "관리활동 테일러링")} — 전문</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:"14px 18px", overflowY:"auto" }}>
          {/* 적용 기준 */}
          <div style={{ fontSize:11, color:T.muted, lineHeight:1.8, padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, marginBottom:4 }}>
            <div>{G.levelNote}</div>
            <div>{G.sizeNote}</div>
            <div>범례: <span style={{ color:T.accent, fontWeight:700 }}>●</span> 필수(항상 적용) · <span style={{ color:T.amber, fontWeight:700 }}>○</span> 선택 · <span style={{ color:T.muted }}>-</span> 해당 등급 미적용</div>
          </div>

          {/* 1. 프로세스별 목적 */}
          <SectionTitle n="1" title="프로세스별 목적 (Goal)" />
          <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
            <tbody>
              {Object.entries(G.goals).map(([k,v])=>(
                <tr key={k}>
                  <td style={{ ...cellHead, verticalAlign:"top", width:140 }}>{k}</td>
                  <td style={{ ...cell, lineHeight:1.7 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 2. 테일러링 가이드 매트릭스 */}
          <SectionTitle n="2" title={`테일러링 가이드 매트릭스 (전체 ${G.items.length}건)`} />
          <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <td style={{...cellHead, textAlign:"center"}} rowSpan={2}>프로세스 영역</td>
                <td style={{...cellHead, textAlign:"center"}} rowSpan={2}>세부 프로세스</td>
                <td style={{...cellHead, textAlign:"center"}} colSpan={3}>적용 등급</td>
                <td style={{...cellHead, textAlign:"center"}} rowSpan={2}>테일러링 적용 가이드</td>
                <td style={{...cellHead, textAlign:"center"}} rowSpan={2}>주요 산출물</td>
              </tr>
              <tr>{G.levels.map(lv=><td key={lv} style={{...cellHead, textAlign:"center", width:34}}>{lv}</td>)}</tr>
            </thead>
            <tbody>
              {Object.keys(byArea).map(area=>(
                byArea[area].map((it,i)=>(
                  <tr key={`${area}-${i}`}>
                    {i===0 && <td style={{...cell, fontWeight:600, verticalAlign:"top", whiteSpace:"nowrap"}} rowSpan={byArea[area].length}>{area}</td>}
                    <td style={cell}>{it.process}{it.activity && <span style={{ color:T.muted }}> › {it.activity}</span>}</td>
                    {markCell(it.l3)}{markCell(it.l4)}{markCell(it.l5)}
                    <td style={{...cell, fontSize:10, lineHeight:1.6, color:it.guide?T.text:T.muted }}>{it.guide || ""}</td>
                    <td style={{...cell, fontSize:10, lineHeight:1.6, color:it.outputs?T.text:T.muted }}>{it.outputs || ""}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 프로세스 테일러링 — 조직 표준 관리 프로세스(요구사항관리·계획수립·품질보증 등)를
// 적용 등급(L3/L4/L5) 기준으로 확정. 필수(●)는 항상 적용(수정 불가), 선택(○)만 적용·변경 여부 조정 가능.
function StepProcessTailoring({ tailoring, setTailoring }) {
  const G = PROCESS_TAILORING_GUIDE;
  const [showGuide, setShowGuide] = useState(false);   // 가이드 전문 모달
  const proc = tailoring?.process || {};
  const level = proc.level || "L3";
  const setLevel = (v) => setTailoring(t => ({ ...t, process: { ...(t.process||{}), level: v, items: (t.process?.items)||{} } }));
  const setItem = (key, patch) => setTailoring(t => {
    const p = t.process || {};
    const items = { ...(p.items||{}) };
    items[key] = { ...(items[key]||{}), ...patch };
    return { ...t, process: { ...p, level: p.level||"L3", items } };
  });

  const resolved = resolveProcessTailoring({ ...proc, level });
  const byArea = {};
  resolved.forEach(r => { (byArea[r.area] = byArea[r.area] || []).push(r); });
  const applicable = resolved.filter(r => r.status !== "해당없음");
  const required = applicable.filter(r => r.mark === "●");
  const optional = applicable.filter(r => r.mark === "○");
  const includedOptional = optional.filter(r => r.applied);

  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>관리활동 테일러링</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:14 }}>
        요구사항·계획·품질 등 관리활동의 적용 범위를 확정합니다.
        <span style={{ marginLeft:8 }}>
          · <span onClick={()=>setShowGuide(true)} title="관리활동 테일러링 가이드 전문 보기"
              style={{ color:T.accent, cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }}>
              {G.title.replace("프로세스 테일러링", "관리활동 테일러링")} 기준 🔍
            </span>
        </span>
      </p>

      {/* 적용 등급 선택 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>관리 성숙도 수준 (Required Maturity Level)</div>
        <div style={{ display:"flex", gap:8 }}>
          {G.levels.map(lv=>(
            <button key={lv} onClick={()=>setLevel(lv)}
              style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontFamily:"inherit",
                background:level===lv?T.accent:T.bg, color:level===lv?"#fff":T.muted,
                border:`1px solid ${level===lv?T.accent:T.border}`, cursor:"pointer", fontWeight:level===lv?600:400 }}>{lv}</button>
          ))}
        </div>
        <div style={{ fontSize:10, color:T.muted, marginTop:6, lineHeight:1.6 }}>{G.levelNote}<br/>{G.sizeNote}</div>
      </div>

      {/* 요약 — 방법론 테일러링과 동일 구성 */}
      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:9, background:T.bg, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.accent }}>{required.length}</div>
          <div style={{ fontSize:11, color:T.muted }}>필수 프로세스 (●)</div>
        </div>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:9, background:T.bg, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.amber }}>{includedOptional.length}<span style={{ fontSize:12, color:T.muted }}> / {optional.length}</span></div>
          <div style={{ fontSize:11, color:T.muted }}>선택 프로세스 (○, 포함/전체)</div>
        </div>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:9, background:T.bg, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.green }}>{required.length + includedOptional.length}</div>
          <div style={{ fontSize:11, color:T.muted }}>총 적용 프로세스</div>
        </div>
      </div>
      <div style={{ fontSize:10, color:T.muted, marginBottom:10 }}>
        ※ 필수(●) 프로세스는 항상 적용되며 수정할 수 없습니다. 선택(○) 프로세스만 적용 여부·변경 여부를 조정할 수 있으며, 변경·미적용 시 사유를 기록합니다.
      </div>

      {/* 영역별 세부 프로세스 목록 */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, maxHeight:420, overflowY:"auto", paddingRight:4 }}>
        {Object.keys(byArea).map(area=>(
          <div key={area}>
            <div title={G.goals[area] || ""} style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:6, position:"sticky", top:0, background:T.surface, padding:"2px 0", zIndex:1 }}>
              {area} <span style={{ color:T.muted, fontWeight:400 }}>({byArea[area].filter(r=>r.status!=="해당없음").length}/{byArea[area].length})</span>
              {G.goals[area] && <span style={{ color:T.muted, fontWeight:400, fontSize:10, marginLeft:6 }} title={G.goals[area]}>ⓘ 목적</span>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {byArea[area].map(r=>{
                const na = r.status === "해당없음";
                const req = r.mark === "●";
                return (
                  <div key={r.key} style={{ padding:"6px 10px", borderRadius:7, background:T.bg,
                    border:`1px solid ${T.border}`, opacity:na?0.4:(!req && !r.applied?0.55:1) }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Badge color={req?T.accent:r.mark==="○"?T.amber:T.muted}>
                        {req?"필수":r.mark==="○"?"선택":"해당없음"}
                      </Badge>
                      <span title={r.guide || ""} style={{ fontSize:12, color:T.text, flex:1, textDecoration:!na && !req && !r.applied ? "line-through" : "none" }}>
                        {r.process}{r.activity && <span style={{ color:T.muted }}> › {r.activity}</span>}
                        {r.guide && <span style={{ color:T.muted, fontSize:10, marginLeft:5 }}>ⓘ</span>}
                      </span>
                      {!na && req && (
                        <span title="필수 프로세스는 항상 적용됩니다" style={{ fontSize:12, color:T.accent, whiteSpace:"nowrap" }}>☒ 적용</span>
                      )}
                      {!na && !req && (
                        <span style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
                          <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:r.applied?T.text:T.red, cursor:"pointer", whiteSpace:"nowrap" }}>
                            <input type="checkbox" checked={r.applied}
                              onChange={e=>setItem(r.key,{ applied:e.target.checked, changed:e.target.checked?r.changed:false, reason:r.reason })}
                              style={{ width:13, height:13, cursor:"pointer" }} />적용
                          </label>
                          <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:r.changed?T.amber:T.muted, cursor:r.applied?"pointer":"not-allowed", opacity:r.applied?1:0.4, whiteSpace:"nowrap" }}>
                            <input type="checkbox" checked={r.changed} disabled={!r.applied}
                              onChange={e=>setItem(r.key,{ applied:r.applied, changed:e.target.checked, reason:r.reason })}
                              style={{ width:13, height:13, cursor:r.applied?"pointer":"not-allowed" }} />변경
                          </label>
                        </span>
                      )}
                    </div>
                    {r.outputs && !na && (
                      <div style={{ fontSize:10, color:T.muted, marginTop:3, paddingLeft:2 }}>산출물: {r.outputs}</div>
                    )}
                    {!na && !req && r.status!=="적용" && (
                      <input value={r.reason} onChange={e=>setItem(r.key,{ reason:e.target.value })}
                        placeholder={r.applied ? "변경 내역 입력" : "미적용 사유 입력"}
                        style={{ width:"100%", boxSizing:"border-box", marginTop:5, background:"transparent",
                          border:"none", borderBottom:`1px dashed ${T.border}`, color:T.text,
                          fontSize:11, fontFamily:"inherit", outline:"none", padding:"3px 2px" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 가이드 전문 모달 */}
      {showGuide && <ProcessGuideModal onClose={()=>setShowGuide(false)} />}
    </div>
  );
}

function MethodologyTailoring({ tailoring, setTailoring, ossp }) {
  const [showGuide, setShowGuide] = useState(false);   // 테일러링 가이드 열람 모달
  const guide = getGuideForOSSP(ossp);                 // 선택한 OSSP에 해당하는 테일러링 가이드
  const scale = tailoring.scale || "중형";
  const method = tailoring.method || "UML";
  const excluded = tailoring.excluded || {};   // { code: true } = 사용자가 제외한 선택 산출물

  const list = classifyDeliverables(scale, method, guide, tailoring?.aspiceScope);
  const required = list.filter(d => d.required);
  const optional = list.filter(d => !d.required);
  const includedOptional = optional.filter(d => !excluded[d.code]);

  // 단계 순서 (가이드별)
  const PHASE_ORDER = guide.phaseOrder;
  const grouped = {};
  for (const d of list) (grouped[d.phase] = grouped[d.phase] || []).push(d);

  const setScale = (v) => setTailoring(t => ({ ...t, scale:v }));
  const setMethod = (v) => setTailoring(t => ({ ...t, method:v }));
  const toggleExclude = (code) => setTailoring(t => {
    const ex = { ...(t.excluded||{}) }; ex[code] = !ex[code]; return { ...t, excluded:ex };
  });

  return (
    <div>
      <h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>개발산출물 테일러링</h2>
      <p style={{ fontSize:12, color:T.muted, marginBottom:14 }}>
        선택: <span style={{ color:T.accent, fontWeight:600 }}>{ossp?.label}</span>
        <span style={{ marginLeft:8, color:T.muted }}>
          · <span onClick={()=>setShowGuide(true)} title="테일러링 가이드 전문 보기"
              style={{ color:T.accent, cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }}>
              {guide.title} 기준 🔍
            </span>
        </span>
      </p>

      {/* 프로젝트 규모 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>{guide.scaleTitle || "프로젝트 규모"}</div>
        {guide.id === "aspice" && (
          <div style={{ fontSize:12, color:T.text, padding:"8px 12px", background:T.bg, border:`1px solid ${T.accent}55`, borderRadius:8 }}>
            {guide.scaleOptions.find(o => o.value === scale)?.label || scale} <span style={{ color:T.muted, fontSize:11 }}>— 목표 능력수준은 기본정보 단계에서 변경합니다</span>
          </div>
        )}
        <div style={{ display: guide.id === "aspice" ? "none" : "flex", gap:8 }}>
          {guide.scaleOptions.map(o=>(
            <button key={o.value} onClick={()=>setScale(o.value)}
              style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontFamily:"inherit",
                background:scale===o.value?T.accent:T.bg, color:scale===o.value?"#fff":T.muted,
                border:`1px solid ${scale===o.value?T.accent:T.border}`, cursor:"pointer", fontWeight:scale===o.value?600:400 }}>{o.label}</button>
          ))}
        </div>
        <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>{guide.sizeNote}</div>
        {guide.scaleDesc?.[scale] && (
          <div style={{ fontSize:11, color:T.text, lineHeight:1.6, marginTop:8, padding:"8px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8 }}>{guide.scaleDesc[scale]}</div>
        )}
      </div>

      {/* 설계방식 — UML/IE 구분이 있는 가이드(IE 기반)에서만 표시 */}
      {guide.hasDesignMethod && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>프로세스 설계방식</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["UML","UML (객체지향)"],["IE","IE (정보공학)"]].map(([v,label])=>(
              <button key={v} onClick={()=>setMethod(v)}
                style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontFamily:"inherit",
                  background:method===v?T.accent:T.bg, color:method===v?"#fff":T.muted,
                  border:`1px solid ${method===v?T.accent:T.border}`, cursor:"pointer", fontWeight:method===v?600:400 }}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>※ 공통 산출물은 항상 포함되며, 선택한 설계방식 전용 산출물이 추가됩니다.</div>
        </div>
      )}

      {/* 요약 */}
      <div style={{ display:"flex", gap:10, marginBottom:14 }}>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:9, background:T.bg, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.accent }}>{required.length}</div>
          <div style={{ fontSize:11, color:T.muted }}>필수 산출물 (M)</div>
        </div>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:9, background:T.bg, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.amber }}>{includedOptional.length}<span style={{ fontSize:12, color:T.muted }}> / {optional.length}</span></div>
          <div style={{ fontSize:11, color:T.muted }}>선택 산출물 (O, 포함/전체)</div>
        </div>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:9, background:T.bg, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.green }}>{required.length + includedOptional.length}</div>
          <div style={{ fontSize:11, color:T.muted }}>총 적용 산출물</div>
        </div>
      </div>

      {/* 단계별 산출물 목록 */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, maxHeight:380, overflowY:"auto", paddingRight:4 }}>
        {PHASE_ORDER.filter(ph=>grouped[ph]?.length).map(ph=>(
          <div key={ph}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:6, position:"sticky", top:0, background:T.surface, padding:"2px 0" }}>
              {ph} <span style={{ color:T.muted, fontWeight:400 }}>({grouped[ph].length})</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {grouped[ph].map(d=>{
                const isExcluded = !d.required && excluded[d.code];
                return (
                  <div key={d.code}
                    onClick={()=>{ if(!d.required) toggleExclude(d.code); }}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7,
                      background:T.bg, border:`1px solid ${T.border}`, cursor:d.required?"default":"pointer",
                      opacity:isExcluded?0.45:1 }}>
                    {d.required ? (
                      <Badge color={T.accent}>필수</Badge>
                    ) : (
                      <input type="checkbox" checked={!isExcluded} onChange={()=>toggleExclude(d.code)}
                        onClick={e=>e.stopPropagation()} style={{ width:13, height:13, cursor:"pointer" }} />
                    )}
                    <span style={{ fontSize:11, color:T.muted, fontFamily:"monospace", flexShrink:0 }}>{d.code}</span>
                    <span style={{ fontSize:12, color:T.text, flex:1, textDecoration:isExcluded?"line-through":"none" }}>
                      {d.name}{d.note && <span style={{ color:T.muted, fontSize:10, marginLeft:6 }}>({d.note})</span>}
                    </span>
                    {d.method!=="공통" && <Badge color={T.muted}>{d.method}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 테일러링 가이드 전문 모달 */}
      {showGuide && <TailoringGuideModal guide={guide} onClose={()=>setShowGuide(false)} />}
    </div>
  );
}

function StepPDP({ pdpData, generating, genError, onGenerate, tailoring, setTailoring, ossp, sdlc, form }) {
  const scale = tailoring?.scale || "중형";
  const method = tailoring?.method || "UML";
  const excluded = tailoring?.excluded || {};
  const guide = getGuideForOSSP(ossp);
  const scaleLabel = guide.scaleOptions?.find(o=>o.value===scale)?.label || scale;
  const PHASE_ORDER = guide.phaseOrder;

  // 가이드 기준 전체 산출물 — 테일러링결과서 양식에 따라 미적용 산출물도 함께 표시
  const list = classifyDeliverables(scale, method, guide, tailoring?.aspiceScope);
  const grouped = {};
  list.forEach(d => { (grouped[d.phase] = grouped[d.phase] || []).push(d); });

  // 산출물별 테일러링 기록: tailoring.notes = { "단계:코드": { applied, changed, reason } }
  // (프로젝트 저장 시 tailoring JSON에 함께 보존)
  const notes = tailoring?.notes || {};
  const noteKey = (d) => `${d.phase}:${d.code}`;
  // 적용 여부: 필수(M)는 항상 적용(수정 불가). 선택(O)은 테일러링 단계 결과가 기본값, 이 화면에서 수정 가능
  const isApplied = (d) => {
    if (d.required) return true;
    const ov = notes[noteKey(d)]?.applied;
    return ov !== undefined ? ov : !excluded[d.code];
  };
  const appliedCount = list.filter(isApplied).length;
  const setNote = (d, patch) => setTailoring && setTailoring(t => {
    const ns = { ...(t.notes || {}) };
    const k = `${d.phase}:${d.code}`;
    ns[k] = { ...(ns[k] || {}), ...patch };
    return { ...t, notes: ns };
  });

  const docNo = `PDP-${(form?.client||"").replace(/\s/g,"").slice(0,4).toUpperCase()||"PRJ"}-${new Date().getFullYear()}`;
  const today = new Date().toLocaleDateString("ko-KR");

  // 프로세스 테일러링 확정 상태 — 이 화면에서도 방법론 매트릭스와 동일하게 직접 수정 가능
  const procState = tailoring?.process || {};
  const procLevel = guide?.mgmtActivities ? mgmtLevelLabel(tailoring, guide) : (procState.level || "L3");
  const procApplicable = resolveMgmt(tailoring, guide, procState).filter(r => r.status !== "해당없음");
  const procByArea = {};
  procApplicable.forEach(r => { (procByArea[r.area] = procByArea[r.area] || []).push(r); });
  const setProcItem = (r, patch) => setTailoring && setTailoring(t => {
    // ASPICE 관리활동: 적용 여부는 해당 선택 산출물의 적용/제외와 연동 (산출물 목록·WBS와 일치)
    if (String(r.key).startsWith("am:")) {
      if (patch.applied === undefined || !r.outCode) return t;
      return { ...t, excluded: { ...(t.excluded || {}), [r.outCode]: !patch.applied } };
    }
    const p = t.process || {};
    const items = { ...(p.items||{}) };
    items[r.key] = { applied:r.applied, changed:r.changed, reason:r.reason, ...patch };
    return { ...t, process: { ...p, level: p.level || "L3", items } };
  });

  // 표 안 인라인 입력 스타일
  const noteInput = { width:"100%", boxSizing:"border-box", background:"transparent", border:"none",
    borderBottom:`1px dashed ${T.border}`, color:T.text, fontSize:10.5, fontFamily:"inherit",
    outline:"none", padding:"2px 2px" };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>PDP (테일러링결과서) 생성</h2><p style={{ fontSize:11, color:T.muted }}>OSSP를 테일러링가이드 기준으로 테일러링한 결과를 정식 문서로 작성합니다.</p></div>
        {!pdpData && <Btn onClick={onGenerate} disabled={generating} style={{ fontSize:12, padding:"7px 12px" }}>⚡ 생성</Btn>}
      </div>
      {generating && <Spinner text="테일러링결과서 작성 중…" />}
      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9 }}>{genError}</div>}
      {pdpData && (
        <div style={{ display:"flex", flexDirection:"column", gap:0, animation:"fadeIn .4s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <Badge color={T.green}>✓ 생성 완료</Badge>
            <Btn variant="outline" onClick={onGenerate} style={{ fontSize:11, padding:"4px 10px" }}>재생성</Btn>
          </div>

          {/* 문서 본체 (테일러링결과서 양식) */}
          <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:20, maxHeight:520, overflowY:"auto" }}>
            {/* 표지 */}
            <div style={{ textAlign:"center", paddingBottom:16, borderBottom:`2px solid ${T.accent}` }}>
              <div style={{ fontSize:18, fontWeight:700, letterSpacing:1 }}>프로젝트 정의 프로세스 (PDP)</div>
              <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>테일러링결과서 · Tailoring Result</div>
              <div style={{ fontSize:13, fontWeight:600, color:T.accent, marginTop:10 }}>{form?.name}</div>
            </div>

            {/* 문서 메타 */}
            <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse", margin:"14px 0" }}>
              <tbody>
                {[["문서번호",docNo,"버전","V1.0"],
                  ["고객사",form?.client||"-","작성일",today],
                  ["기준 OSSP",ossp?.label||"-","SDLC",sdlc?.label||"-"]].map((row,i)=>(
                  <tr key={i}>
                    <td style={cellHead}>{row[0]}</td><td style={cell}>{row[1]}</td>
                    <td style={cellHead}>{row[2]}</td><td style={cell}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 1. 프로젝트 개요 */}
            <SectionTitle n="1" title="프로젝트 개요" />
            <div style={{ fontSize:12, color:T.text, lineHeight:1.7, marginBottom:6 }}>{pdpData.overview?.purpose}</div>
            {pdpData.overview?.scope && <div style={{ fontSize:11, color:T.muted, lineHeight:1.6, marginBottom:6 }}><b>범위:</b> {pdpData.overview.scope}</div>}
            {pdpData.overview?.objectives?.length > 0 && (
              <div style={{ fontSize:11, color:T.muted, lineHeight:1.7 }}>
                {pdpData.overview.objectives.map((o,i)=>(
                  <div key={i}><span style={{ color:T.accent, marginRight:5 }}>▸</span>{o}</div>
                ))}
              </div>
            )}

            {/* 2. 테일러링 기준 */}
            <SectionTitle n="2" title="테일러링 기준" />
            <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
              <tbody>
                <tr><td style={cellHead}>적용 가이드</td><td style={cell} colSpan={3}>{guide.title}</td></tr>
                <tr><td style={cellHead}>{guide.scaleTitle || "프로젝트 규모"}</td>{guide.hideDesignMethod ? <td style={cell} colSpan={3}>{scaleLabel}</td> : <><td style={cell}>{scaleLabel}</td><td style={cellHead}>설계방식</td><td style={cell}>{guide.hasDesignMethod ? method : "해당 없음"}</td></>}</tr>
                <tr><td style={cellHead}>{guide.criteriaTitle || "규모 판정 기준"}</td><td style={cell} colSpan={3}>{guide.sizeNote?.replace(/^※\s*/, "")}</td></tr>
              </tbody>
            </table>

            {/* 3. 산출물 테일러링 매트릭스 — 적용/변경 여부 및 사유 기록 */}
            <SectionTitle n="3" title={`개발산출물 테일러링 매트릭스 (전체 ${list.length}건 · 적용 ${appliedCount}건)`} />
            <div style={{ fontSize:10, color:T.muted, marginBottom:8 }}>
              ※ 필수(M) 산출물은 항상 적용되며 수정할 수 없습니다. 선택(O) 산출물은 테일러링 단계의 선택 결과가 기본값이며, 이 화면에서 적용 여부·변경 여부·테일러링 내역 및 사유를 수정·기록할 수 있습니다 (프로젝트 저장 시 함께 보존).
            </div>
            <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
              <thead>
                <tr>{["단계","코드","산출물","구분","적용 여부","변경 여부","테일러링 내역 및 사유"].map(h=>
                  <td key={h} style={{...cellHead, textAlign:"center"}}>{h}</td>)}</tr>
              </thead>
              <tbody>
                {PHASE_ORDER.filter(ph=>grouped[ph]?.length).map(ph=>(
                  grouped[ph].map((d,i)=>{
                    const k = noteKey(d);
                    const n = notes[k] || {};
                    const on = isApplied(d);
                    return (
                      <tr key={`${ph}-${d.code}`} style={{ opacity:on?1:0.55 }}>
                        {i===0 && <td style={{...cell, fontWeight:600, verticalAlign:"top"}} rowSpan={grouped[ph].length}>{ph}</td>}
                        <td style={{...cell, fontFamily:"monospace"}}>{d.code}</td>
                        <td style={cell}>
                          {d.name}
                          {d.note && <span style={{ color:T.muted, fontSize:9.5, marginLeft:4 }}>({d.note})</span>}
                        </td>
                        <td style={{...cell, textAlign:"center"}}>
                          <Badge color={d.required?T.accent:T.amber}>{d.required?"필수":"선택"}</Badge>
                        </td>
                        <td style={{...cell, textAlign:"center"}}>
                          {d.required
                            ? <span style={{ fontSize:14, color:T.accent }} title="필수 산출물은 항상 적용됩니다">☒</span>
                            : <input type="checkbox" checked={on}
                                onChange={e=>setNote(d,{applied:e.target.checked})}
                                style={{ width:14, height:14, cursor:"pointer" }} />}
                        </td>
                        <td style={{...cell, textAlign:"center"}}>
                          {d.required
                            ? <span style={{ fontSize:12, color:T.muted }}>—</span>
                            : <input type="checkbox" checked={!!n.changed}
                                onChange={e=>setNote(d,{changed:e.target.checked})}
                                style={{ width:13, height:13, cursor:"pointer" }} />}
                        </td>
                        <td style={{...cell, minWidth:180 }}>
                          {d.required
                            ? <span style={{ fontSize:11, color:T.muted }}>—</span>
                            : <input value={n.reason||""}
                                onChange={e=>setNote(d,{reason:e.target.value})}
                                placeholder={on ? "" : "미적용 사유 입력"} style={noteInput} />}
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>

            {/* 4. 프로세스 테일러링 내역서 — 방법론 매트릭스와 동일한 컬럼·규칙 (필수 고정, 선택만 수정) */}
            <SectionTitle n="4" title={`관리활동 테일러링 내역서 (${guide?.mgmtActivities ? "ASPICE 관리활동 · 목표 능력수준" : "관리 성숙도 수준"} ${procLevel} · 적용대상 ${procApplicable.length}건)`} />
            <div style={{ fontSize:10, color:T.muted, marginBottom:8 }}>
              ※ 필수(●) 프로세스는 항상 적용되며 수정할 수 없습니다. 선택(○) 프로세스는 이 화면 또는 테일러링 단계의 '관리활동 테일러링' 탭에서 적용 여부·변경 여부·사유를 수정할 수 있습니다 (프로젝트 저장 시 함께 보존).
            </div>
            <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
              <thead>
                <tr>{["프로세스 영역","세부 프로세스","구분","적용 여부","변경 여부","테일러링 내역 및 사유"].map(h=>
                  <td key={h} style={{...cellHead, textAlign:"center"}}>{h}</td>)}</tr>
              </thead>
              <tbody>
                {Object.keys(procByArea).map(area=>(
                  procByArea[area].map((r,i)=>{
                    const req = r.mark === "●";
                    return (
                      <tr key={r.key} style={{ opacity:r.applied?1:0.55 }}>
                        {i===0 && <td style={{...cell, fontWeight:600, verticalAlign:"top"}} rowSpan={procByArea[area].length}>{area}</td>}
                        <td style={cell}>
                          {r.process}{r.activity && <span style={{ color:T.muted }}> › {r.activity}</span>}
                          {r.outputs && <div style={{ color:T.muted, fontSize:9.5, marginTop:2 }}>산출물: {r.outputs}</div>}
                        </td>
                        <td style={{...cell, textAlign:"center"}}>
                          <Badge color={req?T.accent:T.amber}>{req?"필수":"선택"}</Badge>
                        </td>
                        <td style={{...cell, textAlign:"center"}}>
                          {req
                            ? <span style={{ fontSize:14, color:T.accent }} title="필수 프로세스는 항상 적용됩니다">☒</span>
                            : <input type="checkbox" checked={r.applied}
                                onChange={e=>setProcItem(r,{ applied:e.target.checked, changed:e.target.checked?r.changed:false })}
                                style={{ width:14, height:14, cursor:"pointer" }} />}
                        </td>
                        <td style={{...cell, textAlign:"center"}}>
                          {req
                            ? <span style={{ fontSize:12, color:T.muted }}>—</span>
                            : (r.applied
                                ? <input type="checkbox" checked={r.changed}
                                    onChange={e=>setProcItem(r,{ changed:e.target.checked })}
                                    style={{ width:13, height:13, cursor:"pointer" }} />
                                : <span style={{ fontSize:12, color:T.muted }}>—</span>)}
                        </td>
                        <td style={{...cell, minWidth:180 }}>
                          {req || r.status==="적용"
                            ? <span style={{ fontSize:11, color:T.muted }}>—</span>
                            : <input value={r.reason||""}
                                onChange={e=>setProcItem(r,{ reason:e.target.value })}
                                placeholder={r.applied ? "변경 내역 입력" : "미적용 사유 입력"}
                                style={noteInput} />}
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 테일러링결과서 표 셀 스타일
const cell = { border:`1px solid ${T.border}`, padding:"5px 8px", color:T.text };
const cellHead = { border:`1px solid ${T.border}`, padding:"5px 8px", background:T.surface, color:T.muted, fontWeight:600, whiteSpace:"nowrap" };
function SectionTitle({ n, title }) {
  return <div style={{ fontSize:12.5, fontWeight:700, margin:"16px 0 8px", paddingBottom:4, borderBottom:`1px solid ${T.border}` }}>{n}. {title}</div>;
}

// ═══════════════════════════════════════════════════════════════════
// 근무일 달력 유틸 — 주말(토·일) + 사용자 지정 공휴일을 제외한 일정 계산.
// CPM 전진 일정(선행 FS 관계, 근무일 기준 기간)의 자체 구현 (외부 코드 미사용)
// ═══════════════════════════════════════════════════════════════════
function fmtDate(d) { const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
function parseDate(s) { return new Date(s + "T00:00:00"); }
function addDaysStr(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function isWorkday(s, hol) { const w = parseDate(s).getDay(); return w !== 0 && w !== 6 && !hol.includes(s); }
function nextWorkday(s, hol) { let x = s, g = 0; while (!isWorkday(x, hol) && g < 370) { x = addDaysStr(x, 1); g++; } return x; }
function prevWorkday(s, hol) { let x = s, g = 0; while (!isWorkday(x, hol) && g < 370) { x = addDaysStr(x, -1); g++; } return x; }
// 근무일 기준 이동: n>0 → n근무일 뒤, n<0 → n근무일 앞, n=0 → 근무일로 스냅
function shiftWorkdays(s, n, hol) {
  const step = n < 0 ? -1 : 1;
  let x = n < 0 ? prevWorkday(s, hol) : nextWorkday(s, hol), k = Math.abs(n), g = 0;
  while (k > 0 && g < 3700) { x = addDaysStr(x, step); if (isWorkday(x, hol)) k--; g++; }
  return x;
}
// 선행 표기 파서 — MS Project 표기와 동일 규칙
//   "1.2"     → FS, 지연 0        "1.2+3" → FS, 지연 +3근무일
//   "1.2-2"   → FS, 지연 -2(중첩)  "1.2SS" → SS(시작-시작)
//   유형 생략 시 FS, 지연 생략 시 0. 지연 단위는 근무일.
function parsePredToken(tok) {
  const t = String(tok || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return null;
  const m = t.match(/^([0-9]+(?:\.[0-9]+)*)(FS|SS)?(?:([+-])(\d+)(?:D|일)?)?$/);
  if (!m) return null;
  return { code: m[1], type: m[2] || "FS", lag: m[3] ? (m[3] === "-" ? -Number(m[4]) : Number(m[4])) : 0 };
}
function parsePred(str) { return String(str || "").split(",").map(parsePredToken).filter(Boolean); }
// 시작일을 1일째로 세어 n번째 근무일을 반환 (공수 n일 → 종료일)
function addWorkdays(s, n, hol) {
  let x = nextWorkday(s, hol), c = 1, g = 0;
  while (c < n && g < 3700) { x = addDaysStr(x, 1); if (isWorkday(x, hol)) c++; g++; }
  return x;
}
// 두 날짜 사이(양끝 포함)의 근무일 수
function countWorkdays(a, b, hol) {
  if (!a || !b || b < a) return 0;
  let x = a, c = 0, g = 0;
  while (x <= b && g < 3700) { if (isWorkday(x, hol)) c++; x = addDaysStr(x, 1); g++; }
  return c;
}
// 전진 일정 재계산 (MS Project 동일 규칙)
//  · FS: 후행 시작일 = 선행 종료일의 '다음 근무일' + 지연(근무일)
//  · SS: 후행 시작일 = 선행 시작일 + 지연(근무일)
//  · 종료일 = 시작일부터 세어 공수(근무일)번째 날 (시작일 포함, inclusive)
//  여러 선행이면 가장 늦은 시작일을 채택. 연쇄 전파.
function recalcSchedule(tasks, holidays) {
  const all = []; tasks.forEach(t => (t.subtasks || []).forEach(s => all.push(s)));
  const byCode = {}; all.forEach(s => { byCode[s.wbsCode] = s; });
  const cap = all.length + 3;
  for (let it = 0; it < cap; it++) {
    let changed = false;
    for (const s of all) {
      // 자기 참조·미존재 코드·표기 오류는 무시 (화면에서 별도 경고 표시)
      const links = parsePred(s.pred).filter(L => L.code !== s.wbsCode && byCode[L.code]);
      if (links.length) {
        const cands = [];
        for (const L of links) {
          const p = byCode[L.code];
          if (L.type === "SS") {
            if (p.start) cands.push(shiftWorkdays(p.start, L.lag, holidays));
          } else if (p.finish) {
            // 선행 종료일 다음 근무일이 기준점 (선행 종료일 당일에 시작하지 않음)
            cands.push(shiftWorkdays(nextWorkday(addDaysStr(p.finish, 1), holidays), L.lag, holidays));
          }
        }
        if (cands.length) {
          let ns = cands[0]; for (const c of cands) if (c > ns) ns = c;
          if (s.start !== ns) { s.start = ns; changed = true; }
        }
      } else if (s.start && !isWorkday(s.start, holidays)) {
        // 직접 입력한 시작일은 근무일로 스냅
        const ns = nextWorkday(s.start, holidays);
        if (ns !== s.start) { s.start = ns; changed = true; }
      }
      const eff = Number(s.effort) || 0;
      if (s.start && eff > 0) {
        const nf = addWorkdays(s.start, eff, holidays);
        if (s.finish !== nf) { s.finish = nf; changed = true; }
      }
    }
    if (!changed) break;
  }
  return tasks;
}

// 선행 입력 검증 — 표기 오류 / 미존재 WBS / 자기 참조 / 순환 참조를 wbsCode별 메시지로 반환
function scheduleIssues(tasks) {
  const all = []; (tasks || []).forEach(t => (t.subtasks || []).forEach(s => all.push(s)));
  const codes = new Set(all.map(s => s.wbsCode));
  const edges = {}, issues = {};
  for (const s of all) {
    const bad = [], ok = [];
    String(s.pred || "").split(",").map(x => x.trim()).filter(Boolean).forEach(tok => {
      const p = parsePredToken(tok);
      if (!p) bad.push(tok + " (표기 오류)");
      else if (p.code === s.wbsCode) bad.push(tok + " (자기 참조)");
      else if (!codes.has(p.code)) bad.push(tok + " (없는 WBS 코드)");
      else ok.push(p.code);
    });
    edges[s.wbsCode] = ok;
    if (bad.length) issues[s.wbsCode] = bad.join(", ");
  }
  const state = {}, cyc = new Set();
  const dfs = (c, stack) => {
    if (state[c] === 2) return;
    if (state[c] === 1) { const i = stack.indexOf(c); if (i >= 0) stack.slice(i).forEach(x => cyc.add(x)); return; }
    state[c] = 1; stack.push(c);
    (edges[c] || []).forEach(n => dfs(n, stack));
    stack.pop(); state[c] = 2;
  };
  Object.keys(edges).forEach(c => dfs(c, []));
  cyc.forEach(c => { issues[c] = (issues[c] ? issues[c] + ", " : "") + "순환 참조"; });
  return issues;
}

// 공휴일 지정용 월 달력 — 주말 색상 구분, 평일 클릭으로 공휴일 토글
function HolidayCalendar({ holidays, onToggle }) {
  const [ym, setYm] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const startDow = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const mv = (k) => setYm(({ y, m }) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const z = n => String(n).padStart(2, "0");
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, width: 250, flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => mv(-1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>◀</button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{ym.y}년 {ym.m + 1}월</span>
        <button onClick={() => mv(1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>▶</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center" }}>
        {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => (
          <div key={w} style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? T.red : i === 6 ? T.accent : T.muted, padding: "2px 0" }}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={"e" + i} />;
          const ds = `${ym.y}-${z(ym.m + 1)}-${z(d)}`;
          const dow = (startDow + d - 1) % 7;
          const weekend = dow === 0 || dow === 6;
          const isHol = holidays.includes(ds);
          return (
            <div key={ds} onClick={() => { if (!weekend) onToggle(ds); }}
              title={weekend ? "주말 (비근무일)" : isHol ? "공휴일 (클릭 시 해제)" : "클릭하여 공휴일 지정"}
              style={{ fontSize: 11, padding: "4px 0", borderRadius: 5, cursor: weekend ? "default" : "pointer",
                background: isHol ? T.red + "33" : weekend ? T.subtle : "transparent",
                color: isHol ? T.red : dow === 0 ? T.red + "99" : dow === 6 ? T.accent + "99" : T.text,
                border: isHol ? `1px solid ${T.red}66` : "1px solid transparent", fontWeight: isHol ? 700 : 400 }}>
              {d}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9.5, color: T.muted, marginTop: 8, lineHeight: 1.6 }}>
        평일을 클릭하면 <span style={{ color: T.red }}>공휴일</span>로 지정/해제됩니다. 주말(토·일)은 자동으로 비근무일 처리됩니다.
      </div>
    </div>
  );
}

// ── 시스템 구성요소(PBS) 파일 업로드 파서 ──────────────────────────────
// 지원: .txt/.md("L1 > L2 > L3" 줄 또는 들여쓰기 계층), .csv/.tsv, .xlsx(첫 시트, 열 = L1·L2·L3)
// 표 형식은 빈 셀을 위 행 값으로 채움(병합 셀 대응), 머리글 행 자동 제외, 중복 줄 제거.
async function xlsxFirstSheetRows(bytes) {
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const read = p => { const f = files.find(x => x.path === p); return f ? td.decode(f.content) : ""; };
  const unesc = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
  const sst = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const sheets = files.filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f.path))
    .sort((x, y) => Number(x.path.match(/(\d+)\.xml$/)[1]) - Number(y.path.match(/(\d+)\.xml$/)[1]));
  if (!sheets.length) return [];
  const xml = td.decode(sheets[0].content);
  const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref || ""); if (!m) return -1; return [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1; };
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(rm => {
    const row = [];
    let seq = 0;
    [...rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].forEach(cm => {
      const attrs = cm[1], inner = cm[2] || "";
      const r = /\br="([A-Z]+\d+)"/.exec(attrs);
      const ci = r ? colIdx(r[1]) : seq;
      seq = ci + 1;
      let val = "";
      if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); val = v ? (sst[Number(v[1])] || "") : ""; }
      else if (/t="inlineStr"/.test(attrs)) val = unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
      else { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); val = v ? unesc(v[1]) : ""; }
      row[ci] = String(val).trim();
    });
    return Array.from({ length: row.length }, (_, i) => row[i] || "");
  });
}
function pbsLinesFromRows(rows) {
  const HEADER = /^(l\s*[123]|level\s*[123]|레벨\s*[123]|대분류|중분류|소분류|시스템|서브시스템|구성요소|컴포넌트|모듈|기능|구분|no\.?|번호|순번)$/i;
  const out = [];
  let prev = ["", "", ""];
  rows.forEach((raw, ri) => {
    let cells = (raw || []).map(c => String(c ?? "").trim());
    // 순번 열(숫자·"1.1" 등)이 맨 앞이면 제외
    if (cells.length > 1 && /^\d+(\.\d+)*\.?$/.test(cells[0])) cells = cells.slice(1);
    // 이미 "L1 > L2 > L3" 형식인 셀
    const arrow = cells.find(c => c.includes(">"));
    if (arrow) { const p = arrow.split(">").map(x => x.trim()).filter(Boolean).slice(0, 3); if (p.length) { out.push(p.join(" > ")); prev = [p[0] || "", p[1] || "", p[2] || ""]; } return; }
    const c3 = [cells[0] || "", cells[1] || "", cells[2] || ""];
    if (!c3.some(Boolean)) return;
    if (ri === 0 && c3.filter(Boolean).every(c => HEADER.test(c.replace(/[(（\[].*?[)）\]]/g, "").trim()))) return;   // 머리글 행 (괄호 설명 무시)
    // 병합 셀 대응: 왼쪽 빈 칸은 위 행 값으로 채움 (오른쪽에 값이 있을 때만)
    const lastIdx = c3[2] ? 2 : c3[1] ? 1 : 0;
    const filled = c3.map((c, i) => (i < lastIdx && !c) ? prev[i] : c);
    if (!filled[0]) return;
    const parts = filled[1] ? (filled[2] ? filled : filled.slice(0, 2)) : [filled[0]];
    out.push(parts.join(" > "));
    prev = [filled[0], filled[1] || "", filled[2] || ""];
  });
  return out;
}
function pbsLinesFromText(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const nonEmpty = lines.filter(l => l.trim());
  if (!nonEmpty.length) return [];
  // 1) 화살표 형식
  if (nonEmpty.some(l => l.includes(">"))) return pbsLinesFromRows(nonEmpty.map(l => [l]));
  // 2) 표 형식 (탭 또는 쉼표 구분)
  const delim = nonEmpty.some(l => l.includes("\t")) ? "\t" : (nonEmpty.filter(l => l.includes(",")).length >= nonEmpty.length / 2 ? "," : null);
  if (delim) return pbsLinesFromRows(nonEmpty.map(l => l.split(delim).map(c => c.replace(/^"(.*)"$/, "$1"))));
  // 3) 들여쓰기 계층 (공백·탭·"-"·"*" 목록)
  const items = nonEmpty.map(l => {
    const m = /^(\s*)(?:[-*•·]\s+|\d+(?:\.\d+)*\.?\s+)?(.*)$/.exec(l.replace(/\t/g, "  "));
    return { indent: m[1].length, name: m[2].trim() };
  }).filter(x => x.name);
  const levels = [...new Set(items.map(x => x.indent))].sort((x, y) => x - y);
  const out = []; const path = [];
  items.forEach(it => {
    const lv = Math.min(levels.indexOf(it.indent), 2);
    path.length = lv; path[lv] = it.name;
    out.push(path.slice(0, lv + 1).join(" > "));
  });
  // 하위가 있는 상위 줄은 제거 (최하위 요소만 남김)
  return out.filter(l => !out.some(o => o !== l && o.startsWith(l + " > ")));
}
async function parsePbsFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (/\.xls$/.test(name)) throw new Error("구버전 .xls는 지원하지 않습니다. .xlsx 또는 .csv로 저장해 주세요.");
  if (/\.xlsx$/.test(name)) return pbsLinesFromRows(await xlsxFirstSheetRows(new Uint8Array(await file.arrayBuffer())));
  if (/\.(txt|csv|tsv|md)$/.test(name) || (file.type || "").startsWith("text/")) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { text = new TextDecoder("euc-kr").decode(buf); }   // 엑셀에서 저장한 CSV(CP949) 대응
    return pbsLinesFromText(text);
  }
  throw new Error("지원 형식: .xlsx, .csv, .tsv, .txt");
}

function StepWBS({ wbsData, setWbsData, generating, genError, genProgress, onRecommendPBS, pbsNoAi, onTogglePbsNoAi, wbsSetup, setWbsSetup, tailoring, ossp, form, setForm }) {
  // 수행 팀원 — 작업자 콤보박스 원천. 미등록 입력은 MS Project 방식으로 명단에 자동 편입한다.
  const members = form?.members || [];
  const [autoAdded, setAutoAdded] = useState([]);   // 직전 자동 등록 알림 (검토 유도)
  function commitAssignees(text) {
    const unknown = unknownAssignees(text, members);
    if (!unknown.length || !setForm) return;
    setForm(p => ({ ...p, members: [...(p.members || []),
      ...unknown.filter(n => !teamNames(p.members).some(x => memberKey(x) === memberKey(n)))
        .map(n => ({ id: newMemberId(), name: n, role: "", org: "", auto: true })) ] }));
    setAutoAdded(unknown);
  }
  const guide = getGuideForOSSP(ossp);
  const scale = tailoring?.scale || "중형";
  const method = tailoring?.method || "UML";
  const excluded = tailoring?.excluded || {};
  const notes = tailoring?.notes || {};
  const holidays = wbsSetup?.holidays || [];
  const [showCal, setShowCal] = useState(false);
  const [showMgmt, setShowMgmt] = useState(false);   // 관리 프로세스 작업 목록 펼침
  const [pbsDrag, setPbsDrag] = useState(false);     // 구성요소 파일 드래그 오버 표시
  const [pbsFileMsg, setPbsFileMsg] = useState(null); // 파일 업로드 결과 { ok, text }
  const pbsFileRef = useRef(null);
  async function importPbsFile(file) {
    if (!file) return;
    try {
      const lines = [...new Set(await parsePbsFile(file))];
      if (!lines.length) { setPbsFileMsg({ ok: false, text: `${file.name}: 구성요소를 찾지 못했습니다. "L1 > L2 > L3" 줄 또는 L1·L2·L3 열 형식인지 확인하세요.` }); return; }
      const cur = (wbsSetup?.pbsText || "").trim();
      let next = lines.join("\n");
      let mode = "적용";
      if (cur) {
        if (window.confirm(`현재 입력된 구성요소를 파일 내용(${lines.length}개)으로 바꿀까요?\n\n[확인] 바꾸기   [취소] 기존 내용 뒤에 추가`)) mode = "대체";
        else { const have = new Set(cur.split("\n").map(s => s.trim()).filter(Boolean)); next = cur + "\n" + lines.filter(l => !have.has(l)).join("\n"); mode = "추가"; }
      }
      setWbsSetup(s => ({ ...s, pbsText: next.trim(), ...(mode === "대체" ? { selected: {} } : {}) }));
      setPbsFileMsg({ ok: true, text: `${file.name}에서 구성요소 ${lines.length}개를 불러와 ${mode}했습니다.${mode === "대체" ? " 매트릭스 선택은 초기화되었습니다." : ""}` });
    } catch (e) {
      setPbsFileMsg({ ok: false, text: `${file.name}: ${e.message}` });
    }
  }
  const [buildMsg, setBuildMsg] = useState(null);    // WBS 생성 결과 피드백 { ok, text }
  const scheduleRef = useRef(null);                  // 생성 후 ④ 일정 계획으로 스크롤 이동

  // ── 관리 프로세스 작업: PDP(테일러링결과서)에서 '적용'으로 확정된 항목만 그대로 WBS에 반영 ──
  //    (별도 포함/제외 선택 없음 — 적용 여부는 PDP·프로세스 테일러링 탭에서만 결정)
  const mgmtItems = resolveMgmt(tailoring, guide).filter(r => r.applied);
  const mgmtByArea = {};
  mgmtItems.forEach(r => { (mgmtByArea[r.area] = mgmtByArea[r.area] || []).push(r); });
  const firstOutput = (outputs) => {
    const toks = String(outputs||"").split(/,|\s\/\s/).map(x=>x.trim()).filter(Boolean);
    return toks.find(t => t.length >= 2 && t !== "예") || toks[0] || "";   // "예, ..." 같은 예시 접두 토큰 제외
  };

  // ── FBS: PDP(테일러링결과서)에서 적용 확정된 산출물 → 단계별 Activity ──
  const isApplied = (d) => {
    if (d.required) return true;   // 필수(M) 산출물은 항상 적용
    const ov = notes[`${d.phase}:${d.code}`]?.applied;
    return ov !== undefined ? ov : !excluded[d.code];
  };
  const fbs = classifyDeliverables(scale, method, guide, tailoring?.aspiceScope).filter(isApplied);
  const fbsByPhase = {};
  fbs.forEach(d => { (fbsByPhase[d.phase] = fbsByPhase[d.phase] || []).push(d); });
  const phases = guide.phaseOrder.filter(ph => fbsByPhase[ph]?.length);

  // ── PBS: "L1 > L2 > L3" 한 줄 형식 텍스트 → leaf 목록 ──
  const pbsText = wbsSetup?.pbsText || "";
  const leaves = pbsText.split("\n").map(s => s.trim()).filter(Boolean).map(line => {
    const p = line.split(">").map(x => x.trim()).filter(Boolean);
    return { l1: p[0] || "", l2: p[1] || "", l3: p[2] || "" };
  }).filter(l => l.l1);

  const selected = wbsSetup?.selected || {};
  const selKey = (d, li) => `${d.phase}|${d.code}|${li}`;
  const toggleCell = (d, li) => setWbsSetup(s => {
    const sel = { ...(s.selected || {}) };
    const k = `${d.phase}|${d.code}|${li}`;
    sel[k] = !sel[k];
    return { ...s, selected: sel };
  });
  const setRowAll = (d, val) => setWbsSetup(s => {
    const sel = { ...(s.selected || {}) };
    leaves.forEach((_, li) => { sel[`${d.phase}|${d.code}|${li}`] = val; });
    return { ...s, selected: sel };
  });
  const rowAllOn = (d) => leaves.length > 0 && leaves.every((_, li) => selected[selKey(d, li)]);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  // ── 공통: 시스템 구성요소로 분해하지 않고 산출물 1건으로 작성 (구성요소 선택과 상호배타) ──
  const common = wbsSetup?.common || {};
  const comKey = (d) => `${d.phase}|${d.code}`;
  const toggleCommon = (d) => setWbsSetup(s => {
    const com = { ...(s.common || {}) };
    const k = `${d.phase}|${d.code}`;
    com[k] = !com[k];
    const sel = { ...(s.selected || {}) };
    if (com[k]) leaves.forEach((_, li) => { delete sel[`${d.phase}|${d.code}|${li}`]; });
    return { ...s, common: com, selected: sel };
  });
  const commonCount = Object.values(common).filter(Boolean).length;

  // ── ASPICE 매트릭스 기본값: 모든 산출물 '공통'(과제 전체 1건) — 단, SW 컴포넌트·유닛 단위로 작성하는 산출물은 SW 구성요소별 ──
  //   SW3101 SW 요구사항 명세서(SWE.1, 모듈별 분할 명세) · SW4101 SW 상세설계서(SWE.3) · SW4106 SW 유닛 검증 결과서(SWE.4)
  //   '전체' 체크는 HW 블록까지 포함하므로 쓰지 않고 SW 분기(L2 = SW)만 고른다. SW 구성요소가 없으면 이 행들도 공통.
  //   자동 적용은 매트릭스가 비어 있고 WBS를 아직 만들지 않았을 때 1회만 — 이미 고른 값·저장된 프로젝트는 건드리지 않는다.
  const isAspiceWbs = form?.track === "aspice" || guide?.id === "aspice";
  const swLeafIdx = leaves.map((l, i) => (String(l.l2).trim().toUpperCase() === "SW" ? i : -1)).filter(i => i >= 0);
  function aspiceMatrixDefault() {
    const sel = {}, com = {};
    fbs.forEach(d => {
      if (ASPICE_PER_COMPONENT_CODES.includes(d.code) && swLeafIdx.length) swLeafIdx.forEach(li => { sel[selKey(d, li)] = true; });
      else com[comKey(d)] = true;
    });
    return { selected: sel, common: com };
  }
  const matrixEmpty = selectedCount === 0 && commonCount === 0;
  const fbsSig = fbs.map(d => `${d.phase}|${d.code}`).join(",");
  useEffect(() => {
    if (!isAspiceWbs || !matrixEmpty || !leaves.length || !fbs.length) return;
    if (wbsSetup?.defaultsApplied || wbsData?.tasks?.length) return;
    setWbsSetup(s => ({ ...s, ...aspiceMatrixDefault(), defaultsApplied: true }));
  }, [isAspiceWbs, matrixEmpty, leaves.length, fbsSig, !!wbsData?.tasks?.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  function reapplyMatrixDefault() {
    if (!matrixEmpty && !window.confirm("매트릭스 선택을 기본값(공통 + SW 구성요소별 3행)으로 바꿉니다. 지금 선택은 사라집니다. 계속할까요?")) return;
    setWbsSetup(s => ({ ...s, ...aspiceMatrixDefault(), defaultsApplied: true }));
  }

  // ── 공휴일 토글: 설정 저장 + 기존 일정 즉시 재계산 ──
  const toggleHoliday = (ds) => {
    const nh = holidays.includes(ds) ? holidays.filter(x => x !== ds) : [...holidays, ds].sort();
    setWbsSetup(su => ({ ...su, holidays: nh }));
    if (wbsData?.tasks) {
      setWbsData(w => {
        const tasks = w.tasks.map(t => ({ ...t, subtasks: (t.subtasks || []).map(s => ({ ...s })) }));
        recalcSchedule(tasks, nh);
        return { ...w, tasks, holidays: nh };
      });
    }
  };

  // ── 행 편집: 값 반영 후 전진 일정 재계산 (종료일 직접 수정 시 공수 역산) ──
  const updateRow = (tid, sid, patch) => setWbsData(w => {
    const tasks = w.tasks.map(t => ({ ...t, subtasks: (t.subtasks || []).map(s => ({ ...s })) }));
    const t = tasks.find(x => x.id === tid);
    const s = t?.subtasks.find(x => x.id === sid);
    if (!s) return w;
    Object.assign(s, patch);
    if (patch.finish !== undefined && s.start) {
      if (s.finish && s.finish < s.start) s.finish = s.start;
      s.effort = countWorkdays(s.start, s.finish, holidays) || "";
    }
    recalcSchedule(tasks, holidays);
    return { ...w, tasks, holidays };
  });

  // ── WBS 생성 — 엑셀 매크로 'WBS자동생성'의 번호 체계 a.b.c.d.e 이식 ──
  function buildWBS() {
    setBuildMsg(null);
    try {
    // 기존 WBS에 일정·작업자 입력이 있으면 초기화 여부 확인 (재생성 시 입력값 소실 방지)
    const hasInputs = (wbsData?.tasks || []).some(t => (t.subtasks || []).some(s => s.start || s.finish || s.assignee || s.effort));
    if (hasInputs && !window.confirm("WBS를 다시 생성하면 입력한 일정·작업자·공수가 초기화됩니다. 계속할까요?")) return;
    const rows = [];
    let a = 0;
    // 1) 관리 프로세스 작업 (프로세스 테일러링 적용분) — 영역 단위, 시스템 구성요소 분해 없음
    for (const area of Object.keys(mgmtByArea)) {
      a += 1; let b = 0;
      rows.push({ level: 1, wbsCode: `${a}`, name: area, deliverable: "", mgmt: true });
      for (const m of mgmtByArea[area]) {
        b += 1;
        rows.push({ level: 2, wbsCode: `${a}.${b}`,
          name: m.activity ? `${m.process} — ${m.activity}` : m.process,
          deliverable: mapMgmtOutput(firstOutput(m.outputs), guide) });
      }
    }
    // 2) 단계별 산출물 작성 작업 (방법론 테일러링 × 시스템 구성요소 매트릭스)
    for (const ph of phases) {
      const acts = fbsByPhase[ph].filter(d => common[comKey(d)] || leaves.some((_, li) => selected[selKey(d, li)]));
      if (!acts.length) continue;
      a += 1; let b = 0;
      rows.push({ level: 1, wbsCode: `${a}`, name: ph, deliverable: "" });
      for (const d of acts) {
        b += 1;
        if (common[comKey(d)]) {
          // 공통: 시스템 구성요소 분해 없이 산출물 작성 1건으로 종료
          rows.push({ level: 2, wbsCode: `${a}.${b}`, name: `${d.name} 작성`, deliverable: d.name });
          continue;
        }
        rows.push({ level: 2, wbsCode: `${a}.${b}`, name: `${d.name} 작성`, deliverable: "" });
        let c = 0, dd = 0, e = 0;
        const seenL1 = new Set(), seenL2 = new Set();
        leaves.forEach((leaf, li) => {
          if (!selected[selKey(d, li)]) return;
          if (leaf.l1 && !seenL1.has(leaf.l1)) {
            seenL1.add(leaf.l1);
            c += 1; dd = 0; e = 0;
            rows.push({ level: 3, wbsCode: `${a}.${b}.${c}`, name: leaf.l1, deliverable: d.name });
          }
          if (leaf.l2 && (leaf.l2 === "공통" || !seenL2.has(leaf.l2))) {
            if (leaf.l2 !== "공통") seenL2.add(leaf.l2);
            dd += 1; e = 0;
            rows.push({ level: 4, wbsCode: `${a}.${b}.${c}.${dd}`, name: leaf.l2, deliverable: d.name });
          }
          if (leaf.l3 && dd > 0) {
            e += 1;
            rows.push({ level: 5, wbsCode: `${a}.${b}.${c}.${dd}.${e}`, name: leaf.l3, deliverable: d.name });
          }
        });
      }
    }
    if (!rows.length) {
      setBuildMsg({ ok:false, text:"생성할 작업이 없습니다. 매트릭스에서 구성요소를 선택하거나 공통을 체크하세요." });
      return;
    }
    const tasks = [];
    let cur = null;
    rows.forEach((r, idx) => {
      if (r.level === 1) {
        cur = { id: `t${idx}`, wbsCode: r.wbsCode, phase: r.name, duration: "", subtasks: [], ...(r.mgmt ? { mgmt: true } : {}) };
        tasks.push(cur);
      } else if (cur) {
        cur.subtasks.push({ id: `s${idx}`, wbsCode: r.wbsCode, task: r.name, level: r.level, deliverable: r.deliverable,
          assignee: "", pred: "", start: "", finish: "", effort: "", duration: "", status: "대기" });
      }
    });
    // 매트릭스 선택(selected·common)도 함께 보관 — 프로젝트 저장 후 다시 열 때 매트릭스가 비어 보이지 않도록
    setWbsData({ tasks, pbsText, holidays, selected: { ...selected }, common: { ...common } });
    const leafCnt = tasks.reduce((n,t)=>n+(t.subtasks||[]).length, 0);
    setBuildMsg({ ok:true, text:`WBS 생성 완료 — 단계 ${tasks.length}개 · Task ${leafCnt}건. 아래 ④ 일정 계획에서 일정을 입력하세요.` });
    setTimeout(() => scheduleRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    } catch (e) {
      console.error(e);
      setBuildMsg({ ok:false, text:"WBS 생성 중 오류: " + e.message });
    }
  }

  // 단계(요약) 행 롤업: 하위 작업의 시작 최소 ~ 종료 최대 · 공수 합계
  const rollup = (t) => {
    const ss = (t.subtasks || []).map(s => s.start).filter(Boolean).sort();
    const ff = (t.subtasks || []).map(s => s.finish).filter(Boolean).sort();
    const eff = (t.subtasks || []).reduce((n, s) => n + (Number(s.effort) || 0), 0);
    return { start: ss[0] || "", finish: ff.slice(-1)[0] || "", eff };
  };

  const th = { ...cellHead, textAlign: "center", fontSize: 10 };
  const edInput = { width: "100%", boxSizing: "border-box", background: "transparent", border: "none",
    borderBottom: `1px dashed ${T.border}`, color: T.text, fontSize: 10.5, fontFamily: "inherit", outline: "none", padding: "2px 2px" };
  const edDate = { ...edInput, colorScheme: "dark", width: 112 };

  // 선행 입력 검증 (표기 오류 / 없는 WBS / 자기 참조 / 순환 참조)
  const predIssues = wbsData?.tasks?.length ? scheduleIssues(wbsData.tasks) : {};
  const issueCount = Object.keys(predIssues).length;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>WBS 자동 생성 (단계별 산출물 × 시스템 구성요소)</h2>
        <p style={{ fontSize: 11, color: T.muted }}>
          단계별 산출물은 PDP(테일러링결과서)에서, 관리활동 작업은 관리활동 테일러링에서 자동 구성됩니다. 시스템 구성요소를 정의하고, 매트릭스에서 산출물이 적용될 구성요소를 선택한 뒤 WBS를 생성하세요.
        </p>
      </div>
      {genError && <div style={{ color: T.red, fontSize: 12, padding: 10, background: T.red + "11", borderRadius: 9, marginBottom: 10 }}>{genError}</div>}

      {/* 1. PBS 정의 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>① 시스템 구성요소 <span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>(제품 분해 구조, PBS) · {leaves.length}개 요소</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* AI 미사용 모드 — 체크 시 Claude API를 호출하지 않고 유형별 표준 프리셋을 적용 (폐쇄망·재현성) */}
            <label title="체크하면 Claude API를 호출하지 않고 프로젝트 유형별 표준 프리셋을 적용합니다. (폐쇄망 환경·감리 재현성 확보용)"
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: pbsNoAi ? T.amber : T.muted, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={!!pbsNoAi} onChange={e => onTogglePbsNoAi?.(e.target.checked)}
                style={{ accentColor: T.amber, cursor: "pointer", margin: 0 }} />
              AI 미사용
            </label>
            <input ref={pbsFileRef} type="file" accept=".xlsx,.csv,.tsv,.txt" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; importPbsFile(f); }} />
            <Btn variant="outline" onClick={() => pbsFileRef.current?.click()} style={{ fontSize: 11, padding: "4px 10px" }}>
              📂 파일 업로드
            </Btn>
            <Btn variant="outline" onClick={onRecommendPBS} disabled={generating} style={{ fontSize: 11, padding: "4px 10px" }}>
              {pbsNoAi ? "📋 표준 프리셋 적용" : (generating ? "추천 중…" : "⚡ AI 추천")}
            </Btn>
          </div>
        </div>
        {!pbsNoAi && generating && <div style={{ marginBottom: 6 }}><Spinner text="프로젝트 정보 기반 시스템 구성요소 구성 중…" /></div>}
        {pbsNoAi && genProgress?.label && (
          <div style={{ fontSize: 11, color: T.green, background: T.green + "11", border: `1px solid ${T.green}44`, borderRadius: 8, padding: "7px 11px", marginBottom: 6 }}>
            ✓ {genProgress.label}
          </div>
        )}
        {pbsFileMsg && (
          <div style={{ fontSize: 11, color: pbsFileMsg.ok ? T.green : T.red, background: (pbsFileMsg.ok ? T.green : T.red) + "11", border: `1px solid ${(pbsFileMsg.ok ? T.green : T.red)}44`, borderRadius: 8, padding: "7px 11px", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{pbsFileMsg.ok ? "✓ " : "⚠ "}{pbsFileMsg.text}</span>
            <span onClick={() => setPbsFileMsg(null)} style={{ cursor: "pointer", color: T.muted }}>✕</span>
          </div>
        )}
        <div style={{ position: "relative" }}
          onDragOver={e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); if (!pbsDrag) setPbsDrag(true); } }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPbsDrag(false); }}
          onDrop={e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); setPbsDrag(false); importPbsFile(e.dataTransfer.files[0]); }}>
        {pbsDrag && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, borderRadius: 10, border: `2px dashed ${T.accent}`, background: T.bg + "E6", display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, fontSize: 13, fontWeight: 600, pointerEvents: "none" }}>
            📂 여기에 놓으면 구성요소를 불러옵니다 (.xlsx · .csv · .txt)
          </div>
        )}
        <textarea value={pbsText}
          onChange={e => setWbsSetup(s => ({ ...s, pbsText: e.target.value }))}
          placeholder={"한 줄에 하나씩 \"L1 > L2 > L3\" 형식으로 입력하세요.\n예)\n포털시스템 > 사용자관리 > 로그인\n포털시스템 > 사용자관리 > 권한관리\n포털시스템 > 게시판\n인터페이스 > 공통"}
          rows={6}
          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.7 }} />
        </div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>※ L3을 사용하려면 L2가 있어야 합니다. 여러 요소에 공통 적용되는 부분은 L2에 "공통"을 사용하세요 (WBS에서 중복 허용).</div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>※ 파일 업로드·끌어다 놓기: .xlsx(첫 시트, A~C열 = L1·L2·L3) · .csv · .tsv · .txt("L1 &gt; L2 &gt; L3" 줄 또는 들여쓰기 목록). 병합 셀처럼 비어 있는 상위 칸은 위 행 값으로 채웁니다.</div>
        <div style={{ fontSize: 10, color: pbsNoAi ? T.amber : T.muted, marginTop: 3 }}>
          {pbsNoAi
            ? "※ AI 미사용 모드: Claude API를 호출하지 않고 프로젝트 유형별 표준 프리셋을 적용합니다. 동일 입력에 항상 동일한 결과가 나오며, 폐쇄망에서도 동작합니다. 적용 후 내용을 편집해 사용하세요."
            : "※ AI 추천은 프로젝트 정보를 Claude API로 전송합니다. 외부 전송이 제한된 환경이거나 결과 재현성이 필요하면 \u0027AI 미사용\u0027을 체크하세요."}
        </div>
      </div>

      {/* 2. 단계별 산출물 × 시스템 구성요소 매트릭스 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>② 단계별 산출물 × 시스템 구성요소 매트릭스 <span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>· 선택 {selectedCount}칸{commonCount > 0 ? ` · 공통 ${commonCount}건` : ""}</span></div>
          <div style={{ display: "flex", gap: 6 }}>
            {isAspiceWbs && leaves.length > 0 && <Btn variant="outline" onClick={reapplyMatrixDefault} style={{ fontSize: 11, padding: "6px 10px" }}>기본값 다시 적용</Btn>}
            <Btn onClick={buildWBS} disabled={selectedCount === 0 && commonCount === 0 && mgmtItems.length === 0} style={{ fontSize: 12, padding: "6px 12px" }}>⚙ WBS 생성</Btn>
          </div>
        </div>
        {isAspiceWbs && leaves.length > 0 && (
          <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8, lineHeight: 1.6 }}>
            기본값: 모든 산출물은 <b style={{ color: T.text }}>공통</b>(과제 전체 1건)으로 작성합니다. 단, SW 컴포넌트·유닛 단위로 작성하는
            <b style={{ color: T.text }}> SW 요구사항 명세서(SWE.1)·SW 상세설계서(SWE.3)·SW 유닛 검증 결과서(SWE.4)</b>는
            {swLeafIdx.length ? <> SW 구성요소({swLeafIdx.length}개)별로 선택됩니다.</> : <> SW 구성요소가 없어 공통으로 두었습니다.</>}
            {" "}필요에 따라 칸을 바꾸면 되고, 「기본값 다시 적용」으로 언제든 이 구성으로 되돌릴 수 있습니다.
          </div>
        )}
        {buildMsg && (
          <div style={{ fontSize: 11, padding: "8px 12px", borderRadius: 8, marginBottom: 8,
            color: buildMsg.ok ? T.green : T.red, background: (buildMsg.ok ? T.green : T.red) + "11",
            border: `1px solid ${(buildMsg.ok ? T.green : T.red)}44` }}>
            {buildMsg.ok ? "✓ " : "⚠ "}{buildMsg.text}
          </div>
        )}
        {leaves.length === 0 ? (
          <div style={{ fontSize: 11, color: T.muted, padding: "14px 12px", background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
            시스템 구성요소를 먼저 입력하면 매트릭스가 표시됩니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 10.5, minWidth: "100%" }}>
              <thead>
                <tr>
                  <td style={{ ...th, textAlign: "left" }} rowSpan={3}>단계</td>
                  <td style={{ ...th, textAlign: "left", minWidth: 150 }} rowSpan={3}>단계별 산출물</td>
                  <td style={th} rowSpan={3}>전체</td>
                  <td style={th} rowSpan={3}>공통</td>
                  {leaves.map((l, li) => <td key={"h1" + li} style={{ ...th, background: "#16233a" }}>{l.l1}</td>)}
                </tr>
                <tr>{leaves.map((l, li) => <td key={"h2" + li} style={th}>{l.l2 || "—"}</td>)}</tr>
                <tr>{leaves.map((l, li) => <td key={"h3" + li} style={th}>{l.l3 || "—"}</td>)}</tr>
              </thead>
              <tbody>
                {phases.map(ph => (
                  fbsByPhase[ph].map((d, i) => (
                    <tr key={`${ph}-${d.code}`}>
                      {i === 0 && <td style={{ ...cell, fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }} rowSpan={fbsByPhase[ph].length}>{ph}</td>}
                      <td style={{ ...cell, whiteSpace: "nowrap" }}><span style={{ color: T.muted, fontFamily: "monospace", fontSize: 9.5, marginRight: 5 }}>{d.code}</span>{d.name}</td>
                      <td style={{ ...cell, textAlign: "center" }}>
                        <input type="checkbox" checked={rowAllOn(d)} disabled={!!common[comKey(d)]} onChange={e => setRowAll(d, e.target.checked)} style={{ width: 12, height: 12, cursor: common[comKey(d)] ? "not-allowed" : "pointer", opacity: common[comKey(d)] ? 0.35 : 1 }} />
                      </td>
                      <td style={{ ...cell, textAlign: "center", background: common[comKey(d)] ? T.accentDim : "transparent" }}>
                        <input type="checkbox" checked={!!common[comKey(d)]} onChange={() => toggleCommon(d)} style={{ width: 12, height: 12, cursor: "pointer" }} />
                      </td>
                      {leaves.map((_, li) => {
                        const isCom = !!common[comKey(d)];
                        const on = !!selected[selKey(d, li)];
                        return (
                          <td key={li} onClick={() => { if (!isCom) toggleCell(d, li); }}
                            style={{ ...cell, textAlign: "center", cursor: isCom ? "not-allowed" : "pointer", background: on ? T.accentDim : "transparent", color: on ? "#bfd4ff" : T.muted, userSelect: "none", opacity: isCom ? 0.4 : 1 }}>
                            {on ? "●" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. 관리 프로세스 작업 — PDP에서 적용 확정된 항목만 그대로 표시 (읽기 전용) */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>③ 관리활동 작업 <span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>· {guide.mgmtActivities ? "ASPICE 적용 범위 기준" : "PDP 적용 확정"} {mgmtItems.length}건 — WBS 앞부분에 자동 추가</span></div>
          <Btn variant="outline" onClick={() => setShowMgmt(v => !v)} style={{ fontSize: 11, padding: "4px 10px" }}>
            {showMgmt ? "접기 ▲" : "목록 보기 ▼"}
          </Btn>
        </div>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: showMgmt ? 6 : 0 }}>
          {guide.mgmtActivities
            ? "※ ASPICE 과제는 적용 프로세스 범위(MAN.3·SUP·ACQ.4·MAN.5)와 목표 능력수준에 따라 관리활동이 정해집니다. 바꾸려면 적용 범위(CL3는 테일러링) 단계에서 수정하세요."
            : "※ PDP(테일러링결과서)의 관리활동 테일러링 내역서에서 '적용'으로 확정된 관리활동만 반영됩니다. 적용 여부를 바꾸려면 테일러링 단계 또는 PDP 화면에서 수정하세요."}
        </div>
        {showMgmt && (
          <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", background: T.bg, display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.keys(mgmtByArea).map(area => (
              <div key={area}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 4 }}>
                  {area} <span style={{ color: T.muted, fontWeight: 400 }}>({mgmtByArea[area].length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {mgmtByArea[area].map(r => (
                    <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.text }}>
                      <span style={{ color: T.green, flexShrink: 0 }}>✓</span>
                      <span>
                        {r.process}{r.activity && <span style={{ color: T.muted }}> › {r.activity}</span>}
                        {r.changed && <Badge color={T.amber}>변경적용</Badge>}
                      </span>
                      {firstOutput(r.outputs) && <span style={{ color: T.muted, fontSize: 9.5 }}>→ {mapMgmtOutput(firstOutput(r.outputs), guide)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 일정 계획 (생성 결과 편집) */}
      {wbsData?.tasks?.length > 0 && (
        <div ref={scheduleRef} style={{ animation: "fadeIn .4s", scrollMarginTop: 70 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>④ 일정 계획</div>
              <Badge color={T.green}>✓ {wbsData.tasks.reduce((n, t) => n + 1 + (t.subtasks?.length || 0), 0)}개 항목</Badge>
              <Badge color={T.accent}>단계 {wbsData.tasks.length} · 최하위 Task {wbsData.tasks.reduce((n, t) => n + (t.subtasks?.length || 0), 0)}건 · 산출물 {wbsData.tasks.reduce((n, t) => n + (t.subtasks || []).filter(s => String(s.deliverable || "").trim()).length, 0)}건</Badge>
              {holidays.length > 0 && <Badge color={T.red}>공휴일 {holidays.length}일</Badge>}
              {issueCount > 0 && <Badge color={T.red}>⚠ 선행 오류 {issueCount}건</Badge>}
            </div>
            <Btn variant="outline" onClick={() => setShowCal(v => !v)} style={{ fontSize: 11, padding: "4px 10px" }}>
              📅 {showCal ? "달력 닫기" : "달력 · 공휴일 설정"}
            </Btn>
          </div>

          {showCal && (
            <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <HolidayCalendar holidays={holidays} onToggle={toggleHoliday} />
              <div style={{ flex: 1, minWidth: 220, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>일정 계산 규칙 (근무일 기준)</div>
                <div>· 시작일 + 투입공수(근무일) → 종료일 자동 계산 (시작일 포함, 주말·공휴일 제외)</div>
                <div>· 종료일을 직접 수정하면 투입공수를 역산</div>
                <div>· 선행(FS): 선행 작업 <b style={{ color: T.text }}>종료일의 다음 근무일</b>이 시작일 — MS Project 동일 규칙</div>
                <div>· 선행 여러 개는 쉼표 구분 → 가장 늦은 시작일 채택</div>
                <div>· 지연·중첩: <b style={{ color: T.accent }}>1.1+2</b> = 2근무일 지연, <b style={{ color: T.accent }}>1.1-1</b> = 1근무일 중첩</div>
                <div>· 동시 착수: <b style={{ color: T.accent }}>1.1SS</b> (시작-시작), 지연 결합 <b style={{ color: T.accent }}>1.1SS+3</b></div>
                <div>· 공휴일 변경 시 전체 일정 즉시 재계산</div>
                {holidays.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontWeight: 700, color: T.text }}>지정된 공휴일:</span>{" "}
                    {holidays.map(h => (
                      <span key={h} onClick={() => toggleHoliday(h)} title="클릭하여 해제"
                        style={{ display: "inline-block", margin: "2px 4px 2px 0", padding: "1px 7px", borderRadius: 5, background: T.red + "22", color: T.red, cursor: "pointer", fontSize: 10.5 }}>
                        {h} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 10.5, minWidth: "100%" }}>
              <thead>
                <tr>
                  <td style={{ ...th, textAlign: "left" }}>WBS</td>
                  <td style={{ ...th, textAlign: "left", minWidth: 170 }}>Task</td>
                  <td style={{ ...th, minWidth: 100 }}>산출물</td>
                  <td style={{ ...th, minWidth: 70 }}>작업자</td>
                  <td style={{ ...th, minWidth: 92 }}>선행<br/><span style={{ fontWeight: 400, fontSize: 8.5 }}>(WBS[FS|SS][±지연])</span></td>
                  <td style={th}>시작일</td>
                  <td style={th}>종료일</td>
                  <td style={{ ...th, width: 60 }}>공수(일)</td>
                </tr>
              </thead>
              <tbody>
                {wbsData.tasks.map(t => {
                  const r = rollup(t);
                  return (
                    <React.Fragment key={t.id}>
                      <tr style={{ background: T.subtle }}>
                        <td style={{ ...cell, fontFamily: "monospace", fontWeight: 700, color: T.accent }}>{t.wbsCode}</td>
                        <td style={{ ...cell, fontWeight: 700 }}>{t.phase}</td>
                        <td style={cell} colSpan={3}><span style={{ fontSize: 9.5, color: T.muted }}>요약 (하위 롤업)</span></td>
                        <td style={{ ...cell, textAlign: "center", color: T.muted }}>{r.start || "—"}</td>
                        <td style={{ ...cell, textAlign: "center", color: T.muted }}>{r.finish || "—"}</td>
                        <td style={{ ...cell, textAlign: "center", color: T.muted, fontWeight: 700 }}>{r.eff || "—"}</td>
                      </tr>
                      {t.subtasks?.map(s => (
                        <tr key={s.id}>
                          <td style={{ ...cell, fontFamily: "monospace", fontSize: 9.5, color: T.muted, whiteSpace: "nowrap" }}>{s.wbsCode}</td>
                          <td style={{ ...cell, paddingLeft: 8 + ((s.level || 2) - 2) * 14 }}>
                            <input value={s.task || ""} onChange={e => updateRow(t.id, s.id, { task: e.target.value })} style={edInput} />
                          </td>
                          <td style={cell}>
                            <input value={s.deliverable || ""} onChange={e => updateRow(t.id, s.id, { deliverable: e.target.value })} style={edInput} />
                          </td>
                          <td style={cell}>
                            <AssigneeCell value={s.assignee || ""} members={members} inputStyle={edInput}
                              onChange={v => updateRow(t.id, s.id, { assignee: v })}
                              onCommit={() => commitAssignees(s.assignee || "")} />
                          </td>
                          <td style={cell}>
                            <input value={s.pred || ""} onChange={e => updateRow(t.id, s.id, { pred: e.target.value })}
                              placeholder="예: 1.1.1, 1.2+2"
                              title={predIssues[s.wbsCode] || "선행 WBS 코드 · 쉼표로 복수 · FS/SS · ±지연(근무일)"}
                              style={predIssues[s.wbsCode]
                                ? { ...edInput, borderBottom: `1px solid ${T.red}`, color: T.red }
                                : edInput} />
                          </td>
                          <td style={{ ...cell, whiteSpace: "nowrap" }}>
                            <input type="date" value={s.start || ""} onChange={e => updateRow(t.id, s.id, { start: e.target.value })}
                              disabled={!!s.pred && !predIssues[s.wbsCode]}
                              title={s.pred ? (predIssues[s.wbsCode] ? "선행 입력에 오류가 있어 자동 계산되지 않습니다 — 직접 수정하거나 선행을 고치세요" : "선행 작업에 의해 자동 계산됩니다") : ""}
                              style={{ ...edDate, opacity: (s.pred && !predIssues[s.wbsCode]) ? 0.55 : 1 }} />
                          </td>
                          <td style={{ ...cell, whiteSpace: "nowrap" }}>
                            <input type="date" value={s.finish || ""} onChange={e => updateRow(t.id, s.id, { finish: e.target.value })} style={edDate} />
                          </td>
                          <td style={cell}>
                            <input type="number" min="0" value={s.effort || ""} onChange={e => updateRow(t.id, s.id, { effort: e.target.value })}
                              style={{ ...edInput, textAlign: "center", width: 50 }} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {issueCount > 0 && (
            <div style={{ fontSize: 10.5, color: T.red, marginTop: 6, lineHeight: 1.7 }}>
              ⚠ 선행 입력 오류 {issueCount}건 — 해당 행은 일정 자동 계산에서 제외됩니다. ({Object.entries(predIssues).slice(0, 5).map(([c, m]) => `${c} → ${m}`).join(" / ")}{issueCount > 5 ? ` 외 ${issueCount - 5}건` : ""})
            </div>
          )}
          {autoAdded.length > 0 && (
            <div style={{ fontSize: 10.5, color: T.amber, background: T.amber + "11", border: `1px solid ${T.amber}44`,
              borderRadius: 8, padding: "7px 11px", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span>⚠ 미등록 인원 {autoAdded.length}명({autoAdded.join(", ")})을 팀원 명단에 자동 등록했습니다. STEP 1에서 이름·역할을 확인하세요.</span>
              <button onClick={() => setAutoAdded([])} title="알림 닫기"
                style={{ background: "none", border: "none", color: T.amber, cursor: "pointer", fontSize: 13, padding: 0, flexShrink: 0 }}>×</button>
            </div>
          )}
          <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>
            ※ 매트릭스를 수정한 뒤 "WBS 생성"을 다시 누르면 구조가 재생성됩니다 (입력한 일정은 초기화). 일정·작업자·사유는 프로젝트 저장 시 함께 보존됩니다.
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>
            ※ 작업자는 <b style={{ color: T.text }}>쉼표(,)</b>로 여러 명을 지정할 수 있습니다 (예: 장성문, 홍길동). 오른쪽 화살표로 등록된 팀원을 선택하거나 직접 입력하세요
            {teamNames(members).length === 0 && " — 팀원을 등록하려면 STEP 1(기본정보)로 이동하세요"}.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 산출물 ZIP 일괄 다운로드 — 외부 라이브러리 없이 각 산출물을 실제 MS Office
// 파일(docx/xlsx/pptx = OOXML)로 생성해 단계별 폴더 구조의 ZIP으로 묶는다.
// 형식 자동 배정: 매트릭스·대장·목록·백로그·체크리스트 등 표 성격 → xlsx,
// 오리엔테이션·교육·데모 자료 → pptx, 그 외 계획서·정의서·보고서 → docx.
// OSSP 라이브러리 '산출물템플릿'에 이름이 일치하는 실파일이 있으면 그 파일을 사용,
// 없으면 스켈레톤 문서를 생성한다 (WBS·테일러링결과서는 동적 실데이터 문서가 우선).
// ═══════════════════════════════════════════════════════════════════
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// files: [{ path, content: string | Uint8Array }] → ZIP 바이트 (무압축 STORED, UTF-8 파일명)
function zipBytes(files) {
  const enc = new TextEncoder();
  const u16 = v => [v & 255, (v >>> 8) & 255];
  const u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  const chunks = []; const central = []; let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.path);
    const dataB = f.content instanceof Uint8Array ? f.content : enc.encode(f.content);
    const crc = crc32(dataB);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(dataB.length), ...u32(dataB.length), ...u16(nameB.length), ...u16(0)]);
    chunks.push(local, nameB, dataB);
    central.push({ nameB, crc, size: dataB.length, offset });
    offset += local.length + nameB.length + dataB.length;
  }
  const cdStart = offset; let cdSize = 0;
  for (const e of central) {
    const hdr = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(e.crc), ...u32(e.size), ...u32(e.size), ...u16(e.nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset)]);
    chunks.push(hdr, e.nameB); cdSize += hdr.length + e.nameB.length;
  }
  chunks.push(new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(cdStart), ...u16(0)]));
  let total = 0; chunks.forEach(c => { total += c.length; });
  const out = new Uint8Array(total); let pos = 0;
  chunks.forEach(c => { out.set(c, pos); pos += c.length; });
  return out;
}

const xesc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ── DOCX ─────────────────────────────────────────────────────
function docxP(text, { bold = false, italic = false, size = 22, spacingAfter = 120, align = "" } = {}) {
  return `<w:p><w:pPr><w:spacing w:after="${spacingAfter}"/>${align ? `<w:jc w:val="${align}"/>` : ""}</w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xesc(text)}</w:t></w:r></w:p>`;
}
function docxTable(rows, headerCols = 0) {
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:color="999999"/></w:tblBorders>';
  // 셀 내부 여백: 왼쪽 3mm(170twip), 오른쪽 2mm(113twip), 상하 0.7mm(40twip) — 글자가 테두리에 붙지 않게
  const cellMar = '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="170" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="113" w:type="dxa"/></w:tblCellMar>';
  const trs = rows.map((cells, ri) => "<w:tr>" + cells.map((c, ci) => {
    const head = ri === 0 && headerCols === -1 ? true : ci < headerCols;
    return `<w:tc><w:tcPr>${head ? '<w:shd w:val="clear" w:fill="EFEFEF"/><w:vAlign w:val="center"/>' : ""}</w:tcPr><w:p>${head ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ""}<w:r><w:rPr>${head ? "<w:b/>" : ""}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${xesc(c)}</w:t></w:r></w:p></w:tc>`;
  }).join("") + "</w:tr>").join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}${cellMar}</w:tblPr>${trs}</w:tbl><w:p/>`;
}

// dataURL(PNG/JPEG) → { ext, bytes } — 로고 임베드용
function dataUrlToBytes(dataUrl) {
  const m = /^data:(image\/(png|jpe?g));base64,(.*)$/i.exec(String(dataUrl || ""));
  if (!m) return null;
  const bin = atob(m[3]);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return { ext: m[2].toLowerCase() === "png" ? "png" : "jpeg", bytes: b };
}
// 인라인 이미지 run (cx/cy: EMU, 1cm = 360000)
function docxImageRun(relId, cx, cy, id) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Logo${id}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Logo${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
// 서명 줄: 상단 가로선 + "작성자:      일자:" (첨부 양식의 서명란)
function docxSignLine(label, name = "") {
  // name: 설정(문서 기본값)의 작성/검토/승인자 — 지정 시 라벨 옆에 미리 채워 넣는다
  const nm = String(name || "").trim();
  return `<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr><w:tabs><w:tab w:val="left" w:pos="4800"/></w:tabs><w:spacing w:before="240" w:after="300"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${xesc(label)}: </w:t></w:r>${nm ? `<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${xesc(nm)}</w:t></w:r>` : ""}<w:r><w:tab/></w:r><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">일자: </w:t></w:r></w:p>`;
}
// 2페이지 상단 문서 정보 표: 좌측 로고(세로 병합) + 제목(가로 병합) + 프로젝트/단계/시스템/문서번호/작성자/작성일자
function docxInfoHeaderTable({ logoXml, title, rows }) {
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="666666"/><w:insideV w:val="single" w:sz="4" w:color="666666"/></w:tblBorders>';
  const cellMar = '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>';
  const grid = [1700, 1300, 2200, 1300, 2526].map(w => `<w:gridCol w:w="${w}"/>`).join("");
  const tc = (xml, { span, vmerge, shade, center, w } = {}) =>
    `<w:tc><w:tcPr>${w ? `<w:tcW w:w="${w}" w:type="dxa"/>` : ""}${span ? `<w:gridSpan w:val="${span}"/>` : ""}${vmerge ? `<w:vMerge${vmerge === "restart" ? ' w:val="restart"' : ""}/>` : ""}${shade ? '<w:shd w:val="clear" w:fill="EFEFEF"/>' : ""}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="${center ? "center" : "left"}"/></w:pPr>${xml}</w:p></w:tc>`;
  const txt = (t, { bold, size = 20 } = {}) => `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`;
  const r1 = `<w:tr><w:trPr><w:trHeight w:val="560"/></w:trPr>${tc(logoXml, { vmerge: "restart", center: true, w: 1700 })}${tc(txt(title, { bold: true, size: 32 }), { span: 4, center: true })}</w:tr>`;
  const rs = rows.map(cs => `<w:tr>${tc("", { vmerge: true, w: 1700 })}${tc(txt(cs[0], { bold: true }), { shade: true, center: true, w: 1300 })}${tc(txt(cs[1]), { w: 2200 })}${tc(txt(cs[2], { bold: true }), { shade: true, center: true, w: 1300 })}${tc(txt(cs[3]), { w: 2526 })}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}${cellMar}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${r1}${rs}</w:tbl><w:p/>`;
}
// 로고 소스 통일: 위저드는 form.clientLogo/companyLogo, 저장된 프로젝트는 tailoring.logos
function getDocLogos(meta) {
  const l = meta?.tailoring?.logos || {};
  // 프로젝트 지정 로고 → 저장된 프로젝트의 tailoring.logos → 설정의 조직 기본 로고 순
  return {
    client: meta?.clientLogo || l.client || DOC_SETTINGS.clientLogo || null,
    company: meta?.companyLogo || l.company || DOC_SETTINGS.companyLogo || null,
  };
}
// ── OSSP 템플릿 실파일(docx)에 프로젝트 로고 주입 ─────────────────────────
// 다운로드한 템플릿 ZIP을 브라우저 내장 inflate(DecompressionStream)로 해체하고,
// (1) 본문·머리말·꼬리말의 '고객사로고'/'우리회사로고' 플레이스홀더 텍스트 → 로고 이미지 치환
// (2) 본문·머리말의 첫 번째 표에서 세로 병합(vMerge restart)된 짧은 텍스트 셀(예: 조직 약칭) → 고객사 로고 치환
// (3) 표지(첫 페이지 나누기·구역 나누기 직전)에 우측 정렬 로고 문단 삽입
// (4) 기본(default·even) 꼬리말을 표준 로고 꼬리말(고객사로고·쪽번호·우리회사로고)로 교체 — 표지용(first) 꼬리말은 유지,
//     꼬리말이 아예 없는 템플릿에는 새로 만들어 연결
// 후 무압축 ZIP으로 재조립한다. 어떤 단계든 실패하면 null을 반환해 원본을 그대로 쓴다.
async function unzipBytes(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // EOCD(0x06054b50) 탐색 — 뒤에서부터 (ZIP 코멘트 최대 65535B 고려)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD not found");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const td = new TextDecoder();
  const out = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("bad central directory");
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = td.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    if (!name.endsWith("/")) {
      let data;
      if (method === 0) data = comp.slice();
      else if (method === 8) {
        const ds = new DecompressionStream("deflate-raw");
        data = new Uint8Array(await new Response(new Response(comp.slice()).body.pipeThrough(ds)).arrayBuffer());
      } else throw new Error("unsupported compression method " + method);
      out.push({ path: name, content: data });
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
// 네임스페이스를 자체 선언한 인라인 이미지 run — 임의 템플릿 XML에도 안전하게 삽입 가능
function docxImageRunNS(relId, cx, cy, id) {
  const NSD = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return `<w:r><w:drawing ${NSD}><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="PgLogo${id}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="PgLogo${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
async function injectLogosIntoTemplateDocx(bytes, meta) {
  const logos = getDocLogos(meta);
  const cl = logos.client?.dataUrl ? dataUrlToBytes(logos.client.dataUrl) : null;
  const co = logos.company?.dataUrl ? dataUrlToBytes(logos.company.dataUrl) : null;
  if (!cl && !co) return null;   // 프로젝트에 등록된 로고 없음 → 원본 유지
  const ratioOf = l => (Number(l?.w) > 0 && Number(l?.h) > 0) ? Math.min(Number(l.w) / Number(l.h), 8) : 3;
  const info = {
    C: cl && { relId: "rIdPgLogoC", fileName: `pg_logo_client.${cl.ext}`, bytes: cl.bytes, ratio: ratioOf(logos.client) },
    W: co && { relId: "rIdPgLogoW", fileName: `pg_logo_company.${co.ext}`, bytes: co.bytes, ratio: ratioOf(logos.company) },
  };
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  if (!byPath["word/document.xml"]) return null;   // docx 아님
  let imgId = 9000;
  const mkRun = (k, hEmu) => info[k] ? docxImageRunNS(info[k].relId, Math.max(1, Math.round(hEmu * info[k].ratio)), hEmu, ++imgId) : null;
  const usedByPart = {};   // part path → Set("C"/"W")
  const markUsed = (part, k) => { (usedByPart[part] = usedByPart[part] || new Set()).add(k); };

  // (2) 첫 번째 표의 로고 셀 치환: 첫 <w:tc>가 vMerge restart + 짧은 텍스트(≤12자) + 이미지 없음일 때만
  const injectFirstTableCell = (xml, part) => {
    const run = mkRun("C", 324000) || mkRun("W", 324000);
    const kind = info.C ? "C" : "W";
    if (!run) return xml;
    const ti = xml.indexOf("<w:tbl");
    if (ti < 0) return xml;
    const tcI2 = Math.min(...[xml.indexOf("<w:tc ", ti), xml.indexOf("<w:tc>", ti)].filter(i => i >= 0));
    if (!isFinite(tcI2)) return xml;
    const tcEnd = xml.indexOf("</w:tc>", tcI2);
    if (tcEnd < 0) return xml;
    const cell = xml.slice(tcI2, tcEnd);
    if (!/<w:vMerge\s+w:val="restart"/.test(cell)) return xml;
    if (cell.includes("<w:drawing")) return xml;
    const text = (cell.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, "")).join("").trim();
    if (text.length > 12) return xml;
    const pI = cell.search(/<w:p[\s>/]/);
    if (pI < 0) return xml;
    const newCell = cell.slice(0, pI) + `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run}</w:p>`;
    markUsed(part, kind);
    return xml.slice(0, tcI2) + newCell + xml.slice(tcEnd);
  };

  // (1) 플레이스홀더 텍스트 run 치환: '고객사로고'/'우리회사로고' ({} 감싼 형태 포함)
  const replacePlaceholders = (xml, part, hEmu) => {
    const runRe = /<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>).)*?<w:t[^>]*>\s*\{?(고객사로고|우리회사로고)\}?\s*<\/w:t>(?:(?!<\/w:r>).)*?<\/w:r>/gs;
    return xml.replace(runRe, (m, name) => {
      const k = name === "고객사로고" ? "C" : "W";
      const run = mkRun(k, hEmu);
      if (!run) return m;
      markUsed(part, k);
      return run;
    });
  };

  // 원본 document.xml 기준 꼬리말 참조(type별) 수집 — 교체 대상 판별용
  const docXml0 = td.decode(byPath["word/document.xml"].content);
  const relsXml0 = byPath["word/_rels/document.xml.rels"] ? td.decode(byPath["word/_rels/document.xml.rels"].content) : "";
  const relTargetOf = {};   // rId → word/ 기준 상대경로
  (relsXml0.match(/<Relationship\s[^>]*\/>/g) || []).forEach(r => {
    const id = /\bId="([^"]+)"/.exec(r); const tg = /\bTarget="([^"]+)"/.exec(r);
    if (id && tg) relTargetOf[id[1]] = "word/" + tg[1].replace(/^\/?(word\/)?/, "");
  });
  const ftrRefs = (docXml0.match(/<w:footerReference[^>]*\/>/g) || []).map(s => ({
    type: (/w:type="([^"]+)"/.exec(s) || [])[1] || "default",
    rid: (/r:id="([^"]+)"/.exec(s) || [])[1] || "",
  }));

  const partRe = /^word\/(document|header\d*|footer\d*)\.xml$/;
  for (const f of files) {
    if (!partRe.test(f.path)) continue;
    let xml = td.decode(f.content);
    const isFtr = /footer/.test(f.path);
    xml = replacePlaceholders(xml, f.path, isFtr ? 216000 : 324000);
    if (!isFtr) xml = injectFirstTableCell(xml, f.path);
    f.content = xml;   // 문자열이면 zipBytes가 UTF-8 인코딩
  }

  // (3) 표지 로고: 첫 페이지 나누기(없으면 문단 내 구역 나누기) 직전에 우측 정렬 로고 문단 삽입
  {
    const df = byPath["word/document.xml"];
    let xml = typeof df.content === "string" ? df.content : td.decode(df.content);
    let anchor = -1;
    const br = xml.indexOf('<w:br w:type="page"');
    if (br >= 0) anchor = Math.max(xml.lastIndexOf("<w:p ", br), xml.lastIndexOf("<w:p>", br));
    if (anchor < 0) {
      const sp = xml.indexOf("<w:sectPr");
      if (sp >= 0) {
        const pStart = Math.max(xml.lastIndexOf("<w:p ", sp), xml.lastIndexOf("<w:p>", sp));
        if (pStart >= 0 && xml.indexOf("</w:p>", pStart) > sp) anchor = pStart;   // 문단 내 구역 나누기만 (본문 말미 sectPr 제외)
      }
    }
    // 표지 영역에 이미 로고를 넣었다면(플레이스홀더·셀 치환) 중복 삽입하지 않음
    if (anchor >= 0 && !xml.slice(0, anchor).includes('name="PgLogo')) {
      const runs = [];
      if (info.C) { const r = mkRun("C", 324000); if (r) { runs.push(r); markUsed(df.path, "C"); } }
      if (info.W) { const r = mkRun("W", 324000); if (r) { runs.push(r); markUsed(df.path, "W"); } }
      if (runs.length) {
        const ps = runs.map(r => `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="140"/></w:pPr>${r}</w:p>`).join("");
        xml = xml.slice(0, anchor) + ps + xml.slice(anchor);
      }
    }
    df.content = xml;
  }

  // (4) 꼬리말: 표준 로고 꼬리말(고객사로고 · 쪽번호 · 우리회사로고)로 교체 — first(표지) 꼬리말 제외
  const stdFtrInner = part => {
    const tabDefs = '<w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs>';
    const pageFld = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const l = mkRun("C", 216000); const r = mkRun("W", 216000);
    if (l) markUsed(part, "C");
    if (r) markUsed(part, "W");
    return `<w:p><w:pPr>${tabDefs}<w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr><w:spacing w:before="0" w:after="0"/></w:pPr>${l || ""}<w:r><w:tab/></w:r>${pageFld}<w:r><w:tab/></w:r>${r || ""}</w:p>`;
  };
  let ftrTargets = ftrRefs.filter(f => f.type !== "first").map(f => relTargetOf[f.rid]).filter(p => p && byPath[p]);
  if (!ftrRefs.length) ftrTargets = files.filter(f => /^word\/footer\d*\.xml$/.test(f.path)).map(f => f.path);   // 참조 파싱 실패 시 전체 폴백
  ftrTargets = [...new Set(ftrTargets)];
  if (ftrTargets.length) {
    for (const p of ftrTargets) {
      let fx = typeof byPath[p].content === "string" ? byPath[p].content : td.decode(byPath[p].content);
      fx = fx.replace(/(<w:ftr[^>]*>)[\s\S]*(<\/w:ftr>)/, (_, a, b) => a + stdFtrInner(p) + b);
      byPath[p].content = fx;
    }
  } else if (info.C || info.W) {
    // 꼬리말이 전혀 없는 템플릿: 표준 꼬리말 파트를 생성해 default 참조가 없는 모든 구역에 연결
    const fp = "word/footerPg.xml";
    const nf = { path: fp, content: XMLH + `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${stdFtrInner(fp)}</w:ftr>` };
    files.push(nf); byPath[fp] = nf;
    const df = byPath["word/document.xml"];
    let xml = typeof df.content === "string" ? df.content : td.decode(df.content);
    xml = xml.replace(/<w:sectPr(\s[^>]*)?>([\s\S]*?)<\/w:sectPr>/g, (m, attrs, inner) =>
      /w:footerReference w:type="default"/.test(inner) ? m : `<w:sectPr${attrs || ""}><w:footerReference w:type="default" r:id="rIdPgFtr"/>${inner}</w:sectPr>`);
    df.content = xml;
    // document.xml.rels에 꼬리말 관계 추가 + Content Types override
    const rp = "word/_rels/document.xml.rels";
    if (byPath[rp]) {
      let rx = typeof byPath[rp].content === "string" ? byPath[rp].content : td.decode(byPath[rp].content);
      if (!rx.includes('Id="rIdPgFtr"')) rx = rx.replace("</Relationships>", '<Relationship Id="rIdPgFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footerPg.xml"/></Relationships>');
      byPath[rp].content = rx;
    }
    const ct0 = byPath["[Content_Types].xml"];
    if (ct0) {
      let cx = typeof ct0.content === "string" ? ct0.content : td.decode(ct0.content);
      if (!cx.includes("/word/footerPg.xml")) cx = cx.replace("</Types>", '<Override PartName="/word/footerPg.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
      ct0.content = cx;
    }
  }

  const modified = Object.keys(usedByPart);
  if (!modified.length) return null;   // 치환 지점 없음 → 원본 유지

  // 사용된 파트별 이미지 관계(rels) 추가·생성
  const REL = k => `<Relationship Id="${info[k].relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${info[k].fileName}"/>`;
  for (const part of modified) {
    const relPath = part.replace(/^word\//, "word/_rels/") + ".rels";
    const rels = [...usedByPart[part]].map(REL).join("");
    if (byPath[relPath]) {
      let rx = typeof byPath[relPath].content === "string" ? byPath[relPath].content : td.decode(byPath[relPath].content);
      [...usedByPart[part]].forEach(k => { if (!rx.includes(`Id="${info[k].relId}"`)) rx = rx.replace("</Relationships>", REL(k) + "</Relationships>"); });
      byPath[relPath].content = rx;
    } else {
      const nf = { path: relPath, content: XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` };
      files.push(nf); byPath[relPath] = nf;
    }
  }
  // 로고 미디어 파일 추가 (파일명 충돌 시 그대로 덮어쓰지 않도록 신규 경로 사용: pg_ 접두)
  const usedKinds = new Set(); modified.forEach(p => usedByPart[p].forEach(k => usedKinds.add(k)));
  usedKinds.forEach(k => { if (!byPath[`word/media/${info[k].fileName}`]) files.push({ path: `word/media/${info[k].fileName}`, content: info[k].bytes }); });
  // [Content_Types].xml에 이미지 확장자 Default 보강
  const ct = byPath["[Content_Types].xml"];
  if (ct) {
    let cx = typeof ct.content === "string" ? ct.content : td.decode(ct.content);
    usedKinds.forEach(k => {
      const ext = info[k].fileName.split(".").pop();
      if (!new RegExp(`Extension="${ext}"`).test(cx)) cx = cx.replace("</Types>", `<Default Extension="${ext}" ContentType="image/${ext === "png" ? "png" : "jpeg"}"/></Types>`);
    });
    ct.content = cx;
  }
  return zipBytes(files);
}

// ── OSSP 템플릿 실파일(xlsx)에 프로젝트 로고 주입 ─────────────────────────
// 엑셀 템플릿의 드로잉(xl/drawings/drawing*.xml)에서 텍스트가 '고객사 로고'/'우리회사 로고'인
// 텍스트박스 도형을 같은 위치·높이의 로고 그림으로 교체 (너비는 로고 원본 비율로 조정)
async function injectLogosIntoTemplateXlsx(bytes, meta) {
  const logos = getDocLogos(meta);
  const cl = logos.client?.dataUrl ? dataUrlToBytes(logos.client.dataUrl) : null;
  const co = logos.company?.dataUrl ? dataUrlToBytes(logos.company.dataUrl) : null;
  if (!cl && !co) return null;   // 프로젝트에 등록된 로고 없음 → 원본 유지
  const ratioOf = l => (Number(l?.w) > 0 && Number(l?.h) > 0) ? Math.min(Number(l.w) / Number(l.h), 8) : 3;
  const info = {
    C: cl && { relId: "rIdPgLogoC", fileName: `pg_logo_client.${cl.ext}`, bytes: cl.bytes, ratio: ratioOf(logos.client) },
    W: co && { relId: "rIdPgLogoW", fileName: `pg_logo_company.${co.ext}`, bytes: co.bytes, ratio: ratioOf(logos.company) },
  };
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  if (!byPath["xl/workbook.xml"]) return null;   // xlsx 아님
  let imgId = 9000;
  const usedByPart = {};   // drawing 경로 → Set("C"/"W")
  const markUsed = (part, k) => { (usedByPart[part] = usedByPart[part] || new Set()).add(k); };

  // ── 드로잉 → 시트 XML 역매핑 (앵커 좌표 계산에 열 폭이 필요) ──
  const sheetXmlForDrawing = {};
  files.filter(sf => /^xl\/worksheets\/sheet\d+\.xml$/.test(sf.path)).forEach(sf => {
    const sxml = typeof sf.content === "string" ? sf.content : td.decode(sf.content);
    const dM = /<drawing\s+r:id="([^"]+)"\s*\/>/.exec(sxml);
    if (!dM) return;
    const relP = sf.path.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";
    if (!byPath[relP]) return;
    const rXml = typeof byPath[relP].content === "string" ? byPath[relP].content : td.decode(byPath[relP].content);
    const relM = new RegExp(`<Relationship[^>]*Id="${dM[1]}"[^>]*Target="([^"]+)"`).exec(rXml);
    if (!relM) return;
    sheetXmlForDrawing["xl/" + relM[1].replace(/^\.\.\//, "").replace(/^\//, "").replace(/^xl\//, "")] = sxml;
  });
  // 열 폭 테이블(EMU) — 시트 선언값 기준 + 같은 드로잉의 twoCellAnchor 캐시로 배율 보정.
  // 템플릿마다 기본 글꼴이 달라 '문자 폭 → 픽셀' 환산에 오차가 생기므로,
  // from/to와 캐시 크기(a:ext)를 모두 가진 도형에서 실제 배율을 역산해 곱한다.
  const colTableFor = (sxml, dxml) => {
    const def = Number(/defaultColWidth="([\d.]+)"/.exec(sxml || "")?.[1] || 8.43);
    const map = {};
    const colsM = /<cols>([\s\S]*?)<\/cols>/.exec(sxml || "");
    if (colsM) [...colsM[1].matchAll(/<col\b[^>]*\/>/g)].forEach(m => {
      const mn = Number(/min="(\d+)"/.exec(m[0])?.[1]); const mx = Number(/max="(\d+)"/.exec(m[0])?.[1]);
      const w = Number(/width="([\d.]+)"/.exec(m[0])?.[1]);
      if (mn && mx && w) for (let c = mn; c <= Math.min(mx, 1024); c++) map[c] = w;
    });
    const base = c => Math.round((map[c + 1] ?? def) * 7 + 5) * 9525;
    const ratios = [];
    [...String(dxml || "").matchAll(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g)].forEach(m => {
      const a = m[0];
      const fM = /<xdr:from>([\s\S]*?)<\/xdr:from>/.exec(a), tM = /<xdr:to>([\s\S]*?)<\/xdr:to>/.exec(a);
      const exM = /<a:ext\b[^>]*\bcx="(\d+)"/.exec(a);
      if (!fM || !tM || !exM) return;
      const g = (s, t) => { const x = new RegExp(`<xdr:${t}>(-?\\d+)</xdr:${t}>`).exec(s); return x ? Number(x[1]) : null; };
      const fc = g(fM[1], "col"), fo = g(fM[1], "colOff") || 0, tc = g(tM[1], "col"), to = g(tM[1], "colOff") || 0;
      if (fc === null || tc === null || tc <= fc) return;
      let span = 0; for (let c = fc; c < tc; c++) span += base(c);
      if (span <= 0) return;
      const rt = (Number(exM[1]) + fo - to) / span;
      if (rt > 0.5 && rt < 2) ratios.push(rt);
    });
    // 캐시는 도형마다 저장 시점이 달라 서로 어긋날 수 있다. 가장 작은 배율을 택해
    // 왼쪽 이동량을 넉넉히 잡는다 — 안쪽으로 조금 들어가는 오차는 눈에 띄지 않지만,
    // 바깥으로 나가는 오차는 인쇄 영역을 벗어나 즉시 문제가 되기 때문.
    let scale = 1;
    if (ratios.length) scale = Math.min(...ratios);
    scale = Math.min(1.5, Math.max(0.75, scale));
    return c => Math.max(1, Math.round(base(c) * scale));
  };

  // 드로잉별로 플레이스홀더 텍스트박스(xdr:sp) → 그림(xdr:pic) 교체
  const drawingPaths = files.map(f => f.path).filter(p => /^xl\/drawings\/drawing\d+\.xml$/.test(p));
  for (const part of drawingPaths) {
    const f = byPath[part];
    let xml = typeof f.content === "string" ? f.content : td.decode(f.content);
    const colW = colTableFor(sheetXmlForDrawing[part], xml);
    let changed = false;
    xml = xml.replace(/<xdr:(oneCellAnchor|twoCellAnchor)(\s[^>]*)?>(?:(?!<\/xdr:\1>).)*?<\/xdr:\1>/gs, anchor => {
      const spM = /<xdr:sp[\s>](?:(?!<\/xdr:sp>).)*?<\/xdr:sp>/s.exec(anchor);
      if (!spM) return anchor;
      const text = [...spM[0].matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => m[1]).join("").replace(/[\s\u00a0{}]/g, "");
      const k = text === "고객사로고" ? "C" : text === "우리회사로고" ? "W" : null;
      if (!k || !info[k]) return anchor;
      // 좌표·크기 파싱 — 속성 순서·추가 속성·공백 표기에 무관하게 태그 단위로 개별 추출 (템플릿별 XML 표기 차이 흡수)
      const attrNum = (tag, at) => { if (!tag) return null; const m = new RegExp(`\\b${at}="(-?\\d+)"`).exec(tag); return m ? Number(m[1]) : null; };
      const xfrmM = /<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/.exec(spM[0]);
      const offTag = xfrmM ? (/<a:off\b[^>]*\/?>/.exec(xfrmM[1]) || [null])[0] : null;
      const spExtTag = xfrmM ? (/<a:ext\b[^>]*\/?>/.exec(xfrmM[1]) || [null])[0] : null;
      const anchorExtTag = (/<xdr:ext\b[^>]*\/?>/.exec(anchor) || [null])[0];
      const ox = attrNum(offTag, "x"), oy = attrNum(offTag, "y");
      const ocx = attrNum(spExtTag, "cx");
      const ocy = attrNum(spExtTag, "cy");
      const acx = attrNum(anchorExtTag, "cx"), acy = attrNum(anchorExtTag, "cy");
      // 크기: 원래 텍스트박스 높이(cy)를 유지하고 너비(cx)는 로고 비율에 맞춤
      const cy = ocy ?? acy ?? 336246;
      const cx = Math.max(1, Math.round(cy * info[k].ratio));
      const id = ++imgId;
      const picWithOff = off => `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="PgLogo${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${info[k].relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm>${off}<a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`;
      markUsed(part, k); changed = true;
      // 우측 정렬: 플레이스홀더의 "오른쪽 끝선"을 유지하되, 반드시 셀 앵커(from) 기준으로 계산한다.
      // ※ 캐시 좌표(a:off)를 절대좌표 앵커로 옮기면 안 된다 — a:off는 템플릿을 마지막으로 저장한
      //   세션의 열 폭이 박제된 값이라, 여는 쪽(엑셀)의 실제 열 폭과 다르면 로고가 통째로 밀린다.
      //   셀 앵커로 두면 엑셀이 자기 기하로 위치를 계산하므로 템플릿 원안대로 놓인다.
      const fromM2 = /<xdr:from>([\s\S]*?)<\/xdr:from>/.exec(anchor);
      if (fromM2) {
        const gv = (s, t) => { const x = new RegExp(`<xdr:${t}>(-?\\d+)</xdr:${t}>`).exec(s); return x ? Number(x[1]) : 0; };
        let col = gv(fromM2[1], "col"), colOff = gv(fromM2[1], "colOff");
        const row = gv(fromM2[1], "row"), rowOff = gv(fromM2[1], "rowOff");
        // 플레이스홀더 원래 너비: 앵커 ext > (twoCellAnchor면 from~to 실측) > 도형 캐시 폭
        let phCx = acx;
        const toM2 = /<xdr:to>([\s\S]*?)<\/xdr:to>/.exec(anchor);
        if (phCx === null && toM2) {
          const tc = gv(toM2[1], "col"), to = gv(toM2[1], "colOff");
          if (tc >= col) { let s2 = 0; for (let c = col; c < tc; c++) s2 += colW(c); phCx = Math.max(1, s2 + to - colOff); }
        }
        if (phCx === null) phCx = ocx;
        if (phCx !== null) {
          let shift = cx - phCx;
          while (shift > 0) {                       // 로고가 더 넓다 → 왼쪽으로 밀어 우측 끝선 유지
            if (colOff >= shift) { colOff -= shift; shift = 0; break; }
            if (col === 0) { colOff = 0; shift = 0; break; }
            shift -= colOff; col -= 1; colOff = colW(col);
          }
          if (shift < 0) {                          // 로고가 더 좁다 → 오른쪽으로 당김
            colOff -= shift;
            while (colOff >= colW(col)) { colOff -= colW(col); col += 1; }
          }
        }
        return `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${Math.max(0, Math.round(colOff))}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>${picWithOff('<a:off x="0" y="0"/>')}<xdr:clientData/></xdr:oneCellAnchor>`;
      }
      const off = (ox !== null) ? `<a:off x="${ox}" y="${oy ?? 0}"/>` : '<a:off x="0" y="0"/>';
      let out = anchor.replace(spM[0], picWithOff(off));
      if (anchorExtTag) out = out.replace(anchorExtTag, `<xdr:ext cx="${cx}" cy="${cy}"/>`);
      return out;
    });
    if (changed) f.content = xml;
  }

  // ── 셀 위치 로고 삽입 공용부: 앵커 생성 + 시트 부착(기존 드로잉에 추가 또는 신규 드로잉 생성·연결) ──
  const newDrawingParts = [];        // 신규 생성 드로잉 경로 (ContentTypes Override 필요)
  const newKinds = new Set();        // 신규 드로잉이 사용하는 로고 종류 (미디어 추가용)
  let drawMax = 0;
  files.forEach(f => { const m = /^xl\/drawings\/drawing(\d+)\.xml$/.exec(f.path); if (m) drawMax = Math.max(drawMax, Number(m[1])); });
  const picXml = (k, cx, cy) => {
    const id = ++imgId;
    return `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="PgLogo${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${info[k].relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`;
  };
  const picAnchor = (k, col, row, cy, colOff = 50000, rowOff = 50000) => {
    const cx = Math.max(1, Math.round(cy * info[k].ratio));
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${colOff}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>${picXml(k, cx, cy)}<xdr:clientData/></xdr:oneCellAnchor>`;
  };
  // 절대좌표(absoluteAnchor) — 열 폭 계산 오차와 무관하게 위치 고정 → 완벽한 우측 정렬 보장
  const absAnchor = (k, x, y, cy) => {
    const cx = Math.max(1, Math.round(cy * info[k].ratio));
    return `<xdr:absoluteAnchor><xdr:pos x="${Math.round(x)}" y="${Math.round(y)}"/><xdr:ext cx="${cx}" cy="${cy}"/>${picXml(k, cx, cy)}<xdr:clientData/></xdr:absoluteAnchor>`;
  };
  const IMGREL = k => `<Relationship Id="${info[k].relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${info[k].fileName}"/>`;
  const colPx = w => Math.round(w * 7 + 5);
  const parseColWidths = sxml => {
    const def = Number(/defaultColWidth="([\d.]+)"/.exec(sxml)?.[1] || 8.43);
    const map = {};
    const colsM = /<cols>([\s\S]*?)<\/cols>/.exec(sxml);
    if (colsM) [...colsM[1].matchAll(/<col\b[^>]*\/>/g)].forEach(m => {
      const mn = Number(/min="(\d+)"/.exec(m[0])?.[1]); const mx = Number(/max="(\d+)"/.exec(m[0])?.[1]);
      const w = Number(/width="([\d.]+)"/.exec(m[0])?.[1]);
      if (mn && mx && w) for (let c = mn; c <= mx; c++) map[c] = w;
    });
    return { def, map };
  };
  // 시트 기하: 열 폭·행 높이·병합 범위 (0-base)
  const sheetGeom = sxml => {
    const { def, map } = parseColWidths(sxml);
    const defHt = Number(/defaultRowHeight="([\d.]+)"/.exec(sxml)?.[1] || 16.5);
    const rowHt = {};
    [...sxml.matchAll(/<row\b[^>]*>/g)].forEach(m => {
      const r = Number(/r="(\d+)"/.exec(m[0])?.[1]); const h = /ht="([\d.]+)"/.exec(m[0]);
      if (r && h) rowHt[r] = Number(h[1]);
    });
    const merges = [...sxml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map(m => [m[1], m[2]]);
    const colWEmu = c => colPx(map[c + 1] ?? def) * 9525;
    const rowHEmu = r => Math.round((rowHt[r + 1] ?? defHt) * 12700);
    const rowTop = r => { let a = 0; for (let i = 0; i < r; i++) a += rowHEmu(i); return a; };
    return { colWEmu, rowHEmu, rowTop, merges };
  };
  const refCR = ref => { const l = /^([A-Z]+)/.exec(ref)?.[1] || "A"; let c = 0; for (const ch of l) c = c * 26 + (ch.charCodeAt(0) - 64); return { c: c - 1, r: Number(/(\d+)$/.exec(ref)?.[1] || 1) - 1 }; };
  // ref 셀(병합 범위 포함)의 가로·세로 정중앙에 로고를 배치
  const centeredAnchor = (k, sxml, ref, cy) => {
    const g = sheetGeom(sxml);
    const { c, r } = refCR(ref);
    let c2 = c, r2 = r;
    for (const [a, b] of g.merges) {
      const A = refCR(a), B = refCR(b);
      if (c >= A.c && c <= B.c && r >= A.r && r <= B.r) { c2 = B.c; r2 = B.r; break; }
    }
    let W = 0; for (let i = c; i <= c2; i++) W += g.colWEmu(i);
    let H = 0; for (let i = r; i <= r2; i++) H += g.rowHEmu(i);
    const cx = Math.max(1, Math.round(cy * info[k].ratio));
    return picAnchor(k, c, r, cy, Math.max(0, Math.round((W - cx) / 2)), Math.max(0, Math.round((H - cy) / 2)));
  };
  const ensureColWidth = (sxml, colNum, width) => {
    const wStr = width.toFixed(2);
    const mk = `<col min="${colNum}" max="${colNum}" width="${wStr}" customWidth="1"/>`;
    const colsM = /<cols>([\s\S]*?)<\/cols>/.exec(sxml);
    if (!colsM) return sxml.replace("<sheetData>", `<cols>${mk}</cols><sheetData>`);
    let inner = colsM[1]; let handled = false;
    inner = inner.replace(/<col\b[^>]*\/>/g, tag => {
      const mn = Number(/min="(\d+)"/.exec(tag)?.[1]); const mx = Number(/max="(\d+)"/.exec(tag)?.[1]);
      if (!mn || !mx || colNum < mn || colNum > mx) return tag;
      handled = true;
      const curW = Number(/width="([\d.]+)"/.exec(tag)?.[1] || 0);
      if (curW >= width) return tag;
      const parts = [];
      if (mn <= colNum - 1) parts.push(tag.replace(/min="\d+"/, `min="${mn}"`).replace(/max="\d+"/, `max="${colNum - 1}"`));
      let solo = tag.replace(/min="\d+"/, `min="${colNum}"`).replace(/max="\d+"/, `max="${colNum}"`);
      solo = /width="[\d.]+"/.test(solo) ? solo.replace(/width="[\d.]+"/, `width="${wStr}"`) : solo.replace("/>", ` width="${wStr}"/>`);
      if (!/customWidth=/.test(solo)) solo = solo.replace("/>", ` customWidth="1"/>`);
      parts.push(solo);
      if (colNum + 1 <= mx) parts.push(tag.replace(/min="\d+"/, `min="${colNum + 1}"`).replace(/max="\d+"/, `max="${mx}"`));
      return parts.join("");
    });
    if (!handled) inner += mk;
    return sxml.replace(colsM[0], `<cols>${inner}</cols>`);
  };
  const attachAnchors = (sp, anchorsXml, kinds) => {
    const sf = byPath[sp];
    let sxml = typeof sf.content === "string" ? sf.content : td.decode(sf.content);
    const sRelPath = sp.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";
    const dM = /<drawing\s+r:id="([^"]+)"\s*\/>/.exec(sxml);
    let drawPart = null;
    if (dM && byPath[sRelPath]) {
      const rXml = typeof byPath[sRelPath].content === "string" ? byPath[sRelPath].content : td.decode(byPath[sRelPath].content);
      const relM = new RegExp(`<Relationship[^>]*Id="${dM[1]}"[^>]*Target="([^"]+)"`).exec(rXml);
      if (relM) drawPart = "xl/" + relM[1].replace(/^\.\.\//, "").replace(/^\//, "").replace(/^xl\//, "");
    }
    if (drawPart && byPath[drawPart]) {
      const df = byPath[drawPart];
      const dxml = typeof df.content === "string" ? df.content : td.decode(df.content);
      df.content = dxml.replace("</xdr:wsDr>", anchorsXml + "</xdr:wsDr>");
      kinds.forEach(k => markUsed(drawPart, k));
    } else {
      const n = ++drawMax;
      const dPath = `xl/drawings/drawing${n}.xml`;
      const dF = { path: dPath, content: XMLH + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchorsXml}</xdr:wsDr>` };
      files.push(dF); byPath[dPath] = dF;
      const dRelF = { path: `xl/drawings/_rels/drawing${n}.xml.rels`, content: XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${kinds.map(IMGREL).join("")}</Relationships>` };
      files.push(dRelF); byPath[dRelF.path] = dRelF;
      const drawRel = `<Relationship Id="rIdPgDrw${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/>`;
      if (byPath[sRelPath]) {
        const rx = typeof byPath[sRelPath].content === "string" ? byPath[sRelPath].content : td.decode(byPath[sRelPath].content);
        byPath[sRelPath].content = rx.replace("</Relationships>", drawRel + "</Relationships>");
      } else {
        const nf = { path: sRelPath, content: XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawRel}</Relationships>` };
        files.push(nf); byPath[sRelPath] = nf;
      }
      const ins = `<drawing r:id="rIdPgDrw${n}"/>`;
      const posM = /<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(sxml);
      sxml = posM ? sxml.slice(0, posM.index) + ins + sxml.slice(posM.index) : sxml.replace("</worksheet>", ins + "</worksheet>");
      newDrawingParts.push(dPath);
      kinds.forEach(k => newKinds.add(k));
    }
    // <drawing r:id>를 넣었는데 루트에 r 네임스페이스 선언이 없으면(openpyxl 등으로 만든 xlsx) 파일이 손상되므로 선언 추가
    if (/<drawing\s+r:id=/.test(sxml)) {
      const rootM = /<worksheet\b[^>]*>/.exec(sxml);
      if (rootM && !/xmlns:r=/.test(rootM[0])) {
        sxml = sxml.replace(rootM[0], rootM[0].replace("<worksheet", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'));
      }
    }
    sf.content = sxml;
  };
  const sheetPathByName = {};
  {
    const wbF2 = byPath["xl/workbook.xml"];
    const wbXml2 = typeof wbF2.content === "string" ? wbF2.content : td.decode(wbF2.content);
    const wbRelF = byPath["xl/_rels/workbook.xml.rels"];
    const wbRelXml = wbRelF ? (typeof wbRelF.content === "string" ? wbRelF.content : td.decode(wbRelF.content)) : "";
    const relMap2 = {};
    [...wbRelXml.matchAll(/<Relationship\b[^>]*>/g)].forEach(m => {
      const id = /Id="([^"]+)"/.exec(m[0]); const tg = /Target="([^"]+)"/.exec(m[0]);
      if (id && tg) relMap2[id[1]] = tg[1];
    });
    [...wbXml2.matchAll(/<sheet\b[^>]*>/g)].forEach(m => {
      const name = /name="([^"]+)"/.exec(m[0])?.[1];
      const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
      if (name && rid && relMap2[rid]) sheetPathByName[name] = "xl/" + relMap2[rid].replace(/^\//, "").replace(/^xl\//, "");
    });
  }
  // 수식 셀 제거 시 calcChain 정리 + 열 때 전체 재계산 (수식 캐시의 옛 placeholder 표시 갱신)
  const forceRecalc = () => {
    const idx = files.findIndex(f => f.path === "xl/calcChain.xml");
    if (idx > -1) { files.splice(idx, 1); delete byPath["xl/calcChain.xml"]; }
    const wr = byPath["xl/_rels/workbook.xml.rels"];
    if (wr) {
      const rx = typeof wr.content === "string" ? wr.content : td.decode(wr.content);
      wr.content = rx.replace(/<Relationship\b[^>]*Target="calcChain\.xml"[^>]*\/>/g, "");
    }
    const ct0 = byPath["[Content_Types].xml"];
    if (ct0) {
      const cx0 = typeof ct0.content === "string" ? ct0.content : td.decode(ct0.content);
      ct0.content = cx0.replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, "");
    }
    const wbF3 = byPath["xl/workbook.xml"];
    if (wbF3) {
      let wx = typeof wbF3.content === "string" ? wbF3.content : td.decode(wbF3.content);
      if (/<calcPr\b/.test(wx)) { if (!/fullCalcOnLoad=/.test(wx)) wx = wx.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1" '); }
      else wx = /<extLst\b/.test(wx) ? wx.replace(/<extLst\b/, '<calcPr fullCalcOnLoad="1"/><extLst') : wx.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
      wbF3.content = wx;
    }
  };

  // ── 표준 헤더 블록의 'SWSM' 셀 → 고객사 로고 (모든 시트, 병합 셀 정중앙 배치) ──
  // 공유문자열·인라인·수식 캐시(t="str") 유형 모두 탐지. 열 폭은 로고에 맞춰 자동 확장.
  if (cl) {
    const sstF = byPath["xl/sharedStrings.xml"];
    const sstXml0 = sstF ? (typeof sstF.content === "string" ? sstF.content : td.decode(sstF.content)) : "";
    const sst0 = [...sstXml0.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
    const cellTextOf = (attrs, inner) => {   // 셀 XML → 표시 텍스트 (s·inlineStr·str 공용)
      if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); return v ? (sst0[Number(v[1])] || "") : ""; }
      if (/t="inlineStr"/.test(attrs)) return [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("");
      if (/t="str"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); return v ? v[1] : ""; }
      return "";
    };
    let removedFormula = false;
    const sheetPaths = files.map(f => f.path).filter(p => /^xl\/worksheets\/[^\/]+\.xml$/i.test(p));
    const logoSheets = new Set();   // 이 브랜치에서 로고를 넣은 시트
    for (const sp of sheetPaths) {
      const sf = byPath[sp];
      let sxml = typeof sf.content === "string" ? sf.content : td.decode(sf.content);
      let ref = null;
      sxml = sxml.replace(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (m, attrs, close, inner) => {
        if (ref || inner === undefined) return m;
        const text = cellTextOf(attrs, inner);
        if (text.replace(/[\s\u00a0]/g, "").toUpperCase() !== "SWSM") return m;
        ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] || "A1";
        if (inner.includes("<f")) removedFormula = true;
        const sAttr = /s="\d+"/.exec(attrs)?.[0] || "";
        return `<c r="${ref}"${sAttr ? " " + sAttr : ""}/>`;
      });
      if (!ref) continue;
      const cySw = 300000;
      const cxSw = Math.max(1, Math.round(cySw * info.C.ratio));
      const needPx = Math.ceil(cxSw / 9525) + 16;
      sxml = ensureColWidth(sxml, refCR(ref).c + 1, Math.max(0, (needPx - 5) / 7));
      sf.content = sxml;   // 셀 비움·열 폭 반영 후 정중앙 앵커 부착
      attachAnchors(sp, centeredAnchor("C", sxml, ref, cySw), ["C"]);
      logoSheets.add(sp);
    }

    // ── 폴백: 표준 헤더(프로젝트·문서번호 등)가 있는데 로고가 없는 시트 → A1 병합 영역(로고 박스)에 고객사 로고 ──
    // 템플릿·작성가이드·작성예 시트처럼 SWSM 셀 탐지에 걸리지 않는 시트를 커버. 표지 시트는 별도 로직이 처리하므로 제외.
    const drawPartOf = sp => {   // 시트에 연결된 드로잉 파트 경로 (텍스트박스 교체로 이미 로고가 들어갔는지 판단용)
      const sf0 = byPath[sp]; if (!sf0) return null;
      const sxml0 = typeof sf0.content === "string" ? sf0.content : td.decode(sf0.content);
      const dM0 = /<drawing\s+r:id="([^"]+)"\s*\/>/.exec(sxml0);
      const rp0 = sp.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";
      if (!dM0 || !byPath[rp0]) return null;
      const rXml0 = typeof byPath[rp0].content === "string" ? byPath[rp0].content : td.decode(byPath[rp0].content);
      const relM0 = new RegExp(`<Relationship[^>]*Id="${dM0[1]}"[^>]*Target="([^"]+)"`).exec(rXml0);
      return relM0 ? "xl/" + relM0[1].replace(/^\.\.\//, "").replace(/^\//, "").replace(/^xl\//, "") : null;
    };
    const coverPath = Object.entries(sheetPathByName).find(([n]) => n === "표지" || n.includes("표지"))?.[1] || null;
    for (const sp of sheetPaths) {
      if (logoSheets.has(sp) || sp === coverPath) continue;
      const dp = drawPartOf(sp);
      if (dp && usedByPart[dp] && usedByPart[dp].has("C")) continue;   // 플레이스홀더 텍스트박스 교체로 이미 로고 존재
      const sf = byPath[sp];
      let sxml = typeof sf.content === "string" ? sf.content : td.decode(sf.content);
      // 표준 헤더 감지: 상단 8행 안에 '프로젝트' + ('문서번호'|'단계'|'작성일자') 라벨 존재
      let head = "";
      sxml.replace(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (m, attrs, close, inner) => {
        if (inner === undefined) return m;
        const rw = /r="[A-Z]+(\d+)"/.exec(attrs);
        if (rw && Number(rw[1]) <= 8) head += cellTextOf(attrs, inner) + "|";
        return m;
      });
      const hz = head.replace(/[\s\u00a0]/g, "");
      if (!hz.includes("프로젝트") || !(hz.includes("문서번호") || hz.includes("단계") || hz.includes("작성일자"))) continue;
      // A1을 포함하는 병합 영역 = 헤더 로고 박스 → 영역 내 텍스트·수식 셀 비움 (남아있는 회사명 표기 제거)
      let c2 = 0, r2 = 0;
      for (const m of sxml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)) {
        const A = refCR(m[1]), B = refCR(m[2]);
        if (A.c === 0 && A.r === 0) { c2 = B.c; r2 = B.r; break; }
      }
      sxml = sxml.replace(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (m, attrs, close, inner) => {
        if (inner === undefined) return m;
        const rr = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]; if (!rr) return m;
        const { c, r } = refCR(rr);
        if (c > c2 || r > r2) return m;
        if (inner.includes("<f")) removedFormula = true;
        const sAttr = /s="\d+"/.exec(attrs)?.[0] || "";
        return `<c r="${rr}"${sAttr ? " " + sAttr : ""}/>`;
      });
      // 로고 크기: 로고 박스(병합 영역) 안에 맞춤 — 열 폭·표 레이아웃은 건드리지 않음
      const g1 = sheetGeom(sxml);
      let W = 0; for (let i = 0; i <= c2; i++) W += g1.colWEmu(i);
      let H = 0; for (let i = 0; i <= r2; i++) H += g1.rowHEmu(i);
      let cyFb = Math.min(300000, Math.max(1, Math.round(H * 0.85)));
      if (cyFb * info.C.ratio > W * 0.92) cyFb = Math.max(1, Math.floor((W * 0.92) / info.C.ratio));
      sf.content = sxml;   // 셀 비움 반영 후 정중앙 앵커 부착
      attachAnchors(sp, centeredAnchor("C", sxml, "A1", cyFb), ["C"]);
      logoSheets.add(sp);
    }
    if (removedFormula) forceRecalc();
  }

  // ── 표지 시트: 고객사 로고 + 그 아래 우리회사 로고 — 절대좌표로 오른쪽 끝선에 완벽 우측 정렬 ──
  // 단, 표지에 플레이스홀더 텍스트박스("고객사로고"/"우리회사로고")가 있어 이미 치환된 로고는 건너뜀 (중복 삽입 방지).
  // 판정: 표지 시트에 연결된 드로잉 XML에 해당 로고의 embed 관계 ID(rIdPgLogoC/W)가 이미 존재하는지 확인 — 재주입 시 멱등성도 보장.
  const coverName = Object.keys(sheetPathByName).find(n => n === "표지") || Object.keys(sheetPathByName).find(n => n.includes("표지"));
  if ((cl || co) && coverName && byPath[sheetPathByName[coverName]]) {
    const coverSp = sheetPathByName[coverName];
    const cf = byPath[coverSp];
    const cvXml = typeof cf.content === "string" ? cf.content : td.decode(cf.content);
    // 표지에 연결된 드로잉 XML 조회 (플레이스홀더 치환으로 로고가 이미 들어갔는지 판단)
    let coverDrawXml = "";
    {
      const dM = /<drawing\s+r:id="([^"]+)"\s*\/>/.exec(cvXml);
      const rp = coverSp.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";
      if (dM && byPath[rp]) {
        const rXml = typeof byPath[rp].content === "string" ? byPath[rp].content : td.decode(byPath[rp].content);
        const relM = new RegExp(`<Relationship[^>]*Id="${dM[1]}"[^>]*Target="([^"]+)"`).exec(rXml);
        if (relM) {
          const dp = "xl/" + relM[1].replace(/^\.\.\//, "").replace(/^\//, "").replace(/^xl\//, "");
          if (byPath[dp]) coverDrawXml = typeof byPath[dp].content === "string" ? byPath[dp].content : td.decode(byPath[dp].content);
        }
      }
    }
    const hasC = coverDrawXml.includes(`r:embed="${info.C ? info.C.relId : ""}"`) && !!info.C;
    const hasW = coverDrawXml.includes(`r:embed="${info.W ? info.W.relId : ""}"`) && !!info.W;
    const g = sheetGeom(cvXml);
    // 오른쪽 끝선 기준 열 — 우측 정렬된 제목·문서번호·날짜가 들어 있는 병합 범위의 끝 열을 쓴다.
    // <dimension>은 값 없이 서식만 있는 열까지 포함해 실제 표 오른쪽 끝보다 넓게 잡히는 경우가 있다.
    const colIdxOf = l => { let c = 0; for (const ch of l) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; };
    const dimL = /<dimension ref="[A-Z]+\d+:([A-Z]+)\d+"/.exec(cvXml)?.[1] || "L";
    let lastCol = colIdxOf(dimL);
    const mergeEnd = g.merges.reduce((mx, pair) => Math.max(mx, refCR(pair[1]).c), -1);
    if (mergeEnd >= 0) lastCol = Math.min(lastCol, mergeEnd);
    const anchors = []; const kinds = [];
    // 셀 기준(oneCellAnchor)으로 배치한다. 열의 절대 위치는 Excel이 직접 계산하므로
    // 우리 열 폭 추정의 오차가 마지막 한두 열 안으로만 남는다.
    // (절대좌표 방식은 A열부터의 추정 오차가 전부 누적되어 오른쪽으로 밀려난다)
    const RIGHT_MARGIN = 30000;
    const placeRight = (k, row, cy) => {
      const cx = Math.max(1, Math.round(cy * info[k].ratio));
      let need = cx + RIGHT_MARGIN, c = lastCol;
      while (c >= 0) {
        const w = g.colWEmu(c);
        if (w >= need) return picAnchor(k, c, row, cy, Math.max(0, Math.round(w - need)), 20000);
        need -= w; c -= 1;
      }
      return picAnchor(k, 0, row, cy, 0, 20000);
    };
    if (cl && !hasC) { anchors.push(placeRight("C", 13, 324000)); kinds.push("C"); }   // 14행 부근 고객사 로고
    if (co && !hasW) { anchors.push(placeRight("W", 16, 324000)); kinds.push("W"); }   // 17행 부근 우리회사 로고
    if (anchors.length) attachAnchors(coverSp, anchors.join(""), kinds);
  }

  const modified = Object.keys(usedByPart);
  if (!modified.length && !newDrawingParts.length) return null;   // 플레이스홀더·SWSM 셀·표지 대상 없음 → 원본 유지

  // 수정된 드로잉별 이미지 관계(rels) 추가·생성
  const REL = k => `<Relationship Id="${info[k].relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${info[k].fileName}"/>`;
  for (const part of modified) {
    const relPath = part.replace("xl/drawings/", "xl/drawings/_rels/") + ".rels";
    if (byPath[relPath]) {
      let rx = typeof byPath[relPath].content === "string" ? byPath[relPath].content : td.decode(byPath[relPath].content);
      [...usedByPart[part]].forEach(k => { if (!rx.includes(`Id="${info[k].relId}"`)) rx = rx.replace("</Relationships>", REL(k) + "</Relationships>"); });
      byPath[relPath].content = rx;
    } else {
      const nf = { path: relPath, content: XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[...usedByPart[part]].map(REL).join("")}</Relationships>` };
      files.push(nf); byPath[relPath] = nf;
    }
  }
  // 로고 미디어 파일 추가 (파일명 충돌 방지: pg_ 접두 신규 경로)
  const usedKinds = new Set(); modified.forEach(p => usedByPart[p].forEach(k => usedKinds.add(k)));
  newKinds.forEach(k => usedKinds.add(k));
  usedKinds.forEach(k => { if (!byPath[`xl/media/${info[k].fileName}`]) files.push({ path: `xl/media/${info[k].fileName}`, content: info[k].bytes }); });
  // [Content_Types].xml에 이미지 확장자 Default 보강
  const ct = byPath["[Content_Types].xml"];
  if (ct) {
    let cxml = typeof ct.content === "string" ? ct.content : td.decode(ct.content);
    usedKinds.forEach(k => {
      const ext = info[k].fileName.split(".").pop();
      if (!new RegExp(`Extension="${ext}"`).test(cxml)) cxml = cxml.replace("</Types>", `<Default Extension="${ext}" ContentType="image/${ext === "png" ? "png" : "jpeg"}"/></Types>`);
    });
    newDrawingParts.forEach(p => {
      if (!cxml.includes(`PartName="/${p}"`)) cxml = cxml.replace("</Types>", `<Override PartName="/${p}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    });
    ct.content = cxml;
  }
  return zipBytes(files);
}

// ── 표준 문서 프레임(회사 표준양식): 표지 → 문서정보표·사용권한·제.개정 이력 + 꼬리말 ──
// 생성되는 모든 워드파일이 공통 사용 — 로고는 표지·문서정보표·꼬리말에 임베드 (머리말에는 로고 미적용)
function docxStdParts({ title, docCode, phase, meta }) {
  const logos = getDocLogos(meta);
  // 설정(설정 → 조직·문서 기본값) 주입 — 문서번호 접두어, 작성/검토/승인자, 조직명, 배포구분, 꼬리말
  const code = docCodeWithPrefix(docCode, meta);
  const ap = docApprovers(meta);
  // 로고 미디어는 문서 전체(본문·꼬리말)에서 공유 — 파트별로 관계(relId)만 따로 부여
  const media = [];
  const regLogo = (logo, base) => {
    const parsed = logo?.dataUrl ? dataUrlToBytes(logo.dataUrl) : null;
    if (!parsed) return null;
    const fileName = `${base}.${parsed.ext}`;
    media.push({ fileName, bytes: parsed.bytes });
    const ratio = (Number(logo.w) > 0 && Number(logo.h) > 0) ? Number(logo.w) / Number(logo.h) : 3;
    return { fileName, ratio: Math.min(ratio, 8) };   // 최대 8:1 비율 제한
  };
  const cl = regLogo(logos.client, "logo_client");
  const co = regLogo(logos.company, "logo_company");
  // hEmu: 표시 높이(EMU, 1cm=360000) — 표지 0.9cm, 꼬리말 0.6cm
  const mkRun = (info, relId, idNum, hEmu) => info ? docxImageRun(relId, Math.max(1, Math.round(hEmu * info.ratio)), hEmu, idNum) : "";
  const clientRun = mkRun(cl, "rIdImg1", 1, 324000);
  const companyRun = mkRun(co, "rIdImg2", 2, 324000);
  const today = new Date().toISOString().slice(0, 10);
  const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const rightImgP = run => `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="140"/></w:pPr>${run}</w:p>`;

  // 1페이지: 표지 (우측 정렬)
  const cover =
    docxP("", { spacingAfter: 2600 }) +
    docxP(title, { bold: true, size: 44, align: "right", spacingAfter: 500 }) +
    docxP(meta.name || "{프로젝트 명}", { bold: true, italic: true, size: 32, align: "right", spacingAfter: 420 }) +
    docxP(`문서번호 : ${code}`, { size: 24, align: "right", spacingAfter: 420 }) +
    docxP("Version 0.1", { bold: true, italic: true, size: 28, align: "right", spacingAfter: 260 }) +
    docxP(today, { size: 20, align: "right", spacingAfter: 600 }) +
    (clientRun ? rightImgP(clientRun) : docxP("고객사로고", { bold: true, size: 24, align: "right", spacingAfter: 140 })) +
    (companyRun ? rightImgP(companyRun) : docxP("우리회사로고", { bold: true, size: 24, align: "right", spacingAfter: 140 })) +
    (ap.org ? docxP(ap.org, { size: 20, align: "right", spacingAfter: 80 }) : "") +
    (ap.orgNameEn ? docxP(ap.orgNameEn, { italic: true, size: 18, align: "right", spacingAfter: 140 }) : "") +
    pageBreak;

  // 2페이지: 문서 정보 표 + 사용권한 + 제.개정 이력
  const infoTable = docxInfoHeaderTable({
    logoXml: mkRun(cl, "rIdImg1", 3, 324000) || `<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>고객사로고</w:t></w:r>`,
    title,
    rows: [
      ["프로젝트", meta.name || "", "단계", phase || ""],
      ["시스템", systemNameOf(meta), "문서번호", code],
      ["작성자", ap.author, "작성일자", today],
      ...((ap.reviewer || ap.approver) ? [["검토자", ap.reviewer, "승인자", ap.approver]] : []),
      ...((ap.org || ap.distribution) ? [["작성조직", ap.org, "배포구분", ap.distribution]] : []),
    ],
  });
  const usage =
    docxP("사 용 권 한", { bold: true, size: 32, align: "center", spacingAfter: 320 }) +
    docxP("본 문서에 대한 서명은 당사 내부에서 본 문서에 대하여 수행 및 유지관리의 책임이 있음을 인정하는 것임.", { size: 22, spacingAfter: 260 }) +
    docxP("본 문서는 작성, 검토, 승인하여 승인된 원본을 보관한다.", { italic: true, size: 20, align: "center", spacingAfter: 260 }) +
    docxSignLine("작성자", ap.author) +
    docxSignLine("검토자", ap.reviewer) +
    docxP("본인은 서명으로써 본 문서가 당사의 업무활동 범위 내에서 사용될 것을 인가함.", { size: 22, spacingAfter: 260 }) +
    docxSignLine("승인자", ap.approver);
  const history =
    docxP("제.개정 이력", { bold: true, size: 32, align: "center", spacingAfter: 260 }) +
    docxTable([["버전", "변경일자", "제.개정 내용", "작성자"], ...Array.from({ length: 10 }, () => [" ", " ", " ", " "])], -1);

  // ── 꼬리말(좌: 고객사로고 · 중앙: 쪽번호 · 우: 우리회사로고) — 머리말에는 로고를 넣지 않음 ──
  // 표지(1페이지)는 titlePg로 꼬리말 미표시 — 첨부 양식과 동일
  const tabDefs = '<w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs>';
  const smallTxt = t => `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="808080"/></w:rPr><w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`;
  const pageFld = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const ftrLine = `<w:p><w:pPr>${tabDefs}<w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr><w:spacing w:before="0" w:after="0"/></w:pPr>${mkRun(cl, "rIdF1", 1, 216000) || smallTxt("고객사로고")}<w:r><w:tab/></w:r>${pageFld}<w:r><w:tab/></w:r>${mkRun(co, "rIdF2", 2, 216000) || smallTxt("우리회사로고")}</w:p>`;
  // 설정의 문서 꼬리말(보안·저작권 문구)을 쪽번호 줄 아래에 중앙 정렬로 추가
  const ftrNote = DOC_SETTINGS.docFooter
    ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>${smallTxt(DOC_SETTINGS.docFooter)}</w:p>` : "";
  const ftrXml = ftrLine + ftrNote;

  return {
    front: cover + infoTable + usage + history + pageBreak,
    pkgOpts: {
      media,
      bodyImages: [cl && { relId: "rIdImg1", fileName: cl.fileName }, co && { relId: "rIdImg2", fileName: co.fileName }].filter(Boolean),
      footer: { xml: ftrXml, images: [cl && { relId: "rIdF1", fileName: cl.fileName }, co && { relId: "rIdF2", fileName: co.fileName }].filter(Boolean) },
      titlePg: true,
    },
  };
}
function makeDocx({ title, metaRows, purpose, doc, catName, meta }) {
  // ── 신규 양식 (doc·meta 전달 시): 표지 → 문서정보표·사용권한·제.개정 이력 → 본문 ──
  if (doc && meta) {
    const { front, pkgOpts } = docxStdParts({ title, docCode: doc.code, phase: catName, meta });
    // 3페이지: 본문 스켈레톤
    const bodyPage =
      docxP("1. 목적", { bold: true, size: 26, spacingAfter: 160 }) +
      docxP(purpose || "(작성)") +
      docxP("2. 본문", { bold: true, size: 26, spacingAfter: 160 }) +
      docxP("(작성)");
    return docxPackage(front + bodyPage, pkgOpts);
  }

  // ── 구 양식 (호환): doc·meta 미전달 호출부 ──
  const body =
    docxP(title, { bold: true, size: 36, spacingAfter: 240 }) +
    docxTable(metaRows, 1) +
    docxP("1. 목적", { bold: true, size: 26, spacingAfter: 160 }) +
    docxP(purpose || "(작성)") +
    docxP("2. 본문", { bold: true, size: 26, spacingAfter: 160 }) +
    docxP("(작성)") +
    docxP("3. 문서 이력", { bold: true, size: 26, spacingAfter: 160 }) +
    docxTable([["버전", "일자", "작성자", "변경 내용"], ["V0.1", new Date().toLocaleDateString("ko-KR"), "", `최초 작성 (${APP_NAME} 자동 생성)`]], -1);
  return docxPackage(body);
}
// 본문(body XML) → docx 파일 바이트 (공통 패키징)
// opts: { media:[{fileName,bytes}], bodyImages:[{relId,fileName}], header:{xml,images}, footer:{xml,images}, titlePg }
// 하위 호환: opts 미전달 시 기존과 동일한 단순 문서 생성 (makePdpDocx 등)
function docxPackage(body, opts = {}) {
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const media = opts.media || [];
  const relXml = imgs => XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${(imgs || []).map(im => `<Relationship Id="${im.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.fileName}"/>`).join("")}</Relationships>`;
  const files = [];
  const overrides = ['<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'];
  const docRelsExtra = [];
  let sectExtra = "";
  if (opts.header) {
    files.push({ path: "word/header2.xml", content: XMLH + `<w:hdr ${NS}>${opts.header.xml}</w:hdr>` });
    files.push({ path: "word/_rels/header2.xml.rels", content: relXml(opts.header.images) });
    overrides.push('<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>');
    docRelsExtra.push('<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>');
    sectExtra += '<w:headerReference w:type="default" r:id="rIdHdr"/>';
  }
  if (opts.footer) {
    files.push({ path: "word/footer2.xml", content: XMLH + `<w:ftr ${NS}>${opts.footer.xml}</w:ftr>` });
    files.push({ path: "word/_rels/footer2.xml.rels", content: relXml(opts.footer.images) });
    overrides.push('<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
    docRelsExtra.push('<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>');
    sectExtra += '<w:footerReference w:type="default" r:id="rIdFtr"/>';
  }
  if (opts.titlePg && (opts.header || opts.footer)) {
    // 표지(첫 페이지)에는 머리말·꼬리말을 표시하지 않음 — 빈 first 파트로 대체
    files.push({ path: "word/header1.xml", content: XMLH + `<w:hdr ${NS}><w:p/></w:hdr>` });
    files.push({ path: "word/footer1.xml", content: XMLH + `<w:ftr ${NS}><w:p/></w:ftr>` });
    overrides.push('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>');
    overrides.push('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
    docRelsExtra.push('<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>');
    docRelsExtra.push('<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>');
    sectExtra += '<w:headerReference w:type="first" r:id="rIdHdr1"/><w:footerReference w:type="first" r:id="rIdFtr1"/><w:titlePg/>';
  }
  const documentXml = XMLH + `<w:document ${NS}><w:body>${body}<w:sectPr>${sectExtra}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="567" w:footer="567"/></w:sectPr></w:body></w:document>`;
  const docRels = XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${(opts.bodyImages || []).map(im => `<Relationship Id="${im.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.fileName}"/>`).join("")}${docRelsExtra.join("")}</Relationships>`;
  return zipBytes([
    { path: "[Content_Types].xml", content: XMLH + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>${overrides.join("")}</Types>` },
    { path: "_rels/.rels", content: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { path: "word/_rels/document.xml.rels", content: docRels },
    { path: "word/document.xml", content: documentXml },
    ...files,
    ...media.map(m => ({ path: `word/media/${m.fileName}`, content: m.bytes })),
  ]);
}

// ── 테일러링결과서(PDP) 실문서 — PDP 화면(StepPDP)과 동일한 구성의 docx ──
function makePdpDocx(meta, ctx, phase) {
  const ossp = ctx?.ossp || null;
  const sdlc = ctx?.sdlc || null;
  const tailoring = ctx?.tailoring || {};
  const pdp = ctx?.pdp || {};
  const guide = getGuideForOSSP(ossp);
  const scale = tailoring.scale || "중형";
  const method = tailoring.method || "UML";
  const excluded = tailoring.excluded || {};
  const notes = tailoring.notes || {};
  const scaleLabel = guide.scaleOptions?.find(o => o.value === scale)?.label || scale;
  const list = classifyDeliverables(scale, method, guide, tailoring?.aspiceScope);
  const isApplied = (d) => {
    if (d.required) return true;
    const ov = notes[`${d.phase}:${d.code}`]?.applied;
    return ov !== undefined ? ov : !excluded[d.code];
  };
  const appliedCount = list.filter(isApplied).length;
  const grouped = {};
  list.forEach(d => { (grouped[d.phase] = grouped[d.phase] || []).push(d); });
  const docNo = projectDocNo(meta, "PDP");
  const today = new Date().toLocaleDateString("ko-KR");
  const ap = docApprovers(meta);   // 설정의 작성/검토/승인자·작성조직

  const procState = tailoring.process || {};
  const procLevel = guide?.mgmtActivities ? mgmtLevelLabel(tailoring, guide) : (procState.level || "L3");
  const procApplicable = resolveMgmt(tailoring, guide, procState).filter(r => r.status !== "해당없음");
  const procByArea = {};
  procApplicable.forEach(r => { (procByArea[r.area] = procByArea[r.area] || []).push(r); });

  // 3. 산출물 테일러링 매트릭스 (화면과 동일 컬럼)
  const delivRows = [["단계", "코드", "산출물", "구분", "적용 여부", "변경 여부", "테일러링 내역 및 사유"]];
  (guide.phaseOrder || Object.keys(grouped)).filter(ph => grouped[ph]?.length).forEach(ph => {
    grouped[ph].forEach((d, i) => {
      const n = notes[`${d.phase}:${d.code}`] || {};
      const on = isApplied(d);
      delivRows.push([
        i === 0 ? ph : "", d.code, d.name + (d.note ? ` (${d.note})` : ""),
        d.required ? "필수" : "선택",
        d.required ? "적용(고정)" : (on ? "적용" : "미적용"),
        d.required ? "—" : (n.changed ? "변경" : "—"),
        d.required ? "—" : (n.reason || ""),
      ]);
    });
  });

  // 4. 프로세스 테일러링 내역서 (화면과 동일 컬럼)
  const procRows = [["프로세스 영역", "세부 프로세스", "구분", "적용 여부", "변경 여부", "테일러링 내역 및 사유"]];
  Object.keys(procByArea).forEach(area => {
    procByArea[area].forEach((r, i) => {
      const req = r.mark === "●";
      procRows.push([
        i === 0 ? area : "",
        (r.activity ? `${r.process} › ${r.activity}` : r.process) + (r.outputs ? ` — 산출물: ${r.outputs}` : ""),
        req ? "필수" : "선택",
        req ? "적용(고정)" : (r.applied ? "적용" : "미적용"),
        req ? "—" : (r.applied && r.changed ? "변경" : "—"),
        req || r.status === "적용" ? "—" : (r.reason || ""),
      ]);
    });
  });

  const objectives = pdp.overview?.objectives || [];
  // 회사 표준양식 프레임(표지·문서정보표·사용권한·제.개정 이력·꼬리말) — 로고 임베드 포함
  const { front, pkgOpts } = docxStdParts({ title: "테일러링결과서", docCode: docNo, phase: phase || "프로젝트 계획수립", meta });
  const body =
    docxP("프로젝트 정의 프로세스 (PDP)", { bold: true, size: 36, spacingAfter: 60 }) +
    docxP("테일러링결과서 · Tailoring Result", { size: 22, spacingAfter: 60 }) +
    docxP(meta.name || "", { bold: true, size: 26, spacingAfter: 240 }) +
    docxTable([
      ["문서번호", docNo], ["버전", "V1.0"],
      ["고객사", meta.client || "-"], ["작성일", today],
      ["기준 OSSP", ossp?.label || "-"], ["SDLC", sdlc?.label || "-"],
      ["작성자", ap.author || "-"], ["검토·승인", [ap.reviewer, ap.approver].filter(Boolean).join(" / ") || "-"],
      ...(ap.org || ap.distribution ? [["작성조직", ap.org || "-"], ["배포구분", ap.distribution || "-"]] : []),
    ], 1) +
    docxP("1. 프로젝트 개요", { bold: true, size: 26, spacingAfter: 160 }) +
    docxP(pdp.overview?.purpose || "(미작성 — PDP 단계에서 생성)") +
    (pdp.overview?.scope ? docxP("범위: " + pdp.overview.scope) : "") +
    objectives.map(o => docxP("▸ " + o, { spacingAfter: 60 })).join("") +
    docxP("2. 테일러링 기준", { bold: true, size: 26, spacingAfter: 160 }) +
    docxTable([
      ["적용 가이드", guide.title || "-"],
      [guide.scaleTitle || "프로젝트 규모", scaleLabel],
      ...(guide.hideDesignMethod ? [] : [["설계방식", guide.hasDesignMethod ? method : "해당 없음"]]),
      [guide.criteriaTitle || "규모 판정 기준", (guide.sizeNote || "").replace(/^※\s*/, "")],
    ], 1) +
    docxP(`3. 개발산출물 테일러링 매트릭스 (전체 ${list.length}건 · 적용 ${appliedCount}건)`, { bold: true, size: 26, spacingAfter: 160 }) +
    docxP("※ 필수(M) 산출물은 항상 적용되며 수정할 수 없습니다. 선택(O) 산출물은 테일러링 결과에 따라 적용 여부·변경 여부·사유를 기록합니다.", { size: 18, spacingAfter: 100 }) +
    docxTable(delivRows, -1) +
    docxP(`4. 관리활동 테일러링 내역서 (${guide?.mgmtActivities ? "ASPICE 관리활동 · 목표 능력수준" : "관리 성숙도 수준"} ${procLevel} · 적용대상 ${procApplicable.length}건)`, { bold: true, size: 26, spacingAfter: 160 }) +
    docxP("※ 필수(●) 프로세스는 항상 적용되며 수정할 수 없습니다.", { size: 18, spacingAfter: 100 }) +
    docxTable(procRows, -1);
  return docxPackage(front + body, pkgOpts);
}

// ── 요구사항 정의서·명세서 (AI 자동 작성 — 정보공학 방법론 RD1200·RD1300) ──────
// 산출물명 → 요구사항 문서 종류: "def"(정의서) | "spec"(명세서) | "both"(정의서·명세서 통합) | null
function reqDocKind(name) {
  // 산출물명의 '/'는 경로가 아니라 병기 구분자(예: "요구사항 정의서/명세서")이므로
  // normDocName의 경로 분리에 걸리지 않게 치환 후 정규화
  const n = normDocName(String(name || "").replace(/\//g, "·"));
  if (!n.includes("요구사항")) return null;
  if (/검증|시험|테스트/.test(n)) return null;   // "HW 요구사항 검증 명세서" 등 검증 문서는 요구사항 문서가 아님
  const hasDef = n.includes("정의서");
  const hasSpec = n.includes("명세서");
  if (hasDef && hasSpec) return "both";
  if (hasDef) return "def";
  if (hasSpec) return "spec";
  return null;
}
// ASPICE 과제 여부 (산출물 생성 컨텍스트 기준)
const isAspiceCtx = ctx => ctx?.ossp?.guideId === "aspice" || getGuideForOSSP(ctx?.ossp || {})?.id === "aspice";
// 컨텍스트를 고려한 요구사항 문서 판정 — ASPICE의 SW·HW 요구사항 명세서(SWE.1·HWE.1)는 V-모델 하위 요구로만 만든다.
// (확정 요구는 SYS.2 시스템 요구이므로 하위 레벨 명세서에 채우면 레벨이 섞인다)
function reqDocKindFor(name, ctx) {
  const k = reqDocKind(name);
  if (!k || !isAspiceCtx(ctx)) return k;
  const ak = AE.aspiceDocKind(name);
  return ak && ak !== "SYS_RS" ? null : k;
}
const REQ_TYPE_PREFIX = { "기능": "RF", "비기능": "RN", "인터페이스": "RI" };
// 유형별 접두(RF/RN/RI) + 4자리 순번 ID 부여 — 기존 ID는 유지하고 빈 항목만 이어서 채번
// ── 요구사항 ID 불변성: 한 번 발급·확정된 ID는 다른 요구에 다시 쓰지 않는다 ──
// requirements.idRegistry = { max: { RF: n, RN: n, ... }, retired: [폐기된 ID] } — 프로젝트 JSON에 보관(스키마 변경 없음)
function reqIdBump(floor, id) {
  const m = /^([A-Z]{2,3})-?(\d{4})$/.exec(String(id || ""));
  if (m) floor[m[1]] = Math.max(floor[m[1]] || 0, Number(m[2]));
}
// 이해관계자 요구(STK) ID 채번 — STK-0001 형식, 레지스트리 기준(폐기 번호 재사용 금지)
function assignStkIds(items, floor = {}) {
  let n = floor.STK || 0;
  items.forEach(it => { const m = /^STK-?(\d{4})$/.exec(String(it.id || "")); if (m) n = Math.max(n, Number(m[1])); });
  return items.map(it => it.id ? it : { ...it, id: `STK-${String(++n).padStart(4, "0")}` });
}
// WhyBox — 기능이 왜 이렇게 동작하는지 사용자용 짧은 설명 (접기/펼치기)
function WhyBox({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border:`1px solid ${T.accent}44`, background:T.accent+"0A", borderRadius:8, padding:"7px 10px", marginBottom:10, fontSize:11.5 }}>
      <div onClick={() => setOpen(v => !v)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
        <span style={{ color:T.accent, fontWeight:700 }}>💡 {title}</span><span style={{ flex:1 }} /><span style={{ color:T.muted, fontSize:10.5 }}>{open ? "접기 ▲" : "왜 이렇게 하나요? ▼"}</span>
      </div>
      {open && <div style={{ marginTop:6, color:T.text, lineHeight:1.6 }}>{children}</div>}
    </div>
  );
}
function reqIdFloor(reqs, extraIds = []) {
  const floor = { ...((reqs?.idRegistry || {}).max || {}) };
  (reqs?.items || []).forEach(it => reqIdBump(floor, it.id));
  ((reqs?.idRegistry || {}).retired || []).forEach(id => reqIdBump(floor, id));
  (extraIds || []).forEach(id => reqIdBump(floor, id));
  return floor;
}
// 확정 시 레지스트리 갱신: 이전 확정본에 있었는데 사라진 ID는 폐기(retired) 처리
function nextIdRegistry(prevReqs, newItems) {
  const newIds = new Set((newItems || []).map(i => i.id).filter(Boolean));
  const retired = [...new Set([...(((prevReqs?.idRegistry || {}).retired) || []), ...(prevReqs?.items || []).map(i => i.id)])].filter(id => id && !newIds.has(id));
  return { max: reqIdFloor(prevReqs, [...newIds]), retired };
}
// AI 재생성 결과를 기존 요구와 매칭해 같은 요구면 기존 ID를 이어받는다 (ReqIF 재반입과 같은 처리).
// 1차: 정규화한 요구사항명 일치 → 2차: 요구사항명 유사도(문자 bigram Dice) + 출처 일치 가점. 각 기존 ID는 한 번만 사용.
function matchPrevReqIds(list, prevItems) {
  const norm = s => String(s || "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  const grams = s => { const g = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; };
  const dice = (a, b) => {
    if (!a || !b) return 0; if (a === b) return 1;
    const A = grams(a), B = grams(b); let inter = 0, na = 0, nb = 0;
    A.forEach((v, k) => { na += v; inter += Math.min(v, B.get(k) || 0); }); B.forEach(v => { nb += v; });
    return na + nb ? (2 * inter) / (na + nb) : 0;
  };
  const prev = (prevItems || []).filter(p => p && p.id && String(p.name || "").trim());
  const used = new Set(), out = list.map(it => ({ ...it, id: "" }));
  out.forEach(it => {
    const n = norm(it.name);
    const hit = prev.find(p => !used.has(p.id) && norm(p.name) === n);
    if (hit) { it.id = hit.id; used.add(hit.id); }
  });
  const cands = [];
  out.forEach((it, i) => {
    if (it.id) return;
    prev.forEach(p => {
      if (used.has(p.id)) return;
      const sc = dice(norm(it.name), norm(p.name)) + (String(it.source || "").trim() && String(it.source).trim() === String(p.source || "").trim() ? 0.15 : 0);
      if (sc >= 0.6) cands.push({ i, id: p.id, sc });
    });
  });
  cands.sort((a, b) => b.sc - a.sc).forEach(c => { if (!out[c.i].id && !used.has(c.id)) { out[c.i].id = c.id; used.add(c.id); } });
  return { list: out, kept: used.size, missing: prev.filter(p => !used.has(p.id)).map(p => p.id) };
}
function assignReqIds(items, floor = {}) {
  const maxN = { ...(floor || {}) };
  items.forEach(it => { const m = /^([A-Z]{2})(\d{4})$/.exec(String(it.id || "")); if (m) maxN[m[1]] = Math.max(maxN[m[1]] || 0, Number(m[2])); });
  return items.map(it => {
    if (it.id) return it;
    const p = REQ_TYPE_PREFIX[it.type] || "RQ";
    maxN[p] = (maxN[p] || 0) + 1;
    return { ...it, id: p + String(maxN[p]).padStart(4, "0") };
  });
}
// WBS에서 요구사항 명세서(spec/both)를 산출물로 가진 '진짜 최하위' Task 목록 — 요구사항 배정 후보(기능 모듈)
function reqSpecLeaves(wbs) {
  const rows = [];
  (wbs?.tasks || []).forEach(t => (t.subtasks || []).forEach(s => rows.push({ ...s, _mgmt: !!t.mgmt })));
  const codes = rows.map(s => String(s.wbsCode || ""));
  return rows.filter(s => {
    const k = reqDocKind(s.deliverable || "");
    if (k !== "spec" && k !== "both") return false;
    // 기능 모듈이 아닌 행 제외:
    //  ① 관리활동 작업(예: "요구사항 도출 및 명세화")
    //  ② 구성요소 분해 없이 "공통"으로 만든 문서 작성 작업(level 2, 예: "시스템 요구사항 명세서 작성")
    if (s._mgmt) return false;
    if (Number(s.level) > 0 && Number(s.level) <= 2) return false;
    const c = String(s.wbsCode || "");
    if (!c) return false;
    return !codes.some(o => o !== c && o.startsWith(c + "."));   // 하위 행이 없으면 최하위
  }).map(s => ({ wbsNo: String(s.wbsCode), name: String(s.task || "").trim() }));
}

// ── 요구사항 → WBS 모듈 규칙 기반 배정 (AI 미사용 우선) ──────────────
// 판정 순서: ① 비기능·인터페이스 → "공통"  ② 기능 → 모듈명 2문자 n-gram이 요구사항명·개요에
// 몇 개 등장하는지로 점수화하여 최고점 모듈  ③ 점수 미달(단서 없음) → null 반환(AI 폴백 대상)
// 한국어 복합어 대응: "견적작성" → [견적,적작,작성] 분해 후 "견적을 작성" 같은 문장과도 매칭
const ASSIGN_GENERIC_GRAMS = new Set(["관리","조회","등록","수정","삭제","화면","시스템","정보","처리","기능","목록","출력"]);
function moduleNameGrams(name) {
  const n = String(name || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
  const grams = new Set();
  for (let i = 0; i + 2 <= n.length; i++) grams.add(n.slice(i, i + 2));
  return { norm: n, grams: [...grams] };
}
function ruleAssignModule(item, leaves) {
  if (item.type !== "기능") return "공통";   // 비기능·인터페이스는 전사 공통
  const text = `${item.name || ""} ${item.summary || ""}`.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
  let best = null, bestScore = 0;
  for (const l of leaves) {
    const { norm, grams } = moduleNameGrams(l.name);
    if (!norm) continue;
    let score = 0;
    for (const g of grams) if (text.includes(g)) score += ASSIGN_GENERIC_GRAMS.has(g) ? 0.5 : 1;   // 범용어는 반가중
    if (norm.length >= 3 && text.includes(norm)) score += 3;   // 모듈명 전체 포함 시 강한 가점
    // 핵심어 가점: "통계관리"→"통계"처럼 범용 접미어를 제거한 핵심어가 텍스트에 있으면 배정 확신 상승
    let core = norm;
    for (const suf of ["관리", "조회", "화면", "기능", "시스템", "정보", "처리", "목록"]) {
      if (core.length > suf.length + 1 && core.endsWith(suf)) { core = core.slice(0, -suf.length); break; }
    }
    if (core !== norm && core.length >= 2 && !ASSIGN_GENERIC_GRAMS.has(core) && text.includes(core)) score += 2;
    if (score > bestScore) { bestScore = score; best = l.wbsNo; }
  }
  return bestScore >= 2 ? best : null;   // 고유 단서 2개 미만이면 규칙 배정 보류 → AI 폴백
}
// docx 바이트 → 평문 텍스트 (요구사항 원문 파일 업로드용)
async function docxBytesToText(bytes) {
  const files = await unzipBytes(bytes);
  const f = files.find(x => x.path === "word/document.xml");
  if (!f) return "";
  const td = new TextDecoder();
  let x = typeof f.content === "string" ? f.content : td.decode(f.content);
  x = x.replace(/<w:tab[^>]*\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "");
  return x.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d)).trim();
}
// xlsx 바이트 → 평문 텍스트 (요구사항 원문 파일 업로드용) — 시트별 셀 값을 탭/줄바꿈으로 이어붙임
async function xlsxBytesToText(bytes) {
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const read = p => { const f = files.find(x => x.path === p); return f ? (typeof f.content === "string" ? f.content : td.decode(f.content)) : ""; };
  const unesc = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
  // 공유 문자열 테이블 (t="s" 셀이 참조)
  const sst = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const out = [];
  files.filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f.path)).forEach(f => {
    const xml = typeof f.content === "string" ? f.content : td.decode(f.content);
    [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].forEach(rm => {
      const vals = [...rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(cm => {
        const attrs = cm[1], inner = cm[2];
        if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); return v ? (sst[Number(v[1])] || "") : ""; }
        if (/t="inlineStr"/.test(attrs)) return unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        return v ? unesc(v[1]) : "";
      }).filter(v => String(v).trim() !== "");
      if (vals.length) out.push(vals.join("\t"));
    });
  });
  return out.join("\n").trim();
}
// 확정된 요구사항 → 정의서/명세서/통합 docx (회사 표준 프레임 + 로고)
function makeReqDocx(meta, ctx, phase, kind, doc) {
  const req = ctx?.requirements || {};
  const items = req.items || [];
  // 모듈 분권: 문서의 WBS 번호가 배정 체계(specLeaves) 트리에 속하면 해당 모듈 배정분 + 공통만 담는다
  const docWbs = String(doc?.wbsNo || "");
  const under = (child, parent) => child === parent || child.startsWith(parent + ".");
  const leaves = (req.specLeaves || []).filter(l => String(l.wbsNo || "").split(".").length >= 3);
  const leafName = {}; leaves.forEach(l => { leafName[l.wbsNo] = l.name; });
  const isCommon = it => !it.wbsNo || it.wbsNo === "공통";
  const inTree = kind !== "def" && docWbs.split(".").length >= 3 && leaves.some(l => under(l.wbsNo, docWbs) || under(docWbs, l.wbsNo));
  const moduleItems = inTree ? items.filter(it => !isCommon(it) && under(String(it.wbsNo), docWbs)) : [];
  const commonItems = inTree ? items.filter(isCommon) : [];
  const docCode = doc?.aspice && doc?.code ? doc.code : kind === "spec" ? "RD1301" : kind === "def" ? "RD1202" : "RD1202·RD1301";
  const docNo = projectDocNo(meta, docCode);
  const today = new Date().toLocaleDateString("ko-KR");
  const ap = docApprovers(meta);   // 설정의 작성/검토/승인자
  const title = doc?.aspice && doc?.name ? doc.name : kind === "def" ? "요구사항 정의서" : kind === "spec" ? "요구사항 명세서" : "요구사항 정의서·명세서";
  const cnt = t => items.filter(i => i.type === t).length;
  const { front, pkgOpts } = docxStdParts({ title, docCode: docNo, phase: phase || "요구정의", meta });
  let body =
    docxP(title, { bold: true, size: 36, spacingAfter: 60 }) +
    docxP(meta.name || "", { bold: true, size: 26, spacingAfter: 240 }) +
    docxTable([
      ["문서번호", docNo], ["버전", "V1.0"],
      ["고객사", meta.client || "-"], ["작성일", today],
      ["작성자", ap.author || "-"], ["검토·승인", [ap.reviewer, ap.approver].filter(Boolean).join(" / ") || "-"],
      ["요구사항 합계", inTree
        ? `모듈 ${moduleItems.length}건 + 공통 ${commonItems.length}건 (전체 ${items.length}건 중)`
        : `${items.length}건 (기능 ${cnt("기능")} · 비기능 ${cnt("비기능")} · 인터페이스 ${cnt("인터페이스")})`],
      ["요구사항 출처", req.sourceName || "이해관계자 요구사항 입력"],
      ...(inTree ? [["대상 기능", `${doc?.taskName || leafName[docWbs] || ""} (${docWbs})`.trim()]] : []),
    ], 1);
  let sec = 0;
  if (kind !== "spec") {
    const rows = [["No", "ID", "유형", "요구사항명", "기능 모듈", "출처", "우선순위", "개요"]];
    items.forEach((it, i) => rows.push([String(i + 1), it.id || "", it.type || "", it.name || "",
      isCommon(it) ? "공통" : `${it.wbsNo}${leafName[it.wbsNo] ? " " + leafName[it.wbsNo] : ""}`,
      it.source || "-", it.priority || "중", it.summary || ""]));
    body += docxP(`${++sec}. 요구사항 정의 (RD1200)`, { bold: true, size: 26, spacingAfter: 160 }) +
      docxP("※ 정보공학 방법론 요구정의 단계 기준 — 기능·비기능·인터페이스 요구사항을 도출하고 추적 가능한 요구사항 ID를 부여하여 정리한다.", { size: 18, spacingAfter: 100 }) +
      docxTable(rows, -1);
  }
  if (kind !== "def") {
    const specNote = req.qualityStd && req.qualityStd !== "ISO 9126" ? `※ 요구사항별로 구현 가능성·테스트 가능성·우선순위를 고려해 구체화하며, 비기능 요구사항은 ${req.qualityStd} 품질특성을 기준으로 기술한다.` : "※ 요구사항별로 구현 가능성·테스트 가능성·우선순위를 고려해 구체화하며, 비기능 요구사항은 ISO 9126 품질특성(기능성·신뢰성·사용성·효율성·유지보수성·이식성)을 기준으로 기술한다.";
    const specBlock = it => docxP(`${it.id || ""} · ${it.name || ""}`, { bold: true, size: 22, spacingAfter: 80 }) +
      docxTable([
        ["유형", (it.type || "") + (it.type === "비기능" && it.quality ? ` (${it.quality})` : "")],
        ["우선순위", it.priority || "중"], ["출처", it.source || "-"],
        ["상세 설명", it.detail || it.summary || ""],
        ...(it.type === "기능" && it.actors ? [["관련 액터", it.actors]] : []),
        ...(it.type === "기능" && it.basicFlow ? [["기본 흐름", it.basicFlow]] : []),
        ...(it.type === "기능" && it.subFlow ? [["서브 흐름", it.subFlow]] : []),
        ...(it.type === "기능" && it.exceptionFlow ? [["예외 흐름", it.exceptionFlow]] : []),
        ...(it.type === "기능" && it.precondition ? [["사전 조건", it.precondition]] : []),
        ...(it.type === "기능" && it.postcondition ? [["사후 조건", it.postcondition]] : []),
        ["인수 기준", it.acceptance || ""],
        ["가정·제약", it.assumptions || "-"],
      ], 1);
    if (inTree) {
      // 모듈별 명세서: (1) 해당 모듈 배정분, (2) 공통 요구사항(모든 모듈 명세서에 포함)
      body += docxP(`${++sec}. 모듈 요구사항 명세 (RD1300) — ${doc?.taskName || leafName[docWbs] || docWbs}`, { bold: true, size: 26, spacingAfter: 160 }) +
        docxP(specNote, { size: 18, spacingAfter: 100 });
      if (moduleItems.length) moduleItems.forEach(it => { body += specBlock(it); });
      else body += docxP("(이 모듈에 배정된 개별 요구사항이 없습니다 — 아래 공통 요구사항을 적용합니다.)", { size: 20, spacingAfter: 120 });
      body += docxP(`${++sec}. 공통 요구사항`, { bold: true, size: 26, spacingAfter: 160 }) +
        docxP("※ 특정 기능 모듈에 귀속되지 않는 전사 공통·비기능 요구사항으로, 본 모듈의 설계·구현·검증 시 항상 적용된다.", { size: 18, spacingAfter: 100 });
      if (commonItems.length) commonItems.forEach(it => { body += specBlock(it); });
      else body += docxP("(공통 요구사항 없음)", { size: 20, spacingAfter: 120 });
    } else {
      body += docxP(`${++sec}. 요구사항 명세 (RD1300)`, { bold: true, size: 26, spacingAfter: 160 }) +
        docxP(specNote, { size: 18, spacingAfter: 100 });
      items.forEach(it => { body += specBlock(it); });
    }
  }
  return docxPackage(front + body, pkgOpts);
}
// 요구사항 추적 매트릭스(xlsx 템플릿)의 '추적매트릭스(양식)' 시트에 확정 요구사항을 채움
// 1행(헤더)은 유지, 기존 예시 행은 제거하고 요구사항ID·명·출처·상태·우선순위(A~E열)를 기록
async function injectRequirementsIntoRtmXlsx(bytes, req) {
  const items = req?.items;
  if (!items?.length) return null;
  const leafName = {}; (req?.specLeaves || []).forEach(l => { leafName[l.wbsNo] = l.name; });
  const moduleOf = it => (!it.wbsNo || it.wbsNo === "공통") ? "공통" : `${it.wbsNo}${leafName[it.wbsNo] ? " " + leafName[it.wbsNo] : ""}`;
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  const wbF = byPath["xl/workbook.xml"];
  if (!wbF) return null;
  const wbXml = typeof wbF.content === "string" ? wbF.content : td.decode(wbF.content);
  const relF = byPath["xl/_rels/workbook.xml.rels"];
  const relXml = relF ? (typeof relF.content === "string" ? relF.content : td.decode(relF.content)) : "";
  const relMap = {};
  [...relXml.matchAll(/<Relationship\b[^>]*>/g)].forEach(m => {
    const id = /Id="([^"]+)"/.exec(m[0]); const tg = /Target="([^"]+)"/.exec(m[0]);
    if (id && tg) relMap[id[1]] = tg[1];
  });
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => ({
    name: /name="([^"]+)"/.exec(m[0])?.[1] || "",
    rid: /r:id="([^"]+)"/.exec(m[0])?.[1] || "",
  }));
  const cand = sheets.filter(s => /추적/.test(s.name) && /매트릭스|matrix/i.test(s.name));
  const target = cand.find(s => /양식/.test(s.name)) || cand[0];
  if (!target || !relMap[target.rid]) return null;
  const path = "xl/" + relMap[target.rid].replace(/^\//, "").replace(/^xl\//, "");
  const shF = byPath[path];
  if (!shF) return null;
  let xml = typeof shF.content === "string" ? shF.content : td.decode(shF.content);
  const sd = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml);
  if (!sd) return null;
  const rowsXml = [...sd[1].matchAll(/<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)].map(m => m[0]);
  if (!rowsXml.length) return null;
  const header = rowsXml[0];   // 1행 = 컬럼 헤더 유지
  const base = Number(/r="(\d+)"/.exec(header)?.[1] || 1) + 1;
  // 기존 첫 데이터 행의 셀 스타일을 컬럼별로 재사용해 표 서식(테두리 등) 유지
  const styleByCol = {};
  if (rowsXml[1]) [...rowsXml[1].matchAll(/<c\b[^>]*>/g)].forEach(m => {
    const rAttr = /r="([A-Z]+)\d+"/.exec(m[0]); const sAttr = /s="(\d+)"/.exec(m[0]);
    if (rAttr && sAttr) styleByCol[rAttr[1]] = sAttr[1];
  });
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cols = ["A", "B", "C", "D", "E", "N"];   // N열(비고) = 배정 기능 모듈
  const newRows = items.map((it, i) => {
    const r = base + i;
    const vals = [it.id || "", it.name || "", it.source || "", "신규", it.priority || "", moduleOf(it)];
    const cells = vals.map((v, ci) => {
      const s = styleByCol[cols[ci]] ? ` s="${styleByCol[cols[ci]]}"` : "";
      return `<c r="${cols[ci]}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join("");
    return `<row r="${r}">${cells}</row>`;
  }).join("");
  xml = xml.replace(sd[0], `<sheetData>${header}${newRows}</sheetData>`);
  shF.content = xml;
  return zipBytes(files);
}

// ── OSSP 템플릿 기반 요구사항 문서 생성 ──────────────────────────
// 확정 요구사항을 OSSP 라이브러리의 실제 산출물템플릿에 채워 표준 양식 그대로 생성한다.
// 정의서(RD1202)=xlsx 템플릿, 명세서(RD1301)=docx 템플릿. 작성가이드·작성예 시트/표는 그대로 유지.

// XML 텍스트 노드(<t>·<w:t>) 내부만 대상으로 placeholder 치환 — 태그·속성은 건드리지 않음
// xlsx 공유문자열(<si>)의 run 분할 대응 치환.
// Excel은 서식이 다르거나 편집 이력이 있으면 한 셀의 텍스트를 여러 <r><t>로 쪼갠다.
//   예) <si><r><t>문서 번호 : </t></r><r><t>ie.f.RD</t></r><r><t>1202</t></r></si>
// 이 경우 <t> 단위 치환으로는 "ie.f.RD1202"·"{프로젝트 명}"을 찾을 수 없으므로,
// <si> 전체 텍스트를 합쳐 판단하고, 치환이 일어난 항목만 첫 run의 서식을 유지한 단일 run으로 재구성한다.
function xlsxSiReplaceAll(xml, pairs, extraPairsFor) {
  return xml.replace(/<si>[\s\S]*?<\/si>/g, si => {
    const txt = [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => m[1]).join("");
    if (!txt) return si;
    const all = extraPairsFor ? [...pairs, ...extraPairsFor(txt)] : pairs;
    let out = txt, hit = false;
    all.forEach(([f, t]) => { if (out.includes(f)) { out = out.split(f).join(t); hit = true; } });
    if (!hit) return si;
    const rPr = /<rPr>[\s\S]*?<\/rPr>/.exec(si)?.[0] || "";
    return `<si><r>${rPr}<t xml:space="preserve">${out}</t></r></si>`;
  });
}
function xmlTextReplaceAll(xml, pairs) {
  return xml.replace(/(<(?:w:t|t)\b[^>]*>)([^<]*)(<\/(?:w:t|t)>)/g, (m, a, txt, b) => {
    let t = txt;
    pairs.forEach(([from, to]) => { t = t.split(from).join(to); });
    return a + t + b;
  });
}
// docx 문단 단위 placeholder 치환 — placeholder가 여러 run(<w:r>)으로 쪼개져 있어도 문단 전체 텍스트를 합쳐 치환.
// 치환이 발생한 문단만 첫 run의 서식(pPr·rPr)을 유지한 단일 run으로 재구성한다.
function docxReplacePlaceholders(xml, pairs, extraPairsFor) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, p => {
    const txt = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("");
    // 문서코드는 run 분할로 "ie.f.RD"+"1301"처럼 쪼개질 수 있어, 합쳐진 문단 텍스트에서 다시 찾는다
    const all = extraPairsFor ? [...pairs, ...extraPairsFor(txt)] : pairs;
    let replaced = txt, hit = false;
    all.forEach(([f, t]) => { if (replaced.includes(f)) { replaced = replaced.split(f).join(t); hit = true; } });
    if (!hit) return p;
    const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p)?.[0] || "";
    const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(p)?.[0] || "";
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${replaced}</w:t></w:r></w:p>`;
  });
}
// 표지·문서정보표 등 공통 placeholder 치환 쌍
//
// ── 결재란(서명란)은 채우지 않는다 ─────────────────────────────────
// "작성자: ___ 일자: ___", "검토자:", "승인자:" 로 이어지는 서명 블록은 실제 검토·승인
// 행위의 증적이므로 자동 기입하지 않는다. 자필 서명·날인으로 남겨 둔다.
// 아래 사전이 채우는 것은 문서 식별 정보(표지·머리글 문서정보표)에 한정된다.
//
// 값 우선순위는 docMetaValue()를 따른다: 위저드 입력 → 저장된 프로젝트 → 조직 설정 기본값.
function reqTplPlaceholderPairs(meta, docNo) {
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const today = new Date().toISOString().slice(0, 10);
  const todayKo = new Date().toLocaleDateString("ko-KR");
  const name = esc(meta?.name || "");
  const sysName = esc(systemNameOf(meta));
  const client = esc(meta?.client || "");
  const author = esc(docMetaValue(meta, "author") || meta?.pm || "");
  const reviewer = esc(docMetaValue(meta, "reviewer") || "");
  const approver = esc(docMetaValue(meta, "approver") || "");
  const org = esc(docMetaValue(meta, "orgName") || "");
  const dept = esc(docMetaValue(meta, "dept") || "");
  const distribution = esc(docMetaValue(meta, "distribution") || "");
  const pm = esc(meta?.pm || "");
  const no = esc(docNo || "");

  // {○○명}·{○○ 명} 두 표기를 모두 등록 (템플릿마다 "명" 앞 공백 유무가 다름).
  // 공백 변형은 "명"으로 끝나는 라벨에만 적용한다 — 그 외에는 {배포구 분} 같은 잘못된 토큰이 생긴다.
  const tok = (labels, value) => labels.flatMap(l =>
    /명$/.test(l) ? [[`{${l}}`, value], [`{${l.slice(0, -1)} 명}`, value]] : [[`{${l}}`, value]]);
  const pairs = [
    ...tok(["프로젝트명"], name), ...tok(["시스템명"], sysName), ...tok(["과제명"], name),
    ...tok(["고객사명", "발주처명"], client),
    ...tok(["작성자명"], author), ...tok(["PM명", "관리자명"], pm),
    ...tok(["검토자명"], reviewer), ...tok(["승인자명"], approver),
    ...tok(["조직명", "수행사명", "회사명"], org), ...tok(["부서명"], dept),
    ...tok(["배포구분"], distribution),
    ["{프로젝트}", name], ["{시스템}", sysName], ["{고객사}", client], ["{발주처}", client],
    ["{작성자}", author], ["{검토자}", reviewer], ["{승인자}", approver],
    ["{작성일}", today], ["{작성일자}", today], ["{YYYY-MM-DD}", today], ["YYYY-MM-DD", today],
    ["{YYYY.MM.DD}", todayKo], ["{버전}", "1.0"],
    ["Version X.X", "Version 1.0"], ["X.X", "1.0"],
  ];
  if (no) pairs.push(["{문서번호}", no], ["{문서 번호}", no]);
  // 빈 값으로 치환하면 라벨만 남아 오히려 나빠지므로 값이 있는 항목만 적용하고, 중복 토큰은 제거
  const seen = new Set();
  return pairs.filter(([k, v]) => {
    if (String(v).trim() === "" || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// 개정이력 시트의 예시행 정리 — 템플릿에 박혀 있는 더미 작성자·날짜를 프로젝트 값으로 교체한다.
//   예) 1.0 / 최초작성 / 홍길동 / 2025/09/01  →  V0.1 / 최초작성 / (작성자) / (오늘)
// 오탐을 막기 위해 (1) 시트명이 개정이력 계열이고 (2) 셀 값이 알려진 예시값과 정확히 일치할 때만 바꾼다.
const REV_DUMMY_NAMES = ["홍길동", "김철수", "이순신"];
function resetXlsxRevisionHistory(files, meta) {
  const td = new TextDecoder();
  const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  const getX = p => { const f = byPath[p]; return f ? (typeof f.content === "string" ? f.content : td.decode(f.content)) : null; };
  const wbXml = getX("xl/workbook.xml"); if (!wbXml) return false;
  const relXml = getX("xl/_rels/workbook.xml.rels") || "";
  const relMap = {};
  [...relXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
    .forEach(m => { relMap[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\.\//, ""); });
  // 개정이력 계열 시트만 대상
  const targets = [...wbXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
    .filter(m => /개정\s*이력|개정이력|revision/i.test(m[1]))
    .map(m => "xl/" + (relMap[m[2]] || "")).filter(p => byPath[p]);
  if (!targets.length) return false;

  const author = docMetaValue(meta, "author") || meta?.pm || "";
  const today = new Date().toISOString().slice(0, 10);
  // sharedStrings 인덱스 → 새 값 (셀이 t="s"로 공유문자열을 참조하는 경우가 많음)
  const ssXml = getX("xl/sharedStrings.xml");
  const pairs = [];
  REV_DUMMY_NAMES.forEach(n => { if (author) pairs.push([n, author]); });
  pairs.push([/^20\d{2}[-/.]\d{2}[-/.]\d{2}$/, today]);   // 예시 날짜 → 오늘

  let changed = false;
  const swap = txt => {
    const t = String(txt).trim();
    for (const [from, to] of pairs) {
      if (from instanceof RegExp ? from.test(t) : t === from) return to;
    }
    return null;
  };
  // 공유문자열은 다른 시트와 공유되므로 건드리지 않고, 대상 시트의 셀만 인라인 문자열로 덮어쓴다
  const sst = ssXml ? [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")) : [];
  targets.forEach(path => {
    const f = byPath[path];
    const xml = typeof f.content === "string" ? f.content : td.decode(f.content);
    const out = xml.replace(/<c\b([^>]*)>([\s\S]*?)<\/c>/g, (m, attrs, inner) => {
      let cur = null;
      if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); if (v) cur = sst[Number(v[1])]; }
      else if (/t="inlineStr"/.test(attrs)) { cur = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""); }
      if (cur == null) return m;
      const next = swap(cur);
      if (next == null) return m;
      changed = true;
      const cleanAttrs = attrs.replace(/\st="[^"]*"/g, "");
      const esc = String(next).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<c${cleanAttrs} t="inlineStr"><is><t xml:space="preserve">${esc}</t></is></c>`;
    });
    if (out !== xml) f.content = out;
  });
  return changed;
}

// 산출물 이름에서 OSSP 문서코드(RD1202 등)를 추출해 프로젝트 문서번호를 만든다.
// 코드를 못 찾으면 빈 문자열 → {문서번호} 토큰은 치환하지 않고 템플릿 원본 표기를 유지한다.
function templateDocNo(meta, doc) {
  // 파일명이 "9.2.1.1_RD1301_요구사항 명세서" 형태라 \b는 밑줄 경계를 잡지 못한다 → 문자 클래스로 경계 지정
  const m = /(?:^|[^A-Za-z0-9])(RD\d{4}|[A-Z]{2,3}\d{2,4})(?![0-9])/.exec(String(doc?.name || "") + " " + String(doc?.code || ""));
  if (m) return projectDocNo(meta, m[1]);
  return "";
}

// 템플릿 원본에 박혀 있는 OSSP 문서코드를 프로젝트 문서번호로 교체한다.
//   예) ie.f.RD1202  →  SPID-001-RD1202-2026
// 접두어가 점(.)으로 연결된 형태만 대상으로 삼는다. 본문에서 "RD1202" 단독으로 언급된
// 부분까지 바꾸면 설명 문장이 깨지므로, 문서번호 표기로만 쓰이는 형태에 한정한다.
const TPL_DOC_CODE_RE = /(?:[A-Za-z][A-Za-z0-9]{0,7}\.){1,3}(RD\d{4}|[A-Z]{2,3}\d{2,4})/g;
function docCodePairsFromText(text, meta) {
  const seen = new Map();
  const re = new RegExp(TPL_DOC_CODE_RE.source, "g");
  let m;
  while ((m = re.exec(String(text || "")))) {
    if (!seen.has(m[0])) seen.set(m[0], docCodeWithPrefix(m[1], meta));
  }
  return [...seen.entries()];
}
function templateDocCodePairs(xml, meta) {
  // 태그·속성이 아니라 텍스트 노드만 훑는다. run 분할을 감안해 파트 전체 텍스트를 이어붙인다.
  const text = [...xml.matchAll(/<(?:w:t|t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:t|t)>/g)].map(m => m[1]).join("\n");
  const seen = new Map();
  const re = new RegExp(TPL_DOC_CODE_RE.source, "g");
  let m;
  while ((m = re.exec(text))) {
    // 도구가 자체 생성하는 산출물과 같은 표기를 쓴다 (예: SPID-PS2103 ↔ SPID-RD1202)
    if (!seen.has(m[0])) seen.set(m[0], docCodeWithPrefix(m[1], meta));
  }
  return [...seen.entries()];
}

// 템플릿(docx/xlsx) 파트 배열에 문서정보 placeholder를 일괄 치환한다.
// 반환값: 실제로 바뀐 파트가 있으면 true.
// ── 템플릿 표의 "라벨 셀 + 빈 셀" 채우기 ────────────────────────────
// OSSP 표준양식 상당수는 {프로젝트명} 같은 치환 토큰이 아니라 라벨만 있고 값 칸이 비어 있다.
// 그런 표는 토큰 치환으로는 아무것도 채워지지 않으므로, 라벨 오른쪽 빈 칸을 직접 채운다.
// 안전 규칙: (1) 비어 있는 칸만 채운다 (2) 옆칸도 라벨이면 건너뛴다 (3) 표 안에서만 동작한다.
//   → 서명란처럼 표 밖의 "작성자: ___" 문단은 손대지 않는다 (수기 서명용으로 비워 두는 자리).
// ── 결재란(사용 권한) 라벨 채우기 ──────────────────────────────────
// 템플릿의 "작성자:" / "검토자:" / "승인자:" 뒤에 이름을 붙인다.
// 자체 생성 문서(docxSignLine)와 같은 규칙 — 이름만 채우고 서명·일자는 수기용으로 비워 둔다.
// 라벨만 홀로 있는 문단·셀에만 적용해, 문장 속의 같은 낱말은 건드리지 않는다.
const SIGN_LABEL_RE = /^(작성자|검토자|승인자)\s*[:：]$/;
function signLabelNames(meta) {
  const v = {
    "작성자": docMetaValue(meta, "author") || meta?.pm || "",
    "검토자": docMetaValue(meta, "reviewer"),
    "승인자": docMetaValue(meta, "approver"),
  };
  Object.keys(v).forEach(k => { if (String(v[k] || "").trim() === "") delete v[k]; });
  return v;
}
function fillSignLabels(xml, names, isDocx) {
  if (!Object.keys(names).length) return xml;
  if (!isDocx) return fillSignLabelsIn(xml, names, false);
  // docx는 표 밖 문단에만 적용한다 — 표 안은 docxFillLabeledCells가 라벨 옆칸에 이미 채웠다.
  // 둘 다 적용하면 "작성자: 장성문" 옆에 또 "장성문"이 붙어 이름이 두 번 나온다.
  const parts = []; let last = 0;
  for (const m of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
    parts.push(fillSignLabelsIn(xml.slice(last, m.index), names, true));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(fillSignLabelsIn(xml.slice(last), names, true));
  return parts.join("");
}
function fillSignLabelsIn(xml, names, isDocx) {
  const esc = x => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blockRe = isDocx ? /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g : /<si>[\s\S]*?<\/si>/g;
  const textRe = isDocx ? /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g : /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  return xml.replace(blockRe, blk => {
    const txt = [...blk.matchAll(textRe)].map(m => m[1]).join("").trim();
    const m = SIGN_LABEL_RE.exec(txt);
    if (!m) return blk;
    const nm = names[m[1]];
    if (!nm) return blk;
    if (isDocx) {
      // 마지막 run의 글꼴을 물려받아 이름 run을 문단 끝에 덧붙인다
      const runs = [...blk.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)];
      if (!runs.length) return blk;
      const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(runs[runs.length - 1][0])?.[0] || "";
      const add = `<w:r>${rPr}<w:t xml:space="preserve"> ${esc(nm)}</w:t></w:r>`;
      return blk.slice(0, blk.length - "</w:p>".length) + add + "</w:p>";
    }
    // xlsx 공유문자열: 마지막 <t>의 끝에 이름을 이어 붙인다 (병합 셀과 무관하게 동작)
    const ts = [...blk.matchAll(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g)];
    if (!ts.length) return blk;
    const lastT = ts[ts.length - 1];
    const opened = /^<t(?:\s[^>]*)?>/.exec(lastT[0])[0];
    const inner = lastT[0].slice(opened.length, -"</t>".length);
    return blk.slice(0, lastT.index) + `<t xml:space="preserve">${inner} ${esc(nm)}</t>` + blk.slice(lastT.index + lastT[0].length);
  });
}

function tableLabelValues(meta, docNo) {
  const today = new Date().toISOString().slice(0, 10);
  const v = {
    "프로젝트명": meta?.name || "", "프로젝트": meta?.name || "", "과제명": meta?.name || "",
    "시스템명": systemNameOf(meta), "시스템": systemNameOf(meta),
    "고객사": meta?.client || "", "고객사명": meta?.client || "",
    "발주처": meta?.client || "", "발주처명": meta?.client || "",
    "문서번호": docNo || "",
    "작성자": docMetaValue(meta, "author") || meta?.pm || "",
    "작성자명": docMetaValue(meta, "author") || meta?.pm || "",
    "검토자": docMetaValue(meta, "reviewer"), "승인자": docMetaValue(meta, "approver"),
    "작성일": today, "작성일자": today,
    "작성조직": docMetaValue(meta, "orgName"), "조직명": docMetaValue(meta, "orgName"),
    "수행사": docMetaValue(meta, "orgName"), "부서": docMetaValue(meta, "dept"),
    "배포구분": docMetaValue(meta, "distribution"),
  };
  Object.keys(v).forEach(k => { if (String(v[k] || "").trim() === "") delete v[k]; });
  return v;
}
function docxFillLabeledCells(xml, values) {
  if (!Object.keys(values).length) return xml;
  const tcRe = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
  const cellText = tc => [...tc.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map(m => m[1]).join("").replace(/\s+/g, " ").trim();
  const norm = t => t.replace(/\s+/g, "").replace(/[:：]$/, "");
  const esc = x => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, tbl => {
    if ((tbl.match(/<w:tbl>/g) || []).length !== 1) return tbl;   // 중첩 표 잘림 조각 배제
    const tcs = [...tbl.matchAll(tcRe)].map(m => m[0]);
    const texts = tcs.map(cellText);
    // 라벨-값 인접 판정은 같은 행 안에서만 한다.
    // 표 전체를 한 줄로 이어 보면 행 끝 라벨(예: 개정이력 머리글의 '작성자')이
    // 다음 행 첫 칸(버전)을 값 칸으로 오인해 엉뚱한 자리를 채운다.
    const rowEnd = [];   // 각 tc가 속한 행의 마지막 tc 인덱스
    {
      let k2 = 0;
      for (const tr of (tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [])) {
        const n = (tr.match(tcRe) || []).length;
        for (let j = 0; j < n; j++) rowEnd[k2 + j] = k2 + n - 1;
        k2 += n;
      }
      for (let j = 0; j < tcs.length; j++) if (rowEnd[j] === undefined) rowEnd[j] = tcs.length - 1;
    }
    const fill = {};
    for (let i = 0; i < tcs.length - 1; i++) {
      const val = values[norm(texts[i])];
      if (val === undefined) continue;
      if (i + 1 > rowEnd[i]) continue;                            // 행의 마지막 칸이면 값 칸이 없다
      if (texts[i + 1] !== "") continue;                          // 이미 값이 있으면 건드리지 않는다
      if (values[norm(texts[i + 1])] !== undefined) continue;     // 옆칸도 라벨이면 값 칸이 아니다
      fill[i + 1] = val;
      i++;                                                        // 방금 채운 값 칸은 라벨로 보지 않는다
    }
    if (!Object.keys(fill).length) return tbl;
    let k = -1;
    return tbl.replace(tcRe, m => {
      k++;
      if (fill[k] === undefined) return m;
      const open = /^<w:tc(?:\s[^>]*)?>/.exec(m)?.[0] || "<w:tc>";
      const tcPr = /<w:tcPr>[\s\S]*?<\/w:tcPr>/.exec(m)?.[0] || "";
      const firstP = /<w:p\b[\s\S]*?<\/w:p>/.exec(m);
      const pPr = firstP ? (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(firstP[0])?.[0] || "") : "";
      const rPr = firstP ? (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(firstP[0])?.[0] || "") : "";
      return `${open}${tcPr}<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(fill[k])}</w:t></w:r></w:p></w:tc>`;
    });
  });
}

function applyTemplateMeta(files, meta, doc) {
  const docNo = templateDocNo(meta, doc);
  const pairs = reqTplPlaceholderPairs(meta, docNo);
  const labelVals = tableLabelValues(meta, docNo);
  const signNames = signLabelNames(meta);
  if (!pairs.length && !Object.keys(labelVals).length && !Object.keys(signNames).length) return false;
  const td = new TextDecoder();
  let changed = false;
  files.forEach(f => {
    const isDocx = /^word\/(document|header\d+|footer\d+)\.xml$/.test(f.path);
    const isXlsx = f.path === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.path);
    if (!isDocx && !isXlsx) return;
    const xml = typeof f.content === "string" ? f.content : td.decode(f.content);
    // 파트별로 실제 등장하는 OSSP 문서코드를 찾아 프로젝트 문서번호 치환 쌍을 추가
    // run 분할 대응: docx는 문단 단위, xlsx 공유문자열은 <si> 단위로 텍스트를 합쳐 치환한다.
    // 문서코드 쌍은 합쳐진 텍스트에서 그때그때 찾아야 "ie.f.RD"+"1301" 분할을 잡을 수 있다.
    const codesFor = t => docCodePairsFromText(t, meta);
    const out = isDocx
      ? fillSignLabels(docxFillLabeledCells(docxReplacePlaceholders(xml, pairs, codesFor), labelVals), signNames, true)
      : f.path === "xl/sharedStrings.xml"
        ? fillSignLabels(xlsxSiReplaceAll(xml, pairs, codesFor), signNames, false)
        : xmlTextReplaceAll(xml, [...pairs, ...templateDocCodePairs(xml, meta)]);
    if (out !== xml) { f.content = out; changed = true; }
  });
  return changed;
}

// 정의서(RD1202) xlsx 템플릿 채움: 표지·사용권한 placeholder 치환 + '템플릿' 시트에 요구사항 기입
// 시트 구성(표지·사용권한·재개정이력·작성가이드·작성예)은 그대로 유지한다.
async function injectRequirementsIntoDefXlsx(bytes, meta, req) {
  const items = req?.items;
  if (!items?.length) return null;
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  const getX = p => { const f = byPath[p]; return f ? (typeof f.content === "string" ? f.content : td.decode(f.content)) : null; };
  // 1) 문서정보 placeholder 치환 (sharedStrings + 모든 시트) + 개정이력 예시행 정리
  applyTemplateMeta(files, meta, null);
  try { resetXlsxRevisionHistory(files, meta); } catch (_) { /* 정리 실패 시 원본 유지 */ }
  // 2) '템플릿' 시트 탐색 (workbook.xml → rels)
  const wbXml = getX("xl/workbook.xml");
  if (!wbXml) return null;
  const relXml = getX("xl/_rels/workbook.xml.rels") || "";
  const relMap = {};
  [...relXml.matchAll(/<Relationship\b[^>]*>/g)].forEach(m => {
    const id = /Id="([^"]+)"/.exec(m[0]); const tg = /Target="([^"]+)"/.exec(m[0]);
    if (id && tg) relMap[id[1]] = tg[1];
  });
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => ({
    name: /name="([^"]+)"/.exec(m[0])?.[1] || "",
    rid: /r:id="([^"]+)"/.exec(m[0])?.[1] || "",
  }));
  const target = sheets.find(s => s.name === "템플릿") || sheets.find(s => s.name.includes("템플릿"));
  if (!target || !relMap[target.rid]) return null;
  const path = "xl/" + relMap[target.rid].replace(/^\//, "").replace(/^xl\//, "");
  const shF = byPath[path];
  if (!shF) return null;
  let xml = typeof shF.content === "string" ? shF.content : td.decode(shF.content);
  const sd = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml);
  if (!sd) return null;
  // 3) 헤더 행('요구사항 ID') 탐지 — 공유 문자열 참조 해석 포함
  const sstXml = getX("xl/sharedStrings.xml") || "";
  const sst = [...sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
  const cellText = cXml => {
    const attrs = /<c\b([^>]*)>/.exec(cXml)?.[1] || "";
    const inner = cXml;
    if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); return v ? (sst[Number(v[1])] || "") : ""; }
    if (/t="inlineStr"/.test(attrs)) return [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("");
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner); return v ? v[1] : "";
  };
  const rowsXml = [...sd[1].matchAll(/<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)].map(m => m[0]);
  let headerIdx = -1;
  for (let i = 0; i < rowsXml.length; i++) {
    const cells = [...rowsXml[i].matchAll(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)].map(m => m[0]);
    if (cells.some(c => cellText(c).replace(/\s/g, "") === "요구사항ID")) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return null;
  const headRow = rowsXml[headerIdx];
  const base = Number(/r="(\d+)"/.exec(headRow)?.[1] || headerIdx + 1) + 1;
  // 헤더 다음 행(빈 양식 행)의 컬럼별 셀 스타일 재사용 → 표 테두리·서식 유지
  const styleByCol = {};
  if (rowsXml[headerIdx + 1]) [...rowsXml[headerIdx + 1].matchAll(/<c\b[^>]*>/g)].forEach(m => {
    const rAttr = /r="([A-Z]+)\d+"/.exec(m[0]); const sAttr = /s="(\d+)"/.exec(m[0]);
    if (rAttr && sAttr) styleByCol[rAttr[1]] = sAttr[1];
  });
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // 컬럼: A ID · B 명 · C 설명 · D 상태 · E 중요도 · F 난이도 · G 안정성 · H 관련부서 · I 발의자 · J 출처
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const newRows = items.map((it, i) => {
    const r = base + i;
    const vals = [it.id || "", it.name || "", it.summary || "", "신규", it.priority || "중", "", "", "", "", it.source || ""];
    const cells = vals.map((v, ci) => {
      const s = styleByCol[cols[ci]] ? ` s="${styleByCol[cols[ci]]}"` : "";
      return `<c r="${cols[ci]}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join("");
    return `<row r="${r}">${cells}</row>`;
  }).join("");
  // 헤더까지 유지 + 이후 빈 양식 행은 요구사항 행으로 대체
  xml = xml.replace(sd[0], `<sheetData>${rowsXml.slice(0, headerIdx + 1).join("")}${newRows}</sheetData>`);
  shF.content = xml;
  return zipBytes(files);
}

// 명세서(RD1301) docx 템플릿 채움: 표지 placeholder 치환 + 기능·비기능·인터페이스의 빈 명세 블록 표를
// 요구사항 수만큼 복제해 기입 (작성가이드·작성예 표는 그대로 유지). 모듈 문서는 해당 모듈 배정분 + 공통만 담는다.
// 요구사항 출처에서 이해관계자 그룹(=관련부서)을 뽑는다. "구매팀_납기변경" → "구매팀"
// 구분자가 없거나 지나치게 긴 값은 부서명이 아니므로 비워 둔다.
function reqSourceGroup(source) {
  const s = String(source || "").trim();
  const i = s.indexOf("_");
  if (i <= 0) return "";
  const head = s.slice(0, i).trim();
  return (head && head.length <= 20) ? head : "";
}

// ── 명세 본문 들여쓰기 ────────────────────────────────────────────────
// 텍스트 앞 공백으로 들여쓰면 첫 줄만 밀리고 줄바꿈된 다음 줄은 왼쪽 끝에 붙는다.
// 선행 공백을 실제 문단 들여쓰기(w:ind)로 바꿔, 줄이 몇 번 넘어가도 정렬이 유지되게 한다.
// "1)" "2.1" "▪" 처럼 항목 기호로 시작하면 내어쓰기(hanging)를 줘 기호 뒤에 본문이 맞춰지게 한다.
const IND_PER_SPACE = 110;   // 공백 1칸 = 110 트윕
const IND_HANGING = 330;     // 항목 기호 자리 폭
const ITEM_MARKER_RE = /^(?:[0-9]+(?:\.[0-9]+)*[.)]?|[▪•▸-])\s+/;
function indentedParagraphPr(pPr, line) {
  const lead = /^[ \t]*/.exec(line)[0];
  const text = line.slice(lead.length);
  const spaces = lead.replace(/\t/g, "    ").length;
  const hang = ITEM_MARKER_RE.test(text) ? IND_HANGING : 0;
  const left = spaces * IND_PER_SPACE + hang;
  if (!left) return { pPr, text };
  const ind = `<w:ind w:left="${left}"${hang ? ` w:hanging="${hang}"` : ""}/>`;
  let inner = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(pPr || "")?.[1] || "";
  inner = inner.replace(/<w:ind\b[^>]*\/>/g, "").replace(/<w:ind\b[\s\S]*?<\/w:ind>/g, "");
  const at = inner.indexOf("<w:jc");                 // w:ind 는 w:jc 앞에 와야 한다
  inner = at >= 0 ? inner.slice(0, at) + ind + inner.slice(at) : inner + ind;
  return { pPr: `<w:pPr>${inner}</w:pPr>`, text };
}

async function injectRequirementsIntoSpecDocx(bytes, meta, req, doc) {
  const items0 = req?.items;
  if (!items0?.length) return null;
  // 모듈 분권 규칙 (makeReqDocx와 동일)
  const docWbs = String(doc?.wbsNo || "");
  const under = (c, p) => c === p || c.startsWith(p + ".");
  // 기능 모듈은 WBS 3단계 이상(구성요소 분해 작업)만 인정 — 이전에 저장된 비모듈 후보(예: "10.2")는 무시
  const leaves = (req.specLeaves || []).filter(l => String(l.wbsNo || "").split(".").length >= 3);
  const leafName = {}; leaves.forEach(l => { leafName[l.wbsNo] = l.name; });
  const isCommon = it => !it.wbsNo || it.wbsNo === "공통";
  // 구성요소로 분해되지 않은 공통 문서(예: 시스템 요구사항 명세서, WBS 2단계)는 모듈 배정과 무관하게 전체 요구사항을 담는다
  const inTree = docWbs.split(".").length >= 3 && leaves.some(l => under(l.wbsNo, docWbs) || under(docWbs, l.wbsNo));
  const scoped = inTree
    ? [...items0.filter(it => !isCommon(it) && under(String(it.wbsNo), docWbs)), ...items0.filter(isCommon)]
    : items0;
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const f = files.find(x => x.path === "word/document.xml");
  if (!f) return null;
  // 1) 표지·머리글·꼬리말·본문의 문서정보 placeholder 치환 (run 분할 대응)
  //    요구사항 블록 표를 못 찾더라도 이 치환 결과는 버리지 않는다 (아래 metaFilled 참조)
  const metaFilled = applyTemplateMeta(files, meta, doc);
  let xml = typeof f.content === "string" ? f.content : td.decode(f.content);
  // 2) 빈 명세 블록 표 탐지: '요구사항 ID' 라벨 다음 셀이 비어 있고 '요구사항 명세' 라벨을 가진 표
  //    문서 흐름상 [기능, 비기능, 인터페이스] 순으로 나타난다
  const tcRe = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
  // <w:t> 태그만 정확히 매칭 (<w:tcPr> 등 유사 태그 오매칭 방지), 라벨 비교는 공백 무시
  const tcText = tc => [...tc.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("").replace(/\s+/g, " ").trim();
  const normLbl = s => String(s).replace(/\s+/g, "");
  const escX = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // 셀 내용 교체: tcPr와 첫 문단의 pPr·rPr을 보존해 서식 유지, lines 각각을 문단으로 기입
  const setTcParagraphs = (tc, lines) => {
    const open = /^<w:tc(?:\s[^>]*)?>/.exec(tc)?.[0] || "<w:tc>";
    const tcPr = /<w:tcPr>[\s\S]*?<\/w:tcPr>/.exec(tc)?.[0] || "";
    const firstP = /<w:p\b[\s\S]*?<\/w:p>/.exec(tc);
    const pPr = firstP ? (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(firstP[0])?.[0] || "") : "";
    const rPr = firstP ? (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(firstP[0])?.[0] || "") : "";
    const ps = (lines.length ? lines : [""]).map(l => {
      const raw = String(l);
      if (raw.trim() === "") return `<w:p>${pPr}</w:p>`;
      const ip = indentedParagraphPr(pPr, raw);
      return `<w:p>${ip.pPr}<w:r>${rPr}<w:t xml:space="preserve">${escX(ip.text)}</w:t></w:r></w:p>`;
    }).join("");
    return `${open}${tcPr}${ps}</w:tc>`;
  };
  // 빈 블록 1개를 요구사항 1건으로 채운 사본 생성
  const fillSpecBlock = (tblXml, it) => {
    const vals = {   // 키는 공백 제거형 라벨
      "업무영역": isCommon(it) ? "공통" : (leafName[it.wbsNo] || it.wbsNo),
      "업무기능": isCommon(it) ? "N/A" : `${it.wbsNo} ${leafName[it.wbsNo] || ""}`.trim(),
      "요구사항ID": it.id || "", "요구사항명": it.name || "",
      "요구사항설명": it.summary || "",
      "유형": (it.type || "") + (it.type === "비기능" && it.quality ? ` (${it.quality})` : ""),
      "중요도": it.priority || "중",
      // 관련부서는 원문의 이해관계자 그룹에서 도출한다.
      // 난이도·안정성은 분석·설계 단계의 평가값이고 발의자는 개인 식별 정보라,
      // 요구정의 시점의 원문에 근거가 없다 → 임의로 채우지 않고 공란으로 남긴다.
      "난이도": "", "안정성": "", "발의자": "",
      "관련부서": reqSourceGroup(it.source),
      "출처": it.source || "",
      "승인조건": it.acceptance || "",
    };
    const flow = s => String(s || "").split(/\s*;\s*/).map(x => x.trim()).filter(Boolean);
    const hasUc = it.type === "기능" && (it.actors || it.basicFlow || it.precondition || it.postcondition);
    const specLines = hasUc ? [
      "1. 관련 액터",
      "    " + (it.actors || "-"),
      "2. 이벤트 흐름",
      "    " + (it.detail || it.summary || ""),
      "2.1 기본 흐름",
      ...(flow(it.basicFlow).length ? flow(it.basicFlow).map((x, n) => `    ${n + 1}) ${x}`) : ["    -"]),
      "2.2 서브 흐름",
      ...(flow(it.subFlow).length ? flow(it.subFlow).map((x, n) => `    ${n + 1}) ${x}`) : ["    해당 없음"]),
      "2.3 예외 흐름",
      ...(flow(it.exceptionFlow).length ? flow(it.exceptionFlow).map((x, n) => `    ${n + 1}) ${x}`) : ["    해당 없음"]),
      "3. 사전 조건",
      "    " + (it.precondition || "-"),
      "4. 사후 조건",
      "    " + (it.postcondition || "-"),
      "",
      `▪ 인수 기준: ${it.acceptance || "-"}`,
      `▪ 가정·제약: ${it.assumptions || "-"}`,
    ] : [
      it.detail || it.summary || "",
      "",
      `▪ 인수 기준: ${it.acceptance || "-"}`,
      ...(it.type === "비기능" && it.quality ? [`▪ 품질특성(${req?.qualityStd || "ISO 9126"}): ${it.quality}`] : []),
      `▪ 가정·제약: ${it.assumptions || "-"}`,
    ];
    const tcs = [...tblXml.matchAll(tcRe)].map(m => m[0]);
    const texts = tcs.map(tc => normLbl(tcText(tc)));
    const fillAt = {};   // tc 순번 → 채울 문단들
    for (let i = 0; i < texts.length; i++) {
      if (texts[i] === "요구사항명세" && i + 1 < texts.length) { fillAt[i + 1] = specLines; continue; }
      if (vals[texts[i]] !== undefined && i + 1 < texts.length
        && vals[texts[i + 1]] === undefined && texts[i + 1] !== "요구사항명세") {
        fillAt[i + 1] = [vals[texts[i]]];
        i++;   // 값 셀 스킵
      }
    }
    let k = -1;
    return tblXml.replace(tcRe, m => { k++; return fillAt[k] ? setTcParagraphs(m, fillAt[k]) : m; });
  };
  const tblMatches = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map(m => ({ xml: m[0], index: m.index }));
  const blankMatches = tblMatches.filter(({ xml: t }) => {
    if ((t.match(/<w:tbl>/g) || []).length !== 1) return false;   // 중첩 표 잘림 조각 배제
    const tcs = [...t.matchAll(tcRe)].map(m => m[0]);
    const texts = tcs.map(tc => normLbl(tcText(tc)));
    if (!texts.includes("요구사항명세")) return false;
    const i = texts.indexOf("요구사항ID");
    return i > -1 && texts[i + 1] !== undefined && texts[i + 1] === "";
  });
  const blanks = blankMatches.map(b => b.xml);
  // 요구사항 명세 블록 표를 못 찾아도, placeholder 치환분은 살려서 반환한다.
  if (!blanks.length) { f.content = xml; return metaFilled ? zipBytes(files) : null; }
  const typeOrder = ["기능", "비기능", "인터페이스"];
  // 요구사항 1건 = 1페이지. 블록(표) 뒤마다 페이지 나누기를 넣어 다음 요구사항이,
  // 절의 마지막 블록 뒤에서는 다음 절 제목이 새 페이지에서 시작하도록 한다.
  // 문서 맨 끝 블록 뒤에는 넣지 않는다 — 빈 페이지가 하나 생기기 때문.
  const PAGE_BR = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const lists = blanks.slice(0, 3).map((_, bi) => scoped.filter(it => (it.type || "기능") === typeOrder[bi]));
  let lastIdx = -1;
  lists.forEach((l, i) => { if (l.length) lastIdx = i; });
  let filledAny = false;
  // 문자열 치환(xml.replace)은 동일한 빈 표가 여러 개면 항상 첫 번째 표를 바꿔 절이 밀린다.
  // → 표의 원래 위치(index) 기준으로 뒤에서부터 잘라 붙여 각 절의 표를 정확히 교체한다.
  const plan = [];
  blankMatches.slice(0, 3).forEach((bm, bi) => {
    const list = lists[bi];
    if (!list.length) return;   // 해당 유형 요구사항이 없으면 빈 양식 유지
    const filled = list.map(it => fillSpecBlock(bm.xml, it)).join(PAGE_BR)
      + (bi === lastIdx ? "" : PAGE_BR);
    plan.push({ index: bm.index, len: bm.xml.length, filled });
  });
  plan.sort((x, y) => y.index - x.index).forEach(pl => {
    xml = xml.slice(0, pl.index) + pl.filled + xml.slice(pl.index + pl.len);
    filledAny = true;
  });
  f.content = xml;
  if (!filledAny && !metaFilled) return null;   // 채운 것이 전혀 없을 때만 폴백
  return zipBytes(files);
}

// 요구사항 산출물 → OSSP 템플릿 채움 시도 (성공 시 {ext, bytes}, 실패·미매칭 시 null → 자체 생성 폴백)
async function resolveReqDocFromTemplate(doc, kind, meta, ctx) {
  if (kind === "both") return null;   // 정의서·명세서 통합 산출물은 자체 생성 유지 (템플릿이 분리형이므로)
  let tpl = null;
  const dbId = await resolveOsspDbId(ctx?.ossp);
  if (dbId) tpl = findTemplateFor(doc.name, await fetchOsspTemplates(dbId));
  if (!tpl) tpl = findTemplateFor(doc.name, await fetchOsspTemplates(null));
  if (!tpl) return null;
  const ext = (String(tpl.file_name).split(".").pop() || "").toLowerCase();
  const bytes = await fetchTemplateBytes(tpl);
  if (!bytes) return null;
  if (kind === "def" && ext === "xlsx") {
    const filled = await injectRequirementsIntoDefXlsx(bytes, meta, ctx.requirements);
    if (!filled) return null;
    try { const logod = await injectLogosIntoTemplateXlsx(filled, meta); return { ext: "xlsx", bytes: logod || filled }; }
    catch (_) { return { ext: "xlsx", bytes: filled }; }
  }
  if (kind === "spec" && ext === "docx") {
    const filled = await injectRequirementsIntoSpecDocx(bytes, meta, ctx.requirements, doc);
    if (!filled) return null;
    try { const logod = await injectLogosIntoTemplateDocx(filled, meta); return { ext: "docx", bytes: logod || filled }; }
    catch (_) { return { ext: "docx", bytes: filled }; }
  }
  return null;
}

// ── XLSX ─────────────────────────────────────────────────────
function colLetter(n) { let s = ""; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function makeXlsx({ sheetName = "Sheet1", rows }) {
  const rowsXml = rows.map((cells, ri) =>
    `<row r="${ri + 1}">` + cells.map((c, ci) =>
      `<c r="${colLetter(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${xesc(c)}</t></is></c>`
    ).join("") + "</row>"
  ).join("");
  const sheetXml = XMLH + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  const wbXml = XMLH + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xesc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return zipBytes([
    { path: "[Content_Types].xml", content: XMLH + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { path: "_rels/.rels", content: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: "xl/workbook.xml", content: wbXml },
    { path: "xl/_rels/workbook.xml.rels", content: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { path: "xl/worksheets/sheet1.xml", content: sheetXml },
  ]);
}

// ═══════════════════════════════════════════════════════════════════
// WBS 간트 워크북 생성기 (자체 구현 · 외부 코드/파일 미사용)
// - 시트: WBS(일정+간트) / 공휴일 / 사용법
// - B3 셀 하나로 차트 단위(일/주) 전환 — 조건부 서식·날짜 축이 수식으로 즉시 반영
// - 일정 수식: 선행(FS) 종료 + 1근무일 → 시작일(WORKDAY), 시작일 + 공수 - 1근무일 → 종료일
//              선행 표기는 MS Project 규칙(1.1 / 1.1+2 / 1.1-1 / 1.1SS / 1.1SS+3)을 그대로 지원
// - 간트 막대·진척·오늘·주말·공휴일은 조건부 서식(범용 엑셀 기법)으로 표현
// ═══════════════════════════════════════════════════════════════════


// 날짜 문자열(yyyy-mm-dd) → 엑셀 시리얼 값 (1900 날짜 체계)
function xlDateSerial(s) {
  if (!s) return null;
  const d = new Date(s + "T00:00:00Z");
  if (isNaN(d)) return null;
  return Math.round((d.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}
// 수식에 심을 정적 날짜: DATE(y,m,d) — 로캘 무관
function xlDateFn(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `DATE(${+m[1]},${+m[2]},${+m[3]})`;
}

function makeWbsGanttXlsx(wbs, meta) {
  const tasks = wbs?.tasks || [];
  const holidays = (wbs?.holidays || []).slice().sort();
  const today = new Date().toLocaleDateString("ko-KR");
  // 수행 팀원 — 위저드에서는 meta.members, 저장된 프로젝트에서는 meta.tailoring.members
  const team = normalizeMembers(meta?.members || meta?.tailoring?.members);
  const TEAM_MAX = 60;   // TeamList = 팀원!$A$2:$A$61 (빈 칸은 엑셀에서 직접 추가 가능)

  // ── 행 평탄화: 요약(레벨1) + 하위(레벨2~5), 자식 행 범위 기록 ──
  const flat = [];   // { kind:'sum'|'sub', ... }
  tasks.forEach(t => {
    const sumIdx = flat.length;
    flat.push({ kind: "sum", wbsCode: t.wbsCode, name: t.phase, childFrom: null, childTo: null });
    (t.subtasks || []).forEach(s => flat.push({ kind: "sub", ...s }));
    const n = (t.subtasks || []).length;
    if (n) { flat[sumIdx].childFrom = sumIdx + 1; flat[sumIdx].childTo = sumIdx + n; }
  });

  const HEAD_ROW = 6;                 // 테이블 헤더·날짜 축 행
  const DATA_START = HEAD_ROW + 1;    // 첫 데이터 행 = 7
  const lastRow = DATA_START + flat.length - 1;
  const rowOf = (i) => DATA_START + i;

  // ── 차트 시작일: 최소 시작일에서 이전 월요일로 스냅 (없으면 프로젝트 시작일/오늘) ──
  const allStarts = [];
  const allFinishes = [];
  flat.forEach(r => { if (r.kind === "sub") { if (r.start) allStarts.push(r.start); if (r.finish) allFinishes.push(r.finish); } });
  if (meta?.startDate) allStarts.push(meta.startDate);
  if (meta?.endDate) allFinishes.push(meta.endDate);
  allStarts.sort(); allFinishes.sort();
  let chartStart = allStarts[0] || new Date().toISOString().slice(0, 10);
  {
    const d = new Date(chartStart + "T00:00:00Z");
    const dow = d.getUTCDay();                       // 0=일
    d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));  // 직전(포함) 월요일
    chartStart = d.toISOString().slice(0, 10);
  }
  // 타임라인 열 수: 일 단위 기준 프로젝트 기간 + 여유, 90~240열
  let spanDays = 120;
  if (allFinishes.length) {
    const a = new Date(chartStart + "T00:00:00Z"), b = new Date(allFinishes[allFinishes.length - 1] + "T00:00:00Z");
    spanDays = Math.max(30, Math.round((b - a) / 86400000));
  }
  const NCOLS = Math.max(90, Math.min(240, spanDays + 30));
  const GANTT_FIRST = 10;                       // K열 (0-based 10)
  const GANTT_LAST = GANTT_FIRST + NCOLS - 1;
  const K = colLetter(GANTT_FIRST);             // "K"
  const LASTCOL = colLetter(GANTT_LAST);

  // ── 셀 헬퍼 ──
  const cStr = (r, c, v, s) => v === "" || v == null ? (s ? `<c r="${colLetter(c)}${r}" s="${s}"/>` : "") :
    `<c r="${colLetter(c)}${r}" s="${s || 0}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
  const cNum = (r, c, v, s) => v == null ? (s ? `<c r="${colLetter(c)}${r}" s="${s}"/>` : "") :
    `<c r="${colLetter(c)}${r}" s="${s || 0}"><v>${v}</v></c>`;
  const cFml = (r, c, f, s) => `<c r="${colLetter(c)}${r}" s="${s || 0}"><f>${xesc(f)}</f></c>`;
  const cEmpty = (r, c, s) => `<c r="${colLetter(c)}${r}" s="${s}"/>`;

  // ── 스타일 인덱스 (styles.xml 정의 순서와 일치) ──
  const S = {
    title: 1, metaLabel: 2, metaVal: 3, metaDate: 4, metaCenter: 5,
    head: 6, txt: 7, ctr: 8, date: 9, pct: 10, num: 11,
    sumTxt: 12, sumDate: 13, sumCtr: 14, sumPct: 15, sumNum: 16,
    tlMonth: 17, tlDay: 18, gantt: 19, ganttSum: 20, legend: 21, holHead: 22, holDate: 23, usage: 24, usageHead: 25,
    predTxt: 26,   // 선행 입력 열 — 텍스트 서식(@)이라 1.1 입력 시 숫자가 아닌 텍스트로 저장됨
  };

  // ═══ WBS 시트 ═══
  const rowsXml = [];

  // Row 1: 제목
  rowsXml.push(`<row r="1" ht="24" customHeight="1">${cStr(1, 0, "WBS · 일정 계획 (Gantt)", S.title)}</row>`);
  // Row 2: 프로젝트 메타
  rowsXml.push(`<row r="2">${[
    cStr(2, 0, "프로젝트명", S.metaLabel), cStr(2, 1, meta?.name || "", S.metaVal),
    cStr(2, 2, "고객사", S.metaLabel), cStr(2, 3, meta?.client || "", S.metaVal),
    cStr(2, 4, "PM", S.metaLabel), cStr(2, 5, meta?.pm || "", S.metaVal),
    cStr(2, 6, "기간", S.metaLabel), cStr(2, 7, `${meta?.startDate || ""} ~ ${meta?.endDate || ""}`, S.metaVal),
    cStr(2, 8, "작성일", S.metaLabel), cStr(2, 9, today, S.metaVal),
  ].join("")}</row>`);
  // Row 3: 차트 설정 (B3 = 단위 토글, D3 = 차트 시작일)
  rowsXml.push(`<row r="3">${[
    cStr(3, 0, "차트 단위 ▼", S.metaLabel), cStr(3, 1, "일", S.metaCenter),
    cStr(3, 2, "차트 시작일", S.metaLabel), cNum(3, 3, xlDateSerial(chartStart), S.metaDate),
    cStr(3, 4, "기준일", S.metaLabel), cFml(3, 5, "TODAY()", S.metaDate),
    cStr(3, 6, "버전", S.metaLabel), cStr(3, 7, "V0.1 (초안)", S.metaVal),
  ].join("")}</row>`);
  // Row 4: 범례
  rowsXml.push(`<row r="4">${cStr(4, 0, "범례: 파랑=작업 막대 · 진한 파랑=진척(진척률 입력 시) · 네이비=단계 요약 · 주황=오늘 · 분홍=공휴일 · 회색=주말  |  B3에서 일↔주 전환, D3에서 차트 시작일 변경", S.legend)}</row>`);

  // Row 5: 월 헤더 (날짜 축 행6 참조)
  {
    const cells = [];
    for (let i = 0; i < NCOLS; i++) {
      const col = GANTT_FIRST + i;
      const cl = colLetter(col);
      const prev = colLetter(col - 1);
      const f = i === 0
        ? `TEXT(${cl}$${HEAD_ROW},"yy년 m월")`
        : `IF(MONTH(${cl}$${HEAD_ROW})<>MONTH(${prev}$${HEAD_ROW}),TEXT(${cl}$${HEAD_ROW},"yy년 m월"),"")`;
      cells.push(cFml(5, col, f, S.tlMonth));
    }
    rowsXml.push(`<row r="5" ht="14" customHeight="1">${cells.join("")}</row>`);
  }

  // Row 6: 테이블 헤더 + 날짜 축
  {
    const heads = ["WBS", "Task", "산출물", "작업자", "선행", "시작일", "종료일", "공수(일)", "진척률", "상태"];
    const cells = heads.map((h, ci) => cStr(HEAD_ROW, ci, h, S.head));
    for (let i = 0; i < NCOLS; i++) {
      const col = GANTT_FIRST + i;
      const f = i === 0 ? `$D$3` : `${colLetter(col - 1)}$${HEAD_ROW}+IF(ChartUnit="주",7,1)`;
      cells.push(cFml(HEAD_ROW, col, f, S.tlDay));
    }
    rowsXml.push(`<row r="${HEAD_ROW}" ht="16" customHeight="1">${cells.join("")}</row>`);
  }

  // 데이터 행
  flat.forEach((it, i) => {
    const r = rowOf(i);
    const cells = [];
    const ganttStyle = it.kind === "sum" ? S.ganttSum : S.gantt;
    if (it.kind === "sum") {
      // childFrom/childTo는 flat 인덱스 → 행 번호로 변환
      const r1 = it.childFrom != null ? DATA_START + it.childFrom : null;
      const r2 = it.childTo != null ? DATA_START + it.childTo : null;
      cells.push(cStr(r, 0, it.wbsCode, S.sumTxt));
      cells.push(cStr(r, 1, it.name, S.sumTxt));
      cells.push(cStr(r, 2, "요약 (하위 롤업)", S.sumTxt));
      cells.push(cEmpty(r, 3, S.sumTxt));
      cells.push(cEmpty(r, 4, S.sumCtr));
      if (r1 != null) {
        cells.push(cFml(r, 5, `IF(COUNT($F$${r1}:$F$${r2})=0,"",MIN($F$${r1}:$F$${r2}))`, S.sumDate));
        cells.push(cFml(r, 6, `IF(COUNT($G$${r1}:$G$${r2})=0,"",MAX($G$${r1}:$G$${r2}))`, S.sumDate));
        cells.push(cFml(r, 7, `IF(SUM($H$${r1}:$H$${r2})=0,"",SUM($H$${r1}:$H$${r2}))`, S.sumNum));
        cells.push(cFml(r, 8, `IFERROR(SUMPRODUCT($H$${r1}:$H$${r2},$I$${r1}:$I$${r2})/SUM($H$${r1}:$H$${r2}),0)`, S.sumPct));
      } else {
        cells.push(cEmpty(r, 5, S.sumDate)); cells.push(cEmpty(r, 6, S.sumDate));
        cells.push(cEmpty(r, 7, S.sumNum)); cells.push(cEmpty(r, 8, S.sumPct));
      }
      cells.push(cEmpty(r, 9, S.sumCtr));
    } else {
      const startFn = xlDateFn(it.start);
      const finishFn = xlDateFn(it.finish);
      const staticStart = startFn || `""`;
      cells.push(cStr(r, 0, it.wbsCode || "", S.txt));
      const indent = "  ".repeat(Math.max(0, (it.level || 2) - 2));
      cells.push(cStr(r, 1, indent + (it.task || ""), S.txt));
      cells.push(cStr(r, 2, it.deliverable || "", S.txt));
      cells.push(cStr(r, 3, it.assignee || "", S.ctr));
      cells.push(it.pred ? cStr(r, 4, it.pred, S.predTxt) : cEmpty(r, 4, S.predTxt));
      // F 시작일 — FS는 선행 '종료일의 다음 근무일'(MS Project 동일). 선행은 위쪽 행만 참조(순환 참조 방지).
      if (r > DATA_START) {
        const links = parsePred(it.pred);
        const simple = links.length <= 1 && links.every(L => L.type === "FS" && L.lag === 0);
        let f;
        if (simple) {
          // 단순 FS(지연 0) — 엑셀에서 선행(E) 텍스트를 바꾸면 즉시 재연결되는 동적 수식 유지
          const idx = `INDEX($G$${DATA_START}:$G$${r - 1},MATCH($E${r}&"",$A$${DATA_START}:$A$${r - 1},0))`;
          f = `IF($E${r}="",${staticStart},IFERROR(WORKDAY(${idx},1,HolidayList),${staticStart}))`;
        } else {
          // 복수 선행·지연·SS — 생성 시점 파싱 결과를 수식으로 고정하고 가장 늦은 시작일 채택
          const terms = links.slice(0, 8).map(L => {
            const mt = `MATCH("${L.code}",$A$${DATA_START}:$A$${r - 1},0)`;
            if (L.type === "SS") {
              const idxF = `INDEX($F$${DATA_START}:$F$${r - 1},${mt})`;
              return L.lag === 0 ? `IFERROR(${idxF},0)` : `IFERROR(WORKDAY(${idxF},${L.lag},HolidayList),0)`;
            }
            const idxG = `INDEX($G$${DATA_START}:$G$${r - 1},${mt})`;
            return `IFERROR(WORKDAY(${idxG},${1 + L.lag},HolidayList),0)`;
          });
          const mx = terms.length > 1 ? `MAX(${terms.join(",")})` : terms[0];
          f = `IF(${mx}=0,${staticStart},${mx})`;
        }
        cells.push(cFml(r, 5, f, S.date));
      } else {
        cells.push(startFn ? cFml(r, 5, startFn, S.date) : cEmpty(r, 5, S.date));
      }
      // G 종료일: 시작일 + 공수(근무일) - 1
      {
        const fb = finishFn || `""`;
        cells.push(cFml(r, 6, `IF(OR($F${r}="",$H${r}=""),${fb},WORKDAY($F${r},MAX($H${r},1)-1,HolidayList))`, S.date));
      }
      // H 공수
      const eff = Number(it.effort);
      cells.push(eff > 0 ? cNum(r, 7, eff, S.num) : cEmpty(r, 7, S.num));
      // I 진척률 (기본 0)
      cells.push(cNum(r, 8, 0, S.pct));
      // J 상태
      cells.push(cFml(r, 9, `IF($F${r}="","",IF($I${r}>=1,"완료",IF($G${r}="","",IF(TODAY()>$G${r},"지연",IF(TODAY()>=$F${r},"진행","예정")))))`, S.ctr));
    }
    // 간트 영역 스타일 빈 셀 (조건부 서식이 칠함)
    for (let c = GANTT_FIRST; c <= GANTT_LAST; c++) cells.push(cEmpty(r, c, ganttStyle));
    const outline = it.kind === "sub" ? ` outlineLevel="${Math.min(7, Math.max(1, (it.level || 2) - 1))}"` : "";
    rowsXml.push(`<row r="${r}"${outline}>${cells.join("")}</row>`);
  });

  // 조건부 서식 (우선순위 순, stopIfTrue) — 범용 엑셀 기법의 자체 구현
  const ganttRange = `${K}${DATA_START}:${LASTCOL}${lastRow}`;
  const unitSpan = `IF(ChartUnit="주",6,0)`;
  const cf = `<conditionalFormatting sqref="${ganttRange}">` +
    `<cfRule type="expression" dxfId="0" priority="1" stopIfTrue="1"><formula>AND($A${DATA_START}&lt;&gt;"",ISERROR(FIND(".",$A${DATA_START})),$F${DATA_START}&lt;&gt;"",$G${DATA_START}&lt;&gt;"",${K}$${HEAD_ROW}&lt;=$G${DATA_START},${K}$${HEAD_ROW}+${unitSpan}&gt;=$F${DATA_START})</formula></cfRule>` +
    `<cfRule type="expression" dxfId="1" priority="2" stopIfTrue="1"><formula>AND($F${DATA_START}&lt;&gt;"",$G${DATA_START}&lt;&gt;"",${K}$${HEAD_ROW}&lt;=$G${DATA_START},${K}$${HEAD_ROW}+${unitSpan}&gt;=$F${DATA_START},$I${DATA_START}&gt;0,${K}$${HEAD_ROW}&lt;=$F${DATA_START}+($G${DATA_START}-$F${DATA_START})*$I${DATA_START})</formula></cfRule>` +
    `<cfRule type="expression" dxfId="2" priority="3" stopIfTrue="1"><formula>AND($F${DATA_START}&lt;&gt;"",$G${DATA_START}&lt;&gt;"",${K}$${HEAD_ROW}&lt;=$G${DATA_START},${K}$${HEAD_ROW}+${unitSpan}&gt;=$F${DATA_START})</formula></cfRule>` +
    `<cfRule type="expression" dxfId="3" priority="4" stopIfTrue="1"><formula>AND(${K}$${HEAD_ROW}&lt;=TODAY(),TODAY()&lt;${K}$${HEAD_ROW}+IF(ChartUnit="주",7,1))</formula></cfRule>` +
    `<cfRule type="expression" dxfId="4" priority="5" stopIfTrue="1"><formula>AND(ChartUnit="일",COUNTIF(HolidayList,${K}$${HEAD_ROW})&gt;0)</formula></cfRule>` +
    `<cfRule type="expression" dxfId="5" priority="6"><formula>AND(ChartUnit="일",WEEKDAY(${K}$${HEAD_ROW},2)&gt;=6)</formula></cfRule>` +
    `</conditionalFormatting>`;

  // 데이터 유효성 검사
  //  · B3: 차트 단위(일/주) — 목록 외 입력 차단
  //  · D열(작업자): 등록 팀원 드롭다운. showErrorMessage="0" 으로 목록 외 입력도 그대로 허용한다.
  //    (MS Project의 Resource Names·Smartsheet의 비제한 Contact 열과 동일한 정책. 쉼표로 복수 지정 가능)
  const dvList = [
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" promptTitle="차트 단위" prompt="일 또는 주를 선택하면 간트 축이 바뀝니다" sqref="B3"><formula1>"일,주"</formula1></dataValidation>`,
  ];
  if (team.length) {
    dvList.push(
      `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" ` +
      `promptTitle="작업자" prompt="목록에서 선택하거나 직접 입력하세요. 여러 명은 쉼표(,)로 구분합니다. 예: ${xesc(team.slice(0, 2).map(m => m.name).join(", "))}" ` +
      `sqref="D${DATA_START}:D${lastRow}"><formula1>TeamList</formula1></dataValidation>`
    );
  }
  const dv = `<dataValidations count="${dvList.length}">${dvList.join("")}</dataValidations>`;

  const wbsSheet = XMLH +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><outlinePr summaryBelow="0"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90">` +
    `<pane xSplit="10" ySplit="${HEAD_ROW}" topLeftCell="${K}${DATA_START}" activePane="bottomRight" state="frozen"/>` +
    `<selection pane="bottomRight" activeCell="${K}${DATA_START}" sqref="${K}${DATA_START}"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15.5" outlineLevelRow="4"/>` +
    `<cols>` +
    `<col min="1" max="1" width="9" customWidth="1"/>` +
    `<col min="2" max="2" width="36" customWidth="1"/>` +
    `<col min="3" max="3" width="20" customWidth="1"/>` +
    `<col min="4" max="4" width="16" customWidth="1"/>` +   // 작업자 — 쉼표로 2명 이상 표기 가능하도록 확보
    `<col min="5" max="5" width="10" customWidth="1"/>` +
    `<col min="6" max="7" width="11.5" customWidth="1"/>` +
    `<col min="8" max="8" width="8" customWidth="1"/>` +
    `<col min="9" max="9" width="7.5" customWidth="1"/>` +
    `<col min="10" max="10" width="7" customWidth="1"/>` +
    `<col min="${GANTT_FIRST + 1}" max="${GANTT_LAST + 1}" width="3.4" customWidth="1"/>` +
    `</cols>` +
    `<sheetData>${rowsXml.join("")}</sheetData>` +
    cf + dv +
    `</worksheet>`;

  // ═══ 공휴일 시트 ═══
  const HOL_MAX = 60;   // HolidayList = A2:A61 (빈 칸은 사용자가 추가 입력)
  const holRows = [`<row r="1">${cStr(1, 0, "공휴일 날짜", S.holHead)}${cStr(1, 1, "설명", S.holHead)}</row>`];
  for (let i = 0; i < HOL_MAX; i++) {
    const r = i + 2;
    const serial = i < holidays.length ? xlDateSerial(holidays[i]) : null;
    holRows.push(`<row r="${r}">${serial != null ? cNum(r, 0, serial, S.holDate) : cEmpty(r, 0, S.holDate)}${i < holidays.length ? cStr(r, 1, "프로젝트 지정 공휴일", S.txt) : cEmpty(r, 1, S.txt)}</row>`);
  }
  const holSheet = XMLH +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/></cols>` +
    `<sheetData>${holRows.join("")}</sheetData>` +
    `</worksheet>`;

  // ═══ 팀원 시트 ═══ (작업자 드롭다운의 원천 = TeamList)
  const teamRows = [`<row r="1">${cStr(1, 0, "이름", S.holHead)}${cStr(1, 1, "역할", S.holHead)}${cStr(1, 2, "소속", S.holHead)}</row>`];
  for (let i = 0; i < TEAM_MAX; i++) {
    const r = i + 2;
    const m = team[i];
    teamRows.push(`<row r="${r}">` +
      (m ? cStr(r, 0, m.name, S.txt) : cEmpty(r, 0, S.txt)) +
      (m ? cStr(r, 1, m.role || "", S.txt) : cEmpty(r, 1, S.txt)) +
      (m ? cStr(r, 2, m.org || "", S.txt) : cEmpty(r, 2, S.txt)) +
      `</row>`);
  }
  const teamSheet = XMLH +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/></cols>` +
    `<sheetData>${teamRows.join("")}</sheetData>` +
    `</worksheet>`;

  // ═══ 사용법 시트 ═══
  const usage = [
    ["WBS 일정 계획 워크북 사용법", true],
    ["", false],
    ["1. 차트 단위 전환 (일 ↔ 주)", true],
    ["   · WBS 시트 B3 셀에서 '일' 또는 '주'를 선택하면 간트 차트 축이 즉시 전환됩니다.", false],
    ["   · '주' 단위에서는 각 열이 7일(1주)을 나타내며, 주말·공휴일 음영은 '일' 단위에서만 표시됩니다.", false],
    ["2. 차트 시작일", true],
    ["   · D3 셀의 날짜를 바꾸면 간트 차트가 해당 날짜부터 표시됩니다.", false],
    ["3. 일정 자동 계산 (근무일 기준)", true],
    ["   · 시작일(F) + 공수(H) → 종료일(G) 자동 계산: 시작일을 1일째로 세며 주말(토·일)과 공휴일 시트의 날짜를 제외합니다.", false],
    ["   · 선행(E)에 선행 작업의 WBS 코드를 입력하면 선행 작업 '종료일의 다음 근무일'이 시작일이 됩니다 (FS 관계, MS Project와 동일).", false],
    ["   · 지연·중첩: 1.1+2 = 2근무일 지연 후 시작 / 1.1-1 = 1근무일 앞당겨 중첩 시작.", false],
    ["   · 동시 착수: 1.1SS = 선행과 같은 날 시작 (시작-시작), 1.1SS+3 = 선행 시작 3근무일 후 시작.", false],
    ["   · 복수 선행: 쉼표로 구분하면 가장 늦은 시작일이 채택됩니다 (예: 1.1, 1.2+1).", false],
    ["   · 제약: 선행은 자신보다 위쪽 행의 작업만 참조할 수 있습니다 (순환 참조 방지).", false],
    ["   · 선행 열은 텍스트 서식이므로 1.1처럼 입력하면 WBS 코드로 정확히 인식됩니다.", false],
    [`   · 단순 FS(지연 없는 단일 선행)는 이 시트에서 선행(E)을 고쳐도 즉시 재연결됩니다. 지연·SS·복수 선행은 생성 시점 관계로 고정되므로, 관계를 바꾸려면 ${APP_NAME} 화면에서 수정 후 다시 내보내세요.`, false],
    ["4. MS Project로 가져오기", true],
    ["   · [파일] > [열기]에서 이 파일을 선택하고 마법사에서 '새 맵'을 만들어 열을 매핑합니다.", false],
    ["   · 선행(E) 열은 '선행 작업(Predecessors)'이 아니라 'WBS 선행 작업(WBS Predecessors)' 필드에 매핑하세요.", false],
    ["     ('선행 작업' 필드는 WBS 코드가 아닌 작업 ID(행 번호)를 받으므로 링크가 연결되지 않습니다.)", false],
    ["   · 시작일(F)을 함께 가져오면 '~ 이후 시작' 제약이 걸려 링크 계산과 충돌할 수 있습니다.", false],
    ["     WBS·작업명·공수·선행만 가져온 뒤 MS Project가 일정을 계산하게 하면 본 워크북과 동일한 결과가 나옵니다.", false],
    ["   · MS Project의 프로젝트 달력(휴무일)을 '공휴일' 시트와 동일하게 맞춰야 날짜가 일치합니다.", false],
    ["5. 진척률과 상태", true],
    ["   · 진척률(I)을 입력하면 막대 위에 진한 색으로 진척 구간이 표시됩니다 (0%~100%).", false],
    ["   · 상태(J)는 오늘 날짜 기준으로 예정/진행/지연/완료가 자동 표시됩니다.", false],
    ["6. 작업자 (D열)", true],
    ["   · 셀을 선택하면 '팀원' 시트에 등록된 인원이 드롭다운으로 나타납니다.", false],
    ["   · 목록에 없는 이름도 그대로 입력할 수 있습니다 (입력이 차단되지 않습니다).", false],
    ["   · 여러 명을 지정하려면 쉼표(,)로 구분하세요. 예: 장성문, 홍길동", false],
    ["   · '팀원' 시트 A열(2행~61행)에 이름을 추가하면 드롭다운 목록에 즉시 반영됩니다.", false],
    ["7. 공휴일 관리", true],
    ["   · '공휴일' 시트 A열(2행~61행)에 날짜를 추가/삭제하면 일정 계산과 간트 음영에 즉시 반영됩니다.", false],
    ["8. 행 그룹(개요)", true],
    ["   · 좌측 개요 버튼(1/2/3…)으로 단계별 하위 작업을 접거나 펼 수 있습니다.", false],
    ["", false],
    [`※ 본 워크북은 ${APP_NAME}가 표준 엑셀 기능(수식·조건부 서식)만으로 자동 생성한 문서입니다 (매크로 없음).`, false],
  ];
  const usageRows = usage.map(([t, b], i) => `<row r="${i + 1}">${cStr(i + 1, 0, t, b ? S.usageHead : S.usage)}</row>`);
  const usageSheet = XMLH +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>` +
    `<cols><col min="1" max="1" width="110" customWidth="1"/></cols>` +
    `<sheetData>${usageRows.join("")}</sheetData>` +
    `</worksheet>`;

  // ═══ styles.xml ═══
  const stylesXml = XMLH + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="3">` +
    `<numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/>` +
    `<numFmt numFmtId="165" formatCode="d"/>` +
    `<numFmt numFmtId="166" formatCode="0%"/>` +
    `</numFmts>` +
    `<fonts count="6">` +
    `<font><sz val="10"/><name val="맑은 고딕"/></font>` +
    `<font><b/><sz val="10"/><name val="맑은 고딕"/></font>` +
    `<font><sz val="8"/><name val="맑은 고딕"/><color rgb="FF595959"/></font>` +
    `<font><b/><sz val="14"/><name val="맑은 고딕"/><color rgb="FF1F3864"/></font>` +
    `<font><b/><sz val="8"/><name val="맑은 고딕"/><color rgb="FF1F3864"/></font>` +
    `<font><b/><sz val="10"/><name val="맑은 고딕"/><color rgb="FF1F3864"/></font>` +
    `</fonts>` +
    `<fills count="5">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFEDF2FA"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="3">` +
    `<border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>` +
    `<border><left style="hair"><color rgb="FFE8E8E8"/></left><right style="hair"><color rgb="FFE8E8E8"/></right><top style="hair"><color rgb="FFE8E8E8"/></top><bottom style="hair"><color rgb="FFE8E8E8"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="27">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>` +                                                                   // 0
    `<xf numFmtId="0" fontId="3" fillId="0" borderId="0"/>` +                                                                   // 1 title
    `<xf numFmtId="0" fontId="1" fillId="4" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 2 metaLabel
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 3 metaVal
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 4 metaDate
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +   // 5 metaCenter (B3)
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` + // 6 head
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 7 txt
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +   // 8 ctr
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 9 date
    `<xf numFmtId="166" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 10 pct
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +   // 11 num
    `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 12 sumTxt
    `<xf numFmtId="164" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 13 sumDate
    `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +   // 14 sumCtr
    `<xf numFmtId="166" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 15 sumPct
    `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +   // 16 sumNum
    `<xf numFmtId="0" fontId="4" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 17 tlMonth
    `<xf numFmtId="165" fontId="2" fillId="2" borderId="2" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 18 tlDay
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="2"/>` +                                                                   // 19 gantt
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="2"/>` +                                                                   // 20 ganttSum
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 21 legend
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +   // 22 holHead
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 23 holDate
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` + // 24 usage
    `<xf numFmtId="0" fontId="5" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf>` +              // 25 usageHead
    `<xf numFmtId="49" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 26 predTxt (텍스트 @)
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `<dxfs count="6">` +
    `<dxf><fill><patternFill><bgColor rgb="FF203864"/></patternFill></fill></dxf>` +   // 0 요약 막대 (네이비)
    `<dxf><fill><patternFill><bgColor rgb="FF1F4E9C"/></patternFill></fill></dxf>` +   // 1 진척 (진한 파랑)
    `<dxf><fill><patternFill><bgColor rgb="FF8EAADB"/></patternFill></fill></dxf>` +   // 2 작업 막대 (파랑)
    `<dxf><fill><patternFill><bgColor rgb="FFF5A623"/></patternFill></fill></dxf>` +   // 3 오늘 (주황)
    `<dxf><fill><patternFill><bgColor rgb="FFF8CBAD"/></patternFill></fill></dxf>` +   // 4 공휴일 (분홍)
    `<dxf><fill><patternFill><bgColor rgb="FFE7E6E6"/></patternFill></fill></dxf>` +   // 5 주말 (회색)
    `</dxfs>` +
    `</styleSheet>`;

  // ═══ workbook / 관계 / Content_Types ═══
  const wbXml = XMLH + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    `<sheet name="WBS" sheetId="1" r:id="rId1"/>` +
    `<sheet name="공휴일" sheetId="2" r:id="rId2"/>` +
    `<sheet name="팀원" sheetId="3" r:id="rId3"/>` +
    `<sheet name="사용법" sheetId="4" r:id="rId4"/>` +
    `</sheets>` +
    `<definedNames>` +
    `<definedName name="ChartUnit">WBS!$B$3</definedName>` +
    `<definedName name="HolidayList">공휴일!$A$2:$A$${HOL_MAX + 1}</definedName>` +
    `<definedName name="TeamList">팀원!$A$2:$A$${TEAM_MAX + 1}</definedName>` +
    `</definedNames>` +
    `<calcPr calcId="191029" fullCalcOnLoad="1"/>` +
    `</workbook>`;

  return zipBytes([
    { path: "[Content_Types].xml", content: XMLH + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { path: "_rels/.rels", content: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: "xl/workbook.xml", content: wbXml },
    { path: "xl/_rels/workbook.xml.rels", content: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { path: "xl/styles.xml", content: stylesXml },
    { path: "xl/worksheets/sheet1.xml", content: wbsSheet },
    { path: "xl/worksheets/sheet2.xml", content: holSheet },
    { path: "xl/worksheets/sheet3.xml", content: teamSheet },
    { path: "xl/worksheets/sheet4.xml", content: usageSheet },
  ]);
}

// ── PPTX ─────────────────────────────────────────────────────
const PPT_THEME = XMLH + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
function pptTextBox(id, name, x, y, w, h, text, size, bold, color) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xesc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${text.split("\n").map(line =>
    `<a:p><a:r><a:rPr lang="ko-KR" sz="${size}"${bold ? ' b="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${xesc(line)}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>`;
}
function makePptx({ title, lines }) {
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const slide1 = XMLH + `<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    pptTextBox(2, "Title", 457200, 1600200, 8229600, 1143000, title, 3200, true, "1F3864") +
    pptTextBox(3, "Body", 457200, 2971800, 8229600, 2286000, lines.join("\n"), 1600, false, "404040") +
    `</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>`;
  const master = XMLH + `<p:sldMaster ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;
  const layout = XMLH + `<p:sldLayout ${NS} type="blank"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const presentation = XMLH + `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const REL = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
  return zipBytes([
    { path: "[Content_Types].xml", content: XMLH + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>' },
    { path: "_rels/.rels", content: XMLH + `<Relationships ${REL}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
    { path: "ppt/presentation.xml", content: presentation },
    { path: "ppt/_rels/presentation.xml.rels", content: XMLH + `<Relationships ${REL}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>` },
    { path: "ppt/slideMasters/slideMaster1.xml", content: master },
    { path: "ppt/slideMasters/_rels/slideMaster1.xml.rels", content: XMLH + `<Relationships ${REL}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>` },
    { path: "ppt/slideLayouts/slideLayout1.xml", content: layout },
    { path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", content: XMLH + `<Relationships ${REL}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` },
    { path: "ppt/theme/theme1.xml", content: PPT_THEME },
    { path: "ppt/slides/slide1.xml", content: slide1 },
    { path: "ppt/slides/_rels/slide1.xml.rels", content: XMLH + `<Relationships ${REL}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` },
  ]);
}


// 우선순위 표시: 방법론 테일러링의 M/O 표기와 통일 (구버전 "필수"/"선택" 저장분 호환)
function prioInfo(p) {
  const s = String(p || "");
  if (s.startsWith("필수")) return { label: "필수(M)", color: T.red };
  if (s.startsWith("권장")) return { label: "권장", color: T.amber };
  return { label: "선택(O)", color: T.muted };
}

// 산출물 이름으로 Office 형식 자동 배정
function pickOfficeFormat(name) {
  const n = String(name || "");
  if (/오리엔테이션|교육|발표|데모 자료/.test(n)) return "pptx";
  if (/매트릭스|대장|목록|리스트|백로그|체크리스트|WBS|추적표|현황|내역서|데이터|Data|차트|조견표/.test(n)) return "xlsx";
  return "docx";
}

// WBS 산출물 전용 — ④ 일정 계획 표 전체(요약 롤업·계층 들여쓰기·공휴일 포함)를 그대로 담는다
function wbsXlsxRows(wbs, meta) {
  const today = new Date().toLocaleDateString("ko-KR");
  const rollup = (t) => {
    const ss = (t.subtasks||[]).map(s=>s.start).filter(Boolean).sort();
    const ff = (t.subtasks||[]).map(s=>s.finish).filter(Boolean).sort();
    const eff = (t.subtasks||[]).reduce((n,s)=>n+(Number(s.effort)||0),0);
    return { start: ss[0]||"", finish: ff.slice(-1)[0]||"", eff };
  };
  const rows = [
    ["문서명", "WBS (일정 계획)"], ["프로젝트명", meta.name||""], ["고객사", meta.client||""], ["PM", meta.pm||""],
    ["프로젝트 기간", `${meta.startDate||""} ~ ${meta.endDate||""}`], ["작성일", today], ["버전", "V0.1 (초안)"],
  ];
  if ((wbs.holidays||[]).length) rows.push(["공휴일", wbs.holidays.join(", ")]);
  rows.push([]);
  rows.push(["WBS", "Task", "산출물", "작업자", "선행", "시작일", "종료일", "공수(일)"]);
  (wbs.tasks||[]).forEach(t => {
    const r = rollup(t);
    rows.push([t.wbsCode, t.phase, "요약 (하위 롤업)", "", "", r.start, r.finish, r.eff ? String(r.eff) : ""]);
    (t.subtasks||[]).forEach(s => {
      const indent = "  ".repeat(Math.max(0, (s.level||2) - 2));
      rows.push([s.wbsCode, indent + (s.task||""), s.deliverable||"", s.assignee||"", s.pred||"", s.start||"", s.finish||"", s.effort ? String(s.effort) : ""]);
    });
  });
  return rows;
}

// ── OSSP 라이브러리 산출물템플릿 매칭 ─────────────────────────
// 템플릿 파일명 정규화: 폴더 경로·확장자·버전 표기(_v2.0 등)·선두 코드(RD1202 - 등)·괄호·구분자 제거
function normDocName(s) {
  let x = String(s || "");
  x = x.split("/").pop();
  x = x.replace(/\.[A-Za-z0-9]+$/, "");
  x = x.replace(/[\s_\-]*v\d+([._\s]\d+)*$/i, "");
  x = x.replace(/^[A-Za-z]{1,4}\d{3,5}\s*[-–—_.]?\s*/, "");
  x = x.replace(/\(.*?\)/g, "");
  x = x.replace(/[\s_\-·.]/g, "");
  return x.toLowerCase();
}
const _osspTplCache = {};   // ossp_id(또는 "*"=전체) → 산출물템플릿 파일 목록 (세션 캐시)
async function fetchOsspTemplates(osspId) {
  const key = osspId || "*";
  if (_osspTplCache[key]) return _osspTplCache[key];
  const res = await fetch(osspId ? `/api/ossp-files?ossp_id=${osspId}` : "/api/ossp-files");
  const data = await res.json();
  const list = (Array.isArray(data) ? data : []).filter(f => f.category === "산출물템플릿");
  _osspTplCache[key] = list;
  return list;
}
// 위저드의 내장 OSSP는 하드코딩 id("waterfall" 등)라 DB UUID가 아님 → 이름으로 DB 행을 찾아 UUID 해석
const _osspListCache = { list: null };
async function resolveOsspDbId(ossp) {
  if (!ossp) return null;
  const id = String(ossp.id || "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
  try {
    if (!_osspListCache.list) {
      const res = await fetch("/api/ossp");
      const data = await res.json();
      _osspListCache.list = Array.isArray(data) ? data : [];
    }
    const name = ossp.label || ossp.name || "";
    const row = _osspListCache.list.find(o => o.name === name);
    return row?.id || null;
  } catch (_) { return null; }
}
function findTemplateFor(docName, templates) {
  const target = normDocName(docName);
  if (!target) return null;
  let exact = null, partial = null;
  for (const f of templates) {
    const t = normDocName(f.file_name);
    if (!t) continue;
    if (t === target) { exact = f; break; }
    if (!partial && (t.includes(target) || target.includes(t))) partial = f;
  }
  return exact || partial;
}
async function fetchTemplateBytes(f) {
  const res = await fetch(`/api/ossp-files?path=${encodeURIComponent(f.file_url)}&name=${encodeURIComponent(f.file_name)}`);
  const data = await res.json();
  if (!data?.url) return null;
  const fileRes = await fetch(data.url);
  if (!fileRes.ok) return null;
  return new Uint8Array(await fileRes.arrayBuffer());
}
// 동적 실데이터로 생성해야 하는 특수 산출물 여부 (템플릿보다 우선)
function isDynamicDoc(doc, wbs, ctx) {
  const n = String(doc.name || "").replace(/\s/g, "");
  if (n.toUpperCase() === "WBS" && wbs?.tasks?.length) return true;
  if (n === "테일러링결과서" && ctx?.tailoring) return true;
  if (reqDocKindFor(doc.name, ctx) && ctx?.requirements?.items?.length) return true;   // 확정된 요구사항이 있으면 정의서·명세서를 실문서로 생성
  return false;
}
// ── 요구사항 → 헤더 매핑형 xlsx 채움 (OSSP 가이드의 reqXlsxFill 설정 기반) ─────────────
// 시트에서 설정된 헤더 라벨이 2개 이상 있는 행을 헤더로 찾고, 그 아래를 요구사항 행으로 다시 쓴다.
// 헤더 다음 행의 셀 서식(테두리 등)을 열별로 재사용한다. 헤더에 없는 라벨은 무시한다.
async function injectRequirementsIntoXlsxByHeader(bytes, cfg, req) {
  const all = req?.items || [];
  const items = Array.isArray(cfg?.types) && cfg.types.length ? all.filter(it => cfg.types.includes(it.type || "기능")) : all;
  if (!items.length || !cfg?.cols) return null;
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  const read = p => { const f = byPath[p]; return f ? (typeof f.content === "string" ? f.content : td.decode(f.content)) : ""; };
  const unesc = x => String(x).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const norm = x => String(x || "").replace(/[\s\u00a0]/g, "");
  const sst = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const wbXml = read("xl/workbook.xml"), relXml = read("xl/_rels/workbook.xml.rels");
  const relMap = {}; [...relXml.matchAll(/<Relationship\b[^>]*>/g)].forEach(m => { const id = /Id="([^"]+)"/.exec(m[0]); const tg = /Target="([^"]+)"/.exec(m[0]); if (id && tg) relMap[id[1]] = tg[1]; });
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ name: unesc(/name="([^"]+)"/.exec(m[0])?.[1] || ""), rid: /r:id="([^"]+)"/.exec(m[0])?.[1] || "" }))
    .map(s => ({ ...s, path: relMap[s.rid] ? "xl/" + relMap[s.rid].replace(/^\//, "").replace(/^xl\//, "") : "" })).filter(s => byPath[s.path]);
  const ordered = [...sheets.filter(s => cfg.sheet && s.name === cfg.sheet), ...sheets.filter(s => !(cfg.sheet && s.name === cfg.sheet))];
  const labels = Object.keys(cfg.cols).map(norm);
  const cellText = (attrs, inner) => {
    if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner || ""); return v ? (sst[Number(v[1])] || "") : ""; }
    if (/t="inlineStr"/.test(attrs)) return unesc([...(inner || "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner || ""); return v ? unesc(v[1]) : "";
  };
  for (const sh of ordered) {
    let xml = read(sh.path);
    const sd = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml);
    if (!sd) continue;
    const rows = [...sd[1].matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)].map(m => {
      const rn = Number(/\br="(\d+)"/.exec(m[1])?.[1] || 0);
      const cells = [...(m[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => ({
        col: /\br="([A-Z]+)\d+"/.exec(c[1])?.[1] || "", s: /\bs="(\d+)"/.exec(c[1])?.[1] || "", text: cellText(c[1], c[2]) }));
      return { raw: m[0], rn, attrs: m[1], cells };
    });
    const hdr = rows.find(r => r.cells.filter(c => labels.includes(norm(c.text))).length >= 2);
    if (!hdr) continue;
    const colOf = {}; hdr.cells.forEach(c => { if (c.col && c.text) colOf[norm(c.text)] = c.col; });
    const hdrCols = hdr.cells.filter(c => c.col && c.text).map(c => c.col);
    const styleRow = rows.find(r => r.rn === hdr.rn + 1);
    const styleOf = {}; (styleRow?.cells || []).forEach(c => { if (c.col && c.s) styleOf[c.col] = c.s; });
    const text = it => `${it.name || ""} ${it.summary || ""} ${it.detail || ""}`;
    const derive = (spec, it, i) => {
      if (spec && typeof spec === "object") {
        if (spec.seq) return `${spec.seq}${String(i + 1).padStart(spec.pad || 3, "0")}`;
        if (spec.const !== undefined) return spec.const;
        return "";
      }
      switch (spec) {
        case "id": return it.id || "";
        case "name": return it.name || "";
        case "source": return it.source || "";
        case "type": return it.type || "";
        case "priority": return it.priority || "";
        case "summary": return it.summary || it.name || "";
        case "nameSummary": return [it.name, it.summary].filter(Boolean).join(" — ");
        case "module": return (!it.wbsNo || it.wbsNo === "공통") ? "공통" : it.wbsNo;
        case "bus": {   // 요구사항 문장에 명시된 버스만 표기 (추정 금지)
          const t = text(it);
          if (/CAN[\s-]?FD/i.test(t)) return "CAN FD";
          const cb = /CAN[\s-]?([A-Z])\b/.exec(t); if (cb) return `CAN-${cb[1]}`;
          if (/\bCAN\b/i.test(t)) return "CAN";
          if (/\bLIN\b/i.test(t)) return "LIN";
          if (/Ethernet|이더넷|SOME\/IP|DoIP/i.test(t)) return "Ethernet";
          return "";
        }
        case "message": { const m = /\b([A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+)\b/.exec(text(it)); return m ? m[1] : ""; }
        case "periodMs": { const m = /(\d+)\s*ms\s*주기|주기\s*(\d+)\s*ms/i.exec(text(it)); return m ? (m[1] || m[2]) : ""; }
        default: return "";
      }
    };
    const newRows = items.map((it, i) => {
      const r = hdr.rn + 1 + i;
      const vals = {};
      Object.entries(cfg.cols).forEach(([label, spec]) => { const col = colOf[norm(label)]; if (col) vals[col] = derive(spec, it, i); });
      const cells = hdrCols.map(col => {
        const s = styleOf[col] ? ` s="${styleOf[col]}"` : "";
        const v = vals[col];
        return v ? `<c r="${col}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>` : `<c r="${col}${r}"${s}/>`;
      }).join("");
      return `<row r="${r}">${cells}</row>`;
    }).join("");
    // 헤더 이전 행은 유지, 헤더 이후 행(빈 양식 행)은 요구사항 행으로 교체
    const before = rows.filter(r => r.rn <= hdr.rn).map(r => r.raw).join("");
    xml = xml.replace(sd[0], `<sheetData>${before}${newRows}</sheetData>`);
    byPath[sh.path].content = xml;
    return zipBytes(files);
  }
  return null;
}

// 산출물 1건 → 파일 결정: 특수 산출물 → OSSP 템플릿 실파일 → 스켈레톤 순
// ═══════════════════════════════════════════════════════════════════════════
// ASPICE V-모델 산출물 생성기 (src/aspiceEngineering.js 추적 모델 → docx/xlsx)
// 모든 문서는 하나의 추적 모델(requirements.aspice)에서 렌더링되므로 문서 간 ID·할당·검증 대상이 항상 일치한다.
// ═══════════════════════════════════════════════════════════════════════════
// docx → 텍스트 (제목 스타일 문단은 "§ " 접두) — 템플릿 WP 충족도 점검용
async function docxOutlineText(bytes) {
  const files = await unzipBytes(bytes);
  const td = new TextDecoder();
  const read = p => { const f = files.find(x => x.path === p); return f ? (typeof f.content === "string" ? f.content : td.decode(f.content)) : ""; };
  const doc = read("word/document.xml"); if (!doc) return "";
  const styles = read("word/styles.xml");
  const heads = new Set();
  for (const m of styles.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const nm = /<w:name w:val="([^"]+)"/.exec(m[2]);
    if (/<w:outlineLvl/.test(m[2]) || (nm && /heading|제목\s*\d|^title$/i.test(nm[1]))) heads.add(m[1]);
  }
  const unesc = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
  const out = [];
  for (const p of doc.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []) {
    const ps = /<w:pStyle w:val="([^"]+)"/.exec(p);
    const t = unesc(p.replace(/<w:tab[^>]*\/>/g, "\t").replace(/<[^>]+>/g, ""));
    out.push(((ps && heads.has(ps[1])) || /<w:outlineLvl/.test(p)) ? "§ " + t.trim() : t);
  }
  return out.join("\n");
}

// 다중 시트 xlsx (머리글 강조·테두리·줄바꿈·열너비·틀고정) — 검증 명세·RTM용
// sheets: [{ name, rows:[[셀…]], widths:[문자수…], headerRows:[행 인덱스…], titleRows:[행 인덱스…], freezeRow }]
// sheets: [{ name, rows:[[셀…]], widths, headerRows, titleRows, freezeRow, merges:["B4:F4"], rowHeights:{행번호:높이} }]
//   셀은 문자열 또는 { v, s } (s = 스타일 번호: 4 표지 제목, 5 표지 부제, 6 정보표 라벨, 7 정보표 값, 8 작은 회색(우측), 9 우측 정렬 굵게, 10 좌측 굵게)
// opts: { header, footer } — 모든 시트의 인쇄 머리말·꼬리말(&L/&C/&R, &P 쪽번호, &N 전체 쪽수)
function makeXlsxBook(sheets, opts = {}) {
  const stylesXml = XMLH + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="6"><font><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="13"/><name val="맑은 고딕"/></font>' +
    '<font><b/><sz val="22"/><name val="맑은 고딕"/></font><font><b/><i/><sz val="14"/><name val="맑은 고딕"/></font><font><sz val="9"/><color rgb="FF808080"/><name val="맑은 고딕"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF999999"/></left><right style="thin"><color rgb="FF999999"/></right><top style="thin"><color rgb="FF999999"/></top><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const sheetXml = sh => {
    const hdr = new Set(sh.headerRows || []), ttl = new Set(sh.titleRows || []);
    const firstHdr = Math.min(...(sh.headerRows || [0]));
    const cols = (sh.widths || []).length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    const pane = sh.freezeRow ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freezeRow}" topLeftCell="A${sh.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "";
    const rh = sh.rowHeights || {};
    const rows = (sh.rows || []).map((cells, ri) => {
      const base = ttl.has(ri) ? 3 : hdr.has(ri) ? 1 : (ri > firstHdr && (sh.headerRows || []).length) ? 2 : 0;
      const ht = rh[ri + 1] ? ` ht="${rh[ri + 1]}" customHeight="1"` : "";
      return `<row r="${ri + 1}"${ht}>` + (cells || []).map((c, ci) => {
        const v = (c && typeof c === "object") ? c.v : c;
        const st = (c && typeof c === "object" && c.s != null) ? c.s : base;
        return `<c r="${colLetter(ci)}${ri + 1}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
      }).join("") + "</row>";
    }).join("");
    const merges = (sh.merges || []).length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    const print = `<pageMargins left="0.6" right="0.6" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${sh.cover ? "portrait" : "landscape"}" fitToWidth="1" fitToHeight="0"/>` +
      ((opts.header || opts.footer) && !sh.cover ? `<headerFooter>${opts.header ? `<oddHeader>${xesc(opts.header)}</oddHeader>` : ""}${opts.footer ? `<oddFooter>${xesc(opts.footer)}</oddFooter>` : ""}</headerFooter>` : "");
    return XMLH + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${pane}${cols}<sheetData>${rows}</sheetData>${merges}${print}</worksheet>`;
  };
  const safeName = (n, i) => (String(n || `Sheet${i + 1}`).replace(/[\\/?*\[\]:]/g, " ").slice(0, 30).trim() || `Sheet${i + 1}`);
  const names = sheets.map((sh, i) => safeName(sh.name, i));
  return zipBytes([
    { path: "[Content_Types].xml", content: XMLH + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + "</Types>" },
    { path: "_rels/.rels", content: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: "xl/workbook.xml", content: XMLH + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xesc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { path: "xl/_rels/workbook.xml.rels", content: XMLH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { path: "xl/styles.xml", content: stylesXml },
    ...sheets.map((sh, i) => ({ path: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(sh) })),
  ]);
}

// ── xlsx 표준 프레임: 표지 시트(문서 제목·프로젝트·문서번호·버전·작성일·문서정보표·서명란·제.개정 이력) + 인쇄 머리말·꼬리말 ──
// docx 표준양식(docxStdParts)과 같은 항목을 담는다. 로고 이미지는 xlsx 표지에는 넣지 않고 조직명으로 대신한다.
function xlsxStdParts({ title, docCode, phase, meta, infoRows = [] }) {
  const code = docCodeWithPrefix(docCode, meta);
  const ap = docApprovers(meta);
  const today = new Date().toISOString().slice(0, 10);
  const L = (v) => ({ v, s: 6 }), V = (v) => ({ v: v || "", s: 7 });
  const rows = [
    [], [], [],
    ["", { v: title, s: 4 }], [],
    ["", { v: meta.name || "{프로젝트 명}", s: 5 }], [],
    ["", { v: `문서번호 : ${code}`, s: 9 }],
    ["", { v: "Version 0.1", s: 5 }],
    ["", { v: today, s: 9 }], [],
    ["", { v: ap.org || "", s: 9 }],
    ["", { v: ap.orgNameEn || "", s: 8 }], [], [],
    ["", L("프로젝트"), V(meta.name), L("단계"), V(phase)],
    ["", L("시스템"), V(systemNameOf(meta)), L("문서번호"), V(code)],
    ["", L("작성자"), V(ap.author), L("작성일자"), V(today)],
    ["", L("검토자"), V(ap.reviewer), L("승인자"), V(ap.approver)],
    ["", L("작성조직"), V(ap.org), L("배포구분"), V(ap.distribution)],
    ...infoRows.map(([k, v]) => ["", L(k), V(v), L(""), V("")]),
    [],
    ["", { v: "사용 권한 — 본 문서는 작성·검토·승인하여 승인된 원본을 보관한다.", s: 10 }],
    ["", L("구분"), L("성명"), L("서명"), L("일자")],
    ["", V("작성자"), V(ap.author), V(""), V("")],
    ["", V("검토자"), V(ap.reviewer), V(""), V("")],
    ["", V("승인자"), V(ap.approver), V(""), V("")],
    [],
    ["", { v: "제.개정 이력", s: 10 }],
    ["", L("버전"), L("변경일자"), L("제.개정 내용"), L("작성자")],
    ["", V("0.1"), V(today), V("최초 작성 (SPIDer QA Agent 추적 모델에서 생성된 초안)"), V(ap.author)],
    ["", V(""), V(""), V(""), V("")],
    ["", V(""), V(""), V(""), V("")],
  ];
  const info0 = 15;   // 정보표 시작 행(0-based)
  const merges = ["B4:E4", "B6:E6", "B8:E8", "B9:E9", "B10:E10", "B12:E12", "B13:E13"];
  const cover = { name: "표지", rows, widths: [3, 16, 34, 16, 30], merges, cover: true, rowHeights: { 4: 36, 6: 24, 9: 22 } };
  const footerNote = DOC_SETTINGS.docFooter ? `\n${DOC_SETTINGS.docFooter}` : "";
  return { cover, opts: { header: `&L&"맑은 고딕,Regular"&8${title}&R&8${ap.org || ""}`, footer: `&L&8${code}&C&8${meta.name || ""}${footerNote}&R&8&P / &N` } };
}
const ASPICE_STATUS = ["Draft", "Reviewed", "Agreed", "Rejected"];
const charStateLabel = { ok: "충족", input: "자료 확보(작성 대기)", gap: "누락(TBD)", na: "해당 없음" };

// 문서 공통: 문서 정보 표 + ASPICE 적용 기준 표 + 1장 개요
// ── 프로젝트·프로세스 요구(비제품 요구) 분리 ──
// 인도물·보고·인증·프로세스 준수처럼 제품 기능이 아닌 이해관계자 요구는 reqClass:"project"로 표시한다.
// 이런 요구는 시스템 요소에 할당하거나 SW/HW 요구로 분해하지 않고(SYS.3/SWE.1 범위 밖), RTM의 별도 시트에서
// 관리 프로세스(MAN.3·SUP 등)·관리 산출물·확인 방법으로 추적한다.
const aeIsProjectReq = r => r?.reqClass === "project";
function aeProductModel(m) {
  const prj = new Set((m.reqs.SYS || []).filter(aeIsProjectReq).map(r => r.id));
  if (!prj.size) return m;
  return { ...m, reqs: { ...m.reqs, SYS: m.reqs.SYS.filter(r => !prj.has(r.id)) },
    alloc: { ...m.alloc, SYS: Object.fromEntries(Object.entries(m.alloc.SYS || {}).filter(([k]) => !prj.has(k))) } };
}
// 설계서 추가 절(archInfo) 렌더링 — { title, text|[text], header, rows } 목록
function aeInfoSections(list, secNo) {
  let out = "", sub = 0;
  (list || []).forEach(x => {
    out += docxP(`${secNo}.${++sub} ${x.title}`, { bold: true, size: 22, spacingAfter: 80 });
    [].concat(x.text || []).forEach(t => { out += docxP(t, { size: 20, spacingAfter: 100 }); });
    if (x.rows && x.rows.length) out += docxTable([x.header || [], ...x.rows], -1);
  });
  return out;
}
function aspiceFrontBody({ kind, model, meta, doc, title, extraRows = [] }) {
  const D = AE.ASPICE_DOCS[kind];
  const docNo = projectDocNo(meta, doc?.code || D.code);
  const ap = docApprovers(meta);
  const today = new Date().toLocaleDateString("ko-KR");
  const ver = AE.ASPICE_VERSIONS.find(v => v.id === model.version)?.label || model.version;
  return docxP(title, { bold: true, size: 36, spacingAfter: 60 }) +
    docxP(meta.name || "", { bold: true, size: 26, spacingAfter: 240 }) +
    docxTable([
      ["문서번호", docNo], ["버전", "V0.1 (초안)"], ["고객사", meta.client || "-"], ["작성일", today],
      ["작성자", ap.author || "-"], ["검토·승인", [ap.reviewer, ap.approver].filter(Boolean).join(" / ") || "-"],
      ["적용 기준", `Automotive SPICE ${ver}`],
      ["프로세스", AE.procLabel(D.proc.split("~")[0], model.version)],
      ["정보항목(WP)", AE.wpLabel(kind, model.version)],
      ...extraRows,
    ], 1) +
    docxP(`※ 본 문서는 ${APP_NAME}의 ASPICE 추적 모델에서 생성된 초안입니다. 상태가 Draft인 항목은 검토·합의(GP 2.2.4) 후 확정하고, 'TBD'는 입력자료 확보 후 보완해야 합니다.`, { size: 18, spacingAfter: 200 });
}
// WP 특성 충족 점검표 (부록) — 누락은 숨기지 않고 TBD로 드러낸다
function aspiceCharAppendix(model, group, secNo) {
  const list = AE.charStatusList(model, group);
  if (!list.length) return "";
  const rows = [["No", "WP 특성", "출처(버전별)", "구분", "판정", "비고"]];
  list.forEach((c, i) => rows.push([String(i + 1), c.label, c.source, c.origin === "ASPICE" ? "ASPICE" : `${c.origin}(선택)`, charStateLabel[c.state] || c.state, [c.manual ? `수동 판정${c.note ? `: ${c.note}` : " (사유 미기록)"}` : c.byTplOnly ? "템플릿 절에서 작성" : c.byModel ? "모델 내용으로 확인" : "", !c.manual && c.state === "gap" ? "입력자료 확보 후 작성 (TBD)" : ""].filter(Boolean).join(" · ")]));
  const s = list.reduce((o, c) => { o[c.state] = (o[c.state] || 0) + 1; return o; }, {});
  return docxP(`${secNo}. 부록 — ASPICE WP 특성 충족 점검표`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP(`충족 ${s.ok || 0} · 작성 대기 ${s.input || 0} · 누락(TBD) ${s.gap || 0} · 해당 없음 ${s.na || 0} — 판정은 모델 내용·입력자료 체크리스트·수동 판정 순으로 결정됨`, { size: 18, spacingAfter: 100 }) +
    docxTable(rows, -1);
}

// SW / HW 요구사항 명세서 (SWE.1 / HWE.1)
function makeAspiceReqDocx(level, meta, ctx, doc) {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const kind = level === "SW" ? "SW_RS" : "HW_RS";
  const title = doc?.name || AE.ASPICE_DOCS[kind].title;
  const { front, pkgOpts } = docxStdParts({ title, docCode: projectDocNo(meta, doc?.code || AE.ASPICE_DOCS[kind].code), phase: AE.LEVELS[level].reqProc, meta });
  const reqs = model.reqs[level];
  const sysById = Object.fromEntries(model.reqs.SYS.map(r => [r.id, r]));
  const sysComp = Object.fromEntries(model.comps.SYS.map(c => [c.id, c]));
  const comp = Object.fromEntries(model.comps[level].map(c => [c.id, c]));
  let body = aspiceFrontBody({ kind, model, meta, doc, title, extraRows: [["요구사항 합계", `${reqs.length}건 (기능 ${reqs.filter(r => r.type === "기능").length} · 비기능 ${reqs.filter(r => r.type === "비기능").length} · 인터페이스 ${reqs.filter(r => r.type === "인터페이스").length})`]] });
  let sec = 0;
  body += docxP(`${++sec}. 개요`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP(`본 문서는 시스템 요구사항 중 ${level === "SW" ? "소프트웨어" : "하드웨어"} 포함 시스템 요소에 할당된 요구를 ${level} 관점으로 구체화한 ${level} 요구사항을 정의한다. 각 요구는 상위 시스템 요구로 양방향 추적되며(${AE.bpLabel(level === "SW" ? "SW_TRACE" : "HW_TRACE", model.version)}), 검증 기준을 갖는다.`) +
    (model.version !== "4.0" && level === "HW" ? docxP("※ ASPICE 3.1 PRM에는 HW 엔지니어링 프로세스가 없으므로, 본 문서는 ASPICE 4.0 HWE.1을 PAM 확장으로 준용한다.", { size: 18, spacingAfter: 120 }) : "");
  body += docxP(`${++sec}. ${level} 요구사항 목록`, { bold: true, size: 26, spacingAfter: 120 });
  const rows = [["No", "ID", "요구사항명", "유형", "상위 시스템 요구", "할당 컴포넌트", "검증 방법", "상태"]];
  reqs.forEach((r, i) => rows.push([String(i + 1), r.id, r.title || "", r.type || "", (r.parents || []).join(", "), (model.alloc[level][r.id] || []).map(c => comp[c]?.name || c).join(", ") || "미할당", r.verifMethod || "", r.status || "Draft"]));
  body += docxTable(rows, -1);
  body += docxP(`${++sec}. ${level} 요구사항 명세`, { bold: true, size: 26, spacingAfter: 120 });
  reqs.forEach(r => {
    body += docxP(`${r.id} · ${r.title || ""}`, { bold: true, size: 22, spacingAfter: 80 }) + docxTable([
      ["요구 내용", r.text || ""], ["유형 / 우선순위", `${r.type || ""} / ${r.priority || "중"}`],
      ["상위 시스템 요구", (r.parents || []).map(p => `${p} ${sysById[p]?.title || ""}`).join("; ") || "(추적 없음 — 파생 근거 기재 필요)"],
      ["관련 시스템 요소", (r.sysElems || []).map(e => sysComp[e]?.name || e).join(", ") || "-"],
      ["할당 컴포넌트", (model.alloc[level][r.id] || []).map(c => `${c} ${comp[c]?.name || ""}`).join(", ") || "미할당"],
      ["검증 방법", r.verifMethod || "-"], ["검증 기준", r.verifCriteria || "TBD"],
      ...(r.safety ? [["안전 등급", r.safety]] : []), ...(r.security ? [["보안 관련", "예"]] : []),
      ["상태", r.status || "Draft"], ...(r.note ? [["비고", r.note]] : []),
    ], 1);
  });
  const ifs = model.interfaces[level];
  if (ifs.length) {
    body += docxP(`${++sec}. ${level} 인터페이스 요구`, { bold: true, size: 26, spacingAfter: 120 }) +
      docxTable([["ID", "From", "To", "유형", "신호·데이터", "주기(ms)", "설명"], ...ifs.map(i => [i.id, comp[i.from]?.name || i.from, comp[i.to]?.name || i.to, i.kind || "", i.signals || "", String(i.periodMs || ""), i.desc || ""])], -1);
  }
  body += docxP(`${++sec}. 추적성 — 시스템 요구 → ${level} 요구`, { bold: true, size: 26, spacingAfter: 120 });
  const parents = AE.parentsForLevel(model, level);
  body += docxTable([["시스템 요구", "요구사항명", `${level} 요구`, "판정"], ...parents.map(p => {
    const ch = reqs.filter(r => (r.parents || []).includes(p.id)).map(r => r.id);
    return [p.id, p.title || "", ch.join(", ") || "-", ch.length ? "추적됨" : "미파생"];
  })], -1);
  body += aspiceCharAppendix(model, kind, ++sec);
  return docxPackage(front + body, pkgOpts);
}

// ── 아키텍처 블록 다이어그램 (SYS.3 / SWE.2 / HWE.2 정적 측면) ──
// 추적 모델의 요소·인터페이스에서 규칙 기반으로 그린다 (AI 미사용). 표와 같은 모델을 쓰므로 ID가 항상 일치한다.
// 브라우저 canvas에 동기적으로 그려 PNG로 만든다 — canvas를 쓸 수 없으면 null을 돌려주고 호출부는 TBD 안내로 폴백한다.
const ARCH_KIND_STYLE = {
  SYS: { "HW": ["DCEBFA", "2F6DB5"], "SW": ["E2F4E8", "2E8B57"], "HW+SW": ["EEE6F8", "6B4BA3"], "ME": ["F3EEE2", "8A6D3B"], "외부": ["F2F2F2", "777777"] },
  SW: { "자체 개발": ["E2F4E8", "2E8B57"], "BSW·플랫폼": ["DCEBFA", "2F6DB5"], "외부 공급": ["F2F2F2", "777777"], "자동 생성": ["FFF1D6", "B7791F"] },
  HW: { "회로 블록": ["DCEBFA", "2F6DB5"], "주요 부품": ["EEE6F8", "6B4BA3"], "전원": ["FDE4E1", "B5473A"], "커넥터·기구": ["F3EEE2", "8A6D3B"] },
  STATE: { "운영 모드": ["E8EEF9", "3B5BA9"] },   // 상태 천이도(운영 모드)
};
const ARCH_DASHED_KINDS = new Set(["외부", "외부 공급"]);
const ARCH_FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';

function archDiagramLayout(level, model, projectName) {
  const comps = (model.comps[level] || []).filter(c => c && c.id);
  if (!comps.length) return null;
  const sysName = Object.fromEntries((model.comps.SYS || []).map(c => [c.id, c.name]));
  const parentOf = c => (c.sysElem && sysName[c.sysElem] !== undefined ? c.sysElem : "");
  const parents = (level === "SW" || level === "HW") ? [...new Set(comps.map(parentOf))] : [];
  const single = parents.length === 1 && parents[0];
  const tagged = (level === "SW" || level === "HW") && !single;   // 박스마다 상위 시스템 요소 표기
  const BW = level === "SYS" ? 150 : 164, BH = tagged ? 74 : 58, GX = 90, GY = 66;
  const known = new Set(comps.map(c => c.id));
  const ifs = (model.interfaces[level] || []).filter(i => i && known.has(i.from) && known.has(i.to) && i.from !== i.to);
  const deg = {}; comps.forEach(c => { deg[c.id] = 0; });
  ifs.forEach(i => { deg[i.from]++; deg[i.to]++; });
  const boxes = {}, frames = [];
  // 격자 배치 최적화 — 연결선 길이·교차·박스 관통이 최소가 되도록 칸을 맞바꾸며 개선 (결정적, AI 미사용)
  const place = (list, cols, ox, oy) => {
    const n = list.length, rows = Math.ceil(n / cols), cx0 = (cols - 1) / 2, cy0 = (rows - 1) / 2;
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ r, c, d: Math.hypot(c - cx0, (r - cy0) * 1.2) + r * 0.001 + c * 0.0001 });
    const order = slots.map((s, k) => k).sort((a, b) => slots[a].d - slots[b].d);
    const nodes = [...list].sort((a, b) => deg[b.id] - deg[a.id] || (a.id < b.id ? -1 : 1));
    let at = Array(slots.length).fill(null);              // 칸 → 요소 id
    const ids = new Set(list.map(c => c.id));
    const E = ifs.filter(i => ids.has(i.from) && ids.has(i.to));
    const ctr = k => [slots[k].c * (BW + GX) + BW / 2, slots[k].r * (BH + GY) + BH / 2];
    const cross = (p1, p2, p3, p4) => {
      const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4;
    };
    const cost = () => {
      const pos = {}; at.forEach((id, k) => { if (id) pos[id] = ctr(k); });
      const seg = E.map(e => [pos[e.from], pos[e.to], e.from, e.to]);
      let s = 0;
      seg.forEach(([a, b, fa, fb], i) => {
        s += Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 1; t < 16; t++) {            // 다른 박스 관통
          const x = a[0] + (b[0] - a[0]) * t / 16, y = a[1] + (b[1] - a[1]) * t / 16;
          for (const id in pos) if (id !== fa && id !== fb && Math.abs(x - pos[id][0]) < BW / 2 + 6 && Math.abs(y - pos[id][1]) < BH / 2 + 6) { s += 60; }
        }
        for (let j = i + 1; j < seg.length; j++) {
          const o = seg[j]; if (fa === o[2] || fa === o[3] || fb === o[2] || fb === o[3]) continue;
          if (cross(a, b, o[0], o[1])) s += 420;
        }
      });
      return s;
    };
    const climb = () => {
      let best = cost();
      for (let it = 0; it < 40; it++) {
        let improved = false;
        for (let a = 0; a < at.length; a++) for (let b = a + 1; b < at.length; b++) {
          if (!at[a] && !at[b]) continue;
          [at[a], at[b]] = [at[b], at[a]];
          const c = cost();
          if (c < best - 0.5) { best = c; improved = true; } else [at[a], at[b]] = [at[b], at[a]];
        }
        if (!improved) break;
      }
      return best;
    };
    // 시작 배치를 여러 개(가장 연결 많은 요소를 각 칸에 두고 거리순 배치) 시도해 가장 좋은 결과를 채택 — 결정적
    let bestAt = null, bestCost = Infinity;
    const starts = [order, ...slots.map((s0, k0) => slots.map((s, k) => k).sort((a, b) =>
      Math.hypot(slots[a].c - slots[k0].c, (slots[a].r - slots[k0].r) * 1.2) - Math.hypot(slots[b].c - slots[k0].c, (slots[b].r - slots[k0].r) * 1.2) || a - b))];
    starts.forEach(ord => {
      at = Array(slots.length).fill(null);
      nodes.forEach((c, k) => { at[ord[k]] = c.id; });
      const c = climb();
      if (c < bestCost - 0.5) { bestCost = c; bestAt = [...at]; }
    });
    at = bestAt;
    // 빈 행·열을 걷어내고 좌표 확정
    const usedR = [...new Set(at.map((id, k) => id && slots[k].r).filter(v => v !== null && v !== false))].sort((x, y) => x - y);
    const usedC = [...new Set(at.map((id, k) => id && slots[k].c).filter(v => v !== null && v !== false))].sort((x, y) => x - y);
    const byId = Object.fromEntries(list.map(c => [c.id, c]));
    at.forEach((id, k) => { if (!id) return; const r = usedR.indexOf(slots[k].r), c = usedC.indexOf(slots[k].c); boxes[id] = { x: ox + c * (BW + GX), y: oy + r * (BH + GY), w: BW, h: BH, comp: byId[id] }; });
    return { w: usedC.length * BW + (usedC.length - 1) * GX, h: usedR.length * BH + (usedR.length - 1) * GY };
  };
  const colsFor = n => n <= 3 ? n : n <= 12 ? 3 : 4;   // A4 세로 본문 폭에서 글자가 읽히도록 3열 위주
  let W, H;
  if (level === "SYS") {
    const inner = comps.filter(c => c.kind !== "외부"), ext = comps.filter(c => c.kind === "외부");
    const PAD = 34, EXT_GAP = 70, topH = ext.length ? BH + EXT_GAP : 0;
    const ox = 30 + PAD, oy = 30 + topH + PAD + 14;
    const g = inner.length ? place(inner, colsFor(inner.length), ox, oy) : { w: BW, h: BH };
    const fr = { x: ox - PAD, y: oy - PAD - 14, w: g.w + PAD * 2, h: g.h + PAD * 2 + 14, label: `시스템 경계 — ${projectName || "대상 시스템"}`, dashed: true };
    frames.push(fr);
    // 외부 요소: 시스템 경계 위·아래 줄에, 연결된 내부 요소 가까이 배치 (가로 폭을 늘리지 않음)
    const midY = fr.y + fr.h / 2, top = [], bottom = [];
    const nbAvg = e => {
      const nb = ifs.filter(i => i.from === e.id || i.to === e.id).map(i => boxes[i.from === e.id ? i.to : i.from]).filter(b => b && b.comp.kind !== "외부");
      return nb.length ? { x: nb.reduce((s, b) => s + b.x + b.w / 2, 0) / nb.length, y: nb.reduce((s, b) => s + b.y + b.h / 2, 0) / nb.length } : null;
    };
    ext.forEach(e => {
      const a = nbAvg(e);
      let row = !a ? (top.length <= bottom.length ? top : bottom) : a.y <= midY ? top : bottom;
      const other = row === top ? bottom : top;
      if (row.length > other.length + 1) row = other;   // 한쪽 쏠림 방지
      row.push(e);
    });
    const layRow = (list, y) => {
      const items = list.map(e => ({ e, tx: (nbAvg(e)?.x ?? fr.x + fr.w / 2) - BW / 2 })).sort((a, b) => a.tx - b.tx);
      let end = -Infinity;
      items.forEach(it => { it.x = Math.max(30, it.tx, end + 30); end = it.x + BW; });
      const over = end - (fr.x + fr.w);
      if (over > 0 && items.length) { const sh = Math.min(over, items[0].x - 30); items.forEach(it => { it.x -= sh; }); }
      items.forEach(it => { boxes[it.e.id] = { x: it.x, y, w: BW, h: BH, comp: it.e }; });
    };
    layRow(top, 30);
    layRow(bottom, fr.y + fr.h + EXT_GAP);
    if (ext.length && !top.length) { // 위 줄이 비면 전체를 끌어올린다
      Object.values(boxes).forEach(b => { b.y -= topH; }); fr.y -= topH;
    }
    W = Math.max(fr.x + fr.w, ...Object.values(boxes).map(b => b.x + b.w)) + 30;
    H = Math.max(fr.y + fr.h, ...Object.values(boxes).map(b => b.y + b.h)) + 30;
  } else {
    // SW/HW: 상위 시스템 요소가 하나뿐이면 전체를 그 요소의 프레임으로 감싸고,
    // 여럿이면 각 박스 하단에 상위 시스템 요소를 표기한다 (작은 묶음 프레임이 선을 가리지 않도록)
    const PAD = single ? 34 : 0, LBL = single ? 14 : 0;
    const ox = 30 + PAD, oy = 30 + PAD + LBL;
    const g = place(comps, colsFor(comps.length), ox, oy);
    if (single) frames.push({ x: ox - PAD, y: oy - PAD - LBL, w: g.w + PAD * 2, h: g.h + PAD * 2 + LBL, label: `상위 시스템 요소 — ${single} ${sysName[single]}`, dashed: false });
    else if (tagged) Object.values(boxes).forEach(b => { const p = parentOf(b.comp); b.tag = p ? `상위: ${p} ${sysName[p]}` : "상위: 미지정"; });
    W = ox + g.w + PAD + 30; H = oy + g.h + PAD + 30;
  }
  // 같은 요소 쌍의 인터페이스는 한 선으로 합치고 방향을 함께 표시
  const pairs = {};
  ifs.forEach(i => {
    const [a, b] = i.from < i.to ? [i.from, i.to] : [i.to, i.from];
    const p = pairs[a + "|" + b] = pairs[a + "|" + b] || { a, b, ids: [], ab: false, ba: false };
    p.ids.push(i.id); if (i.from === a) p.ab = true; else p.ba = true;
  });
  return { boxes, frames, edges: Object.values(pairs), W, H: H + 44 /* 범례 */ };
}

function aeStateFigure(model, pkgOpts) {
  const tr = (model.modeTransitions || []).filter(t => t && t.from && t.to);
  if (!model.modes.length || !tr.length) return docxP("[그림] 상태 천이도·시퀀스 다이어그램 — 위 표 기준으로 작성하여 삽입 (TBD)", { italic: true, size: 20, spacingAfter: 120 });
  try {
    const ids = Object.fromEntries(model.modes.map((x, i) => [x.name, `M${i + 1}`]));
    const fake = { comps: { STATE: model.modes.map(x => ({ id: ids[x.name], name: x.name, kind: "운영 모드" })), SYS: [] },
      interfaces: { STATE: tr.filter(t => ids[t.from] && ids[t.to]).map(t => ({ id: t.id, from: ids[t.from], to: ids[t.to] })) } };
    const png = archDiagramPng("STATE", fake, "");
    if (!png) throw new Error("no canvas");
    const fileName = "arch_state.png", relId = "rIdArch2";
    pkgOpts.media.push({ fileName, bytes: png.bytes });
    pkgOpts.bodyImages.push({ relId, fileName });
    let cx = 5760000, cy = Math.round(cx * png.hPx / png.wPx);
    if (cy > 7920000) { cx = Math.round(cx * 7920000 / cy); cy = 7920000; }
    return `<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr>${docxImageRun(relId, cx, cy, 102)}</w:p>` +
      docxP(`[그림 2] 운영 모드 상태 천이도 — 모드 ${model.modes.length}개 · 천이 ${tr.length}건 (추적 모델 기준 자동 생성 · 천이 조건은 아래 표 참조)`, { size: 18, align: "center", spacingAfter: 160 }) +
      docxTable([["천이 ID", "From", "To", "천이 조건", "근거 요구"], ...tr.map(t => [t.id, t.from, t.to, t.cond || "", (t.reqs || []).join(", ")])], -1);
  } catch (_) {
    return docxP("[그림] 상태 천이도·시퀀스 다이어그램 — 위 표 기준으로 작성하여 삽입 (TBD)", { italic: true, size: 20, spacingAfter: 120 });
  }
}
function archDiagramPng(level, model, projectName) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const L = archDiagramLayout(level, model, projectName);
  if (!L) return null;
  const S = 2; // 인쇄 품질용 2배 해상도
  const canvas = document.createElement("canvas");
  let g = canvas.getContext && canvas.getContext("2d");
  if (!g) return null;
  const hex = c => "#" + c;
  const font = (px, bold) => `${bold ? "bold " : ""}${px}px ${ARCH_FONT}`;
  // 범례 폭을 먼저 재서 그림 폭보다 길면 두 줄로 나눈다
  const LEG_ARROW = level === "STATE" ? "천이 방향(From → To) · 라벨 = 천이 ID" : "인터페이스 방향(From → To) · 라벨 = 인터페이스 ID";
  g.font = font(11, false);
  const usedKinds = new Set(Object.values(L.boxes).map(b => b.comp.kind));
  const legKinds = Object.keys(ARCH_KIND_STYLE[level] || {}).filter(k => usedKinds.has(k));
  const legKindsW = legKinds.reduce((w, k) => w + 28 + g.measureText(k).width + 22, 0);
  const legArrowW = 38 + g.measureText(LEG_ARROW).width;
  const legTwo = 30 + legKindsW + legArrowW + 30 > L.W;
  if (legTwo) L.H += 22;
  L.W = Math.max(L.W, 30 + Math.max(legTwo ? legKindsW : 0, legArrowW) + 30);
  canvas.width = Math.ceil(L.W * S); canvas.height = Math.ceil(L.H * S);
  g = canvas.getContext("2d");   // 크기 변경 시 컨텍스트 상태가 초기화된다
  g.scale(S, S);
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, L.W, L.H);
  const rrect = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const fit = (t, px, bold, maxW) => { g.font = font(px, bold); if (g.measureText(t).width <= maxW) return t; let s = t; while (s.length > 1 && g.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s + "…"; };
  const wrap2 = (t, px, maxW) => {
    g.font = font(px, true);
    if (g.measureText(t).width <= maxW) return [t];
    let cut = t.length;
    while (cut > 1 && g.measureText(t.slice(0, cut)).width > maxW) cut--;
    const sp = t.lastIndexOf(" ", cut); if (sp > cut * 0.5) cut = sp;
    return [t.slice(0, cut).trim(), fit(t.slice(cut).trim(), px, true, maxW)];
  };
  // 프레임(시스템 경계 / 상위 시스템 요소 묶음)
  L.frames.forEach(f => {
    g.save(); rrect(f.x, f.y, f.w, f.h, 10);
    g.fillStyle = f.dashed ? "#FBFCFD" : "#F7F9FB"; g.fill();
    g.strokeStyle = "#8A97A3"; g.lineWidth = 1.2; if (f.dashed) g.setLineDash([7, 5]); g.stroke(); g.restore();
  });
  // 연결선 — 다른 박스를 관통하면 곡선으로 우회
  const boxList = Object.entries(L.boxes);
  const hit = (x, y, skip) => x < 8 || y < 8 || x > L.W - 8 || y > L.H - 52 || boxList.some(([id, b]) => !skip.has(id) && x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6);
  const clip = (b, tx, ty) => { // 박스 중심에서 (tx,ty) 방향으로 나가는 경계점
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    const s = Math.min(dx ? (b.w / 2) / Math.abs(dx) : Infinity, dy ? (b.h / 2) / Math.abs(dy) : Infinity);
    return [cx + dx * s, cy + dy * s];
  };
  const q = (p0, c, p1, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];
  const labels = [], placed = [];
  const arrow = (tip, from) => {
    const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]), l = 9;
    g.beginPath(); g.moveTo(tip[0], tip[1]);
    g.lineTo(tip[0] - l * Math.cos(a - 0.42), tip[1] - l * Math.sin(a - 0.42));
    g.lineTo(tip[0] - l * Math.cos(a + 0.42), tip[1] - l * Math.sin(a + 0.42));
    g.closePath(); g.fill();
  };
  L.edges.forEach(e => {
    const A = L.boxes[e.a], B = L.boxes[e.b];
    const ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
    const dx = cb[0] - ca[0], dy = cb[1] - ca[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const skip = new Set([e.a, e.b]);
    let best = null;
    for (const off of [0, 45, -45, 90, -90, 140, -140, 200, -200]) {
      const ctl = [(ca[0] + cb[0]) / 2 + nx * off * 2, (ca[1] + cb[1]) / 2 + ny * off * 2];
      const p0 = clip(A, ctl[0], ctl[1]), p1 = clip(B, ctl[0], ctl[1]);
      let hits = 0; for (let k = 1; k < 24; k++) { const p = q(p0, ctl, p1, k / 24); if (hit(p[0], p[1], skip)) hits++; }
      if (!best || hits < best.hits) best = { hits, ctl, p0, p1 };
      if (!hits) break;
    }
    g.strokeStyle = "#3D4852"; g.fillStyle = "#3D4852"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(best.p0[0], best.p0[1]); g.quadraticCurveTo(best.ctl[0], best.ctl[1], best.p1[0], best.p1[1]); g.stroke();
    if (e.ab) arrow(best.p1, best.ctl);
    if (e.ba) arrow(best.p0, best.ctl);
    labels.push({ e, best });
  });
  // 프레임 이름 — 연결선 위에 바탕을 깔아 가려지지 않게
  L.frames.forEach(f => {
    const t = fit(f.label, 12, true, f.w - 24), tw = g.measureText(t).width;
    g.fillStyle = f.dashed ? "#FBFCFD" : "#F7F9FB"; g.fillRect(f.x + 8, f.y + 4, tw + 8, 18);
    g.fillStyle = "#4A5560"; g.textBaseline = "top"; g.textAlign = "left"; g.fillText(t, f.x + 12, f.y + 7);
  });
  // 요소 박스
  boxList.forEach(([id, b]) => {
    const c = b.comp, st = (ARCH_KIND_STYLE[level] || {})[c.kind] || ["F7F7F7", "555555"];
    g.save(); rrect(b.x, b.y, b.w, b.h, 7); g.fillStyle = hex(st[0]); g.fill();
    g.strokeStyle = hex(st[1]); g.lineWidth = 1.6; if (ARCH_DASHED_KINDS.has(c.kind)) g.setLineDash([5, 4]); g.stroke(); g.restore();
    g.textAlign = "center"; g.textBaseline = "top";
    if (level !== "STATE") { g.fillStyle = hex(st[1]); g.font = font(10.5, false); g.fillText(id, b.x + b.w / 2, b.y + 6); }
    const lines = wrap2(c.name || "", 13, b.w - 14);
    g.fillStyle = "#1E2B33"; g.font = font(13, true);
    const y0 = level === "STATE" ? (lines.length === 1 ? b.y + b.h / 2 - 8 : b.y + b.h / 2 - 16)
      : b.tag ? (lines.length === 1 ? b.y + 29 : b.y + 22) : (lines.length === 1 ? b.y + 28 : b.y + 21);
    lines.forEach((t, k) => g.fillText(t, b.x + b.w / 2, y0 + k * 16));
    if (b.tag) {
      g.font = font(10, false);
      const tpx = g.measureText(b.tag).width <= b.w - 12 ? 10 : 9;   // 길면 한 단계 줄이고, 그래도 넘치면 말줄임
      g.fillStyle = "#5B6770"; g.fillText(fit(b.tag, tpx, false, b.w - 12), b.x + b.w / 2, b.y + b.h - 17);
    }
  });
  // 인터페이스 ID 라벨 — 서로 겹치지 않는 위치를 곡선 위에서 찾는다
  g.font = font(11, false);
  const ov = (r, o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y;
  const boxRects = boxList.map(([, b]) => b);
  labels.forEach(({ e, best }) => {
    const curveLen = Math.hypot(best.p1[0] - best.p0[0], best.p1[1] - best.p0[1]);
    let txt = e.ids.length > 2 ? `${e.ids[0]} 외 ${e.ids.length - 1}` : e.ids.join(", ");
    const horiz = Math.abs(best.p1[0] - best.p0[0]) > Math.abs(best.p1[1] - best.p0[1]);
    if (e.ids.length === 2 && horiz && g.measureText(txt).width + 8 > Math.max(curveLen - 20, 60)) txt = `${e.ids[0]} 외 1`;
    const w = g.measureText(txt).width + 8, h = 16;
    let pos = null, fallback = null;
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.25, 0.75]) {
      const p = q(best.p0, best.ctl, best.p1, t), r = { x: p[0] - w / 2, y: p[1] - h / 2, w, h };
      if (!fallback && !boxRects.some(b => ov(r, b))) fallback = r;
      if (!placed.some(o => ov(r, o)) && !boxRects.some(b => ov(r, b))) { pos = r; break; }
    }
    if (!pos) { const p = q(best.p0, best.ctl, best.p1, 0.5); pos = fallback || { x: p[0] - w / 2, y: p[1] - h / 2, w, h }; }
    pos.x = Math.min(Math.max(pos.x, 4), L.W - pos.w - 4); pos.y = Math.min(Math.max(pos.y, 4), L.H - pos.h - 48);
    placed.push(pos);
    g.fillStyle = "rgba(255,255,255,0.92)"; rrect(pos.x, pos.y, pos.w, pos.h, 3); g.fill();
    g.fillStyle = "#2B3640"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, pos.x + pos.w / 2, pos.y + pos.h / 2 + 0.5);
  });
  // 범례
  let ly = L.H - 30 - (legTwo ? 22 : 0);
  let lx = 30;
  g.textAlign = "left"; g.textBaseline = "middle"; g.font = font(11, false);
  legKinds.forEach(k => {
    const st = ARCH_KIND_STYLE[level][k];
    g.save(); rrect(lx, ly - 7, 22, 14, 3); g.fillStyle = hex(st[0]); g.fill(); g.strokeStyle = hex(st[1]); g.lineWidth = 1.4;
    if (ARCH_DASHED_KINDS.has(k)) g.setLineDash([4, 3]); g.stroke(); g.restore();
    g.fillStyle = "#3D4852"; g.fillText(k, lx + 28, ly); lx += 28 + g.measureText(k).width + 22;
  });
  if (legTwo) { lx = 30; ly += 22; }
  g.strokeStyle = "#3D4852"; g.fillStyle = "#3D4852"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 30, ly); g.stroke(); arrow([lx + 30, ly], [lx, ly]);
  g.fillText(LEG_ARROW, lx + 38, ly);
  let parsed = null;
  try { parsed = dataUrlToBytes(canvas.toDataURL("image/png")); } catch (_) { return null; }
  return parsed ? { bytes: parsed.bytes, wPx: L.W, hPx: L.H } : null;
}

// 시스템 / SW / HW 아키텍처 설계서 (SYS.3 / SWE.2 / HWE.2)
function makeAspiceArchDocx(level, meta, ctx, doc) {
  const fullModel = AE.normalizeModel(ctx?.requirements?.aspice);
  const model = aeProductModel(fullModel);
  const info = (fullModel.archInfo || {})[level] || {};
  const kind = level === "SYS" ? "SYS_AD" : level === "SW" ? "SW_AD" : "HW_AD";
  const L = AE.LEVELS[level];
  const title = doc?.name || AE.ASPICE_DOCS[kind].title;
  const { front, pkgOpts } = docxStdParts({ title, docCode: projectDocNo(meta, doc?.code || AE.ASPICE_DOCS[kind].code), phase: L.archProc, meta });
  const comps = model.comps[level], ifs = model.interfaces[level], reqs = model.reqs[level];
  const comp = Object.fromEntries(comps.map(c => [c.id, c]));
  const sysComp = Object.fromEntries(model.comps.SYS.map(c => [c.id, c]));
  let body = aspiceFrontBody({ kind, model, meta, doc, title, extraRows: [[L.compLabel, `${comps.length}개`], ["인터페이스", `${ifs.length}건`], ["할당 대상 요구", `${reqs.length}건`]] });
  let sec = 0;
  // 정적 아키텍처 블록 다이어그램 — 같은 추적 모델에서 규칙 기반으로 그려 삽입 (canvas 불가·요소 없음 → TBD 안내 폴백)
  let archFigure = docxP("[그림] 블록 다이어그램 — 아래 요소·인터페이스 표를 기준으로 작성하여 삽입 (TBD)", { italic: true, size: 20, spacingAfter: 120 });
  try {
    const png = comps.length ? archDiagramPng(level, model, meta?.name) : null;
    if (png) {
      const fileName = `arch_${level.toLowerCase()}.png`, relId = "rIdArch1";
      pkgOpts.media.push({ fileName, bytes: png.bytes });
      pkgOpts.bodyImages.push({ relId, fileName });
      let cx = 5760000, cy = Math.round(cx * png.hPx / png.wPx);      // 본문 폭 16cm 기준
      if (cy > 7920000) { cx = Math.round(cx * 7920000 / cy); cy = 7920000; }  // 세로 최대 22cm
      archFigure = `<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr>${docxImageRun(relId, cx, cy, 101)}</w:p>` +
        docxP(`[그림 1] ${level === "SYS" ? "시스템" : level} 정적 아키텍처 — ${L.compLabel} ${comps.length}개 · 인터페이스 ${ifs.length}건 (추적 모델 기준 자동 생성 · 상세는 아래 표와 3장 인터페이스 정의 참조)`, { size: 18, align: "center", spacingAfter: 200 });
    }
  } catch (_) { /* 그림 생성 실패 시 TBD 안내 유지 */ }
  body += docxP(`${++sec}. 개요`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP(`본 문서는 ${level === "SYS" ? "시스템" : level} 요구사항을 만족하기 위한 ${L.compLabel}의 정적 구조(요소·인터페이스)와 동적 거동(운영 모드·상태 천이)을 정의하고, 요구사항을 ${L.compLabel}에 할당한다.`) +
    [].concat(info.overview || []).map(t => docxP(t, { size: 20, spacingAfter: 100 })).join("") +
    (model.version !== "4.0" && level === "HW" ? docxP("※ ASPICE 3.1에는 HWE 프로세스가 없으므로 4.0 HWE.2를 PAM 확장으로 준용한다.", { size: 18, spacingAfter: 120 }) : "");
  body += docxP(`${++sec}. 정적 아키텍처 — ${L.compLabel}`, { bold: true, size: 26, spacingAfter: 120 }) +
    archFigure +
    docxTable([["ID", "명칭", "구분", ...(level === "SYS" ? [] : ["상위 시스템 요소"]), "책임(설명)"], ...comps.map(c => [c.id, c.name, c.kind || "", ...(level === "SYS" ? [] : [c.sysElem ? `${c.sysElem} ${sysComp[c.sysElem]?.name || ""}` : "-"]), c.desc || ""])], -1);
  comps.forEach(c => {
    const assigned = reqs.filter(r => (model.alloc[level][r.id] || []).includes(c.id));
    const myIf = ifs.filter(i => i.from === c.id || i.to === c.id);
    body += docxP(`${c.id} · ${c.name}`, { bold: true, size: 22, spacingAfter: 80 }) + docxTable([
      ["구분", c.kind || ""], ["책임", c.desc || "TBD"], ["개별 거동", c.behavior || "TBD"],
      ["인터페이스", myIf.map(i => `${i.id}(${i.from === c.id ? "→ " + (comp[i.to]?.name || i.to) : "← " + (comp[i.from]?.name || i.from)}, ${i.kind || ""})`).join("; ") || "-"],
      ["할당 요구", assigned.map(r => r.id).join(", ") || "없음"],
      ...(level !== "SYS" ? [["자원(RAM/ROM/CPU·전력)", c.resource || "TBD — 플랫폼 사양 확보 후 기재"]] : []),
    ], 1);
  });
  body += docxP(`${++sec}. 인터페이스 정의`, { bold: true, size: 26, spacingAfter: 120 }) +
    (ifs.length ? docxTable([["ID", "From", "To", "유형", "신호·데이터", "주기(ms)", "설명"], ...ifs.map(i => [i.id, comp[i.from]?.name || i.from, comp[i.to]?.name || i.to, i.kind || "", i.signals || "", String(i.periodMs || ""), i.desc || ""])], -1)
      : docxP("인터페이스 미정의 (TBD)", { size: 20 }));
  if (ifs.length) {
    // 요소 간 관계·의존 — 인터페이스 정의에서 결정적으로 도출 (입력을 받는 요소 = 의존 대상)
    body += docxP(`${L.compLabel} 간 관계·의존 매트릭스 (인터페이스 정의에서 자동 도출)`, { bold: true, size: 22, spacingAfter: 80 }) +
      docxTable([["요소", "의존(입력 제공 요소 ← 인터페이스)", "제공(출력 대상 요소 → 인터페이스)"], ...comps.map(c => [
        `${c.id} ${c.name}`,
        ifs.filter(i => i.to === c.id).map(i => `${comp[i.from]?.name || i.from} (${i.id})`).join(", ") || "-",
        ifs.filter(i => i.from === c.id).map(i => `${comp[i.to]?.name || i.to} (${i.id})`).join(", ") || "-"])], -1);
  }
  if (level === "SYS") {
    body += docxP(`${++sec}. 동적 아키텍처 — 운영 모드·상태`, { bold: true, size: 26, spacingAfter: 120 }) +
      (model.modes.length ? docxTable([["모드/상태", "설명", "진입·이탈 조건"], ...model.modes.map(x => [x.name, x.desc || "", x.transition || ""])], -1) : docxP("운영 모드 미정의 (TBD)", { size: 20 })) +
      aeStateFigure(model, pkgOpts) +
      [].concat(info.dynamic?.text || []).map(t => docxP(t, { size: 20, spacingAfter: 100 })).join("") +
      (info.dynamic?.rows?.length ? docxTable([info.dynamic.header || [], ...info.dynamic.rows], -1) : "");
  } else {
    body += docxP(`${++sec}. 동적 거동`, { bold: true, size: 26, spacingAfter: 120 }) +
      (info.dynamic ? [].concat(info.dynamic.text || []).map(t => docxP(t, { size: 20, spacingAfter: 100 })).join("") +
        (info.dynamic.rows?.length ? docxTable([info.dynamic.header || [], ...info.dynamic.rows], -1) : "")
        : docxP(level === "SW" ? "태스크 구조(주기·우선순위)·인터럽트·초기화/종료·오류 처리 시퀀스는 플랫폼(OS·BSW) 확정 후 기술한다 (TBD). 컴포넌트별 거동은 2장 참조." : "파워업/다운 시퀀스·전기적 상태 천이·보호 동작은 회로 설계 확정 후 기술한다 (TBD). 컴포넌트별 거동은 2장 참조.", { size: 20 }));
  }
  body += docxP(`${++sec}. 요구사항 할당 (${AE.bpLabel(level === "SYS" ? "SYS_ALLOC" : level === "SW" ? "SW_ALLOC" : "HW_ALLOC", model.version)})`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxTable([["요구 ID", "요구사항명", "유형", "할당 요소", "판정"], ...reqs.map(r => {
      const a = (model.alloc[level][r.id] || []).filter(x => comp[x]);
      return [r.id, r.title || "", r.type || "", a.map(x => `${x} ${comp[x].name}`).join(", ") || "-", a.length ? "할당" : "미할당"];
    })], -1);
  const prj = level === "SYS" ? fullModel.reqs.SYS.filter(aeIsProjectReq) : [];
  if (prj.length) body += docxP(`※ 프로젝트·프로세스 요구 ${prj.length}건(${prj.map(r => r.id).join(", ")})은 제품 기능이 아닌 인도물·보고·인증·프로세스 요구이므로 시스템 요소에 할당하지 않으며, 요구사항 추적 매트릭스의 '프로젝트·프로세스 요구' 시트에서 관리 프로세스·관리 산출물로 추적한다.`, { size: 18, spacingAfter: 160 });
  body += docxP(`${++sec}. 아키텍처 분석·설계 근거`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP(model.rationale[level] || "설계 근거·대안 평가 결과 미작성 (TBD) — 3.1 BP5/BP6(대안 평가), 4.0 04-06/04-04 'justifying rationale' 요구", { size: 20 }) +
    [].concat(info.analysis?.text || []).map(t => docxP(t, { size: 20, spacingAfter: 100 })).join("") +
    (info.analysis?.rows?.length ? docxTable([info.analysis.header || [], ...info.analysis.rows], -1) : "");
  if ((info.sections || []).length) {
    const n = ++sec;
    body += docxP(`${n}. 추가 설계 정보 (ASPICE WP 특성)`, { bold: true, size: 26, spacingAfter: 120 }) + aeInfoSections(info.sections, n);
  }
  body += aspiceCharAppendix(model, kind, ++sec);
  return docxPackage(front + body, pkgOpts);
}

// 검증 명세서·결과서 (08-50/08-52 · 08-60/08-58/06-50 · 13-50/15-52)
function makeAspiceVerifXlsx(kind, meta, ctx, doc) {
  const model = aeProductModel(AE.normalizeModel(ctx?.requirements?.aspice));
  const D = AE.ASPICE_DOCS[kind];
  const tl = AE.TEST_LEVELS[D.test];
  const tests = model.tests.filter(t => t.level === D.test);
  const docNo = projectDocNo(meta, doc?.code || D.code);
  const title = doc?.name || D.title;
  const term = model.version === "3.1" ? "테스트 케이스" : "검증 수단";
  const head = [[title], [`프로젝트: ${meta.name || ""}`, `문서번호: ${docNo}`, `프로세스: ${AE.procLabel(tl.proc, model.version)}`, `정보항목: ${AE.wpLabel(kind, model.version)}`], []];
  const tgtName = {};
  (model.units.SW || []).forEach(u => { tgtName[u.id] = u.name; });
  ["SYS", "SW", "HW"].forEach(lv => { model.reqs[lv].forEach(r => { tgtName[r.id] = r.title; }); model.comps[lv].forEach(c => { tgtName[c.id] = c.name; }); model.interfaces[lv].forEach(i => { tgtName[i.id] = `${i.kind || "IF"} ${i.signals || ""}`.trim(); }); });
  const std = xlsxStdParts({ title, docCode: projectDocNo(meta, doc?.code || D.code), phase: tl.proc, meta, infoRows: [["적용 기준", `Automotive SPICE ${AE.ASPICE_VERSIONS.find(v => v.id === model.version)?.label || model.version}`], ["정보항목(WP)", AE.wpLabel(kind, model.version)]] });
  const utL = D.test === "SWE4" ? AE.utLatest(ctx?.requirements?.aspice) : null;
  if (D.result && utL) {
    // SWE.4 — 호스트 실행(SIL) 결과 반영
    const R = utL.run;
    const rows = [...head, ["No", `${term} ID`, "검증 대상", "제목", "결과(Pass/Fail/Not executed)", "수행일", "수행자", "형상(SW/HW 버전)", "결함·문제 ID", "비고"]];
    const resOf = t => { const ru = (t.targets || []).map(x => ({ id: x, r: R.units[x], st: utL.stale[x] })).filter(x => x.r); if (!ru.length) return { res: "Not executed", note: "호스트 실행 결과 없음" }; if (ru.some(x => x.st)) return { res: "Not executed", note: "실행 후 코드가 바뀜 — 재실행 필요" }; const r = ru[0].r; return { res: ru.some(x => x.r.result === "Fail") ? "Fail" : ru.every(x => x.r.result === "Pass") ? "Pass" : "Not executed", note: `${r.build === "fail" ? "빌드 실패 · " : ""}케이스 ${r.pass}/${r.cases} 통과${r.coverage ? ` · 문장 커버리지 ${r.coverage.stmt}%${r.coverage.branchN ? ` · 분기 ${r.coverage.branch}%` : ""}` : ""}` }; };
    const runDate = String(R.ranAt || R.at).slice(0, 10);
    const res = tests.map(t => ({ t, ...resOf(t) }));
    res.forEach((x, i) => rows.push([String(i + 1), x.t.id, (x.t.targets || []).join(", "), x.t.title || "", x.res, x.res === "Not executed" ? "" : runDate, x.res === "Not executed" ? "" : "SPIDer 호스트 실행(자동)", x.res === "Not executed" ? "" : `호스트 SIL · ${R.cc || "gcc"} · 코드 ${R.units[(x.t.targets || [])[0]]?.code || "-"}`, "", x.note]));
    const nOf = k => res.filter(x => x.res === k).length;
    const cs = R.cases;
    const uName = Object.fromEntries((model.units.SW || []).map(u => [u.id, u]));
    const caseRows = [["유닛 시험 케이스 실행 결과 (호스트 실행 · SIL)"], [], ["No", "케이스 ID", "유닛", "출처", "근거 요구", "제목", "결과", "확인 수", "실패 내용"]];
    cs.forEach((c, i) => caseRows.push([String(i + 1), c.case, c.unit, c.origin === "ai" ? "AI 초안(요구 근거·규칙 검증)" : "규칙", c.reqs || "", (uName[c.unit]?.ut?.cases || []).find(q => q.id === c.case)?.title || "", c.result === "pass" ? "Pass" : "Fail", String(c.checks ?? ""), c.detail || ""]));
    const sum = [[`${tl.label} 결과 요약`], [], ["구분", "건수"], ["전체", String(tests.length)], ["Pass", String(nOf("Pass"))], ["Fail", String(nOf("Fail"))], ["Not executed", String(nOf("Not executed"))],
      [], ["실행 정보", `${String(R.ranAt || R.at).replace("T", " ").slice(0, 19)} · ${R.cc || "-"} · ${R.os || "-"}${R.coverage ? " · gcov 커버리지 측정" : ""} · 케이스 ${cs.length}건 중 통과 ${cs.filter(c => c.result === "pass").length}`],
      ["검증 환경", "호스트 실행(SIL) — RTE 스텁·시험 하네스(SPIDer UT). 로직 검증이며 타깃 MCU의 타이밍·메모리·인터럽트 동작은 이 결과로 보증하지 않음(타깃·HILS 검증 별도)."],
      ["정적 검증", `MISRA 준수 최종 판정은 ${AE.ddSettings(model).tools.join(" · ")} 결과로 함 — 이 결과서는 동적 유닛 시험 결과`],
      [], ["※ 4.0 15-52: 통과·미통과·미수행, 수행 정보(일자·수행자), 결과 요약을 포함해야 한다. 3.1 13-50과 동일 목적."]];
    return makeXlsxBook([
      std.cover,
      { name: "검증 결과", rows, widths: [5, 13, 18, 36, 20, 11, 18, 30, 12, 34], headerRows: [3], titleRows: [0], freezeRow: 4 },
      { name: "케이스별 결과", rows: caseRows, widths: [5, 18, 11, 22, 18, 36, 8, 8, 44], headerRows: [2], titleRows: [0], freezeRow: 3 },
      { name: "결과 요약", rows: sum, widths: [22, 80], headerRows: [2], titleRows: [0] },
    ], std.opts);
  }
  if (D.result) {
    const rows = [...head, ["No", `${term} ID`, "검증 대상", "제목", "결과(Pass/Fail/Not executed)", "수행일", "수행자", "형상(SW/HW 버전)", "결함·문제 ID", "비고"]];
    tests.forEach((t, i) => rows.push([String(i + 1), t.id, (t.targets || []).join(", "), t.title || "", "Not executed", "", "", "", "", ""]));
    const sum = [[`${tl.label} 결과 요약`], [], ["구분", "건수"], ["전체", String(tests.length)], ["Pass", "(결과 입력 후 집계)"], ["Fail", "(결과 입력 후 집계)"], ["Not executed", String(tests.length)],
      [], ["※ 4.0 15-52: 통과·미통과·미수행, 수행 정보(일자·수행자), 결과 요약을 포함해야 한다. 3.1 13-50과 동일 목적."]];
    return makeXlsxBook([
      std.cover,
      { name: "검증 결과", rows, widths: [5, 13, 18, 36, 20, 11, 10, 16, 12, 18], headerRows: [3], titleRows: [0], freezeRow: 4 },
      { name: "결과 요약", rows: sum, widths: [22, 30], headerRows: [2], titleRows: [0] },
    ], std.opts);
  }
  const spec = [...head, ["No", `${term} ID`, "검증 대상(ID)", "대상명", "제목", "기법", "사전조건(진입 기준)", "절차", "기대 결과", "합격 기준", "환경", "회귀 대상", "출처"]];
  tests.forEach((t, i) => spec.push([String(i + 1), t.id, (t.targets || []).join(", "), (t.targets || []).map(x => tgtName[x] || "").join(", "), t.title || "", t.technique || "", t.precondition || "", String(t.steps || "").replace(/;\s*/g, "\n"), t.expected || "", t.passCriteria || "", t.env || "", t.regression ? "Y" : "", t.origin === "rule" ? "규칙" : t.origin === "ai" ? "AI 초안" : "수동"]));
  const techs = [...new Set(tests.map(t => t.technique).filter(Boolean))];
  const strategy = [[`${tl.label} 전략`], [],
    ["항목", "내용", "근거(3.1 / 4.0)"],
    ["검증 대상", tl.targetKind === "req" ? `${AE.LEVELS[tl.level].label} 요구사항 ${model.reqs[tl.level].length}건` : tl.targetKind === "unit" ? `SW 유닛 ${model.units.SW.length}개 (골격 — 구체 케이스는 코드 확정 후 작성)` : `${AE.LEVELS[tl.level].compLabel} ${model.comps[tl.level].length}개 · 인터페이스 ${model.interfaces[tl.level].length}건`, "08-52 Context / 08-60"],
    ["검증 기법", techs.join(", ") || "-", "08-52 Test strategy / 08-60 Techniques"],
    ["진입 기준", "검증 대상 형상(SW·HW 버전) 확정 및 형상 식별 기록, 검증 환경 준비 완료", "08-52 / 08-60 entry criteria"],
    ["종료 기준", "선택된 검증 수단 전부 수행, Fail 항목은 문제 보고 등록(SUP.9)", "08-52 / 08-60 exit criteria"],
    ["중단·재개 기준", "환경 결함·차단 결함 발생 시 중단, 원인 해소·재확인 후 재개", "08-52 suspension/resumption / 08-60 abort·re-start"],
    ["회귀 기준", `우선순위 '상'·안전 관련·결함 주입·통합 인터페이스 항목은 변경 시 재수행 (${tests.filter(t => t.regression).length}건 지정)`, "08-50 regression / 08-58"],
    ["검증 환경", [...new Set(tests.map(t => t.env).filter(Boolean))].join(", ") || "TBD — 검증 환경 정보(HILS·벤치·챔버) 확보 후 기재", "08-52 environment / 08-60 infrastructure"],
    ...(tl.targetKind === "if" ? [["통합 순서", `${model.comps[tl.level].map(c => c.name).join(" → ") || "TBD"} (의존 관계에 따라 조정)`, "08-50 system integration / 06-50"]] : []),
  ];
  const sel = [[`${term} 선택 세트`], [], ["No", `${term} ID`, "제목", "선택", "선택 근거", "회귀 대상"]];
  tests.forEach((t, i) => sel.push([String(i + 1), t.id, t.title || "", "선택", t.origin === "rule" ? `요구 조건(${t.technique || "요구 기반"})에서 결정적으로 도출` : "요구 정상 시나리오", t.regression ? "Y" : ""]));
  // SWE.4 — 호스트 실행 케이스(입력→기대)를 명세에 함께 수록 (요구·설계 추적 포함)
  const utSheet = (() => {
    if (D.test !== "SWE4") return null;
    const us = (model.units.SW || []).filter(u => u.dd?.classes?.length);
    if (!us.length) return null;
    const r = [["유닛 시험 실행 케이스 (호스트 실행 · SIL)"], [], ["No", "케이스 ID", "유닛", "출처", "근거 요구", "근거 인용", "제목", "사전 상태", "입력", "실행", "기대 결과"]];
    let k = 0;
    us.forEach(u => [...AE.ruleUnitTests(u), ...(u.ut?.cases || []).filter(c => c.origin === "ai")].forEach(c => r.push([String(++k), c.id, u.id, c.origin === "ai" ? "AI 초안(규칙 검증)" : "규칙", (c.reqs || []).join(", "), c.basis || "", c.title, c.state || "(초기화 직후)",
      Object.entries(c.inputs || {}).map(([a, b]) => `${a}=${b}`).join(", ") || "기본값(0)", c.runnable ? `${c.runnable} × ${c.times}` : "초기화만",
      (c.expect || []).map(e => e.kind === "state" ? `상태=${e.value}` : e.kind === "stateValid" ? "상태가 정의된 값 범위 안" : e.kind === "written" ? `${e.ref} 출력 갱신` : `${e.ref} ${e.op} ${e.value}`).join("; ")])));
    return { name: "실행 케이스(호스트)", rows: r, widths: [5, 18, 11, 16, 16, 22, 34, 14, 30, 26, 40], headerRows: [2], titleRows: [0], freezeRow: 3 };
  })();
  return makeXlsxBook([
    std.cover,
    { name: "검증 명세", rows: spec, widths: [5, 13, 14, 20, 30, 18, 24, 40, 32, 24, 10, 8, 8], headerRows: [3], titleRows: [0], freezeRow: 4 },
    ...(utSheet ? [utSheet] : []),
    { name: "검증 전략", rows: strategy, widths: [16, 70, 30], headerRows: [2], titleRows: [0] },
    { name: model.version === "3.1" ? "테스트 선택" : "선택 세트(08-58)", rows: sel, widths: [5, 13, 36, 8, 40, 9], headerRows: [2], titleRows: [0], freezeRow: 3 },
  ], std.opts);
}

// 이해관계자 요구사항 목록 (SYS.1 · 3.1 17-03 / 4.0 17-00·17-54) — 원문 발췌 + 합의 상태 + 시스템 요구 추적
function makeAspiceStkXlsx(meta, ctx, doc) {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const D = AE.ASPICE_DOCS.STK_LIST;
  const docNo = projectDocNo(meta, doc?.code || D.code);
  const sysBy = {}; model.reqs.SYS.forEach(r => (r.parents || []).forEach(p => { (sysBy[p] = sysBy[p] || []).push(r.id); }));
  const rows = [[doc?.name || D.title], [`프로젝트: ${meta.name || ""}`, `문서번호: ${docNo}`, `프로세스: ${AE.procLabel("SYS.1", model.version)}`, `정보항목: ${AE.wpLabel("STK_LIST", model.version)}`], [],
    ["No", "요구 ID", "요구사항 내용 (원문 발췌)", "출처(사양서·조항)", "요구 주체", "유형", "합의 상태", "도출 시스템 요구 ID", "비고"],
    ...model.reqs.STK.map((k, i) => [String(i + 1), k.id, k.text || "", k.source || "", k.stakeholder || "", k.type || "", k.status || "검토 중", (sysBy[k.id] || []).join(", ") || "미도출", k.note || ""])];
  const cnt = st => model.reqs.STK.filter(k => (k.status || "검토 중") === st).length;
  const sum = [["합의 현황 요약"], [], ["구분", "건수"], ["전체", String(model.reqs.STK.length)], ["합의", String(cnt("합의"))], ["검토 중", String(cnt("검토 중"))], ["보류", String(cnt("보류"))],
    ["시스템 요구 미도출", String(model.reqs.STK.filter(k => !(sysBy[k.id] || []).length).length)], [],
    ["※ 이해관계자 요구는 OEM·법규 원문을 고쳐 쓰지 않고 그대로 발췌한 문장이며, 시스템 요구(SYS.2)는 이를 분석해 검증 가능하게 재기술한 것이다. 합의 상태는 이해관계자와의 합의 증적(4.0 SYS.1.BP5 / 3.1 SYS.1.BP5·BP6)이다."]];
  const std = xlsxStdParts({ title: doc?.name || D.title, docCode: projectDocNo(meta, doc?.code || D.code), phase: "SYS.1", meta, infoRows: [["적용 기준", `Automotive SPICE ${AE.ASPICE_VERSIONS.find(v => v.id === model.version)?.label || model.version}`], ["정보항목(WP)", AE.wpLabel("STK_LIST", model.version)]] });
  return makeXlsxBook([
    std.cover,
    { name: "이해관계자 요구", rows, widths: [5, 11, 60, 18, 10, 10, 10, 24, 20], headerRows: [3], titleRows: [0], freezeRow: 4 },
    { name: "합의 현황", rows: sum, widths: [24, 12], headerRows: [2], titleRows: [0] },
  ], std.opts);
}
// SW 상세설계서 골격 (SWE.3 · 3.1 04-05 / 4.0 04-05) — 유닛 분해·요구 추적·인터페이스(헤더 근거)만 채우고 알고리즘·동적 동작은 TBD
function makeAspiceUnitDesignDocx(meta, ctx, doc) {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const kind = "SW_DD";
  const title = doc?.name || AE.ASPICE_DOCS[kind].title;
  const { front, pkgOpts } = docxStdParts({ title, docCode: projectDocNo(meta, doc?.code || AE.ASPICE_DOCS[kind].code), phase: "SWE.3", meta });
  const units = model.units.SW, comp = Object.fromEntries(model.comps.SW.map(c => [c.id, c])), req = Object.fromEntries(model.reqs.SW.map(r => [r.id, r]));
  const hdr = units.filter(u => u.origin === "header").length;
  let body = aspiceFrontBody({ kind, model, meta, doc, title, extraRows: [["SW 유닛", `${units.length}개 (헤더 근거 ${hdr} · 규칙 골격 ${units.filter(u => u.origin === "rule").length} · 수동 ${units.filter(u => u.origin === "manual").length})`], ["할당 SW 요구", `${new Set(units.flatMap(u => u.reqs || [])).size}건 / ${model.reqs.SW.length}건`]] });
  let sec = 0;
  body += docxP(`${++sec}. 개요 및 작성 원칙`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP("본 문서는 SW 아키텍처(SWE.2)의 컴포넌트를 유닛으로 분해하고, SW 요구사항을 유닛에 할당하며(요구 ↔ 유닛 추적), 유닛 인터페이스·자료형·상수를 정의한다.") +
    docxP((() => { const S = AE.ddSettings(model); const dd = units.filter(u => u.dd?.classes?.length).length; return dd ? `작성 원칙: 유닛마다 정적 구조(클래스·포트·Runnable·자료형·알고리즘)와 동적 동작(상태 머신·시퀀스·액티비티)을 할당 SW 요구·상위 시스템 요구·컴포넌트 인터페이스·운영 모드를 근거로 설계하고, 모든 설계 요소에 근거 요구 ID를 기록한다(상세설계 ${dd}/${units.length} 유닛). 이 설계는 다이어그램(UML 2.5·SysML)·XMI 2.1(모델링 도구 교환)·소스코드(${AE.DD_TARGETS[S.target].label}, AUTOSAR ${S.release}, ${S.target === "CP" ? S.misraC : S.misraCpp + " · " + S.cppGuide} 준거)의 단일 입력이며, 다이어그램·XMI·소스는 산출물 ZIP의 'SW4101_상세설계_모델' 폴더에 포함된다. MISRA 준수의 최종 판정은 정적분석 도구(${S.tools.join(" · ")}) 결과로 한다.` : "작성 원칙: 유닛의 알고리즘·자료구조·동적 동작은 V-모델 SWE.3 탭의 상세설계 생성으로 작성한다(현재 미생성 — 유닛 분해·요구 추적·헤더 인터페이스만 기재)."; })(), { size: 20, spacingAfter: 120 }) +
    docxP(`유닛 출처 표기: '헤더' = C 헤더 파일에서 함수 원형·자료형·상수를 추출(코드가 근거) / '규칙' = SW 요구 → 유닛 1:1 골격(AI 미사용) / '수동' = 직접 작성.`, { size: 18, spacingAfter: 120 });
  body += docxP(`${++sec}. 유닛 분해 (컴포넌트 → 유닛)`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxTable([["유닛 ID", "유닛명", "SW 컴포넌트", "할당 SW 요구", "출처", "설계 상태"], ...units.map(u => [u.id, u.name || "", u.comp ? `${u.comp} ${comp[u.comp]?.name || ""}` : "-", (u.reqs || []).join(", ") || "-", u.origin === "header" ? `헤더 (${u.file})` : u.origin === "manual" ? "수동" : "규칙 골격", u.designDone ? "작성" : "TBD"])], -1);
  body += docxP(`${++sec}. 유닛별 상세설계`, { bold: true, size: 26, spacingAfter: 120 });
  units.forEach(u => {
    body += docxP(`${u.id} · ${u.name}`, { bold: true, size: 22, spacingAfter: 80 }) + docxTable([
      ["SW 컴포넌트", u.comp ? `${u.comp} ${comp[u.comp]?.name || ""}` : "TBD"],
      ["책임·설명", u.desc || "TBD"],
      ["할당 요구", (u.reqs || []).map(id => `${id} ${req[id]?.title || ""}`).join("; ") || "TBD"],
      ["인터페이스(함수)", (u.funcs || []).length ? u.funcs.map(f => `${f.ret} ${f.name}(${f.params || "void"})`).join("; ") : "TBD — 코드·헤더 확정 후 기재"],
      ["자료형", (u.types || []).join(", ") || "TBD"],
      ["상수·설정값", (u.macros || []).map(x => `${x.name} = ${x.value}`).join("; ") || "TBD"],
      ["알고리즘·처리 흐름", u.dd?.classes?.length ? "아래 '연산·알고리즘' 표 및 액티비티 다이어그램 참조" : "TBD — 상세설계 미생성"],
      ["동적 동작(호출 순서·상태·타이밍)", u.dd?.classes?.length ? `상태 ${u.dd.states.states.length}·전이 ${u.dd.states.transitions.length} / 시나리오 ${u.dd.sequences.length} / Runnable ${u.dd.runnables.map(r => `${r.name}(${r.trigger}${r.periodMs ? " " + r.periodMs + "ms" : ""})`).join(", ")}` : "TBD — 상세설계 미생성"],
      ["오류 처리·진단", u.dd?.classes?.length ? (u.dd.states.states.filter(x => /ERR|FAULT|DEGRAD|SAFE/i.test(x.name)).map(x => `${x.name}: ${x.entry || x.desc || ""}`).join("; ") || "상태 머신의 고장 상태 없음 — 요구 검토 필요") : "TBD"],
    ], 1);
    const d = u.dd;
    if (d?.classes?.length) {
      body += docxP("구조 — 클래스·속성", { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["클래스", "스테레오타입", "속성 (가시성 이름: 형 = 초기값)", "설명", "근거 요구"], ...d.classes.map(c => [c.name, c.stereotype || "class", c.attrs.map(a => `${a.vis} ${a.name}: ${a.type}${a.init ? " = " + a.init : ""}`).join("\n") || "-", c.desc || "", (c.reqs || []).join(", ") || "-"])], -1);
      body += docxP("연산·알고리즘", { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["연산", "시그니처", "알고리즘(단계)", "사전/사후 조건", "근거 요구"], ...d.classes.flatMap(c => c.ops.map(o => [`${c.name}::${o.name}`, `${o.ret} ${o.name}(${o.params.map(pp => `${pp.dir !== "in" ? pp.dir + " " : ""}${pp.type} ${pp.name}`).join(", ")})`, (o.algo || []).map((x, i) => `${i + 1}. ${String(x).replace(/^\s*\d+[.)]\s*/, "")}`).join("\n") || o.desc || "-", [o.pre && `pre: ${o.pre}`, o.post && `post: ${o.post}`].filter(Boolean).join("\n") || "-", (o.reqs || []).join(", ") || "-"]))], -1);
      body += docxP("포트·인터페이스", { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["포트", "방향", "종류", "인터페이스", "데이터 요소 (이름: 형 [단위/범위])", "출처"], ...d.ports.map(pp => [pp.name, pp.dir === "R" ? "Required(수신)" : "Provided(송신)", pp.kind, pp.interface, pp.elements.map(e => `${e.name}: ${e.type}${e.unit || e.range ? ` [${[e.unit, e.range].filter(Boolean).join(" / ")}]` : ""}`).join("\n"), pp.source || "-"])], -1);
      body += docxP("Runnable(스케줄링)", { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["Runnable", "트리거", "읽기(포트)", "쓰기(포트)", "호출 연산", "근거 요구"], ...d.runnables.map(r => [r.name, r.trigger === "periodic" ? `주기 ${r.periodMs}ms` : r.trigger === "init" ? "초기화" : `이벤트 ${r.event || ""}`, r.reads.join(", ") || "-", r.writes.join(", ") || "-", r.calls.join(", ") || "-", (r.reqs || []).join(", ") || "-"])], -1);
      if (d.states.states.length) body += docxP(`상태 머신 (초기 상태 ${d.states.initial})`, { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["상태", "entry / do / exit", "설명"], ...d.states.states.map(x => [x.name, [x.entry && `entry: ${x.entry}`, x.do && `do: ${x.do}`, x.exit && `exit: ${x.exit}`].filter(Boolean).join("\n") || "-", x.desc || ""])], -1) + docxTable([["From", "To", "트리거", "Guard", "Effect", "근거 요구"], ...d.states.transitions.map(t => [t.from, t.to, t.trigger || "-", t.guard || "-", t.effect || "-", (t.reqs || []).join(", ") || "-"])], -1);
      d.sequences.forEach(sq => { body += docxP(`시퀀스 — ${sq.name}${sq.desc ? ": " + sq.desc : ""}`, { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["#", "From", "To", "메시지(인자)", "반환", "비고"], ...sq.steps.map((st, i) => [String(i + 1), st.from, st.to, `${st.msg}(${st.args || ""})`, st.ret || "-", st.note || ""])], -1); });
      d.activities.forEach(a => { body += docxP(`액티비티 — ${a.name} (연산 ${a.op})`, { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["노드", "종류", "내용", "다음 (guard)"], ...a.nodes.map(n => [n.id, n.kind, n.text || "-", a.edges.filter(e => e.from === n.id).map(e => `${e.to}${e.guard ? ` [${e.guard}]` : ""}`).join(", ") || "-"])], -1); });
      if (d.code) body += docxP(`소스코드: ${d.code.files.map(f => f.name).join(", ")} (${AE.DD_TARGETS[d.code.target]?.label}) — 산출물 ZIP 'SW4101_상세설계_모델/src_${d.code.target}' 폴더`, { size: 18, spacingAfter: 60 });
    }
  });
  body += docxP(`${++sec}. SW 요구 ↔ 유닛 추적 (${AE.bpLabel("SW_UNIT", model.version)})`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxTable([["SW 요구 ID", "요구사항명", "할당 유닛", "판정"], ...model.reqs.SW.map(r => { const us = units.filter(u => (u.reqs || []).includes(r.id)); return [r.id, r.title || "", us.map(u => `${u.id} ${u.name}`).join(", ") || "-", us.length ? "할당" : "미할당"]; })], -1);
  body += docxP(`${++sec}. 유닛 검증 연계 (SWE.4)`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP(`유닛별 검증 수단은 SW 유닛 검증 명세서(${AE.ASPICE_DOCS.V_SWE4.code})에 정의한다. 현재 ${model.tests.filter(t => t.level === "SWE4").length}건의 검증 틀(정적 검증·구조적 커버리지)이 생성되어 있으며, 구체 테스트 케이스와 커버리지 기준 등급은 코드 확정 후 확정한다.`, { size: 20 });
  body += docxP(`${++sec}. 설계 근거`, { bold: true, size: 26, spacingAfter: 120 }) + docxP(model.rationale.SW || "설계 근거 미작성 (TBD)", { size: 20 });
  return docxPackage(front + body, pkgOpts);
}
// ── HWE.2 HW 상세설계서 (04-53 + 13-51 일관성 증거 + 13-52 의사소통 증거) ──
function makeHwDetailedDesignDocx(meta, ctx, doc) {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const kind = "HW_DD"; const title = doc?.name || AE.ASPICE_DOCS[kind].title;
  const { front, pkgOpts } = docxStdParts({ title, docCode: projectDocNo(meta, doc?.code || AE.ASPICE_DOCS[kind].code), phase: "HWE.2", meta });
  const S = AE.hdSettings(model);
  const comps = model.comps.HW, req = Object.fromEntries(model.reqs.HW.map(r => [r.id, r]));
  const designed = comps.filter(c => c.hd?.parts?.length);
  let body = aspiceFrontBody({ kind, model, meta, doc, title, extraRows: [["HW 블록", `${comps.length}개 (회로 설계 ${designed.length})`], ["부품 수", String(designed.reduce((n, c) => n + c.hd.parts.length, 0))], ["EDA 호환", `${S.eda} — 회로도 ${S.schematicFmt} · 레이아웃 ${S.layoutFmt} · 생산 ${S.fabFmt}`]] });
  let sec = 0;
  body += docxP(`${++sec}. 개요 및 작성 원칙`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP(`본 문서는 HW 아키텍처(04-52)의 각 회로 블록에 대해 부품·넷·연결·외부 인터페이스를 회로 수준으로 정의하고(04-53), HW 요구사항 ↔ 블록 ↔ 부품의 추적과 일관성 증거(13-51), 설계 검토·합의 기록(13-52)을 포함한다. 부품 제조사 부품번호는 AI가 제안한 '후보'이며 구매·수명·2nd source 검토 후 확정한다. 회로도(04-54, ${S.schematicFmt})·레이아웃 입력(04-55, ${S.layoutFmt})·생산 데이터(03-54, ${S.fabFmt})·BOM(14-54)·특별 특성(17-57)·분석 결과(15-51)는 별도 산출물로 생성되며 본 문서와 같은 설계 모델에서 나온다.`, { size: 20, spacingAfter: 120 });
  body += docxP(`${++sec}. 블록 구성 및 설계 요약`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxTable([["블록 ID", "블록명", "구분", "부품", "넷", "할당 HW 요구", "설계 상태"], ...comps.map(c => [c.id, c.name, c.kind || "", c.hd?.parts?.length ? String(c.hd.parts.length) : "-", c.hd?.nets?.length ? String(c.hd.nets.length) : "-", Object.entries(model.alloc.HW).filter(([, v]) => (v || []).includes(c.id)).map(([k]) => k).join(", ") || "-", c.hd?.parts?.length ? (c.hd.origin === "ai" ? "AI 설계" : "규칙 설계") : "미설계"])], -1);
  body += docxP(`${++sec}. 블록별 회로 상세설계 (04-53)`, { bold: true, size: 26, spacingAfter: 120 });
  comps.forEach(c => {
    const hd = c.hd;
    body += docxP(`${c.id} · ${c.name}`, { bold: true, size: 22, spacingAfter: 80 });
    if (!hd?.parts?.length) { body += docxP("회로 설계 미생성 — V-모델 HWE.2 탭의 [AI 회로 설계 생성]으로 작성", { size: 20, spacingAfter: 120 }); return; }
    body += docxP(hd.summary || "", { size: 20, spacingAfter: 80 });
    body += docxP("부품 (RefDes · 종류 · 값 · 패키지 · 제조사/PN 후보 · 정격 · 근거 요구)", { bold: true, size: 20, spacingAfter: 60 }) +
      docxTable([["RefDes", "종류", "값", "패키지", "제조사 / PN(후보)", "정격 · 등급", "용도", "근거 요구"], ...hd.parts.map(p => [p.ref, p.kind, p.value, p.pkg, `${p.mfr || ""} / ${p.mpn || "-"}`, [p.rating, p.grade].filter(Boolean).join(" · "), p.desc, (p.reqs || []).join(", ") || "-"])], -1);
    body += docxP("넷 목록", { bold: true, size: 20, spacingAfter: 60 }) +
      docxTable([["넷", "종류", "전압", "연결 핀", "설명"], ...hd.nets.map(n => [n.name, n.kind, n.voltage || "-", hd.conns.filter(x => x.net === n.name).map(x => `${x.ref}.${x.pin}`).join(", ") || "-", n.desc || ""])], -1);
    if (hd.ifs.length) body += docxP("외부 인터페이스", { bold: true, size: 20, spacingAfter: 60 }) + docxTable([["이름", "방향", "넷", "커넥터", "사양", "출처", "근거 요구"], ...hd.ifs.map(i => [i.name, i.dir, i.net, i.connector || "-", i.spec || "-", i.source || "-", (i.reqs || []).join(", ") || "-"])], -1);
    body += docxP("설계 근거", { bold: true, size: 20, spacingAfter: 60 }) + docxP(hd.rationale || "-", { size: 20, spacingAfter: 120 });
    body += docxP(`회로도: 산출물 ZIP 'HW4101_HW설계_모델/schematics/${c.id}_schematic.svg' (${S.schematicFmt} 내보내기는 같은 폴더)`, { size: 18, spacingAfter: 120 });
  });
  body += docxP(`${++sec}. 일관성·추적성 증거 (13-51)`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxTable([["HW 요구 ID", "요구사항명", "할당 블록", "구현 부품(RefDes)", "특별 특성", "판정"], ...model.reqs.HW.map(r => { const bl = comps.filter(c => (model.alloc.HW[r.id] || []).includes(c.id)); const parts = bl.flatMap(c => (c.hd?.parts || []).filter(p => (p.reqs || []).includes(r.id)).map(p => `${c.id}:${p.ref}`)); const sc = bl.flatMap(c => (c.hd?.specials || []).filter(x => (x.reqs || []).includes(r.id)).map(x => x.id)); return [r.id, r.title || "", bl.map(c => c.name).join(", ") || "-", parts.join(", ") || "-", sc.join(", ") || "-", !bl.length ? "미할당" : !parts.length ? "부품 추적 없음" : "일관"]; })], -1);
  body += docxP(`${++sec}. 설계 검토·합의 기록 (13-52)`, { bold: true, size: 26, spacingAfter: 120 }) +
    docxP("본 설계의 검토는 V-모델 '점검·QA › QA 교차검토'의 판정 기록(검토 AI 의견 → QA 담당자 유효/무효 판정)과 추적 매트릭스의 '변경 영향·판정 이력' 시트를 증거로 한다. 고객·관련 부서와의 합의는 아래 표에 기록한다.", { size: 20, spacingAfter: 80 }) +
    docxTable([["일자", "회의·채널", "참석자(부서)", "합의 내용", "관련 블록·요구", "증거(회의록·메일)"], ["", "", "", "", "", ""], ["", "", "", "", "", ""]], 1);
  return docxPackage(front + body, pkgOpts);
}
// ── HWE.2 xlsx: BOM(14-54) · 특별 특성(17-57) · 설계 분석 결과(15-51) ──
function makeHwDesignXlsx(kind, meta, ctx, doc) {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const D = AE.ASPICE_DOCS[kind]; const title = doc?.name || D.title;
  const std = xlsxStdParts({ title, docCode: projectDocNo(meta, doc?.code || D.code), phase: "HWE.2", meta, infoRows: [["적용 기준", `Automotive SPICE ${AE.ASPICE_VERSIONS.find(v => v.id === model.version)?.label || model.version}`], ["정보항목(WP)", AE.wpLabel(kind, model.version)]] });
  const head = [[title], [`프로젝트: ${meta.name || ""}`, `문서번호: ${projectDocNo(meta, doc?.code || D.code)}`, `프로세스: ${AE.procLabel("HWE.2", model.version)}`, `정보항목: ${AE.wpLabel(kind, model.version)}`], []];
  const comps = model.comps.HW.filter(c => c.hd?.parts?.length);
  if (kind === "HW_BOM") {
    const rows = [...head, ["No", "블록", "RefDes", "종류", "값", "패키지", "제조사", "제조사 PN (후보)", "정격", "등급", "수량", "특별 특성", "용도", "근거 요구", "확정 PN", "2nd Source", "비고"]];
    let i = 0; comps.forEach(c => c.hd.parts.forEach(p => rows.push([String(++i), `${c.id} ${c.name}`, p.ref, p.kind, p.value, p.pkg, p.mfr, p.mpn, p.rating, p.grade, String(p.qty || 1), p.special ? "●" : "", p.desc, (p.reqs || []).join(", "), "", "", "PN은 AI 후보 — 구매 확정 필요"])));
    // 집계(동일 PN)
    const agg = {}; comps.forEach(c => c.hd.parts.forEach(p => { const k = `${p.mfr}|${p.mpn}|${p.value}|${p.pkg}`; agg[k] = agg[k] || { mfr: p.mfr, mpn: p.mpn, value: p.value, pkg: p.pkg, kind: p.kind, qty: 0, refs: [] }; agg[k].qty += p.qty || 1; agg[k].refs.push(p.ref); }));
    const sum = [["집계 BOM (동일 PN 합산)"], [], ["No", "종류", "값", "패키지", "제조사", "제조사 PN (후보)", "총 수량", "RefDes"], ...Object.values(agg).map((a, k) => [String(k + 1), a.kind, a.value, a.pkg, a.mfr, a.mpn, String(a.qty), a.refs.join(", ")])];
    return makeXlsxBook([std.cover, { name: "BOM", rows, widths: [5, 18, 8, 10, 16, 10, 16, 26, 22, 12, 6, 8, 28, 18, 16, 16, 24], headerRows: [3], titleRows: [0], freezeRow: 4 }, { name: "집계 BOM", rows: sum, widths: [5, 10, 16, 10, 16, 26, 8, 30], headerRows: [2], titleRows: [0] }], std.opts);
  }
  if (kind === "HW_SC") {
    const rows = [...head, ["No", "블록", "특성 ID", "특별 특성", "분류", "대상(부품·넷)", "관리 값·공차", "관리 방법", "검증 방법(HWE.3/4)", "근거 요구", "담당", "상태"]];
    let i = 0; comps.forEach(c => c.hd.specials.forEach(x => rows.push([String(++i), `${c.id} ${c.name}`, `${c.id}-${x.id}`, x.char, x.type, x.target, x.value, x.control, x.verify, (x.reqs || []).join(", "), "", "제안(검토 필요)"])));
    rows.push([], ["※ 4.0 17-57 특별 특성: 안전·법규·주요 기능에 영향을 주어 생산·공급망에서 특별 관리가 필요한 특성. 고객 지정 특성(CC/SC)과 대조하여 확정한다."]);
    return makeXlsxBook([std.cover, { name: "특별 특성", rows, widths: [5, 18, 12, 40, 8, 14, 18, 30, 26, 18, 10, 14], headerRows: [3], titleRows: [0], freezeRow: 4 }], std.opts);
  }
  // HW_AN — 분석 결과 4종
  const der = [...head, ["블록", "RefDes", "파라미터", "정격", "적용 조건", "비율", "기준", "판정", "비고"]];
  const th = [["열 해석"], [], ["블록", "RefDes", "소비 전력(mW)", "θJA(°C/W)", "Ta(°C)", "Tj(°C)", "한계(°C)", "판정", "비고"]];
  const tm = [["타이밍 분석"], [], ["블록", "항목", "요구", "계산", "마진", "판정", "비고"]];
  const wc = [["최악 조건 분석"], [], ["블록", "항목", "공칭", "최소", "최대", "한계", "방법(EVA/RSS/MC)", "판정", "비고"]];
  comps.forEach(c => { const a = c.hd.analysis; a.derating.forEach(x => der.push([c.name, x.ref, x.param, x.rated, x.applied, x.ratio, x.limit, x.ok ? "OK" : "NG", x.note])); a.thermal.forEach(x => th.push([c.name, x.ref, x.pd_mW, x.theta, x.ta, x.tj, x.limit, x.ok ? "OK" : "NG", x.note])); a.timing.forEach(x => tm.push([c.name, x.item, x.req, x.calc, x.margin, x.ok ? "OK" : "NG", x.note])); a.worstCase.forEach(x => wc.push([c.name, x.item, x.nominal, x.min, x.max, x.limit, x.method, x.ok ? "OK" : "NG", x.note])); });
  const summary = [["분석 결과 요약"], [], ["분석", "항목 수", "NG"], ["Derating", String(der.length - 4), String(der.slice(4).filter(r => r[7] === "NG").length)], ["열", String(th.length - 3), String(th.slice(3).filter(r => r[7] === "NG").length)], ["타이밍", String(tm.length - 3), String(tm.slice(3).filter(r => r[5] === "NG").length)], ["최악 조건", String(wc.length - 3), String(wc.slice(3).filter(r => r[7] === "NG").length)], [], ["※ 4.0 15-51 분석 결과: 설계가 요구를 만족함을 보이는 분석(정격/Derating·열·타이밍·최악조건). 가정값은 '(가정)'으로 표시되었으며 회로 확정 후 실측·시뮬레이션으로 갱신한다."]];
  return makeXlsxBook([std.cover, { name: "요약", rows: summary, widths: [16, 10, 8], headerRows: [2], titleRows: [0] }, { name: "Derating", rows: der, widths: [16, 8, 14, 16, 18, 8, 8, 6, 40], headerRows: [3], titleRows: [0], freezeRow: 4 }, { name: "열", rows: th, widths: [16, 8, 12, 12, 8, 8, 8, 6, 40], headerRows: [2], titleRows: [0] }, { name: "타이밍", rows: tm, widths: [16, 24, 18, 24, 12, 6, 30], headerRows: [2], titleRows: [0] }, { name: "최악조건", rows: wc, widths: [16, 24, 12, 14, 16, 20, 14, 6, 30], headerRows: [2], titleRows: [0] }], std.opts);
}
// 양방향 추적 매트릭스 (3.1 13-22 / 4.0 13-51) + 일관성 점검 결과
function makeAspiceRtmXlsx(meta, ctx, doc) {
  const fullModel = AE.normalizeModel(ctx?.requirements?.aspice);
  const model = aeProductModel(fullModel);
  const prjReqs = fullModel.reqs.SYS.filter(aeIsProjectReq);
  const sc = model.scope;
  const tOf = (L, id) => model.tests.filter(t => t.level === L && (t.targets || []).includes(id)).map(t => t.id);
  const sysComp = Object.fromEntries(model.comps.SYS.map(c => [c.id, c]));
  // 변경 영향(링크 단위 의심 표시) — 프로젝트 요구 포함 전체 모델 기준
  const lst = AE.linkStatus(fullModel);
  const openUp = new Set(lst.open.filter(l => l.state !== "orphan").map(l => l.up));
  const openDown = new Set(lst.open.map(l => l.down));
  const fwd = [["요구사항 추적 매트릭스 — 순방향"], [`프로젝트: ${meta.name || ""}`, `문서번호: ${projectDocNo(meta, doc?.code || "SY2105")}`, `정보항목: ${AE.wpLabel("RTM", model.version)}`], []];
  const hasStk = fullModel.reqs.STK.length > 0;
  const hdr = [...(hasStk ? ["이해관계자 요구(STK)"] : []), "시스템 요구", "요구사항명", "출처(이해관계자)", "할당 시스템 요소", "시스템 검증(SYS.5)", "시스템 통합 검증(SYS.4)"];
  if (sc.SW) hdr.push("SW 요구", "SW 컴포넌트", "SW 검증(SWE.6)", "SW 통합 검증(SWE.5)");
  if (sc.HW) hdr.push("HW 요구", "HW 컴포넌트", "HW 요구 검증(HWE.4)", "HW 설계 검증(HWE.3)");
  hdr.push("판정");
  fwd.push(hdr);
  model.reqs.SYS.forEach(r => {
    const el = (model.alloc.SYS[r.id] || []).filter(e => sysComp[e]);
    const sifs = model.interfaces.SYS.filter(i => el.includes(i.from) || el.includes(i.to)).map(i => i.id);
    const sit = [...new Set(sifs.flatMap(i => tOf("SYS4", i)))];
    const row = [...(hasStk ? [(r.parents || []).join(", ")] : []), r.id, r.title || "", r.source || "", el.map(e => `${e} ${sysComp[e].name}`).join("\n"), tOf("SYS5", r.id).join(", "), sit.join(", ")];
    const gaps = [];
    if (hasStk && !(r.parents || []).length) gaps.push("STK 근거 없음");
    if (!el.length) gaps.push("미할당");
    if (!tOf("SYS5", r.id).length) gaps.push("SYS.5 없음");
    ["SW", "HW"].forEach(lv => {
      if (!sc[lv]) return;
      const ch = model.reqs[lv].filter(x => (x.parents || []).includes(r.id));
      const cs = [...new Set(ch.flatMap(x => model.alloc[lv][x.id] || []))];
      const q = [...new Set(ch.flatMap(x => tOf(lv === "SW" ? "SWE6" : "HWE4", x.id)))];
      const it = [...new Set(cs.flatMap(c => [...tOf(lv === "SW" ? "SWE5" : "HWE3", c), ...model.interfaces[lv].filter(i => i.from === c || i.to === c).flatMap(i => tOf(lv === "SW" ? "SWE5" : "HWE3", i.id))]))];
      row.push(ch.map(x => x.id).join(", "), cs.join(", "), q.join(", "), it.join(", "));
      const needs = el.some(e => lv === "SW" ? AE.elemHasSW(sysComp[e]) : AE.elemHasHW(sysComp[e]));
      if (needs && !ch.length) gaps.push(`${lv} 미파생`);
      if (ch.some(x => openUp.has(x.id))) gaps.push(`${lv} 요구 변경 검토 필요`);
    });
    if (openUp.has(r.id)) gaps.unshift("변경 검토 필요");
    row.push(gaps.length ? gaps.join(", ") : "OK");
    fwd.push(row);
  });
  const back = [["요구사항 추적 매트릭스 — 역방향 (검증 수단 → 요구)"], [], ["검증 수단 ID", "레벨", "제목", "대상 ID", "대상 존재", "회귀"]];
  const known = new Set([...["SYS", "SW", "HW"].flatMap(lv => [...model.reqs[lv].map(x => x.id), ...model.comps[lv].map(x => x.id), ...model.interfaces[lv].map(x => x.id)]), ...model.units.SW.map(u => u.id)]);
  model.tests.forEach(t => back.push([t.id, AE.TEST_LEVELS[t.level]?.proc || t.level, t.title || "", (t.targets || []).join(", "), !(t.targets || []).every(x => known.has(x)) ? "참조 오류" : openDown.has(t.id) ? "예 (변경 검토 필요)" : "예", t.regression ? "Y" : ""]));
  const swBack = [["하위 요구 역추적 (SW/HW 요구 → 시스템 요구)"], [], ["하위 요구", "레벨", "요구사항명", "상위 시스템 요구", "상위 존재"]];
  const sysIds = new Set(model.reqs.SYS.map(r => r.id));
  ["SW", "HW"].forEach(lv => sc[lv] && model.reqs[lv].forEach(r => swBack.push([r.id, lv, r.title || "", (r.parents || []).join(", "), (r.parents || []).some(p => sysIds.has(p)) ? (openDown.has(r.id) ? "예 (변경 검토 필요)" : "예") : "추적 없음"])));
  const F = [...AE.checkConsistency(model).filter(f => f.bp !== "CHANGE"), ...AE.changeFindings(fullModel)];
  // 변경 영향·판정 이력 (SUP.10 영향 분석 증적) — 미해결 연결 + 판정 기록
  const chg = [["변경 영향·판정 이력 — 상위 요구 변경에 따른 추적 연결 검토"], [`근거: ${AE.bpLabel("CHANGE", model.version)} · 미해결 ${lst.open.length}건 · 판정 기록 ${fullModel.reviewLog.length}건`],
    ["상위 요구", "연결 종류", "하위 항목", "하위 항목명", "상태", "변경 필드", "판정 의견", "판정일시"],
    ...lst.open.map(l => [l.up, AE.LINK_KINDS[l.kind], l.down, l.downTitle || "", AE.LINK_STATES[l.state] + (l.downChanged ? " (하위 수정됨)" : ""), (l.fields || []).join(", "), l.rec?.state === "invalid" ? (l.rec.note || "") : "", l.rec?.by === "user" ? String(l.rec.at || "").slice(0, 16).replace("T", " ") : ""]),
    ...(lst.open.length ? [] : [["-", "-", "-", "미해결 연결 없음", "", "", "", ""]]),
    [], ["판정 기록 (최신순)"], ["판정일시", "상위 요구", "연결 종류", "하위 항목", "판정", "변경 필드", "의견", ""],
    ...[...fullModel.reviewLog].reverse().map(g => [String(g.at || "").slice(0, 16).replace("T", " "), g.up, AE.LINK_KINDS[g.kind] || g.kind, g.down, AE.LINK_STATES[g.state] || g.state, (g.fields || []).join(", "), g.note || "", ""])];
  if (prjReqs.length) F.push({ sev: "info", bp: "SYS_REQ_TRACE", msg: `프로젝트·프로세스 요구 ${prjReqs.length}건은 제품 추적 체인(할당·SW/HW 파생·SYS.5 검증) 대상에서 제외하고 '프로젝트·프로세스 요구' 시트에서 관리 산출물로 추적함`, ids: prjReqs.map(r => r.id) });
  const cons = [["일관성·추적성 점검 결과"], [`점검일: ${new Date().toLocaleString("ko-KR")}`], ["심각도", "관련 BP", "내용", "대상 ID(최대 30)"],
    ...F.map(f => [f.sev === "error" ? "오류" : f.sev === "warn" ? "경고" : "정보", AE.bpLabel(f.bp, model.version), f.msg, (f.ids || []).join(", ")])];
  if (!F.length) cons.push(["-", "-", "발견된 문제 없음", ""]);
  // 이해관계자 요구 → 시스템 요구 (3.1 SYS.2.BP6 / 4.0 SYS.2.BP5) — 입력 문서의 모든 조항이 어디서 처리되는지
  const sysAll = Object.fromEntries(fullModel.reqs.SYS.map(r => [r.id, r]));
  const stk = [["이해관계자 요구 추적 (입력 문서 조항 → 시스템 요구·프로젝트 요구)"], [`정보항목: 3.1 13-22 / 4.0 13-51 — 근거 BP: ${AE.bpLabel("SYS_REQ_TRACE", model.version)}`], ["출처 ID", "입력 문서", "조항 요지", "처리 구분", "연결 요구", "비고"],
    ...(fullModel.stakeholders || []).map(x => {
      const miss = (x.reqs || []).filter(id => !sysAll[id]);
      return [x.id, x.doc || "", x.title || "", x.disposition || "", (x.reqs || []).map(id => `${id} ${sysAll[id]?.title || "(미존재)"}`).join("\n") || "-", [x.note, miss.length ? `참조 오류: ${miss.join(", ")}` : ""].filter(Boolean).join(" / ")];
    })];
  const stkCovered = new Set((fullModel.stakeholders || []).flatMap(x => x.reqs || []));
  const noStk = fullModel.reqs.SYS.filter(r => !stkCovered.has(r.id)).map(r => r.id);
  if ((fullModel.stakeholders || []).length) stk.push([], [`판정: 입력 조항 ${(fullModel.stakeholders || []).length}건 전부 처리 구분 지정 · 출처가 연결되지 않은 시스템 요구 ${noStk.length}건${noStk.length ? ` (${noStk.join(", ")})` : ""}`]);
  const prj = [["프로젝트·프로세스 요구 (제품 추적 체인 제외 — 관리 산출물로 추적)"], [], ["요구 ID", "요구사항명", "출처", "관리 프로세스", "관리 산출물(증적)", "확인 방법", "확인 시점"],
    ...prjReqs.map(r => [r.id, r.title || "", r.source || "", r.process || "", r.evidence || "", r.verifBy || "", r.due || ""])];
  const oi = [["미결 사항(Open Issues) — 입력자료 확보·고객 합의가 필요한 항목"], [], ["ID", "관련 문서·요구", "내용", "필요 조치", "담당", "목표 시점", "상태"],
    ...(fullModel.openIssues || []).map(x => [x.id, x.ref || "", x.item || "", x.action || "", x.owner || "", x.due || "", x.status || "Open"])];
  // 이해관계자 요구(STK) → 시스템 요구 (SYS.1 → SYS.2) — 원문 발췌 기준 추적
  const stk2 = [["이해관계자 요구(STK) → 시스템 요구 추적"], [`근거: ${AE.bpLabel("STK_TRACE", model.version)} · STK ${fullModel.reqs.STK.length}건 · 시스템 요구 미도출 ${fullModel.reqs.STK.filter(k => !AE.stkClosed(k) && !fullModel.reqs.SYS.some(r => (r.parents || []).includes(k.id))).length}건 · 해당 없음(사유) ${fullModel.reqs.STK.filter(AE.stkClosed).length}건`],
    ["STK ID", "요구 문장(원문 발췌)", "출처", "주체", "합의 상태", "도출 시스템 요구", "판정"],
    ...fullModel.reqs.STK.map(k => { const ds = fullModel.reqs.SYS.filter(r => (r.parents || []).includes(k.id)); return [k.id, k.text || "", k.source || "", k.stakeholder || "", k.status || "", ds.map(r => `${r.id} ${r.title || ""}`).join("\n") || "-", ds.length ? (openUp.has(k.id) ? "변경 검토 필요" : "OK") : AE.stkClosed(k) ? `해당 없음 — ${k.naReason}` : k.status === "해당 없음" ? "해당 없음(사유 미기록)" : "미도출"]; })];
  // SW 요구 → 유닛 (SWE.3) — 골격 추적
  const unitRows = [["SW 요구 → 유닛 추적 (SWE.3 골격)"], [`근거: ${AE.bpLabel("SW_UNIT", model.version)} · 유닛 ${fullModel.units.SW.length}개 (헤더 근거 ${fullModel.units.SW.filter(u => u.origin === "header").length})`], ["SW 요구", "요구사항명", "할당 유닛", "유닛 검증(SWE.4)", "판정"],
    ...model.reqs.SW.map(r => { const us = fullModel.units.SW.filter(u => (u.reqs || []).includes(r.id)); return [r.id, r.title || "", us.map(u => `${u.id} ${u.name}`).join(", ") || "-", [...new Set(us.flatMap(u => tOf("SWE4", u.id)))].join(", "), us.length ? "할당" : "미할당"]; })];
  // 3단 교차검토 — 검토 AI 의견과 QA 담당자 판정 기록 (판정 기록이 심사 증적)
  const rvw = AE.reviewView(fullModel);
  const rvCov = AE.reviewCoverage(fullModel);
  const scopeName = k => { const S = AE.reviewScope(k); return S ? `${S.proc} ${S.label}` : (AE.LEVELS[k]?.reqProc || k); };
  const critName = (k, c) => (AE.reviewCriteriaFor(k, model.version).all.find(x => x.code === c) || {}).label || c;
  const rvRows = [["3단 교차검토 — 검토 AI 의견 및 QA 판정 기록"],
    [`검토 기준: ① ${AE.vdaBasis(model.version)} → ② ${Object.values(AE.REVIEW_KINDS).map(K => `${K.ver} (${K.basis})`).join(" / ")} · 의견 ${rvw.list.length}건 · 미판정 ${rvw.count().open}건`],
    ["산출물", "검토 기준", "항목", "검토됨(현재 내용)", "미판정", "지적 맞음(수정 필요)", "상태"],
    ...rvCov.map(c => [`${c.proc} ${c.label}`, AE.REVIEW_KINDS[c.kind].ver, c.total, c.reviewedAny, c.open, c.valid, !c.total ? "항목 없음" : c.reviewedAny < c.total ? "검토 필요" : c.open ? "판정 필요" : "완료"]),
    [`AI 검토 대상 제외: ${AE.REVIEW_EXCLUDED.map(x => `${x.doc ? AE.ASPICE_DOCS[x.doc].title : x.label}(${x.why})`).join(" · ")}`],
    [`실행 이력(최근 5회): ${rvw.runs.slice(-5).map(r => `${String(r.at).slice(0, 16).replace("T", " ")} ${scopeName(r.level)} ${r.label || r.provider} ${r.model} ${r.criteria || ""}`).join(" / ") || "-"}`],
    [],
    ["산출물", "대상 ID", "대상명", "기준", "심각도", "근거 인용", "검토 의견", "개선 제안", "검토 AI·모델·일시", "판정", "판정 의견", "판정일시", "조치(대상 수정)"],
    ...rvw.list.map(f => { const run = rvw.runs.find(r => r.at === f.runAt); return [scopeName(f.level), f.reqId, f.reqTitle || (f.removed ? "(삭제됨)" : ""), critName(f.level, f.criterion), AE.REVIEW_SEV[f.severity] || f.severity, f.evidence || "", f.issue, f.suggestion || "", `${f.reviewer ? `${f.reviewer} ${f.reviewerModel || ""}` : run ? `${run.label || run.provider} ${run.model}` : ""} ${String(f.runAt || "").slice(0, 16).replace("T", " ")}`.trim(), f.judge ? AE.REVIEW_JUDGE[f.judge.state] : (f.removed ? "미판정 (대상 삭제됨)" : f.stale ? "미판정 (내용 변경됨)" : "미판정"), f.judge?.note || "", f.judge ? String(f.judge.at).slice(0, 16).replace("T", " ") : "", f.edits.length ? f.edits.map(e => `${String(e.at).slice(0, 16).replace("T", " ")} ${e.changes.map(c => `${c.label}: ${c.before || "(빈칸)"} → ${c.after || "(빈칸)"}`).join("; ")}`).join("\n") + (f.stale ? "\n(재검토로 확인 필요)" : "") : "수정 안 함"]; })];
  const rvHdr2 = 3 + rvCov.length + 3;   // 의견 목록 머리행 위치 (제목·기준·현황 머리 + 현황 행 + 제외·이력·빈 줄)
  const w = [...(hasStk ? [16] : []), 12, 26, 16, 22, 16, 16, ...(sc.SW ? [16, 14, 16, 16] : []), ...(sc.HW ? [16, 14, 16, 16] : []), 18];
  const std = xlsxStdParts({ title: doc?.name || AE.ASPICE_DOCS.RTM.title, docCode: projectDocNo(meta, doc?.code || "SY2105"), phase: "SYS.2~SWE.6", meta, infoRows: [["적용 기준", `Automotive SPICE ${AE.ASPICE_VERSIONS.find(v => v.id === model.version)?.label || model.version}`], ["정보항목(WP)", AE.wpLabel("RTM", model.version)]] });
  return makeXlsxBook([
    std.cover,
    { name: "순방향 추적", rows: fwd, widths: w, headerRows: [3], titleRows: [0], freezeRow: 4 },
    { name: "역방향(검증→요구)", rows: back, widths: [14, 8, 40, 20, 10, 6], headerRows: [2], titleRows: [0], freezeRow: 3 },
    { name: "역방향(하위→상위)", rows: swBack, widths: [14, 6, 36, 20, 10], headerRows: [2], titleRows: [0], freezeRow: 3 },
    { name: "일관성 점검", rows: cons, widths: [8, 34, 60, 50], headerRows: [2], titleRows: [0], freezeRow: 3 },
    ...((lst.open.length || fullModel.reviewLog.length) ? [{ name: "변경 영향·판정 이력", rows: chg, widths: [12, 14, 16, 30, 18, 18, 44, 16], headerRows: [2, chg.length - fullModel.reviewLog.length - 1], titleRows: [0], freezeRow: 3 }] : []),
    ...(hasStk ? [{ name: "STK→시스템 요구", rows: stk2, widths: [11, 56, 14, 10, 10, 40, 14], headerRows: [2], titleRows: [0], freezeRow: 3 }] : []),
    ...((sc.SW && fullModel.units.SW.length) ? [{ name: "SW 요구→유닛", rows: unitRows, widths: [12, 30, 40, 24, 10], headerRows: [2], titleRows: [0], freezeRow: 3 }] : []),
    ...((fullModel.stakeholders || []).length ? [{ name: "이해관계자 요구 추적", rows: stk, widths: [12, 22, 46, 16, 40, 40], headerRows: [2], titleRows: [0], freezeRow: 3 }] : []),
    ...(prjReqs.length ? [{ name: "프로젝트·프로세스 요구", rows: prj, widths: [10, 30, 16, 18, 40, 30, 14], headerRows: [2], titleRows: [0], freezeRow: 3 }] : []),
    ...((rvw.list.length || rvw.runs.length) ? [{ name: "교차검토·판정 기록", rows: rvRows, widths: [22, 12, 26, 12, 8, 22, 44, 36, 22, 16, 30, 16, 44], headerRows: [2, rvHdr2], titleRows: [0], freezeRow: 3 }] : []),
    ...((fullModel.openIssues || []).length ? [{ name: "미결 사항", rows: oi, widths: [8, 26, 54, 44, 12, 12, 8], headerRows: [2], titleRows: [0], freezeRow: 3 }] : []),
  ], std.opts);
}

// 적용 범위(테일러링)의 SWE·HWE를 V-모델 저장본의 SW·HW 범위에 덮어쓴 컨텍스트 — WBS·산출물 목록·문서 생성이 같은 범위를 보도록
function withAspiceScope(ctx) {
  const sc = ctx?.tailoring?.aspiceScope;
  const raw = ctx?.requirements?.aspice;
  if (!sc || !raw) return ctx;
  const SW = aspiceGroupOn(sc, "SWE"), HW = aspiceGroupOn(sc, "HWE");
  const cur = raw.scope || {};
  if (cur.SW === SW && !!cur.HW === HW) return ctx;
  return { ...ctx, requirements: { ...ctx.requirements, aspice: { ...raw, scope: { ...cur, SW, HW } } } };
}
// 산출물명 → ASPICE 문서 생성 가능 여부 (모델에 해당 내용이 있을 때만 — 없으면 기존 템플릿/스켈레톤 경로 유지)
// HW 문서는 OSSP 라이브러리에 템플릿이 없을 수 있으므로, HW 범위가 켜져 있으면 내용이 비어도 모델 구조(근거 없는 칸은 TBD)로 생성한다.
function aspiceCanBuild(kind, ctx0) {
  const ctx = withAspiceScope(ctx0);
  const raw = ctx?.requirements?.aspice;
  if (!kind || !raw) return false;
  const m = AE.normalizeModel(raw);
  if (AE.HW_DESIGN_KINDS.includes(kind)) return !!m.scope.HW && (m.comps.HW || []).some(c => c.hd?.parts?.length);   // HWE.2 회로 설계가 있어야 내용이 채워짐
  if (AE.HW_DOC_KINDS.includes(kind)) return !!m.scope.HW;
  const has = { SYS_AD: m.comps.SYS.length > 0, SW_RS: m.scope.SW && m.reqs.SW.length > 0, HW_RS: m.scope.HW && m.reqs.HW.length > 0,
    SW_AD: m.scope.SW && m.comps.SW.length > 0, HW_AD: m.scope.HW && m.comps.HW.length > 0, RTM: m.reqs.SYS.length > 0,
    STK_LIST: m.reqs.STK.length > 0, SW_DD: m.scope.SW && m.units.SW.length > 0 };
  if (kind in has) return has[kind];
  const D = AE.ASPICE_DOCS[kind];
  if (D?.test) return m.scope[AE.TEST_LEVELS[D.test].level] && m.tests.some(t => t.level === D.test);
  return false;   // SYS_RS는 기존 요구사항 명세서 경로(템플릿 채움)를 유지
}
function buildAspiceDoc(kind, meta, ctx0, doc) {
  const ctx = withAspiceScope(ctx0);
  if (kind === "SW_RS" || kind === "HW_RS") return { ext: "docx", bytes: makeAspiceReqDocx(kind === "SW_RS" ? "SW" : "HW", meta, ctx, doc) };
  if (kind === "SYS_AD" || kind === "SW_AD" || kind === "HW_AD") return { ext: "docx", bytes: makeAspiceArchDocx(kind === "SYS_AD" ? "SYS" : kind === "SW_AD" ? "SW" : "HW", meta, ctx, doc) };
  if (kind === "RTM") return { ext: "xlsx", bytes: makeAspiceRtmXlsx(meta, ctx, doc) };
  if (kind === "STK_LIST") return { ext: "xlsx", bytes: makeAspiceStkXlsx(meta, ctx, doc) };
  if (kind === "SW_DD") return { ext: "docx", bytes: makeAspiceUnitDesignDocx(meta, ctx, doc) };
  if (kind === "HW_DD") return { ext: "docx", bytes: makeHwDetailedDesignDocx(meta, ctx, doc) };
  if (kind === "HW_BOM" || kind === "HW_SC" || kind === "HW_AN") return { ext: "xlsx", bytes: makeHwDesignXlsx(kind, meta, ctx, doc) };
  return { ext: "xlsx", bytes: makeAspiceVerifXlsx(kind, meta, ctx, doc) };
}
// ASPICE V-모델 산출물 패키지 ZIP — 범위 내 생성 가능한 문서 전부 + 일관성 점검 보고
const ASPICE_PKG_ORDER = ["STK_LIST", "SYS_RS", "SYS_AD", "SW_RS", "SW_AD", "SW_DD", "HW_RS", "HW_AD", "HW_DD", "HW_BOM", "HW_SC", "HW_AN", "V_SYS5", "V_SYS4", "V_SWE6", "V_SWE5", "V_SWE4", "V_HWE4", "V_HWE3", "R_SYS5", "R_SYS4", "R_SWE6", "R_SWE5", "R_SWE4", "R_HWE4", "R_HWE3", "RTM"];
// V-모델 문서 1건 생성 (생성할 내용이 없으면 null)
// SYS.2 시스템 요구사항 명세서: 확정 요구(items)를 산출물 단계와 같은 경로로 생성
// — OSSP 등록 템플릿(SY2102)에 채움 → 템플릿이 없거나 채움 실패 시 자체 생성(문서명·코드는 ASPICE 기준)
async function buildVmodelDoc(k, meta, ctx) {
  const D = AE.ASPICE_DOCS[k];
  if (k === "SYS_RS") {
    if (!ctx?.requirements?.items?.length) return null;
    const doc = { name: D.title, code: D.code, aspice: true };
    let of = null;
    try { of = await resolveReqDocFromTemplate(doc, "spec", meta, ctx); } catch (_) { of = null; }
    return of || { ext: "docx", bytes: makeReqDocx(meta, ctx, `${D.proc} 시스템 요구사항 분석`, "spec", doc) };
  }
  if (!aspiceCanBuild(k, ctx)) return null;
  return buildAspiceDoc(k, meta, ctx, { name: D.title, code: D.code });
}
// V-모델에서 만들 수 있지만 WBS 산출물 목록에는 없는 문서 — 전체 ZIP에 함께 담아 누락을 막는다
function aspiceExtraKinds(deliverables, ctx) {
  if (!ctx?.requirements?.aspice) return [];
  const have = new Set((deliverables?.categories || []).flatMap(c => (c.documents || []).map(d => AE.aspiceDocKind(d.name)).filter(Boolean)));
  return ASPICE_PKG_ORDER.filter(k => !have.has(k) && (k === "SYS_RS" ? !!ctx.requirements.items?.length : aspiceCanBuild(k, ctx)));
}
// ── SWE.3 상세설계 모델 파일 묶음 (ZIP 폴더용): XMI(EA 17.2) · 다이어그램 SVG · 소스코드 · MISRA 체크리스트 ──
function swe3ModelFiles(meta, ctx, folder = "SW4101_상세설계_모델") {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const units = (model.units.SW || []).filter(u => u.dd?.classes?.length);
  if (!units.length) return [];
  const sanitize = x => String(x || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  const S = AE.ddSettings(model);
  const files = [];
  try { files.push({ path: `${folder}/xmi/${sanitize(meta.name) || "project"}_SWE3_UML2.1.xml`, content: AE.buildXmi(model, meta, { seed: meta?.id || meta?.name || "project" }) }); } catch (_) {}
  units.forEach(u => {
    AE.DD_DIAGRAMS.forEach(([k]) => { try { files.push({ path: `${folder}/diagrams/${u.id}/${u.id}_${k}.svg`, content: AE.ddSvg(k, u, model) }); } catch (_) {} });
    const code = u.dd.code && u.dd.code.target === S.target ? u.dd.code : (() => { try { return AE.generateCode(u, model, meta, S, null); } catch (_) { return null; } })();
    (code?.files || []).forEach(f => files.push({ path: `${folder}/src_${S.target}/${u.id}_${sanitize(u.name)}/${f.name}`, content: f.text }));
  });
  try { files.push({ path: `${folder}/MISRA_적용_체크리스트.xlsx`, content: makeXlsx({ sheetName: "MISRA", rows: AE.misraChecklistRows(S) }) }); } catch (_) {}
  files.push({ path: `${folder}/README.txt`, content: [`SWE.3 상세설계 모델 — ${meta.name || ""}`, ``, `xmi/      : UML 2.x XMI 2.1 — Sparx Systems Enterprise Architect 17.x에서 Publish › Model Exchange › Import › XMI File('Import Diagrams' 체크)로 가져오기`, `diagrams/ : 유닛별 다이어그램 7종(SVG) — 컴포넌트·클래스·시퀀스·상태 머신·액티비티·SysML BDD·IBD`, `src_${S.target}/ : ${AE.DD_TARGETS[S.target].label} 소스 (AUTOSAR ${S.release}) — ${S.target === "CP" ? "Rte_<Unit>.h는 RTE 생성기 출력으로 교체" : "ara::com proxy/skeleton은 생성기 출력 사용"}`, `MISRA_적용_체크리스트.xlsx : 규칙 번호별 조치·보장 수준 — 최종 준수 판정은 ${S.tools.join(" · ")} 결과로`, ``, `모든 요소·파일에 근거 SW 요구 ID가 기록되어 있습니다. 생성 결과는 QA 교차검토 후 확정하세요.`].join("\n") });
  return files;
}
// SWE.4 호스트 유닛 시험 실행 패키지 (ZIP 폴더용) — CP(C) 대상, 상세설계가 있을 때만
function swe4HostFiles(meta, ctx, folder = "SW4106_유닛시험_호스트실행") {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  try { const pkg = AE.buildHostTestPackage(model, meta, AE.ddSettings(model), folder); return pkg.units.length ? pkg.files : []; } catch (_) { return []; }
}
function hw2ModelFiles(meta, ctx, folder = "HW4101_HW설계_모델") {
  const model = AE.normalizeModel(ctx?.requirements?.aspice);
  const comps = (model.comps.HW || []).filter(c => c.hd?.parts?.length);
  if (!comps.length) return [];
  const files = [];
  try { files.push({ path: `${folder}/block/HW_architecture_block.svg`, content: AE.hdSvg("block", null, model) }); } catch (_) {}
  comps.forEach(c => { try { files.push({ path: `${folder}/schematics/${c.id}_schematic.svg`, content: AE.hdSvg("schematic", c, model) }); } catch (_) {} });
  const S = AE.hdSettings(model);
  files.push({ path: `${folder}/README.txt`, content: [`HWE.2 HW 설계 모델 — ${meta.name || ""}`, ``, `block/      : HW 아키텍처 블록도(04-52) SVG`, `schematics/ : 블록별 회로도(04-54) SVG — 넷 라벨 방식`, `EDA 교환 파일(${S.schematicFmt} 회로도 · ${S.layoutFmt} · ${S.fabFmt})은 다음 생성 단계에서 같은 폴더에 추가됩니다.`, `부품 PN은 AI 후보(BOM 14-54 참조). 모든 부품·넷·특성에 근거 HW 요구 ID가 기록됩니다.`].join("\n") });
  return files;
}
// ── SVG 미리보기 배율: "fit" = 패널 너비에 맞춤(viewBox 유지), 숫자 = 원본 대비 배율 ──
function svgFit(svg, zoom = "fit") {
  const m = /<svg\b([^>]*)>/.exec(svg || ""); if (!m) return svg || "";
  const attrs = m[1]; const w = Number(/\bwidth="([\d.]+)"/.exec(attrs)?.[1] || 0), h = Number(/\bheight="([\d.]+)"/.exec(attrs)?.[1] || 0);
  let a = attrs.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "");
  if (!/viewBox=/.test(a) && w && h) a += ` viewBox="0 0 ${w} ${h}"`;
  const style = zoom === "fit" ? `style="width:100%;height:auto;max-width:${w ? w * 1.5 : 2400}px;display:block"` : `style="width:${Math.round((w || 800) * zoom)}px;height:auto;display:block"`;
  return svg.replace(m[0], `<svg${a} ${style}>`);
}
const ZOOM_STEPS = ["fit", 0.5, 0.75, 1, 1.5, 2];
function SvgView({ svg, zoom, setZoom, maxHeight = 520 }) {
  const z = zoom ?? "fit";
  return (
    <div>
      <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "4px 8px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 10.5 }}>
        <span style={{ color: T.muted, marginRight: 4 }}>배율</span>
        {ZOOM_STEPS.map(st => <button key={String(st)} onClick={() => setZoom(st)} style={{ background: z === st ? T.accent : "none", color: z === st ? "#fff" : T.muted, border: `1px solid ${z === st ? T.accent : T.border}`, borderRadius: 5, padding: "1px 7px", cursor: "pointer", fontSize: 10.5, fontFamily: "inherit" }}>{st === "fit" ? "창에 맞춤" : `${Math.round(st * 100)}%`}</button>)}
        <span style={{ color: T.muted, marginLeft: "auto" }}>{z === "fit" ? "전체가 보이도록 축소 — 글씨가 작으면 100% 이상을 고르세요(가로 스크롤)" : "가로·세로 스크롤로 이동"}</span>
      </div>
      <div style={{ background: "#fff", overflow: "auto", maxHeight, padding: 6 }} dangerouslySetInnerHTML={{ __html: svgFit(svg, z) }} />
    </div>);
}
// ── 산출물 보기용 미리보기: 생성한 docx/xlsx 바이트를 HTML로 (외부 라이브러리 없이 문단·표·시트만) ──
const PV_ESC = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PV_UNESC = x => String(x).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
async function previewOfficeBytes(bytes, ext) {
  const files = await unzipBytes(bytes); const td = new TextDecoder(); const byPath = {}; files.forEach(f => { byPath[f.path] = f; });
  const read = p => { const f = byPath[p]; return f ? (typeof f.content === "string" ? f.content : td.decode(f.content)) : ""; };
  if (ext === "docx") {
    const xml = read("word/document.xml"); const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] || xml;
    const runText = p => [...p.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)].map(r => { const t = [...r[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(x => PV_UNESC(x[1])).join("") + (/<w:br\b/.test(r[0]) ? "\n" : ""); const b = /<w:b\b(?![^>]*w:val="0")/.test(r[0]); return b ? `<b>${PV_ESC(t)}</b>` : PV_ESC(t); }).join("").replace(/\n/g, "<br/>");
    const para = p => { const sz = Number(/<w:sz w:val="(\d+)"/.exec(p)?.[1] || 22); const jc = /<w:jc w:val="(center|right)"/.exec(p)?.[1]; const txt = runText(p); if (!txt.trim() && !/<w:drawing/.test(p)) return `<div style="height:6px"></div>`; const h = sz >= 32 ? "h1" : sz >= 26 ? "h2" : sz >= 24 ? "h3" : null; return h ? `<${h} style="margin:14px 0 6px;font-size:${sz / 2 + 2}px">${txt}</${h}>` : `<p style="margin:0 0 6px;font-size:${Math.max(11, sz / 2)}px;${jc ? `text-align:${jc};` : ""}line-height:1.6">${txt}</p>`; };
    const cell = c => { const ps = [...c.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(m => runText(m[0])).filter(Boolean).join("<br/>"); const shade = /<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(c)?.[1]; const span = /<w:gridSpan w:val="(\d+)"/.exec(c)?.[1]; return `<td${span ? ` colspan="${span}"` : ""} style="border:1px solid #bbb;padding:4px 6px;vertical-align:top;font-size:11.5px;${shade && shade !== "FFFFFF" && shade !== "auto" ? `background:#${shade};` : ""}">${ps || "&nbsp;"}</td>`; };
    const table = t => `<table style="border-collapse:collapse;margin:6px 0 12px;width:100%;table-layout:fixed">${[...t.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(tr => `<tr>${[...tr[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(tc => cell(tc[0])).join("")}</tr>`).join("")}</table>`;
    // 본문을 최상위 요소 순서대로(문단·표) 순회
    const out = []; const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g; let m, n = 0;
    while ((m = re.exec(body)) && n < 4000) { out.push(m[0].startsWith("<w:tbl") ? table(m[0]) : para(m[0])); n++; }
    return { kind: "html", html: `<div style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#222;background:#fff;padding:22px 28px;word-break:break-word;overflow-wrap:anywhere">${out.join("")}</div>` };
  }
  // xlsx: 시트별 표
  const unesc = PV_UNESC;
  const sst = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const wbXml = read("xl/workbook.xml"), relXml = read("xl/_rels/workbook.xml.rels"); const relMap = {};
  [...relXml.matchAll(/<Relationship\b[^>]*>/g)].forEach(m => { const id = /Id="([^"]+)"/.exec(m[0]); const tg = /Target="([^"]+)"/.exec(m[0]); if (id && tg) relMap[id[1]] = tg[1]; });
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ name: unesc(/name="([^"]+)"/.exec(m[0])?.[1] || ""), rid: /r:id="([^"]+)"/.exec(m[0])?.[1] || "" })).map(s => ({ ...s, path: relMap[s.rid] ? "xl/" + relMap[s.rid].replace(/^\//, "").replace(/^xl\//, "") : "" })).filter(s => byPath[s.path]);
  const colIdx = ref => { const L = /^[A-Z]+/.exec(ref)?.[0] || "A"; let n = 0; for (const ch of L) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const cellText = (attrs, inner) => { if (/t="s"/.test(attrs)) { const v = /<v>([\s\S]*?)<\/v>/.exec(inner || ""); return v ? (sst[Number(v[1])] || "") : ""; } if (/t="inlineStr"/.test(attrs)) return unesc([...(inner || "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")); const v = /<v>([\s\S]*?)<\/v>/.exec(inner || ""); return v ? unesc(v[1]) : ""; };
  const out = sheets.map(sh => { const xml = read(sh.path); const sd = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] || ""; const merges = [...xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].map(m => ({ c1: colIdx(m[1]), r1: Number(m[2]), c2: colIdx(m[3]), r2: Number(m[4]) }));
    const rows = [...sd.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)].map(m => { const rn = Number(/r="(\d+)"/.exec(m[1])?.[1] || 0); const cells = {}; [...(m[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].forEach(c => { const ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1]; if (ref) cells[colIdx(ref)] = cellText(c[1], c[2]); }); return { rn, cells }; }).filter(r => Object.keys(r.cells).length);
    const maxC = Math.max(0, ...rows.flatMap(r => Object.keys(r.cells).map(Number))); const skip = new Set(); merges.forEach(mg => { for (let r = mg.r1; r <= mg.r2; r++) for (let c = mg.c1; c <= mg.c2; c++) if (!(r === mg.r1 && c === mg.c1)) skip.add(`${r}:${c}`); });
    const html = `<table style="border-collapse:collapse;font-size:11px;white-space:pre-wrap">${rows.slice(0, 600).map(r => `<tr>${Array.from({ length: maxC + 1 }, (_, c) => { if (skip.has(`${r.rn}:${c}`)) return ""; const mg = merges.find(x => x.r1 === r.rn && x.c1 === c); const span = mg ? ` colspan="${mg.c2 - mg.c1 + 1}" rowspan="${mg.r2 - mg.r1 + 1}"` : ""; const v = r.cells[c] ?? ""; return `<td${span} style="border:1px solid #ccc;padding:3px 6px;vertical-align:top;min-width:40px">${PV_ESC(v)}</td>`; }).join("")}</tr>`).join("")}</table>${rows.length > 600 ? `<div style="padding:6px;color:#777">… ${rows.length - 600}행 더 있음</div>` : ""}`;
    return { name: sh.name, html }; });
  return { kind: "sheets", sheets: out };
}
async function downloadAspicePackage(meta, ctx) {
  const sanitize = s => String(s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  const order = ASPICE_PKG_ORDER;
  const files = [];
  for (let i = 0; i < order.length; i++) {
    const k = order[i], D = AE.ASPICE_DOCS[k];
    const of = await buildVmodelDoc(k, meta, ctx);
    if (!of) continue;
    files.push({ path: `${String(i + 1).padStart(2, "0")}_${D.code}_${sanitize(D.title)}.${of.ext}`, content: of.bytes });
  }
  try { swe3ModelFiles(meta, ctx, `${String(order.length + 1).padStart(2, "0")}_SW4101_상세설계_모델`).forEach(f => files.push(f)); } catch (_) {}
  try { hw2ModelFiles(meta, ctx, `${String(order.length + 2).padStart(2, "0")}_HW4101_HW설계_모델`).forEach(f => files.push(f)); } catch (_) {}
  try { swe4HostFiles(meta, ctx, `${String(order.length + 3).padStart(2, "0")}_SW4106_유닛시험_호스트실행`).forEach(f => files.push(f)); } catch (_) {}
  if (!files.length) throw new Error("생성할 수 있는 ASPICE 산출물이 없습니다. 시스템 요소·하위 요구·검증 수단을 먼저 작성하세요.");
  const blob = new Blob([zipBytes(files)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${sanitize(meta.name) || "project"}_ASPICE_V모델_산출물.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return files.length;
}

async function resolveDeliverableFile(doc, catName, meta, wbs, ctx0) {
  const ctx = withAspiceScope(ctx0);
  // ASPICE V-모델 산출물(SyAD·SW/HW 요구·설계·검증 명세/결과·RTM): 추적 모델에 내용이 있으면 모델에서 생성
  // (SW 요구사항 명세서가 아래 요구사항 경로에 걸려 시스템 요구로 채워지는 것을 막기 위해 가장 먼저 판정)
  const aKind = AE.aspiceDocKind(doc.name);
  if (aKind && aspiceCanBuild(aKind, ctx)) {
    try { return buildAspiceDoc(aKind, meta, ctx, doc); } catch (_) { /* 생성 실패 시 기존 경로 폴백 */ }
  }
  // 요구사항 정의서·명세서: 확정 요구사항이 있으면 OSSP 산출물템플릿에 채워 표준 양식 그대로 생성 (실패 시 자체 생성 폴백)
  const reqKind0 = reqDocKindFor(doc.name, ctx);
  if (reqKind0 && ctx?.requirements?.items?.length) {
    try {
      const viaTpl = await resolveReqDocFromTemplate(doc, reqKind0, meta, ctx);
      if (viaTpl) return viaTpl;
    } catch (_) { /* 템플릿 조회·채움 실패 시 자체 생성 폴백 */ }
  }
  if (!isDynamicDoc(doc, wbs, ctx)) {
    try {
      // 1) 선택된 OSSP의 산출물템플릿에서 우선 매칭 (내장 OSSP는 이름 → DB UUID 해석)
      let tpl = null;
      const dbId = await resolveOsspDbId(ctx?.ossp);
      if (dbId) tpl = findTemplateFor(doc.name, await fetchOsspTemplates(dbId));
      // 2) 없으면 전체 OSSP 라이브러리의 산출물템플릿에서 폴백 매칭
      if (!tpl) tpl = findTemplateFor(doc.name, await fetchOsspTemplates(null));
      if (tpl) {
        const bytes = await fetchTemplateBytes(tpl);
        if (bytes) {
          const ext = (String(tpl.file_name).split(".").pop() || "bin").toLowerCase();
          // 모든 OSSP 템플릿 공통: 표지·머리글의 문서정보 placeholder를 프로젝트 값으로 치환
          // (결재란은 대상이 아님 — reqTplPlaceholderPairs 주석 참조)
          let cur = bytes;
          if (ext === "docx" || ext === "xlsx") {
            try {
              const files = await unzipBytes(cur);
              if (applyTemplateMeta(files, meta, doc)) cur = zipBytes(files);
            } catch (_) { /* 치환 실패 시 원본 유지 */ }
          }
          // 템플릿이 docx면 프로젝트 로고(고객사·우리회사) 주입 시도 — 실패 시 원본 그대로
          if (ext === "docx") {
            try {
              const injected = await injectLogosIntoTemplateDocx(cur, meta);
              if (injected) return { ext, bytes: injected };
            } catch (_) { /* 주입 실패 시 원본 유지 */ }
            return { ext, bytes: cur };
          }
          // 템플릿이 xlsx면: (1) 개정이력 예시행 정리 → (2) 요구사항 추적 매트릭스 채움 → (3) 로고 치환
          if (ext === "xlsx") {
            try {
              const files = await unzipBytes(cur);
              if (resetXlsxRevisionHistory(files, meta)) cur = zipBytes(files);
            } catch (_) { /* 개정이력 정리 실패 시 원본 유지 */ }
            try {
              const nn = normDocName(doc.name);
              if (nn.includes("추적매트릭스") || (nn.includes("요구사항") && nn.includes("추적"))) {
                const withReq = await injectRequirementsIntoRtmXlsx(cur, ctx?.requirements);
                if (withReq) cur = withReq;
              }
            } catch (_) { /* 요구사항 주입 실패 시 원본 유지 */ }
            try {
              // OSSP 가이드가 지정한 산출물(예: 이해관계자 요구사항 목록·인터페이스 정의서)에 확정 요구사항 채움
              const nn2 = normDocName(doc.name);
              const fillCfg = (getGuideForOSSP(ctx?.ossp || {})?.reqXlsxFill || []).find(c => nn2.includes(normDocName(c.match)));
              if (fillCfg && ctx?.requirements?.items?.length) {
                const filled = await injectRequirementsIntoXlsxByHeader(cur, fillCfg, ctx.requirements);
                if (filled) cur = filled;
              }
            } catch (_) { /* 채움 실패 시 원본 유지 */ }
            try {
              const injected = await injectLogosIntoTemplateXlsx(cur, meta);
              return { ext, bytes: injected || cur };
            } catch (_) { return { ext, bytes: cur }; }
          }
          return { ext, bytes: cur };
        }
      }
    } catch (_) { /* 템플릿 조회·다운로드 실패 시 스켈레톤 폴백 */ }
  }
  return officeFileForDoc(doc, catName, meta, wbs, ctx);
}

// 산출물 1건 → Office 파일 바이트 생성 (wbs: WBS 산출물에 일정 계획 원본을 담기 위한 전달)
function officeFileForDoc(doc, catName, meta, wbs, ctx) {
  // 산출물명이 'WBS'면 스켈레톤 대신 ④ 일정 계획 전체를 담은 간트 워크북(수식·조건부 서식, 일/주 전환)을 생성
  if (String(doc.name||"").replace(/\s/g,"").toUpperCase() === "WBS" && wbs?.tasks?.length) {
    return { ext: "xlsx", bytes: makeWbsGanttXlsx(wbs, meta) };
  }
  // 산출물명이 '테일러링결과서'면 스켈레톤 대신 PDP 화면과 동일한 구성의 실제 문서를 생성
  if (String(doc.name||"").replace(/\s/g,"") === "테일러링결과서" && ctx?.tailoring) {
    return { ext: "docx", bytes: makePdpDocx(meta, ctx, catName) };
  }
  // 산출물명이 요구사항 정의서/명세서(통합 포함)이고 확정된 요구사항이 있으면 실문서를 생성
  const reqKind = reqDocKindFor(doc.name, ctx);
  if (reqKind && ctx?.requirements?.items?.length) {
    return { ext: "docx", bytes: makeReqDocx(meta, ctx, catName, reqKind, doc) };
  }
  const fmt = pickOfficeFormat(doc.name);
  const today = new Date().toLocaleDateString("ko-KR");
  const prio = prioInfo(doc.priority).label;
  const period = `${meta.startDate || ""} ~ ${meta.endDate || ""}`;
  if (fmt === "xlsx") {
    const sheetName = String(doc.name).replace(/[\\/?*\[\]:]/g, " ").slice(0, 28).trim() || "Sheet1";
    return { ext: "xlsx", bytes: makeXlsx({ sheetName, rows: [
      ["문서명", doc.name], ["문서 코드", doc.code || "-"], ["단계/프로세스", catName], ["구분", prio],
      ["프로젝트명", meta.name || ""], ["고객사", meta.client || ""], ["PM", meta.pm || ""],
      ["프로젝트 기간", period], ["작성일", today], ["버전", "V0.1 (초안)"],
      ["목적", doc.purpose || ""], [],
      ["No", "항목", "내용", "작성자", "일자", "비고"],
      ["1", "", "", "", "", ""], ["2", "", "", "", "", ""], ["3", "", "", "", "", ""],
    ] }) };
  }
  if (fmt === "pptx") {
    return { ext: "pptx", bytes: makePptx({ title: doc.name, lines: [
      `프로젝트: ${meta.name || ""}`,
      `고객사: ${meta.client || ""} · PM: ${meta.pm || ""}`,
      `단계/프로세스: ${catName} · ${prio}`,
      `목적: ${doc.purpose || ""}`,
      `작성일: ${today} · V0.1 (초안)`,
    ] }) };
  }
  return { ext: "docx", bytes: makeDocx({ title: doc.name, purpose: doc.purpose, doc, catName, meta }) };
}

// 산출물 1건만 개별 다운로드 (ZIP 내부와 동일한 파일명 규칙)
const OFFICE_MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint",
  pdf: "application/pdf", txt: "text/plain", zip: "application/zip",
};
async function downloadSingleDeliverable(doc, catName, meta, wbs, ctx) {
  const sanitize = s => String(s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  const pi = prioInfo(doc.priority);
  const of = await resolveDeliverableFile(doc, catName, meta, wbs, ctx);
  const mime = OFFICE_MIME[of.ext] || "application/octet-stream";
  const codePart = sanitize(doc.code || "");
  const wbsPart = sanitize(doc.wbsNo || "");
  const blob = new Blob([of.bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url; aEl.download = `[${pi.label}] ${wbsPart ? wbsPart + "_" : ""}${codePart ? codePart + "_" : ""}${sanitize(doc.name)}.${of.ext}`;
  document.body.appendChild(aEl); aEl.click(); aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// 산출물 전체를 폴더 구조 ZIP으로 다운로드 (각 파일은 실제 Office 문서)
// onProgress?: ({ percent, label }) => void — 건별 파일 생성 진행률 보고 (템플릿 조회·문서 생성이 오래 걸릴 수 있음)
// ── 서명본 산출물 ─────────────────────────────────────────────────────
// "승인된 프로젝트 기술서"처럼 원본 문서를 출력해 서명만 받는 산출물은 파일을 따로 만들지 않는다.
// 내용이 같은 문서가 두 벌 생성되면 어느 쪽이 정본인지 흐려져 형상관리가 어긋난다.
// 목록·WBS에서는 빼지 않는다 — 프로세스 산출물로서 수행 증적에 남아야 하기 때문.
const SIGN_OFF_PREFIX = "승인된";
function isSignOffDoc(name) { return String(name || "").trim().startsWith(SIGN_OFF_PREFIX); }
function signOffOriginal(name) {
  const s = String(name || "").trim();
  return s.startsWith(SIGN_OFF_PREFIX) ? (s.slice(SIGN_OFF_PREFIX.length).trim() || s) : s;
}
function signOffNote(name) {
  const o = signOffOriginal(name);
  return `${o}${josaEul(o)} 출력해 서명받는 문서입니다 — 별도 파일을 생성하지 않습니다.`;
}

async function downloadDeliverablesZip(deliverables, meta, wbs, ctx, onProgress) {
  const report = (percent, label) => { try { onProgress && onProgress({ percent, label }); } catch (_) {} };
  const sanitize = s => String(s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  const cats = deliverables?.categories || [];
  const allCount = cats.reduce((n, c) => n + (c.documents?.length || 0), 0);
  let done = 0;
  report(2, `산출물 파일 생성 준비 중… (총 ${allCount}건)`);
  const files = []; const manifest = [];
  let total = 0, mand = 0, signOff = 0;
  for (let ci = 0; ci < cats.length; ci++) {
    const cat = cats[ci];
    const folder = `${String(ci + 1).padStart(2, "0")}_${sanitize(cat.name)}`;
    for (const doc of (cat.documents || [])) {
      const pi = prioInfo(doc.priority);
      // 서명본은 파일을 만들지 않고 목록에만 기록한다
      const docNoOf = d => docCodeWithPrefix(d.code || "", meta) || "-";
      if (isSignOffDoc(doc.name)) {
        manifest.push([folder, doc.wbsNo || "-", doc.code || "-", docNoOf(doc), doc.name, "서명본", pi.label, signOffNote(doc.name)]);
        signOff += 1; done += 1;
        continue;
      }
      // 2~92% 구간을 건수 비례로 배분 — 파일 하나 생성할 때마다 전진
      report(2 + (done / Math.max(1, allCount)) * 90, `${doc.name} 생성 중… (${done + 1}/${allCount})`);
      const of = await resolveDeliverableFile(doc, cat.name, meta, wbs, ctx);
      done += 1;
      const codePart = sanitize(doc.code || "");
      const wbsPart = sanitize(doc.wbsNo || "");   // 동일 산출물명이 여러 Task에 있어도 WBS 번호로 파일명 구분
      files.push({ path: `${folder}/[${pi.label}] ${wbsPart ? wbsPart + "_" : ""}${codePart ? codePart + "_" : ""}${sanitize(doc.name)}.${of.ext}`, content: of.bytes });
      manifest.push([folder, doc.wbsNo || "-", doc.code || "-", docNoOf(doc), doc.name, of.ext.toUpperCase(), pi.label, doc.purpose || ""]);
      total += 1; if (pi.label === "필수(M)") mand += 1;
    }
  }
  // ASPICE: WBS 산출물 목록에 없는 V-모델 문서도 함께 담는다 (V-모델 편집 결과 누락 방지)
  const extra = aspiceExtraKinds(deliverables, ctx);
  if (extra.length) {
    const folder = "99_V-모델 추가 산출물(WBS 미지정)";
    for (const k of extra) {
      const D = AE.ASPICE_DOCS[k];
      report(92, `V-모델 산출물 ${D.title} 생성 중…`);
      let of = null; try { of = await buildVmodelDoc(k, meta, ctx); } catch (_) { of = null; }
      if (!of) continue;
      files.push({ path: `${folder}/${D.code}_${sanitize(D.title)}.${of.ext}`, content: of.bytes });
      manifest.push([folder, "-", D.code, docCodeWithPrefix(D.code, meta) || "-", D.title, of.ext.toUpperCase(), "V-모델", `WBS 산출물 목록에 없음 — ASPICE V-모델(${D.proc})에서 생성`]);
      total += 1;
    }
  }
  // SWE.3 상세설계 모델(XMI·다이어그램·코드·MISRA) — 상세설계가 있을 때만
  try { const hf = hw2ModelFiles(meta, ctx); if (hf.length) { hf.forEach(f => files.push(f)); manifest.push([hf[0].path.split("/")[0], "-", "HW4101", docCodeWithPrefix("HW4101", meta) || "-", "HWE.2 HW 설계 모델(블록도·회로도)", "폴더", "V-모델", `파일 ${hf.length}개`]); total += 1; } } catch (_) {}
  try { const mf = swe3ModelFiles(meta, ctx); if (mf.length) { report(93, `SWE.3 상세설계 모델 ${mf.length}개 파일 추가 중…`); mf.forEach(f => files.push(f)); manifest.push([mf[0].path.split("/")[0], "-", "SW4101", docCodeWithPrefix("SW4101", meta) || "-", "SWE.3 상세설계 모델(XMI·다이어그램·소스·MISRA)", "폴더", "V-모델", `파일 ${mf.length}개 — EA 17.x XMI 가져오기 · ${AE.ddSettings(AE.normalizeModel(ctx?.requirements?.aspice)).target} 소스`]); total += 1; } } catch (_) {}
  try { const tf = swe4HostFiles(meta, ctx); if (tf.length) { tf.forEach(f => files.push(f)); manifest.push([tf[0].path.split("/")[0], "-", "SW4106", docCodeWithPrefix("SW4106", meta) || "-", "SWE.4 유닛 시험 호스트 실행 패키지(RTE 스텁·시험 케이스·실행 스크립트)", "폴더", "V-모델", `파일 ${tf.length}개 — gcc로 run_tests 실행`]); total += 1; } } catch (_) {}
  report(94, "산출물 목록 작성·ZIP 압축 중…");
  files.unshift({ path: "00_산출물목록.xlsx", content: makeXlsx({ sheetName: "산출물목록", rows: [
    ["프로젝트", meta.name || ""], ["고객사", meta.client || ""], ["PM", meta.pm || ""],
    ["생성일", new Date().toLocaleString("ko-KR")],
    ["전체", `${total}건 (필수(M) ${mand} · 선택(O) ${total - mand})`],
    ...(signOff ? [["서명본", `${signOff}건 — 원본 문서를 출력해 서명받는 문서로, 파일을 생성하지 않습니다`]] : []),
    [],
    ["폴더", "WBS", "코드", "문서번호", "산출물", "형식", "구분", "목적"],
    ...manifest,
  ] }) });
  const blob = new Blob([zipBytes(files)], { type: "application/zip" });
  report(100, `ZIP 다운로드 시작 — 산출물 ${total}건` + (signOff ? ` (서명본 ${signOff}건 제외)` : ""));
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url; aEl.download = `${sanitize(meta.name) || "project"}_산출물.zip`;
  document.body.appendChild(aEl); aEl.click(); aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ── 작성 가이드(전역 라이브러리): 방법론 작성가이드·글로벌 표준(PMBOK·CMMI 등)·글로벌 규제 ──
// AI가 산출물을 작성할 때 프롬프트에 주입되어 준수 기준으로 사용됨 — 모든 AI 작성 기능 공용 헬퍼
const GUIDE_CATEGORIES = ["방법론 작성가이드", "글로벌 표준", "글로벌 규제", "기타"];

async function fetchWritingGuides() {
  const r = await fetch("/api/writing-guides");
  const d = await r.json().catch(() => []);
  return Array.isArray(d) ? d : [];
}

// 선택된 가이드들의 요약을 프롬프트 주입용 블록으로 결합 — 토큰·타임아웃 보호를 위해 총량 제한
function buildGuideBlock(guides, cap = 4000) {
  const rows = (guides || []).filter(g => g && String(g.summary || "").trim());
  if (!rows.length) return "";
  let block = "";
  for (const g of rows) {
    const piece = `\n[${g.name} · ${g.category}]\n${String(g.summary).trim()}\n`;
    if (block.length + piece.length > cap) break;
    block += piece;
  }
  if (!block) return "";
  return `\n--- 작성 가이드 (요구사항의 내용·표현·품질 기준으로 반드시 준수) ---${block}--- 작성 가이드 끝 ---
※ 주의: 작성 가이드는 내용 작성 기준이다. 출력 JSON 스키마·필드 구성·id 값은 반드시 아래 지시를 그대로 따르고, 가이드의 문서 양식·ID 체계를 이유로 출력 형식이나 id를 바꾸지 마라.\n`;
}

// 가이드 원문 → AI 요약(핵심 작성 규칙만 추출) — 등록 시 1회 수행 후 저장, 작성 시에는 요약본만 주입
// 원문이 길면 6,000자 단위 분할 호출 (Vercel 타임아웃 대응, 최대 3청크=18,000자)
async function summarizeGuideText(name, category, text, onProg) {
  const src = String(text || "").slice(0, 18000);
  const chunks = [];
  for (let i = 0; i < src.length; i += 6000) chunks.push(src.slice(i, i + 6000));
  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    onProg?.(`가이드 핵심 규칙 추출 중… (${i + 1}/${chunks.length})`);
    const r = await callClaudeJson(`당신은 SI 품질보증 전문가입니다. 아래 작성 가이드 문서(${category}: ${name})에서, AI가 요구사항 정의서·명세서 등 프로젝트 산출물을 작성할 때 반드시 준수해야 할 핵심 작성 규칙만 추출하세요.
규칙: 산출물 작성에 직접 영향을 주는 것만(용어·표기 규칙, 필수 항목·문서 구조, 품질기준·측정기준, ID 부여·추적성, 준수해야 할 표준·규제 조항). 배경 설명·일반론 제외. 최대 12개, 각 60자 이내.
JSON만 출력: {"rules":["규칙1","규칙2"]}
--- 가이드 원문 ---
${chunks[i]}`, 3000);
    (Array.isArray(r?.rules) ? r.rules : []).forEach(x => { const s = String(x || "").trim(); if (s) parts.push(s); });
  }
  return [...new Set(parts)].map(s => "· " + s).join("\n").slice(0, 2000);
}

// ── 다중 파일 업로드 공용 헬퍼: txt·docx·xlsx 여러 개를 한 번에 텍스트로 추출 ──
// 반환: { files:[{name,text}], errors:[사유] } — 파일 선택·드래그앤드롭 양쪽에서 사용
async function readUploadFiles(fileArr) {
  const files = [], errors = [];
  for (const f of Array.from(fileArr || [])) {
    try {
      const name = f.name.toLowerCase();
      let text = "";
      if (name.endsWith(".txt")) text = await f.text();
      else if (name.endsWith(".docx")) text = await docxBytesToText(new Uint8Array(await f.arrayBuffer()));
      else if (name.endsWith(".xlsx")) text = await xlsxBytesToText(new Uint8Array(await f.arrayBuffer()));
      else { errors.push(`${f.name}: txt·docx·xlsx만 지원`); continue; }
      if (!text.trim()) { errors.push(`${f.name}: 텍스트 추출 실패`); continue; }
      files.push({ name: f.name, text: text.trim() });
    } catch (e) { errors.push(`${f.name}: ${e.message}`); }
  }
  return { files, errors };
}
// 파일 배열 병합 — 같은 이름을 다시 올리면 교체
function mergeUploadFiles(prev, added) {
  const byName = Object.fromEntries(prev.map(f => [f.name, f]));
  added.forEach(f => { byName[f.name] = f; });
  return Object.values(byName);
}

// ── 작성 가이드 패널 (AI 작성 모달 공용 UI): 전역 가이드 목록·적용 선택·등록·삭제 ──
function WritingGuidePanel({ guides, setGuides, sel, setSel, disabled }) {
  const [openPanel, setOpenPanel] = useState(false);
  const [adding, setAdding] = useState(false);
  const [gName, setGName] = useState("");
  const [gCat, setGCat] = useState(GUIDE_CATEGORIES[0]);
  const [gText, setGText] = useState("");
  const [gFiles, setGFiles] = useState([]);   // 업로드된 가이드 파일들 [{name, text}]
  const [gDrag, setGDrag] = useState(false);  // 드래그앤드롭 하이라이트
  const [gBusy, setGBusy] = useState(false);
  const [gProg, setGProg] = useState("");
  const [gErr, setGErr] = useState(null);
  const inp = { width:"100%", padding:"5px 7px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:11, fontFamily:"inherit", boxSizing:"border-box" };
  const applied = guides.filter(g => sel[g.id]).length;

  async function addGuideFiles(fileArr) {
    if (gBusy) return;
    setGErr(null);
    const { files, errors } = await readUploadFiles(fileArr);
    if (files.length) {
      setGFiles(prev => mergeUploadFiles(prev, files));
      if (!gName.trim()) setGName(files[0].name.replace(/\.(txt|docx|xlsx)$/i, ""));
    }
    if (errors.length) setGErr(errors.join(" / "));
  }
  async function onGuideFile(e) {
    const arr = Array.from(e.target.files || []);
    e.target.value = "";
    await addGuideFiles(arr);
  }

  async function register() {
    if (!gName.trim()) { setGErr("가이드 이름을 입력해 주세요."); return; }
    const combined = [gText.trim(), ...gFiles.map(f => `[파일: ${f.name}]\n${f.text}`)].filter(Boolean).join("\n\n");
    if (combined.length < 50) { setGErr("가이드 내용을 50자 이상 입력하거나 파일을 업로드해 주세요."); return; }
    setGBusy(true); setGErr(null);
    try {
      const summary = await summarizeGuideText(gName.trim(), gCat, combined, setGProg);
      if (!summary) throw new Error("가이드에서 작성 규칙을 추출하지 못했습니다. 내용을 확인해 주세요.");
      setGProg("가이드 저장 중…");
      const r = await fetch("/api/writing-guides", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ name: gName.trim(), category: gCat, summary, content: combined.slice(0, 50000) }),
      });
      const created = await r.json().catch(() => null);
      if (!r.ok || !created?.id) throw new Error(created?.error || `저장 실패 (status ${r.status})`);
      setGuides(gs => [...gs, created]);
      setSel(s => ({ ...s, [created.id]: true }));
      setGName(""); setGText(""); setGFiles([]); setGCat(GUIDE_CATEGORIES[0]); setAdding(false);
    } catch (e) { setGErr("가이드 등록 실패: " + e.message); }
    setGBusy(false); setGProg("");
  }

  async function remove(g) {
    if (!window.confirm(`작성 가이드 "${g.name}"${josaEul(g.name)} 삭제할까요?\n(전역 라이브러리이므로 모든 프로젝트에서 제거됩니다)`)) return;
    try {
      const r = await fetch(`/api/writing-guides?id=${g.id}`, { method:"DELETE" });
      if (!r.ok) throw new Error(`삭제 실패 (status ${r.status})`);
      setGuides(gs => gs.filter(x => x.id !== g.id));
      setSel(s => { const n = { ...s }; delete n[g.id]; return n; });
    } catch (e) { setGErr(e.message); }
  }

  return (
    <div style={{ border:`1px solid ${T.amber}44`, borderLeft:`3px solid ${T.amber}`, borderRadius:9, marginBottom:12, background:T.amber+"0A" }}>
      <div onClick={()=>setOpenPanel(o=>!o)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", cursor:"pointer" }}>
        <span style={{ fontSize:11.5, fontWeight:600, color:T.amber }}>📐 작성 가이드</span>
        <span style={{ fontSize:10.5, color: applied ? T.accent : T.muted }}>
          {guides.length ? `등록 ${guides.length}건 · 적용 ${applied}건` : "등록된 가이드 없음"}
        </span>
        <span style={{ fontSize:10, color:T.muted }}>— 방법론 작성가이드·글로벌 표준(PMBOK®·CMMI)·규제를 등록하면 AI가 준수하여 작성합니다 (전역 공용)</span>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:10, color:T.muted }}>{openPanel ? "▲" : "▼"}</span>
      </div>
      {openPanel && (
        <div style={{ padding:"0 12px 10px" }}>
          {guides.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
              {guides.map(g => (
                <div key={g.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", border:`1px solid ${T.border}`, borderRadius:7, background:T.surface }}>
                  <input type="checkbox" checked={!!sel[g.id]} disabled={disabled}
                    onChange={e=>setSel(s=>({ ...s, [g.id]: e.target.checked }))} style={{ cursor:"pointer" }} />
                  <span style={{ fontSize:11, fontWeight:600 }}>{g.name}</span>
                  <span style={{ fontSize:9.5, color:T.accent, border:`1px solid ${T.accentDim}`, borderRadius:5, padding:"1px 6px" }}>{g.category}</span>
                  <span title={g.summary} style={{ fontSize:10, color:T.muted, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{String(g.summary||"").replace(/\n/g," ")}</span>
                  <button onClick={()=>remove(g)} disabled={disabled||gBusy} title="삭제" style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:11 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {!adding ? (
            <button onClick={()=>setAdding(true)} disabled={disabled} style={{ background:"none", border:`1px dashed ${T.border}`, borderRadius:7, color:T.accent, cursor:"pointer", fontSize:11, padding:"5px 12px", fontFamily:"inherit" }}>＋ 가이드 등록</button>
          ) : (
            <div onDragOver={e=>{ e.preventDefault(); if (!gBusy) setGDrag(true); }} onDragLeave={()=>setGDrag(false)}
              onDrop={e=>{ e.preventDefault(); setGDrag(false); addGuideFiles(Array.from(e.dataTransfer.files || [])); }}
              style={{ border:`1px dashed ${gDrag ? T.accent : T.border}`, borderRadius:8, padding:10, background: gDrag ? T.accent+"14" : "transparent" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", gap:6, marginBottom:6 }}>
                <input value={gName} onChange={e=>setGName(e.target.value)} placeholder="가이드 이름 (예: PMBOK 8판 품질관리 기준)" disabled={gBusy} style={inp} />
                <select value={gCat} onChange={e=>setGCat(e.target.value)} disabled={gBusy} style={inp}>
                  {GUIDE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <textarea value={gText} onChange={e=>setGText(e.target.value)} disabled={gBusy}
                placeholder="가이드 내용 붙여넣기, 파일 업로드 또는 이 영역에 파일 드래그앤드롭(여러 개 가능) — 등록 시 AI가 핵심 작성 규칙만 추출해 저장하며, 산출물 작성 시 해당 규칙이 적용됩니다."
                style={{ ...inp, minHeight:70, resize:"vertical", lineHeight:1.5, marginBottom:6 }} />
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 10px", border:`1px dashed ${T.border}`, borderRadius:7, cursor: gBusy?"default":"pointer", fontSize:10.5, color:T.muted }}>
                  📎 파일 업로드 (txt·docx·xlsx · 여러 개)
                  <input type="file" multiple accept=".txt,.docx,.xlsx" onChange={onGuideFile} disabled={gBusy} style={{ display:"none" }} />
                </label>
                {gFiles.map(f => (
                  <span key={f.name} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10, color:T.accent, border:`1px solid ${T.accentDim}`, borderRadius:6, padding:"2px 7px", background:T.bg }}>
                    📄 {f.name}
                    <button onClick={()=>setGFiles(fs=>fs.filter(x=>x.name!==f.name))} disabled={gBusy} title="파일 제거" style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:10, padding:0, lineHeight:1 }}>✕</button>
                  </span>
                ))}
                {gBusy && gProg && <span style={{ fontSize:10.5, color:T.amber }}>⏳ {gProg}</span>}
                <div style={{ flex:1 }} />
                <button onClick={()=>{ setAdding(false); setGErr(null); }} disabled={gBusy} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.muted, cursor:"pointer", fontSize:10.5, padding:"4px 10px", fontFamily:"inherit" }}>취소</button>
                <button onClick={register} disabled={gBusy} style={{ background:T.accent, border:"none", borderRadius:6, color:"#fff", cursor:"pointer", fontSize:10.5, padding:"4px 12px", fontFamily:"inherit", fontWeight:600 }}>{gBusy ? "등록 중…" : "✓ 등록"}</button>
              </div>
            </div>
          )}
          {gErr && <div style={{ color:T.red, fontSize:11, marginTop:6 }}>{gErr}</div>}
        </div>
      )}
    </div>
  );
}

// ── 요구사항 AI 작성 모달: 원문 입력(텍스트·txt·docx 업로드) → AI 도출·명세 → 검토·수정 → 확정 ──
// 확정된 요구사항은 요구사항 정의서·명세서 docx 생성과 요구사항 추적 매트릭스(xlsx) 자동 채움에 사용됨
// embedded: ASPICE 과제에서 V-모델 ② 탭 안에 패널로 표시 (오버레이·헤더 없음, 확정 시 onEmbeddedConfirm 호출)
// 원문·파일 저장 묶음 — 프로젝트 JSON에 들어가므로 용량 상한(파일당 40만 자·전체 150만 자)을 두고 초과분은 잘라 표시한다
const SRC_FILE_CAP = 400000, SRC_TOTAL_CAP = 1500000;
function packReqSource(text, files) {
  let budget = SRC_TOTAL_CAP - Math.min(String(text || "").length, SRC_FILE_CAP);
  const out = (files || []).map(f => {
    const full = String(f.text || "");
    const cap = Math.max(0, Math.min(SRC_FILE_CAP, budget));
    const t = full.length > cap ? full.slice(0, cap) : full;
    budget -= t.length;
    return { name: f.name, text: t, chars: full.length, truncated: full.length > t.length || !!f.truncated };
  });
  return { text: String(text || "").slice(0, SRC_FILE_CAP), files: out, updatedAt: new Date().toISOString() };
}
function ReqGenModal({ onClose, form, wbs, requirements, setRequirements, ossp, embedded = false, onEmbeddedConfirm, previewAspice, seedItems, onSourceChange, focusIds = null, part = null, onGoPart }) {
  // part(V-모델 안): "STK" = SYS.1 원문·이해관계자 요구 / "SYS" = SYS.2 시스템 요구 / null = 둘 다 (기능·상태는 공유, 표시만 나눔)
  // OSSP별 문구·AI 역할 — 가이드에 reqGen이 없으면 기존(정보공학) 문구 사용
  const RG = getGuideForOSSP(ossp || {})?.reqGen || {};
  const QSTD = RG.qualityStd || { name: "ISO 9126", chars: "기능성/신뢰성/사용성/효율성/유지보수성/이식성" };
  // 원문 충실성 규칙 — 안전·보안 등급이나 수치를 AI가 새로 만들어내지 않도록 (모든 OSSP 공통)
  const FIDELITY = "원문 충실성: 원문에 명시되지 않은 등급·수치(시간·전압·전류·주기·거리), 메시지 ID·주소를 새로 만들지 말 것. 원문에 있는 등급·수치는 표기 그대로 사용. 원문에 근거가 없어 필요한 값은 '원문 확인 필요'로 가정·제약에 기재.";
  const leaves = reqSpecLeaves(wbs);   // WBS 최하위 기능 모듈 (요구사항 배정 후보)
  const leafName = {}; leaves.forEach(l => { leafName[l.wbsNo] = l.name; });
  // 원문·업로드 파일은 requirements.source 에 함께 저장되어 다시 열어도 유지된다 (확정 또는 V-모델 저장 시)
  const [srcText, setSrcText] = useState(() => String(requirements?.source?.text || ""));
  const [srcFiles, setSrcFiles] = useState(() => ((requirements?.source?.files) || []).map(f => ({ name: f.name, text: String(f.text || ""), truncated: !!f.truncated })));   // 업로드된 원문 파일들 [{name, text}]
  const srcPack = () => packReqSource(srcText, srcFiles);
  // V-모델 안(embedded)에서는 원문이 바뀔 때마다 상위에 알려 저장(확정 전이라도 '저장'에 포함)
  useEffect(() => { if (embedded && onSourceChange) onSourceChange(srcPack()); }, [srcText, srcFiles]);
  const [srcDrag, setSrcDrag] = useState(false);  // 드래그앤드롭 하이라이트
  const [items, setItems] = useState(() => { const src = seedItems || requirements?.items; return src ? src.map(x => ({ ...x })) : []; });
  // ASPICE: 이해관계자 요구(SYS.1) 층 — 원문 그대로의 요구 문장. 시스템 요구(SYS.2)는 여기서 도출되고 stkIds로 연결된다.
  const STK_ON = getGuideForOSSP(ossp || {})?.id === "aspice";
  const [stk, setStk] = useState(() => ((requirements?.stk?.items) || []).map(x => ({ ...x })));
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});   // 행별 상세(명세) 펼침
  const [guides, setGuides] = useState([]);          // 작성 가이드 (전역 라이브러리)
  const [guideSel, setGuideSel] = useState({});      // { 가이드id: 적용 여부 } — 활성 가이드는 기본 적용
  useEffect(() => {
    fetchWritingGuides().then(gs => {
      setGuides(gs);
      const s = {}; gs.forEach(g => { if (g.is_active !== false) s[g.id] = true; });
      setGuideSel(s);
    }).catch(() => {});
  }, []);
  const inp = { width:"100%", padding:"5px 7px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:11, fontFamily:"inherit", boxSizing:"border-box" };
  const ta = { ...inp, minHeight:44, resize:"vertical", lineHeight:1.5 };

  async function addSrcFiles(fileArr) {
    if (busy) return;
    setError(null);
    const { files, errors } = await readUploadFiles(fileArr);
    if (files.length) setSrcFiles(prev => mergeUploadFiles(prev, files));
    if (errors.length) setError(errors.join(" / "));
  }
  async function onFile(e) {
    const arr = Array.from(e.target.files || []);
    e.target.value = "";
    await addSrcFiles(arr);
  }

  async function generate() {
    const srcAll = [srcText.trim(), ...srcFiles.map(f => `[파일: ${f.name}]\n${f.text}`)].filter(Boolean).join("\n\n");
    if (srcAll.length < 20) { setError("이해관계자 요구사항 원문을 20자 이상 입력하거나 파일을 업로드해 주세요."); return; }
    setBusy(true); setError(null);
    const guideBlock = buildGuideBlock(guides.filter(g => guideSel[g.id]));   // 적용 선택된 작성 가이드 → 프롬프트 주입
    try {
      // 1차(RD1200): 원문 → 기능·비기능·인터페이스 요구사항 도출 — 원문이 길면 분할 호출 (Vercel 타임아웃 대응)
      const chunks = [];
      for (let i = 0; i < srcAll.length; i += 6000) chunks.push(srcAll.slice(i, i + 6000));
      let raw = [];
      const stkRaw = [];
      for (let i = 0; i < chunks.length; i++) {
        setProg({ percent: 5 + (i / chunks.length) * 35, label: `${STK_ON ? "이해관계자 요구 발췌·시스템 " : ""}요구사항 도출 중… (${i + 1}/${chunks.length})` });
        const r = await callClaudeJson(`${RG.roleDerive || "당신은 정보공학 방법론 요구정의 단계(RD1200 요구사항 정의)에 정통한 SI 품질보증 전문가입니다. 아래 이해관계자 요구사항 원문에서 기능·비기능·인터페이스 요구사항을 도출하세요."}
프로젝트: ${form?.name || ""} (${form?.type || ""}) / 고객사: ${form?.client || ""}
규칙: 요구사항 단위로 중복 없이 분할. 비기능은 ${QSTD.name} 품질특성(${QSTD.chars}) 관점으로 식별. 최대 30건.
${FIDELITY}
${STK_ON ? `먼저 원문에서 이해관계자 요구 문장을 고쳐 쓰지 말고 그대로 발췌해 stk 목록으로 만드세요(요구 주체: OEM|법규·표준|내부|기타, 유형: 기능|비기능|규제|인터페이스, 문장당 100자 이내). 그 다음 각 stk에서 시스템 요구(items)를 도출하고, 각 item의 stk에 근거가 된 stk의 k 값을 배열로 적으세요(한 stk가 여러 item으로 나뉘거나 여러 stk가 한 item이 될 수 있음).
JSON만 출력: {"stk":[{"k":"s1","text":"원문 발췌","source":"조항·위치","stakeholder":"OEM","type":"기능"}],"items":[{"type":"기능|비기능|인터페이스","name":"요구사항명(25자 이내)","source":"원문 내 근거(15자 이내)","priority":"상|중|하","summary":"개요 1문장(50자 이내)","stk":["s1"]}]}` :
`JSON만 출력: {"items":[{"type":"기능|비기능|인터페이스","name":"요구사항명(25자 이내)","source":"원문 내 근거(15자 이내)","priority":"상|중|하","summary":"개요 1문장(50자 이내)"}]}`}
${guideBlock}--- 원문 ---
${chunks[i]}`, 6000);
        const its = Array.isArray(r?.items) ? r.items : [];
        if (STK_ON) {
          // 청크별 임시 키(s1…)를 전역 키(i:s1)로 바꿔 충돌 방지
          (Array.isArray(r?.stk) ? r.stk : []).forEach(k => { if (k && String(k.text || "").trim()) stkRaw.push({ _k: `${i}:${k.k}`, text: String(k.text).slice(0, 300), source: String(k.source || ""), stakeholder: ["OEM", "법규·표준", "내부", "기타"].includes(k.stakeholder) ? k.stakeholder : "OEM", type: ["기능", "비기능", "규제", "인터페이스"].includes(k.type) ? k.type : "기능", status: "검토 중" }); });
          its.forEach(it => { it._stk = (Array.isArray(it.stk) ? it.stk : []).map(k => `${i}:${k}`); });
        }
        raw = raw.concat(its);
      }
      if (!raw.length) throw new Error("도출된 요구사항이 없습니다. 원문을 확인해 주세요.");
      const freshRaw = raw.map(it => ({
        type: ["기능", "비기능", "인터페이스"].includes(it.type) ? it.type : "기능",
        name: String(it.name || "").slice(0, 60), source: String(it.source || ""),
        priority: ["상", "중", "하"].includes(it.priority) ? it.priority : "중",
        summary: String(it.summary || ""), detail: "", acceptance: "", quality: "", assumptions: "", wbsNo: "공통",
        actors: "", basicFlow: "", subFlow: "", exceptionFlow: "", precondition: "", postcondition: "",
        _stk: it._stk || [],
      }));
      // 재생성 시 ID 무결성: 기존 요구와 매칭되면 기존 ID 유지, 신규만 ID 레지스트리 기준으로 새 번호 (폐기·기존 번호 재사용 금지)
      const idMatch = matchPrevReqIds(freshRaw, items);
      let list = assignReqIds(idMatch.list, reqIdFloor(requirements, items.map(x => x.id)));
      // 이해관계자 요구(STK): 기존 STK와 문장 매칭 → 기존 ID 유지, 신규만 새 번호. 시스템 요구의 stkIds를 전역 키 → STK ID로 변환
      if (STK_ON) {
        const stkMatch = matchPrevReqIds(stkRaw.map(k => ({ ...k, name: k.text })), stk.map(k => ({ ...k, name: k.text })));
        const stkList = assignStkIds(stkMatch.list.map(k => { const { name, ...rest } = k; return rest; }), reqIdFloor(requirements, [...stk.map(x => x.id), ...(requirements?.stk?.items || []).map(x => x.id)]));
        const keyToId = Object.fromEntries(stkList.map(k => [k._k, k.id]));
        setStk(stkList.map(k => { const { _k, ...rest } = k; return rest; }));
        list = list.map(it => { const { _stk, ...rest } = it; return { ...rest, stkIds: [...new Set((_stk || []).map(k => keyToId[k]).filter(Boolean))] }; });
      } else list = list.map(it => { const { _stk, ...rest } = it; return rest; });
      const idNote = items.some(x => x.id) ? ` · 기존 ID 유지 ${idMatch.kept}건 · 신규 ${list.length - idMatch.kept}건${idMatch.missing.length ? ` · 이번 결과에 없는 기존 요구 ${idMatch.missing.length}건(${idMatch.missing.slice(0, 8).join(", ")}${idMatch.missing.length > 8 ? " …" : ""}) — 확정 시 폐기` : ""}` : "";
      // 2차(RD1300): 4건씩 상세 명세 — 상세설명·인수기준·품질특성·가정/제약 + 기능은 유스케이스 항목(관련 액터~사후 조건)
      const B = 4;
      for (let i = 0; i < list.length; i += B) {
        const grp = list.slice(i, i + B);
        setProg({ percent: 40 + (i / list.length) * 40, label: `요구사항 명세 작성 중… (${Math.min(i + B, list.length)}/${list.length})` });
        const r = await callClaudeJson(`${RG.roleSpec || "당신은 정보공학 방법론 요구정의 단계(RD1300 요구사항 명세)에 정통한 SI 품질보증 전문가입니다. 아래 요구사항 각각을 구현 가능성·테스트 가능성을 고려해 상세 명세하세요. 비기능은 측정기준을 포함하세요."}
기능 요구사항은 유스케이스 관점으로 다음을 추가 작성하세요: actors(관련 액터, 쉼표 구분), basicFlow(기본 흐름 3~6단계, 단계는 ';'로 구분), subFlow(서브 흐름, 없으면 빈 문자열), exceptionFlow(예외 흐름 1~3개, ';' 구분), precondition(사전 조건 1문장), postcondition(사후 조건 1문장). 비기능·인터페이스 요구사항은 이 6개 필드를 모두 빈 문자열로 하세요.
규칙: id는 입력에 주어진 값을 그대로 반환(새 ID 부여·형식 변경 금지). 각 문자열 값은 줄바꿈 없이 한 문단으로 작성.
${FIDELITY}
JSON만 출력: {"items":[{"id":"...","detail":"상세 설명 2~3문장","acceptance":"측정 가능한 인수 기준 1~2문장","quality":"비기능이면 ${QSTD.name} 품질특성명, 아니면 빈 문자열","assumptions":"가정·제약(없으면 빈 문자열)","actors":"...","basicFlow":"...","subFlow":"...","exceptionFlow":"...","precondition":"...","postcondition":"..."}]}
${guideBlock}--- 요구사항 ---
${JSON.stringify(grp.map(g => ({ id: g.id, type: g.type, name: g.name, summary: g.summary })))}`, 6000);
        const map = {};
        (Array.isArray(r?.items) ? r.items : []).forEach(d => { if (d?.id) map[d.id] = d; });
        list = list.map(it => map[it.id] ? { ...it, detail: String(map[it.id].detail || ""), acceptance: String(map[it.id].acceptance || ""), quality: String(map[it.id].quality || ""), assumptions: String(map[it.id].assumptions || ""),
          actors: String(map[it.id].actors || ""), basicFlow: String(map[it.id].basicFlow || ""), subFlow: String(map[it.id].subFlow || ""), exceptionFlow: String(map[it.id].exceptionFlow || ""), precondition: String(map[it.id].precondition || ""), postcondition: String(map[it.id].postcondition || "") } : it);
      }
      // 3차(배정): 규칙 기반 우선(AI 미사용) — 비기능·인터페이스는 "공통", 기능은 모듈명 n-gram 매칭.
      //            고유 단서가 부족한 잔여분만 AI로 배정하고, AI마저 실패하면 "공통" 폴백(사용자 검토·수정 전제).
      let ruleCnt = 0, aiCnt = 0;
      if (leaves.length) {
        const pendIds = new Set();
        list = list.map(it => {
          const w = ruleAssignModule(it, leaves);
          if (w === null) { pendIds.add(it.id); return it; }
          ruleCnt += 1;
          return { ...it, wbsNo: w };
        });
        const pending = list.filter(it => pendIds.has(it.id));
        if (pending.length) {
          try {
            const A = 10;
            for (let i = 0; i < pending.length; i += A) {
              const grp = pending.slice(i, i + A);
              setProg({ percent: 80 + (i / pending.length) * 18, label: `기능 모듈 배정 중… 규칙 ${ruleCnt}건 완료 · AI 보완 (${Math.min(i + A, pending.length)}/${pending.length})` });
              const r = await callClaudeJson(`당신은 SI 요구사항 관리 전문가입니다. 각 요구사항을 아래 WBS 최하위 기능 모듈 중 가장 적합한 곳에 배정하세요. 특정 모듈에 귀속되지 않는 전사 공통·보안·성능 등 비기능 요구사항은 "공통"으로 배정하세요.
모듈 목록: ${JSON.stringify(leaves)}
JSON만 출력: {"items":[{"id":"...","wbsNo":"모듈의 wbsNo 또는 공통"}]}
--- 요구사항 ---
${JSON.stringify(grp.map(g => ({ id: g.id, type: g.type, name: g.name, summary: g.summary })))}`, 4000);
              const amap = {};
              (Array.isArray(r?.items) ? r.items : []).forEach(d => { if (d?.id) amap[d.id] = String(d.wbsNo || "공통"); });
              list = list.map(it => {
                if (!pendIds.has(it.id)) return it;
                const w = amap[it.id];
                if (w === undefined) return it;
                aiCnt += 1;
                return { ...it, wbsNo: leafName[w] !== undefined ? w : "공통" };
              });
            }
          } catch (_) { /* AI 배정 실패 무시 — 규칙 결과 유지, 잔여는 아래에서 공통 폴백 */ }
          // AI 미응답·실패 잔여분: "공통" 폴백 (검토 화면에서 수정 가능)
          list = list.map(it => (pendIds.has(it.id) && !it.wbsNo) ? { ...it, wbsNo: "공통" } : it);
        }
      }
      setItems(list);
      setProg({ percent: 100, label: `요구사항 ${list.length}건 도출·명세${leaves.length ? `·모듈 배정(규칙 ${ruleCnt}건${aiCnt ? ` · AI ${aiCnt}건` : ""})` : ""} 완료${idNote} — 아래에서 검토·수정 후 확정하세요.` });
    } catch (e) { setError("AI 생성 실패: " + e.message); setProg(null); }
    setBusy(false);
  }

  const upd = (i, k, v) => setItems(list => list.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const del = i => setItems(list => list.filter((_, j) => j !== i));
  const add = () => setItems(list => assignReqIds([...list, { id: "", type: "기능", name: "", source: "", priority: "중", summary: "", detail: "", acceptance: "", quality: "", assumptions: "", wbsNo: "공통", actors: "", basicFlow: "", subFlow: "", exceptionFlow: "", precondition: "", postcondition: "" }], reqIdFloor(requirements)));
  // 이해관계자 요구(STK) → 시스템 요구 바로 처리: ① 새 시스템 요구로 도출(원문으로 초안 채움) ② 기존 시스템 요구에 근거로 연결
  const [stkMsg, setStkMsg] = useState(null);
  function deriveFromStk(k) {
    const text = String(k.text || "").trim();
    const name = text.replace(/[.。]\s*$/, "").slice(0, 40);
    let newId = "";
    setItems(list => {
      const next = assignReqIds([...list, { id: "", type: ["기능", "비기능", "인터페이스"].includes(k.type) ? k.type : (k.type === "규제" ? "비기능" : "기능"),
        name, source: k.source || k.id, priority: "중", summary: text, detail: text, acceptance: "", quality: "", assumptions: "", wbsNo: "공통",
        actors: "", basicFlow: "", subFlow: "", exceptionFlow: "", precondition: "", postcondition: "", stkIds: [k.id] }], reqIdFloor(requirements));
      newId = next[next.length - 1]?.id || "";
      return next;
    });
    setTimeout(() => setStkMsg(`${k.id} → 새 시스템 요구 ${newId || ""}를 원문으로 초안 작성했습니다. 아래 시스템 요구 목록 맨 끝에서 [상세]를 열어 요구사항명·검증 기준을 다듬은 뒤 '요구사항 확정'을 누르세요.`), 0);
  }
  function linkStk(k, reqId) {
    if (!reqId) return;
    setItems(list => list.map(it => it.id === reqId ? { ...it, stkIds: [...new Set([...(it.stkIds || []), k.id])] } : it));
    setStkMsg(`${k.id}를 ${reqId}의 근거로 연결했습니다. ${reqId}의 본문·검증 기준에 이 조건(${String(k.text || "").slice(0, 30)}…)이 실제로 들어 있는지 [상세]에서 확인한 뒤 '요구사항 확정'을 누르세요.`);
  }
  function confirmSave() {
    const valid = items.filter(it => String(it.name || "").trim());
    if (!valid.length) { setError("확정할 요구사항이 없습니다. 요구사항명을 입력해 주세요."); return; }
    const normed = assignReqIds(valid, reqIdFloor(requirements)).map(it => ({ ...it, wbsNo: it.wbsNo && (it.wbsNo === "공통" || leafName[it.wbsNo] !== undefined) ? it.wbsNo : "공통" }));
    // ASPICE V-모델 추적 모델 보존 — 기존 연결의 기준선을 '변경 전' 내용으로 먼저 등록한 뒤 새 내용으로 동기화한다.
    // 이렇게 해야 내용이 바뀐 요구의 하위 연결(할당·파생·검증)이 '변경 검토 필요'로 표시된다 (자동 수정은 하지 않음).
    const stkValid = STK_ON ? assignStkIds(stk.filter(k => String(k.text || "").trim()).map(k => ({ ...k })), reqIdFloor(requirements)) : [];
    const stkIdSet = new Set(stkValid.map(k => k.id));
    const normed2 = STK_ON ? normed.map(it => ({ ...it, stkIds: (it.stkIds || []).filter(id => stkIdSet.has(id)) })) : normed;
    const meta = { items: normed2, sourceName: srcFiles.length ? srcFiles.map(f => f.name).join(", ") : (requirements?.sourceName || "직접 입력"), specLeaves: leaves, qualityStd: QSTD.name, updatedAt: new Date().toISOString(),
      idRegistry: nextIdRegistry({ ...(requirements || {}), items: [...((requirements || {}).items || []), ...((requirements?.stk?.items) || [])] }, [...normed2, ...stkValid]),
      source: srcPack(),
      ...(STK_ON ? { stk: { items: stkValid, updatedAt: new Date().toISOString() } } : {}) };
    if (embedded) {
      // V-모델 안: 기준선 등록·동기화·저장은 V-모델이 처리 (편집 중인 추적 모델 기준)
      setItems(normed2.map(x => ({ ...x })));
      if (STK_ON) setStk(stkValid.map(x => ({ ...x })));
      setError(null);
      onEmbeddedConfirm && onEmbeddedConfirm(meta);
      return;
    }
    const aeBase = requirements?.aspice ? AE.baselineLinks(requirements.aspice) : null;
    setRequirements({ ...meta,
      ...(aeBase ? { aspice: { ...aeBase, reqs: { ...aeBase.reqs, SYS: AE.syncSysReqs(normed, aeBase.reqs.SYS) } } } : {}) });
    onClose();
  }

  const bodyEl = (
        <div style={embedded ? {} : { padding:"14px 18px", overflowY:"auto" }}>
          {part !== "SYS" && <WritingGuidePanel guides={guides} setGuides={setGuides} sel={guideSel} setSel={setGuideSel} disabled={busy} />}
          {part !== "SYS" && (<div onDragOver={e=>{ e.preventDefault(); if (!busy) setSrcDrag(true); }} onDragLeave={()=>setSrcDrag(false)}
            onDrop={e=>{ e.preventDefault(); setSrcDrag(false); addSrcFiles(Array.from(e.dataTransfer.files || [])); }}
            style={{ border:`1px solid ${srcDrag ? T.accent : T.accentDim}`, borderLeft:`3px solid ${T.accent}`, borderRadius:9, background: srcDrag ? T.accent+"22" : T.accent+"08", padding:"10px 12px", marginBottom:12 }}>
            <div style={{ fontSize:11.5, fontWeight:600, marginBottom:6, color:T.accent }}>📝 이해관계자 요구사항 원문 <span style={{ color:T.muted, fontWeight:400, fontSize:10.5 }}>({RG.srcHint || "RFP 발췌·인터뷰 기록·회의록 등 붙여넣기 또는 파일 업로드"})</span></div>
            <textarea value={srcText} onChange={e=>setSrcText(e.target.value)} placeholder={RG.placeholder || "예) 사용자는 네트워크 장비 목록을 조건별로 검색할 수 있어야 한다. 시스템 응답시간은 3초 이내여야 한다. …"} disabled={busy}
              style={{ ...ta, minHeight:110, marginBottom:8 }} />
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", border:`1px dashed ${T.accentDim}`, borderRadius:8, cursor: busy?"default":"pointer", fontSize:11, color:T.muted, background:T.bg }}>
                📎 파일 업로드 (txt·docx·xlsx · 여러 개 가능 · 드래그앤드롭 지원)
                <input type="file" multiple accept=".txt,.docx,.xlsx" onChange={onFile} disabled={busy} style={{ display:"none" }} />
              </label>
              {srcFiles.map(f => (
                <span key={f.name} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, color:T.accent, border:`1px solid ${T.accentDim}`, borderRadius:6, padding:"2px 8px", background:T.bg }}>
                  📄 {f.name}
                  {f.truncated && <span title="용량 상한으로 뒷부분이 잘려 저장됩니다" style={{ fontSize:9.5, color:T.amber }}>잘림</span>}
                  <button onClick={()=>setSrcFiles(fs=>fs.filter(x=>x.name!==f.name))} disabled={busy} title="파일 제거" style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:10.5, padding:0, lineHeight:1 }}>✕</button>
                </span>
              ))}
              {srcFiles.length > 0 && (
                <span style={{ fontSize:10, color:T.green }}>✓ 첨부됨 · AI 생성 시 함께 분석되며, {embedded ? "V-모델 저장" : "확정 저장"} 시 원문과 함께 프로젝트에 보관됩니다</span>
              )}
              <div style={{ flex:1 }} />
              <Btn onClick={generate} disabled={busy} style={{ fontSize:12, padding:"7px 14px" }}>{busy ? "⏳ 생성 중…" : items.length ? "⚡ AI 재생성" : "⚡ AI 도출·명세"}</Btn>
            </div>
          </div>)}
          {(busy || prog) && <GenProgressBar progress={prog || { percent:3, label:"요구사항 분석 준비 중…" }} subText="원문 분량·요구사항 건수에 따라 수십 초가 걸릴 수 있습니다. 화면을 유지해 주세요." />}
          {error && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9, marginBottom:10 }}>{error}</div>}
          {part !== "SYS" && STK_ON && (items.length > 0 || stk.length > 0) && (() => {
            const sysCount = {}; items.forEach(it => (it.stkIds || []).forEach(id => { sysCount[id] = (sysCount[id] || 0) + 1; }));
            const updS = (i, k, v) => setStk(l => l.map((x, j) => j === i ? { ...x, [k]: v } : x));
            const delS = i => { const id = stk[i]?.id; setStk(l => l.filter((_, j) => j !== i)); if (id) setItems(l => l.map(it => ({ ...it, stkIds: (it.stkIds || []).filter(x => x !== id) }))); };
            const addS = () => setStk(l => assignStkIds([...l, { id: "", text: "", source: "", stakeholder: "OEM", type: "기능", status: "검토 중" }], reqIdFloor(requirements, l.map(x => x.id))));
            return (
            <div style={{ marginTop:8 }}>
              <WhyBox title="이해관계자 요구(SYS.1)와 시스템 요구(SYS.2)를 왜 나누나요?">
                이해관계자 요구는 <b>고객(OEM)·법규가 말한 그대로의 문장</b>이고, 시스템 요구는 그것을 <b>우리 시스템이 검증 가능하게 다시 쓴 문장</b>입니다. 둘을 같은 목록으로 두면 "고객 요구를 분석했다"는 근거가 남지 않고, 고객 사양서가 개정됐을 때 어느 시스템 요구를 다시 봐야 하는지도 알 수 없습니다.
                그래서 SPIDer는 원문 발췌(STK)를 따로 두고, 각 시스템 요구에 <b>근거 STK</b>를 연결합니다. STK 문장이 바뀌면 연결된 시스템 요구가 "변경 검토 필요"로 표시되고, 추적 매트릭스에 STK → SYS가 함께 출력됩니다. 합의 상태(검토 중·합의·보류)는 고객과의 합의 증적입니다.
              </WhyBox>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>이해관계자 요구 (SYS.1) <span style={{ color:T.accent }}>{stk.length}건</span> <span style={{ fontSize:10.5, color:T.muted, fontWeight:400 }}>— 원문 그대로. 합의 {stk.filter(k => k.status === "합의").length} · 검토 중 {stk.filter(k => !["합의", "보류", "해당 없음"].includes(k.status)).length} · 보류 {stk.filter(k => k.status === "보류").length}{stk.some(k => k.status === "해당 없음") ? ` · 해당 없음 ${stk.filter(k => k.status === "해당 없음").length}` : ""} · 시스템 요구 미도출 {stk.filter(k => !sysCount[k.id] && !AE.stkClosed(k)).length}</span></div>
                <button onClick={addS} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:11, padding:"3px 10px", fontFamily:"inherit" }}>+ 행 추가</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:"72px 1fr 90px 92px 90px 84px 150px 24px", gap:6, fontSize:10, color:T.muted, padding:"0 4px" }}>
                  <span>ID</span><span>요구 문장 (원문 발췌)</span><span>출처</span><span>주체</span><span>유형</span><span>합의</span><span>SYS</span><span></span>
                </div>
                {stkMsg && <div style={{ fontSize:11, color:T.green, background:T.green + "12", border:`1px solid ${T.green}44`, borderRadius:7, padding:"6px 10px", display:"flex", gap:8, alignItems:"center" }}><span style={{ flex:1 }}>✓ {stkMsg}</span><button onClick={() => setStkMsg(null)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer" }}>✕</button></div>}
                {stk.some(k => !sysCount[k.id] && k.status !== "해당 없음") && <div style={{ fontSize:10.5, color:T.muted, padding:"0 4px" }}>SYS가 0건인 요구는 <b style={{ color:T.accent }}>＋ 도출</b>(새 시스템 요구 초안) 또는 <b>연결…</b>(기존 시스템 요구에 근거 추가)로 처리하거나, 우리 범위가 아니면 합의를 <b>해당 없음</b>으로 바꾸고 사유를 적으세요. 처리 후 '요구사항 확정'을 눌러야 반영됩니다.</div>}
                {stk.map((k, i) => (!focusIds || !stk.some(x => focusIds.has(x.id)) || focusIds.has(k.id)) && (
                  <div key={k.id || i} style={{ display:"grid", gridTemplateColumns:"72px 1fr 90px 92px 90px 84px 150px 24px", gap:6, alignItems:"center", background:T.bg, border:`1px solid ${sysCount[k.id] || AE.stkClosed(k) ? T.border : T.amber + "66"}`, borderRadius:8, padding:"5px 8px", opacity: AE.stkClosed(k) ? 0.8 : 1 }}>
                    <span style={{ fontFamily:"monospace", fontSize:10, color:T.accent }}>{k.id}</span>
                    <input value={k.text} onChange={e=>updS(i,"text",e.target.value)} placeholder="원문 그대로" style={inp} />
                    <input value={k.source || ""} onChange={e=>updS(i,"source",e.target.value)} placeholder="조항" style={inp} />
                    <select value={k.stakeholder || "OEM"} onChange={e=>updS(i,"stakeholder",e.target.value)} style={inp}>{["OEM","법규·표준","내부","기타"].map(x=><option key={x}>{x}</option>)}</select>
                    <select value={k.type || "기능"} onChange={e=>updS(i,"type",e.target.value)} style={inp}>{["기능","비기능","규제","인터페이스"].map(x=><option key={x}>{x}</option>)}</select>
                    <select value={k.status || "검토 중"} onChange={e=>updS(i,"status",e.target.value)} title="해당 없음: 시스템 요구로 도출하지 않기로 결정 — 사유 필수" style={{ ...inp, color: k.status === "합의" ? T.green : k.status === "보류" ? T.amber : k.status === "해당 없음" ? T.muted : T.text }}>{["검토 중","합의","보류","해당 없음"].map(x=><option key={x}>{x}</option>)}</select>
                    {sysCount[k.id] || AE.stkClosed(k) || k.status === "해당 없음"
                      ? <span title={sysCount[k.id] ? `도출된 시스템 요구: ${items.filter(it => (it.stkIds || []).includes(k.id)).map(it => it.id).join(", ")}` : "해당 없음 — 도출 대상 아님"} style={{ fontSize:11, color: sysCount[k.id] ? T.green : T.muted, textAlign:"center" }}>{sysCount[k.id] ? `${sysCount[k.id]}건` : "N/A"}</span>
                      : <span style={{ display:"flex", gap:3, alignItems:"center" }}>
                          <button onClick={() => deriveFromStk(k)} title="이 원문으로 새 시스템 요구 초안을 만들고 근거로 연결합니다" style={{ background:T.accent, border:"none", borderRadius:5, color:"#fff", cursor:"pointer", fontSize:10, padding:"4px 6px", fontFamily:"inherit", whiteSpace:"nowrap" }}>＋ 도출</button>
                          <select value="" onChange={e => linkStk(k, e.target.value)} title="이미 이 내용을 다루는 시스템 요구가 있으면 근거로 연결합니다" style={{ ...inp, fontSize:10, padding:"3px 2px", minWidth:0 }}>
                            <option value="">연결…</option>
                            {items.filter(it => it.id).map(it => <option key={it.id} value={it.id}>{it.id} {String(it.name || "").slice(0, 18)}</option>)}
                          </select>
                        </span>}
                    <button onClick={()=>delS(i)} title="삭제" style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:12 }}>✕</button>
                    {k.status === "해당 없음" && (
                      <div style={{ gridColumn:"2 / -1", display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:10, color: String(k.naReason || "").trim() ? T.muted : T.red, whiteSpace:"nowrap" }}>해당 없음 사유{String(k.naReason || "").trim() ? "" : " (필수)"}</span>
                        <input value={k.naReason || ""} onChange={e=>updS(i,"naReason",e.target.value)} placeholder="예: VCU 담당 기능 — 인터페이스 합의서 IF-03에 따라 BMS 범위 제외 (고객 합의 2026-10-xx)" style={{ ...inp, borderColor: String(k.naReason || "").trim() ? undefined : T.red + "88" }} />
                      </div>)}
                  </div>
                ))}
                {!stk.length && <div style={{ fontSize:11, color:T.muted, padding:6 }}>AI 도출을 실행하면 원문에서 이해관계자 요구가 먼저 발췌됩니다. 직접 입력하려면 '+ 행 추가'.</div>}
              </div>
            </div>); })()}
          {part === "STK" && items.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, color:T.muted, padding:"7px 10px", border:`1px dashed ${T.border}`, borderRadius:8, marginTop:8 }}>
              <span style={{ flex:1 }}>도출된 시스템 요구 {items.length}건은 SYS.2 탭에서 검토·편집합니다.</span>
              {onGoPart && <button onClick={() => onGoPart("SYS")} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:10.5, padding:"3px 9px" }}>SYS.2 시스템 요구 →</button>}
            </div>)}
          {part === "SYS" && !items.length && (
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, color:T.muted, padding:"10px 12px", border:`1px dashed ${T.border}`, borderRadius:8 }}>
              <span style={{ flex:1 }}>아직 시스템 요구가 없습니다. SYS.1에서 고객 사양서를 올리고 [AI 도출·명세]를 누르면 이해관계자 요구와 시스템 요구가 함께 만들어집니다.</span>
              {onGoPart && <button onClick={() => onGoPart("STK")} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:10.5, padding:"3px 9px" }}>← SYS.1 고객 요구</button>}
            </div>)}
          {part !== "STK" && items.length > 0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>{STK_ON ? "시스템 요구 (SYS.2)" : "도출된 요구사항"} <span style={{ color:T.accent }}>{items.length}건</span> <span style={{ fontSize:10.5, color:T.muted, fontWeight:400 }}>— 수정·추가·삭제 후 확정하세요. '상세'에서 명세 내용을 편집합니다.</span></div>
                <button onClick={add} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:11, padding:"3px 10px", fontFamily:"inherit" }}>＋ 행 추가</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ display:"grid", gridTemplateColumns:"60px 78px 1fr 92px 52px 150px 1fr 44px 24px", gap:6, fontSize:10, color:T.muted, padding:"0 4px" }}>
                  <span>ID</span><span>유형</span><span>요구사항명</span><span>출처</span><span>우선순위</span><span>기능 모듈</span><span>개요</span><span></span><span></span>
                </div>
                {items.map((it, i) => (!focusIds || !items.some(x => focusIds.has(x.id)) || focusIds.has(it.id)) && (
                  <div key={i} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 8px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"60px 78px 1fr 92px 52px 150px 1fr 44px 24px", gap:6, alignItems:"center" }}>
                      <span style={{ fontFamily:"monospace", fontSize:10, color:T.accent }}>{it.id}</span>
                      <select value={it.type} onChange={e=>upd(i,"type",e.target.value)} style={inp}>
                        {["기능","비기능","인터페이스"].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={it.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="요구사항명" style={inp} />
                      <input value={it.source} onChange={e=>upd(i,"source",e.target.value)} placeholder="출처" style={inp} />
                      <select value={it.priority} onChange={e=>upd(i,"priority",e.target.value)} style={inp}>
                        {["상","중","하"].map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                      <select value={it.wbsNo || "공통"} onChange={e=>upd(i,"wbsNo",e.target.value)} title="이 요구사항이 배정될 WBS 최하위 기능 모듈 — 공통은 모든 모듈 명세서에 포함" style={inp}>
                        <option value="공통">공통 (전 모듈)</option>
                        {it.wbsNo && it.wbsNo !== "공통" && !leaves.some(l => l.wbsNo === it.wbsNo) && <option value={it.wbsNo}>{it.wbsNo} (모듈 아님 — 다시 배정하세요)</option>}
                        {leaves.map(l=><option key={l.wbsNo} value={l.wbsNo}>{l.wbsNo} {l.name}</option>)}
                      </select>
                      <input value={it.summary} onChange={e=>upd(i,"summary",e.target.value)} placeholder="개요 1문장" style={inp} />
                      <button onClick={()=>setOpen(o=>({ ...o, [i]:!o[i] }))} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.muted, cursor:"pointer", fontSize:10, padding:"4px 0", fontFamily:"inherit" }}>{open[i]?"접기":"상세"}</button>
                      <button onClick={()=>del(i)} title="삭제" style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:12 }}>✕</button>
                    </div>
                    {open[i] && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:6 }}>
                        <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>상세 설명 (명세서)</div><textarea value={it.detail} onChange={e=>upd(i,"detail",e.target.value)} style={ta} /></div>
                        <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>인수 기준</div><textarea value={it.acceptance} onChange={e=>upd(i,"acceptance",e.target.value)} style={ta} /></div>
                        <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>품질특성 (비기능 · {QSTD.name})</div><input value={it.quality} onChange={e=>upd(i,"quality",e.target.value)} placeholder="예: 효율성" style={inp} /></div>
                        <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>가정·제약</div><input value={it.assumptions} onChange={e=>upd(i,"assumptions",e.target.value)} style={inp} /></div>
                        {STK_ON && <div style={{ gridColumn:"1 / -1" }}><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>근거 이해관계자 요구 (STK ID, 쉼표 구분) {(it.stkIds || []).length ? "" : <span style={{ color:T.amber }}>— 미지정</span>}</div>
                          <input value={(it.stkIds || []).join(", ")} onChange={e=>upd(i,"stkIds",e.target.value.split(/[,\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean))} placeholder="예: STK-0001, STK-0003" style={inp} /></div>}
                        {it.type === "기능" && (<>
                          <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>관련 액터</div><input value={it.actors || ""} onChange={e=>upd(i,"actors",e.target.value)} placeholder="예: 영업담당자, 관리자" style={inp} /></div>
                          <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>사전 조건</div><input value={it.precondition || ""} onChange={e=>upd(i,"precondition",e.target.value)} style={inp} /></div>
                          <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>기본 흐름 <span style={{ fontWeight:400 }}>(단계는 ';'로 구분)</span></div><textarea value={it.basicFlow || ""} onChange={e=>upd(i,"basicFlow",e.target.value)} style={ta} /></div>
                          <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>서브 흐름 <span style={{ fontWeight:400 }}>(';' 구분 · 없으면 비움)</span></div><textarea value={it.subFlow || ""} onChange={e=>upd(i,"subFlow",e.target.value)} style={ta} /></div>
                          <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>예외 흐름 <span style={{ fontWeight:400 }}>(';' 구분)</span></div><textarea value={it.exceptionFlow || ""} onChange={e=>upd(i,"exceptionFlow",e.target.value)} style={ta} /></div>
                          <div><div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>사후 조건</div><input value={it.postcondition || ""} onChange={e=>upd(i,"postcondition",e.target.value)} style={inp} /></div>
                        </>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
  );
  const aeForPreview = embedded ? previewAspice : requirements?.aspice;
  const footerEl = (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding: embedded ? "10px 0" : "12px 18px", borderTop:`1px solid ${T.border}`, flexShrink:0, ...(embedded ? { position:"sticky", bottom:-16, background:T.surface, zIndex:3 } : {}) }}>
          {(() => { const imp = aeForPreview ? AE.previewImpact(aeForPreview, assignReqIds(items.filter(it => String(it.name || "").trim()), reqIdFloor(requirements)), STK_ON ? stk.filter(k => k.id && String(k.text || "").trim()) : undefined) : null; return (
          <span style={{ fontSize:10.5, color:T.muted }}>{requirements?.items?.length ? `현재 확정본: ${requirements.items.length}건 (${(requirements.updatedAt||"").slice(0,10)})` : "확정된 요구사항 없음"}
            {imp && (imp.suspect || imp.orphan) ? <span style={{ color:T.amber, marginLeft:8 }}>⚠ 확정하면 V-모델 추적 연결 {imp.suspect ? `${imp.suspect}건이 '변경 검토 필요'(변경 요구 ${imp.changedReqs}건)` : ""}{imp.suspect && imp.orphan ? ", " : ""}{imp.orphan ? `${imp.orphan}건이 고아 연결(삭제 요구 ${imp.removedReqs}건)` : ""}로 표시됩니다</span> : null}
          </span>); })()}
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            {!embedded && <Btn variant="outline" onClick={onClose} style={{ fontSize:12, padding:"7px 14px" }}>취소</Btn>}
            <Btn onClick={confirmSave} disabled={busy || !items.length} style={{ fontSize:12, padding:"7px 14px" }}>{embedded ? `✓ 요구사항 확정 (${items.length}건)` : `✓ 확정 저장 (${items.length}건)`}</Btn>
          </div>
        </div>
  );
  if (embedded) return (
    <div>
      <div style={{ fontSize:11, color:T.muted, marginBottom:10 }}>이해관계자 요구 원문(OEM 사양서·RFQ·SOR·법규) → 요구 도출(SYS.1)·시스템 요구 명세(SYS.2) → <b>확정</b>하면 ③ 시스템 이후 단계와 추적 모델에 반영됩니다. 이미 연결된 요구의 내용이 바뀌면 하위 연결이 '변경 검토 필요'로 표시됩니다.</div>
      {bodyEl}
      {footerEl}
    </div>
  );
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, width:"100%", maxWidth:980, maxHeight:"90vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>🤖 요구사항 정의서·명세서 AI 작성</div>
            <div style={{ fontSize:10.5, color:T.muted, marginTop:2 }}>{RG.desc || "이해관계자 요구사항 원문 → 도출(RD1200)·명세(RD1300) → 검토·확정 시 OSSP 템플릿 기반 정의서(xlsx)·명세서(docx)와 요구사항 추적 매트릭스에 자동 반영"}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
        {bodyEl}
        {footerEl}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ASPICE V-모델 엔지니어링 모달 — SYS.2 확정 요구 → SYS.3 → SWE.1/2 · HWE.1/2 → 검증 수단 → 추적·충족도
// 저장 위치: requirements.aspice (tailoring JSON 내부 — DB 스키마 변경 없음)
// ═══════════════════════════════════════════════════════════════════════════
// V-모델 편집 상태 서명 — 저장 안 된 변경 감지용 (저장 시각 updatedAt은 비교에서 제외)
function aeSig(m, items) {
  try { const { updatedAt, ...rest } = m || {}; return JSON.stringify([rest, items || []]); } catch { return String(Math.random()); }
}
// V-모델 창의 기본 탭 = "다음에 할 단계" (작업 순서 ①→⑥, 모두 갖춰지면 ⑦ 점검)
// saved: 저장본(requirements.aspice)이 있는지 — 있으면 ① 설정은 이미 거친 것으로 보고 ②부터 판정
function aeNextTab(m, saved) {
  if (!m) return "setup";
  if (!m.reqs.SYS.length) return saved || m.reqs.STK.length ? "req" : "setup";
  if (!m.comps.SYS.length) return "SYS";
  if (m.scope.SW && (!m.reqs.SW.length || !m.comps.SW.length)) return "SW";
  if (m.scope.HW && (!m.reqs.HW.length || !m.comps.HW.length)) return "HW";
  if (!m.tests.length) return "verif";
  return "trace";
}
// 탭: [id, 쉬운 이름, ASPICE 코드(작게 병기)]
const AE_TABS = [["setup", "준비", "버전·범위·입력자료"], ["req", "SYS.1·2 고객·시스템 요구", "SYS.1·SYS.2"], ["SYS", "SYS.3 시스템 구조", "SYS.3"], ["SW", "SWE.1~3 SW 요구·설계", "SWE.1·2·3"], ["HW", "HWE.1·2 HW 요구·설계", "HWE.1·2"], ["verif", "시험", "SYS.4·5 SWE.4·5·6 HWE.3·4"], ["trace", "빠진 곳 점검", "추적성·WP 충족도"], ["review", "QA 교차검토", "SUP.1 교차검토"]];
// ── 화면 구성: 프로세스 그룹(SYS·SWE·HWE·점검·QA) → 프로세스 탭 ──
// 내부 탭(tab)과 데이터·기능은 그대로 두고, 프로세스 탭이 (내부 탭 + 섹션/시험 레벨)을 가리키는 화면 계층만 얹는다.
// sub: req → STK(SYS.1)·SYS(SYS.2) / SW·HW → req·arch·unit / verif → 시험 레벨 키 / pair: 이 시험이 검증하는 왼쪽 프로세스
const AE_GROUPS = [{ id: "SYS", label: "SYS" }, { id: "SWE", label: "SWE", scope: "SW" }, { id: "HWE", label: "HWE", scope: "HW" }, { id: "QA", label: "점검·QA" }];
const AE_PROCS = [
  { id: "SYS.1", grp: "SYS", short: "고객 요구", tab: "req", sub: "STK" },
  { id: "SYS.2", grp: "SYS", short: "시스템 요구", tab: "req", sub: "SYS" },
  { id: "SYS.3", grp: "SYS", short: "시스템 구조", tab: "SYS", sub: null },
  { id: "SYS.4", grp: "SYS", short: "통합 검증", tab: "verif", sub: "SYS4", pair: "SYS.3" },
  { id: "SYS.5", grp: "SYS", short: "시스템 검증", tab: "verif", sub: "SYS5", pair: "SYS.2" },
  { id: "SWE.1", grp: "SWE", short: "SW 요구", tab: "SW", sub: "req" },
  { id: "SWE.2", grp: "SWE", short: "SW 구조", tab: "SW", sub: "arch" },
  { id: "SWE.3", grp: "SWE", short: "상세설계", tab: "SW", sub: "unit" },
  { id: "SWE.4", grp: "SWE", short: "유닛 검증", tab: "verif", sub: "SWE4", pair: "SWE.3" },
  { id: "SWE.5", grp: "SWE", short: "통합 검증", tab: "verif", sub: "SWE5", pair: "SWE.2" },
  { id: "SWE.6", grp: "SWE", short: "SW 검증", tab: "verif", sub: "SWE6", pair: "SWE.1" },
  { id: "HWE.1", grp: "HWE", short: "HW 요구", tab: "HW", sub: "req" },
  { id: "HWE.2", grp: "HWE", short: "HW 설계", tab: "HW", sub: "arch" },
  { id: "HWE.3", grp: "HWE", short: "설계 검증", tab: "verif", sub: "HWE3", pair: "HWE.2" },
  { id: "HWE.4", grp: "HWE", short: "요구 검증", tab: "verif", sub: "HWE4", pair: "HWE.1" },
  { id: "TRACE", grp: "QA", short: "빠진 곳 점검", tab: "trace", sub: null, code: "추적성·WP 충족도" },
  { id: "SUP.1", grp: "QA", short: "QA 교차검토", tab: "review", sub: null },
  { id: "ARTIFACTS", grp: "QA", short: "산출물 보기", tab: "artifacts", sub: null, code: "생성 산출물 전체 열람" },
];
// 내부 탭으로 이동할 때 기본으로 보여줄 프로세스(섹션) — 아직 비어 있는 첫 단계
function aeInitSub(t, m) {
  if (t === "req") return m.reqs.SYS.length ? "SYS" : "STK";
  if (t === "SW" || t === "HW") return !m.reqs[t].length ? "req" : !m.comps[t].length ? "arch" : t === "SW" ? "unit" : "arch";
  if (t === "verif") { const ks = AE_PROCS.filter(p => p.tab === "verif" && m.scope[AE.TEST_LEVELS[p.sub].level]).map(p => p.sub); return ks.find(k => !m.tests.some(x => x.level === k)) || ks[0] || null; }
  return null;
}
// 단계별 안내 — 왜 하는지 · 할 일 · 끝났다고 보는 기준 (기능은 그대로, 화면 위에 안내만 얹는다)
const AE_GUIDE = {
  setup: { why: "V-모델 전체에 적용되는 기준을 정합니다. 여기서 정한 ASPICE 버전·개발 범위(SW/HW)에 따라 이후 탭과 생성되는 문서가 달라집니다.",
    todo: ["ASPICE 버전(3.1 / 4.0 / 겸용)과 개발 범위(SYS + SW / SYS + SW + HW)를 고릅니다.", "확보한 입력자료(고객 사양서·DBC·회의록 등)를 체크합니다. 없는 자료는 TBD로 남겨도 됩니다.", "통신 DB(DBC)가 있으면 끌어다 놓아 인터페이스 요구를 자동으로 만듭니다."],
    done: "버전·범위를 정하고 저장하면 끝. 입력자료는 나중에 추가해도 됩니다." },
  req: { why: "고객(OEM)이 말한 문장(이해관계자 요구)을 그대로 남기고, 그것을 우리 시스템이 검증할 수 있는 문장(시스템 요구)으로 다시 씁니다. 둘을 연결해 두어야 '고객 요구를 빠짐없이 분석했다'는 근거가 됩니다.",
    todo: ["고객 사양서·RFQ 등을 붙여넣거나 파일을 올리고 [AI 도출·명세]를 누릅니다.", "이해관계자 요구마다 시스템 요구가 연결됐는지(SYS 칸) 확인하고, 0건이면 [＋ 도출]·[연결…]·'해당 없음'으로 처리합니다.", "시스템 요구의 [상세]에서 검증 기준(합격·불합격을 가를 수치)을 확인한 뒤 [요구사항 확정]을 누릅니다."],
    done: "모든 이해관계자 요구가 시스템 요구에 연결되거나 '해당 없음'(사유)이고, 확정을 눌렀으면 끝." },
  SYS: { why: "시스템을 요소(센서부·MCU·통신부 등)로 나누고, 각 시스템 요구를 담당 요소에 할당합니다. 이 할당이 다음 단계에서 SW/HW 요구를 내리는 기준이 됩니다.",
    todo: ["[AI 요소 설계·할당]으로 초안을 만들거나 직접 요소를 추가합니다. 요소 구분(SW·HW·HW+SW)이 중요합니다 — SW가 포함된 요소의 요구만 SW로 내려갑니다.", "요구마다 담당 요소 칩을 확인합니다.", "인터페이스(누가 → 누구에게, 무엇을, 얼마나 자주)와 운영 모드(startup·normal·sleep…)를 채웁니다."],
    done: "모든 시스템 요구에 담당 요소가 있고, 요소 간 인터페이스가 정의되면 끝." },
  SW: { why: "SW가 맡은 시스템 요구를 SW 요구로 구체화하고, SW 컴포넌트에 할당한 뒤, 유닛(코드 단위) 골격까지 내립니다. 알고리즘·동적 동작은 코드가 나온 뒤 채우므로 지금은 TBD가 정상입니다.",
    todo: ["[AI 요구 파생]으로 SW 요구를 만듭니다. 이미 있으면 [빠진 N건만 파생]을 쓰세요(전체 다시 파생은 기존 것을 지웁니다).", "요구마다 '할당 →' 칩으로 담당 컴포넌트를 지정합니다.", "[규칙 골격 생성] 또는 [빠진 유닛만 추가]로 유닛을 만들고, 코드가 있으면 .h 헤더를 끌어다 놓습니다."],
    done: "SW 담당 시스템 요구가 모두 SW 요구로 내려가고, 모든 SW 요구에 컴포넌트와 유닛이 있으면 끝." },
  HW: { why: "HW가 맡은 시스템 요구를 HW 요구로 구체화하고 HW 컴포넌트에 할당합니다. ASPICE 3.1에는 HWE가 없어 4.0 HWE.1~4를 준용합니다.",
    todo: ["[AI 요구 파생] 또는 [빠진 N건만 파생]으로 HW 요구를 만듭니다.", "요구마다 담당 HW 컴포넌트를 지정합니다.", "전원·열·접지 같은 HW 인터페이스를 채웁니다."],
    done: "HW 담당 시스템 요구가 모두 HW 요구로 내려가고 컴포넌트가 지정되면 끝." },
  verif: { why: "요구마다 '어떻게 확인할 것인가'(시험)를 미리 정해야 요구가 검증 가능해집니다. 시스템·SW·HW 요구 시험, 인터페이스 통합 시험, 유닛 시험을 한 모델에서 만들어 추적성을 닫습니다.",
    todo: ["[전체 생성]으로 규칙(+AI) 시험을 만듭니다. 이미 있으면 [빠진 시험만 생성]을 쓰세요.", "레벨 탭(SYS.5·SWE.6 …)을 돌며 기대 결과·합격 기준이 판정 가능한지 봅니다.", "TBD로 남은 합격 기준은 코드·사양 확정 후 채웁니다."],
    done: "'빠진 곳 점검'에서 '요구마다 시험이 있나' 등 검증 항목이 모두 100%면 끝." },
  trace: { why: "V-모델이 어디에서 끊겼는지 한눈에 봅니다. 커버리지 막대가 100%가 아니면 그 줄의 [빠짐 →]으로 가서 처리하고, 일관성 점검의 오류는 반드시 해소합니다.",
    todo: ["커버리지의 [빠짐 N건 →]을 눌러 해당 탭에서 처리합니다(처리 방법 💡가 함께 표시됨).", "'변경 영향 검토'가 있으면 하위 연결마다 '영향 없음' 또는 '하위 수정 필요'로 판정합니다.", "일관성 점검의 줄을 눌러 처리 방법을 보고 ✎로 바로 고칩니다. WP 특성 충족도의 누락은 사유를 적거나 N/A로 정리합니다."],
    done: "오류 0, 변경 영향 확인 대기 0, 사유 없는 누락 0이면 끝. 경고·정보는 사유가 있으면 남아 있어도 됩니다." },
  review: { why: "작성한 산출물을 생성 AI와 다른 검토 AI가 보고 의견을 내고, QA 담당자가 그 의견이 맞는지 판정합니다. 판정 기록이 SUP.1 QA 증적이 됩니다.",
    todo: ["검토 AI를 고르고 [전체 산출물 변경분 검토] 또는 표에서 산출물을 골라 검토합니다(시스템 요구부터 권장).", "②-b [✦ 수정안 생성]으로 수정안을 만들고 카드마다 승인·편집·반려합니다. 승인 전에는 아무것도 바뀌지 않습니다.", "남은 의견은 ③에서 '맞음 → 고침 / 틀림 / 보류'로 판정하고, 끝나면 [변경분 검토]로 수정 결과를 재검토합니다."],
    done: "현황표의 모든 산출물이 '완료'(검토됨 100%, 미판정 0)면 끝. \'빠진 곳 점검\'에서 [교차검토 끝난 요구 → Reviewed]로 상태를 올립니다." },
};
const AE_LS_INTRO = "spiderqa_ae_intro_seen", AE_LS_GUIDE = "spiderqa_ae_guide_hidden";
const AE_STEP_IDS = AE_TABS.map(t => t[0]);
const AE_SEV = { error: { c: "#FF5B5B", l: "오류" }, warn: { c: "#F5A623", l: "경고" }, info: { c: "#6B7280", l: "정보" } };

// 모달 내부에서 정의하면 렌더마다 컴포넌트가 새로 만들어져 입력 포커스가 사라지므로 최상위에 둔다
// 진행률·오류를 '누른 버튼이 있는 섹션' 바로 아래에 표시하기 위한 컨텍스트 (V-모델 모달)
const AeRunCtx = React.createContext(null);
// 섹션 접기 상태 — 제목의 숫자(건수)는 바뀌므로 숫자를 지운 제목을 키로 쓴다. 모달을 닫기 전까지(같은 세션) 유지
const AE_SEC_FOLD = new Map();
const aeSecKey = t => String(typeof t === "string" ? t : "").replace(/\d+/g, "#").slice(0, 40);
function AeFoldBtn({ open, onClick, title }) {
  return <button type="button" onClick={onClick} title={title || (open ? "접기" : "펼치기")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 11, padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>{open ? "▾" : "▸"}</button>;
}
function AeSec({ title, right, children }) {
  const uid = React.useId();
  const rc = React.useContext(AeRunCtx);
  const here = !!rc && rc.anchor === uid;
  const fk = aeSecKey(title);
  const [open, setOpen] = useState(() => !(fk && AE_SEC_FOLD.get(fk) === false));
  const toggle = () => setOpen(o => { const n = !o; if (fk) AE_SEC_FOLD.set(fk, n); return n; });
  return (
    <div data-aesec={uid} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: open ? 8 : 0 }}>
        <AeFoldBtn open={open} onClick={toggle} />
        <div onClick={toggle} title={open ? "눌러서 접기" : "눌러서 펼치기"} style={{ fontSize: 12, fontWeight: 700, flex: 1, cursor: "pointer", userSelect: "none" }}>{title}</div>{right}
      </div>
      {here && (rc.busy || rc.prog) && <GenProgressBar progress={rc.prog || { percent: 3, label: "준비 중…" }} subText="요구 건수에 따라 수십 초가 걸릴 수 있습니다. 화면을 유지해 주세요." />}
      {here && rc.runErr && <div style={{ color: T.red, fontSize: 11.5, padding: 9, background: T.red + "11", borderRadius: 8, marginBottom: 8 }}>{rc.runErr}</div>}
      {open && children}
    </div>
  );
}
function AeFlags({ r }) {
  const f = AE.qualityFlags(r);
  return f.length ? <span title={f.map(x => x.msg).join("\n")} style={{ fontSize: 9.5, color: T.amber, whiteSpace: "nowrap" }}>⚠ {f.length}</span> : <span style={{ fontSize: 9.5, color: T.green }}>✓</span>;
}

function AspiceEngModal({ onClose, form, wbs, requirements, setRequirements, ossp, initTab, tailoring }) {
  const [items, setItems] = useState(() => (requirements?.items || []).map(x => ({ ...x })));
  const [model, setModel] = useState(() => {
    // 기존 연결의 기준선을 현재 저장본 내용으로 먼저 등록한 뒤 확정 요구로 동기화 (변경 감지)
    const m = requirements?.aspice ? AE.baselineLinks(requirements.aspice) : AE.normalizeModel(null);
    if (!requirements?.aspice) {
      m.useAI = !(() => { try { return localStorage.getItem(PBS_NOAI_KEY) === "1"; } catch { return false; } })();
      if (form?.aspiceVersion && AE.ASPICE_VERSIONS.some(v => v.id === form.aspiceVersion)) m.version = form.aspiceVersion;   // 시작 화면에서 고른 적용 기준
    }
    // SW·HW 범위의 기준은 적용 범위(개발 범위)다 — 저장본이 있어도 항상 맞춘다 (WBS·산출물 목록과 V-모델 범위의 일치)
    if (tailoring?.aspiceScope) { m.scope.SW = aspiceGroupOn(tailoring.aspiceScope, "SWE"); m.scope.HW = aspiceGroupOn(tailoring.aspiceScope, "HWE"); }
    m.reqs.STK = AE.syncStkReqs(requirements?.stk?.items || [], m.reqs.STK);
    m.reqs.SYS = AE.syncSysReqs(requirements?.items || [], m.reqs.SYS);
    return m;
  });
  // 기본 탭: 다음에 할 단계(aeNextTab) — 처음 여는 V-모델은 ①, 진행 중이면 비어 있는 첫 단계, 모두 갖춰지면 ⑦ 점검.
  // initTab은 특정 진입점(예: 요구사항 산출물 행의 '요구 도출·명세' 버튼 → ②)에서만 지정한다.
  const [tab, setTabRaw] = useState(() => initTab || aeNextTab(model, !!requirements?.aspice));
  const [sub, setSub] = useState(() => aeInitSub(initTab || aeNextTab(model, !!requirements?.aspice), model));
  // 내부 탭 이동: s를 주면 그 섹션(프로세스), null이면 탭 전체, 생략하면 비어 있는 첫 프로세스
  const setTab = (id, s) => { setTabRaw(id); setSub(s === undefined ? aeInitSub(id, model) : s); };
  const [itemsVer, setItemsVer] = useState(0);   // V-모델 쪽에서 요구 목록이 바뀌면(DBC 등) ① 탭 패널을 새 목록으로 다시 연다
  const srcRef = useRef(requirements?.source || null);   // ② 탭의 원문·파일 (확정 전이라도 저장에 포함)
  const [srcSig, setSrcSig] = useState(() => ((requirements?.source?.files) || []).map(f => f.name).join("|"));   // 파일명 변경 감지용
  // 첨부 파일명으로 입력자료 자동 감지 ('확보(자동)'로 표시 — 사용자가 눌러 확정해야 WP 충족도에 반영)
  const INPUT_HINTS = { in_cust: /요구\s*사양|사양서|RFQ|SOR|견적\s*요청|업무\s*범위|OEM|spec/i, in_reg: /법규|규격|표준|regulation|ISO|SAE|UN\s*R/i, in_diag: /진단|UDS|DTC/i, in_env: /환경|내구|EMC|온도|진동/i, in_mcu: /MCU|플랫폼|BSW|AUTOSAR/i, in_testenv: /HILS|벤치|시험\s*환경|계측/i, in_safety: /HARA|FSC|TSC|기능\s*안전|26262/i, in_cs: /TARA|사이버|21434/i, in_prev: /전대|과거|이슈\s*이력|Lessons/i };
  const autoInputs = (() => { const names = srcSig.split("|").filter(Boolean); const out = {}; Object.entries(INPUT_HINTS).forEach(([id, re]) => { const hit = names.filter(n => re.test(n)); if (hit.length) out[id] = hit; }); return out; })();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);
  const [open, setOpen] = useState({});
  const [dbc, setDbc] = useState(null);        // { fileName, parsed, own }
  const [tplGroup, setTplGroup] = useState("SYS_RS");
  const [vFilter, setVFilter] = useState("SYS5");
  const [ddView, setDdView] = useState({ unit: null, kind: "component", mode: "diagram", file: 0 });
  const [hdView, setHdView] = useState({ comp: null, kind: "schematic" });   // HWE.2 회로 설계 보기
  const [artSel, setArtSel] = useState(null);   // 산출물 보기: 선택 항목 { type: doc|svg|code|text|table, ... }
  const [artQ, setArtQ] = useState("");         // 산출물 보기 필터
  const zipAllBusy = useRef(false);
  const [artPrev, setArtPrev] = useState(null);
  const [svgZoom, setSvgZoom] = useState("fit");   // SVG 미리보기 배율 (산출물 보기·SWE.3·HWE.2 공용)
  const [artCat, setArtCat] = useState("doc");          // 산출물 보기 카테고리: doc | sw | hw | common
  const [artOpen, setArtOpen] = useState(() => new Set());   // 펼친 유닛·블록 그룹   // 문서 미리보기 { key, kind: html|sheets|loading|error, html, sheets, tab, bytes, ext }   // mode: diagram | code   // SWE.3 상세설계 다이어그램 보기 { unit id, kind }
  // 커버리지 "빠짐 N건" → 해당 탭으로 이동해 미연결 항목만 표시 ({ tab, level?, ids:Set, q })
  const [focus, setFocus] = useState(null);
  const focusOn = tab === focus?.tab ? focus : null;
  const applyFocus = (list) => (focusOn && list.some(x => focusOn.ids.has(x.id))) ? list.filter(x => focusOn.ids.has(x.id)) : list;
  const goMissing = (c) => { setFocus({ key: c.key, tab: c.tab, level: c.level || null, ids: new Set(c.missing), q: c.q, n: c.missing.length }); setTab(c.tab, c.level || null); if (c.level) setVFilter(c.level); };
  const [guides, setGuides] = useState([]);
  useEffect(() => { fetchWritingGuides().then(gs => setGuides(gs.filter(g => g.is_active !== false))).catch(() => {}); }, []);
  const guideBlock = buildGuideBlock(guides);
  const V = model.version;
  const findings = AE.checkConsistency(model);
  const metrics = AE.coverageMetrics(model);
  // 적용 범위(개발 범위)가 있는 과제는 SW·HW 범위를 그쪽에서만 바꾼다 — WBS·산출물 목록·V-모델 범위 일치
  const scopeLocked = !!tailoring?.aspiceScope;
  const hiddenHW = !model.scope.HW ? (model.reqs.HW.length + model.comps.HW.length + model.tests.filter(t => /^HWE/.test(t.level)).length) : 0;
  const hiddenSW = !model.scope.SW ? (model.reqs.SW.length + model.comps.SW.length + (model.units.SW || []).length) : 0;
  const inp = { width: "100%", padding: "4px 6px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" };
  const ta = { ...inp, minHeight: 40, resize: "vertical", lineHeight: 1.45 };
  const small = { background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.accent, cursor: "pointer", fontSize: 10.5, padding: "3px 9px", fontFamily: "inherit" };
  const set = fn => setModel(m => { const n = AE.normalizeModel(JSON.parse(JSON.stringify(m))); fn(n); return n; });

  // ── 공통: AI 호출 래퍼 (청크 진행률) ──
  // 진행률 표시 위치: 버튼을 누른 섹션(AeSec) 바로 아래. 탭을 옮기는 등 그 섹션이 화면에 없으면 상단에 표시.
  const clickSec = useRef(null);
  const [runAt, setRunAt] = useState(null);     // { anchor: 섹션 id, el: 섹션 DOM, tab }
  const [runErr, setRunErr] = useState(null);
  async function run(label, fn) {
    if (busy) return;
    const el = clickSec.current;
    setRunAt(el ? { anchor: el.getAttribute("data-aesec"), el, tab } : null);
    setBusy(true); setErr(null); setRunErr(null); setNote(null); setProg({ percent: 3, label });
    try { const msg = await fn(); setProg({ percent: 100, label: msg || "완료" }); setTimeout(() => setProg(null), 2500); }
    catch (e) { setRunErr(`${label} 실패: ${e.message}`); setProg(null); }
    setBusy(false);
  }
  const sysCompName = () => Object.fromEntries(model.comps.SYS.map(c => [c.id, c.name]));

  // ── 11) 3단 교차검토: ① 규칙 검사 → ② 검토 AI 의견(/api/review, 생성 AI와 다른 모델) → ③ QA 담당자 판정 ──
  const [rv, setRv] = useState(null);              // 검토 AI 설정(마스킹)
  const [rvLevel, setRvLevel] = useState("SYS");
  const [rvFilter, setRvFilter] = useState("open");
  const [rvProv, setRvProv] = useState("");          // 이번 검토에 쓸 검토 AI (Gemini·ChatGPT 등) — 기본은 설정의 기본 검토 AI
  const [rvBy, setRvBy] = useState("all");
  const [rvGroup, setRvGroup] = useState(true);       // ③ 판정 목록: 대상(요구·항목)별로 묶어 보기 — 한 대상의 의견을 한 번에 판정·수정
  const [cardOpen, setCardOpen] = useState({});      // 승인 큐·판정 카드 펼침 — 키가 없으면 기본값(처리 대기는 펼침, 처리 끝난 것은 접힘)
  const isCardOpen = (k, dflt) => (k in cardOpen ? cardOpen[k] : dflt);
  const setCardsOpen = (keys, v) => setCardOpen(o => { const n = { ...o }; keys.forEach(k => { n[k] = v; }); return n; });
  const [rvSort, setRvSort] = useState("sev");       // 정렬: sev(중대 먼저) | id
  const [rvPick, setRvPick] = useState([]);          // 선택 검토할 산출물(검토 범위 key)
  const [rvRunning, setRvRunning] = useState(false);  // 검토 AI 호출 진행 중 (중지 버튼 표시)
  const rvStop = useRef(false);
  const rvApplied = useRef(false);                     // 이번 실행에서 검토 결과가 모델에 반영됨 → 끝나면 자동 저장
  const [rvGuide, setRvGuide] = useState(false);
  // 길잡이: 처음 1회 안내 화면 · 단계별 안내 카드 숨김(브라우저에 기억) · 진행 현황 접기
  const [introOpen, setIntroOpen] = useState(() => { try { return !localStorage.getItem(AE_LS_INTRO); } catch (_) { return true; } });
  const [guideHidden, setGuideHidden] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(AE_LS_GUIDE) || "[]")); } catch (_) { return new Set(); } });
  const [progOpen, setProgOpen] = useState(true);
  const hideGuide = (id, hide) => setGuideHidden(prev => { const n = new Set(prev); if (hide) n.add(id); else n.delete(id); try { localStorage.setItem(AE_LS_GUIDE, JSON.stringify([...n])); } catch (_) {} return n; });
  const closeIntro = () => { setIntroOpen(false); try { localStorage.setItem(AE_LS_INTRO, "1"); } catch (_) {} };
  const [rvRule, setRvRule] = useState(null);          // ① 규칙 검사 상세 펼침: error | warn | info | qf(요구 품질 플래그) | here(이 산출물 관련)       // 검토 기준 안내 펼침
  const [rvEdit, setRvEdit] = useState(null);          // ③에서 검토 대상 직접 수정 { fkey, key, id, vals }
  // 편집 중인 대상에 대해 AI 수정안 초안 — 판정된(틀림 제외)·미판정 의견과 관련 상위 항목을 근거로 필드별 수정안을 만들어 편집 칸에 채운다. 적용은 사람이 한다.
  function aiFixDraft() {
    if (!rvEdit) return;
    const { key, id } = rvEdit;
    return run(`${id} AI 수정안 초안`, async () => {
      const sp = AE.reviewEditSpec(model, key, id);
      if (!sp) throw new Error("수정할 대상을 찾지 못했습니다.");
      const ops = AE.reviewView(model).list.filter(f => f.level === key && f.reqId === id && !f.removed && f.judge?.state !== "invalid");
      if (!ops.length) throw new Error("반영할 검토 의견이 없습니다(모두 '틀림'으로 판정되었거나 의견이 없음).");
      const refs = AE.reviewRefs(model, key, id);
      const r = await callClaudeJson(AE.promptFixDraft({ scopeKey: key, item: { id, values: sp.values }, fields: sp.fields, opinions: ops, refs }), 2000);
      const fields = r && typeof r.fields === "object" ? r.fields : {};
      const allowed = new Set(sp.fields.map(f => f.k));
      const draft = Object.fromEntries(Object.entries(fields).filter(([k, v]) => allowed.has(k) && typeof v === "string" && v.trim() && v.trim() !== String(sp.values[k] || "").trim()).map(([k, v]) => [k, v.trim()]));
      if (!Object.keys(draft).length) throw new Error("AI가 바꿀 내용을 제안하지 않았습니다. 직접 수정하세요.");
      setRvEdit(x => x && x.id === id ? { ...x, vals: { ...x.vals, ...draft }, aiDraft: { fields: draft, original: Object.fromEntries(Object.keys(draft).map(k => [k, x.vals[k] ?? ""])), rationale: String(r.rationale || ""), opinions: ops.length } } : x);
      return `AI 수정안 초안 ${Object.keys(draft).length}개 필드 — 편집 칸에 채웠습니다. 내용을 확인·수정한 뒤 [적용]을 누르세요 (적용 전에는 아무것도 바뀌지 않습니다).`;
    });
  }
  // 검토 대상에 패치 적용(공용) — SYS 요구의 제목·내용은 확정 요구(items)가 원본이므로 items도 함께 고친다. 변경이 없으면 false
  function applyPatch(key, id, patch, via = "review") {
    const spec = AE.reviewEditSpec(model, key, id);
    if (!spec) { setErr("수정할 대상을 찾지 못했습니다 — 이미 삭제되었을 수 있습니다."); return false; }
    const p = {}; spec.fields.forEach(f => { if (f.k in patch && String(patch[f.k] ?? "") !== String(spec.values[f.k] ?? "")) p[f.k] = patch[f.k]; });
    if (!Object.keys(p).length) return false;
    const S = AE.reviewScope(key);
    if (S?.kind === "req" && S.lv === "SYS" && ("title" in p || "text" in p)) {
      // 확정 요구(items)도 같이 고친다 — 여러 건을 연속 적용해도 서로 덮어쓰지 않도록 함수형 갱신
      setItems(list => list.map(it => it.id !== id ? it : { ...it, ...("title" in p ? { name: p.title } : {}), ...("text" in p ? { detail: p.text } : {}) }));
      setItemsVer(v => v + 1);
    }
    setModel(m => AE.applyReviewEdit(m, key, id, p, { via }));
    return true;
  }
  // ③ 판정 화면의 편집기 [적용]
  function applyReviewEditUI() {
    if (!rvEdit) return;
    const { key, id, vals, fkey } = rvEdit;
    const fk = String(fkey || "");
    const via = fk.startsWith("fq|") ? (rvEdit.aiDraft ? "fix-queue(AI 초안·QA 편집 승인)" : "fix-queue(QA 편집 승인)") : rvEdit.aiDraft ? "review(AI 초안·QA 승인)" : fk.startsWith("qf|") || fk.startsWith("rule") ? "rule" : "review";
    const ok = applyPatch(key, id, vals, via);
    if (!ok) { setRvEdit(x => x ? { ...x, msg: "바뀐 내용이 없어 적용할 것이 없습니다. 아래 '규칙 판정'에 남은 항목이 있으면 그 칸을 고친 뒤 적용하세요. 그대로 두려면 [취소]." } : x); return; }
    if (fk.startsWith("fq|")) { const card = (fixQ?.cards || []).find(c => c.id === id); if (card) approveJudge(card); finishQueueCard(id, "approved"); }
    setRvEdit(null);
    setNote(`${id} 수정을 반영했습니다 — 판정 목록에 '✎ 수정함'으로 표시되고, '변경분 검토'로 수정 결과를 다시 확인할 수 있습니다. 저장을 눌러 확정하세요.`);
  }

  // ── 수정안 승인 큐 ──
  // fixQ: { key, at, cards: [{ id, title, kind: "rule"|"ai", fields, original, fieldsSpec, rationale, opIds, opinions, status: pending|approved|rejected, err }] }
  const [fixQ, setFixQ] = useState(null);
  function genFixQueue() {
    const key = rvLevel;
    return run(`수정안 생성 — ${AE.reviewScope(key)?.label || key}`, async () => {
      const targets = AE.fixQueueTargets(model, key);
      if (!targets.length) return "수정안을 만들 대상이 없습니다 — 미판정이거나 '맞음인데 아직 안 고친' 의견이 달린 항목이 없습니다.";
      const cards = [], aiTargets = [];
      targets.forEach(t => {
        const sp = AE.reviewEditSpec(model, key, t.id);
        const base = { id: t.id, title: sp.values.title || sp.values.name || t.id, original: { ...sp.values }, fieldsSpec: sp.fields, opIds: t.allFindings.map(f => f.key), opinions: t.allFindings, status: "pending" };
        const rule = AE.ruleFixProposal(model, key, t.id, t.allFindings);
        if (rule) cards.push({ ...base, kind: "rule", fields: rule.fields, rationale: rule.rationale });
        else aiTargets.push({ base, prompt: { id: t.id, fields: sp.fields, values: sp.values, opinions: t.allFindings, refs: AE.reviewRefs(model, key, t.id) } });
      });
      let failed = 0;
      for (let i = 0; i < aiTargets.length; i += AE.FIX_BATCH) {
        const grp = aiTargets.slice(i, i + AE.FIX_BATCH);
        setProg({ percent: 5 + (i / Math.max(1, aiTargets.length)) * 90, label: `AI 수정안 초안 작성 중… (${Math.min(i + grp.length, aiTargets.length)}/${aiTargets.length}) · 규칙 ${cards.length}건` });
        let got = [];
        try { const r = await callClaudeJson(AE.promptFixDraftBatch({ scopeKey: key, targets: grp.map(g => g.prompt) }), 6000); got = Array.isArray(r?.items) ? r.items : []; } catch (e) { got = []; }
        grp.forEach(g => {
          const x = got.find(y => y?.id === g.base.id);
          const allowed = new Set(g.base.fieldsSpec.map(f => f.k));
          const fields = x && x.fields && typeof x.fields === "object" ? Object.fromEntries(Object.entries(x.fields).filter(([k, v]) => allowed.has(k) && typeof v === "string" && v.trim() && v.trim() !== String(g.base.original[k] || "").trim()).map(([k, v]) => [k, v.trim()])) : {};
          if (Object.keys(fields).length) cards.push({ ...g.base, kind: "ai", fields, rationale: String(x.rationale || "") });
          else { failed++; cards.push({ ...g.base, kind: "ai", fields: {}, rationale: "", err: x ? "AI가 바꿀 내용을 제안하지 않음 — '편집 후 승인'으로 직접 수정" : "AI 응답 없음(호출 실패 또는 누락) — 다시 생성하거나 직접 수정" }); }
        });
      }
      setFixQ({ key, at: new Date().toISOString(), cards });
      const nAi = cards.filter(c => c.kind === "ai" && !c.err).length, nRule = cards.filter(c => c.kind === "rule").length;
      return `수정안 ${nAi + nRule}건 준비 — 규칙 ${nRule} · AI ${nAi}${failed ? ` · 초안 실패 ${failed}건(직접 수정)` : ""}. 아래 승인 큐에서 카드마다 승인·편집·반려하세요. 승인 전에는 아무것도 바뀌지 않습니다.`;
    });
  }
  function finishQueueCard(id, status) { setFixQ(q => q ? { ...q, cards: q.cards.map(c => c.id === id ? { ...c, status } : c) } : q); }
  // 승인 = 이 항목의 미판정 의견을 '맞음'으로 판정(틀림·보류로 이미 판정한 것은 유지)
  function approveJudge(card) {
    setModel(m => AE.judgeReview(m, card.opIds.filter(k => { const f = m.aiReview.findings.find(x => x.key === k); return f && !f.judge; }), "valid", `수정안 승인(${card.kind === "rule" ? "규칙" : "AI"} 초안)`));
  }
  function approveCard(card) {
    const ok = applyPatch(fixQ.key, card.id, card.fields, card.kind === "rule" ? "fix-queue(규칙 초안·QA 승인)" : "fix-queue(AI 초안·QA 승인)");
    approveJudge(card);
    finishQueueCard(card.id, ok ? "approved" : "approved(변경 없음)");
  }
  function approveAll() {
    const pend = (fixQ?.cards || []).filter(c => c.status === "pending" && !c.err);
    if (!pend.length) return;
    if (!window.confirm(`승인 대기 ${pend.length}건을 모두 승인합니다.\n각 항목의 수정안이 적용되고 해당 의견은 '맞음'으로 판정되며, 이력에 남습니다.\n내용을 확인하지 않은 승인은 심사 때 설명하기 어렵습니다. 계속할까요?`)) return;
    pend.forEach(c => approveCard(c));
  }
  useEffect(() => { apiFetch("/api/review").then(c => { setRv(c); const ready = (c.available || []).filter(a => a.ready); setRvProv(ready.some(a => a.id === c.defaultProvider) ? c.defaultProvider : (ready[0]?.id || "")); }).catch(e => setRv({ error: e.message })); }, []);
  const rvSel = (rv?.available || []).find(a => a.id === rvProv) || null;
  // ── ② 검토 AI 의견 — 검토 범위(요구·아키텍처·상세설계·검증 명세) 1개를 검토 ──
  // onProg(fraction 0~1, 표시 문구): 진행률 보고. 반환: { done, kept, dropped, failed, timeouts, fatal } (검토 기록은 이 안에서 모델에 반영)
  async function reviewScopeRun(lv, mode, onProg) {
    const S = AE.reviewScope(lv);
    const targets = AE.reviewTargets(model, lv, mode, rvSel.id);
    const res = { key: lv, label: S?.label || lv, total: targets.length, done: 0, kept: 0, dropped: 0, failed: 0, timeouts: 0, fatal: null, lastErr: null };
    if (!targets.length) return res;
    const kept = [], done = []; let meta = {};
    const isTimeout = e => e?.status === 504 || e?.data?.code === "REVIEW_TIMEOUT" || /FUNCTION_INVOCATION_TIMEOUT|시간 초과/.test(String(e?.message || "") + String(e?.data?.raw || ""));
    // 묶음 1회 호출 — 시간 초과면 1건씩 나눠 다시 보낸다(추론형 모델은 건수에 비례해 느려짐)
    async function callBatch(batch) {
      try {
        const r = await apiFetch("/api/review", { method: "POST", body: JSON.stringify({ action: "review", provider: rvSel.id, system: AE.reviewSystemPrompt(), prompt: AE.reviewPrompt(model, lv, batch, V) }) });
        meta = { provider: r.provider, label: r.label, model: r.model, sameAsGenerator: r.sameAsGenerator };
        const v = AE.validateReviewScope(AE.parseReviewJson(r.text), batch, lv, V);
        kept.push(...v.kept); res.dropped += v.dropped.length; done.push(...batch.map(b => b.id));
      } catch (e) {
        if ([401, 403, 409, 428, 500].includes(e.status)) { res.fatal = e; return; }   // 설정·권한 문제는 즉시 중단
        if (isTimeout(e)) {
          res.timeouts++;
          if (batch.length > 1) { for (const one of batch) { if (res.fatal || rvStop.current) return; await callBatch([one]); } return; }
        }
        res.failed += batch.length; res.lastErr = e;
      }
    }
    for (let i = 0; i < targets.length && !res.fatal && !rvStop.current; i += AE.REVIEW_BATCH) {
      const batch = targets.slice(i, i + AE.REVIEW_BATCH);
      onProg?.(i / targets.length, `${S?.proc || ""} ${S?.label || lv} ${Math.min(i + batch.length, targets.length)}/${targets.length}${res.timeouts ? " · 응답이 느려 1건씩 나눠 보내는 중" : ""}`);
      await callBatch(batch);
    }
    res.done = done.length; res.kept = kept.length;
    // 받은 의견은 중간에 멈췄더라도 반영 (검토한 항목만 '검토됨'으로 기록)
    if (done.length) rvApplied.current = true;
    if (done.length) setModel(m => AE.applyReviewRun(m, { level: lv, reviewedIds: done, kept, meta: { ...meta, dropped: res.dropped, failed: res.failed } }));
    return res;
  }
  function reviewSummary(r) {
    return `검토 ${r.done}건 · 판정 대기 의견 ${r.kept}건 · 규칙으로 걸러낸 의견 ${r.dropped}건${r.failed ? ` · 실패 ${r.failed}건('변경분 검토'를 누르면 실패분만 다시 보냅니다)` : ""}${r.fatal ? ` · 중단: ${r.fatal.message}` : ""}${r.timeouts ? ` · 시간 초과로 나눠 보낸 묶음 ${r.timeouts}회` : ""}`;
  }
  function needReviewer() {
    if (!rv || rv.error) throw new Error(rv?.error || "검토 AI 설정을 불러오지 못했습니다.");
    if (!rvSel || !rvSel.ready) throw new Error("사용 가능한 검토 AI가 없습니다. 설정 → AI 연동 → AI 모델 등록에서 Gemini 또는 ChatGPT의 API 키와 모델을 등록하세요.");
  }
  // 선택한 산출물 1개 검토
  function aiReview(mode) {
    const lv = rvLevel, S = AE.reviewScope(lv);
    return run(`검토 AI 의견 수집 (${S?.proc} ${S?.label})`, async () => {
      needReviewer();
      if (!AE.reviewTargets(model, lv, mode, rvSel.id).length) return "다시 검토할 항목이 없습니다 — 마지막 검토 이후 바뀐 항목이 없습니다.";
      rvStop.current = false; rvApplied.current = false; setRvRunning(true);
      try {
        const r = await reviewScopeRun(lv, mode, (f, label) => setProg({ percent: 5 + f * 90, label: `${rvSel.label} 검토 중… ${label}` }));
        if (!r.done) { if (rvStop.current) return "검토를 중지했습니다 — 반영된 의견 없음"; throw r.fatal || r.lastErr || new Error("모든 검토 호출이 실패했습니다."); }
        setRvFilter("open");
        return (rvStop.current ? "중지함 — " : "") + reviewSummary(r);
      } finally { setRvRunning(false); if (rvApplied.current) setAutoSaveTick(t => t + 1); }
    });
  }
  // 여러 산출물 차례로 검토 — keys: 검토 범위 key 목록(선택 또는 전체), mode: "changed"(변경분) | "all"(전체)
  function aiReviewMany(keys, mode = "changed") {
    const title = keys.length === AE.reviewScopesFor(model).length ? "V-모델 산출물 전체" : `선택 산출물 ${keys.length}종`;
    return run(`${title} 교차검토 (${mode === "all" ? "전체" : "변경분"})`, async () => {
      needReviewer();
      const plan = AE.reviewScopesFor(model).filter(S => keys.includes(S.key)).map(S => ({ S, n: AE.reviewTargets(model, S.key, mode, rvSel.id).length })).filter(x => x.n > 0);
      const total = plan.reduce((a, x) => a + x.n, 0);
      if (!total) return `다시 검토할 항목이 없습니다 — ${rvSel.label} 기준으로 ${title}이 현재 내용으로 검토되어 있습니다.`;
      rvStop.current = false; rvApplied.current = false; setRvRunning(true);
      try {
        let base = 0; const results = [];
        for (const { S, n } of plan) {
          if (rvStop.current) break;
          const r = await reviewScopeRun(S.key, mode, (f, label) => setProg({ percent: 3 + ((base + f * n) / total) * 94, label: `${rvSel.label} 검토 중… [${results.length + 1}/${plan.length}] ${label}` }));
          results.push(r); base += n;
          if (r.fatal) break;   // 설정·권한 오류는 다른 산출물에서도 같으므로 중단
        }
        const sum = k => results.reduce((a, r) => a + r[k], 0);
        const fatal = results.find(r => r.fatal)?.fatal;
        if (!sum("done")) { if (rvStop.current) return "검토를 중지했습니다 — 반영된 의견 없음"; throw fatal || results.find(r => r.lastErr)?.lastErr || new Error("모든 검토 호출이 실패했습니다."); }
        setRvFilter("open");
        return `${rvStop.current ? "중지함 — " : ""}산출물 ${results.length}종 · 검토 ${sum("done")}건 · 판정 대기 의견 ${sum("kept")}건 · 걸러낸 의견 ${sum("dropped")}건${sum("failed") ? ` · 실패 ${sum("failed")}건(다시 누르면 실패·미검토분만 보냅니다)` : ""}${fatal ? ` · 중단: ${fatal.message}` : ""}${rvStop.current ? " · 남은 항목은 '변경분 검토'로 이어서 할 수 있습니다" : ""}`;
      } finally { setRvRunning(false); if (rvApplied.current) setAutoSaveTick(t => t + 1); }
    });
  }

  // ── SYS.3: 시스템 아키텍처 초안 + 할당 ──
  function sysArch() {
    return run("시스템 아키텍처 초안 작성", async () => {
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      const kept = n.comps.SYS.filter(c => c.origin === "dbc" || c.origin === "manual");
      const keptIf = n.interfaces.SYS.filter(i => i.origin === "dbc" || i.origin === "manual");
      if (!n.useAI) {
        const r = AE.ruleSysArchitecture(items, requirements?.specLeaves || []);
        const comps = [...r.comps.filter(c => !kept.some(k => k.name === c.name))];
        kept.forEach(k => comps.push({ ...k, id: comps.some(c => c.id === k.id) ? AE.nextId("SYE-", comps) : k.id }));
        n.comps.SYS = comps; n.alloc.SYS = { ...r.alloc }; n.interfaces.SYS = keptIf.filter(i => comps.some(c => c.id === i.from) && comps.some(c => c.id === i.to));
        setModel(n); return `규칙 기반 초안: 요소 ${comps.length}개 (기능 모듈 기준 — 물리 요소로 재분해 필요)`;
      }
      setProg({ percent: 10, label: "AI: 시스템 요소·인터페이스·운영 모드 설계 중…" });
      const res = await callClaudeJson(AE.promptSysArch({ form, reqs: n.reqs.SYS, version: V, guideBlock }), 3500);
      const a = AE.applyArchResult("SYS", res, n.comps.SYS);
      const comps = [...a.comps];
      kept.forEach(k => { if (!comps.some(c => c.name === k.name)) comps.push({ ...k, id: comps.some(c => c.id === k.id) ? AE.nextId("SYE-", comps) : k.id }); });
      const idOfName = Object.fromEntries(comps.map(c => [c.name, c.id]));
      const keptIf2 = keptIf.map(i => ({ ...i, from: comps.some(c => c.id === i.from) ? i.from : idOfName[(kept.find(k => k.id === i.from) || {}).name] || i.from, to: comps.some(c => c.id === i.to) ? i.to : idOfName[(kept.find(k => k.id === i.to) || {}).name] || i.to }));
      const ifs = [...a.interfaces];
      keptIf2.forEach(i => ifs.push({ ...i, id: AE.nextId("SIF-", ifs) }));
      n.comps.SYS = comps; n.interfaces.SYS = ifs;
      if (a.modes.length) n.modes = a.modes;
      if (a.rationale) n.rationale.SYS = a.rationale;
      n.alloc.SYS = {};
      // 할당: 10건씩 (Vercel 타임아웃 대응). DBC 유래 인터페이스 요구는 규칙으로 통신 요소에 할당
      const commId = (comps.find(c => c.origin === "dbc" && c.kind !== "외부") || {}).id;
      const pending = n.reqs.SYS.filter(r => { const it = items.find(x => x.id === r.id); if (it?._dbc && commId) { n.alloc.SYS[r.id] = [commId]; return false; } return true; });
      const ids = new Set(comps.map(c => c.id));
      for (let i = 0; i < pending.length; i += 10) {
        setProg({ percent: 30 + (i / Math.max(1, pending.length)) * 65, label: `AI: 요구사항 → 시스템 요소 할당 중… (${Math.min(i + 10, pending.length)}/${pending.length})` });
        try {
          const r = await callClaudeJson(AE.promptAllocate({ level: "SYS", reqs: pending.slice(i, i + 10), comps }), 3000);
          (r?.items || []).forEach(x => { if (x?.id) n.alloc.SYS[x.id] = (x.comps || []).filter(c => ids.has(c)); });
        } catch (_) { /* 실패분은 미할당으로 남김 — 일관성 점검에서 드러남 */ }
      }
      setModel(n);
      const un = n.reqs.SYS.filter(r => !(n.alloc.SYS[r.id] || []).length).length;
      return `AI 초안: 요소 ${comps.length}개 · 인터페이스 ${ifs.length}건 · 모드 ${n.modes.length}개${un ? ` · 미할당 ${un}건(수동 할당 필요)` : ""}`;
    });
  }

  // ── SWE.1 / HWE.1: 하위 요구 파생 ──
  // only: 시스템 요구 ID 목록 — 주어지면 '빠진 것만 파생': 기존 하위 요구·할당은 그대로 두고 그 시스템 요구에서만 새로 파생
  // ── SWE.3 상세설계(DD): 유닛별 정적 구조(A) → 동적 동작(B) 2회 AI 호출, 실패·AI 미사용 시 규칙 생성. 모든 요소에 요구 ID 추적 ──
  function genDD(unitIds = null) {
    const targets = (model.units.SW || []).filter(u => !unitIds || unitIds.includes(u.id));
    return run(unitIds ? `SWE.3 상세설계 생성 (${targets.length}개 유닛)` : "SWE.3 상세설계 생성 (전체 유닛)", async () => {
      if (!targets.length) throw new Error("설계할 유닛이 없습니다. 먼저 [규칙 골격 생성]으로 유닛을 만드세요.");
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      const seed = form?.id || form?.name || "project";
      const settings = AE.ddSettings(n);
      let done = 0, aiOk = 0, ruleN = 0;
      const designOne = async (u) => {
        const idx = n.units.SW.findIndex(x => x.id === u.id); if (idx < 0) return;
        let dd = null;
        if (n.useAI) {
          try {
            const a = await callClaudeJson(AE.promptDDStructure({ unit: u, model: n, version: V, settings }), 5000);
            const st = AE.normalizeDD(a, u, n, seed);
            let b = {};
            try { b = await callClaudeJson(AE.promptDDBehavior({ unit: u, model: n, version: V, settings, structure: st }), 5000); } catch (_) { b = {}; }
            dd = AE.normalizeDD({ ...(a || {}), ...(b || {}) }, u, n, seed); aiOk++;
          } catch (_) { dd = null; }
        }
        if (!dd) { dd = AE.ruleDD(u, n, seed); ruleN++; }
        const cur = n.units.SW[idx];
        n.units.SW[idx] = { ...cur, dd, designDone: true,
          desc: /TBD/.test(cur.desc || "") || !cur.desc ? dd.summary : cur.desc,
          funcs: (cur.funcs || []).length ? cur.funcs : dd.classes.flatMap(c => c.ops.map(o => ({ ret: o.ret, name: o.name, params: o.params.map(pp => `${pp.type} ${pp.name}`).join(", ") }))) };
        done++;
        setProg({ percent: 5 + (done / targets.length) * 90, label: `${n.useAI ? "AI: " : "규칙: "}상세설계 ${done}/${targets.length} 유닛 완료 — ${u.id} ${u.name}` });
      };
      // 유닛 3개씩 동시 설계 (유닛당 AI 2회 호출 → 92개 유닛이면 순차 처리 시 30분 이상 걸리므로)
      const CONC = n.useAI ? 3 : 20;
      setProg({ percent: 5, label: `${n.useAI ? "AI: " : "규칙: "}상세설계 시작 — ${targets.length}개 유닛 (${CONC}개씩 동시)` });
      for (let i = 0; i < targets.length; i += CONC) await Promise.all(targets.slice(i, i + CONC).map(designOne));
      setModel(n);
      if (targets.length === 1) setDdView({ unit: targets[0].id, kind: "component" });
      return `유닛 ${done}개 상세설계 완료 (AI ${aiOk} · 규칙 ${ruleN}) — 각 유닛의 [다이어그램]에서 7종을 확인하세요. 설계 요소마다 근거 SW 요구 ID가 기록되며, QA 교차검토 대상에 포함됩니다.`;
    });
  }
  // ── SWE.3 코드 생성: 뼈대(파일·RTE·상태 머신)는 결정적, 연산 본문·guard 식은 AI(설계 algo 기준). 결과는 unit.dd.code ──
  function genCode(unitIds = null) {
    const targets = (model.units.SW || []).filter(u => u.dd?.classes?.length && (!unitIds || unitIds.includes(u.id)));
    return run(`소스코드 생성 (${targets.length}개 유닛)`, async () => {
      if (!targets.length) throw new Error("상세설계가 있는 유닛이 없습니다. 먼저 [AI 상세설계 생성]을 실행하세요.");
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      const S = AE.ddSettings(n);
      let done = 0, aiOk = 0;
      const one = async (u) => {
        const idx = n.units.SW.findIndex(x => x.id === u.id); if (idx < 0) return;
        let ai = null;
        if (n.useAI) { try { ai = await callClaudeJson(AE.promptCode({ unit: u, model: n, settings: S, meta: form }), 5000); if (ai && Array.isArray(ai.ops)) aiOk++; else ai = null; } catch (_) { ai = null; } }
        const code = AE.generateCode(u, n, form, S, ai);
        n.units.SW[idx] = { ...n.units.SW[idx], dd: { ...n.units.SW[idx].dd, code } };
        done++;
        setProg({ percent: 5 + (done / targets.length) * 90, label: `${n.useAI ? "AI: " : "규칙: "}코드 ${done}/${targets.length} 유닛 — ${u.id} ${u.name}` });
      };
      const CONC = n.useAI ? 3 : 20;
      for (let i = 0; i < targets.length; i += CONC) await Promise.all(targets.slice(i, i + CONC).map(one));
      setModel(n);
      return `유닛 ${done}개의 ${AE.DD_TARGETS[S.target].label} 소스를 생성했습니다 (연산 본문 AI ${aiOk} · 규칙 ${done - aiOk}). 각 유닛의 [코드]에서 확인하고, MISRA 최종 판정은 ${S.tools.join("·")}로 하세요.`;
    });
  }
  // ── SWE.4 호스트 유닛 시험(SIL): 규칙 케이스 + AI 초안(요구·설계 근거, 규칙으로 거름) → unit.ut / 실행 패키지 ZIP / 결과 가져오기 → model.utRuns ──
  function genUnitTests() {
    const S = AE.ddSettings(model);
    const targets = (model.units.SW || []).filter(u => u.dd?.classes?.length);
    return run(`유닛 시험 케이스 생성 (${targets.length}개 유닛)`, async () => {
      if (!AE.utSupported(S)) throw new Error("호스트 실행은 현재 AUTOSAR Classic(C) 대상만 지원합니다 — Adaptive(C++)는 2단계입니다.");
      if (!targets.length) throw new Error("상세설계가 있는 유닛이 없습니다. SWE.3에서 [AI 상세설계 생성]을 먼저 실행하세요.");
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      let done = 0, aiN = 0, dropN = 0, ruleN = 0;
      const one = async (u) => {
        const idx = n.units.SW.findIndex(x => x.id === u.id); if (idx < 0) return;
        const cur = n.units.SW[idx];
        let kept = [], dropped = [];
        if (n.useAI && (cur.reqs || []).length) {
          try { const raw = await callClaudeJson(AE.promptUnitTests({ unit: cur, model: n }), 3000); const v = AE.validateUnitTests(raw, cur, n); kept = v.kept; dropped = v.dropped; } catch (_) { /* AI 실패 시 규칙 케이스만 */ }
        }
        const ut = AE.buildUnitTestSet(cur, kept, dropped, { aiModel: n.useAI ? "생성 AI(Claude)" : "" });
        aiN += kept.length; dropN += dropped.length; ruleN += ut.cases.length - kept.length;
        n.units.SW[idx] = { ...cur, ut };
        done++;
        setProg({ percent: 5 + (done / targets.length) * 90, label: `${n.useAI ? "AI: " : "규칙: "}유닛 시험 ${done}/${targets.length} — ${u.id} ${u.name}` });
      };
      const CONC = n.useAI ? 3 : 20;
      for (let i = 0; i < targets.length; i += CONC) await Promise.all(targets.slice(i, i + CONC).map(one));
      setModel(n);
      return `유닛 ${done}개 — 케이스 ${ruleN + aiN}건 (규칙 ${ruleN} · AI 초안 ${aiN}${dropN ? ` · 근거 불충분으로 버린 AI 케이스 ${dropN}` : ""}). [📦 실행 패키지 ZIP]을 받아 PC에서 실행하세요.`;
    });
  }
  function downloadHostPkg() {
    try {
      const S = AE.ddSettings(model);
      const pkg = AE.buildHostTestPackage(model, form, S);
      if (!pkg.units.length) { setErr(pkg.note || "상세설계가 있는 유닛이 없습니다. SWE.3 상세설계를 먼저 생성하세요."); return; }
      const blob = new Blob([zipBytes(pkg.files)], { type: "application/zip" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `${String(form?.name || "project").replace(/[\\/:*?"<>|]/g, "_")}_SWE4_호스트시험.zip`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNote(`실행 패키지: 유닛 ${pkg.units.length}개 · 케이스 ${pkg.units.reduce((s, x) => s + x.cases, 0)}건${pkg.skipped.length ? ` · 제외 ${pkg.skipped.length}개(${pkg.skipped.map(x => x.id).join(", ")})` : ""}. 압축을 풀고 run_tests.sh(또는 run_tests.bat)를 실행한 뒤 swe4_results.jsonl을 [실행 결과 가져오기]로 올리세요.`);
    } catch (e) { setErr(`실행 패키지 생성 실패: ${e.message}`); }
  }
  async function importUtResults(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = AE.parseUtResults(text);
      if (!parsed.cases.length && !parsed.builds.length) throw new Error(`결과 줄을 찾지 못했습니다${parsed.bad ? ` (해석 불가 ${parsed.bad}줄)` : ""} — run_tests가 만든 swe4_results.jsonl 파일인지 확인하세요.`);
      const { model: nm, run: r } = AE.applyUtResults(model, parsed, file.name);
      setModel(nm);
      const us = Object.values(r.units);
      setNote(`실행 결과 반영: 유닛 ${us.length}개 (Pass ${us.filter(x => x.result === "Pass").length} · Fail ${us.filter(x => x.result === "Fail").length}) · 케이스 ${r.cases.length}건 중 통과 ${r.cases.filter(c => c.result === "pass").length} — SW 유닛 검증 결과서(SW4106)에 반영됩니다.`);
    } catch (e) { setErr(`실행 결과 가져오기 실패: ${e.message}`); }
  }
  // ── 브라우저 안 실행(설치 불필요): clang(WebAssembly)을 CDN에서 받아 같은 시험 소스를 컴파일·실행 — 코드는 브라우저 밖으로 나가지 않음 ──
  const clangRef = useRef(null);
  const brStop = useRef(false);
  const [brBusy, setBrBusy] = useState(false);
  const [brLoad, setBrLoad] = useState(null);      // { pct, label } 컴파일러 내려받기 진행
  const [brLog, setBrLog] = useState([]);          // [{ kind, unit, text }]
  const [brPick, setBrPick] = useState("all");
  const brLogRef = useRef(null);
  useEffect(() => { if (brLogRef.current) brLogRef.current.scrollTop = brLogRef.current.scrollHeight; }, [brLog]);
  async function loadBrowserCC() {
    if (clangRef.current) return clangRef.current;
    const P = AE.BROWSER_CC;
    const bases = [`https://cdn.jsdelivr.net/npm/${P.pkg}@${P.ver}/gen/`, `https://unpkg.com/${P.pkg}@${P.ver}/gen/`];
    let last = null;
    for (const b of bases) {
      try {
        setBrLoad({ pct: 0, label: `컴파일러 확인 중 — ${new URL(b).host}` });
        const h = await fetch(b + "llvm.core.wasm", { method: "HEAD" });
        if (!h.ok) throw new Error(`${new URL(b).host} 응답 ${h.status}`);
        const mod = await import(/* @vite-ignore */ b + "bundle.js");
        const rc = (args, files, opts = {}) => mod.runClang(args, files, { ...opts, fetchProgress: ev => { const p = ev?.totalLength ? Math.round(ev.doneLength / ev.totalLength * 100) : 0; setBrLoad(p >= 100 ? null : { pct: p, label: `컴파일러 내려받는 중 ${p}% (${Math.round((ev?.doneLength || 0) / 1048576)} / ${Math.round((ev?.totalLength || 0) / 1048576)} MB) — 처음 한 번만` }); } });
        // 예열: 실제 내려받기·컴파일 확인
        await rc(["clang", "--target=wasm32-wasip1", "-O0", "w.c", "-o", "w.wasm"], { "w.c": "int main(void) { return 0; }\n" });
        clangRef.current = { runClang: rc, host: new URL(b).host };
        setBrLoad(null);
        return clangRef.current;
      } catch (e) { last = e; }
    }
    setBrLoad(null);
    throw new Error(`컴파일러를 불러오지 못했습니다 (${last?.message || last}). 사내 방화벽에서 cdn.jsdelivr.net · unpkg.com 접근이 막혀 있으면 gcc 실행 패키지(📦)를 쓰세요.`);
  }
  async function runInBrowser() {
    if (brBusy) return;
    brStop.current = false; setBrBusy(true); setErr(null);
    const push = (x) => setBrLog(l => [...l.slice(-1500), x]);
    setBrLog([{ kind: "info", text: `SPIDer SWE.4 호스트 시험 — 브라우저 안 실행 (${AE.BROWSER_CC.label})` }]);
    try {
      if (!clangRef.current) push({ kind: "info", text: "컴파일러(clang WebAssembly, 약 100MB)를 불러옵니다 — 처음 한 번만 받고 이후에는 브라우저 캐시를 씁니다." });
      const cc = await loadBrowserCC();
      push({ kind: "info", text: `컴파일러 준비 완료 (${cc.host}) — 시험 대상 코드는 이 브라우저 밖으로 전송되지 않습니다.` });
      const S = AE.ddSettings(model);
      const parsed = await AE.runUnitTestsInBrowser(model, form, S, cc.runClang, {
        only: brPick === "all" ? null : [brPick],
        shouldStop: () => brStop.current,
        onLog: l => push(l),
        onProgress: p => setProg({ percent: Math.round(((p.i + (p.phase === "run" ? 0.6 : 0.1)) / p.n) * 100), label: `브라우저 실행 ${p.i + 1}/${p.n} — ${p.unit} ${p.phase === "run" ? "실행" : "컴파일"}` }),
      });
      setProg(null);
      if (!parsed.cases.length && !parsed.builds.length) { push({ kind: "info", text: "실행된 유닛이 없습니다." }); return; }
      const { model: nm, run: r } = AE.applyUtResults(model, parsed, parsed.stopped ? "브라우저 실행(중지됨)" : "브라우저 실행");
      setModel(nm);
      const us = Object.values(r.units);
      const pc = r.cases.filter(c => c.result === "pass").length;
      push({ kind: "summary", text: `${parsed.stopped ? "■ 중지됨 — 실행한 유닛만 반영. " : ""}유닛 ${us.length}개 (Pass ${us.filter(x => x.result === "Pass").length} · Fail ${us.filter(x => x.result === "Fail").length}) · 케이스 ${r.cases.length}건 중 통과 ${pc} — SW 유닛 검증 결과서(SW4106)에 반영했습니다.` });
    } catch (e) { push({ kind: "error", text: e.message }); setProg(null); }
    finally { setBrBusy(false); }
  }
  // ── HWE.2 HW 회로 설계(HD): 블록별 A 회로(부품·넷·연결) → B 특별 특성·분석·근거, 실패·AI 미사용 시 규칙 생성 ──
  function genHD(compIds = null) {
    const targets = (model.comps.HW || []).filter(c => !compIds || compIds.includes(c.id));
    return run(compIds ? `HW 회로 설계 생성 (${targets.length}개 블록)` : "HW 회로 설계 생성 (전체 블록)", async () => {
      if (!targets.length) throw new Error("HW 컴포넌트(회로 블록)가 없습니다. 먼저 HWE.2 HW 설계에서 블록을 만드세요.");
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      const seed = form?.id || form?.name || "project";
      let done = 0, aiOk = 0;
      const one = async (c) => {
        const idx = n.comps.HW.findIndex(x => x.id === c.id); if (idx < 0) return;
        let hd = null;
        if (n.useAI) {
          try {
            const a = await callClaudeJson(AE.promptHDCircuit({ comp: c, model: n }), 5000);
            const circuit = AE.normalizeHD(a, c, n, seed);
            let b = {}; try { b = await callClaudeJson(AE.promptHDAnalysis({ comp: c, model: n, circuit }), 5000); } catch (_) { b = {}; }
            hd = AE.normalizeHD({ ...(a || {}), ...(b || {}) }, c, n, seed); aiOk++;
          } catch (_) { hd = null; }
        }
        if (!hd) hd = AE.ruleHD(c, n, seed);
        n.comps.HW[idx] = { ...n.comps.HW[idx], hd };
        done++;
        setProg({ percent: 5 + (done / targets.length) * 90, label: `${n.useAI ? "AI: " : "규칙: "}회로 설계 ${done}/${targets.length} 블록 — ${c.id} ${c.name}` });
      };
      const CONC = n.useAI ? 3 : 20;
      for (let i = 0; i < targets.length; i += CONC) await Promise.all(targets.slice(i, i + CONC).map(one));
      setModel(n);
      if (targets.length === 1) setHdView({ comp: targets[0].id, kind: "schematic" });
      return `HW 블록 ${done}개 회로 설계 완료 (AI ${aiOk} · 규칙 ${done - aiOk}) — 부품 PN은 후보입니다. 회로도·BOM·특별 특성·분석 결과는 ZIP의 HW 상세설계서(04-53)·BOM(14-54)·특별 특성(17-57)·분석 결과(15-51)로 생성됩니다.`;
    });
  }
  function derive(level, only = null) {
    return run(only ? `${level} 요구 파생 (빠진 ${only.length}건만)` : `${level} 요구사항 파생`, async () => {
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      const parents = AE.parentsForLevel(n, level);
      if (only) {
        const want = new Set(only);
        const todo0 = parents.filter(p => want.has(p.id) && !n.reqs[level].some(r => (r.parents || []).includes(p.id)));
        if (!todo0.length) return "빠진 상위 요구가 없습니다 — 이미 모두 파생되어 있습니다.";
        const out0 = [...n.reqs[level]], added = [];
        const names0 = sysCompName();
        for (let i = 0; i < todo0.length; i += 5) {
          const grp = todo0.slice(i, i + 5);
          setProg({ percent: 5 + (i / todo0.length) * 90, label: `${n.useAI ? "AI: " : ""}${level} 요구 파생 중… (${Math.min(i + 5, todo0.length)}/${todo0.length})` });
          let got = [];
          if (n.useAI) { try { const r = await callClaudeJson(AE.promptDerive({ level, parents: grp, sysCompName: names0, version: V }), 5000); got = Array.isArray(r?.items) ? r.items : []; } catch (_) {} }
          grp.forEach(p => {
            const mine = got.filter(x => x?.parent === p.id && String(x.text || x.title || "").trim());
            if (!mine.length) {   // AI 미사용·누락분은 상위 요구를 상속한 초안으로
              const tmp = AE.ruleDeriveReqs({ ...n, reqs: { ...n.reqs, [level]: [] } }, level).filter(r => (r.parents || []).includes(p.id));
              tmp.forEach(t => { const x = { ...t, id: AE.nextId(AE.REQ_PREFIX[level], out0, 4) }; out0.push(x); added.push(x.id); });
              return;
            }
            mine.slice(0, 3).forEach(x => {
              const base = { title: String(x.title || "").slice(0, 60), text: String(x.text || ""), type: ["기능", "비기능", "인터페이스"].includes(x.type) ? x.type : p.type };
              const r = { id: AE.nextId(AE.REQ_PREFIX[level], out0, 4), level, parents: [p.id], sysElems: p.elems, ...base, priority: p.priority,
                verifMethod: AE.defaultVerifMethod(base), verifCriteria: String(x.verifCriteria || ""), safety: p.safety || "", security: !!p.security, status: "Draft", origin: "ai" };
              out0.push(r); added.push(r.id);
            });
          });
        }
        n.reqs[level] = out0;
        setModel(n);
        setFocus(null);
        return `${todo0.map(p => p.id).join(", ")}에서 ${level} 요구 ${added.length}건(${added.join(", ")})을 추가했습니다 — 기존 요구·할당은 그대로입니다. 새 요구 아래 '할당 →'에서 담당 ${AE.LEVELS[level].compLabel}를 눌러 지정하세요.`;
      }
      if (!parents.length) throw new Error(`${level} 포함 시스템 요소(구분 ${level === "SW" ? "SW·HW+SW" : "HW·HW+SW"})에 할당된 시스템 요구가 없습니다. SYS.3 시스템 구조에서 요소 구분과 할당을 먼저 확인하세요.`);
      if (!n.useAI) { n.reqs[level] = AE.ruleDeriveReqs(n, level); setModel(n); return `규칙 기반: 상위 요구 ${parents.length}건을 상속한 ${level} 요구 초안 생성 — ${level} 관점으로 구체화하세요.`; }
      const keep = n.reqs[level].filter(r => r.origin === "manual");
      const out = [...keep];
      const names = sysCompName();
      const todo = parents.filter(p => !keep.some(k => (k.parents || []).includes(p.id)));
      for (let i = 0; i < todo.length; i += 5) {
        const grp = todo.slice(i, i + 5);
        setProg({ percent: 5 + (i / todo.length) * 90, label: `AI: ${level} 요구 파생 중… (${Math.min(i + 5, todo.length)}/${todo.length})` });
        let got = [];
        try { const r = await callClaudeJson(AE.promptDerive({ level, parents: grp, sysCompName: names, version: V }), 5000); got = Array.isArray(r?.items) ? r.items : []; } catch (_) {}
        grp.forEach(p => {
          const mine = got.filter(x => x?.parent === p.id && String(x.text || x.title || "").trim());
          if (!mine.length) {   // AI 누락분은 상속 초안으로 채워 추적 단절을 막는다
            const tmp = AE.ruleDeriveReqs({ ...n, reqs: { ...n.reqs, [level]: out }, comps: n.comps, alloc: n.alloc }, level).filter(r => (r.parents || []).includes(p.id) && !out.some(o => o.id === r.id));
            tmp.forEach(t => out.push({ ...t, id: AE.nextId(AE.REQ_PREFIX[level], out, 4) }));
            return;
          }
          mine.slice(0, 3).forEach(x => {
            const base = { title: String(x.title || "").slice(0, 60), text: String(x.text || ""), type: ["기능", "비기능", "인터페이스"].includes(x.type) ? x.type : p.type };
            out.push({ id: AE.nextId(AE.REQ_PREFIX[level], out, 4), level, parents: [p.id], sysElems: p.elems, ...base, priority: p.priority,
              verifMethod: AE.defaultVerifMethod(base), verifCriteria: String(x.verifCriteria || ""), safety: p.safety || "", security: !!p.security, status: "Draft", origin: "ai" });
          });
        });
      }
      n.reqs[level] = out;
      // 할당은 새 요구 기준으로 다시 — 기존 할당 중 사라진 요구는 정리
      Object.keys(n.alloc[level]).forEach(k => { if (!out.some(r => r.id === k)) delete n.alloc[level][k]; });
      setModel(n);
      return `${level} 요구 ${out.length}건 (상위 ${parents.length}건 기준)`;
    });
  }

  // ── SWE.2 / HWE.2: 컴포넌트 설계 + 할당 ──
  function compose(level) {
    return run(`${AE.LEVELS[level].compLabel} 설계`, async () => {
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      if (!n.reqs[level].length) throw new Error(`${level} 요구사항이 없습니다. 먼저 요구를 파생하세요.`);
      if (!n.useAI) { const r = AE.ruleComponents(n, level); n.comps[level] = r.comps; n.alloc[level] = r.alloc; n.interfaces[level] = []; setModel(n); return `규칙 기반: 시스템 요소별 ${level} 컴포넌트 ${r.comps.length}개 초안`; }
      const want = level === "SW" ? AE.elemHasSW : AE.elemHasHW;
      const sysElems = n.comps.SYS.filter(want);
      setProg({ percent: 10, label: `AI: ${AE.LEVELS[level].compLabel} 구조 설계 중…` });
      const res = await callClaudeJson(AE.promptComponents({ level, reqs: n.reqs[level], sysElems, version: V }), 3500);
      const a = AE.applyArchResult(level, res, n.comps[level]);
      const sysIds = new Set(sysElems.map(e => e.id));
      a.comps.forEach(c => { if (!sysIds.has(c.sysElem)) c.sysElem = ""; });
      n.comps[level] = a.comps; n.interfaces[level] = a.interfaces; if (a.rationale) n.rationale[level] = a.rationale;
      n.alloc[level] = {};
      const ids = new Set(a.comps.map(c => c.id));
      const rs = n.reqs[level];
      for (let i = 0; i < rs.length; i += 10) {
        setProg({ percent: 30 + (i / rs.length) * 65, label: `AI: ${level} 요구 → 컴포넌트 할당 중… (${Math.min(i + 10, rs.length)}/${rs.length})` });
        try {
          const r = await callClaudeJson(AE.promptAllocate({ level, reqs: rs.slice(i, i + 10), comps: a.comps }), 3000);
          (r?.items || []).forEach(x => { if (x?.id) n.alloc[level][x.id] = (x.comps || []).filter(c => ids.has(c)); });
        } catch (_) {}
      }
      setModel(n);
      return `${AE.LEVELS[level].compLabel} ${a.comps.length}개 · 인터페이스 ${a.interfaces.length}건`;
    });
  }

  // ── 검증 수단: 규칙(경계값·타이밍·결함주입·인터페이스) + AI(정상 시나리오 서술) ──
  function genTests(levels) {
    return run("검증 수단 생성", async () => {
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      const lv = levels.filter(L => n.scope[AE.TEST_LEVELS[L].level]);
      if (n.useAI) {
        // 기존 AI TC는 대상 요구가 남아 있는 것만 유지하고, 새로 서술할 요구만 호출
        const aiTests = n.tests.filter(t => t.origin === "ai" && lv.includes(t.level));
        n.tests = n.tests.filter(t => !(t.origin === "ai" && lv.includes(t.level)));
        const reqLevels = lv.filter(L => AE.TEST_LEVELS[L].targetKind === "req");
        const jobs = [];
        reqLevels.forEach(L => {
          const rs = n.reqs[AE.TEST_LEVELS[L].level].filter(r => ["Test", "Measurement", "Demonstration"].includes(r.verifMethod || "Test"));
          for (let i = 0; i < rs.length; i += 5) jobs.push({ L, grp: rs.slice(i, i + 5) });
        });
        const fresh = [];
        for (let j = 0; j < jobs.length; j++) {
          const { L, grp } = jobs[j];
          setProg({ percent: 5 + (j / Math.max(1, jobs.length)) * 85, label: `AI: ${AE.TEST_LEVELS[L].label} 정상 시나리오 서술 중… (${j + 1}/${jobs.length})` });
          try {
            const r = await callClaudeJson(AE.promptTests({ testLevel: L, reqs: grp, version: V }), 5000);
            (r?.items || []).forEach(x => {
              const tgt = grp.find(g => g.id === x?.target); if (!tgt) return;
              fresh.push({ level: L, targets: [tgt.id], origin: "ai", regression: tgt.priority === "상" || !!tgt.safety, title: String(x.title || `${tgt.title} — 정상 동작`).slice(0, 80),
                technique: "요구사항 기반(블랙박스)", precondition: String(x.precondition || ""), steps: String(x.steps || ""), expected: String(x.expected || ""), passCriteria: String(x.passCriteria || tgt.verifCriteria || ""), env: String(x.env || "") });
            });
          } catch (_) { /* 실패 청크는 규칙 정상동작 TC로 대체됨 */ }
        }
        const keepAi = aiTests.filter(t => !fresh.some(f => (f.targets || [])[0] === (t.targets || [])[0] && f.level === t.level));
        n.tests = [...n.tests, ...keepAi, ...fresh.map(t => ({ ...t, id: "" }))];
        // AI TC에 ID 부여 후 규칙 TC와 병합
        const withIds = [];
        n.tests.forEach(t => { if (t.id) withIds.push(t); else withIds.push({ ...t, id: AE.nextId(AE.TEST_LEVELS[t.level].prefix, withIds.filter(x => x.level === t.level), 4) }); });
        n.tests = withIds;
      }
      n.tests = AE.generateRuleTests(n, lv);
      setModel(n);
      const cnt = lv.map(L => `${AE.TEST_LEVELS[L].proc} ${n.tests.filter(t => t.level === L).length}`).join(" · ");
      return `검증 수단 생성 완료 — ${cnt}`;
    });
  }

  // ── DBC 가져오기 ──
  async function onDbc(e) {
    const f = (e.target.files || [])[0]; e.target.value = "";
    if (!f) return;
    try {
      const parsed = AE.parseDbc(await f.text());
      if (!parsed.messages.length) throw new Error("메시지(BO_)를 찾지 못했습니다.");
      setDbc({ fileName: f.name, parsed, own: parsed.nodes[0] || "" });
    } catch (x) { setErr(`DBC 해석 실패: ${x.message}`); }
  }
  // ── SWE.3 유닛 골격 (AI 미사용): 규칙 분해 / C 헤더 가져오기 ──
  function genUnits() {
    return run("SW 유닛 골격 생성", async () => {
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      n.units.SW = AE.ruleUnits(n);
      n.tests = AE.generateRuleTests(n, ["SWE4"]);
      setModel(n);
      return `규칙 기반 유닛 골격 ${n.units.SW.length}개 · SWE.4 유닛 검증 틀 ${n.tests.filter(t => t.level === "SWE4").length}건 — 알고리즘·동적 동작은 TBD (코드 확정 후 작성)`;
    });
  }
  async function onHeaders(e) {
    const files = [...(e.target.files || [])]; e.target.value = "";
    if (!files.length) return;
    try {
      const n = AE.normalizeModel(JSON.parse(JSON.stringify(model)));
      let fn = 0;
      for (const f of files) {
        const parsed = AE.parseCHeader(await f.text(), f.name);
        if (!parsed.funcs.length && !parsed.types.length) continue;
        // 컴포넌트 자동 매칭: 파일명 토큰이 컴포넌트명에 포함되면 그 컴포넌트, 아니면 첫 컴포넌트
        const tok = parsed.name.toLowerCase().split(/[_\-\s]+/).filter(t => t.length > 2);
        const comp = n.comps.SW.find(c => tok.some(t => String(c.name || "").toLowerCase().includes(t))) || n.comps.SW[0];
        n.units.SW = AE.unitsFromHeader(n, parsed, comp?.id || "");
        fn += parsed.funcs.length;
      }
      n.tests = AE.generateRuleTests(n, ["SWE4"]);
      setModel(n); setErr(null);
      setNote(`헤더 ${files.length}개에서 유닛 인터페이스를 가져왔습니다 — 함수 ${fn}개 (코드가 근거 · AI 미사용). 컴포넌트·할당 요구를 확인하세요.`);
    } catch (x) { setErr(`헤더 해석 실패: ${x.message}`); }
  }
  function applyDbc() {
    if (!dbc?.own) return;
    const { reqs, itfs } = AE.dbcToInterfaces(dbc.parsed, dbc.own, { fileName: dbc.fileName });
    if (!reqs.length) { setErr(`노드 '${dbc.own}'가 송수신하는 메시지가 없습니다.`); return; }
    // 이미 가져온 메시지(같은 메시지명·방향)는 중복 추가하지 않음
    const exists = new Set(items.filter(i => i._dbc).map(i => `${i._dbc.msg}|${i._dbc.tx}`));
    const add = reqs.filter(r => !exists.has(`${r._dbc.msg}|${r._dbc.tx}`));
    const newItems = assignReqIds([...items, ...add], reqIdFloor(requirements));
    setItems(newItems);
    setItemsVer(v => v + 1);
    set(n => {
      n.reqs.SYS = AE.syncSysReqs(newItems, n.reqs.SYS);
      let comm = n.comps.SYS.find(c => c.origin === "dbc" && c.kind !== "외부");
      if (!comm) { comm = { id: AE.nextId("SYE-", n.comps.SYS), name: "차량 통신부", kind: "HW+SW", desc: `차량 네트워크 송수신 (${dbc.fileName})`, behavior: "", origin: "dbc" }; n.comps.SYS.push(comm); }
      const peers = [...new Set(itfs.flatMap(i => String(i.peer).split(/,\s*/)).filter(Boolean))];
      peers.forEach(p => { if (!n.comps.SYS.some(c => c.name === `${p} (외부)`)) n.comps.SYS.push({ id: AE.nextId("SYE-", n.comps.SYS), name: `${p} (외부)`, kind: "외부", desc: "시스템 경계 밖 상대 노드 (DBC)", behavior: "", origin: "dbc" }); });
      const idOf = Object.fromEntries(n.comps.SYS.map(c => [c.name, c.id]));
      itfs.forEach(i => {
        if (n.interfaces.SYS.some(x => x.origin === "dbc" && x.msg === i.msg && x.dir === i.dir)) return;
        String(i.peer).split(/,\s*/).filter(Boolean).forEach(p => {
          const pid = idOf[`${p} (외부)`]; if (!pid) return;
          n.interfaces.SYS.push({ id: AE.nextId("SIF-", n.interfaces.SYS), from: i.dir === "TX" ? comm.id : pid, to: i.dir === "TX" ? pid : comm.id, kind: "CAN", signals: `${i.msg}(${i.msgId}): ${i.signals}`, periodMs: i.periodMs, desc: `${i.dir} · DLC ${i.dlc}`, origin: "dbc", msg: i.msg, dir: i.dir });
        });
      });
      newItems.filter(x => x._dbc).forEach(x => { if (!(n.alloc.SYS[x.id] || []).length) n.alloc.SYS[x.id] = [comm.id]; });
      n.inputs.in_dbc = "have";
    });
    setNote(`DBC '${dbc.fileName}' — 노드 ${dbc.own} 기준 인터페이스 요구 ${add.length}건 추가${reqs.length - add.length ? ` (중복 ${reqs.length - add.length}건 제외)` : ""}. 저장 시 시스템 요구사항 명세서·인터페이스 정의서에도 반영됩니다.`);
    setDbc(null);
  }

  // ── 템플릿 WP 충족도 점검 (docx 업로드 또는 OSSP 등록 템플릿) ──
  async function checkTemplateBytes(bytes, fileName) {
    const text = await docxOutlineText(bytes);
    const r = AE.checkTemplateCoverage(text, tplGroup, V);
    set(n => { n.templateChecks[tplGroup] = { fileName, mode: r.mode, outline: r.outlineCount, hits: Object.fromEntries(r.items.map(x => [x.id, x.hit])), at: new Date().toISOString() }; });
    const miss = r.items.filter(x => !x.hit && x.origin === "ASPICE");
    setNote(`템플릿 '${fileName}' 점검 (${r.mode === "outline" ? `목차·항목 라벨 ${r.outlineCount}줄 기준` : "본문 기준"}) — ASPICE 특성 ${r.items.filter(x => x.origin === "ASPICE").length}개 중 누락 ${miss.length}개${miss.length ? ": " + miss.slice(0, 6).map(x => x.label).join(", ") + (miss.length > 6 ? " 외" : "") : ""}`);
  }
  async function onTplFile(e) {
    const f = (e.target.files || [])[0]; e.target.value = "";
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) { setErr("템플릿 점검은 .docx만 지원합니다 (.doc은 Word에서 docx로 저장 후 업로드)."); return; }
    try { await checkTemplateBytes(new Uint8Array(await f.arrayBuffer()), f.name); } catch (x) { setErr("템플릿 점검 실패: " + x.message); }
  }
  async function checkOsspTemplate() {
    const title = AE.ASPICE_DOCS[tplGroup === "VERIF" ? "V_SYS5" : tplGroup]?.title;
    try {
      const dbId = await resolveOsspDbId(ossp);
      let tpl = dbId ? findTemplateFor(title, await fetchOsspTemplates(dbId)) : null;
      if (!tpl) tpl = findTemplateFor(title, await fetchOsspTemplates(null));
      if (!tpl) { setErr(`OSSP 라이브러리에 '${title}' 템플릿이 없습니다. 파일을 직접 업로드하세요.`); return; }
      if (!/\.docx$/i.test(tpl.file_name)) { setErr(`등록 템플릿 '${tpl.file_name}'은 docx가 아니어서 점검할 수 없습니다.`); return; }
      const bytes = await fetchTemplateBytes(tpl);
      if (!bytes) throw new Error("템플릿 다운로드 실패");
      await checkTemplateBytes(bytes, tpl.file_name);
    } catch (x) { setErr("OSSP 템플릿 점검 실패: " + x.message); }
  }

  function save(quiet) {
    // 저장 시: 이번 세션에 새로 생긴 연결만 기준선 등록 (미해결 '변경 검토 필요' 연결은 그대로 유지), 사라진 연결 기록 정리
    const out = { ...AE.baselineLinks({ ...model, reqs: { ...model.reqs, STK: AE.syncStkReqs(requirements?.stk?.items || [], model.reqs.STK), SYS: AE.syncSysReqs(items, model.reqs.SYS) } }), updatedAt: new Date().toISOString() };
    setRequirements({ ...(requirements || {}), items, aspice: out, idRegistry: nextIdRegistry(requirements, items), updatedAt: requirements?.updatedAt || new Date().toISOString(),
      ...(srcRef.current ? { source: srcRef.current, sourceName: srcRef.current.files?.length ? srcRef.current.files.map(f => f.name).join(", ") : (requirements?.sourceName || "직접 입력") } : {}) });
    // 저장해도 창은 닫지 않는다(작업 계속). 화면 모델도 저장본(기준선 등록 반영)과 같게 맞춘다.
    setModel(out);
    savedSig.current = aeSig(out, items);
    setErr(null);
    const hm = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    setNote(quiet === "review"
      ? `검토 AI 결과를 자동 저장했습니다 (${hm}) — 브라우저 임시저장본에도 보관됩니다. 서버 저장은 위저드 마지막 단계의 '완료'에서 합니다.`
      : `저장했습니다 (${hm}) — 프로젝트에 반영하고 브라우저 임시저장본에도 보관했습니다. 서버(DB) 저장은 위저드 마지막 단계의 '완료'에서 합니다.`);
  }
  // 검토 AI 결과는 호출 비용·시간이 크므로 실행이 끝나면 자동 저장한다 (모델 반영이 끝난 다음 렌더에서 실행)
  const [autoSaveTick, setAutoSaveTick] = useState(0);
  useEffect(() => { if (autoSaveTick) save("review"); }, [autoSaveTick]);   // eslint-disable-line react-hooks/exhaustive-deps
  // 저장되지 않은 변경 감지 — 마지막 저장(또는 창을 연 시점) 상태와 비교
  const savedSig = useRef(null);
  if (savedSig.current === null) savedSig.current = aeSig(model, items);
  const dirty = React.useMemo(() => aeSig(model, items) !== savedSig.current, [model, items]);
  // 저장 안 된 변경이 있으면 새로고침·탭 닫기 전에 브라우저가 확인을 묻는다
  useEffect(() => {
    if (!dirty) return;
    const h = e => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  // 닫기(✕·닫기 버튼·바깥 클릭) — 저장 안 된 변경이 있으면 확인
  function requestClose() {
    if (dirty && !window.confirm("저장하지 않은 변경 내용이 있습니다.\n저장하지 않고 닫을까요?\n\n(취소를 누르면 창으로 돌아갑니다)")) return;
    onClose();
  }
  // 바깥(어두운 배경) 클릭으로 닫기: 누른 곳과 뗀 곳이 모두 배경일 때만 — 입력란에서 드래그하다 바깥에서 놓아 닫히는 것 방지
  const downOnBackdrop = useRef(false);
  // ── ① 요구 도출·명세 탭에서 확정: 변경 전 기준선 등록 → 새 요구로 동기화 → 즉시 저장 ──
  function confirmReqs(meta) {
    const base = AE.baselineLinks(model);
    const next = { ...base, reqs: { ...base.reqs, STK: AE.syncStkReqs(meta.stk?.items || requirements?.stk?.items || [], base.reqs.STK), SYS: AE.syncSysReqs(meta.items, base.reqs.SYS) }, updatedAt: new Date().toISOString() };
    const st = AE.linkStatus(next);
    setModel(next);
    setItems(meta.items);
    setRequirements({ ...(requirements || {}), ...meta, aspice: next });
    savedSig.current = aeSig(next, meta.items);
    setErr(null);
    setNote(`${meta.stk?.items?.length ? `이해관계자 요구 ${meta.stk.items.length}건 · ` : ""}시스템 요구 ${meta.items.length}건을 확정·저장했습니다.${st.open.length ? ` 변경된 요구의 하위 연결 ${st.open.length}건은 점검·QA › 빠진 곳 점검의 '변경 영향 검토'에서 확인하세요.` : " 다음은 SYS.3 시스템 구조에서 아키텍처를 작성하세요."}`);
  }
  // ── 변경 영향 검토: 유효/무효 판정 · 고아 연결 제거 ──
  const [reviewNote, setReviewNote] = useState({});   // { 상위ID: 판정 의견 }
  const [showLog, setShowLog] = useState(false);
  const lstat = AE.linkStatus(model);
  function judge(up, keys, state) {
    const note = String(reviewNote[up] || "").trim();
    if (state === "invalid" && !note) { setErr("무효 판정에는 의견(필요한 조치)을 입력해 주세요."); return; }
    setErr(null);
    setModel(m => AE.resolveLinks(m, keys, state, note));
  }
  function dropLinks(up, keys) {
    setErr(null);
    setModel(m => AE.removeLinks(m, keys, String(reviewNote[up] || "").trim() || "상위 요구 삭제에 따른 연결 제거"));
  }
  async function downloadPkg() {
    try { const ctx = { requirements: { ...(requirements || {}), items, aspice: model }, ossp, tailoring }; const n = await downloadAspicePackage(form || {}, ctx); setNote(`ASPICE 산출물 ${n}건 ZIP 다운로드를 시작했습니다.`); }
    catch (x) { setErr(x.message); }
  }

  // ── 편집 UI 조각 ──
  const updReq = (lv, i, k, v) => set(n => { n.reqs[lv][i] = { ...n.reqs[lv][i], [k]: v, ...(k === "verifCriteria" && lv === "SYS" ? { verifCriteriaEdited: true } : {}) }; });
  const toggleAlloc = (lv, rid, cid) => set(n => { const a = new Set(n.alloc[lv][rid] || []); a.has(cid) ? a.delete(cid) : a.add(cid); n.alloc[lv][rid] = [...a]; });
  const AllocChips = ({ lv, rid }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {model.comps[lv].filter(c => c.kind !== "외부").map(c => { const on = (model.alloc[lv][rid] || []).includes(c.id); return (
        <button key={c.id} onClick={() => toggleAlloc(lv, rid, c.id)} title={c.desc}
          style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentDim : "transparent", color: on ? T.text : T.muted }}>{c.name}</button>); })}
      {!model.comps[lv].length && <span style={{ fontSize: 10, color: T.muted }}>요소 없음</span>}
    </div>
  );
  const ReqList = ({ lv }) => {
    const rs = model.reqs[lv];
    const shown = new Set(applyFocus(rs).map(r => r.id));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rs.map((r, i) => shown.has(r.id) && (
          <div key={r.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", background: T.surface }}>
            <div style={{ display: "grid", gridTemplateColumns: "74px 1fr 104px 96px 30px 40px", gap: 6, alignItems: "center" }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>{r.id}</span>
              {lv === "SYS" ? <span style={{ fontSize: 11 }}>{r.title} <span style={{ color: T.muted, fontSize: 10 }}>· {r.type}</span></span>
                : <input value={r.title || ""} onChange={e => updReq(lv, i, "title", e.target.value)} style={inp} />}
              <select value={r.verifMethod || "Test"} onChange={e => updReq(lv, i, "verifMethod", e.target.value)} style={inp} title="검증 방법 (4.0 08-60: test·measurement·analysis·inspection·review…)">
                {AE.VERIF_METHODS.map(x => <option key={x}>{x}</option>)}
              </select>
              <select value={r.status || "Draft"} onChange={e => updReq(lv, i, "status", e.target.value)} style={inp}>{ASPICE_STATUS.map(x => <option key={x}>{x}</option>)}</select>
              <AeFlags r={r} />
              <button onClick={() => setOpen(o => ({ ...o, [lv + r.id]: !o[lv + r.id] }))} style={{ ...small, color: T.muted, padding: "2px 0" }}>{open[lv + r.id] ? "접기" : "상세"}</button>
            </div>
            <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 9.5, color: T.muted, flexShrink: 0 }}>할당 →</span>{AllocChips({ lv, rid: r.id })}
            </div>
            {open[lv + r.id] && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                <div><div style={{ fontSize: 10, color: T.muted }}>요구 내용{lv === "SYS" ? " (요구사항 AI 작성에서 수정)" : ""}</div>
                  {lv === "SYS" ? <div style={{ fontSize: 10.5, lineHeight: 1.5 }}>{r.text}</div> : <textarea value={r.text || ""} onChange={e => updReq(lv, i, "text", e.target.value)} style={ta} />}</div>
                <div><div style={{ fontSize: 10, color: T.muted }}>검증 기준 (3.1 17-50 / 4.0 verifiable)</div><textarea value={r.verifCriteria || ""} onChange={e => updReq(lv, i, "verifCriteria", e.target.value)} style={ta} /></div>
                <div><div style={{ fontSize: 10, color: T.muted }}>안전 등급 (ISO 26262 대상 시)</div>
                  <select value={r.safety || ""} onChange={e => updReq(lv, i, "safety", e.target.value)} style={inp}>{["", "QM", "ASIL A", "ASIL B", "ASIL C", "ASIL D"].map(x => <option key={x} value={x}>{x || "-"}</option>)}</select></div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", fontSize: 10.5 }}>
                  <label><input type="checkbox" checked={!!r.security} onChange={e => updReq(lv, i, "security", e.target.checked)} /> 보안 관련</label>
                  {lv === "SYS" && <label title="4.0 17-57 (IATF 16949)"><input type="checkbox" checked={!!r.special} onChange={e => updReq(lv, i, "special", e.target.checked)} /> 특별 특성</label>}
                  {lv !== "SYS" && <span style={{ color: T.muted }}>상위: {(r.parents || []).join(", ") || "없음"}</span>}
                  {lv !== "SYS" && <button onClick={() => set(n => { n.reqs[lv] = n.reqs[lv].filter(x => x.id !== r.id); delete n.alloc[lv][r.id]; })} style={{ ...small, color: T.red, marginLeft: "auto" }}>삭제</button>}
                </div>
                {AE.qualityFlags(r).length > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 10, color: T.amber }}>품질 점검: {AE.qualityFlags(r).map(x => x.msg).join(" · ")}</div>}
              </div>
            )}
          </div>
        ))}
        {!rs.length && <div style={{ fontSize: 11, color: T.muted, padding: 8 }}>요구 없음</div>}
      </div>
    );
  };
  const CompList = ({ lv }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {model.comps[lv].map((c, i) => (
        <div key={c.id} style={{ display: "grid", gridTemplateColumns: "64px 150px 100px 1fr 1fr 22px", gap: 5, alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>{c.id}</span>
          <input value={c.name} onChange={e => set(n => { n.comps[lv][i].name = e.target.value; })} style={inp} />
          <select value={c.kind} onChange={e => set(n => { n.comps[lv][i].kind = e.target.value; })} style={inp}>{AE.COMP_KINDS[lv].map(k => <option key={k}>{k}</option>)}</select>
          <input value={c.desc || ""} onChange={e => set(n => { n.comps[lv][i].desc = e.target.value; })} placeholder="책임" style={inp} />
          <input value={c.behavior || ""} onChange={e => set(n => { n.comps[lv][i].behavior = e.target.value; })} placeholder="거동(동적 측면)" style={inp} />
          <button onClick={() => set(n => { n.comps[lv] = n.comps[lv].filter(x => x.id !== c.id); Object.keys(n.alloc[lv]).forEach(k => { n.alloc[lv][k] = (n.alloc[lv][k] || []).filter(x => x !== c.id); }); n.interfaces[lv] = n.interfaces[lv].filter(x => x.from !== c.id && x.to !== c.id); })} style={{ background: "none", border: "none", color: T.red, cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <button onClick={() => set(n => { n.comps[lv].push({ id: AE.nextId(AE.LEVELS[lv].compPrefix, n.comps[lv]), name: "", kind: AE.COMP_KINDS[lv][0], desc: "", behavior: "", origin: "manual" }); })} style={{ ...small, alignSelf: "flex-start" }}>＋ {AE.LEVELS[lv].compLabel} 추가</button>
    </div>
  );
  const IfList = ({ lv }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {model.interfaces[lv].map((x, i) => (
        <div key={x.id} style={{ display: "grid", gridTemplateColumns: "60px 130px 130px 90px 1fr 60px 22px", gap: 5, alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>{x.id}</span>
          {["from", "to"].map(k => <select key={k} value={x[k]} onChange={e => set(n => { n.interfaces[lv][i][k] = e.target.value; })} style={inp}>
            <option value="">{k === "from" ? "From" : "To"}</option>{model.comps[lv].map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
          <input value={x.kind || ""} onChange={e => set(n => { n.interfaces[lv][i].kind = e.target.value; })} placeholder="유형" style={inp} />
          <input value={x.signals || ""} onChange={e => set(n => { n.interfaces[lv][i].signals = e.target.value; })} placeholder="신호·데이터" style={inp} />
          <input value={x.periodMs || ""} onChange={e => set(n => { n.interfaces[lv][i].periodMs = e.target.value.replace(/[^\d.]/g, ""); })} placeholder="주기ms" style={inp} />
          <button onClick={() => set(n => { n.interfaces[lv] = n.interfaces[lv].filter(y => y.id !== x.id); })} style={{ background: "none", border: "none", color: T.red, cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <button onClick={() => set(n => { n.interfaces[lv].push({ id: AE.nextId(lv === "SYS" ? "SIF-" : lv === "SW" ? "SWIF-" : "HWIF-", n.interfaces[lv]), from: "", to: "", kind: "", signals: "", periodMs: "", desc: "", origin: "manual" }); })} style={{ ...small, alignSelf: "flex-start" }}>＋ 인터페이스 추가</button>
    </div>
  );
  const aiLabel = model.useAI ? "⚡ AI" : "⚙ 규칙";
  const pctBar = (label, v) => (
    <div key={label} style={{ display: "grid", gridTemplateColumns: "150px 1fr 40px", gap: 8, alignItems: "center", fontSize: 10.5 }}>
      <span style={{ color: T.muted }}>{label}</span>
      <div style={{ height: 6, background: T.subtle, borderRadius: 3 }}><div style={{ width: `${v ?? 0}%`, height: 6, borderRadius: 3, background: v === 100 ? T.green : v >= 70 ? T.amber : T.red }} /></div>
      <span style={{ textAlign: "right", color: v == null ? T.muted : T.text }}>{v == null ? "-" : `${v}%`}</span>
    </div>
  );
  // ── 검토 대상 수정 편집기 — ⑧ 교차검토(③ 의견·① 규칙 결과)와 ⑦ 일관성 점검에서 함께 사용 ──
  // 검토 대상 수정 편집기 (③ 의견 행과 ① 규칙 검사 결과에서 함께 사용) — rvEdit.key(검토 범위)·id 기준
  const editorBoxC = (suggestion) => {
    const sp = rvEdit && AE.reviewEditSpec(model, rvEdit.key, rvEdit.id);
    if (!sp) return null;
    return (
      <div style={{ border: `1px solid ${T.accent}66`, borderRadius: 8, padding: 10, background: T.accent + "0A" }}>
        <div style={{ fontSize: 11, marginBottom: 6 }}><b>{rvEdit.id}</b> 수정 {suggestion && <span style={{ color: T.green }}>— 제안: {suggestion}</span>}</div>
        {(() => { const S = AE.reviewScope(rvEdit.key); if (S?.kind !== "req") return null;
          const src = (AE.reviewItems(model, rvEdit.key).find(it => it.id === rvEdit.id) || {}).src || {};
          const fl = AE.qualityFlags({ ...src, title: rvEdit.vals.title ?? src.title, text: rvEdit.vals.text ?? src.text, verifCriteria: rvEdit.vals.verifCriteria ?? src.verifCriteria });
          return <div style={{ fontSize: 10.5, marginBottom: 6, color: fl.length ? T.amber : T.green }}>규칙 판정(입력 즉시 반영): {fl.length ? fl.map(x => x.msg).join(" · ") : "✓ 품질 플래그 없음 — 적용하면 경고가 사라집니다"}</div>; })()}
        {rvEdit.msg && <div style={{ fontSize: 10.5, color: T.amber, marginBottom: 6 }}>⚠ {rvEdit.msg}</div>}
        {rvEdit.aiDraft && <div style={{ fontSize: 10.5, color: T.accent, marginBottom: 6, padding: "6px 8px", background: T.accent + "12", borderRadius: 6 }}>✦ AI 수정안 초안이 채워져 있습니다(의견 {rvEdit.aiDraft.opinions}건 반영). <b>적용 전에 내용을 확인하세요</b> — 원문에 없는 수치는 'TBD(확인 필요)'로 들어옵니다.{rvEdit.aiDraft.rationale ? <div style={{ color: T.muted, marginTop: 2 }}>변경 이유: {rvEdit.aiDraft.rationale}</div> : null}</div>}
        {sp.fields.map(fd => (
          <div key={fd.k} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
            <span style={{ width: 120, flexShrink: 0, fontSize: 10.5, color: T.muted, paddingTop: 5 }}>{fd.label}{fd.sysItem && <div style={{ fontSize: 9.5 }}>(확정 요구에 반영)</div>}
              {rvEdit.aiDraft && fd.k in rvEdit.aiDraft.fields && <div style={{ fontSize: 9.5, color: T.accent }}>✦ AI 초안 <button onClick={() => setRvEdit(x => ({ ...x, vals: { ...x.vals, [fd.k]: x.aiDraft.original[fd.k] } }))} title="이 필드만 원래 값으로" style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 9.5, padding: 0, textDecoration: "underline" }}>원래대로</button></div>}</span>
            {fd.rows > 1
              ? <textarea rows={fd.rows} value={rvEdit.vals[fd.k] ?? ""} onChange={e => { const val = e.target.value; setRvEdit(x => ({ ...x, vals: { ...x.vals, [fd.k]: val } })); }} style={{ ...ta, minHeight: 0, flex: 1 }} />
              : <input value={rvEdit.vals[fd.k] ?? ""} onChange={e => { const val = e.target.value; setRvEdit(x => ({ ...x, vals: { ...x.vals, [fd.k]: val } })); }} style={{ ...inp, flex: 1 }} />}
          </div>))}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: T.muted, marginRight: "auto" }}>적용하면 이 항목의 검토 의견은 '내용 변경됨'이 되고, 연결된 하위 항목에는 변경 영향 검토가 표시될 수 있습니다.{AE.reviewScope(rvEdit.key)?.kind === "test" ? " 수정한 시험은 수동 작성으로 바뀌어 규칙 재생성 때 덮어쓰지 않습니다." : ""}</span>
          <button onClick={aiFixDraft} disabled={busy} title="판정된(틀림 제외)·미판정 의견과 관련 상위 항목을 근거로 필드별 수정안을 만들어 채웁니다. 적용은 직접 누릅니다" style={{ ...small, color: T.accent }}>✦ AI 수정안 초안</button>
          <button onClick={() => setTab(sp.tab)} style={small}>원래 탭에서 열기</button>
          <button onClick={() => setRvEdit(null)} style={small}>취소</button>
          <button onClick={applyReviewEditUI} style={{ ...small, background: T.accent, color: "#fff", borderColor: T.accent }}>적용</button>
        </div>
      </div>);
  };
  // 규칙 지적의 ID → 그 ID를 가진 검토 범위(수정 가능 여부) — 이해관계자 요구 등 범위 밖 ID는 null
  const scopeOfIdC = id => (AE.reviewScopesFor(model).find(x => AE.reviewEditSpec(model, x.key, id)) || {}).key || null;
  const openEditC = (fkey, key, id) => { if (rvEdit?.fkey === fkey) { setRvEdit(null); return; } const sp = AE.reviewEditSpec(model, key, id); if (!sp) { setErr("수정할 대상을 찾지 못했습니다."); return; } setRvEdit({ fkey, key, id, vals: { ...sp.values } }); };
  const errCount = findings.filter(f => f.sev === "error").length;
  const aeProg = React.useMemo(() => AE.aeProgress(model, { saved: !!requirements?.aspice }), [model, requirements?.aspice]);
  const rvOpen = AE.reviewView(model).count().open;
  // ── 프로세스 탭 상태(✓ 완료 · ● 진행 중 · ○ 아직) — 시험 레벨은 '빠진 시험' 기준 ──
  const procVisible = AE_PROCS.filter(p => { const g = AE_GROUPS.find(x => x.id === p.grp); return !g.scope || model.scope[g.scope]; });
  const procStates = React.useMemo(() => {
    const out = {};
    AE_PROCS.forEach(p => {
      if (p.tab === "verif") { const n = model.tests.filter(t => t.level === p.sub).length; out[p.id] = !n ? "todo" : AE.missingTestTargets(model, [p.sub]) > 0 ? "partial" : "done"; return; }
      const base = aeProg.steps.find(x => x.id === p.tab)?.state || "todo";
      if (p.id === "ARTIFACTS") { out[p.id] = (model.units.SW.some(u => u.dd) || model.comps.HW.some(c => c.hd) || model.reqs.SYS.length) ? "done" : "todo"; return; }
      if (p.id === "HWE.2") {   // HWE.2: 블록 + 회로 설계(hd)까지 있어야 완료
        const cs = model.comps.HW, hd = cs.filter(c => c.hd?.parts?.length).length;
        out[p.id] = !cs.length ? "todo" : hd === cs.length && base === "done" ? "done" : "partial"; return;
      }
      if (p.sub === "unit") {   // SWE.3: 유닛 분해 + 상세설계(dd)까지 있어야 완료
        const us = model.units.SW, dd = us.filter(u => u.dd?.classes?.length).length;
        out[p.id] = !us.length ? "todo" : dd === us.length && base === "done" ? "done" : "partial"; return;
      }
      const cnt = p.sub === "STK" ? model.reqs.STK.length : p.sub === "SYS" ? model.reqs.SYS.length : p.sub === "req" ? model.reqs[p.tab].length : p.sub === "arch" ? model.comps[p.tab].length : null;
      out[p.id] = cnt === null ? base : !cnt ? "todo" : base === "done" ? "done" : "partial";
    });
    return out;
  }, [model, aeProg]);
  const effSub = tab === "verif" ? (sub || vFilter) : sub;
  const activeProc = AE_PROCS.find(p => p.tab === tab && (p.sub || null) === (effSub || null)) || null;
  const activeGrp = tab === "setup" ? null : activeProc ? activeProc.grp
    : tab === "req" || tab === "SYS" ? "SYS" : tab === "SW" ? "SWE" : tab === "HW" ? "HWE" : tab === "trace" || tab === "review" ? "QA" : null;
  const goProc = (id) => { const p = AE_PROCS.find(x => x.id === id); if (!p) return; setTabRaw(p.tab); setSub(p.sub || null); setFocus(null); if (p.tab === "verif") setVFilter(p.sub); };
  const goGroup = (g) => { const ps = procVisible.filter(p => p.grp === g); const p = ps.find(x => procStates[x.id] !== "done") || ps[0]; if (p) goProc(p.id); };
  const procMark = st => st === "done" ? "✓" : st === "partial" ? "●" : "○";
  const procColor = st => st === "done" ? T.green : st === "partial" ? T.amber : T.muted;
  const runHere = !!(runAt && runAt.el && runAt.el.isConnected && runAt.tab === tab);
  const runCtx = { anchor: runHere ? runAt.anchor : null, busy, prog, runErr };

  return (
    <AeRunCtx.Provider value={runCtx}>
    <div onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (e.target === e.currentTarget && downOnBackdrop.current) requestClose(); downOnBackdrop.current = false; }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} onClickCapture={e => { clickSec.current = e.target?.closest ? e.target.closest("[data-aesec]") : null; }} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, width: "100%", maxWidth: 1080, maxHeight: "92vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🚗 ASPICE V-모델 산출물 엔지니어링 <Badge color={T.accent}>{AE.ASPICE_VERSIONS.find(v => v.id === V)?.label}</Badge></div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>확정 시스템 요구(SYS.2) → 아키텍처(SYS.3) → SW·HW 요구/설계 → 검증 수단 → 양방향 추적성 — 하나의 추적 모델에서 모든 산출물을 생성합니다</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => { setIntroOpen(true); }} title="사용법 안내 다시 보기" style={{ ...small, padding: "4px 9px" }}>❓ 사용법</button>
            <button onClick={requestClose} title="닫기" style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "8px 18px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            {AE_GROUPS.filter(g => !g.scope || model.scope[g.scope]).map(g => {
              const ps = procVisible.filter(p => p.grp === g.id); const on = activeGrp === g.id;
              const badge = g.id === "QA" ? errCount + rvOpen : 0;
              return (
              <button key={g.id} onClick={() => goGroup(g.id)} title={ps.map(p => `${p.id === "TRACE" ? "" : p.id + " "}${p.short} · ${procStates[p.id] === "done" ? "완료" : procStates[p.id] === "partial" ? "진행 중" : "아직"}`).join("\n")}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "transparent", color: on ? "#fff" : T.text, display: "inline-flex", alignItems: "center", gap: 8 }}>
                {g.label}{badge ? <span style={{ fontSize: 10, color: on ? "#fff" : T.amber }}>({badge})</span> : null}
                <span style={{ fontSize: 9, letterSpacing: 1.5 }}>{ps.map(p => <span key={p.id} style={{ color: on ? (procStates[p.id] === "done" ? "#B9F6CA" : procStates[p.id] === "partial" ? "#FFE082" : "#fff") : procColor(procStates[p.id]), opacity: procStates[p.id] === "todo" ? 0.5 : 1 }}>{procStates[p.id] === "done" ? "●" : procStates[p.id] === "partial" ? "◐" : "○"}</span>)}</span>
              </button>); })}
            <div style={{ flex: 1 }} />
            <button onClick={() => setTab("setup")} title="준비 — ASPICE 버전·개발 범위·입력자료(DBC 등). 눌러서 확인·변경"
              style={{ ...small, padding: "5px 10px", color: tab === "setup" ? "#fff" : T.text, background: tab === "setup" ? T.accent : "transparent", borderColor: tab === "setup" ? T.accent : T.border }}>
              ⚙ {AE.ASPICE_VERSIONS.find(v => v.id === V)?.label || V} · SYS + SW{model.scope.HW ? " + HW" : ""} ✎</button>
          </div>
          {activeGrp && (
            <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
              {procVisible.filter(p => p.grp === activeGrp).map(p => { const on = activeProc?.id === p.id; const st = procStates[p.id]; return (
                <button key={p.id} onClick={() => goProc(p.id)} title={`${p.id === "TRACE" || p.id === "ARTIFACTS" ? p.code : AE.procLabel(p.id, V)}${p.pair ? ` — ${p.pair} 검증` : ""} · ${st === "done" ? "완료" : st === "partial" ? "진행 중" : "아직"}`}
                  style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: on ? 700 : 400, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : "transparent", color: T.text }}>
                  <span style={{ color: procColor(st), marginRight: 4 }}>{procMark(st)}</span>
                  {p.id !== "TRACE" && p.id !== "ARTIFACTS" && <b style={{ fontFamily: "monospace", marginRight: 4 }}>{p.id}</b>}{p.short}
                  {p.pair && <span style={{ fontSize: 9.5, color: T.muted, marginLeft: 4 }}>↔{p.pair}</span>}
                  {p.id === "TRACE" && errCount ? <span style={{ color: T.red, marginLeft: 3 }}>({errCount})</span> : null}
                  {p.id === "SUP.1" && rvOpen ? <span style={{ color: T.amber, marginLeft: 3 }}>({rvOpen})</span> : null}
                </button>); })}
            </div>)}
        </div>
        {/* 진행 현황 · 다음 할 일 */}
        <div style={{ margin: "8px 18px 0", padding: "6px 12px", border: `1px solid ${T.border}`, borderRadius: 9, background: T.bg, flexShrink: 0, fontSize: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>진행 {aeProg.pct}%</b>
            <span style={{ flex: 1, minWidth: 120, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}><span style={{ display: "block", width: `${aeProg.pct}%`, height: "100%", background: aeProg.pct === 100 ? T.green : T.accent }} /></span>
            {aeProg.next ? (() => { const nx = aeProg.next; const lab = AE_TABS.find(t => t[0] === nx.id)?.[1] || nx.id; const c = nx.next?.cov;
              return <>
                <span style={{ color: T.text }}>👉 다음 할 일: <b>{lab}</b>{c ? ` — '${c.q}' 빠짐 ${c.missing.length}건` : nx.state === "todo" ? " — 아직 시작 전" : ` — ${nx.note}`}</span>
                <button onClick={() => { if (c) goMissing(c); else { setTab(nx.next?.tab || nx.id); setFocus(null); } }} style={{ ...small, background: T.accent, color: "#fff", borderColor: T.accent }}>바로 가기 →</button>
              </>; })() : <span style={{ color: T.green }}>✓ 모든 단계가 끝났습니다. 저장한 뒤 위저드 '완료'로 서버에 저장하세요.</span>}
          </div>
        </div>
        <div style={{ padding: "12px 18px", overflowY: "auto", flex: 1 }}>
          {AE_GUIDE[tab] && (guideHidden.has(tab)
            ? <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}><button onClick={() => hideGuide(tab, false)} style={{ ...small, padding: "2px 8px", color: T.muted }}>❓ 이 단계 안내 보기</button></div>
            : <div style={{ border: `1px solid ${T.accent}44`, borderLeft: `3px solid ${T.accent}`, borderRadius: 9, padding: "10px 12px", marginBottom: 12, background: T.accent + "08", fontSize: 11.5, lineHeight: 1.65 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{activeProc ? `${activeProc.id === "TRACE" || activeProc.id === "ARTIFACTS" ? "" : activeProc.id + " "}${activeProc.short}` : AE_TABS.find(t => t[0] === tab)?.[1]} — 이 단계에서 할 일</div>
                    <div style={{ color: T.muted, marginBottom: 6 }}>{AE_GUIDE[tab].why}</div>
                    <ol style={{ margin: "0 0 6px 18px", padding: 0 }}>{AE_GUIDE[tab].todo.map((t, i) => <li key={i} style={{ marginBottom: 2 }}>{t}</li>)}</ol>
                    <div style={{ color: T.green, fontSize: 11 }}>✓ 끝났다고 보는 기준: {AE_GUIDE[tab].done}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                    <button onClick={() => hideGuide(tab, true)} title="이 단계의 안내를 숨깁니다(❓로 다시 볼 수 있음)" style={{ ...small, padding: "2px 8px", color: T.muted }}>안내 숨기기</button>
                    {(() => { const i = activeProc ? procVisible.findIndex(p => p.id === activeProc.id) : -1; const nx = i >= 0 ? procVisible[i + 1] : tab === "setup" ? procVisible[0] : null; return nx ? <button onClick={() => goProc(nx.id)} title={`${nx.id === "TRACE" ? "" : nx.id + " "}${nx.short}`} style={{ ...small, padding: "2px 8px" }}>다음: {nx.id === "TRACE" || nx.id === "ARTIFACTS" ? nx.short : nx.id} →</button> : null; })()}
                  </div>
                </div>
              </div>)}
          {activeProc && activeProc.id !== "TRACE" && activeProc.id !== "ARTIFACTS" && (() => {
            const docs = Object.values(AE.ASPICE_DOCS).filter(d => d.proc === activeProc.id); const vs = AE.versionsOf(V);
            const pair = activeProc.pair ? AE_PROCS.find(x => x.id === activeProc.pair) : null;
            return (
              <div style={{ fontSize: 10.5, color: T.muted, padding: "5px 10px", border: `1px dashed ${T.border}`, borderRadius: 8, marginBottom: 10 }}>
                <b style={{ color: T.text }}>{AE.procLabel(activeProc.id, V)}</b>
                {docs.length > 0 && <> · 산출물: {docs.map(d => `${d.title} (${vs.map(v => `${v === "3.1" ? "3.1 WP" : "4.0 정보항목"} ${d.wp[v]}`).join(" / ")})`).join(" · ")}</>}
                {pair && <> · 검증 대상: <button onClick={() => goProc(pair.id)} style={{ ...small, padding: "0 6px", fontSize: 10 }}>{pair.id} {pair.short}</button></>}
              </div>); })()}
          {(busy || prog) && !runHere && <GenProgressBar progress={prog || { percent: 3, label: "준비 중…" }} subText="요구 건수에 따라 수십 초가 걸릴 수 있습니다. 화면을 유지해 주세요." />}
          {runErr && !runHere && <div style={{ color: T.red, fontSize: 11.5, padding: 9, background: T.red + "11", borderRadius: 8, marginBottom: 10 }}>{runErr}</div>}
          {err && <div style={{ color: T.red, fontSize: 11.5, padding: 9, background: T.red + "11", borderRadius: 8, marginBottom: 10 }}>{err}</div>}
          {note && <div style={{ color: T.green, fontSize: 11.5, padding: 9, background: T.green + "11", borderRadius: 8, marginBottom: 10 }}>{note}</div>}
          {lstat.open.length > 0 && tab !== "trace" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.amber, fontSize: 11.5, padding: "7px 10px", background: T.amber + "11", border: `1px solid ${T.amber}55`, borderRadius: 8, marginBottom: 10 }}>
              <span style={{ flex: 1 }}>상위 요구 변경으로 검토가 필요한 추적 연결이 있습니다 — 변경 검토 {lstat.suspect}건{lstat.invalid ? ` · 무효(조치 필요) ${lstat.invalid}건` : ""}{lstat.orphan ? ` · 고아 연결 ${lstat.orphan}건` : ""}. 하위 문서는 자동으로 수정되지 않습니다.</span>
              <button onClick={() => setTab("trace")} style={{ ...small, color: T.amber, borderColor: T.amber + "88" }}>변경 영향 검토</button>
            </div>)}
          {focusOn && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, padding: "7px 10px", background: T.accent + "11", border: `1px solid ${T.accent}55`, borderRadius: 8, marginBottom: 10 }}>
              <span style={{ flex: 1 }}>🔎 <b>"{focusOn.q}"</b>에서 빠진 {focusOn.n}건만 표시 중{(() => { const ids = [...focusOn.ids]; return ids.length <= 12 ? ` — ${ids.join(", ")}` : ` — ${ids.slice(0, 12).join(", ")} 외 ${ids.length - 12}건`; })()}</span>
              <button onClick={() => setFocus(null)} style={small}>전체 보기</button>
            </div>)}
          {focusOn && (() => {
            const k = String(focusOn.key || "");
            const tip = /Alloc$/.test(k) && /^(sw|hw)/.test(k) ? "처리: 아래 요구의 '할당 →'에서 담당 컴포넌트 칩을 눌러 지정하세요(여러 개 가능, 다시 누르면 해제). 'AI 컴포넌트 설계·할당'은 전체를 다시 만들므로 누르지 마세요."
              : k === "swUnit" ? "처리: 먼저 이 요구에 담당 컴포넌트를 할당한 뒤, 아래 'SW 유닛 분해'의 [빠진 유닛만 추가]를 누르세요. 기존 유닛은 그대로 둡니다."
              : /Derive$/.test(k) && k !== "stkDerive" ? "처리: 아래 주황 상자의 [이 요구에서 파생]을 누르세요. 기존 하위 요구·할당은 그대로 둡니다."
              : focusOn.tab === "verif" ? "처리: 위의 [빠진 시험만 생성]을 누르세요. 기존 시험의 ID·내용·검토 기록은 그대로 둡니다. 생성 후 기대 결과·합격 기준을 다듬으세요."
              : "";
            return tip ? <div style={{ fontSize: 11, color: T.text, padding: "6px 10px", background: T.green + "10", border: `1px solid ${T.green}44`, borderRadius: 8, marginTop: -4, marginBottom: 10 }}>💡 {tip}</div> : null;
          })()}
          {!model.reqs.SYS.length && tab !== "req" && <div style={{ color: T.amber, fontSize: 11.5, padding: 9, background: T.amber + "11", borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}><span style={{ flex: 1 }}>확정된 시스템 요구사항이 없습니다. SYS.1에서 고객 요구를 도출해 SYS.2를 확정하거나, ⚙ 준비에서 DBC를 가져오세요.</span><button onClick={() => setTab("req", "STK")} style={{ ...small, color: T.amber, borderColor: T.amber + "88" }}>SYS.1로</button></div>}

          {/* ② 요구 도출·명세 (SYS.1·2) — 탭을 옮겨도 작성 중인 내용이 유지되도록 항상 마운트하고 숨김 처리 */}
          <div style={{ display: tab === "req" ? "block" : "none" }}>
            <ReqGenModal key={itemsVer} embedded part={sub === "STK" || sub === "SYS" ? sub : null} onGoPart={pt => setTab("req", pt)} form={form} wbs={wbs} requirements={requirements} setRequirements={setRequirements} ossp={ossp}
              previewAspice={model} seedItems={itemsVer ? items : undefined} onEmbeddedConfirm={confirmReqs} onClose={() => {}} onSourceChange={src => { srcRef.current = src; const sig = (src.files || []).map(f => f.name).join("|"); setSrcSig(v => v === sig ? v : sig); }} focusIds={focusOn ? focusOn.ids : null} />
          </div>

          {tab === "setup" && (<>
            <AeSec title="적용 기준·범위">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {AE.ASPICE_VERSIONS.map(v => (
                  <button key={v.id} onClick={() => set(n => { n.version = v.id; })} title={v.desc}
                    style={{ ...small, padding: "6px 12px", fontSize: 11.5, color: V === v.id ? "#fff" : T.muted, background: V === v.id ? T.accent : "transparent", borderColor: V === v.id ? T.accent : T.border }}>{v.label}</button>))}
              </div>
              <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>{AE.ASPICE_VERSIONS.find(v => v.id === V)?.desc}</div>
              <div style={{ display: "flex", gap: 16, fontSize: 11.5, flexWrap: "wrap" }}>
                <label title="시스템 범위는 항상 포함 — SYS.1 이해관계자 요구(STK) 층부터 SYS.2~5까지"><input type="checkbox" checked disabled /> 시스템 (SYS.1~SYS.5)</label>
                <label title={scopeLocked ? "SW·HW 범위는 새 프로젝트의 개발 범위·적용 범위에서 바꿉니다 (WBS·산출물 목록과 일치 유지)" : ""}><input type="checkbox" checked={model.scope.SW} disabled={scopeLocked || model.scope.SW} onChange={e => set(n => { n.scope.SW = e.target.checked; })} /> SW (SWE.1~6)</label>
                <label title={scopeLocked ? "SW·HW 범위는 새 프로젝트의 개발 범위·적용 범위에서 바꿉니다 (WBS·산출물 목록과 일치 유지)" : V === "3.1" ? "3.1 PRM에는 HWE가 없어 4.0 HWE를 PAM 확장으로 준용합니다" : ""}><input type="checkbox" checked={model.scope.HW} disabled={scopeLocked} onChange={e => set(n => { n.scope.HW = e.target.checked; })} /> HW (HWE.1~4){V === "3.1" ? " · PAM 확장" : ""}</label>
                <label style={{ marginLeft: "auto" }} title="해제 시 /api/chat 호출 없이 규칙 기반 초안만 생성 (폐쇄망·재현성)"><input type="checkbox" checked={model.useAI} onChange={e => set(n => { n.useAI = e.target.checked; })} /> AI 사용 (해제 = 규칙 기반만)</label>
              </div>
              {scopeLocked && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>SW·HW 범위는 과제의 개발 범위({ASPICE_DEVS.find(d => d.id === devFromScope(tailoring.aspiceScope))?.label})를 따릅니다 — 바꾸려면 새 프로젝트의 기본정보(개발 범위) 또는 적용 범위 단계에서 변경하세요. WBS·산출물 목록과 V-모델 범위가 항상 같게 유지됩니다.</div>}
              {(hiddenHW > 0 || hiddenSW > 0) && <div style={{ fontSize: 10.5, color: T.amber, marginTop: 6 }}>⚠ 범위 밖으로 숨겨진 데이터가 있습니다{hiddenSW ? ` — SW ${hiddenSW}건` : ""}{hiddenHW ? ` — HW ${hiddenHW}건` : ""}. 삭제되지 않고 보존되며, 개발 범위에 다시 포함하면 그대로 나타납니다.</div>}
              <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>※ SWE.3(상세설계)·SWE.4(유닛 검증)는 코드가 근거이므로 SWE.3 상세설계 탭에서 유닛 분해·요구 추적 골격과 헤더(.h) 기반 인터페이스만 생성하고 알고리즘·동적 동작은 TBD로 둡니다. HWE 상세설계는 회로 확정 후 OSSP 템플릿으로 작성합니다.</div>
            </AeSec>
            <AeSec title="입력자료 체크리스트 — 확보한 자료를 표시하면 WP 충족도에 반영됩니다 (없는 자료는 AI가 지어내지 않고 TBD로 남깁니다)"
              right={(() => { const pend = Object.keys(autoInputs).filter(id => !model.inputs[id]); return pend.length ? <button onClick={() => set(n => { pend.forEach(id => { n.inputs[id] = "have"; }); })} style={{ ...small, color: T.green, borderColor: T.green + "88" }}>감지된 {pend.length}건 모두 확보로 표시</button> : null; })()}>
              {Object.keys(autoInputs).some(id => !model.inputs[id]) && <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 6 }}>SYS.1에 첨부한 파일명에서 자료를 감지했습니다 — <span style={{ color: T.accent }}>확보(자동)</span>는 추정이므로, 내용을 확인한 뒤 '확보'를 눌러 확정하세요. 확정된 것만 WP 충족도에 반영됩니다.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {AE.INPUT_CHECKLIST.map(it => (
                  <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1fr 230px", gap: 8, alignItems: "center", fontSize: 11 }}>
                    <span>{it.label}{it.optional && <span style={{ color: T.muted }}> (선택)</span>} <span style={{ color: T.muted, fontSize: 9.5 }}>→ {it.feeds.map(f => AE.ASPICE_DOCS[f]?.title || "검증 명세").join(", ")}</span>
                      {autoInputs[it.id] && !model.inputs[it.id] && <span title={`감지 파일: ${autoInputs[it.id].join(", ")}`} style={{ marginLeft: 6, fontSize: 9.5, color: T.accent, border: `1px solid ${T.accent}66`, borderRadius: 5, padding: "1px 6px" }}>확보(자동) · {autoInputs[it.id].length}개 파일</span>}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[["have", "확보", T.green], ["", "미확보", T.amber], ["na", "해당 없음", T.muted]].map(([v, l, c]) => { const on = (model.inputs[it.id] || "") === v; return (
                        <button key={v || "none"} onClick={() => set(n => { if (v) n.inputs[it.id] = v; else delete n.inputs[it.id]; })} style={{ ...small, flex: 1, color: on ? "#fff" : T.muted, background: on ? c : "transparent", borderColor: on ? c : T.border }}>{l}</button>); })}
                    </div>
                  </div>))}
              </div>
            </AeSec>
            <AeSec title="통신 DB(DBC) 가져오기 — 메시지·시그널·주기를 인터페이스 요구·시스템 인터페이스로 결정적 변환 (AI 미사용)">
              <FileDrop accept=".dbc,.txt" onFiles={fs => onDbc(asFileEvent(fs))} dropLabel="여기에 놓으면 DBC를 해석합니다 (.dbc · .txt)">
              <label style={{ ...small, display: "inline-block", padding: "6px 12px" }}>📎 .dbc 파일 선택<input type="file" accept=".dbc,.txt" onChange={onDbc} style={{ display: "none" }} /></label>
              {dbc && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
                  <span>{dbc.fileName}: 메시지 {dbc.parsed.messages.length}개 · 노드 {dbc.parsed.nodes.length}개 — 우리 시스템 노드:</span>
                  <select value={dbc.own} onChange={e => setDbc(d => ({ ...d, own: e.target.value }))} style={{ ...inp, width: 160 }}>{dbc.parsed.nodes.map(x => <option key={x}>{x}</option>)}</select>
                  <span style={{ color: T.muted }}>송신 {dbc.parsed.messages.filter(x => x.tx === dbc.own).length} · 수신 {dbc.parsed.messages.filter(x => x.tx !== dbc.own && x.signals.some(s => s.rx.includes(dbc.own))).length}</span>
                  <Btn onClick={applyDbc} style={{ fontSize: 11, padding: "4px 12px" }}>인터페이스 요구 추가</Btn>
                </div>)}
              </FileDrop>
            </AeSec>
            <AeSec title="등록 템플릿 WP 특성 점검 — 고객사·조직 템플릿이 ASPICE 정보항목 특성을 담고 있는지 목차·항목 라벨로 결정적 점검">
              <FileDrop accept=".docx" onFiles={fs => onTplFile(asFileEvent(fs))}
                dropLabel={`여기에 놓으면 '${({ SYS_RS: "시스템 요구사항 명세서", SYS_AD: "시스템 아키텍처 설계서", SW_RS: "SW 요구사항 명세서", SW_AD: "SW 아키텍처 설계서", HW_RS: "HW 요구사항 명세서", HW_AD: "HW 아키텍처 설계서", VERIF: "검증 명세서(공통)" })[tplGroup] || tplGroup}' 기준으로 점검합니다 (.docx)`}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select value={tplGroup} onChange={e => setTplGroup(e.target.value)} style={{ ...inp, width: 220 }}>
                  {[["SYS_RS", "시스템 요구사항 명세서"], ["SYS_AD", "시스템 아키텍처 설계서"], ["SW_RS", "SW 요구사항 명세서"], ["SW_AD", "SW 아키텍처 설계서"], ["HW_RS", "HW 요구사항 명세서"], ["HW_AD", "HW 아키텍처 설계서"], ["VERIF", "검증 명세서(공통)"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <label style={{ ...small, padding: "5px 12px" }}>📎 템플릿 docx 업로드<input type="file" accept=".docx" onChange={onTplFile} style={{ display: "none" }} /></label>
                <button onClick={checkOsspTemplate} style={{ ...small, padding: "5px 12px" }}>OSSP 등록 템플릿으로 점검</button>
              </div>
              {model.templateChecks[tplGroup] && (() => { const tc = model.templateChecks[tplGroup]; const list = AE.charStatusList(model, tplGroup); return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 4 }}>{tc.fileName} · {tc.mode === "outline" ? `목차·항목 라벨 ${tc.outline}줄` : "본문"} 기준 · {String(tc.at).slice(0, 10)}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {list.map(c => <span key={c.id} title={c.source} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: `1px solid ${c.byTpl ? T.green + "66" : (c.origin === "ASPICE" ? T.red + "66" : T.border)}`, color: c.byTpl ? T.green : (c.origin === "ASPICE" ? T.red : T.muted) }}>{c.byTpl ? "✓" : "✕"} {c.label}{c.origin !== "ASPICE" ? ` (${c.origin})` : ""}</span>)}
                  </div>
                </div>); })()}
              </FileDrop>
            </AeSec>
          </>)}

          {tab === "SYS" && (<>
            <AeSec title={`시스템 요구사항 ${model.reqs.SYS.length}건 — 검증 방법·기준·상태·할당 (${AE.procLabel("SYS.2", V)})`}>
              {ReqList({ lv: "SYS" })}
            </AeSec>
            <AeSec title={`시스템 요소 ${model.comps.SYS.length}개 (${AE.procLabel("SYS.3", V)} · 정적 측면)`} right={<Btn onClick={sysArch} disabled={busy || !model.reqs.SYS.length} style={{ fontSize: 11, padding: "4px 12px" }}>{aiLabel} 아키텍처 초안·할당</Btn>}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>구분: HW·SW·HW+SW·ME(기구)·외부(시스템 경계 밖). SW/HW 하위 요구는 'SW'·'HW'가 포함된 요소에 할당된 시스템 요구에서 파생됩니다. DBC로 추가된 요소·인터페이스는 재생성 시 보존됩니다.</div>
              {CompList({ lv: "SYS" })}
            </AeSec>
            <AeSec title={`시스템 인터페이스 ${model.interfaces.SYS.length}건 (3.1 SYS.3.BP3 / 4.0 04-06 Interface Definitions)`}>{IfList({ lv: "SYS" })}</AeSec>
            <AeSec title="운영 모드·상태 (동적 측면 — 3.1 SYS.3.BP4 / 4.0 SYS.3.BP2)">
              {model.modes.map((x, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 22px", gap: 5, marginBottom: 4 }}>
                  <input value={x.name} onChange={e => set(n => { n.modes[i].name = e.target.value; })} placeholder="모드명" style={inp} />
                  <input value={x.desc} onChange={e => set(n => { n.modes[i].desc = e.target.value; })} placeholder="설명" style={inp} />
                  <input value={x.transition} onChange={e => set(n => { n.modes[i].transition = e.target.value; })} placeholder="진입·이탈 조건" style={inp} />
                  <button onClick={() => set(n => { n.modes.splice(i, 1); })} style={{ background: "none", border: "none", color: T.red, cursor: "pointer" }}>✕</button>
                </div>))}
              <button onClick={() => set(n => { n.modes.push({ name: "", desc: "", transition: "" }); })} style={small}>＋ 모드 추가</button>
            </AeSec>
            <AeSec title="아키텍처 분석·설계 근거 (3.1 SYS.3.BP5 / 4.0 04-06 justifying rationale)">
              <textarea value={model.rationale.SYS} onChange={e => set(n => { n.rationale.SYS = e.target.value; })} style={{ ...ta, minHeight: 60 }} placeholder="대안 구조와 선택 근거(재사용 플랫폼·원가·안전·제조성 등)" />
            </AeSec>
          </>)}

          {(tab === "SW" || tab === "HW") && (() => { const lv = tab; const L = AE.LEVELS[lv]; const parents = AE.parentsForLevel(model, lv); return (<>
            {lv === "HW" && V === "3.1" && <div style={{ fontSize: 10.5, color: T.amber, marginBottom: 8 }}>※ ASPICE 3.1에는 HWE 프로세스가 없어 4.0 HWE.1~4를 PAM 확장으로 준용합니다 (문서에 명기됨).</div>}
            {(!sub || sub === "req") && (<AeSec title={`${lv} 요구사항 ${model.reqs[lv].length}건 (${AE.procLabel(L.reqProc, V)}) — 파생 대상 시스템 요구 ${parents.length}건`} right={(() => { const miss = parents.filter(p => !model.reqs[lv].some(r => (r.parents || []).includes(p.id))).map(p => p.id); return (<div style={{ display: "flex", gap: 6 }}>
                {miss.length > 0 && model.reqs[lv].length > 0 && <Btn onClick={() => derive(lv, miss)} disabled={busy} title="기존 하위 요구·할당은 그대로 두고, 아직 파생되지 않은 시스템 요구에서만 새로 만듭니다" style={{ fontSize: 11, padding: "4px 12px" }}>빠진 {miss.length}건만 파생</Btn>}
                <Btn variant={model.reqs[lv].length ? "outline" : undefined} onClick={() => { const auto = model.reqs[lv].filter(r => r.origin !== "manual").length; if (auto && !window.confirm(`전체 다시 파생하면 직접 추가하지 않은 ${lv} 요구 ${auto}건을 새로 만듭니다.\n기존 요구의 컴포넌트 할당·유닛·시험·교차검토 연결이 바뀔 수 있습니다.\n빠진 것만 채우려면 '빠진 N건만 파생'을 쓰세요.\n\n계속할까요?`)) return; derive(lv); }} disabled={busy || !parents.length} style={{ fontSize: 11, padding: "4px 12px" }}>{model.reqs[lv].length ? `전체 다시 파생` : `${aiLabel} 요구 파생`}</Btn>
              </div>); })()}>
              {!parents.length && <div style={{ fontSize: 10.5, color: T.amber, marginBottom: 6 }}>'{lv}'가 포함된 시스템 요소에 할당된 요구가 없습니다. SYS.3 시스템 구조에서 요소 구분(HW/SW/HW+SW)과 할당을 확인하세요.</div>}
              {(() => {
                // ⑦에서 '빠짐'으로 들어왔을 때: 빠진 것은 하위 요구가 아니라 '아직 내려오지 않은 시스템 요구' — 여기서 바로 처리
                const miss = parents.filter(p => !model.reqs[lv].some(r => (r.parents || []).includes(p.id)));
                const show = focus && focus.tab === lv ? miss.filter(p => focus.ids.has(p.id)) : [];
                if (!show.length) return null;
                const cn = Object.fromEntries(model.comps.SYS.map(c => [c.id, c.name]));
                return (
                  <div style={{ border: `1px solid ${T.amber}88`, background: T.amber + "10", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>아직 {lv} 요구로 내려오지 않은 시스템 요구 {show.length}건</div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>아래 시스템 요구는 {lv}가 포함된 요소에 할당돼 있지만 {lv} 요구가 하나도 없습니다. <b>[이 요구에서 파생]</b>을 누르면 기존 {lv} 요구·할당은 그대로 두고 이 요구에서만 새로 만듭니다. {lv}가 할 일이 없는 요구라면 SYS.3 시스템 구조에서 요소 할당을 바로잡으세요.</div>
                    {show.map(p => (
                      <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", borderTop: `1px solid ${T.border}`, padding: "6px 0" }}>
                        <div style={{ flex: 1, fontSize: 11 }}>
                          <span style={{ fontFamily: "monospace", color: T.accent, marginRight: 6 }}>{p.id}</span><b>{p.title}</b>
                          <div style={{ color: T.muted, fontSize: 10.5 }}>{String(p.text || "").slice(0, 160)}</div>
                          <div style={{ color: T.muted, fontSize: 10 }}>할당 요소: {(p.elems || []).map(id => `${id} ${cn[id] || ""}`).join(", ") || "-"}</div>
                        </div>
                        <Btn onClick={() => derive(lv, [p.id])} disabled={busy} style={{ fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }}>{aiLabel} 이 요구에서 파생</Btn>
                        <button onClick={() => { set(n => { n.reqs[lv].push({ id: AE.nextId(AE.REQ_PREFIX[lv], n.reqs[lv], 4), level: lv, parents: [p.id], sysElems: p.elems || [], title: p.title || "", text: "", type: p.type || "기능", priority: p.priority || "중", verifMethod: "Test", verifCriteria: "", status: "Draft", origin: "manual" }); }); setFocus(null); setNote(`${p.id}를 근거로 ${lv} 요구를 직접 추가했습니다 — 목록 맨 끝에서 내용을 작성하고 담당 ${L.compLabel}를 할당하세요.`); }} disabled={busy} style={{ ...small, whiteSpace: "nowrap" }}>＋ 직접 작성</button>
                      </div>))}
                  </div>);
              })()}
              {ReqList({ lv: lv })}
              <button onClick={() => set(n => { n.reqs[lv].push({ id: AE.nextId(AE.REQ_PREFIX[lv], n.reqs[lv], 4), level: lv, parents: [], sysElems: [], title: "", text: "", type: "기능", priority: "중", verifMethod: "Test", verifCriteria: "", status: "Draft", origin: "manual" }); })} style={{ ...small, marginTop: 6 }}>＋ {lv} 요구 추가</button>
            </AeSec>)}
            {(!sub || sub === "arch") && (<><AeSec title={`${L.compLabel} ${model.comps[lv].length}개 (${AE.procLabel(L.archProc, V)})`} right={<Btn variant={model.comps[lv].length ? "outline" : undefined} onClick={() => { if (model.comps[lv].length && !window.confirm(`${L.compLabel} 설계·할당을 처음부터 다시 만듭니다.\n기존 컴포넌트·할당·인터페이스와 그에 연결된 유닛·시험·교차검토가 바뀔 수 있습니다.\n요구 몇 건만 할당하려면 요구의 '할당 →' 칩을 누르세요.\n\n계속할까요?`)) return; compose(lv); }} disabled={busy || !model.reqs[lv].length} style={{ fontSize: 11, padding: "4px 12px" }}>{model.comps[lv].length ? "전체 다시 설계·할당" : `${aiLabel} 컴포넌트 설계·할당`}</Btn>}>
              {CompList({ lv: lv })}
            </AeSec>
            <AeSec title={`${lv} 인터페이스 ${model.interfaces[lv].length}건`}>{IfList({ lv: lv })}</AeSec></>)}
            {lv === "SW" && (!sub || sub === "unit") && (
              <FileDrop bare accept=".h,.hpp,.txt" multiple onFiles={fs => onHeaders(asFileEvent(fs))} dropLabel="여기에 놓으면 C 헤더에서 유닛 인터페이스를 가져옵니다 (.h · .hpp · .txt · 여러 개 가능)">
              <AeSec title={`SW 유닛 분해 ${model.units.SW.length}개 (${AE.procLabel("SWE.3", V)}) — 상세설계는 아래 섹션`}
                right={<div style={{ display: "flex", gap: 6 }}>
                  <label title="헤더 파일을 이 섹션으로 끌어다 놓아도 됩니다" style={{ ...small, display: "inline-block", padding: "4px 10px" }}>📎 .h 헤더 가져오기 (끌어다 놓기 가능)<input type="file" accept=".h,.hpp,.txt" multiple onChange={onHeaders} style={{ display: "none" }} /></label>
                  {(() => { const r = AE.addMissingUnits(model); return model.units.SW.length > 0 && r.added.length > 0
                    ? <Btn onClick={() => { const x = AE.addMissingUnits(model); set(n => { n.units.SW = x.units; }); setNote(`유닛 ${x.added.join(", ")}을(를) 추가했습니다 — 기존 유닛은 그대로입니다. SWE.4 유닛 시험은 SWE.4 유닛 검증 탭의 [빠진 시험만 생성]으로 추가하세요.`); }} disabled={busy} title="기존 유닛(수정·헤더 반영분 포함)은 그대로 두고, 유닛이 없는 SW 요구에만 골격을 추가합니다" style={{ fontSize: 11, padding: "4px 12px" }}>빠진 유닛만 추가 ({r.added.length})</Btn>
                    : null; })()}
                  <Btn variant={model.units.SW.length ? "outline" : undefined} onClick={() => { if (model.units.SW.some(u => u.origin === "rule") && !window.confirm("규칙으로 만든 유닛을 모두 다시 만들고 유닛 번호를 다시 매깁니다.\n이 화면이나 교차검토에서 고친 유닛 설계, SWE.4 유닛 시험, 유닛 교차검토 기록이 바뀔 수 있습니다(헤더로 가져온 유닛은 유지).\n빠진 것만 채우려면 [빠진 유닛만 추가]를 쓰세요.\n\n계속할까요?")) return; genUnits(); }} disabled={busy || !model.comps.SW.length} style={{ fontSize: 11, padding: "4px 12px" }}>{model.units.SW.length ? "⚙ 골격 다시 생성" : "⚙ 규칙 골격 생성"}</Btn>
                </div>}>
                <WhyBox title="상세설계는 어떤 순서로 만들어지나요? (유닛 분해 → AI 전체 설계 → 코드)">
                  ① 먼저 SW 요구를 담당 컴포넌트별 <b>유닛</b>으로 나누어 요구↔유닛 추적을 잡습니다(규칙 기반). 기존 코드가 있으면 C 헤더(.h)에서 함수 원형·자료형·상수를 읽어 유닛 인터페이스로 삼습니다.
                  ② 아래 <b>SWE.3 상세설계</b>에서 AI가 유닛마다 정적 구조(클래스·포트·Runnable·자료형·알고리즘)와 동적 동작(상태 머신·시퀀스·액티비티)을 <b>전부</b> 작성합니다. 지어내는 것이 아니라 할당 SW 요구·상위 시스템 요구·컴포넌트 인터페이스·운영 모드를 근거로 쓰고, 모든 요소에 <b>근거 요구 ID</b>를 남겨 심사에서 "설계 근거"에 답할 수 있게 합니다.
                  ③ 그 설계가 다이어그램 7종(UML·SysML)·XMI 2.1(EA 17.2 가져오기)·MISRA 준거 코드(AUTOSAR CP C / AP C++)의 단일 입력이 되므로 설계와 코드가 어긋나지 않습니다. 생성된 설계는 QA 교차검토(검토 AI + 사람 판정)를 거친 뒤 확정하세요.
                </WhyBox>
                {!model.comps.SW.length && <div style={{ fontSize: 10.5, color: T.amber, marginBottom: 6 }}>SW 컴포넌트를 먼저 설계하세요. 유닛은 컴포넌트 아래에 만들어집니다.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {model.units.SW.map((u, i) => (
                    <div key={u.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", background: T.bg }}>
                      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 150px 1fr 70px 52px 24px", gap: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>{u.id}</span>
                        <input value={u.name || ""} onChange={e => set(n => { n.units.SW[i] = { ...n.units.SW[i], name: e.target.value }; })} style={inp} />
                        <select value={u.comp || ""} onChange={e => set(n => { n.units.SW[i] = { ...n.units.SW[i], comp: e.target.value }; })} style={inp}>
                          <option value="">(컴포넌트 미지정)</option>{model.comps.SW.map(c => <option key={c.id} value={c.id}>{c.id} {c.name}</option>)}
                        </select>
                        <input value={(u.reqs || []).join(", ")} onChange={e => set(n => { n.units.SW[i] = { ...n.units.SW[i], reqs: e.target.value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean) }; })} placeholder="할당 SW 요구 ID (쉼표)" style={inp} />
                        <span style={{ fontSize: 9.5, color: u.origin === "header" ? T.green : u.origin === "manual" ? T.amber : T.muted }}>{u.origin === "header" ? `헤더 ${(u.funcs || []).length}fn` : u.origin === "manual" ? "수동" : "규칙·TBD"}</span>
                        <button onClick={() => setOpen(o => ({ ...o, [u.id]: !o[u.id] }))} style={{ ...small, color: T.muted, padding: "2px 0" }}>{open[u.id] ? "접기" : "상세"}</button>
                        <button onClick={() => set(n => { n.units.SW.splice(i, 1); })} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 12 }}>✕</button>
                      </div>
                      {open[u.id] && (
                        <div style={{ marginTop: 6, fontSize: 10.5 }}>
                          <div style={{ fontSize: 10, color: T.muted }}>책임·설명</div>
                          <textarea value={u.desc || ""} onChange={e => set(n => { n.units.SW[i] = { ...n.units.SW[i], desc: e.target.value, designDone: !/TBD/.test(e.target.value) }; })} style={ta} />
                          {(u.funcs || []).length > 0 && <div style={{ marginTop: 4 }}><div style={{ fontSize: 10, color: T.muted }}>인터페이스 (헤더 {u.file})</div>{u.funcs.map((f, k) => <div key={k} style={{ fontFamily: "monospace", fontSize: 10 }}>{f.ret} <b>{f.name}</b>({f.params})</div>)}</div>}
                          {(u.types || []).length > 0 && <div style={{ marginTop: 4, color: T.muted }}>자료형: {u.types.join(", ")}</div>}
                          {(u.macros || []).length > 0 && <div style={{ color: T.muted }}>상수: {u.macros.slice(0, 12).map(x => `${x.name}=${x.value}`).join(" · ")}{u.macros.length > 12 ? " …" : ""}</div>}
                        </div>)}
                    </div>))}
                  {!model.units.SW.length && <div style={{ fontSize: 11, color: T.muted, padding: 6 }}>유닛 없음 — '규칙 골격 생성' 또는 '.h 헤더 가져오기'를 누르세요.</div>}
                </div>
                <button onClick={() => set(n => { n.units.SW.push({ id: AE.nextId(AE.UNIT_PREFIX, n.units.SW), comp: n.comps.SW[0]?.id || "", name: "", desc: "", reqs: [], funcs: [], types: [], macros: [], origin: "manual", file: "", designDone: false }); })} style={{ ...small, marginTop: 6 }}>+ 유닛 추가</button>
              </AeSec>
              </FileDrop>
            )}
            {lv === "SW" && (!sub || sub === "unit") && (() => {
              const S = AE.ddSettings(model); const TG = AE.DD_TARGETS[S.target] || AE.DD_TARGETS.CP;
              const missing = AE.ddMissingUnits(model); const have = model.units.SW.filter(u => u.dd?.classes?.length);
              const vu = ddView.unit ? model.units.SW.find(u => u.id === ddView.unit) : null;
              const dlText = (name, text, mime = "text/plain") => { const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
              const dlBytes = (name, bytes, mime) => { const blob = new Blob([bytes], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
              const seed = form?.id || form?.name || "project";
              const coded = have.filter(u => u.dd.code && u.dd.code.target === S.target);
              const dlSvg = (u, k) => { const svg = AE.ddSvg(k, u, model); const blob = new Blob([svg], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${u.id}_${k}.svg`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
              return (
              <AeSec title={`SWE.3 상세설계 — 다이어그램 7종 · 코드 생성 기준 (설계 ${have.length}/${model.units.SW.length} 유닛)`}
                right={<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {have.length > 0 && <button onClick={() => { try { dlText(`${String(form?.name || "project").replace(/[\\/:*?"<>|]/g, "_")}_SWE3_UML2.1.xml`, AE.buildXmi(model, form || {}, { seed }), "application/xml"); } catch (e) { setErr("XMI 생성 실패: " + e.message); } }} title="UML 2.x XMI 2.1 — Enterprise Architect 17.x: Publish › Model Exchange › Import › XMI File ('Import Diagrams' 체크)" style={small}>⬇ XMI 2.1 (EA 가져오기)</button>}
                  {have.length > 0 && <button onClick={() => { try { dlBytes("MISRA_적용_체크리스트.xlsx", makeXlsx({ sheetName: "MISRA", rows: AE.misraChecklistRows(S) }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); } catch (e) { setErr("체크리스트 생성 실패: " + e.message); } }} style={small}>⬇ MISRA 체크리스트</button>}
                  {coded.length > 0 && <button onClick={() => { try { const fs = coded.flatMap(u => u.dd.code.files.map(f => ({ path: `${u.id}_${String(u.name).replace(/[\\/:*?"<>|]/g, "_")}/${f.name}`, content: f.text }))); dlBytes(`${String(form?.name || "project").replace(/[\\/:*?"<>|]/g, "_")}_src_${S.target}.zip`, zipBytes(fs), "application/zip"); } catch (e) { setErr("코드 ZIP 실패: " + e.message); } }} style={small}>⬇ 코드 ZIP ({coded.length})</button>}
                  {have.length > 0 && <Btn variant={coded.length ? "outline" : undefined} onClick={() => genCode(coded.length < have.length ? have.filter(u => !coded.includes(u)).map(u => u.id) : null)} disabled={busy} title={coded.length < have.length ? "코드가 없는 유닛만 생성" : "모든 유닛의 코드를 다시 생성"} style={{ fontSize: 11, padding: "4px 10px" }}>{model.useAI ? "🤖" : "⚙"} 코드 생성{coded.length < have.length ? ` (${have.length - coded.length}개)` : " (전체 재생성)"}</Btn>}
                  {missing.length > 0 && have.length > 0 && <Btn onClick={() => genDD(missing.map(u => u.id))} disabled={busy} title="설계가 없는 유닛만 생성 — 기존 설계는 그대로" style={{ fontSize: 11, padding: "4px 10px" }}>{model.useAI ? "🤖" : "⚙"} 빠진 {missing.length}개만 설계</Btn>}
                  <Btn variant={have.length ? "outline" : undefined} onClick={() => { if (have.length && !window.confirm(`유닛 ${model.units.SW.length}개의 상세설계를 모두 다시 만듭니다. 기존 다이어그램·설계 내용은 교체됩니다.`)) return; genDD(); }} disabled={busy || !model.units.SW.length} style={{ fontSize: 11, padding: "4px 10px" }}>{model.useAI ? "🤖 AI 상세설계 생성 (전체)" : "⚙ 규칙 상세설계 생성 (전체)"}</Btn>
                </div>}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 11, marginBottom: 8 }}>
                  <span style={{ color: T.muted }}>대상 플랫폼</span>
                  {Object.entries(AE.DD_TARGETS).map(([k, t]) => <button key={k} onClick={() => set(n => { n.swDesign = { ...AE.ddSettings(n), target: k }; })} style={{ ...small, padding: "4px 10px", color: S.target === k ? "#fff" : T.muted, background: S.target === k ? T.accent : "transparent", borderColor: S.target === k ? T.accent : T.border }}>{t.label}</button>)}
                  <span style={{ color: T.muted }}>AUTOSAR {S.release} · {S.target === "CP" ? S.misraC : `${S.misraCpp} · ${S.cppGuide}`} · 정적분석 {S.tools.join("·")}</span>
                </div>
                <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>유닛마다 AI가 정적 구조(클래스·포트·Runnable·자료형·알고리즘)와 동적 동작(상태 머신·시퀀스·액티비티)을 근거 자료(할당 SW 요구·상위 시스템 요구·컴포넌트 인터페이스·운영 모드)로 설계하고, 모든 요소에 근거 요구 ID를 남깁니다. 순서: 상세설계 생성 → 코드 생성(뼈대는 결정적, 연산 본문·guard 식은 AI) → XMI 2.1·MISRA 체크리스트 내려받기. 다이어그램·XMI·소스·체크리스트는 '전체 ZIP 다운로드'의 'SW4101_상세설계_모델' 폴더에도 들어갑니다.</div>
                {!model.units.SW.length && <div style={{ fontSize: 11, color: T.amber }}>유닛이 없습니다 — 위 [규칙 골격 생성] 또는 [.h 헤더 가져오기]로 유닛을 먼저 만드세요.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {model.units.SW.map(u => { const d = u.dd; const on = ddView.unit === u.id; return (
                    <div key={u.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto auto auto auto", gap: 8, alignItems: "center", fontSize: 11, padding: "5px 8px", border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 7, background: on ? T.accent + "12" : T.bg }}>
                      <span style={{ fontFamily: "monospace", color: T.accent }}>{u.id}</span>
                      <span><b>{u.name}</b>{d ? <span style={{ color: T.muted }}> — 클래스 {d.classes.length} · 포트 {d.ports.length} · Runnable {d.runnables.length} · 상태 {d.states.states.length}/전이 {d.states.transitions.length} · 시퀀스 {d.sequences.length} · 액티비티 {d.activities.length}</span> : <span style={{ color: T.amber }}> — 설계 없음</span>}</span>
                      <span style={{ fontSize: 9.5, color: d ? (d.origin === "ai" ? T.green : T.muted) : T.muted }}>{d ? (d.origin === "ai" ? "AI 설계" : "규칙 설계") : ""}</span>
                      {d ? <button onClick={() => setDdView(v => ({ ...v, unit: on && v.mode === "diagram" ? null : u.id, mode: "diagram" }))} style={{ ...small, padding: "2px 8px", ...(on && ddView.mode === "diagram" ? { background: T.accent, color: "#fff", borderColor: T.accent } : {}) }}>다이어그램</button> : <span />}
                      {d?.code ? <button onClick={() => setDdView(v => ({ ...v, unit: on && v.mode === "code" ? null : u.id, mode: "code", file: 0 }))} title={`${d.code.files.length}개 파일 · ${AE.DD_TARGETS[d.code.target]?.lang} · ${d.code.origin === "ai" ? "본문 AI" : "본문 규칙"}`} style={{ ...small, padding: "2px 8px", ...(on && ddView.mode === "code" ? { background: T.accent, color: "#fff", borderColor: T.accent } : {}) }}>코드</button> : <span />}
                      <button onClick={() => genDD([u.id])} disabled={busy} style={{ ...small, padding: "2px 8px" }}>{d ? "재설계" : (model.useAI ? "🤖 설계" : "⚙ 설계")}</button>
                    </div>); })}
                </div>
                {vu && vu.dd && ddView.mode === "code" && vu.dd.code && (() => { const cf = vu.dd.code.files; const fi = Math.min(ddView.file || 0, cf.length - 1); const f = cf[fi]; return (
                  <div style={{ marginTop: 10, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "6px 8px", flexWrap: "wrap", background: T.bg }}>
                      {cf.map((x, i) => <button key={x.name} onClick={() => setDdView(v => ({ ...v, file: i }))} style={{ ...small, padding: "3px 9px", fontFamily: "monospace", color: fi === i ? "#fff" : T.muted, background: fi === i ? T.accent : "transparent", borderColor: fi === i ? T.accent : T.border }}>{x.name}</button>)}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 10, color: T.muted }}>{AE.DD_TARGETS[vu.dd.code.target]?.label} · {vu.dd.code.origin === "ai" ? "연산 본문 AI" : "연산 본문 규칙(주석 단계)"}{vu.dd.code.target !== S.target ? " · ⚠ 현재 대상 플랫폼과 다름 — 코드 재생성 필요" : ""}</span>
                      <button onClick={() => dlText(f.name, f.text)} style={small}>⬇ 이 파일</button>
                      <button onClick={() => dlBytes(`${vu.id}_src.zip`, zipBytes(cf.map(x => ({ path: x.name, content: x.text }))), "application/zip")} style={small}>⬇ 유닛 ZIP</button>
                    </div>
                    <pre style={{ margin: 0, padding: 10, maxHeight: 520, overflow: "auto", fontSize: 11, lineHeight: 1.45, background: "#0B0F1A", color: "#D6DEEB", fontFamily: "Consolas, 'D2Coding', monospace" }}>{f.text}</pre>
                    {vu.dd.code.notes?.length > 0 && <div style={{ padding: "6px 10px", fontSize: 10.5, color: T.amber, borderTop: `1px solid ${T.border}` }}>MISRA 편차 검토 지점(AI): {vu.dd.code.notes.join(" · ")}</div>}
                    {/TODO guard/.test(f.text) && <div style={{ padding: "6px 10px", fontSize: 10.5, color: T.amber, borderTop: `1px solid ${T.border}` }}>⚠ 'TODO guard'가 남은 전이는 AI가 조건식을 만들지 못한 것입니다 — 상태 머신의 guard를 수치 조건으로 고친 뒤 코드를 재생성하세요.</div>}
                  </div>); })()}
                {vu && vu.dd && ddView.mode === "diagram" && (
                  <div style={{ marginTop: 10, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "6px 8px", flexWrap: "wrap", background: T.bg }}>
                      {AE.DD_DIAGRAMS.map(([k, lab]) => <button key={k} onClick={() => setDdView(v => ({ ...v, kind: k }))} style={{ ...small, padding: "3px 9px", color: ddView.kind === k ? "#fff" : T.muted, background: ddView.kind === k ? T.accent : "transparent", borderColor: ddView.kind === k ? T.accent : T.border }}>{lab}</button>)}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => dlSvg(vu, ddView.kind)} style={small}>⬇ SVG</button>
                      <button onClick={() => AE.DD_DIAGRAMS.forEach(([k]) => dlSvg(vu, k))} style={small}>⬇ 7종 모두</button>
                    </div>
                    <SvgView svg={AE.ddSvg(ddView.kind, vu, model)} zoom={svgZoom} setZoom={setSvgZoom} />
                    <div style={{ padding: "6px 10px", fontSize: 10.5, color: T.muted, borderTop: `1px solid ${T.border}` }}>
                      {vu.dd.summary}
                      {(() => { const rs = new Set([...vu.dd.classes.flatMap(c => [...(c.reqs || []), ...c.ops.flatMap(o => o.reqs || [])]), ...vu.dd.states.transitions.flatMap(t => t.reqs || []), ...vu.dd.sequences.flatMap(x => x.reqs || []), ...vu.dd.activities.flatMap(x => x.reqs || [])]); return rs.size ? ` · 근거 요구: ${[...rs].join(", ")}` : " · 근거 요구 ID 없음(요구 할당을 확인하세요)"; })()}
                    </div>
                  </div>)}
              </AeSec>); })()}
            {lv === "HW" && (!sub || sub === "arch") && (() => {
              const S = AE.hdSettings(model); const missing = AE.hdMissingComps(model); const have = model.comps.HW.filter(c => c.hd?.parts?.length);
              const vc = hdView.comp ? model.comps.HW.find(c => c.id === hdView.comp) : null;
              const dlSvgH = (c, k) => { const svg = AE.hdSvg(k, c, model); const blob = new Blob([svg], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${c ? c.id : "HW"}_${k}.svg`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
              return (
              <AeSec title={`HWE.2 회로 설계 — 회로도·BOM·특별 특성·분석 (설계 ${have.length}/${model.comps.HW.length} 블록)`}
                right={<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {missing.length > 0 && have.length > 0 && <Btn onClick={() => genHD(missing.map(c => c.id))} disabled={busy} style={{ fontSize: 11, padding: "4px 10px" }}>{model.useAI ? "🤖" : "⚙"} 빠진 {missing.length}개만 설계</Btn>}
                  <Btn variant={have.length ? "outline" : undefined} onClick={() => { if (have.length && !window.confirm(`HW 블록 ${model.comps.HW.length}개의 회로 설계를 모두 다시 만듭니다. 기존 부품·넷·분석은 교체됩니다.`)) return; genHD(); }} disabled={busy || !model.comps.HW.length} style={{ fontSize: 11, padding: "4px 10px" }}>{model.useAI ? "🤖 AI 회로 설계 생성 (전체)" : "⚙ 규칙 회로 설계 생성 (전체)"}</Btn>
                </div>}>
                <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>블록(HW 컴포넌트)마다 AI가 부품(RefDes·값·패키지·제조사 PN <b>후보</b>·정격·AEC-Q 등급)·넷·핀 연결·외부 인터페이스와 특별 특성(17-57)·설계 분석(15-51: Derating·열·타이밍·최악조건)·설계 근거를 할당 HW 요구·상위 시스템 요구·HW 인터페이스를 근거로 작성하고 요구 ID를 남깁니다. EDA 호환: {S.eda} — 회로도 {S.schematicFmt} · 레이아웃 {S.layoutFmt} · 생산 {S.fabFmt} (교환 파일 생성은 다음 단계).</div>
                {!model.comps.HW.length && <div style={{ fontSize: 11, color: T.amber }}>HW 컴포넌트가 없습니다 — 위 [AI 컴포넌트 설계·할당] 또는 [＋ HW 컴포넌트]로 블록을 먼저 만드세요.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {model.comps.HW.map(c => { const h = c.hd; const on = hdView.comp === c.id; return (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto auto auto", gap: 8, alignItems: "center", fontSize: 11, padding: "5px 8px", border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 7, background: on ? T.accent + "12" : T.bg }}>
                      <span style={{ fontFamily: "monospace", color: T.accent }}>{c.id}</span>
                      <span><b>{c.name}</b>{h?.parts?.length ? <span style={{ color: T.muted }}> — 부품 {h.parts.length} · 넷 {h.nets.length} · 연결 {h.conns.length} · 특별특성 {h.specials.length} · 분석 {h.analysis.derating.length + h.analysis.thermal.length + h.analysis.timing.length + h.analysis.worstCase.length}{h.analysis.derating.concat(h.analysis.thermal, h.analysis.worstCase).some(x => x.ok === false) ? <span style={{ color: T.red }}> · NG 있음</span> : null}</span> : <span style={{ color: T.amber }}> — 회로 설계 없음</span>}</span>
                      <span style={{ fontSize: 9.5, color: h ? (h.origin === "ai" ? T.green : T.muted) : T.muted }}>{h ? (h.origin === "ai" ? "AI 설계" : "규칙 설계") : ""}</span>
                      {h?.parts?.length ? <button onClick={() => setHdView(v => ({ comp: on ? null : c.id, kind: v.kind }))} style={{ ...small, padding: "2px 8px" }}>{on ? "접기" : "회로도"}</button> : <span />}
                      <button onClick={() => genHD([c.id])} disabled={busy} style={{ ...small, padding: "2px 8px" }}>{h?.parts?.length ? "재설계" : (model.useAI ? "🤖 설계" : "⚙ 설계")}</button>
                    </div>); })}
                </div>
                {vc && vc.hd && (
                  <div style={{ marginTop: 10, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "6px 8px", flexWrap: "wrap", background: T.bg }}>
                      {AE.HD_DIAGRAMS.map(([k, lab]) => <button key={k} onClick={() => setHdView(v => ({ ...v, kind: k }))} style={{ ...small, padding: "3px 9px", color: hdView.kind === k ? "#fff" : T.muted, background: hdView.kind === k ? T.accent : "transparent", borderColor: hdView.kind === k ? T.accent : T.border }}>{lab}</button>)}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => dlSvgH(hdView.kind === "block" ? null : vc, hdView.kind)} style={small}>⬇ SVG</button>
                    </div>
                    <SvgView svg={AE.hdSvg(hdView.kind, vc, model)} zoom={svgZoom} setZoom={setSvgZoom} />
                    <div style={{ padding: "6px 10px", fontSize: 10.5, color: T.muted, borderTop: `1px solid ${T.border}`, maxHeight: 180, overflow: "auto" }}>
                      <div>{vc.hd.summary}</div>
                      <div style={{ marginTop: 4 }}><b>부품(PN 후보):</b> {vc.hd.parts.map(p => `${p.ref} ${p.value}${p.mpn ? " [" + p.mpn + "]" : ""}`).join(" · ")}</div>
                      {vc.hd.specials.length > 0 && <div style={{ marginTop: 4 }}><b>특별 특성:</b> {vc.hd.specials.map(x => `${x.id} ${x.char} (${x.type})`).join(" · ")}</div>}
                      <div style={{ marginTop: 4 }}><b>설계 근거:</b> {vc.hd.rationale}</div>
                    </div>
                  </div>)}
              </AeSec>); })()}
            {(!sub || sub === "arch") && <AeSec title="설계 근거"><textarea value={model.rationale[lv]} onChange={e => set(n => { n.rationale[lv] = e.target.value; })} style={{ ...ta, minHeight: 50 }} /></AeSec>}
          </>); })()}

          {tab === "verif" && (() => {
            const lvKeys = Object.keys(AE.TEST_LEVELS).filter(k => model.scope[AE.TEST_LEVELS[k].level]);
            const cur = sub && lvKeys.includes(sub) ? sub : lvKeys.includes(vFilter) ? vFilter : lvKeys[0];
            const ts = model.tests.filter(t => t.level === cur).filter(t => !focusOn || focusOn.level !== cur || (t.targets || []).some(x => focusOn.ids.has(x)));
            return (<>
              <div data-aesec="verif-bar" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                {!sub && lvKeys.map(k => <button key={k} onClick={() => setVFilter(k)} style={{ ...small, padding: "5px 10px", color: cur === k ? "#fff" : T.muted, background: cur === k ? T.accent : "transparent", borderColor: cur === k ? T.accent : T.border }}>{AE.TEST_LEVELS[k].proc} {AE.TEST_LEVELS[k].label} ({model.tests.filter(t => t.level === k).length})</button>)}
                <div style={{ flex: 1 }} />
                {(() => { const mt = AE.missingTestTargets(model, lvKeys); return mt > 0 && model.tests.length > 0
                  ? <Btn onClick={() => { const x = AE.addMissingTests(model, lvKeys); set(n => { n.tests = x.tests; }); setNote(`시험 ${x.added.length}건(${x.added.slice(0, 8).join(", ")}${x.added.length > 8 ? " …" : ""})을 추가했습니다 — 기존 시험은 그대로입니다. 새 시험의 기대 결과·합격 기준을 다듬으세요.`); }} disabled={busy} title="시험이 하나도 없는 요구·인터페이스·유닛에만 규칙 시험을 추가합니다. 기존 시험의 ID·내용·교차검토 기록은 그대로입니다" style={{ fontSize: 11, padding: "4px 12px" }}>빠진 시험만 생성 ({mt}개 대상)</Btn>
                  : null; })()}
                <Btn variant="outline" onClick={() => { if (model.tests.some(t => t.level === cur && t.origin !== "manual") && !window.confirm(`${AE.TEST_LEVELS[cur].proc} 시험을 다시 생성합니다(직접 작성·수정한 시험은 유지).\n규칙·AI로 만든 시험의 번호가 다시 매겨져 교차검토 기록과 어긋날 수 있습니다.\n\n계속할까요?`)) return; genTests([cur]); }} disabled={busy} style={{ fontSize: 11, padding: "4px 10px" }}>이 레벨 다시 생성</Btn>
                <Btn variant={model.tests.length ? "outline" : undefined} onClick={() => { if (model.tests.some(t => t.origin !== "manual") && !window.confirm("모든 레벨의 시험을 다시 생성합니다(직접 작성·수정한 시험은 유지).\n규칙·AI로 만든 시험의 번호가 다시 매겨져 교차검토 기록과 어긋날 수 있습니다.\n빠진 것만 채우려면 [빠진 시험만 생성]을 쓰세요.\n\n계속할까요?")) return; genTests(lvKeys); }} disabled={busy} style={{ fontSize: 11, padding: "4px 12px" }}>{model.useAI ? "⚡ 규칙+AI" : "⚙ 규칙"} 전체 {model.tests.length ? "다시 " : ""}생성</Btn>
              </div>
              {runCtx.anchor === "verif-bar" && (busy || prog) && <GenProgressBar progress={prog || { percent: 3, label: "준비 중…" }} subText="요구 건수에 따라 수십 초가 걸릴 수 있습니다. 화면을 유지해 주세요." />}
              {runCtx.anchor === "verif-bar" && runErr && <div style={{ color: T.red, fontSize: 11.5, padding: 9, background: T.red + "11", borderRadius: 8, marginBottom: 10 }}>{runErr}</div>}
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 8 }}>규칙 엔진: 요구 문장의 수치 조건(이상·이하·초과·미만·범위·이내)에서 경계값·타이밍 TC, 고장·진단 문구에서 결함 주입 TC, 인터페이스에서 연동·주기·통신이상 TC를 결정적으로 생성합니다. {model.useAI ? "AI는 정상 시나리오 절차 서술에만 사용합니다." : ""} 수동 추가·수정한 항목은 재생성 시 보존됩니다.</div>
              {cur === "SWE4" && (() => {
                const S = AE.ddSettings(model);
                const ok = AE.utSupported(S);
                const dUnits = (model.units.SW || []).filter(u => u.dd?.classes?.length);
                const nRule = dUnits.reduce((a, u) => a + AE.ruleUnitTests(u).length, 0);
                const nAi = dUnits.reduce((a, u) => a + (u.ut?.cases || []).filter(c => c.origin === "ai").length, 0);
                const dropped = dUnits.flatMap(u => (u.ut?.dropped || []).map(d => ({ ...d, unit: u.id })));
                const Lr = AE.utLatest(model);
                const R = Lr?.run;
                const rows = R ? dUnits.filter(u => R.units[u.id]) : [];
                const notRun = R ? dUnits.filter(u => !R.units[u.id]).length : dUnits.length;
                const resCol = r => r === "Pass" ? T.green : r === "Fail" ? T.red : T.muted;
                return (
                  <AeSec title={`SWE.4 호스트 실행(SIL) — 유닛 ${dUnits.length} · 케이스 ${nRule + nAi} (규칙 ${nRule} · AI 초안 ${nAi})${R ? ` · 최근 실행 ${String(R.ranAt || R.at).slice(0, 10)}` : ""}`}
                    right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Btn variant="outline" disabled={busy || !ok || !dUnits.length} onClick={genUnitTests} title="규칙 케이스(초기화·출력 갱신·견고성)는 설계에서 결정적으로, 요구 기반 케이스는 생성 AI가 초안 — 기대값이 요구·설계 원문에 없으면 버립니다" style={{ fontSize: 11, padding: "4px 12px" }}>✦ 케이스 생성</Btn>
                      <Btn disabled={busy || !ok || !dUnits.length} onClick={downloadHostPkg} style={{ fontSize: 11, padding: "4px 12px" }}>📦 실행 패키지 ZIP</Btn>
                      <label style={{ ...small, padding: "4px 12px", fontSize: 11, opacity: busy || !ok ? 0.5 : 1, pointerEvents: busy || !ok ? "none" : "auto" }} title="run_tests가 만든 swe4_results.jsonl">⬆ 실행 결과 가져오기<input type="file" accept=".jsonl,.json,.txt" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; importUtResults(f); }} /></label>
                    </div>}>
                    <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.65, marginBottom: 8 }}>
                      SWE.3에서 만든 C 소스를 <b style={{ color: T.text }}>PC(gcc)에서 빌드·실행</b>해 유닛별로 검증합니다. ① <b>✦ 케이스 생성</b> → ② <b>📦 실행 패키지 ZIP</b>을 받아 압축을 풀고 <code>run_tests.sh</code>(Windows는 <code>run_tests.bat</code>, 커버리지는 <code>COVERAGE=1 sh run_tests.sh</code>) 실행 → ③ 만들어진 <code>swe4_results.jsonl</code>을 <b>⬆ 실행 결과 가져오기</b>로 올리면 SW 유닛 검증 결과서(SW4106)에 Pass/Fail이 채워집니다.
                      RTE는 시험용 스텁으로 바꾸고, 외부 다운로드 없이 동작합니다. AI 초안 케이스는 소스가 아니라 <b>요구·상세설계</b>만 보고 만들며, 기대값이 원문에 없으면 버립니다.
                      <span style={{ color: T.amber }}> 호스트 실행(SIL)은 로직 검증이며 타깃 MCU의 타이밍·메모리·인터럽트 동작은 보증하지 않습니다 — 결과서에도 그렇게 표기됩니다.</span>
                    </div>
                    {ok && dUnits.length > 0 && (
                      <div style={{ border: `1px solid ${T.accent}55`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, background: T.accent + "0d" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <b style={{ fontSize: 11.5, flex: 1, minWidth: 220 }}>▶ 브라우저에서 바로 실행 <span style={{ fontWeight: 400, color: T.muted, fontSize: 10.5 }}>— 설치 불필요 · 같은 시험 소스를 clang(WebAssembly)으로 컴파일·실행 · 코드는 브라우저 밖으로 나가지 않음</span></b>
                          {!clangRef.current && <button disabled={brBusy || !!brLoad} onClick={async () => { try { await loadBrowserCC(); setBrLog(l => [...l, { kind: "info", text: `컴파일러 준비 완료 (${clangRef.current.host}) — 이제 [▶ 실행]이 바로 시작됩니다.` }]); } catch (e) { setBrLog(l => [...l, { kind: "error", text: e.message }]); } }} style={{ ...small, fontSize: 10.5 }} title="데모 전에 눌러 두면 실행할 때 기다리지 않습니다 (약 100MB, 처음 1회)">⬇ 컴파일러 미리 불러오기</button>}
                          {clangRef.current && <span style={{ fontSize: 10, color: T.green }}>✓ 컴파일러 준비됨</span>}
                          <select value={brPick} onChange={e => setBrPick(e.target.value)} disabled={brBusy} style={{ ...small, color: T.text, background: T.bg, maxWidth: 220 }}>
                            <option value="all">전체 유닛 ({dUnits.length})</option>
                            {dUnits.map(u => <option key={u.id} value={u.id}>{u.id} {u.name}</option>)}
                          </select>
                          {!brBusy ? <Btn disabled={busy || !!brLoad} onClick={runInBrowser} style={{ fontSize: 11, padding: "4px 14px" }}>▶ 실행</Btn>
                            : <button onClick={() => { brStop.current = true; }} style={{ ...small, color: T.red, borderColor: T.red }}>■ 중지 (지금 유닛까지)</button>}
                        </div>
                        {brLoad && <div style={{ marginTop: 6 }}><GenProgressBar progress={{ percent: Math.max(2, brLoad.pct), label: brLoad.label }} subText="내려받은 컴파일러는 브라우저 캐시에 남아 다음부터는 바로 시작합니다." /></div>}
                        {brLog.length > 0 && (
                          <div ref={brLogRef} style={{ marginTop: 6, background: "#0b1020", color: "#d6deeb", fontFamily: "Consolas, 'D2Coding', monospace", fontSize: 11, lineHeight: 1.5, padding: "8px 10px", borderRadius: 6, maxHeight: 300, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                            {brLog.map((l, k) => <div key={k} style={{ color: l.kind === "cmd" ? "#82aaff" : l.kind === "error" || l.kind === "build-fail" ? "#ff6b6b" : l.kind === "summary" ? "#ffd166" : l.kind === "info" ? "#8892b0" : l.kind === "build-ok" ? "#7fdbca" : "#d6deeb", fontWeight: l.kind === "summary" ? 700 : 400 }}>
                              {l.kind === "run" ? String(l.text).split("\n").map((s, j) => <div key={j} style={{ color: /\[FAIL\]/.test(s) ? "#ff6b6b" : /\[PASS\]/.test(s) ? "#addb67" : undefined }}>{s}</div>) : l.text}
                            </div>)}
                          </div>)}
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 5 }}>gcc 실행과 같은 시험·같은 판정입니다. 차이: 컴파일러가 clang(wasm32)이고 커버리지는 측정하지 않습니다(커버리지는 gcc 패키지의 <code>COVERAGE=1</code>). 결과는 실행이 끝나면 자동으로 아래 표와 결과서에 반영됩니다.</div>
                      </div>)}
                    {!ok && <div style={{ fontSize: 11, color: T.amber, marginBottom: 8 }}>현재 코드 대상이 {AE.DD_TARGETS[S.target]?.label}입니다. 호스트 실행은 AUTOSAR Classic(C)만 지원합니다 — Adaptive(C++)는 2단계로 예정되어 있습니다.</div>}
                    {ok && !dUnits.length && <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>상세설계가 있는 유닛이 없습니다. SWE.3에서 상세설계·코드를 먼저 생성하세요.</div>}
                    {dropped.length > 0 && <details style={{ fontSize: 10.5, marginBottom: 8 }}><summary style={{ cursor: "pointer", color: T.muted }}>근거 불충분으로 버린 AI 케이스 {dropped.length}건 (규칙 검사)</summary>{dropped.slice(0, 40).map((d, k) => <div key={k} style={{ paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginTop: 3 }}><span style={{ fontFamily: "monospace", color: T.accent }}>{d.unit}</span> {d.title} — <span style={{ color: T.amber }}>{d.reason}</span></div>)}</details>}
                    {R && <>
                      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 6 }}>최근 실행: {String(R.ranAt || R.at).replace("T", " ").slice(0, 19)} · {R.cc || "컴파일러 정보 없음"}{R.os ? ` · ${R.os}` : ""}{R.coverage ? " · 커버리지 측정" : ""} · 가져온 파일 {R.file || "-"}{notRun ? ` · 실행 안 된 유닛 ${notRun}개` : ""}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "18px 80px 1fr 64px 90px 120px 70px", gap: 6, fontSize: 10, color: T.muted, padding: "0 6px" }}><span /><span>유닛</span><span>이름</span><span>빌드</span><span>케이스 통과</span><span>커버리지(문장·분기)</span><span>결과</span></div>
                        {rows.map(u => { const r = R.units[u.id]; const k = `ut|${u.id}`; const st = Lr.stale[u.id]; const cs = R.cases.filter(c => c.unit === u.id); return (
                          <div key={u.id} style={{ border: `1px solid ${T.border}`, borderRadius: 7, background: T.bg }}>
                            <div onClick={() => setOpen(o => ({ ...o, [k]: !o[k] }))} style={{ display: "grid", gridTemplateColumns: "18px 80px 1fr 64px 90px 120px 70px", gap: 6, fontSize: 11, padding: "5px 6px", cursor: "pointer", alignItems: "center" }}>
                              <span style={{ color: T.muted }}>{open[k] ? "▾" : "▸"}</span>
                              <span style={{ fontFamily: "monospace", color: T.accent }}>{u.id}</span>
                              <span>{u.name}{st && <span style={{ color: T.amber, fontSize: 10 }}> · 실행 후 코드 변경 — 재실행 필요</span>}</span>
                              <span style={{ color: r.build === "fail" ? T.red : T.text }}>{r.build === "fail" ? "실패" : r.build === "ok" ? `성공${r.warnings ? ` ⚠${r.warnings}` : ""}` : "-"}</span>
                              <span>{r.cases ? `${r.pass}/${r.cases}` : "-"}</span>
                              <span>{r.coverage ? `${r.coverage.stmt}% · ${r.coverage.branchN ? r.coverage.branch + "%" : "분기 없음"}` : "-"}</span>
                              <b style={{ color: st ? T.amber : resCol(r.result) }}>{st ? "재실행" : r.result}</b>
                            </div>
                            {open[k] && <div style={{ borderTop: `1px solid ${T.border}`, padding: "4px 8px 6px" }}>
                              {r.build === "fail" && <div style={{ fontSize: 10.5, color: T.red, marginBottom: 4 }}>빌드 실패 — 실행 폴더의 build/{u.id}/build.log를 확인하세요. 대개 AI가 쓴 연산 본문의 식별자·형 불일치이며, SWE.3 [코드] 재생성 또는 수정 후 다시 실행합니다.</div>}
                              {cs.map(c => <div key={c.case} style={{ display: "grid", gridTemplateColumns: "120px 56px 1fr 46px", gap: 6, fontSize: 10.5, padding: "2px 0", borderBottom: `1px solid ${T.border}22` }}>
                                <span style={{ fontFamily: "monospace" }}>{c.case}</span>
                                <span style={{ color: c.origin === "ai" ? T.accent : T.green }}>{c.origin === "ai" ? "AI 초안" : "규칙"}</span>
                                <span>{(u.ut?.cases || []).find(x => x.id === c.case)?.title || ""}{c.reqs ? <span style={{ color: T.muted }}> · {c.reqs}</span> : null}{c.result === "fail" && <div style={{ color: T.red }}>{c.detail}</div>}</span>
                                <b style={{ color: c.result === "pass" ? T.green : T.red }}>{c.result === "pass" ? "Pass" : "Fail"}</b>
                              </div>)}
                              {!cs.length && r.build !== "fail" && <div style={{ fontSize: 10.5, color: T.muted }}>케이스 결과 없음</div>}
                            </div>}
                          </div>); })}
                      </div>
                    </>}
                  </AeSec>);
              })()}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ts.map(t => { const i = model.tests.indexOf(t); return (
                  <div key={t.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", background: T.bg }}>
                    <div style={{ display: "grid", gridTemplateColumns: "84px 110px 1fr 150px 40px 46px 40px", gap: 6, alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>{t.id}</span>
                      <span style={{ fontSize: 9.5, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={(t.targets || []).join(", ")}>{(t.targets || []).join(", ")}</span>
                      <input value={t.title || ""} onChange={e => set(n => { n.tests[i] = { ...n.tests[i], title: e.target.value, origin: "manual" }; })} style={inp} />
                      <span style={{ fontSize: 9.5, color: T.muted }}>{t.technique}</span>
                      <label style={{ fontSize: 9.5 }} title="회귀 대상 (3.1 08-50 / 4.0 08-58)"><input type="checkbox" checked={!!t.regression} onChange={e => set(n => { n.tests[i] = { ...n.tests[i], regression: e.target.checked }; })} />회귀</label>
                      <span style={{ fontSize: 9, color: t.origin === "manual" ? T.amber : t.origin === "ai" ? T.accent : T.green }}>{t.origin === "rule" ? "규칙" : t.origin === "ai" ? "AI" : "수동"}</span>
                      <button onClick={() => setOpen(o => ({ ...o, [t.id]: !o[t.id] }))} style={{ ...small, color: T.muted, padding: "2px 0" }}>{open[t.id] ? "접기" : "상세"}</button>
                    </div>
                    {open[t.id] && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                        {[["precondition", "사전조건(진입 기준)"], ["steps", "절차 (';' 구분)"], ["expected", "기대 결과"], ["passCriteria", "합격 기준"], ["env", "검증 환경"]].map(([k, l]) => (
                          <div key={k}><div style={{ fontSize: 10, color: T.muted }}>{l}</div><textarea value={t[k] || ""} onChange={e => set(n => { n.tests[i] = { ...n.tests[i], [k]: e.target.value, origin: "manual" }; })} style={ta} /></div>))}
                        <div style={{ display: "flex", alignItems: "flex-end" }}><button onClick={() => set(n => { n.tests.splice(i, 1); })} style={{ ...small, color: T.red }}>삭제</button></div>
                      </div>)}
                  </div>); })}
                {!ts.length && <div style={{ fontSize: 11, color: T.muted, padding: 8 }}>검증 수단 없음 — 생성 버튼을 누르세요.</div>}
              </div>
            </>);
          })()}

          {tab === "review" && (() => {
            const v = AE.reviewView(model);
            const S = AE.reviewScope(rvLevel) || AE.reviewScope("SYS");
            const K = AE.REVIEW_KINDS[S.kind];
            const cnt = v.count(rvLevel);
            const scopes = AE.reviewScopesFor(model);
            const cov = AE.reviewCoverage(model, rvSel?.id || "");
            const covOf = Object.fromEntries(cov.map(c => [c.key, c]));
            const lvItems = AE.reviewItems(model, rvLevel);
            const itemIds = new Set(lvItems.map(it => it.id));
            const qf = S.kind === "req" ? (model.reqs[S.lv] || []).filter(r => AE.qualityFlags(r).length).length : 0;
            const ruleHere = findings.filter(f => (f.ids || []).some(id => itemIds.has(id)));
            const sevN = k => findings.filter(f => f.sev === k).length;
            const RC = AE.reviewCriteriaFor(rvLevel, V);
            const critLabel = Object.fromEntries(RC.all.map(c => [c.code, c.label]));
            const sevColor = { major: T.red, minor: T.amber, info: T.muted };
            const jColor = { valid: T.green, invalid: T.muted, opinion: T.accent };
            const reviewers = [...new Set(v.list.filter(f => f.level === rvLevel).map(f => f.reviewer || f.provider || "검토 AI"))];
            const list = v.list.filter(f => f.level === rvLevel).filter(f => rvBy === "all" || (f.reviewer || f.provider || "검토 AI") === rvBy).filter(f => rvFilter === "all" ? true : rvFilter === "open" ? !f.judge : rvFilter === "edited" ? f.edits.length > 0 : rvFilter === "validTodo" ? f.judge?.state === "valid" && !f.edits.length && !f.removed : f.judge?.state === rvFilter);
            const lastRun = [...v.runs].reverse().find(r => r.level === rvLevel && (!rvSel || r.provider === rvSel.id));
            const changedN = rvSel ? AE.reviewTargets(model, rvLevel, "changed", rvSel.id).length : lvItems.length;
            const chOf = Object.fromEntries(scopes.map(x => [x.key, rvSel ? AE.reviewTargets(model, x.key, "changed", rvSel.id).length : 0]));
            const allChangedN = scopes.reduce((a, x) => a + chOf[x.key], 0);
            const pick = rvPick.filter(k => covOf[k]);
            const pickChangedN = pick.reduce((a, k) => a + (chOf[k] || 0), 0), pickAllN = pick.reduce((a, k) => a + (covOf[k]?.total || 0), 0);
            const togglePick = k => setRvPick(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
            const pickGroup = g => { const ks = cov.filter(c => (g === "todo" ? c.reviewedAny < c.total : c.group === g) && c.total).map(c => c.key); setRvPick(p => ks.every(k => p.includes(k)) ? p.filter(k => !ks.includes(k)) : [...new Set([...p, ...ks])]); };
            const readyList = (rv?.available || []).filter(a => a.ready);
            const judge = (f, state) => {
              let note = "";
              if (state === "invalid" || state === "opinion") {
                note = window.prompt(state === "invalid" ? "지적이 틀렸다고 보는 이유를 적어 주세요 (심사 증적으로 남습니다)" : "보류 사유를 적어 주세요 (예: 고객 확인 필요)", f.judge?.note || "");
                if (note === null) return;
              }
              setModel(m => AE.judgeReview(m, [f.key], state, note));
            };
            const chip = (label, val, color, key) => <button onClick={key ? () => setRvRule(r => r === key ? null : key) : undefined} title={key ? "눌러서 검사 결과 보기" : undefined}
              style={{ padding: "4px 10px", borderRadius: 8, background: rvRule === key && key ? color + "33" : color + "18", border: `1px solid ${rvRule === key && key ? color : color + "44"}`, color, fontSize: 11, cursor: key ? "pointer" : "default", fontFamily: "inherit" }}>{label} <b>{val}</b>{key ? (rvRule === key ? " ▴" : " ▾") : ""}</button>;
            const editorBox = editorBoxC, scopeOfId = scopeOfIdC, openEdit = openEditC;
            const totItems = cov.reduce((a, c) => a + c.total, 0), totAny = cov.reduce((a, c) => a + c.reviewedAny, 0);
            const totOpen = cov.reduce((a, c) => a + c.open, 0), totValid = cov.reduce((a, c) => a + c.valid, 0);
            const cell = { padding: "5px 6px", borderTop: `1px solid ${T.border}` };
            return (<>
              <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8, lineHeight: 1.6 }}>
                <b style={{ color: T.text }}>3단 교차검토</b> — 생성한 V-모델 산출물 전부(요구·아키텍처·상세설계·검증 명세)를 대상으로 ① 규칙 엔진이 결정론적으로 점검하고, ② 생성 AI와 <b>다른</b> 검토 AI가 산출물 종류별 기준으로 의견을 내며(의견의 대상 ID·기준·근거 인용은 규칙으로 다시 검증), ③ QA 담당자가 유효·무효·의견으로 판정합니다. 심사 증적은 ③ 판정 기록입니다.
              </div>

              <AeSec title={`검토 범위·현황 — 산출물 ${cov.length}종 · 항목 ${totItems}건 중 현재 내용으로 검토됨 ${totAny}건 · 미판정 ${totOpen} · 맞음(고칠 것) ${totValid}`}
                right={rvRunning
                  ? <button onClick={() => { rvStop.current = true; }} title="지금 보내고 있는 묶음이 끝나면 멈춥니다. 그때까지 받은 의견은 반영되고, 남은 항목은 '변경분 검토'로 이어서 할 수 있습니다" style={{ ...small, color: T.red, borderColor: T.red + "88" }}>■ 검토 중지</button>
                  : <button disabled={busy || !rvSel?.ready || !allChangedN} onClick={() => aiReviewMany(scopes.map(x => x.key), "changed")} title="개발 범위의 모든 산출물에서 아직 검토하지 않았거나 바뀐 항목만 차례로 보냅니다 (선택한 검토 AI 기준)" style={{ ...small, background: allChangedN ? T.accent : "none", color: allChangedN ? "#fff" : T.muted, borderColor: allChangedN ? T.accent : T.border }}>전체 산출물 변경분 검토 ({allChangedN})</button>}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8, fontSize: 11 }}>
                  <span style={{ color: T.muted }}>선택 검토:</span>
                  {[["요구", "요구"], ["설계", "설계"], ["검증", "검증 명세"], ["todo", "미검토 남은 것"]].map(([g, l]) => <button key={g} disabled={busy} onClick={() => pickGroup(g)} style={{ ...small, padding: "3px 9px" }}>{l}</button>)}
                  {pick.length > 0 && <button disabled={busy} onClick={() => setRvPick([])} style={{ ...small, padding: "3px 9px", color: T.muted }}>선택 해제</button>}
                  <span style={{ flex: 1 }} />
                  <span style={{ color: pick.length ? T.text : T.muted }}>{pick.length ? `${pick.length}종 선택 · 항목 ${pickAllN}건` : "아래 표에서 산출물을 체크하세요"}</span>
                  <button disabled={busy || !rvSel?.ready || !pick.length || !pickChangedN} onClick={() => aiReviewMany(pick, "changed")} title="선택한 산출물에서 아직 검토하지 않았거나 바뀐 항목만 보냅니다" style={{ ...small, background: pick.length && pickChangedN ? T.accent : "none", color: pick.length && pickChangedN ? "#fff" : T.muted, borderColor: pick.length && pickChangedN ? T.accent : T.border }}>선택 변경분 검토 ({pickChangedN})</button>
                  <button disabled={busy || !rvSel?.ready || !pick.length} onClick={() => { if (window.confirm(`선택한 산출물 ${pick.length}종의 항목 ${pickAllN}건을 변경 여부와 관계없이 모두 다시 검토합니다. 계속할까요?`)) aiReviewMany(pick, "all"); }} title="선택한 산출물의 항목을 모두 다시 보냅니다" style={{ ...small }}>선택 전체 검토 ({pickAllN})</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr style={{ color: T.muted, textAlign: "left" }}>
                      <th style={{ padding: "4px 6px", width: 26 }}><input type="checkbox" disabled={busy} checked={cov.filter(c => c.total).length > 0 && cov.filter(c => c.total).every(c => pick.includes(c.key))} onChange={e => setRvPick(e.target.checked ? cov.filter(c => c.total).map(c => c.key) : [])} title="모두 선택" /></th>
                      <th style={{ padding: "4px 6px", width: 46 }}>구분</th><th style={{ padding: "4px 6px" }}>산출물</th><th style={{ padding: "4px 6px", width: 70 }}>검토 기준</th>
                      <th style={{ padding: "4px 6px", width: 54, textAlign: "right" }}>항목</th><th style={{ padding: "4px 6px", width: 150 }}>검토됨 (현재 내용 기준)</th>
                      <th style={{ padding: "4px 6px", width: 54, textAlign: "right" }}>미판정</th><th style={{ padding: "4px 6px", width: 70, textAlign: "right" }} title="AI 지적이 맞다고 판정해 산출물을 고쳐야 하는 의견 수">맞음(고칠 것)</th><th style={{ padding: "4px 6px", width: 70 }}>상태</th>
                    </tr></thead>
                    <tbody>{cov.map(c => {
                      const pct = c.total ? Math.round(c.reviewedAny / c.total * 100) : 0;
                      const st = !c.total ? ["항목 없음", T.muted] : c.reviewedAny < c.total ? ["검토 필요", T.amber] : c.open ? ["판정 필요", T.accent] : ["완료", T.green];
                      return (
                        <tr key={c.key} onClick={() => setRvLevel(c.key)} style={{ cursor: "pointer", background: rvLevel === c.key ? T.accent + "14" : "transparent" }}>
                          <td style={{ ...cell }} onClick={e => e.stopPropagation()}><input type="checkbox" disabled={busy || !c.total} checked={pick.includes(c.key)} onChange={() => togglePick(c.key)} title={c.total ? `선택 검토에 포함 (변경분 ${chOf[c.key] || 0}건)` : "항목 없음"} /></td>
                          <td style={{ ...cell, color: T.muted }}>{c.group}</td>
                          <td style={{ ...cell }}><span style={{ color: T.muted }}>{c.proc}</span> {c.label}</td>
                          <td style={{ ...cell }} onClick={e => { e.stopPropagation(); setRvLevel(c.key); setRvGuide(true); }} title="눌러서 검토 기준 설명 보기"><span style={{ color: T.accent, borderBottom: `1px dotted ${T.accent}`, cursor: "help" }}>{AE.vdaVersionLabel(V)}</span><span style={{ color: T.muted }}> → {AE.REVIEW_KINDS[c.kind].ver}</span></td>
                          <td style={{ ...cell, textAlign: "right" }}>{c.total}</td>
                          <td style={{ ...cell }}>{c.total ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ flex: 1, height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", background: pct === 100 ? T.green : T.amber }} /></span>{c.reviewedAny}/{c.total}</span> : "-"}</td>
                          <td style={{ ...cell, textAlign: "right", color: c.open ? T.accent : T.muted }}>{c.open}</td>
                          <td style={{ ...cell, textAlign: "right", color: c.valid ? T.red : T.muted }}>{c.valid}</td>
                          <td style={{ ...cell, color: st[1] }}>{st[0]}{c.stale ? <div style={{ fontSize: 9.5, color: T.amber }}>내용 변경 {c.stale}</div> : null}{rvSel && chOf[c.key] > 0 && c.reviewedAny === c.total ? <div style={{ fontSize: 9.5, color: T.muted }}>{rvSel.label.replace(/ \(.*\)$/, "")} 미검토 {chOf[c.key]}</div> : null}</td>
                        </tr>);
                    })}</tbody>
                  </table>
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.6 }}>
                  '검토됨'은 어느 검토 AI든 <b>지금 내용 그대로</b> 검토한 항목 수입니다. 검토 후 내용이 바뀌면 다시 '검토 필요'가 됩니다. 행을 누르면 아래 ②·③이 그 산출물로 바뀝니다.<br />
                  AI 검토 대상이 아닌 산출물: {AE.REVIEW_EXCLUDED.map(x => `${x.doc ? AE.ASPICE_DOCS[x.doc].title : x.label}(${x.why})`).join(" · ")}
                </div>
              </AeSec>

              <div style={{ fontSize: 12, fontWeight: 700, margin: "4px 0 8px" }}>선택한 산출물: <span style={{ color: T.accent }}>{S.proc} {S.label}</span> <span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>· {K.noun} {lvItems.length}건</span></div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "7px 10px", marginBottom: 8, background: T.accent + "0D", border: `1px solid ${T.accentDim}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 8 }}>
                <b>검토 기준 적용 순서</b><span>① Automotive SPICE <b>{AE.vdaVersionLabel(V)}</b> (VDA QMC) 프로세스 BP 요건 — 적용 기준에서 고른 버전 기준</span><span style={{ color: T.muted }}>→</span><span>② 기존 산출물 품질 기준 (RC · AC · DC · TC)</span><span style={{ marginLeft: "auto", color: T.muted }}>의견의 기준 코드가 VDA-로 시작하면 ①, 아니면 ②에서 나온 지적입니다</span>
              </div>
              <AeSec title="① 규칙 검사 — 결정론적 (같은 입력이면 같은 결과)" right={<button onClick={() => setTab("trace")} style={small}>추적성·충족도에서 보기</button>}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {chip("V-모델 오류", sevN("error"), sevN("error") ? T.red : T.green, "error")}
                  {chip("경고", sevN("warn"), sevN("warn") ? T.amber : T.green, "warn")}
                  {chip("정보", sevN("info"), T.muted, "info")}
                  {S.kind === "req"
                    ? chip(`${S.proc} 요구 품질 플래그`, `${qf} / ${lvItems.length}`, qf ? T.amber : T.green, "qf")
                    : chip(`${S.proc} 관련 규칙 지적`, ruleHere.length, ruleHere.some(f => f.sev === "error") ? T.red : ruleHere.length ? T.amber : T.green, "here")}
                </div>
                {rvRule && (() => {
                  const sevC = { error: T.red, warn: T.amber, info: T.muted };
                  const sevL = { error: "오류", warn: "경고", info: "정보" };
                  const idBtn = (id, fkey) => { const k = scopeOfId(id); return <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 2, marginRight: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10.5 }}>{id}</span>
                    {k && <button onClick={() => openEdit(fkey + "|" + id, k, id)} title={`${id} 바로 수정`} style={{ ...small, padding: "0 5px", fontSize: 10, background: rvEdit?.fkey === fkey + "|" + id ? T.accent : "none", color: rvEdit?.fkey === fkey + "|" + id ? "#fff" : T.accent }}>✎</button>}
                  </span>; };
                  if (rvRule === "qf") {
                    const rows = (model.reqs[S.lv] || []).map(r => [r, AE.qualityFlags(r)]).filter(([, fl]) => fl.length);
                    return (
                      <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{S.proc} 요구 품질 플래그 — {rows.length}건 <span style={{ fontWeight: 400, color: T.muted, fontSize: 10.5 }}>(모호어·검증 기준 없음·정량 기준 없음·복합 요구 의심·설계 제약 성격을 규칙으로 찾음)</span></div>
                        {!rows.length && <div style={{ fontSize: 11, color: T.green }}>플래그가 붙은 요구가 없습니다.</div>}
                        {rows.map(([r, fl]) => (
                          <div key={r.id} style={{ borderTop: `1px solid ${T.border}`, padding: "5px 0" }}>
                            <div style={{ fontSize: 11 }}>{idBtn(r.id, "qf")} <span style={{ color: T.muted }}>{r.title}</span></div>
                            <div style={{ fontSize: 10.5, color: T.amber }}>{fl.map(x => x.msg).join(" · ")}</div>
                            {rvEdit?.fkey === `qf|${r.id}` && <div style={{ marginTop: 6 }}>{editorBox()}</div>}
                          </div>))}
                      </div>);
                  }
                  const fs = rvRule === "here" ? ruleHere : findings.filter(f => f.sev === rvRule);
                  return (
                    <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{rvRule === "here" ? `${S.proc} 관련 규칙 지적` : `V-모델 전체 ${sevL[rvRule]}`} — {fs.length}건 <span style={{ fontWeight: 400, color: T.muted, fontSize: 10.5 }}>(✎가 있는 ID는 여기서 바로 고칠 수 있습니다)</span></div>
                      {!fs.length && <div style={{ fontSize: 11, color: T.green }}>해당하는 검사 결과가 없습니다.</div>}
                      {fs.map((f, i) => {
                        const fk = `rule${i}`, ids = f.ids || [];
                        const ed = rvEdit?.fkey?.startsWith(fk + "|");
                        return (
                          <div key={i} style={{ borderTop: `1px solid ${T.border}`, padding: "6px 0" }}>
                            <div style={{ fontSize: 11 }}><span style={{ color: sevC[f.sev], fontWeight: 700, marginRight: 6 }}>{sevL[f.sev]}</span>{f.msg}</div>
                            {f.bp && AE.bpKnown(f.bp) && <div style={{ fontSize: 10, color: T.muted }}>근거: {AE.bpLabel(f.bp, model.version)}</div>}
                            {f.bp === "CHANGE" && <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <button onClick={() => setTab("trace")} style={{ ...small, background: T.accent, color: "#fff", borderColor: T.accent }}>빠진 곳 점검 › 변경 영향 검토로 이동</button>
                              <span style={{ fontSize: 10, color: T.muted }}>요구를 고치면 자동으로 생기는 항목입니다. 하위(할당·파생 요구·시험)를 확인하고 판정하면 사라집니다. ✎로 요구를 다시 고쳐도 해소되지 않습니다.</span>
                            </div>}
                            {ids.length > 0 && <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap" }}>{ids.map(id => idBtn(id, fk))}{f.count > ids.length && <span style={{ fontSize: 10, color: T.muted }}>… 외 {f.count - ids.length}건 (빠진 곳 점검에서 전체 보기)</span>}</div>}
                            {ed && <div style={{ marginTop: 6 }}>{editorBox()}</div>}
                          </div>);
                      })}
                    </div>);
                })()}
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>추적성 단절·할당 누락·검증 기준 누락·시험 미연결·모호어·복합 요구 등은 AI 없이 규칙으로 판정합니다.</div>
              </AeSec>

              <AeSec title={`② 검토 AI 의견 — ${S.label} (참고 의견)`} right={rvRunning ? <button onClick={() => { rvStop.current = true; }} style={{ ...small, color: T.red, borderColor: T.red + "88" }}>■ 검토 중지</button> : <>
                <button disabled={busy || !lvItems.length} onClick={() => aiReview("changed")} style={small} title="아직 검토하지 않았거나 마지막 검토 이후 바뀐 항목만 보냅니다 (선택한 검토 AI 기준)">변경분 검토 ({changedN})</button>
                <button disabled={busy || !lvItems.length} onClick={() => aiReview("all")} style={{ ...small, background: T.accent, color: "#fff", borderColor: T.accent }} title="이 산출물의 항목을 변경 여부와 관계없이 모두 다시 보냅니다">전체 검토 ({lvItems.length})</button>
              </>}>
                {!rv && <div style={{ fontSize: 11, color: T.muted }}>검토 AI 설정을 불러오는 중…</div>}
                {rv?.error && <div style={{ fontSize: 11, color: T.red }}>검토 AI 설정 조회 실패: {rv.error}</div>}
                {rv && !rv.error && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                    <span>검토 AI:</span>
                    {readyList.length === 0 && <span style={{ color: T.red, fontSize: 10.5 }}>사용 가능한 검토 AI 없음 — 설정 → AI 연동 → AI 모델 등록에서 Gemini 또는 ChatGPT의 API 키·모델을 등록하세요</span>}
                    {readyList.map(a => <button key={a.id} disabled={busy} onClick={() => setRvProv(a.id)} title={a.model} style={{ ...small, background: rvProv === a.id ? T.accent : "none", color: rvProv === a.id ? "#fff" : T.accent }}>{a.label.replace(/ \(.*\)$/, "")} · {a.model}</button>)}
                    {rvSel && !rvSel.sameAsGenerator && <span style={{ color: T.green, fontSize: 10.5 }}>✓ 생성 AI(Claude)와 다른 모델 — 독립 검토</span>}
                    {rvSel?.sameAsGenerator && <span style={{ color: T.amber, fontSize: 10.5 }}>⚠ 생성 AI와 같은 계열 — 독립성 낮음 (다른 검토 AI 권장)</span>}
                  </div>)}
                {readyList.length > 1 && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>같은 항목을 여러 검토 AI로 각각 검토할 수 있습니다. 검토 AI별 의견은 따로 보관되며 ③에서 함께 판정합니다.</div>}
                {/* 이 산출물의 검토 AI 의견 요약 — 의견 본문과 판정은 ③에서 */}
                {(() => {
                  const fs = v.list.filter(f => f.level === rvLevel && !f.removed);
                  const withOp = new Set(fs.map(f => f.reqId));
                  const rset = AE.reviewedIds(model, rvLevel), reviewed = rset.size;
                  const noOp = [...rset].filter(id => !withOp.has(id)).length;
                  const byCrit = RC.all.map(c => [c, fs.filter(f => f.criterion === c.code).length]).filter(([, n]) => n);
                  const bySev = ["major", "minor", "info"].map(k => [k, fs.filter(f => f.severity === k).length]);
                  if (!fs.length) return <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: T.bg, fontSize: 11, color: T.muted }}>{reviewed ? `검토한 ${reviewed}건에서 검토 AI 의견이 나오지 않았습니다 (문제 없음으로 판단).` : "아직 이 산출물을 검토하지 않았습니다. 위 버튼으로 검토를 실행하세요."}</div>;
                  return (
                    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                        <b>검토 AI 의견 {fs.length}건</b>
                        <span style={{ color: T.muted, fontSize: 10.5 }}>· 의견이 달린 {K.noun} {withOp.size}건 · 검토했고 의견 없는(문제 없음) {K.noun} {noOp}건 · 미검토 {lvItems.length - reviewed}건</span>
                        <span style={{ flex: 1 }} />
                        <button onClick={() => document.getElementById("rv-judge")?.scrollIntoView({ behavior: "smooth", block: "start" })} style={{ ...small, background: T.accent, color: "#fff", borderColor: T.accent }}>③에서 의견 보고 판정하기 ↓</button>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                        {bySev.map(([k, n]) => <span key={k} title={AE.REVIEW_SEV_ABOUT[k]} style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 6, border: `1px solid ${sevColor[k]}55`, color: sevColor[k] }}>{AE.REVIEW_SEV[k]} {n}</span>)}
                        <span style={{ width: 8 }} />
                        {byCrit.map(([c, n]) => <span key={c.code} title={c.easy || c.desc} style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 6, background: T.accent + "14", color: T.text }}>{c.label} {n}</span>)}
                      </div>
                    </div>);
                })()}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 10.5, color: T.muted, flexWrap: "wrap" }}>
                  <span>검토 기준 <b style={{ color: T.text }}>① {AE.vdaVersionLabel(V)} BP 요건</b> → <b style={{ color: T.text }}>② {K.ver}</b> — {AE.REVIEW_KIND_ABOUT[S.kind].what}</span>
                  <button onClick={() => setRvGuide(g => !g)} style={{ ...small, padding: "2px 9px" }}>{rvGuide ? "검토 기준 접기 ▴" : "검토 기준 자세히 보기 ▾"}</button>
                </div>
                {rvGuide && (
                  <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, fontSize: 11, lineHeight: 1.6 }}>
                    <div style={{ marginBottom: 6, padding: "6px 8px", background: T.accent + "10", border: `1px solid ${T.accent}44`, borderRadius: 7 }}><b>① 1차 — Automotive SPICE {AE.vdaVersionLabel(V)} (VDA QMC) 프로세스 BP 요건</b>: 적용 기준으로 고른 버전의 {S.proc} BP를 항목 단위 점검문으로 요약한 것입니다(원문은 VDA QMC 발행본 기준). 검토 AI는 이 기준을 <b>먼저</b> 적용하고 코드는 <code>VDA-…</code>로 시작합니다.
                      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>{RC.vda.map(c => <div key={c.code} style={{ fontSize: 10.5 }}><code style={{ color: T.accent }}>{c.code}</code> <b>{c.label}</b> — <span style={{ color: T.muted }}>{c.desc}</span></div>)}</div></div>
                    <div style={{ marginBottom: 6 }}><b>② 2차 — {K.ver}</b>는 {AE.REVIEW_KIND_ABOUT[S.kind].what}입니다. 검토 AI는 이 기준에 해당하는 문제만 지적하고, 기준 코드가 맞지 않는 의견은 규칙으로 걸러집니다. 판 번호(1.0)를 고정해 두어 언제 어떤 기준으로 검토했는지가 기록에 남습니다.</div>
                    <div style={{ color: T.muted, marginBottom: 8 }}>근거: {AE.REVIEW_KIND_ABOUT[S.kind].std}</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr style={{ color: T.muted, textAlign: "left" }}><th style={{ padding: "4px 6px", width: 96 }}>기준</th><th style={{ padding: "4px 6px", width: "30%" }}>무엇을 보나요</th><th style={{ padding: "4px 6px" }}>이렇게 쓰면 지적됩니다</th><th style={{ padding: "4px 6px" }}>이렇게 고치면 됩니다</th></tr></thead>
                        <tbody>{K.criteria.map(c => (
                          <tr key={c.code} style={{ borderTop: `1px solid ${T.border}`, verticalAlign: "top" }}>
                            <td style={{ padding: "6px" }}><b>{c.label}</b><div style={{ color: T.muted, fontSize: 9.5, fontFamily: "monospace" }}>{c.code}</div></td>
                            <td style={{ padding: "6px" }}>{c.easy || c.desc}</td>
                            <td style={{ padding: "6px", color: T.red }}>{c.bad ? `✕ ${c.bad}` : "-"}</td>
                            <td style={{ padding: "6px", color: T.green }}>{c.good ? `○ ${c.good}` : "-"}</td>
                          </tr>))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: 8, color: T.muted }}>
                      심각도 — {["major", "minor", "info"].map(k => `${AE.REVIEW_SEV[k]}: ${AE.REVIEW_SEV_ABOUT[k]}`).join(" · ")}<br />
                      판정 — {["valid", "invalid", "opinion"].map(k => `${AE.REVIEW_JUDGE_SHORT[k]}: ${AE.REVIEW_JUDGE_ABOUT[k]}`).join(" / ")}
                      {S.kind === "unit" && <><br />상세설계가 TBD(코드 확정 후 작성)인 유닛은 그 미작성 자체를 지적하지 않습니다.</>}
                      {S.kind === "test" && <><br />TBD로 명시된 부분은 지적하지 않습니다.</>}
                    </div>
                  </div>)}
                {lastRun && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>
                  마지막 검토 {String(lastRun.at).slice(0, 16).replace("T", " ")} · {lastRun.label || lastRun.provider} {lastRun.model} · 기준 {lastRun.criteria} · 검토 {lastRun.reviewed}건 · 판정 대기로 등록 {lastRun.kept}건 · 규칙으로 걸러냄 {lastRun.dropped}건{lastRun.failed ? ` · 실패 ${lastRun.failed}건` : ""}
                </div>}
              </AeSec>

              <AeSec title={`②-b 수정안 승인 큐 — ${S.label}${fixQ && fixQ.key === rvLevel ? ` · 대기 ${fixQ.cards.filter(c => c.status === "pending").length} · 승인 ${fixQ.cards.filter(c => String(c.status).startsWith("approved")).length} · 반려 ${fixQ.cards.filter(c => c.status === "rejected").length}` : ""}`}
                right={<div style={{ display: "flex", gap: 6 }}>
                  {fixQ && fixQ.key === rvLevel && fixQ.cards.length > 1 && <>
                    <button onClick={() => setCardsOpen(fixQ.cards.map(c => `fq|${c.id}`), true)} style={{ ...small, color: T.muted }}>▾ 모두 펼치기</button>
                    <button onClick={() => setCardsOpen(fixQ.cards.map(c => `fq|${c.id}`), false)} style={{ ...small, color: T.muted }}>▸ 모두 접기</button>
                  </>}
                  {fixQ && fixQ.key === rvLevel && fixQ.cards.some(c => c.status === "pending" && !c.err) && <button disabled={busy} onClick={approveAll} style={{ ...small, color: T.green }}>남은 {fixQ.cards.filter(c => c.status === "pending" && !c.err).length}건 모두 승인</button>}
                  <Btn disabled={busy || !AE.fixQueueTargets(model, rvLevel).length} onClick={genFixQueue} title="미판정 또는 '맞음인데 미수정' 의견이 달린 항목마다 수정안을 만듭니다 — 규칙으로 되는 것은 규칙이, 문장은 생성 AI(Claude)가. 승인 전에는 아무것도 바뀌지 않습니다" style={{ fontSize: 11, padding: "4px 12px" }}>✦ 수정안 생성 ({AE.fixQueueTargets(model, rvLevel).length}건)</Btn>
                </div>}>
                <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8, lineHeight: 1.6 }}>
                  의견이 달린 항목마다 <b>수정 전 → 수정 후</b>를 보여줍니다. <b style={{ color: T.green }}>승인</b> = 수정 적용 + 그 의견을 '맞음'으로 판정 + 이력 기록 · <b>편집 후 승인</b> = 편집기에서 손본 뒤 적용 · <b>반려</b> = 아무것도 바꾸지 않고 의견은 ③에서 개별 판정(틀림·보류). 규칙 초안은 결정론적(상위 검증 기준 상속), AI 초안은 의견과 상위 원문을 근거로 하며 원문에 없는 수치는 'TBD(확인 필요)'로만 들어옵니다. 승인 후에는 '변경분 검토'로 수정 결과를 재검토하세요.
                </div>
                {(!fixQ || fixQ.key !== rvLevel) && <div style={{ fontSize: 11, color: T.muted }}>아직 생성한 수정안이 없습니다. [✦ 수정안 생성]을 누르세요.{fixQ && fixQ.key !== rvLevel ? ` (다른 산출물 '${AE.reviewScope(fixQ.key)?.label}'의 큐가 있습니다 — 그 산출물을 선택하면 보입니다)` : ""}</div>}
                {fixQ && fixQ.key === rvLevel && fixQ.cards.map(c => {
                  const pend = c.status === "pending";
                  const col = pend ? T.border : String(c.status).startsWith("approved") ? T.green + "66" : T.muted + "66";
                  const ck = `fq|${c.id}`;
                  const cOpen = rvEdit?.fkey === ck || isCardOpen(ck, pend);
                  const cToggle = () => setCardsOpen([ck], !cOpen);
                  return (
                    <div key={c.id} style={{ border: `1px solid ${col}`, borderRadius: 9, padding: "8px 10px", marginBottom: 8, background: T.bg, opacity: pend ? 1 : 0.75 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11.5 }}>
                        <AeFoldBtn open={cOpen} onClick={cToggle} />
                        <span onClick={cToggle} style={{ fontFamily: "monospace", color: T.accent, cursor: "pointer" }}>{c.id}</span><b onClick={cToggle} title={cOpen ? "눌러서 접기" : "눌러서 펼치기"} style={{ flex: 1, cursor: "pointer", userSelect: "none" }}>{c.title}</b>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: c.kind === "rule" ? T.green + "22" : T.accent + "22", color: c.kind === "rule" ? T.green : T.accent }}>{c.kind === "rule" ? "규칙 초안" : "AI 초안"}</span>
                        <span style={{ fontSize: 10, color: T.muted }}>의견 {c.opinions.length}건: {[...new Set(c.opinions.map(o => critLabel[o.criterion] || o.criterion))].join(" · ")}</span>
                        {!pend && <span style={{ fontSize: 10.5, color: String(c.status).startsWith("approved") ? T.green : T.muted }}>{String(c.status).startsWith("approved") ? "✓ 승인됨" : "반려됨"}</span>}
                      </div>
                      {cOpen && <>
                      {c.err && <div style={{ fontSize: 10.5, color: T.amber, marginTop: 4 }}>⚠ {c.err}</div>}
                      {Object.keys(c.fields).length > 0 && (
                        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: "4px 8px", fontSize: 10.5 }}>
                          <span style={{ color: T.muted }}>필드</span><span style={{ color: T.muted }}>수정 전</span><span style={{ color: T.muted }}>수정 후</span>
                          {Object.keys(c.fields).map(k => { const fd = c.fieldsSpec.find(f => f.k === k); return (
                            <React.Fragment key={k}>
                              <span style={{ color: T.muted }}>{fd?.label || k}</span>
                              <span style={{ color: T.red, textDecoration: "line-through", lineHeight: 1.5 }}>{c.original[k] || "(비어 있음)"}</span>
                              <span style={{ color: T.green, lineHeight: 1.5 }}>{c.fields[k]}</span>
                            </React.Fragment>); })}
                        </div>)}
                      {c.rationale && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>변경 이유: {c.rationale}</div>}
                      <details style={{ fontSize: 10.5, marginTop: 4 }}><summary style={{ cursor: "pointer", color: T.muted }}>반영한 의견 보기</summary>{c.opinions.map(o => <div key={o.key} style={{ paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginTop: 3 }}><b>{critLabel[o.criterion] || o.criterion}</b> · {AE.REVIEW_SEV[o.severity]} — {o.issue}{o.suggestion ? <span style={{ color: T.green }}> / 제안: {o.suggestion}</span> : null}</div>)}</details>
                      {pend && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                          <button disabled={busy} onClick={() => finishQueueCard(c.id, "rejected")} style={{ ...small, color: T.muted }}>반려 (바꾸지 않음)</button>
                          <button disabled={busy} onClick={() => { const sp = AE.reviewEditSpec(model, fixQ.key, c.id); if (!sp) return; setRvEdit({ fkey: `fq|${c.id}`, key: fixQ.key, id: c.id, vals: { ...sp.values, ...c.fields }, aiDraft: Object.keys(c.fields).length ? { fields: c.fields, original: Object.fromEntries(Object.keys(c.fields).map(k => [k, sp.values[k] ?? ""])), rationale: c.rationale, opinions: c.opinions.length } : null }); }} style={{ ...small, color: T.accent, background: rvEdit?.fkey === `fq|${c.id}` ? T.accent + "22" : "none" }}>✎ 편집 후 승인</button>
                          {Object.keys(c.fields).length > 0 && <button disabled={busy} onClick={() => approveCard(c)} style={{ ...small, background: T.green, color: "#fff", borderColor: T.green }}>✓ 승인</button>}
                        </div>)}
                      {rvEdit?.fkey === `fq|${c.id}` && <div style={{ marginTop: 8 }}>{editorBox(c.opinions.filter(o => o.suggestion).map(o => `[${critLabel[o.criterion] || o.criterion}] ${o.suggestion}`).join(" / "))}</div>}
                      </>}
                    </div>);
                })}
              </AeSec>

              <div id="rv-judge" />
              <AeSec title={`③ QA 담당자 판정 — 미판정 ${cnt.open} · 맞음 ${cnt.valid} · 틀림 ${cnt.invalid} · 보류 ${cnt.opinion}${cnt.edited ? ` · ✎ 수정함 ${cnt.edited}` : ""}${cnt.stale ? ` · 내용 변경됨 ${cnt.stale}` : ""}`}
                right={<div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end" }}>{reviewers.length > 1 && <select value={rvBy} onChange={e => setRvBy(e.target.value)} style={{ ...small, color: T.text, background: T.bg }}><option value="all">검토 AI 전체</option>{reviewers.map(x => <option key={x} value={x}>{x}</option>)}</select>}{[["open", "미판정"], ["valid", "✓ 맞음"], ["invalid", "✕ 틀림"], ["opinion", "△ 보류"], ["edited", "✎ 수정함"], ["validTodo", "맞음인데 아직 안 고침"], ["all", "전체"]].map(([k, l]) => <button key={k} onClick={() => setRvFilter(k)} style={{ ...small, background: rvFilter === k ? T.accent : "none", color: rvFilter === k ? "#fff" : T.accent }}>{l}</button>)}</div>}>
                <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 6, lineHeight: 1.6 }}>
                  각 의견마다 <b>"AI의 이 지적이 맞는가?"</b>를 판정합니다. <b style={{ color: T.green }}>✓ 맞음</b> = 지적이 맞다 → 산출물을 고친다(✎ 대상 수정) · <b>✕ 틀림</b> = 지적이 틀리거나 이 과제에 맞지 않다 → 그대로 두고 사유를 적는다 · <b style={{ color: T.accent }}>△ 보류</b> = 지금 판단하기 어렵다 → 참고로 남긴다. 빠진 곳 점검의 변경 영향 검토 '영향 없음·하위 수정 필요'와는 다른 판정입니다.
                </div>
                {!cnt.total && <div style={{ fontSize: 11, color: T.muted }}>아직 검토 AI 의견이 없습니다. ②에서 검토를 실행하세요.</div>}
                {cnt.total > 0 && !list.length && <div style={{ fontSize: 11, color: T.muted }}>해당하는 항목이 없습니다.</div>}
                {list.length > 0 && (() => {
                  const sevRank = { major: 0, minor: 1, info: 2 };
                  const sorted = [...list].sort((a, b) => rvSort === "sev" ? (sevRank[a.severity] - sevRank[b.severity]) || a.reqId.localeCompare(b.reqId) : a.reqId.localeCompare(b.reqId) || (sevRank[a.severity] - sevRank[b.severity]));
                  const openList = sorted.filter(f => !f.judge && !f.removed);
                  const bulk = (fs, st) => {
                    if (!fs.length) return;
                    let note = "";
                    if (st === "invalid" || st === "opinion") { note = window.prompt(`${fs.length}건에 같은 사유를 적용합니다 — ${st === "invalid" ? "지적이 틀렸다고 보는 이유" : "보류 사유"}를 적어 주세요`, ""); if (note === null) return; }
                    else if (!window.confirm(`표시된 미판정 의견 ${fs.length}건을 모두 '맞음 → 고침'으로 판정합니다. 이후 대상별로 ✎ 대상 수정에서 고치면 됩니다.\n\n계속할까요?`)) return;
                    setModel(m => AE.judgeReview(m, fs.map(f => f.key), st, note));
                  };
                  return (<>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 10.5 }}>
                      <span style={{ color: T.muted }}>보기:</span>
                      <button onClick={() => setRvGroup(true)} style={{ ...small, background: rvGroup ? T.accent : "none", color: rvGroup ? "#fff" : T.accent }}>대상별 묶음</button>
                      <button onClick={() => setRvGroup(false)} style={{ ...small, background: !rvGroup ? T.accent : "none", color: !rvGroup ? "#fff" : T.accent }}>의견별 표</button>
                      <span style={{ color: T.muted, marginLeft: 6 }}>정렬:</span>
                      <button onClick={() => setRvSort("sev")} style={{ ...small, background: rvSort === "sev" ? T.accent : "none", color: rvSort === "sev" ? "#fff" : T.accent }}>중대 먼저</button>
                      <button onClick={() => setRvSort("id")} style={{ ...small, background: rvSort === "id" ? T.accent : "none", color: rvSort === "id" ? "#fff" : T.accent }}>ID 순</button>
                      {openList.length > 1 && <>
                        <span style={{ flex: 1 }} />
                        <span style={{ color: T.muted }}>표시된 미판정 {openList.length}건 일괄:</span>
                        <button disabled={busy} onClick={() => bulk(openList, "valid")} style={{ ...small, color: T.green }}>✓ 모두 맞음</button>
                        <button disabled={busy} onClick={() => bulk(openList, "opinion")} style={{ ...small, color: T.accent }}>△ 모두 보류</button>
                        <button disabled={busy} onClick={() => bulk(openList, "invalid")} style={{ ...small, color: T.muted }}>✕ 모두 틀림</button>
                      </>}
                    </div>
                    {rvGroup && (() => {
                      const groups = [];
                      sorted.forEach(f => { let g = groups.find(x => x.id === f.reqId); if (!g) { g = { id: f.reqId, title: f.reqTitle, fs: [] }; groups.push(g); } g.fs.push(f); });
                      const gKeys = groups.map(g => `jg|${rvLevel}|${g.id}`);
                      const foldBar = groups.length > 1 && <div key="__fold" style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 6 }}>
                        <button onClick={() => setCardsOpen(gKeys, true)} style={{ ...small, color: T.muted }}>▾ 대상 모두 펼치기</button>
                        <button onClick={() => setCardsOpen(gKeys, false)} style={{ ...small, color: T.muted }}>▸ 대상 모두 접기</button>
                      </div>;
                      const agr = AE.reviewAgreement(v.list.filter(f => f.level === rvLevel && !f.removed));
                      return [foldBar, ...groups.map(g => {
                        const refs = AE.reviewRefs(model, rvLevel, g.id);
                        const open_ = g.fs.filter(f => !f.judge && !f.removed);
                        const gk = `jg|${rvLevel}|${g.id}`;
                        const gOpen = rvEdit?.fkey === `grp|${g.id}` || isCardOpen(gk, open_.length > 0);
                        const gToggle = () => setCardsOpen([gk], !gOpen);
                        const sp = AE.reviewEditSpec(model, rvLevel, g.id);
                        const edited = g.fs.some(f => f.edits.length);
                        const vals = sp?.values || {};
                        return (
                          <div key={g.id} style={{ border: `1px solid ${open_.length ? T.border : T.green + "55"}`, borderRadius: 9, padding: "8px 10px", marginBottom: 8, background: T.bg }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 260 }}>
                                <div style={{ fontSize: 11.5, display: "flex", alignItems: "baseline", gap: 2 }}><AeFoldBtn open={gOpen} onClick={gToggle} /><span onClick={gToggle} title={gOpen ? "눌러서 접기" : "눌러서 펼치기"} style={{ cursor: "pointer", userSelect: "none" }}><span style={{ fontFamily: "monospace", color: T.accent, marginRight: 6 }}>{g.id}</span><b>{g.title}</b> <span style={{ color: T.muted, fontSize: 10 }}>· 의견 {g.fs.length}건 · 미판정 {open_.length}{edited ? " · ✎ 수정함" : ""}</span></span></div>
                                {gOpen && sp && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>
                                  {sp.fields.filter(fd => vals[fd.k]).slice(0, 4).map(fd => <div key={fd.k}><span style={{ color: T.muted }}>{fd.label}:</span> <span style={{ color: T.text }}>{String(vals[fd.k]).slice(0, 220)}{String(vals[fd.k]).length > 220 ? "…" : ""}</span></div>)}
                                </div>}
                                {gOpen && refs.length > 0 && <details style={{ fontSize: 10.5, marginTop: 4 }}>
                                  <summary style={{ cursor: "pointer", color: T.accent }}>관련 상위·참조 항목 {refs.length}건 보기 (일관성·완전성 지적은 이것과 비교해 판정)</summary>
                                  {refs.slice(0, 6).map(r => <div key={r.id} style={{ marginTop: 3, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, color: T.text }}><span style={{ fontFamily: "monospace", color: T.accent }}>{r.id}</span> <span style={{ color: T.muted }}>{r.구분}</span> {r.제목 ? <b>{r.제목} </b> : null}{r.내용 || r.책임 || r.설계 || r["신호·데이터"] || ""}{r.검증기준 ? <div style={{ color: T.muted }}>검증 기준: {r.검증기준}</div> : null}</div>)}
                                </details>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                                {open_.length > 0 && <div style={{ display: "flex", gap: 3 }}>
                                  <span style={{ fontSize: 10, color: T.muted, alignSelf: "center" }}>이 대상 의견 전부:</span>
                                  <button disabled={busy} onClick={() => bulk(open_, "valid")} style={{ ...small, padding: "2px 7px", color: T.green }}>✓ 맞음</button>
                                  <button disabled={busy} onClick={() => bulk(open_, "invalid")} style={{ ...small, padding: "2px 7px", color: T.muted }}>✕ 틀림</button>
                                  <button disabled={busy} onClick={() => bulk(open_, "opinion")} style={{ ...small, padding: "2px 7px", color: T.accent }}>△ 보류</button>
                                </div>}
                                {sp && <button disabled={busy} onClick={() => openEdit(`grp|${g.id}`, rvLevel, g.id)} style={{ ...small, padding: "3px 9px", background: rvEdit?.fkey === `grp|${g.id}` ? T.accent : "none", color: rvEdit?.fkey === `grp|${g.id}` ? "#fff" : T.accent }}>✎ 대상 수정 (의견 전부 반영)</button>}
                              </div>
                            </div>
                            {gOpen && <div style={{ marginTop: 6, borderTop: `1px solid ${T.border}` }}>
                              {g.fs.map(f => (
                                <div key={f.key} style={{ display: "grid", gridTemplateColumns: "86px 1fr 230px", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}22`, fontSize: 10.5, opacity: f.judge?.state === "invalid" ? 0.6 : 1 }}>
                                  <div><div>{AE.isVdaCode(f.criterion) && <span style={{ fontSize: 9, color: "#fff", background: T.accent, borderRadius: 4, padding: "0 4px", marginRight: 4 }}>ASPICE BP</span>}{critLabel[f.criterion] || f.criterion}</div><div style={{ color: sevColor[f.severity], fontSize: 10 }}>{AE.REVIEW_SEV[f.severity]}</div>{f.reviewer && <div style={{ color: T.muted, fontSize: 9.5 }}>{f.reviewer.replace(/ \(.*\)$/, "")}</div>}{(agr[`${f.level}|${f.reqId}|${f.criterion}`] || 0) >= 2 && <div title="서로 다른 검토 AI가 같은 기준으로 같은 대상을 지적했습니다 — 독립된 두 검토가 일치" style={{ color: T.green, fontSize: 9.5, fontWeight: 700 }}>◎ 검토 AI {agr[`${f.level}|${f.reqId}|${f.criterion}`]}곳 일치</div>}</div>
                                  <div style={{ lineHeight: 1.5 }}>
                                    {f.evidence && <div>근거: <span style={{ background: T.amber + "22", padding: "0 3px", borderRadius: 3 }}>"{f.evidence}"</span></div>}
                                    <div>{f.issue}</div>
                                    {f.suggestion && <div style={{ color: T.green }}>제안: {f.suggestion}</div>}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, marginBottom: 2, color: f.judge ? jColor[f.judge.state] : T.amber }}>{f.judge ? `판정: ${AE.REVIEW_JUDGE[f.judge.state]}` : "○ 미판정"}</div>
                                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                      {["valid", "invalid", "opinion"].map(st => { const on = f.judge?.state === st; return <button key={st} disabled={busy} title={AE.REVIEW_JUDGE_ABOUT[st]} onClick={() => judge(f, st)} style={{ ...small, padding: "2px 6px", background: on ? jColor[st] : "none", color: on ? "#fff" : T.muted, borderColor: on ? jColor[st] : T.border }}>{AE.REVIEW_JUDGE_SHORT[st]}</button>; })}
                                      {f.judge && <button onClick={() => setModel(m => AE.judgeReview(m, [f.key], null))} style={{ ...small, padding: "2px 6px", color: T.muted }} title="판정 취소">↺</button>}
                                    </div>
                                    {f.judge?.note && <div style={{ fontSize: 9.5, color: T.muted, marginTop: 2 }}>— {f.judge.note}</div>}
                                  </div>
                                </div>))}
                            </div>}
                            {rvEdit?.fkey === `grp|${g.id}` && <div style={{ marginTop: 8 }}>{editorBox(g.fs.filter(f => f.suggestion && f.judge?.state !== "invalid").map(f => `[${critLabel[f.criterion] || f.criterion}] ${f.suggestion}`).join(" / "))}</div>}
                          </div>);
                      })];
                    })()}
                    {!rvGroup && null}
                  </>);
                })()}
                {list.length > 0 && !rvGroup && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ color: T.muted, textAlign: "left" }}>
                        <th style={{ padding: "4px 6px", width: 96 }}>대상</th><th style={{ padding: "4px 6px", width: 92 }}>기준·심각도</th>
                        <th style={{ padding: "4px 6px" }}>검토 의견</th><th style={{ padding: "4px 6px", width: 200 }}>판정</th>
                      </tr></thead>
                      <tbody>{list.map(f => (<React.Fragment key={f.key}>
                        <tr style={{ borderTop: `1px solid ${T.border}`, verticalAlign: "top", opacity: f.judge?.state === "invalid" && rvEdit?.fkey !== f.key ? 0.6 : 1 }}>
                          <td style={{ padding: "6px", fontFamily: "monospace", wordBreak: "break-all" }}>{f.reqId}
                            {f.edits.length > 0
                              ? <div style={{ marginTop: 4, padding: "2px 6px", borderRadius: 5, background: T.green + "1F", border: `1px solid ${T.green}66`, color: T.green, fontSize: 9.5, fontFamily: "inherit", fontWeight: 700 }}>✎ 수정함 {f.edits.length > 1 ? `${f.edits.length}회` : ""}<div style={{ fontWeight: 400 }}>{String(f.edits[f.edits.length - 1].at).slice(5, 16).replace("T", " ")}</div></div>
                              : !f.removed && <div style={{ marginTop: 4, color: T.muted, fontSize: 9.5, fontFamily: "inherit" }}>수정 안 함</div>}
                            {f.stale && <div style={{ color: T.amber, fontSize: 9.5, fontFamily: "inherit", marginTop: 2 }}>{f.edits.length ? "재검토로 확인 필요" : "내용 변경됨 — 재검토 권장"}</div>}
                            {f.removed && <div style={{ color: T.red, fontSize: 9.5, fontFamily: "inherit" }}>대상 삭제됨</div>}</td>
                          <td style={{ padding: "6px" }}><div>{AE.isVdaCode(f.criterion) && <span style={{ fontSize: 9, color: "#fff", background: T.accent, borderRadius: 4, padding: "0 4px", marginRight: 4 }}>ASPICE BP</span>}{critLabel[f.criterion] || f.criterion}</div><div style={{ color: sevColor[f.severity], fontSize: 10 }}>{AE.REVIEW_SEV[f.severity]}</div>{f.reviewer && <div style={{ color: T.muted, fontSize: 9.5 }} title={f.reviewerModel}>{f.reviewer.replace(/ \(.*\)$/, "")}</div>}</td>
                          <td style={{ padding: "6px", lineHeight: 1.5 }}>
                            <div style={{ color: T.muted, fontSize: 10 }}>{f.reqTitle}</div>
                            {f.evidence && <div style={{ fontSize: 10.5 }}>근거: <span style={{ background: T.amber + "22", padding: "0 3px", borderRadius: 3 }}>"{f.evidence}"</span></div>}
                            <div>{f.issue}</div>
                            {f.suggestion && <div style={{ color: T.green, fontSize: 10.5 }}>제안: {f.suggestion}</div>}
                            {f.edits.length > 0 && (
                              <details style={{ marginTop: 4, fontSize: 10.5 }}>
                                <summary style={{ cursor: "pointer", color: T.green }}>수정 내용 보기 — {[...new Set(f.edits.flatMap(e => e.changes.map(c => c.label)))].join(", ")}</summary>
                                {f.edits.map((e, i) => (
                                  <div key={i} style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${T.green}66` }}>
                                    <div style={{ color: T.muted, fontSize: 9.5 }}>{String(e.at).slice(0, 16).replace("T", " ")}{e.via === "rule" ? " · 규칙 검사 결과에서 수정" : ""}</div>
                                    {e.changes.map((c, j) => <div key={j}><b>{c.label}</b>: <span style={{ color: T.red, textDecoration: "line-through" }}>{c.before || "(비어 있음)"}</span> → <span style={{ color: T.green }}>{c.after || "(비어 있음)"}</span></div>)}
                                  </div>))}
                              </details>)}
                          </td>
                          <td style={{ padding: "6px" }}>
                            <div style={{ fontSize: 10, marginBottom: 3, color: f.judge ? jColor[f.judge.state] : T.amber }}>{f.judge ? `판정: ${AE.REVIEW_JUDGE[f.judge.state]}` : "○ 미판정 — 아래에서 선택"}</div>
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {/* 선택 전에는 세 버튼 모두 같은 회색 — 색이 있으면 이미 선택된 것으로 오인됨. 선택된 판정만 색을 채운다 */}
                              {["valid", "invalid", "opinion"].map(st => { const on = f.judge?.state === st; return <button key={st} disabled={busy} title={AE.REVIEW_JUDGE_ABOUT[st]} onClick={() => judge(f, st)} style={{ ...small, padding: "2px 7px", background: on ? jColor[st] : "none", color: on ? "#fff" : T.muted, borderColor: on ? jColor[st] : T.border, fontWeight: on ? 700 : 400 }}>{AE.REVIEW_JUDGE_SHORT[st]}</button>; })}
                              {f.judge && <button onClick={() => setModel(m => AE.judgeReview(m, [f.key], null))} style={{ ...small, padding: "2px 7px", color: T.muted }} title="판정 취소">↺</button>}
                            </div>
                            {f.judge && <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3 }}>{String(f.judge.at).slice(0, 16).replace("T", " ")}{f.judge.note ? ` — ${f.judge.note}` : ""}</div>}
                            {!f.removed && <button disabled={busy} onClick={() => openEdit(f.key, rvLevel, f.reqId)}
                              style={{ ...small, padding: "2px 8px", marginTop: 5, background: rvEdit?.fkey === f.key ? T.accent : "none", color: rvEdit?.fkey === f.key ? "#fff" : (f.judge?.state === "valid" && !f.edits.length ? T.green : T.accent), borderColor: f.judge?.state === "valid" && !f.edits.length ? T.green + "88" : undefined }}>{f.edits.length ? "✎ 다시 수정" : `✎ 대상 수정${f.judge?.state === "valid" ? " (수정 필요)" : ""}`}</button>}
                          </td>
                        </tr>
                        {rvEdit?.fkey === f.key && <tr><td colSpan={4} style={{ padding: "4px 6px 12px" }}>{editorBox(f.suggestion)}</td></tr>}
                      </React.Fragment>))}
                      </tbody>
                    </table>
                  </div>)}
              </AeSec>
            </>);
          })()}

          {tab === "artifacts" && (() => {
            // ── 생성 산출물 전체 열람: 문서(docx·xlsx 내려받기) · SW 유닛 다이어그램·코드 · HW 회로도·블록도 · XMI · MISRA ──
            const artCtx = { ossp, tailoring, requirements: { ...(requirements || {}), items, aspice: model } };
            const metaF = form || {};
            const S = AE.ddSettings(model), HS = AE.hdSettings(model);
            const dl = (name, data, mime) => { const blob = new Blob([data], { type: mime || "application/octet-stream" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
            const sanitize = x => String(x || "").replace(/[\\/:*?"<>|]/g, "_");
            const groups = [];   // { cat, name, items }
            // 1) 문서
            const docItems = ASPICE_PKG_ORDER.filter(k => k === "SYS_RS" ? items.length > 0 : aspiceCanBuild(k, artCtx)).map(k => { const D = AE.ASPICE_DOCS[k]; const isX = /^(V_|R_)|RTM|STK_LIST|HW_BOM|HW_SC|HW_AN/.test(k); return { type: "doc", key: `doc:${k}`, kind: k, label: `${D.code} ${D.title}`, sub: `${D.proc} · ${isX ? "xlsx" : "docx"} · ${AE.wpLabel(k, V)}` }; });
            groups.push({ cat: "doc", name: `문서 (${docItems.length})`, items: docItems });
            // 2) SW 유닛
            const swUnits = model.units.SW.filter(u => u.dd?.classes?.length);
            if (swUnits.length) {
              groups.push({ cat: "common", name: `SWE.3 모델 공통`, items: [{ type: "text", key: "xmi", label: "UML XMI 2.1 (EA 가져오기)", sub: `유닛 ${swUnits.length}개 · xml`, get: () => AE.buildXmi(model, metaF, { seed: metaF.id || metaF.name || "project" }), file: `${sanitize(metaF.name) || "project"}_SWE3_UML2.1.xml`, mime: "application/xml" },
                { type: "table", key: "misra", label: `MISRA 적용 체크리스트 (${S.target})`, sub: `${S.target === "CP" ? S.misraC : S.misraCpp} · xlsx`, rows: () => AE.misraChecklistRows(S), file: "MISRA_적용_체크리스트.xlsx", xlsx: () => makeXlsx({ sheetName: "MISRA", rows: AE.misraChecklistRows(S) }) }] });
              swUnits.forEach(u => { const code = u.dd.code && u.dd.code.target === S.target ? u.dd.code : (() => { try { return { ...AE.generateCode(u, model, metaF, S, null), provisional: true }; } catch (_) { return null; } })();
                groups.push({ cat: "sw", name: `${u.id} ${u.name}`, items: [
                  ...AE.DD_DIAGRAMS.map(([k, lab]) => ({ type: "svg", section: "다이어그램", key: `dd:${u.id}:${k}`, label: `${lab} 다이어그램`, sub: "svg", get: () => AE.ddSvg(k, u, model), file: `${u.id}_${k}.svg` })),
                  ...([...(code?.files || [])].sort((a, b) => (/\.(c|cpp)$/.test(a.name) ? 0 : 1) - (/\.(c|cpp)$/.test(b.name) ? 0 : 1)).map((f, i) => ({ type: "code", section: "소스코드", key: `code:${u.id}:${i}`, label: f.name, sub: `${AE.DD_TARGETS[code.target]?.lang} · ${code.provisional ? "코드 생성 전 — 규칙 뼈대(연산 본문은 설계 단계 주석)" : code.origin === "ai" ? "본문 AI" : "본문 규칙"}`, get: () => f.text, file: f.name }))),
                ] }); });
            }
            // 3) HW 블록
            const hwComps = model.comps.HW.filter(c => c.hd?.parts?.length);
            if (hwComps.length) {
              groups.push({ cat: "common", name: "HWE.2 모델 공통", items: [{ type: "svg", key: "hw:block", label: "HW 아키텍처 블록도 (04-52)", sub: "svg", get: () => AE.hdSvg("block", null, model), file: "HW_architecture_block.svg" },
                { type: "table", key: "hw:bom", label: "BOM 미리보기 (14-54)", sub: "부품 PN 후보", rows: () => [["블록", "RefDes", "종류", "값", "패키지", "제조사", "PN(후보)", "정격", "근거 요구"], ...hwComps.flatMap(c => c.hd.parts.map(p => [c.name, p.ref, p.kind, p.value, p.pkg, p.mfr, p.mpn, p.rating, (p.reqs || []).join(", ")]))] },
                { type: "table", key: "hw:sc", label: "특별 특성 미리보기 (17-57)", sub: "", rows: () => [["블록", "ID", "특성", "분류", "대상", "값", "관리", "검증", "근거"], ...hwComps.flatMap(c => c.hd.specials.map(x => [c.name, x.id, x.char, x.type, x.target, x.value, x.control, x.verify, (x.reqs || []).join(", ")]))] },
                { type: "table", key: "hw:an", label: "설계 분석 미리보기 (15-51)", sub: "Derating·열·최악조건", rows: () => [["블록", "분석", "항목", "정격/공칭", "적용/최소~최대", "기준/한계", "판정", "비고"], ...hwComps.flatMap(c => [...c.hd.analysis.derating.map(x => [c.name, "Derating", `${x.ref} ${x.param}`, x.rated, x.applied, `${x.ratio} / ${x.limit}`, x.ok ? "OK" : "NG", x.note]), ...c.hd.analysis.thermal.map(x => [c.name, "열", x.ref, `Pd ${x.pd_mW}mW`, `Ta ${x.ta} → Tj ${x.tj}`, x.limit, x.ok ? "OK" : "NG", x.note]), ...c.hd.analysis.worstCase.map(x => [c.name, "최악조건", x.item, x.nominal, `${x.min} ~ ${x.max}`, x.limit, x.ok ? "OK" : "NG", `${x.method} ${x.note}`])])] }] });
              hwComps.forEach(c => groups.push({ cat: "hw", name: `${c.id} ${c.name}`, items: [{ type: "svg", key: `hd:${c.id}`, label: "회로도 (04-54)", sub: `부품 ${c.hd.parts.length} · 넷 ${c.hd.nets.length} · svg`, get: () => AE.hdSvg("schematic", c, model), file: `${c.id}_schematic.svg` },
                { type: "table", key: `hdp:${c.id}`, label: "부품·넷 표", sub: "", rows: () => [["RefDes", "종류", "값", "패키지", "제조사 / PN(후보)", "정격", "용도", "핀→넷"], ...c.hd.parts.map(p => [p.ref, p.kind, p.value, p.pkg, `${p.mfr} / ${p.mpn}`, p.rating, p.desc, c.hd.conns.filter(x => x.ref === p.ref).map(x => `${x.pin}:${x.net}`).join(" ")])] }] }));
            }
            const q = artQ.trim().toLowerCase();
            const catOf = { doc: "문서", sw: `SW 유닛 (${swUnits.length})`, hw: `HW 블록 (${hwComps.length})`, common: "모델 공통" };
            const vis = groups.filter(g => q ? true : g.cat === artCat).map(g => ({ ...g, items: g.items.filter(it => !q || `${g.name} ${it.label} ${it.sub || ""}`.toLowerCase().includes(q)) })).filter(g => g.items.length);
            const total = groups.reduce((n, g) => n + g.items.length, 0);
            const collapsible = g => g.cat === "sw" || g.cat === "hw";
            const isOpen = g => !collapsible(g) || !!q || artOpen.has(g.name);
            const toggle = name => setArtOpen(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
            const sel = artSel && groups.flatMap(g => g.items).find(it => it.key === artSel) || null;
            const loadPrev = async (it) => { if (!it || it.type !== "doc" || (artPrev && artPrev.key === it.key && artPrev.kind !== "error")) return; setArtPrev({ key: it.key, kind: "loading" }); try { const of = await buildVmodelDoc(it.kind, metaF, artCtx); if (!of) { setArtPrev({ key: it.key, kind: "error", msg: "생성할 내용이 없습니다." }); return; } const pv = await previewOfficeBytes(of.bytes, of.ext); setArtPrev({ key: it.key, ...pv, tab: 0, bytes: of.bytes, ext: of.ext }); } catch (e) { setArtPrev({ key: it.key, kind: "error", msg: e.message }); } };
            if (sel && sel.type === "doc" && (!artPrev || artPrev.key !== sel.key)) setTimeout(() => loadPrev(sel), 0);
            const dlDoc = async (it) => { try { setNote(`${it.label} 생성 중…`); const of = await buildVmodelDoc(it.kind, metaF, artCtx); if (!of) { setErr("생성할 내용이 없습니다."); return; } dl(`${AE.ASPICE_DOCS[it.kind].code}_${sanitize(AE.ASPICE_DOCS[it.kind].title)}.${of.ext}`, of.bytes, of.ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); setNote(`${it.label} 내려받음`); } catch (e) { setErr(`${it.label} 생성 실패: ${e.message}`); } };
            const dlAll = () => { if (busy || zipAllBusy.current) return; zipAllBusy.current = true; setNote("전체 산출물 ZIP 생성 중… (V-모델 산출물 ZIP과 동일)"); downloadAspicePackage(metaF, artCtx).then(() => setNote("전체 산출물 ZIP 내려받음")).catch(e => setErr("ZIP 실패: " + e.message)).finally(() => { zipAllBusy.current = false; }); };
            return (
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 10, minHeight: 420 }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, background: T.bg, display: "flex", flexDirection: "column", maxHeight: 640 }}>
                  <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 6, alignItems: "center" }}>
                    <input value={artQ} onChange={e => setArtQ(e.target.value)} placeholder={`검색 (${total}개 산출물)`} style={{ ...inp, flex: 1 }} />
                    <button onClick={dlAll} title="문서·다이어그램·코드·회로도를 모두 담은 ZIP (V-모델 산출물 ZIP)" style={small}>⬇ 전체</button>
                  </div>
                  {!q && <div style={{ display: "flex", gap: 3, padding: "6px 8px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>{Object.entries(catOf).map(([k, lab]) => <button key={k} onClick={() => setArtCat(k)} style={{ ...small, padding: "3px 9px", color: artCat === k ? "#fff" : T.muted, background: artCat === k ? T.accent : "transparent", borderColor: artCat === k ? T.accent : T.border }}>{lab}</button>)}</div>}
                  <div style={{ overflowY: "auto", flex: 1, padding: 6 }}>
                    {vis.map(g => (
                      <div key={g.name} style={{ marginBottom: 4 }}>
                        {collapsible(g) && !q
                          ? <button onClick={() => toggle(g.name)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, background: isOpen(g) ? T.accent + "14" : "none", border: `1px solid ${isOpen(g) ? T.accent + "66" : T.border}`, borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: T.text, fontFamily: "inherit", textAlign: "left" }}><span style={{ color: T.muted, fontSize: 10 }}>{isOpen(g) ? "▾" : "▸"}</span><span style={{ fontSize: 11.5, fontWeight: 600, flex: 1 }}>{g.name}</span><span style={{ fontSize: 9.5, color: T.muted }}>{g.items.length}</span></button>
                          : <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, padding: "4px 6px" }}>{g.name}</div>}
                        {isOpen(g) && g.items.map((it, idx) => <React.Fragment key={it.key}>{it.section && (idx === 0 || g.items[idx - 1].section !== it.section) && <div style={{ fontSize: 9.5, color: it.section === "소스코드" ? T.green : T.muted, fontWeight: 700, padding: "4px 6px 1px 18px" }}>{it.section === "소스코드" ? "💻 소스코드" : "🖼 다이어그램"}{it.section === "소스코드" && it.sub?.includes("코드 생성 전") ? <span style={{ fontWeight: 400, color: T.amber }}> — 코드 생성 전(규칙 뼈대)</span> : null}</div>}{ <button onClick={() => setArtSel(it.key)} style={{ display: "block", width: collapsible(g) ? "calc(100% - 10px)" : "100%", textAlign: "left", background: artSel === it.key ? T.accent + "22" : "none", border: `1px solid ${artSel === it.key ? T.accent : "transparent"}`, borderRadius: 6, padding: "3px 8px", marginLeft: collapsible(g) ? 10 : 0, cursor: "pointer", color: T.text, fontFamily: "inherit" }}>
                          <div style={{ fontSize: 11.5 }}>{it.type === "doc" ? "📄" : it.type === "svg" ? "🖼" : it.type === "code" ? "💻" : it.type === "table" ? "📊" : "📑"} {it.label}</div>
                          {it.sub ? <div style={{ fontSize: 9.5, color: T.muted }}>{it.sub}</div> : null}
                        </button>}</React.Fragment>)}
                      </div>))}
                    {!vis.length && <div style={{ fontSize: 11, color: T.muted, padding: 10 }}>{total ? (q ? "검색 결과 없음" : "이 분류에 산출물이 없습니다.") : "아직 생성된 산출물이 없습니다. SYS.2 확정 → SYS.3 → SWE.3 상세설계·코드 / HWE.2 회로 설계를 진행하세요."}</div>}
                  </div>
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 640 }}>
                  {!sel && <div style={{ padding: 16, fontSize: 11.5, color: T.muted }}>왼쪽에서 산출물을 고르세요. 문서(Word·Excel)·다이어그램·회로도·코드·표가 모두 여기서 바로 보입니다(문서는 현재 모델로 생성해 미리보기로 변환 — 서식은 단순화됨). 모든 항목은 '전체 ZIP 다운로드'에도 같은 내용으로 들어갑니다.</div>}
                  {sel && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      <b style={{ fontSize: 12 }}>{sel.label}</b><span style={{ fontSize: 10, color: T.muted }}>{sel.sub}</span><div style={{ flex: 1 }} />
                      {sel.type === "doc" && <button onClick={() => { if (artPrev?.key === sel.key && artPrev.bytes) dl(`${AE.ASPICE_DOCS[sel.kind].code}_${sanitize(AE.ASPICE_DOCS[sel.kind].title)}.${artPrev.ext}`, artPrev.bytes, artPrev.ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); else dlDoc(sel); }} style={{ ...small, background: T.accent, color: "#fff", borderColor: T.accent }}>⬇ 문서 내려받기</button>}
                      {(sel.type === "svg" || sel.type === "code" || sel.type === "text") && <button onClick={() => dl(sel.file, sel.get(), sel.type === "svg" ? "image/svg+xml" : sel.mime || "text/plain")} style={small}>⬇ {sel.file}</button>}
                      {sel.type === "table" && sel.xlsx && <button onClick={() => dl(sel.file, sel.xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} style={small}>⬇ xlsx</button>}
                    </div>)}
                  {sel?.type === "doc" && artPrev?.key === sel.key && artPrev.kind === "loading" && <div style={{ padding: 16, fontSize: 11.5, color: T.muted }}>⏳ 문서를 생성해 미리보기로 바꾸는 중…</div>}
                  {sel?.type === "doc" && artPrev?.key === sel.key && artPrev.kind === "error" && <div style={{ padding: 16, fontSize: 11.5, color: T.red }}>미리보기 실패: {artPrev.msg}</div>}
                  {sel?.type === "doc" && artPrev?.key === sel.key && artPrev.kind === "html" && <div style={{ overflow: "auto", flex: 1, background: "#E9EBEF" }}><div dangerouslySetInnerHTML={{ __html: artPrev.html }} /></div>}
                  {sel?.type === "doc" && artPrev?.key === sel.key && artPrev.kind === "sheets" && (
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                      <div style={{ display: "flex", gap: 3, padding: "6px 8px", background: T.bg, borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>{artPrev.sheets.map((sh, i) => <button key={i} onClick={() => setArtPrev(v => ({ ...v, tab: i }))} style={{ ...small, padding: "3px 9px", color: artPrev.tab === i ? "#fff" : T.muted, background: artPrev.tab === i ? T.accent : "transparent", borderColor: artPrev.tab === i ? T.accent : T.border }}>{sh.name}</button>)}</div>
                      <div style={{ overflow: "auto", flex: 1, background: "#fff", color: "#222", padding: 8 }} dangerouslySetInnerHTML={{ __html: artPrev.sheets[artPrev.tab]?.html || "" }} />
                    </div>)}
                  {sel?.type === "doc" && !(artPrev?.key === sel.key) && (() => { const D = AE.ASPICE_DOCS[sel.kind]; return (
                    <div style={{ padding: 14, fontSize: 11.5, lineHeight: 1.7 }}>
                      <div><b>{D.code} {D.title}</b> — {AE.procLabel(D.proc.split("~")[0], V)}</div>
                      <div style={{ color: T.muted }}>정보항목: {AE.wpLabel(sel.kind, V)}</div>
                      <div style={{ marginTop: 8 }}>현재 추적 모델에서 바로 생성됩니다(저장 여부와 무관). 내용은 {sel.kind === "HW_DD" ? "블록별 부품표·넷·인터페이스·설계 근거, 요구↔블록↔부품 일관성 증거(13-51), 설계 검토·합의 기록(13-52)" : sel.kind === "SW_DD" ? "유닛 분해·요구 추적, 유닛별 클래스·연산·알고리즘·포트·Runnable·상태·시퀀스·액티비티 표" : sel.kind === "RTM" ? "순방향·역방향 추적, 변경 영향·판정 이력, 일관성 점검 결과" : /^V_/.test(sel.kind) ? "검증 전략·대상·시험 항목(절차·기대 결과·합격 기준)" : /^R_/.test(sel.kind) ? "시험 결과 기록 틀(Pass/Fail/Not executed)" : "해당 프로세스의 요구·설계 내용"}입니다.</div>
                      <div style={{ marginTop: 8, color: T.muted }}>미리보기 대신 내려받아 Word/Excel에서 확인하세요. 표 형식 산출물(BOM·특별 특성·분석·MISRA)은 왼쪽 '미리보기' 항목에서 바로 볼 수 있습니다.</div>
                    </div>); })()}
                  {sel?.type === "svg" && <div style={{ overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}><SvgView svg={sel.get()} zoom={svgZoom} setZoom={setSvgZoom} maxHeight={600} /></div>}
                  {(sel?.type === "code" || sel?.type === "text") && <pre style={{ margin: 0, padding: 10, overflow: "auto", flex: 1, fontSize: 11, lineHeight: 1.45, background: "#0B0F1A", color: "#D6DEEB", fontFamily: "Consolas, 'D2Coding', monospace" }}>{sel.type === "text" ? sel.get().slice(0, 200000) : sel.get()}</pre>}
                  {sel?.type === "table" && (() => { const rows = sel.rows(); const hdrIdx = rows.findIndex(r => r.length > 2); const body = rows.slice(hdrIdx); return (
                    <div style={{ overflow: "auto", flex: 1 }}><table style={{ borderCollapse: "collapse", fontSize: 10.5, minWidth: "100%" }}>
                      <tbody>{body.slice(0, 400).map((r, i) => <tr key={i} style={{ background: i === 0 ? T.bg : "transparent" }}>{(Array.isArray(r) ? r : [r]).map((c, j) => <td key={j} style={{ border: `1px solid ${T.border}`, padding: "3px 6px", fontWeight: i === 0 ? 700 : 400, whiteSpace: "pre-wrap", verticalAlign: "top" }}>{typeof c === "object" && c ? c.v : String(c ?? "")}</td>)}</tr>)}</tbody>
                    </table>{body.length > 400 && <div style={{ padding: 6, fontSize: 10, color: T.muted }}>… {body.length - 400}행 더 있음 — xlsx로 내려받아 확인</div>}</div>); })()}
                </div>
              </div>);
          })()}

          {tab === "trace" && (<>
            {(lstat.open.length > 0 || model.reviewLog.length > 0) && (() => {
              const groups = {};
              lstat.open.forEach(l => { (groups[l.up] = groups[l.up] || []).push(l); });
              const stColor = { suspect: T.amber, invalid: T.red, orphan: T.red };
              const fieldOf = { "제목": "title", "내용": "text", "검증 기준": "verifCriteria", "유형": "type" };
              return (
              <AeSec title={lstat.open.length ? `변경 영향 검토 — 검토 필요 ${lstat.open.length}건 (상위 요구 ${Object.keys(groups).length}건)` : "변경 영향 검토 — 미해결 연결 없음"}
                right={model.reviewLog.length ? <button onClick={() => setShowLog(v => !v)} style={small}>{showLog ? "판정 이력 닫기" : `판정 이력 ${model.reviewLog.length}건`}</button> : null}>
                {lstat.open.length > 0 && <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>상위 요구의 제목·내용·검증 기준·유형이 바뀌면, 그 요구에서 내려간 하위 항목(요소 할당·하위 요구·시험)마다 <b>"상위가 바뀌었는데 이 하위는 그대로 둬도 되는가?"</b>를 묻는 목록입니다. 하위는 자동으로 고치지 않습니다.
                  <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px" }}>
                    <b style={{ color: T.green }}>영향 없음</b><span>하위를 고칠 필요가 없음 → 연결을 그대로 인정합니다. (예: 검증 기준만 추가됐고 하위 요구 내용과 어긋나지 않음)</span>
                    <b style={{ color: T.red }}>하위 수정 필요</b><span>하위를 고쳐야 함 → 무엇을 고칠지 의견을 적고 누릅니다. 고친 뒤 <b>수정 완료</b>를 누르면 연결이 인정됩니다. (예: 시험의 합격 기준을 새 검증 기준에 맞춰 수정)</span>
                  </div>
                  <div style={{ marginTop: 4 }}>판정은 추적 매트릭스의 '변경 영향·판정 이력' 시트에 남습니다. QA 교차검토의 유효·무효(AI 의견이 맞는지)와는 다른 판정입니다.</div></div>}
                {Object.entries(groups).map(([up, ls]) => {
                  const cur = lstat.reqById[up];
                  const sus = ls.filter(l => l.state === "suspect");
                  const snap = sus[0] ? model.reqSnaps[sus[0].rec?.h] : null;
                  const fields = [...new Set(sus.flatMap(l => l.fields || []))];
                  const judgeable = ls.filter(l => l.state !== "orphan").map(l => l.key);
                  return (
                    <div key={up} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                        <b>{up}</b><span style={{ flex: 1 }}>{cur ? cur.title : <span style={{ color: T.red }}>삭제된 요구</span>}</span>
                        {fields.length > 0 && <span style={{ fontSize: 10, color: T.amber }}>변경: {fields.join(" · ")}</span>}
                      </div>
                      {cur && snap && fields.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: "3px 8px", fontSize: 10.5, margin: "6px 0", padding: 6, background: T.bg, borderRadius: 6 }}>
                          <span /><span style={{ color: T.muted }}>변경 전 (마지막 판정 기준)</span><span style={{ color: T.muted }}>변경 후 (현재)</span>
                          {fields.map(f => (<React.Fragment key={f}>
                            <span style={{ color: T.muted }}>{f}</span>
                            <span style={{ textDecoration: "line-through", color: T.muted, whiteSpace: "pre-wrap" }}>{snap[fieldOf[f]] || "(없음)"}</span>
                            <span style={{ whiteSpace: "pre-wrap" }}>{cur[fieldOf[f]] || "(없음)"}</span>
                          </React.Fragment>))}
                        </div>)}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, margin: "6px 0" }}>
                        {ls.map(l => (
                          <div key={l.key} style={{ display: "grid", gridTemplateColumns: "92px 1fr 150px 128px", gap: 8, alignItems: "center", fontSize: 10.5 }}>
                            <span style={{ color: T.muted }}>{AE.LINK_KINDS[l.kind]}</span>
                            <span><b>{l.down}</b> {l.downTitle}{l.downChanged ? <span style={{ color: T.accent }}> · 하위 수정됨(확인 필요)</span> : ""}{l.state === "invalid" && l.rec?.note ? <span style={{ color: T.muted }}> · 의견: {l.rec.note}</span> : ""}</span>
                            <span style={{ color: stColor[l.state] }}>{AE.LINK_STATES[l.state]}{AE.impactNoEffectCandidates([l]).length ? <span style={{ color: T.green, fontSize: 9.5 }}> · 영향 없음 후보</span> : null}</span>
                            <div style={{ display: "flex", gap: 3 }}>
                              {l.state === "orphan"
                                ? <button onClick={() => dropLinks(up, [l.key])} style={{ ...small, flex: 1, color: T.red }}>연결 제거</button>
                                : <>
                                    <button onClick={() => judge(up, [l.key], "valid")} title={l.state === "invalid" ? "하위 수정을 마쳤으므로 연결을 인정합니다" : "상위 변경이 이 하위에 영향 없음 — 연결을 그대로 인정합니다"} style={{ ...small, flex: 1, color: T.green, whiteSpace: "nowrap" }}>{l.state === "invalid" ? "✓ 수정 완료" : "영향 없음"}</button>
                                    {l.state !== "invalid" && <button onClick={() => judge(up, [l.key], "invalid")} title="이 하위를 고쳐야 합니다 — 아래 의견 칸에 무엇을 고칠지 적은 뒤 누르세요" style={{ ...small, flex: 1, color: T.red, whiteSpace: "nowrap" }}>하위 수정 필요</button>}
                                  </>}
                            </div>
                          </div>))}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input value={reviewNote[up] || ""} onChange={e => setReviewNote(o => ({ ...o, [up]: e.target.value }))} placeholder={cur ? "판정 의견 (예: 검증 기준 추가만으로 하위 영향 없음 / SQT-0062 합격 기준을 2 s ± 0.1 s로 수정 필요)" : "제거 사유 (예: 고객 협의로 요구 삭제)"} style={{ ...inp, flex: 1 }} />
                        {(() => { const cand = AE.impactNoEffectCandidates(ls); return cand.length > 0 && cand.length < judgeable.length ? <button onClick={() => judge(up, cand, "valid")} title="검증 기준만 바뀐 상위의 요소 할당·하위 요구 연결 — 요구 문장은 그대로이므로 영향 없음 후보. 시험 연결은 합격 기준 확인이 필요해 후보에서 제외" style={{ ...small, color: T.green, whiteSpace: "nowrap" }}>영향 없음 후보 {cand.length}건 처리</button> : null; })()}
                        {judgeable.length > 1 && <button onClick={() => judge(up, judgeable, "valid")} title="이 상위 요구의 변경이 아래 하위 항목 전부에 영향 없음" style={{ ...small, color: T.green, whiteSpace: "nowrap" }}>모두 영향 없음</button>}
                        {!cur && ls.length > 1 && <button onClick={() => dropLinks(up, ls.map(l => l.key))} style={{ ...small, color: T.red, whiteSpace: "nowrap" }}>모두 제거</button>}
                      </div>
                    </div>);
                })}
                {showLog && (
                  <div style={{ marginTop: 6, maxHeight: 220, overflowY: "auto", borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
                    {[...model.reviewLog].reverse().slice(0, 100).map((g, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "118px 1fr 90px", gap: 8, fontSize: 10.5, padding: "2px 0" }}>
                        <span style={{ color: T.muted }}>{String(g.at || "").slice(0, 16).replace("T", " ")}</span>
                        <span>{g.up} → {g.down} <span style={{ color: T.muted }}>({AE.LINK_KINDS[g.kind] || g.kind}{g.fields?.length ? ` · 변경: ${g.fields.join("·")}` : ""})</span>{g.note ? ` — ${g.note}` : ""}</span>
                        <span style={{ color: g.state === "valid" ? T.green : T.red }}>{AE.LINK_STATES[g.state] || g.state}</span>
                      </div>))}
                  </div>)}
              </AeSec>); })()}
            <AeSec title="추적·검증 커버리지" right={<Btn onClick={downloadPkg} disabled={busy || !model.reqs.SYS.length} style={{ fontSize: 11, padding: "4px 12px" }}>📦 V-모델 산출물 ZIP</Btn>}>
              {(() => {
                const cov = AE.coverageDetail(model);
                const color = v => v == null ? T.muted : v === 100 ? T.green : v >= 70 ? T.amber : T.red;
                const row = (c) => (
                  <div key={c.key} style={{ display: "grid", gridTemplateColumns: "1fr 180px 44px 96px", gap: 10, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${T.border}` }}>
                    <div><div style={{ fontSize: 11.5, color: T.text }}>{c.q}</div><div style={{ fontSize: 10, color: T.muted }}>{c.sub}{c.total ? ` · ${c.covered}/${c.total}` : ""}</div></div>
                    <div style={{ height: 6, background: T.subtle, borderRadius: 3 }}><div style={{ width: `${c.pct ?? 0}%`, height: 6, borderRadius: 3, background: color(c.pct) }} /></div>
                    <span style={{ textAlign: "right", fontSize: 11, color: c.pct == null ? T.muted : T.text }}>{c.pct == null ? "-" : `${c.pct}%`}</span>
                    {c.missing.length
                      ? <button onClick={() => goMissing(c)} style={{ ...small, color: color(c.pct), borderColor: color(c.pct) + "88" }}>빠짐 {c.missing.length}건 →</button>
                      : <span style={{ fontSize: 10, color: c.total ? T.green : T.muted, textAlign: "center" }}>{c.total ? "✓ 빠짐 없음" : "대상 없음"}</span>}
                  </div>);
                // 검증: 같은 성격(요구 시험 / 통합 시험 / 유닛)끼리 모두 100%면 한 줄로 합쳐 표시
                const verif = cov.filter(c => c.group === "verif");
                const merged = []; const used = new Set();
                [["req", "요구마다 시험이 있나", "시스템·SW·HW 요구 시험"], ["if", "통합 인터페이스마다 통합 시험이 있나", "시스템·SW·HW 통합 시험"]].forEach(([kind, q, sub]) => {
                  const g = verif.filter(c => c.kind === kind && c.total);
                  if (g.length >= 2 && g.every(c => c.pct === 100)) { g.forEach(c => used.add(c.key)); merged.push({ key: "m" + kind, q, sub: `${sub} · ${g.map(c => c.level && AE.TEST_LEVELS[c.level].proc).join(" · ")}`, pct: 100, total: g.reduce((a, c) => a + c.total, 0), covered: g.reduce((a, c) => a + c.total, 0), missing: [] }); }
                });
                const verifRows = [...merged, ...verif.filter(c => !used.has(c.key))];
                return (<div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>각 줄은 <b style={{ color: T.text }}>왼쪽 항목 중 오른쪽으로 연결된 비율</b>입니다. 100%가 아니면 빠진 항목이 있고, "빠짐 N건"을 누르면 그 탭에서 빠진 항목만 보여줍니다.</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, margin: "4px 0 2px" }}>↘ 요구 분석 — V의 왼쪽 위에서 아래로</div>
                  {cov.filter(c => c.group === "req").map(row)}
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, margin: "12px 0 2px" }}>↗ 검증 — V의 오른쪽 아래에서 위로</div>
                  {verifRows.map(row)}
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>색 기준: <span style={{ color: T.red }}>■</span> 70% 미만 · <span style={{ color: T.amber }}>■</span> 100% 미만 · <span style={{ color: T.green }}>■</span> 100% · HW 항목은 적용 범위에서 HW를 켰을 때만 표시</div>
                </div>);
              })()}
            </AeSec>
            <AeSec title={`일관성·양방향 추적성 점검 — 오류 ${errCount} · 경고 ${findings.filter(f => f.sev === "warn").length} · 정보 ${findings.filter(f => f.sev === "info").length}`}>
              <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 6 }}>각 줄을 누르면 처리 방법이 펼쳐집니다. ✎가 붙은 ID는 이 자리에서 바로 고칠 수 있습니다. 오류는 반드시, 경고는 가능한 한 해소하고, 정보는 착수 시점에 남아 있어도 되는 항목입니다.</div>
              {findings.map((f, i) => {
                const fk = `cons${i}`, opened = !!open[fk];
                const msg = String(f.msg || "");
                const ready = /Draft인 요구/.test(msg) ? AE.reviewReadyReqs(model) : [];
                const how = /검증 기준이 없는|모호어·정량 기준/.test(msg) ? "ID 옆 ✎를 눌러 검증 기준(합격·불합격을 가를 수치·조건)을 적으세요. 시스템 요구는 SYS.2 시스템 요구의 [상세]에서 고쳐도 됩니다."
                  : /합의되지 않은 이해관계자/.test(msg) ? "고객(OEM)과 요구 내용을 합의한 뒤 SYS.1 고객 요구의 이해관계자 요구 '합의' 칸을 '합의'로 바꾸세요. 합의 회의록 등 근거가 있을 때만 바꾸며, 착수 시점에는 '검토 중'으로 남아 있어도 됩니다(정보)."
                  : /골격\(TBD\)/.test(msg) ? "착수 단계에서는 정상입니다. 코드가 나오면 SWE.3 상세설계 탭에 .h 헤더를 끌어다 놓거나, 유닛 설계(알고리즘·동적 동작)를 작성하세요."
                  : /Draft인 요구/.test(msg) ? "요구를 검토한 뒤 상태를 Reviewed(검토 완료)·Agreed(고객 합의)로 올립니다. 근거는 QA 교차검토의 판정 기록입니다 — 아래 버튼은 교차검토가 끝난 요구만 Reviewed로 올립니다. Agreed는 고객 합의 후 각 요구의 상태 칸에서 직접 바꾸세요."
                  : /변경 영향 검토 대기|하위 수정 필요'로 판정/.test(msg) ? "이 화면 위쪽 '변경 영향 검토' 목록에서 하위 연결마다 '영향 없음' 또는 '하위 수정 필요'로 판정하세요. 요구를 고치면 자동으로 생기는 항목이며, 판정이 끝나면 사라집니다."
                  : /할당되지 않은|파생되지 않은|도출되지 않은|시험이 없는|연결되지 않은/.test(msg) ? "위 '추적·검증 커버리지'의 '빠짐 N건 →'을 누르면 해당 탭에서 빠진 항목과 처리 방법(💡)이 나옵니다."
                  : "ID를 확인해 해당 탭에서 바로잡으세요.";
                const ids = f.ids || [];
                return (
                  <div key={i} style={{ padding: "5px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 11 }}>
                    <div onClick={() => setOpen(o => ({ ...o, [fk]: !o[fk] }))} style={{ display: "grid", gridTemplateColumns: "40px 1fr 16px", gap: 8, cursor: "pointer" }}>
                      <span style={{ color: AE_SEV[f.sev].c, fontWeight: 700, fontSize: 10 }}>{AE_SEV[f.sev].l}</span>
                      <div>{f.msg}<div style={{ fontSize: 9.5, color: T.muted }}>{AE.bpLabel(f.bp, V)}{!opened && ids.length ? ` · ${ids.slice(0, 12).join(", ")}${f.count > 12 ? " …" : ""}` : ""}</div></div>
                      <span style={{ color: T.muted, fontSize: 10 }}>{opened ? "▴" : "▾"}</span>
                    </div>
                    {opened && (
                      <div style={{ margin: "6px 0 4px 48px", padding: "8px 10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, marginBottom: ids.length ? 6 : 0 }}>💡 {how}</div>
                        {ids.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{ids.map(id => { const k = scopeOfIdC(id), ek = `${fk}|${id}`; return (
                          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 10.5 }}>{id}</span>
                            {k && <button onClick={() => openEditC(ek, k, id)} title={`${id} 바로 수정`} style={{ ...small, padding: "0 5px", fontSize: 10, background: rvEdit?.fkey === ek ? T.accent : "none", color: rvEdit?.fkey === ek ? "#fff" : T.accent }}>✎</button>}
                          </span>); })}{f.count > ids.length && <span style={{ fontSize: 10, color: T.muted }}>… 외 {f.count - ids.length}건</span>}</div>}
                        {rvEdit?.fkey?.startsWith(fk + "|") && <div style={{ marginTop: 8 }}>{editorBoxC()}</div>}
                        {/합의되지 않은 이해관계자/.test(msg) && <button onClick={() => setTab("req", "STK")} style={{ ...small, marginTop: 6 }}>SYS.1 고객 요구로 이동</button>}
                        {/골격\(TBD\)/.test(msg) && <button onClick={() => setTab("SW", "unit")} style={{ ...small, marginTop: 6 }}>SWE.3 상세설계로 이동</button>}
                        {/Draft인 요구/.test(msg) && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                            <Btn disabled={busy || !ready.length} onClick={() => { if (!window.confirm(`교차검토가 끝난 요구 ${ready.length}건(현재 내용으로 검토됨 · 미판정 의견 없음 · 유효 의견은 수정 완료)의 상태를 Draft → Reviewed로 바꿉니다.\n변경은 수정 이력에 'QA 교차검토 근거'로 기록됩니다.\n\n계속할까요?`)) return; setModel(m => AE.markReviewed(m, ready)); setNote(`요구 ${ready.length}건을 Reviewed로 바꿨습니다 — 근거: QA 교차검토 판정 기록. 저장을 눌러 확정하세요.`); }} style={{ fontSize: 11, padding: "4px 10px" }}>교차검토 끝난 요구 {ready.length}건 → Reviewed</Btn>
                            <button onClick={() => setTab("review")} style={small}>QA 교차검토로 이동</button>
                            {!ready.length && <span style={{ fontSize: 10.5, color: T.muted }}>아직 교차검토·판정이 끝난 Draft 요구가 없습니다. QA 교차검토에서 검토하고 의견을 모두 판정하면 여기서 올릴 수 있습니다.</span>}
                          </div>)}
                      </div>)}
                  </div>);
              })}
              {!findings.length && <div style={{ fontSize: 11, color: T.green }}>✓ 발견된 문제 없음</div>}
            </AeSec>
            <AeSec title="ASPICE WP 특성 충족도 — 모델 내용 · 입력자료 · 템플릿 점검 · 수동 판정 (각 문서 부록에 점검표로 수록)">
              <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8, lineHeight: 1.6 }}>
                ASPICE 정보항목(WP)이 요구하는 특성을 문서마다 점검합니다. <b style={{ color: T.green }}>충족</b> = V-모델 내용에 있음, 또는 등록 템플릿에 그 절이 있어 문서에서 작성됨(템플릿 항목) · <b style={{ color: T.accent }}>대기</b> = 입력자료는 있으나 아직 모델에 반영 안 됨 · <b style={{ color: T.red }}>누락</b> = 내용 없음(문서 부록에 TBD로 기록) · <b>N/A</b> = 이 과제에 해당 없음.
                자동 판정은 요구·설계 문장의 키워드로 하므로, 실제로는 있는데 누락으로 나오거나 이 과제에 없는 특성(예: HMI가 없는 제어기의 사용자 인터페이스)은 오른쪽에서 <b>수동 판정</b>하고 사유를 적으세요. 수동 판정과 사유는 문서 부록 점검표에 그대로 실립니다.
              </div>
              {["SYS_RS", "SYS_AD", ...(model.scope.SW ? ["SW_RS", "SW_AD"] : []), ...(model.scope.HW ? ["HW_RS", "HW_AD"] : []), "VERIF"].map(g => {
                const list = AE.charStatusList(model, g);
                const s = list.reduce((o, c) => { o[c.state] = (o[c.state] || 0) + 1; return o; }, {});
                return (
                  <div key={g} style={{ marginBottom: 6 }}>
                    <button onClick={() => setOpen(o => ({ ...o, ["c" + g]: !o["c" + g] }))} style={{ ...small, width: "100%", textAlign: "left", color: T.text, display: "flex", gap: 10 }}>
                      <span style={{ flex: 1 }}>{g === "VERIF" ? "검증 명세(공통)" : AE.ASPICE_DOCS[g].title} <span style={{ color: T.muted }}>· {g === "VERIF" ? AE.versionsOf(V).map(v => `${v}: ${v === "3.1" ? "08-50, 08-52, 13-50" : "08-60, 08-58, 15-52"}`).join(" / ") : AE.wpLabel(g, V)}</span></span>
                      <span style={{ color: T.green }}>충족 {s.ok || 0}</span><span style={{ color: T.accent }}>대기 {s.input || 0}</span><span style={{ color: T.red }}>누락 {s.gap || 0}</span><span style={{ color: T.muted }}>N/A {s.na || 0}</span>
                    </button>
                    {open["c" + g] && list.map(c => (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 170px 120px", gap: 6, alignItems: "center", padding: "3px 6px", fontSize: 10.5 }}>
                        <span>{c.label}{c.origin !== "ASPICE" && <span style={{ color: T.muted }}> ({c.origin})</span>}<span style={{ color: T.muted, fontSize: 9.5 }}> · {c.source}{c.byTpl === true ? " · 템플릿 ✓" : c.byTpl === false ? " · 템플릿 ✕" : ""}</span></span>
                        <span style={{ color: { ok: T.green, input: T.accent, gap: T.red, na: T.muted }[c.state] }}>{charStateLabel[c.state]}{c.manual ? " (수동)" : c.byTplOnly ? " (템플릿 항목)" : ""}</span>
                        <select value={(model.charOverride[c.id] || {}).state || ""} onChange={e => set(n => { if (e.target.value) n.charOverride[c.id] = { ...(n.charOverride[c.id] || {}), state: e.target.value }; else delete n.charOverride[c.id]; })} style={inp}>
                          <option value="">자동 판정</option><option value="ok">충족(수동)</option><option value="gap">누락(수동)</option><option value="na">해당 없음</option>
                        </select>
                        {c.manual && (
                          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, alignItems: "center", paddingLeft: 12 }}>
                            <span style={{ fontSize: 10, color: c.note ? T.muted : T.red, whiteSpace: "nowrap" }}>판정 사유{c.note ? "" : " (필수 — 심사 증적)"}</span>
                            <input value={c.note} onChange={e => { const v = e.target.value; set(n => { n.charOverride[c.id] = { ...(n.charOverride[c.id] || {}), note: v }; }); }} placeholder={c.state === "na" ? "예: 본 제어기는 HMI가 없어 사용자 인터페이스 요구 없음 (OEM 사양서 §1.2)" : c.state === "ok" ? "예: RN0003·RN0004가 운용 모드 요구를 기술함" : "예: 고객 입력자료 미제공 — 미결 사항 OI-03"} style={{ ...inp, borderColor: c.note ? undefined : T.red + "88" }} />
                          </div>)}
                      </div>))}
                  </div>);
              })}
            </AeSec>
          </>)}
        </div>
        {introOpen && (
          <div onClick={closeIntro} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, borderRadius: 14 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.accent}66`, borderRadius: 12, padding: "18px 22px", maxWidth: 820, width: "100%", maxHeight: "100%", overflowY: "auto", fontSize: 12, lineHeight: 1.7 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🚗 V-모델 산출물 엔지니어링 — 처음 사용하시나요?</div>
              <div style={{ color: T.muted, marginBottom: 12 }}>고객 요구 한 묶음에서 시스템·SW·HW 요구, 설계, 시험까지 <b>서로 연결된(추적되는)</b> 산출물을 만드는 창입니다. 아래 순서대로 가면 되고, 어느 단계에 있든 위쪽 <b>'👉 다음 할 일 → 바로 가기'</b>를 누르면 해야 할 곳으로 이동합니다.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>V-모델이란</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, whiteSpace: "pre", lineHeight: 1.5 }}>{`고객 요구 ─▶ 시스템 요구 ······ 시스템 시험
                 │                    ▲
                 ▼                    │
            시스템 구조 ········ 통합 시험
                 │                    ▲
                 ▼                    │
          SW·HW 요구/설계 ··· SW·HW 시험
                 │                    ▲
                 ▼                    │
              유닛(코드) ─────▶ 유닛 시험`}</div>
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>왼쪽으로 내려가며 구체화하고(화살표), 오른쪽에서 같은 높이의 시험으로 확인합니다(점선). 어느 한 줄이 끊기면 '빠진 곳 점검'에서 '빠짐'으로 보입니다.</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>보통 진행하는 순서</div>
                  <ol style={{ margin: "0 0 8px 18px", padding: 0 }}>
                    {AE_TABS.filter(([id]) => !(id === "SW" && !model.scope.SW) && !(id === "HW" && !model.scope.HW)).map(([id, label]) => <li key={id}><b>{label}</b> <span style={{ color: T.muted }}>— {AE_GUIDE[id]?.done}</span></li>)}
                  </ol>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>자동으로 되는 것 / 사람이 하는 것</div>
                  <div style={{ fontSize: 11 }}>
                    <div><span style={{ color: T.green }}>자동</span> — 요구 도출·파생 초안, 요소·컴포넌트 초안, 시험 생성, 추적 매트릭스, 규칙 점검, 검토 AI 의견, 수정안 초안</div>
                    <div><span style={{ color: T.amber }}>사람</span> — 확정(요구사항 확정 버튼), 할당 확인, 고객 합의 상태, 검토 의견 판정(맞음·틀림·보류), 수정안 승인, 변경 영향 판정</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "8px 10px", background: T.bg, borderRadius: 8, fontSize: 11, color: T.muted }}>
                💡 각 탭 맨 위에 <b>'이 단계에서 할 일'</b> 카드가 있습니다. 익숙해지면 '안내 숨기기'로 치우고, 오른쪽 위 <b>❓ 사용법</b>으로 언제든 다시 볼 수 있습니다. 저장은 하단 <b>저장</b>(창은 닫히지 않음), 서버 저장은 위저드 마지막 '완료'입니다.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <Btn onClick={closeIntro} style={{ fontSize: 12, padding: "7px 16px" }}>시작하기 →</Btn>
              </div>
            </div>
          </div>)}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderTop: `1px solid ${T.border}`, flexShrink: 0, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: T.muted }}>SYS {model.reqs.SYS.length} · 요소 {model.comps.SYS.length}{model.scope.SW ? ` · SW ${model.reqs.SW.length}/${model.comps.SW.length}${model.units.SW.length ? `/유닛 ${model.units.SW.length}` : ""}` : ""}{model.scope.HW ? ` · HW ${model.reqs.HW.length}/${model.comps.HW.length}` : ""} · 검증 수단 {model.tests.length}{requirements?.aspice?.updatedAt ? ` · 저장본 ${(d => isNaN(d) ? String(requirements.aspice.updatedAt).slice(0, 10) : `${d.toLocaleDateString("sv-SE")} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`)(new Date(requirements.aspice.updatedAt))}` : ""}</div>
            <div style={{ fontSize: 9.5, color: T.muted, opacity: 0.8, marginTop: 2 }}>SYS = 시스템 요구 수 · 요소 = 시스템 구성요소 수 · SW/HW = 하위 요구 수 / 컴포넌트 수 (/ SW 유닛 수) · 검증 수단 = 시험 항목(TC) 수</div>
            {(() => {
              // 규칙 기반 상속 초안(시스템 요구를 그대로 복사한 하위 요구)이 남아 있으면 한 줄로 안내
              const inh = ["SW", "HW"].filter(lv => model.scope[lv]).map(lv => [lv, model.reqs[lv].filter(r => /관점 구체화 필요/.test(r.text || "")).length]).filter(([, n]) => n > 0);
              return inh.length ? <div style={{ fontSize: 9.5, color: T.amber, marginTop: 2 }}>⚠ {inh.map(([lv, n]) => `${lv} ${n}건`).join(" · ")}이 시스템 요구를 그대로 복사한 초안입니다 — 요소를 실제 구성(HW/SW)으로 나누고 담당 요소에만 할당한 뒤 다시 파생하세요.</div> : null;
            })()}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="outline" onClick={downloadPkg} disabled={busy || !model.reqs.SYS.length} title="이해관계자 요구 목록·시스템 요구사항 명세서·아키텍처·하위 요구·상세설계·검증 명세·추적 매트릭스를 한 번에 내려받습니다 (저장 전 편집 내용 기준)" style={{ fontSize: 12, padding: "7px 14px" }}>📦 산출물 ZIP</Btn>
            <span style={{ alignSelf: "center", fontSize: 10.5, color: dirty ? T.amber : T.green, whiteSpace: "nowrap" }}>{dirty ? "● 저장 안 된 변경 있음" : "✓ 저장됨"}</span>
            <Btn variant="outline" onClick={requestClose} style={{ fontSize: 12, padding: "7px 14px" }}>닫기</Btn>
            <Btn onClick={() => save()} disabled={busy} title="작업 내용을 프로젝트에 반영하고 브라우저 임시저장본에도 보관합니다. 창은 닫히지 않습니다." style={{ fontSize: 12, padding: "7px 14px" }}>✓ 저장</Btn>
          </div>
        </div>
      </div>
    </div>
    </AeRunCtx.Provider>
  );
}

function StepDeliverables({ deliverablesData, generating, genProgress, genError, onGenerate, form, wbs, pdpCtx, requirements, setRequirements }) {
  const [expanded, setExpanded] = useState({});   // { 카테고리id: true } — 여러 카테고리 동시 펼침 유지
  const toggleCat = (id) => setExpanded(m => ({ ...m, [id]: !m[id] }));
  const [zipProgress, setZipProgress] = useState(null);   // 전체 ZIP 다운로드 진행 상황
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState(null);
  const [reqModal, setReqModal] = useState(false);   // 요구사항 AI 작성 모달
  const [aeModal, setAeModal] = useState(false);     // ASPICE V-모델 엔지니어링 모달
  // ASPICE 여부: 과제 유형(시작 화면)이 유일한 기준, 유형이 없는 기존 과제만 OSSP로 판정
  const isAspice = form?.track ? form.track === "aspice" : getGuideForOSSP(pdpCtx?.ossp || {})?.id === "aspice";
  const [aeInitTab, setAeInitTab] = useState(null);
  async function handleZipDownload() {
    if (zipping) return;
    setZipping(true); setZipError(null);
    try {
      await downloadDeliverablesZip(deliverablesData, form||{}, wbs, pdpCtx, setZipProgress);
      setTimeout(() => setZipProgress(p => (p && p.percent >= 100 ? null : p)), 1500);
    } catch (e) {
      setZipProgress(null);
      setZipError("ZIP 다운로드 실패: " + e.message);
    }
    setZipping(false);
  }
  const total = deliverablesData?.summary?.totalDocs || 0;
  const mand = deliverablesData?.summary?.mandatoryCount || 0;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>산출물 자동생성</h2><p style={{ fontSize:11, color:T.muted }}>WBS에 반영되는 모든 단계의 산출물 문서 패키지를 구성합니다 (관리활동 + 개발산출물 전 단계).</p></div>
        {!deliverablesData && <Btn onClick={onGenerate} disabled={generating} style={{ fontSize:12, padding:"7px 12px" }}>⚡ 생성</Btn>}
      </div>
      {(generating || genProgress) && (
        <GenProgressBar
          progress={genProgress || { percent: 5, label: "산출물 생성 준비 중…" }}
          subText="WBS 산출물을 수집·구성합니다." />
      )}
      {genError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9 }}>{genError}</div>}
      {isAspice && (() => { const am = requirements?.aspice ? AE.normalizeModel(requirements.aspice) : null; const errs = am ? AE.checkConsistency(am).filter(f => f.sev === "error").length : 0; const openLinks = am ? AE.linkStatus(am).open.length : 0; return (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", marginBottom:12, background:T.accent+"0D", border:`1px solid ${T.accentDim}`, borderLeft:`3px solid ${T.accent}`, borderRadius:9, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:240 }}>
            <div style={{ fontSize:12, fontWeight:700 }}>🚗 ASPICE V-모델 산출물 (시스템·SW·HW 요구 → 설계 → 검증 수단 → 추적성)</div>
            <div style={{ fontSize:10.5, color:T.muted, marginTop:2 }}>
              {am ? `SYS ${am.reqs.SYS.length} · 요소 ${am.comps.SYS.length}${am.scope.SW ? ` · SW ${am.reqs.SW.length}` : ""}${am.scope.HW ? ` · HW ${am.reqs.HW.length}` : ""} · 검증 수단 ${am.tests.length} · 일관성 오류 ${errs}건${openLinks ? ` · 변경 검토 필요 연결 ${openLinks}건` : ""} — 저장된 내용은 아래 '전체 ZIP 다운로드'의 해당 산출물에 반영됩니다${(() => { const ex = deliverablesData ? aspiceExtraKinds(deliverablesData, { ...(pdpCtx || {}), requirements }) : []; return ex.length ? ` (WBS에 없는 V-모델 문서 ${ex.length}종은 ZIP의 '99_V-모델 추가 산출물' 폴더에 함께 담김)` : ""; })()}`
                  : requirements?.items?.length ? "확정된 시스템 요구사항에서 SYS.3 → SWE.1/2 · HWE.1/2 → 검증 수단(SYS.4/5·SWE.5/6·HWE.3/4)을 생성합니다 (ASPICE 3.1·4.0 겸용)"
                  : "먼저 '시스템 요구사항 명세서'의 🤖 AI 작성으로 SYS.2 요구사항을 확정하세요 (DBC만으로 시작할 수도 있습니다)"}
            </div>
          </div>
          {/* V-모델 산출물은 '전체 ZIP 다운로드'에 포함된다(WBS에 없는 V-모델 문서는 99 폴더). V-모델만 따로 받을 때는 V-모델 창의 '산출물 ZIP' 사용 */}
            <Btn onClick={()=>{ setAeInitTab(null); setAeModal(true); }} style={{ fontSize:11.5, padding:"6px 14px" }}>{am ? "V-모델 편집" : "V-모델 시작"}</Btn>
        </div>); })()}
      {deliverablesData && (
        <div style={{ animation:"fadeIn .4s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <Badge color={T.green}>✓ 산출물 생성 완료</Badge>
            <div style={{ display:"flex", gap:6 }}>
              <Btn onClick={handleZipDownload} disabled={zipping} style={{ fontSize:11, padding:"4px 12px" }}>{zipping ? "⏳ 생성 중…" : "⬇ 전체 ZIP 다운로드"}</Btn>
              <Btn variant="outline" onClick={onGenerate} disabled={generating || zipping} style={{ fontSize:11, padding:"4px 10px" }}>재생성</Btn>
            </div>
          </div>
          {(zipping || zipProgress) && (
            <GenProgressBar
              progress={zipProgress || { percent: 2, label: "ZIP 생성 준비 중…" }}
              subText="산출물별 템플릿 조회·문서 생성 후 ZIP으로 압축합니다. 건수가 많으면 시간이 걸릴 수 있습니다." />
          )}
          {zipError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9, marginBottom:12 }}>{zipError}</div>}
          {deliverablesData.summary?.source !== "wbs" && (
            <div style={{ fontSize:11, color:T.amber, padding:"8px 12px", background:T.amber+"11", border:`1px solid ${T.amber}44`, borderRadius:8, marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
              <span>⚠ 이전 버전에서 생성된 결과입니다. WBS의 모든 산출물을 반영하려면 재생성하세요.</span>
              <Btn onClick={onGenerate} disabled={generating} style={{ fontSize:11, padding:"4px 12px" }}>지금 재생성</Btn>
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            {[{label:"전체",value:total,color:T.accent},{label:"필수(M)",value:mand,color:T.red},{label:"선택(O)",value:total-mand,color:T.amber}].map(s=>(
              <div key={s.label} style={{ flex:1, padding:"8px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, textAlign:"center" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {deliverablesData.summary?.recon && (() => { const r = deliverablesData.summary.recon; return (
            <div style={{ fontSize:10.5, color:T.muted, padding:"7px 10px", background:T.bg, border:`1px dashed ${T.border}`, borderRadius:8, marginBottom:12, lineHeight:1.7 }}>
              ℹ <b style={{ color:T.text }}>WBS 개수 대사</b> — 최하위 Task {r.leafTotal}건 중 산출물 지정 <b style={{ color:T.text }}>{r.leafWithDeliv}건</b> 전부 1:1 반영
              {r.leafTotal - r.leafWithDeliv > 0 && <> (미지정 {r.leafTotal - r.leafWithDeliv}건 제외)</>}
              {r.mgmtMerged > 0 && <> − 관리활동 중복 <b style={{ color:T.text }}>{r.mgmtMerged}건</b>(개발산출물로 통합)</>}
              {r.pdpInjected && <> + 테일러링결과서 <b style={{ color:T.text }}>1건</b>(필수 자동추가)</>}
              {" "}= 전체 <b style={{ color:T.accent }}>{total}건</b>
              {r.dupIncluded > 0 && <span style={{ color:T.muted }}> · 동일 산출물명 {r.dupIncluded}건 포함(WBS 번호로 구분)</span>}
            </div>
          ); })()}
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:420, overflowY:"auto" }}>
            {deliverablesData.categories?.map(cat=>(
              <div key={cat.id} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden", flexShrink:0 }}>
                <div onClick={()=>toggleCat(cat.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", cursor:"pointer" }}>
                  <span>{cat.icon}</span>
                  <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{cat.name}</span>
                  <span style={{ fontSize:11, color:T.muted }}>{cat.documents?.length}건 {expanded[cat.id]?"▲":"▼"}</span>
                </div>
                {expanded[cat.id] && cat.documents?.map(doc=>(
                  <div key={doc.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px", borderTop:`1px solid ${T.border}` }}>
                    {doc.wbsNo && <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted, border:`1px solid ${T.border}`, padding:"2px 5px", borderRadius:4, flexShrink:0, marginTop:2 }}>{doc.wbsNo}</span>}
                    <span style={{ fontFamily:"monospace", fontSize:9, color:T.accent, background:T.accentDim, padding:"2px 5px", borderRadius:4, flexShrink:0, marginTop:2 }}>{doc.code}</span>
                    <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600 }}>{doc.name}</div><div style={{ fontSize:10, color:T.muted }}>{doc.taskName ? `${doc.taskName} — ` : ""}{doc.purpose}</div></div>
                    <Badge color={prioInfo(doc.priority).color}>{prioInfo(doc.priority).label}</Badge>
                    {isAspice && aspiceCanBuild(AE.aspiceDocKind(doc.name), pdpCtx) && <span title="ASPICE V-모델 추적 모델에서 실문서로 생성됩니다" style={{ fontSize:10, color:T.green, border:`1px solid ${T.green}55`, borderRadius:6, padding:"3px 7px", flexShrink:0 }}>V모델 ✓</span>}
                    {reqDocKind(doc.name) && !(isAspice && aspiceCanBuild(AE.aspiceDocKind(doc.name), pdpCtx)) && isAspice && (
                      <button onClick={()=>{ setAeInitTab("req"); setAeModal(true); }} title="ASPICE 과제: 요구 도출·명세는 V-모델 ② 탭에서 작성합니다"
                        style={{ background: requirements?.items?.length ? T.green+"14" : "none", border:`1px solid ${T.green}66`, borderRadius:6, color:T.green, cursor:"pointer", fontSize:11, padding:"3px 8px", flexShrink:0, fontFamily:"inherit" }}>
                        {requirements?.items?.length ? `V모델 ✓ ${requirements.items.length}건` : "V-모델에서 작성"}
                      </button>
                    )}
                    {reqDocKind(doc.name) && !isAspice && (
                      <button onClick={()=>setReqModal(true)} title="이해관계자 요구사항 원문으로 AI 자동 작성"
                        style={{ background: requirements?.items?.length ? T.accentDim : "none", border:`1px solid ${T.accent}66`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:11, padding:"3px 8px", flexShrink:0, fontFamily:"inherit" }}>
                        {requirements?.items?.length ? `🤖 ${requirements.items.length}건 ✓` : "🤖 AI 작성"}
                      </button>
                    )}
                    {isSignOffDoc(doc.name) ? (
                      <span title={signOffNote(doc.name)}
                        style={{ border:`1px solid ${T.amber}66`, borderRadius:6, color:T.amber, fontSize:10.5, padding:"3px 8px", flexShrink:0, whiteSpace:"nowrap" }}>서명본</span>
                    ) : (
                      <button onClick={()=>downloadSingleDeliverable(doc, cat.name, form||{}, wbs, pdpCtx)} title="이 산출물만 다운로드"
                        style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:11, padding:"3px 8px", flexShrink:0, fontFamily:"inherit" }}>⬇</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {reqModal && <ReqGenModal onClose={()=>setReqModal(false)} form={form} wbs={wbs} requirements={requirements} setRequirements={setRequirements} ossp={pdpCtx?.ossp} />}
      {aeModal && <AspiceEngModal onClose={()=>setAeModal(false)} form={form} wbs={wbs} requirements={requirements} setRequirements={setRequirements} ossp={pdpCtx?.ossp} initTab={aeInitTab} tailoring={pdpCtx?.tailoring} />}
    </div>
  );
}

function StepReview({ form, sdlc, ossp, tailoring, pdpData, wbsData, deliverablesData }) {
  const procApplicable = resolveMgmt(tailoring, getGuideForOSSP(ossp)).filter(r => r.status !== "해당없음");
  const items = [
    {label:"프로젝트명",value:form.name},{label:"고객사",value:form.client},
    {label:"유형",value:form.type},{label:"PM",value:form.pm},
    {label:"기간",value:`${form.startDate}~${form.endDate}`},
    {label:"SDLC",value:sdlc?.label},{label:"OSSP",value:ossp?.label},
    {label:"관리활동 테일러링",value:`${tailoring?.process?.level||"L3"} · 적용대상 ${procApplicable.length}건`},
    {label:"PDP",value:pdpData?"✓ 생성완료":"—"},{label:"WBS",value:wbsData?`✓ ${wbsData.tasks?.length}개 단계`:"—"},
    {label:"산출물",value:deliverablesData?`✓ ${deliverablesData.summary?.totalDocs}건`:"—"},
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

// ═══════════════════════════════════════════════════════════════════
// 완료된 프로젝트 조회용 — 위저드에서 작성한 PDP(테일러링결과서)·WBS(일정표)를
// 동일한 형태로 다시 볼 수 있는 읽기 전용 뷰
// ═══════════════════════════════════════════════════════════════════
function PdpDocView({ project }) {
  const pdp = project.pdp;
  const tailoring = project.tailoring || {};
  const ossp = project.ossp;
  const sdlc = tailoring.sdlc;
  const guide = getGuideForOSSP(ossp);
  const scale = tailoring.scale || "중형";
  const method = tailoring.method || "UML";
  const excluded = tailoring.excluded || {};
  const notes = tailoring.notes || {};
  const scaleLabel = guide.scaleOptions?.find(o=>o.value===scale)?.label || scale;
  const list = classifyDeliverables(scale, method, guide, tailoring?.aspiceScope);
  const isApplied = (d) => {
    if (d.required) return true;   // 필수(M) 산출물은 항상 적용
    const ov = notes[`${d.phase}:${d.code}`]?.applied;
    return ov !== undefined ? ov : !excluded[d.code];
  };
  const appliedCount = list.filter(isApplied).length;
  const grouped = {};
  list.forEach(d => { (grouped[d.phase] = grouped[d.phase] || []).push(d); });

  // 프로세스 테일러링 확정 상태 (저장된 tailoring.process 기반)
  const procState = tailoring.process || {};
  const procLevel = guide?.mgmtActivities ? mgmtLevelLabel(tailoring, guide) : (procState.level || "L3");
  const procApplicable = resolveMgmt(tailoring, guide, procState).filter(r => r.status !== "해당없음");
  const procByArea = {};
  procApplicable.forEach(r => { (procByArea[r.area] = procByArea[r.area] || []).push(r); });

  if (!pdp) return <div style={{ color:T.muted, fontSize:12, padding:20 }}>저장된 PDP가 없습니다.</div>;

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
      {/* 표지 */}
      <div style={{ textAlign:"center", paddingBottom:16, borderBottom:`2px solid ${T.accent}` }}>
        <div style={{ fontSize:18, fontWeight:700, letterSpacing:1 }}>프로젝트 정의 프로세스 (PDP)</div>
        <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>테일러링결과서 · Tailoring Result</div>
        <div style={{ fontSize:13, fontWeight:600, color:T.accent, marginTop:10 }}>{project.name}</div>
      </div>

      {/* 문서 메타 */}
      <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse", margin:"14px 0" }}>
        <tbody>
          <tr><td style={cellHead}>고객사</td><td style={cell}>{project.client||"-"}</td><td style={cellHead}>기간</td><td style={cell}>{project.startDate} ~ {project.endDate}</td></tr>
          <tr><td style={cellHead}>기준 OSSP</td><td style={cell}>{ossp?.label||"-"}</td><td style={cellHead}>SDLC</td><td style={cell}>{sdlc?.label||"-"}</td></tr>
        </tbody>
      </table>

      {/* 1. 프로젝트 개요 */}
      <SectionTitle n="1" title="프로젝트 개요" />
      <div style={{ fontSize:12, color:T.text, lineHeight:1.7, marginBottom:6 }}>{pdp.overview?.purpose}</div>
      {pdp.overview?.scope && <div style={{ fontSize:11, color:T.muted, lineHeight:1.6, marginBottom:6 }}><b>범위:</b> {pdp.overview.scope}</div>}
      {pdp.overview?.objectives?.length > 0 && (
        <div style={{ fontSize:11, color:T.muted, lineHeight:1.7 }}>
          {pdp.overview.objectives.map((o,i)=>(
            <div key={i}><span style={{ color:T.accent, marginRight:5 }}>▸</span>{o}</div>
          ))}
        </div>
      )}

      {/* 2. 테일러링 기준 */}
      <SectionTitle n="2" title="테일러링 기준" />
      <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
        <tbody>
          <tr><td style={cellHead}>적용 가이드</td><td style={cell} colSpan={3}>{guide.title}</td></tr>
          <tr><td style={cellHead}>{guide.scaleTitle || "프로젝트 규모"}</td>{guide.hideDesignMethod ? <td style={cell} colSpan={3}>{scaleLabel}</td> : <><td style={cell}>{scaleLabel}</td><td style={cellHead}>설계방식</td><td style={cell}>{guide.hasDesignMethod ? method : "해당 없음"}</td></>}</tr>
          <tr><td style={cellHead}>{guide.criteriaTitle || "규모 판정 기준"}</td><td style={cell} colSpan={3}>{guide.sizeNote?.replace(/^※\s*/, "")}</td></tr>
        </tbody>
      </table>

      {/* 3. 산출물 테일러링 매트릭스 */}
      <SectionTitle n="3" title={`개발산출물 테일러링 매트릭스 (전체 ${list.length}건 · 적용 ${appliedCount}건)`} />
      <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
        <thead>
          <tr>{["단계","코드","산출물","구분","적용 여부","변경 여부","테일러링 내역 및 사유"].map(h=>
            <td key={h} style={{...cellHead, textAlign:"center"}}>{h}</td>)}</tr>
        </thead>
        <tbody>
          {guide.phaseOrder.filter(ph=>grouped[ph]?.length).map(ph=>(
            grouped[ph].map((d,i)=>{
              const n = notes[`${d.phase}:${d.code}`] || {};
              const on = isApplied(d);
              return (
                <tr key={`${ph}-${d.code}`} style={{ opacity:on?1:0.55 }}>
                  {i===0 && <td style={{...cell, fontWeight:600, verticalAlign:"top"}} rowSpan={grouped[ph].length}>{ph}</td>}
                  <td style={{...cell, fontFamily:"monospace"}}>{d.code}</td>
                  <td style={cell}>{d.name}{d.note && <span style={{ color:T.muted, fontSize:9.5, marginLeft:4 }}>({d.note})</span>}</td>
                  <td style={{...cell, textAlign:"center"}}><Badge color={d.required?T.accent:T.amber}>{d.required?"필수":"선택"}</Badge></td>
                  <td style={{...cell, textAlign:"center", fontSize:13, color:on?T.accent:T.muted }}>{on ? "☒" : "☐"}</td>
                  <td style={{...cell, textAlign:"center", fontSize:13, color:!d.required&&n.changed?T.amber:T.muted }}>{d.required ? "—" : (n.changed ? "☒" : "☐")}</td>
                  <td style={{...cell, color:n.reason?T.text:T.muted }}>{d.required ? "" : (n.reason || "")}</td>
                </tr>
              );
            })
          ))}
        </tbody>
      </table>

      {/* 4. 프로세스 테일러링 내역서 — 방법론 매트릭스와 동일한 컬럼 구성 (읽기 전용) */}
      <SectionTitle n="4" title={`관리활동 테일러링 내역서 (${guide?.mgmtActivities ? "ASPICE 관리활동 · 목표 능력수준" : "관리 성숙도 수준"} ${procLevel} · 적용대상 ${procApplicable.length}건)`} />
      <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
        <thead>
          <tr>{["프로세스 영역","세부 프로세스","구분","적용 여부","변경 여부","테일러링 내역 및 사유"].map(h=>
            <td key={h} style={{...cellHead, textAlign:"center"}}>{h}</td>)}</tr>
        </thead>
        <tbody>
          {Object.keys(procByArea).map(area=>(
            procByArea[area].map((r,i)=>(
              <tr key={r.key} style={{ opacity:r.applied?1:0.55 }}>
                {i===0 && <td style={{...cell, fontWeight:600, verticalAlign:"top"}} rowSpan={procByArea[area].length}>{area}</td>}
                <td style={cell}>
                  {r.process}{r.activity && <span style={{ color:T.muted }}> › {r.activity}</span>}
                  {r.outputs && <div style={{ color:T.muted, fontSize:9.5, marginTop:2 }}>산출물: {r.outputs}</div>}
                </td>
                <td style={{...cell, textAlign:"center"}}><Badge color={r.mark==="●"?T.accent:T.amber}>{r.mark==="●"?"필수":"선택"}</Badge></td>
                <td style={{...cell, textAlign:"center", fontSize:13, color:r.applied?T.accent:T.muted }}>{r.applied ? "☒" : "☐"}</td>
                <td style={{...cell, textAlign:"center", fontSize:13, color:r.changed?T.amber:T.muted }}>{r.mark==="●" ? "—" : (r.applied ? (r.changed ? "☒" : "☐") : "—")}</td>
                <td style={{...cell, color:r.reason?T.text:T.muted, fontSize:10 }}>{r.mark==="●" || r.status==="적용" ? "—" : (r.reason || "")}</td>
              </tr>
            ))
          ))}
        </tbody>
      </table>

      {/* (구버전 프로젝트 호환) 일정·리스크가 저장돼 있으면 표시 */}
      {pdp.schedule?.phases?.length > 0 && (
        <>
          <SectionTitle n="5" title="추진 일정 (구버전 저장분)" />
          {pdp.schedule.phases.map((ph,i)=>(
            <div key={i} style={{ fontSize:11, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
              <span style={{ color:T.accent, marginRight:6 }}>■</span>{ph.phase}
              <span style={{ color:T.muted }}> ({ph.start} ~ {ph.end})</span>
            </div>
          ))}
        </>
      )}
      {pdp.risks?.length > 0 && (
        <>
          <SectionTitle n={pdp.schedule?.phases?.length > 0 ? "6" : "5"} title="주요 리스크 (구버전 저장분)" />
          {pdp.risks.map((r,i)=>(
            <div key={i} style={{ fontSize:11, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
              <Badge color={r.level==="상"?T.red:r.level==="중"?T.amber:T.muted}>{r.level}</Badge>
              <span style={{ marginLeft:6 }}>{r.description}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function WbsScheduleView({ wbs }) {
  if (!wbs?.tasks?.length) return <div style={{ color:T.muted, fontSize:12, padding:20 }}>저장된 WBS가 없습니다.</div>;
  const holidays = wbs.holidays || [];
  const th = { ...cellHead, textAlign:"center", fontSize:10 };
  const rollup = (t) => {
    const ss = (t.subtasks||[]).map(s=>s.start).filter(Boolean).sort();
    const ff = (t.subtasks||[]).map(s=>s.finish).filter(Boolean).sort();
    const eff = (t.subtasks||[]).reduce((n,s)=>n+(Number(s.effort)||0),0);
    return { start:ss[0]||"", finish:ff.slice(-1)[0]||"", eff };
  };
  const total = wbs.tasks.reduce((n,t)=>n+1+(t.subtasks?.length||0),0);
  const leafCount = wbs.tasks.reduce((n,t)=>n+(t.subtasks?.length||0),0);
  const delivCount = wbs.tasks.reduce((n,t)=>n+(t.subtasks||[]).filter(s=>String(s.deliverable||"").trim()).length,0);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <Badge color={T.green}>WBS {total}개 항목</Badge>
        <Badge color={T.accent}>단계 {wbs.tasks.length} · 최하위 Task {leafCount}건 · 산출물 {delivCount}건</Badge>
        {holidays.length > 0 && <Badge color={T.red}>공휴일 {holidays.length}일</Badge>}
        {holidays.length > 0 && <span style={{ fontSize:10, color:T.muted }}>{holidays.join(", ")}</span>}
      </div>
      <div style={{ overflowX:"auto", border:`1px solid ${T.border}`, borderRadius:10 }}>
        <table style={{ borderCollapse:"collapse", fontSize:10.5, minWidth:"100%" }}>
          <thead>
            <tr>
              <td style={{ ...th, textAlign:"left" }}>WBS</td>
              <td style={{ ...th, textAlign:"left", minWidth:170 }}>Task</td>
              <td style={{ ...th, minWidth:100 }}>산출물</td>
              <td style={{ ...th, minWidth:70 }}>작업자</td>
              <td style={{ ...th, minWidth:70 }}>선행</td>
              <td style={th}>시작일</td>
              <td style={th}>종료일</td>
              <td style={{ ...th, width:60 }}>공수(일)</td>
            </tr>
          </thead>
          <tbody>
            {wbs.tasks.map(t => {
              const r = rollup(t);
              return (
                <React.Fragment key={t.id}>
                  <tr style={{ background:T.subtle }}>
                    <td style={{ ...cell, fontFamily:"monospace", fontWeight:700, color:T.accent }}>{t.wbsCode}</td>
                    <td style={{ ...cell, fontWeight:700 }}>{t.phase}</td>
                    <td style={cell} colSpan={3}><span style={{ fontSize:9.5, color:T.muted }}>요약 (하위 롤업)</span></td>
                    <td style={{ ...cell, textAlign:"center", color:T.muted }}>{r.start || "—"}</td>
                    <td style={{ ...cell, textAlign:"center", color:T.muted }}>{r.finish || "—"}</td>
                    <td style={{ ...cell, textAlign:"center", color:T.muted, fontWeight:700 }}>{r.eff || "—"}</td>
                  </tr>
                  {t.subtasks?.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...cell, fontFamily:"monospace", fontSize:9.5, color:T.muted, whiteSpace:"nowrap" }}>{s.wbsCode}</td>
                      <td style={{ ...cell, paddingLeft: 8 + ((s.level || 2) - 2) * 14 }}>{s.task}</td>
                      <td style={cell}>{s.deliverable || ""}</td>
                      <td style={{ ...cell, textAlign:"center" }}>{s.assignee || ""}</td>
                      <td style={{ ...cell, textAlign:"center" }}>{s.pred || ""}</td>
                      <td style={{ ...cell, textAlign:"center", whiteSpace:"nowrap" }}>{s.start || ""}</td>
                      <td style={{ ...cell, textAlign:"center", whiteSpace:"nowrap" }}>{s.finish || ""}</td>
                      <td style={{ ...cell, textAlign:"center" }}>{s.effort || ""}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectDetail({ project, nav, onDelete, onEdit }) {
  const [tab, setTab] = useState("overview");
  // 테일러링결과서 실문서 생성용 컨텍스트 (SDLC는 tailoring JSON에 함께 저장됨)
  const pdpCtx = { ossp:project.ossp||null, sdlc:project.tailoring?.sdlc||null, tailoring:project.tailoring||null, pdp:project.pdp||null, requirements:project.tailoring?.requirements||null };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zipProgress, setZipProgress] = useState(null);   // 전체 ZIP 다운로드 진행 상황
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState(null);
  async function handleZipDownload() {
    if (zipping) return;
    setZipping(true); setZipError(null);
    try {
      await downloadDeliverablesZip(project.deliverables, project, project.wbs, pdpCtx, setZipProgress);
      setTimeout(() => setZipProgress(p => (p && p.percent >= 100 ? null : p)), 1500);
    } catch (e) {
      setZipProgress(null);
      setZipError("ZIP 다운로드 실패: " + e.message);
    }
    setZipping(false);
  }
  if (!project) return <div style={{ padding:40, color:T.muted }}>프로젝트를 선택하세요.</div>;
  return (
    <div style={{ padding:"16px", maxWidth:1000, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div style={{ flex:1 }}><h1 style={{ fontSize:17, fontWeight:700 }}>{project.name}</h1><p style={{ fontSize:11, color:T.muted }}>{project.client} · {project.ossp?.label} · PM: {project.pm}</p></div>
        <Btn variant="outline" onClick={()=>onEdit && onEdit(project)} style={{ fontSize:12, padding:"6px 10px" }}>✎ 수정</Btn>
        {confirmDelete
          ? <div style={{ display:"flex", gap:6 }}><Btn variant="danger" onClick={()=>onDelete(project.id)} style={{ fontSize:12, padding:"6px 10px" }}>삭제확인</Btn><Btn variant="ghost" onClick={()=>setConfirmDelete(false)} style={{ fontSize:12, padding:"6px 10px" }}>취소</Btn></div>
          : <Btn variant="ghost" onClick={()=>setConfirmDelete(true)} style={{ color:T.red, fontSize:12, padding:"6px 10px" }}>삭제</Btn>
        }
      </div>
      <div style={{ display:"flex", gap:3, marginBottom:16, background:T.surface, borderRadius:10, padding:3, border:`1px solid ${T.border}` }}>
        {[["overview","개요"],["pdp","PDP"],["wbs","WBS"],["deliverables","산출물"]].filter(([id]) => !(id === "pdp" && project.tailoring?.track === "aspice" && project.tailoring?.aspiceCL && project.tailoring.aspiceCL !== "CL3")).map(([id,label])=>(
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
      {tab==="pdp" && <PdpDocView project={project} />}
      {tab==="wbs" && <WbsScheduleView wbs={project.wbs} />}
      {tab==="deliverables" && project.deliverables && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <Btn onClick={handleZipDownload} disabled={zipping} style={{ fontSize:11, padding:"5px 12px" }}>{zipping ? "⏳ 생성 중…" : "⬇ 전체 ZIP 다운로드"}</Btn>
          </div>
          {(zipping || zipProgress) && (
            <GenProgressBar
              progress={zipProgress || { percent: 2, label: "ZIP 생성 준비 중…" }}
              subText="산출물별 템플릿 조회·문서 생성 후 ZIP으로 압축합니다. 건수가 많으면 시간이 걸릴 수 있습니다." />
          )}
          {zipError && <div style={{ color:T.red, fontSize:12, padding:10, background:T.red+"11", borderRadius:9 }}>{zipError}</div>}
          <div style={{ display:"flex", gap:10 }}>
            {[{label:"전체",value:project.deliverables.summary?.totalDocs||0,color:T.accent},{label:"필수(M)",value:project.deliverables.summary?.mandatoryCount||0,color:T.red},{label:"선택(O)",value:(project.deliverables.summary?.totalDocs||0)-(project.deliverables.summary?.mandatoryCount||0),color:T.amber}].map(s=>(
              <Card key={s.label} style={{ flex:1, padding:"12px 14px", textAlign:"center" }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{s.label}</div><div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div></Card>
            ))}
          </div>
          {project.deliverables.summary?.recon && (() => { const r = project.deliverables.summary.recon; const tt = project.deliverables.summary?.totalDocs||0; return (
            <div style={{ fontSize:10.5, color:T.muted, padding:"7px 10px", background:T.surface, border:`1px dashed ${T.border}`, borderRadius:8, lineHeight:1.7 }}>
              ℹ <b style={{ color:T.text }}>WBS 개수 대사</b> — 최하위 Task {r.leafTotal}건 중 산출물 지정 <b style={{ color:T.text }}>{r.leafWithDeliv}건</b> 전부 1:1 반영
              {r.leafTotal - r.leafWithDeliv > 0 && <> (미지정 {r.leafTotal - r.leafWithDeliv}건 제외)</>}
              {r.mgmtMerged > 0 && <> − 관리활동 중복 <b style={{ color:T.text }}>{r.mgmtMerged}건</b>(개발산출물로 통합)</>}
              {r.pdpInjected && <> + 테일러링결과서 <b style={{ color:T.text }}>1건</b>(필수 자동추가)</>}
              {" "}= 전체 <b style={{ color:T.accent }}>{tt}건</b>
              {r.dupIncluded > 0 && <span style={{ color:T.muted }}> · 동일 산출물명 {r.dupIncluded}건 포함(WBS 번호로 구분)</span>}
            </div>
          ); })()}
          {project.deliverables.categories?.map(cat=>(
            <Card key={cat.id} style={{ padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}><span style={{ fontSize:18 }}>{cat.icon}</span><span style={{ fontWeight:700, fontSize:14 }}>{cat.name}</span><span style={{ fontSize:11, color:T.muted, marginLeft:"auto" }}>{cat.documents?.length}건</span></div>
              {cat.documents?.map(doc=>(
                <div key={doc.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0", borderTop:`1px solid ${T.border}` }}>
                  {doc.wbsNo && <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted, border:`1px solid ${T.border}`, padding:"2px 5px", borderRadius:4, flexShrink:0, marginTop:2 }}>{doc.wbsNo}</span>}
                  <span style={{ fontFamily:"monospace", fontSize:9, color:T.accent, background:T.accentDim, padding:"2px 5px", borderRadius:4, flexShrink:0, marginTop:2 }}>{doc.code}</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{doc.name}</div><div style={{ fontSize:10, color:T.muted }}>{doc.taskName ? `${doc.taskName} — ` : ""}{doc.purpose}</div></div>
                  <Badge color={prioInfo(doc.priority).color}>{prioInfo(doc.priority).label}</Badge>
                  {isSignOffDoc(doc.name) ? (
                    <span title={signOffNote(doc.name)}
                      style={{ border:`1px solid ${T.amber}66`, borderRadius:6, color:T.amber, fontSize:10.5, padding:"3px 8px", flexShrink:0, whiteSpace:"nowrap" }}>서명본</span>
                  ) : (
                    <button onClick={()=>downloadSingleDeliverable(doc, cat.name, project, project.wbs, pdpCtx)} title="이 산출물만 다운로드"
                      style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, color:T.accent, cursor:"pointer", fontSize:11, padding:"3px 8px", flexShrink:0, fontFamily:"inherit" }}>⬇</button>
                  )}
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
function FileTree({ node, depth, openMap, toggle, onDownload, onRemove, selected, onToggleSelect, onBulkSelect, pathKey="", onMove, relPath="" }) {
  const folderNames = Object.keys(node.folders).sort((a,b)=>a.localeCompare(b,'ko'));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
      {folderNames.map(name => {
        const childPath = pathKey ? `${pathKey}/${name}` : name;
        const childRel = relPath ? `${relPath}/${name}` : name;   // 분류 안에서의 실제 폴더 경로 (file_name 접두)
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
              {onMove && <span onClick={e=>{ e.stopPropagation(); onMove({ type:"folder", path: childRel, name }); }} title="폴더 이동·이름 변경 (하위 파일 포함)"
                style={{ marginLeft:"auto", fontSize:10.5, color:T.muted, cursor:"pointer", fontWeight:400, flexShrink:0, padding:"0 2px" }}>⇄</span>}
            </div>
            {isOpen && (
              <FileTree node={child} depth={depth+1} openMap={openMap} toggle={toggle}
                onDownload={onDownload} onRemove={onRemove}
                selected={selected} onToggleSelect={onToggleSelect} onBulkSelect={onBulkSelect}
                pathKey={childPath} onMove={onMove} relPath={childRel} />
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
          {onMove && <span onClick={()=>onMove({ type:"file", file: f })} title="파일 이동·이름 변경" style={{ fontSize:10.5, color:T.muted, cursor:"pointer", flexShrink:0, padding:"0 2px" }}>⇄</span>}
          <span onClick={()=>onRemove(f)} style={{ fontSize:11, color:T.red, cursor:"pointer", flexShrink:0 }}>×</span>
        </div>
      ))}
    </div>
  );
}

// ── 자산 이동 계획 계산 (순수 함수) ──
// req: { type:"file", file } | { type:"folder", path, name, category } | { type:"selection", files }
// dest: { category, folder(분류 안 경로, ""=최상위), rename(파일·폴더 새 이름, 선택) }
// 반환: { moves:[{ id, from, file_name, category }], error }
const joinPath = (...xs) => xs.map(x => String(x || "").split("/").map(s => s.trim()).filter(Boolean).join("/")).filter(Boolean).join("/");
function planAssetMove(req, files, dest) {
  const folder = joinPath(dest.folder);
  const rename = String(dest.rename || "").trim();
  if (rename && /[\\/]/.test(rename)) return { moves: [], error: "이름에는 / 나 \\ 를 쓸 수 없습니다." };
  const base = n => String(n || "").split("/").pop();
  const catOf = id => (files.find(f => f.id === id) || {}).category;
  let moves = [];
  if (req.type === "file") {
    moves = [{ id: req.file.id, from: req.file.file_name, file_name: joinPath(folder, rename || base(req.file.file_name)), category: dest.category }];
  } else if (req.type === "folder") {
    const P = req.path, sameCat = dest.category === req.category;
    if (sameCat && (folder === P || folder.startsWith(P + "/"))) return { moves: [], error: "폴더를 자기 자신이나 하위 폴더 안으로 옮길 수 없습니다." };
    const inside = files.filter(f => f.category === req.category && String(f.file_name).startsWith(P + "/"));
    moves = inside.map(f => ({ id: f.id, from: f.file_name, file_name: joinPath(folder, rename || req.name, String(f.file_name).slice(P.length + 1)), category: dest.category }));
  } else {
    moves = (req.files || []).map(f => ({ id: f.id, from: f.file_name, file_name: joinPath(folder, base(f.file_name)), category: dest.category }));
  }
  moves = moves.filter(m => m.file_name !== m.from || m.category !== catOf(m.id));
  if (!moves.length) return { moves: [], error: "바뀌는 항목이 없습니다." };
  // 충돌: 이동 결과끼리, 그리고 남는 파일과 같은 경로
  const movingIds = new Set(moves.map(m => m.id));
  const occ = new Set(files.filter(f => !movingIds.has(f.id)).map(f => `${f.category}|${f.file_name}`));
  for (const m of moves) { const k = `${m.category}|${m.file_name}`; if (occ.has(k)) return { moves, error: `같은 위치에 같은 이름의 파일이 있습니다: ${m.file_name}` }; occ.add(k); }
  return { moves, error: null };
}
// 분류 안의 모든 폴더 경로 (이동 대상 목록)
function folderPathsOf(files, category) {
  const set = new Set();
  files.filter(f => f.category === category).forEach(f => { const parts = String(f.file_name).split("/"); parts.pop(); for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join("/")); });
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}
function AssetMoveDialog({ req, files, categories, onClose, onApply }) {
  const curCat = req.type === "file" ? req.file.category : req.type === "folder" ? req.category : (req.files[0] || {}).category;
  const curFolder = req.type === "file" ? String(req.file.file_name).split("/").slice(0, -1).join("/") : req.type === "folder" ? req.path.split("/").slice(0, -1).join("/") : "";
  const [cat, setCat] = useState(curCat);
  const [folder, setFolder] = useState(curFolder);
  const [newSub, setNewSub] = useState("");
  const [rename, setRename] = useState(req.type === "file" ? String(req.file.file_name).split("/").pop() : req.type === "folder" ? req.name : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const paths = folderPathsOf(files, cat).filter(p => !(req.type === "folder" && cat === curCat && (p === req.path || p.startsWith(req.path + "/"))));
  const dest = { category: cat, folder: joinPath(folder, newSub), rename: req.type === "selection" ? "" : rename };
  const plan = planAssetMove({ ...req, category: curCat }, files, dest);
  const title = req.type === "file" ? "파일 이동·이름 변경" : req.type === "folder" ? `폴더 이동·이름 변경 — ${req.name}` : `선택한 ${req.files.length}개 파일 이동`;
  const sel = { width:"100%", padding:"7px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" };
  async function apply() {
    if (plan.error || !plan.moves.length) return;
    setBusy(true); setErr(null);
    try { await onApply(plan.moves); onClose(); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18, width:"100%", maxWidth:560 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:11, color:T.muted, marginBottom:12 }}>파일을 다시 올리지 않고 위치(경로)만 바꿉니다. 같은 위치에 같은 이름의 파일이 있으면 이동하지 않습니다.{req.type === "selection" ? " 선택한 파일은 대상 폴더 바로 아래로 옮겨집니다(폴더 구조를 유지하려면 폴더 옆 ⇄를 쓰세요)." : ""}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div><div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>자산 분류</div>
            <select value={cat} onChange={e=>{ setCat(e.target.value); setFolder(""); }} style={sel}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>대상 폴더</div>
            <select value={folder} onChange={e=>setFolder(e.target.value)} style={sel}>
              <option value="">(최상위)</option>
              {paths.map(p => <option key={p} value={p}>{"\u00a0\u00a0".repeat(p.split("/").length - 1)}{p.split("/").pop()}</option>)}
            </select></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: req.type === "selection" ? "1fr" : "1fr 1fr", gap:10, marginBottom:10 }}>
          <div><div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>새 하위 폴더 (선택 — 대상 폴더 안에 만듦)</div>
            <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="예: 8000 HW요구설계검증" style={sel} /></div>
          {req.type !== "selection" && <div><div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>{req.type === "folder" ? "폴더 이름" : "파일 이름"}</div>
            <input value={rename} onChange={e=>setRename(e.target.value)} style={sel} /></div>}
        </div>
        <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>미리보기 {plan.moves.length ? `(${plan.moves.length}건)` : ""}</div>
        <div style={{ maxHeight:150, overflowY:"auto", background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 8px", fontSize:10.5, lineHeight:1.6, marginBottom:8 }}>
          {plan.moves.slice(0, 50).map(m => <div key={m.id}><span style={{ color:T.muted }}>{m.from}</span> → <span style={{ color:T.text }}>{m.category !== curCat ? `[${m.category}] ` : ""}{m.file_name}</span></div>)}
          {plan.moves.length > 50 && <div style={{ color:T.muted }}>… 외 {plan.moves.length - 50}건</div>}
          {!plan.moves.length && <div style={{ color:T.muted }}>바뀌는 항목이 없습니다.</div>}
        </div>
        {(plan.error || err) && <div style={{ fontSize:11, color:T.red, marginBottom:8 }}>⚠ {err || plan.error}</div>}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ fontSize:12, padding:"6px 14px" }}>취소</Btn>
          <Btn onClick={apply} disabled={busy || !!plan.error || !plan.moves.length} style={{ fontSize:12, padding:"6px 16px" }}>{busy ? "이동 중…" : "이동"}</Btn>
        </div>
      </div>
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
// 기본 제공 방법론의 단계별 표준 산출물 목록 (읽기 전용 프리셋)
function BuiltinDeliverables({ label }) {
  const groups = BUILTIN_DELIVERABLES[label];
  if (!groups) return null;
  const total = Object.values(groups).reduce((n, arr) => n + arr.length, 0);
  return (
    <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
      <div style={{ fontSize:12, fontWeight:700, color:T.muted, marginBottom:10 }}>
        기본 산출물 <span style={{ fontWeight:400 }}>({total}종 · 표준 제공)</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {Object.entries(groups).map(([phase, items]) => (
          <div key={phase} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.accent, marginBottom:6 }}>{phase}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {items.map(d => (
                <span key={d} style={{ fontSize:11, padding:"3px 8px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, color:T.text }}>{d}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// OSSP 자산 묶음 다운로드 — 서명 URL로 원본 바이트를 받아 "분류/원래 경로" 그대로 ZIP으로 묶는다(재업로드 시 + 폴더로 그대로 복원 가능).
// 자산목록.csv(분류·경로·크기·등록일)를 함께 넣어 누락 여부를 대조할 수 있게 한다.
async function downloadOsspZip(fileList, zipName, onProgress) {
  const list = (fileList || []).filter(f => f && f.file_url);
  if (!list.length) throw new Error("내려받을 파일이 없습니다.");
  const out = new Array(list.length), failed = [];
  let done = 0, next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++, f = list[i];
      try {
        const sr = await fetch(`/api/ossp-files?path=${encodeURIComponent(f.file_url)}`);
        const sd = await sr.json().catch(() => ({}));
        if (!sr.ok || !sd.url) throw new Error(sd.error || "서명 URL 발급 실패");
        const br = await fetch(sd.url);
        if (!br.ok) throw new Error(`HTTP ${br.status}`);
        out[i] = { f, bytes: new Uint8Array(await br.arrayBuffer()) };
      } catch (e) { failed.push(`${f.file_name}: ${e.message}`); }
      done++; onProgress && onProgress(done, list.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
  const used = new Set(), files = [];
  const csv = [["분류", "경로", "크기(byte)", "등록일"]];
  out.forEach(o => {
    if (!o) return;
    let path = `${o.f.category}/${String(o.f.file_name).replace(/^\/+/, "")}`;
    if (used.has(path)) { const dot = path.lastIndexOf("."); let k = 2; while (used.has(`${path.slice(0, dot)} (${k})${path.slice(dot)}`)) k++; path = `${path.slice(0, dot)} (${k})${path.slice(dot)}`; }
    used.add(path); files.push({ path, content: o.bytes });
    csv.push([o.f.category, o.f.file_name, o.bytes.length, String(o.f.created_at || "").slice(0, 10)]);
  });
  if (!files.length) throw new Error(`모든 파일 다운로드 실패 — ${failed.slice(0, 2).join(" / ")}`);
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  files.push({ path: "_자산목록.csv", content: "\uFEFF" + csv.map(r => r.map(q).join(",")).join("\r\n") });
  const blob = new Blob([zipBytes(files)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = zipName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { count: files.length - 1, failed };
}

function OSSPAssets({ osspId, osspLabel }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);   // 업로드 중인 category
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState(null);
  const [dragCat, setDragCat] = useState(null);  // 드래그 오버 중인 category
  const [openMap, setOpenMap] = useState({});    // 폴더 경로별 펼침 상태
  const [selected, setSelected] = useState({});  // 선택된 파일 id 맵 (다중 삭제·이동용)
  const [moveReq, setMoveReq] = useState(null);  // 이동·이름 변경 대화상자 요청
  const [zipState, setZipState] = useState(null); // { label, done, total } — 묶음 다운로드 진행
  const [zipMsg, setZipMsg] = useState(null);
  async function zipDownload(list, scopeLabel) {
    if (zipState) return;
    const san = x => String(x || "").replace(/[\\/:*?"<>|]/g, "_").trim();
    const d = new Date(), ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const name = `${san(osspLabel) || "OSSP"}${scopeLabel ? `_${san(scopeLabel)}` : ""}_자산_${ymd}.zip`;
    setErr(null); setZipMsg(null); setZipState({ label: scopeLabel || "전체", done: 0, total: list.length });
    try {
      const r = await downloadOsspZip(list, name, (done, total) => setZipState(z => z && { ...z, done, total }));
      setZipMsg(r.failed.length ? `ZIP ${r.count}개 완료 — ${r.failed.length}개 실패: ${r.failed.slice(0, 3).join(" / ")}` : `ZIP 다운로드 완료 — 파일 ${r.count}개 (+ 자산목록.csv)`);
    } catch (e) { setErr(e.message); }
    setZipState(null);
  }
  async function applyMoves(moves) {
    const res = await fetch("/api/ossp-files", { method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ action:"move", ossp_id: osspId, items: moves.map(m => ({ id: m.id, file_name: m.file_name, category: m.category })) }) });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || "이동 실패");
    setSelected({});
    await load();
  }
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
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.muted }}>표준 프로세스 자산 (8종)</div>
          <Btn variant="outline" disabled={!!zipState || !files.length} onClick={()=>zipDownload(files, "")} title="이 방법론의 모든 자산을 분류·폴더 구조 그대로 ZIP으로 내려받습니다"
            style={{ fontSize:11, padding:"4px 10px" }}>{zipState ? `ZIP 만드는 중… ${zipState.done}/${zipState.total}` : `⬇ 전체 ZIP (${files.length})`}</Btn>
        </div>
        {selectedFiles.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:T.accent, fontWeight:600 }}>{selectedFiles.length}개 선택됨</span>
            <Btn variant="outline" disabled={!!zipState} onClick={()=>zipDownload(selectedFiles, "선택")} style={{ fontSize:11, padding:"4px 10px" }}>선택 ZIP</Btn>
            <Btn variant="ghost" onClick={()=>setSelected({})} style={{ fontSize:11, padding:"4px 10px" }}>선택 해제</Btn>
            <Btn variant="outline" onClick={()=>{ const cats = new Set(selectedFiles.map(f => f.category)); if (cats.size > 1) { setErr("서로 다른 자산 분류의 파일은 한 번에 옮길 수 없습니다. 분류별로 선택하세요."); return; } setMoveReq({ type:"selection", files: selectedFiles }); }} style={{ fontSize:11, padding:"4px 10px" }}>선택 이동</Btn>
            <Btn variant="danger" onClick={()=>removeMany(selectedFiles)} style={{ fontSize:11, padding:"4px 10px" }}>선택 삭제</Btn>
          </div>
        )}
      </div>
      {err && <div style={{ color:T.red, fontSize:11, marginBottom:8 }}>{err}</div>}
      {zipMsg && <div style={{ color:zipMsg.includes("실패") ? T.amber : T.green, fontSize:11, marginBottom:8 }}>{zipMsg}</div>}
      {moveReq && <AssetMoveDialog req={moveReq} files={files} categories={OSSP_ASSET_CATEGORIES} onClose={()=>setMoveReq(null)} onApply={applyMoves} />}
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
                    {(byCat[cat]||[]).length > 0 && <span onClick={()=>zipDownload(byCat[cat], cat)} title={`${cat} 자산을 ZIP으로 내려받기`}
                      style={{ fontSize:10, color: zipState ? T.muted : T.accent, cursor: zipState ? "default" : "pointer", fontWeight:600 }}>⬇ ZIP</span>}
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
                  onMove={r => setMoveReq(r.type === "folder" ? { ...r, category: cat } : r)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 규제 / Best Practice 공용 파일 라이브러리 (kind로 구분)
// OSSP 자산 관리와 동일한 직접 업로드·폴더 트리·다중삭제 로직을 재사용.
function LibraryPage({ nav, kind, title, subtitle, categories }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);          // 업로드 중인 category
  const [progress, setProgress] = useState({ done:0, total:0 });
  const [err, setErr] = useState(null);
  const [dragCat, setDragCat] = useState(null);
  const [openMap, setOpenMap] = useState({});
  const [selected, setSelected] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/library-files?kind=${kind}`);
      setFiles(await res.json());
    } catch(e){ setErr(e.message); }
    setLoading(false);
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [kind]);

  async function uploadMany(category, fileList) {
    const arr = Array.from(fileList || []).filter(f => f && f.size >= 0);
    if (arr.length === 0) return;
    setBusy(category); setErr(null);
    setProgress({ done:0, total:arr.length });
    const failed = [];
    for (let i=0;i<arr.length;i++){
      const file = arr[i];
      try {
        const rel = (file._relPath && file._relPath !== file.name)
          ? file._relPath
          : (file.webkitRelativePath && file.webkitRelativePath !== file.name ? file.webkitRelativePath : file.name);
        const signRes = await fetch("/api/library-files", {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body:JSON.stringify({ action:"sign-upload", kind, category, file_name:rel }),
        });
        if (!signRes.ok){ const e=await signRes.json().catch(()=>({})); throw new Error(e.error||"업로드 URL 발급 실패"); }
        const { storage_path, upload_url } = await signRes.json();
        const putRes = await fetch(upload_url, { method:"PUT", headers:{ "Content-Type":file.type||"application/octet-stream" }, body:file });
        if (!putRes.ok){ const t=await putRes.text().catch(()=>""); throw new Error(`Storage 업로드 실패 (${putRes.status}) ${t.slice(0,120)}`); }
        const commitRes = await fetch("/api/library-files", {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body:JSON.stringify({ action:"commit", kind, category, file_name:rel, storage_path, file_type:file.type, file_size:file.size }),
        });
        if (!commitRes.ok){ const e=await commitRes.json().catch(()=>({})); throw new Error(e.error||"메타데이터 저장 실패"); }
      } catch(e){ failed.push(`${file.name}: ${e.message}`); }
      setProgress({ done:i+1, total:arr.length });
    }
    if (failed.length) setErr(`${failed.length}개 실패 — ${failed.slice(0,3).join(" / ")}${failed.length>3?" …":""}`);
    await load(); setBusy(null); setProgress({ done:0, total:0 });
  }

  async function onDrop(category, e){
    e.preventDefault(); setDragCat(null);
    if (busy) return;
    const collected = await collectDroppedFiles(e.dataTransfer);
    if (collected.length) uploadMany(category, collected);
  }

  async function download(f){
    try {
      const res = await fetch(`/api/library-files?path=${encodeURIComponent(f.file_url)}&name=${encodeURIComponent(f.file_name.split("/").pop())}`);
      const { url } = await res.json();
      if (url) window.open(url, "_blank");
    } catch(e){ setErr(e.message); }
  }

  async function removeFile(f){
    if (!confirm(`'${f.file_name}'을(를) 삭제할까요?`)) return;
    try { await fetch(`/api/library-files?id=${f.id}&path=${encodeURIComponent(f.file_url)}`, { method:"DELETE" }); await load(); }
    catch(e){ setErr(e.message); }
  }

  async function removeMany(fileList){
    const arr = (fileList||[]).filter(Boolean);
    if (arr.length===0) return;
    if (!confirm(`선택한 ${arr.length}개 파일을 삭제할까요?`)) return;
    setErr(null); const failed=[];
    for (const f of arr){
      try { await fetch(`/api/library-files?id=${f.id}&path=${encodeURIComponent(f.file_url)}`, { method:"DELETE" }); }
      catch(e){ failed.push(`${f.file_name}: ${e.message}`); }
    }
    if (failed.length) setErr(`${failed.length}개 삭제 실패`);
    setSelected({}); await load();
  }

  const toggleFolder = (p) => setOpenMap(m=>({ ...m, [p]: m[p]===false ? true : false }));
  const toggleSelect = (id) => setSelected(s=>({ ...s, [id]: !s[id] }));
  const setSelectBulk = (ids,v) => setSelected(s=>{ const n={...s}; ids.forEach(id=>{n[id]=v;}); return n; });

  const byCat = {};
  files.forEach(f => { (byCat[f.category] = byCat[f.category] || []).push(f); });
  const selectedFiles = files.filter(f => selected[f.id]);

  return (
    <div style={{ padding:"16px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={()=>nav("dashboard")} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20 }}>←</button>
        <div style={{ flex:1 }}><h1 style={{ fontSize:17, fontWeight:700 }}>{title}</h1><p style={{ fontSize:11, color:T.muted }}>{subtitle}</p></div>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.muted }}>카테고리 ({categories.length})</div>
        {selectedFiles.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:T.accent, fontWeight:600 }}>{selectedFiles.length}개 선택됨</span>
            <Btn variant="ghost" onClick={()=>setSelected({})} style={{ fontSize:11, padding:"4px 10px" }}>선택 해제</Btn>
            <Btn variant="danger" onClick={()=>removeMany(selectedFiles)} style={{ fontSize:11, padding:"4px 10px" }}>선택 삭제</Btn>
          </div>
        )}
      </div>
      {err && <div style={{ color:T.red, fontSize:11, marginBottom:8 }}>{err}</div>}

      {loading ? <Spinner text="라이브러리 불러오는 중…" /> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
          {categories.map(cat=>(
            <div key={cat}
              onDragOver={e=>{ e.preventDefault(); if(!busy) setDragCat(cat); }}
              onDragLeave={e=>{ e.preventDefault(); setDragCat(c=>c===cat?null:c); }}
              onDrop={e=>onDrop(cat, e)}
              style={{ background: dragCat===cat ? T.accentGlow : T.bg,
                border:`1px ${dragCat===cat?"dashed":"solid"} ${dragCat===cat?T.accent:T.border}`,
                borderRadius:8, padding:"10px 12px", transition:"all .15s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:600 }}>{cat}</span>
                {busy===cat ? (
                  <span style={{ fontSize:10, color:T.accent, fontWeight:600 }}>업로드 중… {progress.done}/{progress.total}</span>
                ) : (
                  <span style={{ display:"flex", gap:8 }}>
                    <label style={{ fontSize:10, color:T.accent, cursor:"pointer", fontWeight:600 }}>+ 파일
                      <input type="file" multiple style={{ display:"none" }} disabled={!!busy}
                        onChange={e=>{ uploadMany(cat, e.target.files); e.target.value=""; }} />
                    </label>
                    <label style={{ fontSize:10, color:T.muted, cursor:"pointer", fontWeight:600 }}>+ 폴더
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
                <FileTree node={buildFileTree(byCat[cat]||[])} depth={0} openMap={openMap} toggle={toggleFolder}
                  onDownload={download} onRemove={removeFile}
                  selected={selected} onToggleSelect={toggleSelect} onBulkSelect={setSelectBulk} pathKey={cat} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OSSPPage({ nav, customOSSP=[], builtinOSSP=[], onAdd, onDelete }) {
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

  const renderCard = (o, kind) => {          // kind: "custom" | "builtin"
    const deletable = kind === "custom";
    const isOpen = expanded === o.id;
    const hasDbId = kind === "custom" || o.builtin === true;  // DB UUID 보유 → 파일 업로드 가능
    return (
      <Card key={o.id} style={{ padding:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <span style={{ fontSize:16, fontWeight:700 }}>{o.label}</span>
              {o.version && <Badge color={T.accent}>{o.version}</Badge>}
              {deletable ? <Badge color={T.green}>사내</Badge> : <Badge color={T.muted}>기본</Badge>}
            </div>
            <div style={{ fontSize:12, color:T.muted }}>{o.desc}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn variant="outline" onClick={()=>setExpanded(isOpen ? null : o.id)} style={{ fontSize:11, padding:"5px 10px" }}>
              {isOpen ? "자산 닫기" : "자산 관리"}
            </Btn>
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
        {isOpen && (
          <>
            {kind === "builtin" && <BuiltinDeliverables label={o.label} />}
            {hasDbId
              ? <OSSPAssets osspId={o.id} osspLabel={o.label} />
              : <div style={{ marginTop:12, fontSize:11, color:T.muted }}>※ 파일 업로드 준비 중입니다. 페이지를 새로고침하면 기본 방법론이 서버에 자동 등록됩니다.</div>}
          </>
        )}
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
            {customOSSP.map(o=>renderCard(o, "custom"))}
          </>
        )}
        <div style={{ fontSize:12, fontWeight:600, color:T.muted, marginTop:8 }}>기본 제공</div>
        {(builtinOSSP.length > 0 ? builtinOSSP : OSSP_OPTIONS).map(o=>renderCard(o, "builtin"))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 설정 (Settings)
// ──────────────────────────────────────────────────────────────────────
// 탭 구성
//   1. 사용자 관리      : 계정 등록(ID/PW)·역할 부여·활성화·비밀번호 초기화·삭제
//   2. AI 연동          : AI 모델 등록(Claude·Gemini·ChatGPT·사내 LLM) + 역할 지정(생성 AI·기본 검토 AI 각 1개)
//   3. 조직·문서 기본값 : 조직명, 기본 로고, 문서번호 접두어, 작성/검토/승인자, 배포구분
//   4. QA 기본 정책     : 기본 규모·설계방식·프로세스 적용등급·SDLC 요인·공휴일
//   5. 내 계정          : 세션 정보, 비밀번호 변경
//   6. 시스템 진단·감사 : 환경변수/테이블 상태 점검, 설정 변경 감사 로그
//
// 권한: 1~4·6 탭은 관리자(admin) 전용. 화면 노출뿐 아니라 서버(api/_auth.js
//       requireRole)에서도 재검증하므로 클라이언트 우회로는 변경할 수 없다.
// ══════════════════════════════════════════════════════════════════════

const SETTINGS_TABS = [
  { id: "users",   icon: "◍", label: "사용자 관리",      admin: true  },
  { id: "ai",      icon: "✦", label: "AI 연동",          admin: true  },
  { id: "org",     icon: "▣", label: "조직·문서 기본값", admin: true  },
  { id: "qa",      icon: "◎", label: "QA 기본 정책",     admin: true  },
  { id: "account", icon: "⚿", label: "내 계정",          admin: false },
  { id: "system",  icon: "⚕", label: "시스템 진단·감사", admin: true  },
];

// 검증된 모델 프리셋 — 목록에 없는 모델도 직접 입력 후 "연결 검증"으로 확인 가능
const AI_MODEL_PRESETS = [
  { id: "claude-haiku-4-5-20251001",  label: "Haiku 4.5",  note: "빠르고 저렴 · 대량 청크 호출에 적합 (권장)" },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5", note: "균형형 · 요구사항 명세 등 서술 품질 중시" },
];

function SettingsSection({ title, desc, children, right }) {
  return (
    <Card style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: desc ? 4 : 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      {desc && <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>{desc}</div>}
      {children}
    </Card>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  const color = msg.type === "error" ? T.red : msg.type === "warn" ? T.amber : T.green;
  return (
    <div style={{ padding: "10px 14px", borderRadius: 10, background: color + "18", border: `1px solid ${color}55`,
      color, fontSize: 12, marginBottom: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
      {msg.text}
    </div>
  );
}

// 설정 테이블 미생성 시 안내 — Supabase SQL Editor에 붙여넣을 DDL 제공
function SetupRequiredBanner({ sql }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card style={{ padding: 20, marginBottom: 16, borderColor: T.amber + "66" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, marginBottom: 8 }}>초기 설치가 필요합니다</div>
      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 12 }}>
        설정 기능이 사용하는 테이블(app_users · app_settings · app_audit_logs)이 아직 없습니다.<br />
        Supabase 대시보드 → SQL Editor에서 아래 SQL을 <b>1회</b> 실행한 뒤 이 화면을 새로고침하세요.
      </div>
      <pre style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14,
        fontSize: 10.5, lineHeight: 1.6, color: T.muted, overflowX: "auto", fontFamily: "monospace", marginBottom: 10 }}>{sql}</pre>
      <Btn variant="outline" style={{ fontSize: 12, padding: "6px 14px" }}
        onClick={() => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
        {copied ? "✓ 복사됨" : "SQL 복사"}
      </Btn>
    </Card>
  );
}


// 화면 안에서 다시 로그인 — 전체 로그아웃 없이 세션만 교체한다.
// 사용 시점: (1) 이전 버전의 서명 없는 토큰을 가진 사용자, (2) 유예기간까지 지난 만료 세션.
// 어느 경우에도 사용자를 로그인 화면으로 튕겨내지 않고, 설정 기능이 필요한 순간에만 요구한다.
function ReauthCard({ session, onReauth }) {
  const [id, setId] = useState(session?.login_id || "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!id || !pw) { setErr("아이디와 비밀번호를 입력하세요."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/login", { method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ id, pw }) });
      const d = await res.json().catch(()=>({}));
      if (res.ok && d.ok && d.token) onReauth(d.token);
      else setErr(d.error || "로그인에 실패했습니다.");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <Card style={{ padding: 22, borderColor: T.amber + "66", maxWidth: 460 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, marginBottom: 8 }}>재로그인이 필요합니다</div>
      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 16 }}>
        {session?.legacy
          ? "이전 버전에서 발급된 세션이라 설정 기능의 권한을 확인할 수 없습니다."
          : "세션 유효기간이 지났습니다."}<br />
        아래에 다시 로그인하면 <b>작업 중인 내용을 잃지 않고</b> 이어서 사용할 수 있습니다.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input label="아이디" value={id} onChange={setId} placeholder="아이디" />
        <Input label="비밀번호" type="password" value={pw} onChange={setPw} placeholder="비밀번호" />
        {err && <div style={{ color: T.red, fontSize: 12 }}>{err}</div>}
        <div><Btn onClick={submit} disabled={busy} style={{ fontSize: 12, padding: "8px 20px" }}>{busy ? "확인 중…" : "다시 로그인"}</Btn></div>
      </div>
    </Card>
  );
}

function SettingsPage({ nav, session, settings, settingsErr, onReload, onApplyDefaults, onLogout, onReauth }) {
  const isAdmin = session?.role === "admin";
  const tabs = SETTINGS_TABS.filter(t => isAdmin || !t.admin);
  const [tab, setTab] = useState(isAdmin ? "users" : "account");
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(m => (m && m.text === text ? null : m)), 6000); };
  const setupSql = settingsErr?.data?.code === "SETUP_REQUIRED" ? settingsErr.data.sql : null;

  return (
    <div className="main-content" style={{ padding: "20px 18px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={() => nav("dashboard")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>설정</h1>
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 18, marginLeft: 30 }}>
        사용자 계정, AI 연동, 조직 표준 기본값 및 QA 기본 정책을 관리합니다.
      </div>

      {/* 재인증 필요 세션: 앱은 그대로 쓰되 설정 기능만 재로그인 후 열어 준다 */}
      {session?.needsReauth ? <ReauthCard session={session} onReauth={onReauth} /> : (<>

      {setupSql && <SetupRequiredBanner sql={setupSql} />}
      {settingsErr && !setupSql && settingsErr.status !== 401 && (
        <Toast msg={{ type: "error", text: `설정을 불러오지 못했습니다: ${settingsErr.message}` }} />
      )}

      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setMsg(null); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10,
              background: tab === t.id ? T.accentGlow : "transparent", color: tab === t.id ? T.accent : T.muted,
              border: `1px solid ${tab === t.id ? T.accentDim : "transparent"}`, cursor: "pointer",
              fontSize: 12.5, fontWeight: tab === t.id ? 600 : 400, fontFamily: "inherit" }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <Toast msg={msg} />

      {tab === "users"   && <UsersTab flash={flash} session={session} />}
      {tab === "ai"      && <AiTab flash={flash} settings={settings} onReload={onReload} />}
      {tab === "org"     && <OrgTab flash={flash} settings={settings} onReload={onReload} />}
      {tab === "qa"      && <QaTab flash={flash} settings={settings} onReload={onReload} onApplyDefaults={onApplyDefaults} />}
      {tab === "account" && <AccountTab flash={flash} session={session} onLogout={onLogout} />}
      {tab === "system"  && <SystemTab flash={flash} />}

      </>)}
    </div>
  );
}

// ── 1. 사용자 관리 ────────────────────────────────────────────────────
function UsersTab({ flash, session }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { login_id: "", pw: "", pw2: "", name: "", email: "", role: "qa" };
  const [f, setF] = useState(blank);
  const [ef, setEf] = useState({ name: "", email: "", role: "qa", is_active: true });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUsers(await apiFetch("/api/users")); }
    catch (e) { flash("error", e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function create() {
    if (f.pw !== f.pw2) { flash("error", "비밀번호 확인이 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify({
        login_id: f.login_id, pw: f.pw, name: f.name, email: f.email, role: f.role }) });
      flash("ok", `사용자 "${f.login_id}"을(를) 등록했습니다.`);
      setF(blank); setShowAdd(false); await load();
    } catch (e) { flash("error", e.message); }
    setBusy(false);
  }

  async function patch(id, body, okMsg) {
    try { await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
      flash("ok", okMsg); await load(); return true; }
    catch (e) { flash("error", e.message); return false; }
  }

  // 계정 정보 편집 — 이름·이메일·역할·상태를 한 번에 수정한다.
  // 아이디(login_id)는 감사 로그·세션 식별자로 쓰이므로 읽기 전용.
  function openEdit(u) {
    if (editId === u.id) { setEditId(null); return; }
    setEditId(u.id);
    setEf({ name: u.name || "", email: u.email || "", role: u.role || "qa", is_active: !!u.is_active });
  }

  async function saveEdit(u) {
    const name = (ef.name || "").trim();
    const email = (ef.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      flash("error", "이메일 형식이 올바르지 않습니다."); return;
    }

    const body = {};
    if (name !== (u.name || "")) body.name = name;
    if (email !== (u.email || "")) body.email = email;
    if (ef.role !== u.role) body.role = ef.role;
    if (ef.is_active !== !!u.is_active) body.is_active = ef.is_active;
    if (!Object.keys(body).length) { flash("error", "변경된 항목이 없습니다."); setEditId(null); return; }

    const isMe = session?.uid === u.id;
    if (isMe && body.role !== undefined && body.role !== "admin") {
      if (!confirm(`본인 계정의 역할을 "${ROLE_LABELS[body.role]}"(으)로 변경합니다.\n관리자 권한을 잃으면 설정 화면에 다시 들어올 수 없습니다. 계속할까요?`)) return;
    }
    if (isMe && body.is_active === false) {
      if (!confirm("본인 계정을 비활성화합니다. 다음 접속부터 로그인할 수 없습니다. 계속할까요?")) return;
    }

    const LBL = { name: "이름", email: "이메일", role: "역할", is_active: "상태" };
    const changed = Object.keys(body).map(k => LBL[k]).join("·");
    setBusy(true);
    const ok = await patch(u.id, body, `"${u.login_id}" 계정의 ${changed}${josaEul(changed)} 수정했습니다.`);
    setBusy(false);
    if (ok) setEditId(null);   // 실패 시 입력값을 잃지 않도록 패널을 열어 둔다
  }

  async function resetPw(u) {
    const np = prompt(`"${u.login_id}" 계정의 새 비밀번호를 입력하세요.\n(8자 이상, 영문+숫자 포함)`);
    if (!np) return;
    await patch(u.id, { newPw: np }, `"${u.login_id}"의 비밀번호를 초기화했습니다. 사용자에게 안전한 경로로 전달하세요.`);
  }

  async function remove(u) {
    if (!confirm(`"${u.login_id}" 계정을 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`)) return;
    try { await apiFetch(`/api/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
      flash("ok", `"${u.login_id}" 계정을 삭제했습니다.`); await load(); }
    catch (e) { flash("error", e.message); }
  }

  const th = { textAlign: "left", padding: "9px 10px", fontSize: 10.5, color: T.muted, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  const td = { padding: "10px", fontSize: 12, borderBottom: `1px solid ${T.border}`, verticalAlign: "middle" };

  return (
    <div>
      <SettingsSection
        title="사용자 계정"
        desc={`${APP_NAME}에 로그인할 계정을 등록합니다. 비밀번호는 PBKDF2-SHA256 해시로만 저장되며 평문은 어디에도 보관되지 않습니다. 역할에 따라 설정 접근 권한이 달라집니다.`}
        right={<Btn variant={showAdd ? "ghost" : "primary"} onClick={() => { setShowAdd(!showAdd); setF(blank); }}
          style={{ fontSize: 12, padding: "6px 14px" }}>{showAdd ? "취소" : "+ 사용자 등록"}</Btn>}
      >
        {showAdd && (
          <div style={{ background: T.bg, border: `1px solid ${T.accentDim}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <Input label="아이디 *" value={f.login_id} onChange={v => setF(s => ({ ...s, login_id: v }))} placeholder="영문·숫자 3~40자" />
              <Input label="이름" value={f.name} onChange={v => setF(s => ({ ...s, name: v }))} placeholder="예: 홍길동" />
              <Input label="비밀번호 *" type="password" value={f.pw} onChange={v => setF(s => ({ ...s, pw: v }))} placeholder="8자 이상, 영문+숫자" />
              <Input label="비밀번호 확인 *" type="password" value={f.pw2} onChange={v => setF(s => ({ ...s, pw2: v }))} placeholder="다시 입력" />
              <Input label="이메일" value={f.email} onChange={v => setF(s => ({ ...s, email: v }))} placeholder="예: hong@company.co.kr" />
              <Select label="역할" value={f.role} onChange={v => setF(s => ({ ...s, role: v }))}
                options={ASSIGNABLE_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }))} />
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 10, lineHeight: 1.6 }}>
              {ROLE_LABELS[f.role]} — {ROLE_DESC[f.role]}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <Btn onClick={create} disabled={busy || !f.login_id || !f.pw} style={{ fontSize: 12, padding: "7px 18px" }}>
                {busy ? "등록 중…" : "등록"}
              </Btn>
            </div>
          </div>
        )}

        {loading ? <Spinner text="사용자 목록 불러오는 중…" /> : users.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
            등록된 사용자가 없습니다.<br />
            현재는 환경변수(APP_LOGIN_ID / APP_LOGIN_PW) 기반 부트스트랩 관리자로 접속 중입니다.<br />
            첫 관리자 계정을 등록하는 것을 권장합니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead><tr>
                <th style={th}>아이디</th><th style={th}>이름</th><th style={th}>이메일</th>
                <th style={th}>역할</th><th style={th}>상태</th><th style={th}>최근 로그인</th><th style={th}>작업</th>
              </tr></thead>
              <tbody>
                {users.map(u => {
                  const editing = editId === u.id;
                  const isMe = session?.uid === u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <tr>
                        <td style={{ ...td, fontWeight: 600 }}>{u.login_id}{isMe && <span style={{ color: T.accent, fontSize: 10, marginLeft: 6 }}>(나)</span>}</td>
                        <td style={td}>{u.name || "—"}</td>
                        <td style={{ ...td, color: T.muted }}>{u.email || "—"}</td>
                        <td style={td}><Badge color={u.role === "admin" ? T.amber : T.accent}>{ROLE_LABELS[u.role] || u.role}</Badge></td>
                        <td style={td}><Badge color={u.is_active ? T.green : T.muted}>{u.is_active ? "활성" : "비활성"}</Badge></td>
                        <td style={{ ...td, color: T.muted, fontSize: 11, whiteSpace: "nowrap" }}>
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString("ko-KR") : "—"}
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => openEdit(u)} title="이름·이메일·역할·상태 편집"
                              style={{ background: "none", borderRadius: 7, cursor: "pointer", fontSize: 10.5, padding: "4px 8px", fontFamily: "inherit", border: `1px solid ${editing ? T.accent : T.border}`, color: editing ? T.accent : T.muted }}>
                              {editing ? "닫기" : "편집"}
                            </button>
                            <button onClick={() => resetPw(u)} title="비밀번호 초기화"
                              style={{ background: "none", borderRadius: 7, cursor: "pointer", fontSize: 10.5, padding: "4px 8px", fontFamily: "inherit", border: `1px solid ${T.border}`, color: T.muted }}>
                              PW 초기화
                            </button>
                            <button onClick={() => remove(u)} title="삭제"
                              style={{ background: "none", borderRadius: 7, cursor: "pointer", fontSize: 10.5, padding: "4px 8px", fontFamily: "inherit", border: `1px solid ${T.border}`, color: T.red }}>
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editing && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ background: T.bg, border: `1px solid ${T.accentDim}`, borderRadius: 12, padding: 16, margin: "6px 2px 12px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <label style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>아이디 (변경 불가)</label>
                                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.muted, fontSize: 14 }}>
                                    {u.login_id}
                                  </div>
                                </div>
                                <Input label="이름" value={ef.name} onChange={v => setEf(s => ({ ...s, name: v }))} placeholder="예: 홍길동" />
                                <Input label="이메일" value={ef.email} onChange={v => setEf(s => ({ ...s, email: v }))} placeholder="예: hong@company.co.kr" />
                                <Select label="역할" value={ef.role} onChange={v => setEf(s => ({ ...s, role: v }))}
                                  options={(ASSIGNABLE_ROLES.includes(u.role) ? ASSIGNABLE_ROLES : [...ASSIGNABLE_ROLES, u.role])
                                    .map(r => ({ value: r, label: ROLE_LABELS[r] || r }))} />
                                <Select label="상태" value={ef.is_active ? "1" : "0"} onChange={v => setEf(s => ({ ...s, is_active: v === "1" }))}
                                  options={[{ value: "1", label: "활성" }, { value: "0", label: "비활성" }]} />
                              </div>
                              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 10, lineHeight: 1.6 }}>
                                {ROLE_LABELS[ef.role]} — {ROLE_DESC[ef.role]}<br />
                                아이디는 감사 로그의 식별자로 사용되므로 변경할 수 없습니다. 활성 관리자는 최소 1명 이상 유지해야 합니다.
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                                <Btn variant="ghost" onClick={() => setEditId(null)} style={{ fontSize: 12, padding: "7px 16px" }}>취소</Btn>
                                <Btn onClick={() => saveEdit(u)} disabled={busy} style={{ fontSize: 12, padding: "7px 18px" }}>
                                  {busy ? "저장 중…" : "저장"}
                                </Btn>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="역할별 권한" desc="권한은 서버(API)에서 최종 판정되므로 화면 조작으로 우회할 수 없습니다.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.keys(ROLE_LABELS).map(r => (
            <div key={r} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 12px", background: T.bg, borderRadius: 9 }}>
              <div style={{ width: 84, flexShrink: 0 }}><Badge color={r === "admin" ? T.amber : T.accent}>{ROLE_LABELS[r]}</Badge></div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{ROLE_DESC[r]}</div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

// ── 2. AI 연동 ────────────────────────────────────────────────────────
// AI 모델 등록 일원화 (A단계)
//  · 위: 사용할 AI 모델을 제공사별로 한 번만 등록 (Claude·Gemini·ChatGPT·사내 LLM) — 키·모델 ID·연결 검증
//  · 아래: 역할 지정 — 생성 AI 1개, 기본 검토 AI 1개 (항상 하나씩 선택됨)
//  · 생성 AI는 현재 Claude 계열만 가능 (생성 경로의 JSON 복구·청크 구조가 Claude 기준). 다른 제공사는 B단계에서 생성 검증 후 연다.
//  · Claude의 키·모델은 app_settings.ai가 단일 기준 — 검토 AI로 Claude를 고르면 같은 키·모델을 쓴다 (/api/review가 그대로 참조).
function AiTab({ flash, settings, onReload }) {
  const ai = settings?.ai || {};
  const [rv, setRv] = useState(null);              // /api/review 설정(마스킹) — 검토 AI 목록·기본값
  const [edit, setEdit] = useState("anthropic");   // 편집 중인 등록 모델(제공사)
  const [model, setModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(null);

  const loadRv = () => apiFetch("/api/review").then(c => { setRv(c); return c; }).catch(e => { setRv({ error: e.message }); return null; });
  useEffect(() => { loadRv(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // 등록 모델 목록 — Claude를 맨 위에. 검토 설정 조회가 실패해도 Claude 행은 생성 설정으로 보여준다.
  const claudeRow = { id: "anthropic", label: "Anthropic Claude", model: ai.model || AI_DEFAULTS.model, hasKey: !!ai.hasKey,
    keySource: ai.keySource || "none", keyMasked: ai.keyMasked || "", ready: !!(ai.hasKey && (ai.model || AI_DEFAULTS.model)), sameAsGenerator: true };
  const others = ((rv && !rv.error && rv.available) || []).filter(a => a.id !== "anthropic" && a.id !== "none");
  const rows = [claudeRow, ...others];
  const cur = rows.find(r => r.id === edit) || claudeRow;

  function pick(id) {
    const r = rows.find(x => x.id === id) || claudeRow;
    setEdit(r.id); setKey(""); setVerify(null);
    setModel(r.model || "");
    setMaxTokens(String(ai.maxTokens || AI_DEFAULTS.maxTokens));
    setBaseUrl(r.id === "custom" ? (rv?.baseUrl || "") : "");
  }
  useEffect(() => { pick(edit); }, [settings, rv]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function save({ clearKey = false } = {}) {
    setBusy(true); setVerify(null);
    try {
      if (edit === "anthropic") {
        await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "ai",
          value: { apiKey: clearKey ? null : (key.trim() || undefined), model: model.trim(), maxTokens: Number(maxTokens) } }) });
        setKey("");
        await onReload();
        await loadRv();
        flash("ok", clearKey ? "저장된 Claude 키를 삭제했습니다. 이후 환경변수(ANTHROPIC_API_KEY)를 사용합니다." : "Anthropic Claude 설정을 저장했습니다 (생성 AI·검토 AI 공용).");
      } else {
        const r = await apiFetch("/api/review", { method: "PUT", body: JSON.stringify({ provider: edit, model: model.trim(), baseUrl: baseUrl.trim(), apiKey: clearKey ? null : (key.trim() || undefined) }) });
        setKey("");
        await loadRv();
        const re = r?.reassigned ? ` 기본 검토 AI가 사용 불가가 되어 ${(r.available || []).find(a => a.id === r.reassigned)?.label || r.reassigned}(으)로 자동 지정했습니다.` : "";
        flash("ok", (clearKey ? "저장된 키를 삭제했습니다." : "AI 모델 설정을 저장했습니다.") + re);
      }
    } catch (e) { flash("error", e.message); }
    setBusy(false);
  }

  async function doVerify() {
    setBusy(true); setVerify(null);
    try {
      if (edit === "anthropic") setVerify(await apiFetch("/api/settings", { method: "POST", body: JSON.stringify({ action: "verify_key", apiKey: key.trim() || undefined, model: model.trim() }) }));
      else setVerify(await apiFetch("/api/review", { method: "POST", body: JSON.stringify({ action: "verify", provider: edit, model: model.trim(), baseUrl: baseUrl.trim(), apiKey: key.trim() || undefined }) }));
    } catch (e) { setVerify({ ok: false, message: e.message }); }
    setBusy(false);
  }

  async function setReviewDefault(id) {
    setBusy(true);
    try {
      await apiFetch("/api/review", { method: "PUT", body: JSON.stringify({ provider: id, setDefault: true }) });
      await loadRv();
      flash("ok", "기본 검토 AI를 지정했습니다.");
    } catch (e) { flash("error", e.message); }
    setBusy(false);
  }

  const srcLabel = { db: "설정 화면", env: "Vercel 환경변수", none: "미등록", input: "입력값" };
  const sel = { width: "100%", padding: "9px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, fontFamily: "inherit" };
  const help = {
    anthropic: "console.anthropic.com → API Keys에서 발급합니다. 생성 AI와 검토 AI(Claude 선택 시)가 같은 키·모델을 씁니다. 키를 비워두면 환경변수 ANTHROPIC_API_KEY를 사용합니다. 최대 토큰이 너무 크면 Vercel 함수 제한 시간을 넘을 수 있으니 청크 호출 구조에 맞춰 조정하세요.",
    gemini: "Google AI Studio → API 키에서 발급합니다. 결제가 연결된 프로젝트(유료 등급)의 키를 사용해야 입력 데이터가 모델 학습에 쓰이지 않습니다. 환경변수 GEMINI_API_KEY도 사용할 수 있습니다.",
    openai: "platform.openai.com → API keys에서 발급합니다. ChatGPT 구독(Plus·Team 등)과는 별개이며 API 결제(크레딧)가 등록되어 있어야 합니다. 환경변수 OPENAI_API_KEY도 사용할 수 있습니다.",
    custom: "사내 LLM 서버는 이 서비스(클라우드)에서 접근 가능한 OpenAI 호환 주소여야 합니다. 방화벽 안의 서버는 구축형 도입 시 연결됩니다.",
  }[edit];

  // 역할 지정 — 생성 AI(현재 Claude 고정)·기본 검토 AI(항상 1개)
  const genReady = claudeRow.ready;
  const readyReviewers = rows.filter(r => r.ready);
  const revDefault = rv && !rv.error ? rv.defaultProvider : null;
  const revRow = rows.find(r => r.id === revDefault);
  const revReady = !!(revRow && revRow.ready);

  return (
    <div>
      <SettingsSection title="AI 모델 등록"
        desc="사용할 AI 모델을 제공사별로 한 번만 등록합니다. 등록한 모델 중에서 아래 '역할 지정'으로 생성 AI와 검토 AI를 고릅니다. 키는 서버(Supabase)에만 저장되며 화면에는 마스킹된 형태로만 표시됩니다.">
        {rv?.error && <div style={{ color: T.amber, fontSize: 12, marginBottom: 10 }}>검토 AI 설정 조회 실패: {rv.error} — Claude 설정만 표시합니다.</div>}
        <div style={{ background: T.bg, borderRadius: 10, padding: "8px 12px", marginBottom: 16 }}>
          {rows.map(a => (
            <div key={a.id} onClick={() => pick(a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${T.border}`, background: edit === a.id ? T.accent + "12" : "transparent", flexWrap: "wrap" }}>
              <Badge color={a.ready ? T.green : a.hasKey ? T.amber : T.muted}>{a.ready ? "사용 가능" : a.hasKey ? "모델 필요" : "미등록"}</Badge>
              <span style={{ minWidth: 190 }}><b>{a.label}</b></span>
              <span style={{ color: T.muted, flex: 1, minWidth: 140 }}>{a.model || "-"}</span>
              <span style={{ display: "flex", gap: 4 }}>
                {a.id === "anthropic" && <Badge color={T.accent}>생성</Badge>}
                {revDefault === a.id && <Badge color={T.amber}>검토 기본</Badge>}
              </span>
              <span style={{ fontFamily: "monospace", color: T.muted, fontSize: 11 }}>{a.keyMasked || ""} {a.hasKey ? `(${srcLabel[a.keySource] || a.keySource})` : ""}</span>
            </div>))}
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>행을 누르면 아래에서 해당 모델을 편집합니다.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>편집할 모델(제공사)</div>
            <select value={edit} onChange={e => pick(e.target.value)} style={sel}>
              {rows.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <Input label="모델 ID" value={model} onChange={setModel} placeholder={edit === "anthropic" ? "claude-haiku-4-5-20251001" : edit === "gemini" ? "예: gemini-2.5-flash" : edit === "openai" ? "연결 검증 후 목록에서 선택" : "모델 ID"} />
          {edit === "anthropic" && <Input label="최대 토큰 (max_tokens · 생성)" value={maxTokens} onChange={setMaxTokens} placeholder="8000" />}
          {edit === "custom" && <Input label="서버 주소 (OpenAI 호환 Base URL)" value={baseUrl} onChange={setBaseUrl} placeholder="https://llm.example.co.kr/v1" />}
          <Input label={cur.hasKey ? "새 API 키 (비워두면 기존 키 유지)" : "API 키"} type="password" value={key} onChange={setKey} placeholder={edit === "anthropic" ? "sk-ant-..." : edit === "openai" ? "sk-..." : edit === "gemini" ? "AIza..." : ""} />
        </div>
        {edit === "anthropic" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {AI_MODEL_PRESETS.map(p => (
              <button key={p.id} onClick={() => setModel(p.id)} title={p.note}
                style={{ background: model === p.id ? T.accentGlow : "transparent", border: `1px solid ${model === p.id ? T.accentDim : T.border}`,
                  borderRadius: 9, padding: "7px 12px", color: model === p.id ? T.accent : T.muted, cursor: "pointer", fontSize: 11, fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: 9.5, opacity: 0.8, marginTop: 2 }}>{p.note}</div>
              </button>
            ))}
          </div>
        )}
        {help && <div style={{ fontSize: 10.5, color: edit === "custom" ? T.amber : T.muted, marginTop: 8, lineHeight: 1.6 }}>{help} 모델 ID는 시간이 지나면 폐기(retire)될 수 있으므로 변경 후 반드시 <b>연결 검증</b>으로 확인하세요.</div>}
        {verify && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: (verify.ok ? T.green : T.red) + "18", border: `1px solid ${(verify.ok ? T.green : T.red)}55`, color: verify.ok ? T.green : T.red, fontSize: 12, lineHeight: 1.6 }}>
            {verify.ok ? "✓ " : "✕ "}{verify.message}
            {(verify.models || []).length > 0 && <div style={{ marginTop: 8, color: T.muted, fontSize: 11 }}>사용 가능한 모델 (눌러서 선택 후 저장):
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{verify.models.map(m => <button key={m} onClick={() => setModel(m)} style={{ background: m === model ? T.accent : "none", color: m === model ? "#fff" : T.accent, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 10.5, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>{m}</button>)}</div>
            </div>}
          </div>)}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Btn onClick={() => save()} disabled={busy} style={{ fontSize: 12, padding: "7px 18px" }}>{busy ? "처리 중…" : "저장"}</Btn>
          <Btn variant="outline" onClick={doVerify} disabled={busy} style={{ fontSize: 12, padding: "7px 16px" }}>{edit === "anthropic" ? "연결 검증" : "연결 검증·모델 목록"}</Btn>
          {cur.keySource === "db" && (
            <Btn variant="ghost" onClick={() => { if (confirm(edit === "anthropic" ? "저장된 Claude 키를 삭제합니다. 이후에는 환경변수 ANTHROPIC_API_KEY가 사용됩니다. 계속할까요?" : `${cur.label}의 저장된 키를 삭제합니다. 기본 검토 AI였다면 사용 가능한 다른 검토 AI로 자동 지정됩니다. 계속할까요?`)) save({ clearKey: true }); }}
              disabled={busy} style={{ fontSize: 12, padding: "7px 16px", color: T.red, borderColor: T.red + "55" }}>저장된 키 삭제</Btn>)}
        </div>
      </SettingsSection>

      <SettingsSection title="역할 지정"
        desc="등록한 모델 중에서 생성 AI와 검토 AI를 하나씩 지정합니다. 둘 다 항상 하나씩 선택되어 있으며, 검토 화면에서는 실행할 때마다 다른 검토 AI를 고를 수도 있습니다.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>생성 AI — 요구사항·PBS·V-모델 산출물 초안 생성</div>
            <select value="anthropic" onChange={() => {}} style={sel}>
              {rows.map(r => <option key={r.id} value={r.id} disabled={r.id !== "anthropic"}>{r.label}{r.id === "anthropic" ? ` · ${claudeRow.model}` : " — 생성 지원 예정"}</option>)}
            </select>
            <div style={{ fontSize: 10.5, color: genReady ? T.muted : T.red, marginTop: 6, lineHeight: 1.6 }}>
              {genReady
                ? <>현재 Claude 계열만 생성 AI로 쓸 수 있습니다. 생성 단계의 청크 분할·JSON 복구가 Claude 기준으로 맞춰져 있기 때문이며, 다른 제공사는 생성 검증을 거쳐 순차적으로 엽니다. 모델 변경은 위 <b>Anthropic Claude</b> 행에서 합니다 (최대 {ai.maxTokens || AI_DEFAULTS.maxTokens} 토큰).</>
                : "Claude API 키가 없어 생성 기능을 쓸 수 없습니다. 위 Anthropic Claude 행에서 키를 등록하거나 환경변수 ANTHROPIC_API_KEY를 설정하세요."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>검토 AI (기본) — V-모델 3단 교차검토의 AI 의견</div>
            {readyReviewers.length > 0 ? (
              <select value={revReady ? revDefault : ""} onChange={e => e.target.value && setReviewDefault(e.target.value)} disabled={busy || !rv || rv.error} style={sel}>
                {!revReady && <option value="">— 선택하세요 —</option>}
                {readyReviewers.map(r => <option key={r.id} value={r.id}>{r.label} · {r.model}{r.sameAsGenerator ? " (생성 AI와 같은 모델)" : ""}</option>)}
              </select>
            ) : <div style={{ ...sel, color: T.red, fontSize: 12 }}>사용 가능한 모델 없음 — 위에서 키·모델을 등록하세요</div>}
            <div style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
              {rv?.defaultFallback && revReady && <div style={{ color: T.amber }}>지정했던 기본 검토 AI({rows.find(r => r.id === rv.configuredDefault)?.label || rv.configuredDefault})를 쓸 수 없어 {revRow.label}이(가) 자동으로 기본이 되었습니다.</div>}
              {revReady && revRow.sameAsGenerator && <div style={{ color: T.amber }}>⚠ 생성 AI와 같은 Claude 모델({claudeRow.model})입니다. 교차검토의 독립성이 없으므로 Gemini·ChatGPT 등 다른 제공사를 권장합니다.</div>}
              {revReady && !revRow.sameAsGenerator && <div style={{ color: T.green }}>✓ 생성 AI(Claude)와 다른 제공사 — 독립 검토</div>}
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

// ── 3. 조직·문서 기본값 ───────────────────────────────────────────────
function OrgTab({ flash, settings, onReload }) {
  const [org, setOrg] = useState(settings?.organization || {});
  const [doc, setDoc] = useState(settings?.doc_defaults || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setOrg(settings.organization || {});
    setDoc(settings.doc_defaults || {});
  }, [settings]);

  // 로고 업로드 — dataURL + 원본 크기 저장 (docx/xlsx 임베드 시 비율 유지에 사용)
  const readLogo = k => e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 300 * 1024) { flash("error", "기본 로고는 300KB 이하로 올려주세요."); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const dataUrl = rd.result;
      const img = new Image();
      img.onload = () => setOrg(p => ({ ...p, [k]: { dataUrl, w: img.naturalWidth || 300, h: img.naturalHeight || 100 } }));
      img.onerror = () => flash("error", "이미지를 읽을 수 없습니다. PNG 또는 JPG를 사용하세요.");
      img.src = dataUrl;
    };
    rd.readAsDataURL(file);
  };

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "organization", value: org }) });
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "doc_defaults", value: doc }) });
      await onReload();   // 내부에서 applyDocSettings 호출 → 이후 생성하는 문서에 즉시 반영
      flash("ok", "조직·문서 기본값을 저장했습니다. 지금부터 생성하는 모든 산출물(표지·문서정보표·서명란·꼬리말)에 반영됩니다.");
    } catch (e) { flash("error", e.message); }
    setBusy(false);
  }

  return (
    <div>
      <SettingsSection
        title="우리 조직 정보 (수행사)"
        desc="사업을 수행하는 우리 회사의 정보입니다. 산출물 문서의 표지와 문서정보표 「작성조직」 항목에 사용되며, 모든 프로젝트에 공통으로 적용됩니다."
      >
        {/* 고객사(발주처)와의 혼동이 잦은 지점 — 무엇을 넣어야 하는지 고정 안내 */}
        <div style={{ display: "flex", gap: 10, padding: "11px 14px", background: T.amber + "12",
          border: `1px solid ${T.amber}44`, borderRadius: 10, marginBottom: 16 }}>
          <span style={{ color: T.amber, fontSize: 13, lineHeight: 1.4, flexShrink: 0 }}>⚠</span>
          <div style={{ fontSize: 11, color: T.text, lineHeight: 1.75 }}>
            <b>고객사(발주처)를 입력하는 칸이 아닙니다.</b> 문서를 작성·제출하는 <b>우리 회사</b>의 상호를 넣으세요.<br />
            고객사는 프로젝트마다 다르므로 새 프로젝트 <b>1단계 「고객사」</b> 칸에서 입력합니다.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <Input label="수행사명 (국문)" value={org.orgName || ""} onChange={v => setOrg(p => ({ ...p, orgName: v }))} placeholder="우리 회사 상호 (예: (주)○○정보기술)" />
          <Input label="수행사명 (영문)" value={org.orgNameEn || ""} onChange={v => setOrg(p => ({ ...p, orgNameEn: v }))} placeholder="우리 회사 영문 상호" />
          <Input label="담당 부서" value={org.dept || ""} onChange={v => setOrg(p => ({ ...p, dept: v }))} placeholder="예: 품질보증팀 (QA)" />
        </div>
        {/* 입력 즉시 문서에 어떻게 찍히는지 미리보기 — 잘못 넣었을 때 바로 알아채도록 */}
        {(org.orgName || org.dept) && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: T.bg, borderRadius: 9, fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
            문서 표기 미리보기 — 작성조직:{" "}
            <span style={{ color: T.text, fontWeight: 600 }}>
              {[org.orgName, org.dept].filter(Boolean).join(" · ")}
            </span>
            {org.orgNameEn && <span style={{ marginLeft: 8, fontStyle: "italic" }}>({org.orgNameEn})</span>}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="기본 문서 로고"
        desc="새 프로젝트를 시작할 때 자동으로 채워지는 로고입니다. 고객사 로고는 프로젝트마다 바뀌므로 자주 거래하는 곳이 아니면 비워두고, 위저드 1단계에서 개별 지정하는 편이 좋습니다. (PNG/JPG · 300KB 이하)"
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[["clientLogo", "고객사(발주처) 기본 로고"], ["companyLogo", "우리회사(수행사) 로고"]].map(([k, label]) => (
            <FileDrop key={k} bare accept="image/png,image/jpeg" onFiles={fs => readLogo(k)(asFileEvent(fs))} dropLabel={`여기에 놓으면 ${label}로 지정합니다 (PNG · JPG)`}
              style={{ flex: 1, minWidth: 230, border: `1px dashed ${T.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>{label} <span style={{ fontSize: 10 }}>· 끌어다 놓기 가능</span></div>
              {org[k]?.dataUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={org[k].dataUrl} alt={label} style={{ height: 34, maxWidth: 170, objectFit: "contain", background: "#fff", borderRadius: 6, padding: "2px 6px" }} />
                  <button onClick={() => setOrg(p => ({ ...p, [k]: null }))}
                    style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.red, cursor: "pointer", fontSize: 11, padding: "4px 10px", fontFamily: "inherit" }}>제거</button>
                </div>
              ) : (
                <label style={{ display: "inline-block", cursor: "pointer", fontSize: 12, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "6px 12px" }}>
                  이미지 선택
                  <input type="file" accept="image/png,image/jpeg" onChange={readLogo(k)} style={{ display: "none" }} />
                </label>
              )}
            </FileDrop>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="문서 기본값"
        desc="산출물 생성 시 문서정보표·승인란에 기본으로 채워지는 값입니다. 문서번호 접두어와 담당자는 사업마다 다른 경우가 많으므로, 새 프로젝트 1단계 「이번 프로젝트 문서 설정」에서 프로젝트별로 지정할 수 있습니다. 여기 값은 지정하지 않았을 때 사용됩니다."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <Input label="문서번호 접두어 (기본값)" value={doc.codePrefix || ""} onChange={v => setDoc(p => ({ ...p, codePrefix: v }))} placeholder="예: ITG-QA" />
          <Input label="기본 작성자" value={doc.author || ""} onChange={v => setDoc(p => ({ ...p, author: v }))} placeholder="예: 품질보증담당자" />
          <Input label="기본 검토자" value={doc.reviewer || ""} onChange={v => setDoc(p => ({ ...p, reviewer: v }))} placeholder="예: PM" />
          <Input label="기본 승인자" value={doc.approver || ""} onChange={v => setDoc(p => ({ ...p, approver: v }))} placeholder="예: 사업총괄" />
          <Select label="배포 구분" value={doc.distribution || "사내 한정"} onChange={v => setDoc(p => ({ ...p, distribution: v }))}
            options={["사내 한정", "고객사 공유", "대외비", "공개"].map(v => ({ value: v, label: v }))} />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>문서 꼬리말</div>
          <textarea value={org.docFooter || ""} onChange={e => setOrg(p => ({ ...p, docFooter: e.target.value }))}
            placeholder="예: 본 문서는 (주)아이티센글로벌의 자산이며 무단 복제·배포를 금합니다."
            style={{ width: "100%", minHeight: 64, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn onClick={save} disabled={busy} style={{ fontSize: 12, padding: "7px 18px" }}>{busy ? "저장 중…" : "저장"}</Btn>
        </div>
      </SettingsSection>
    </div>
  );
}

// ── 4. QA 기본 정책 ───────────────────────────────────────────────────
function QaTab({ flash, settings, onReload, onApplyDefaults }) {
  const D = settings?.qa_defaults || {};
  const [q, setQ] = useState(D);
  const [holidayText, setHolidayText] = useState((D.holidays || []).join("\n"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const d = settings.qa_defaults || {};
    setQ(d);
    setHolidayText((d.holidays || []).join("\n"));
  }, [settings]);

  const setFactor = (id, v) => setQ(p => ({ ...p, sdlcFactors: { ...(p.sdlcFactors || {}), [id]: v } }));

  async function save() {
    // 공휴일: YYYY-MM-DD 형식만 채택하고 중복 제거·정렬
    const holidays = Array.from(new Set(
      holidayText.split(/[\n,\s]+/).map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s))
    )).sort();
    const bad = holidayText.split(/[\n,\s]+/).map(s => s.trim()).filter(s => s && !/^\d{4}-\d{2}-\d{2}$/.test(s));
    setBusy(true);
    try {
      const value = { ...q, holidays };
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ key: "qa_defaults", value }) });
      setHolidayText(holidays.join("\n"));
      await onReload();   // 저장만 — 진행 중인 위저드 입력은 건드리지 않는다 (조직·문서 탭과 동일)
      flash(bad.length ? "warn" : "ok",
        `QA 기본 정책을 저장했습니다. 공휴일 ${holidays.length}일 등록. 새로 시작하는 프로젝트부터 적용됩니다.` +
        (bad.length ? `\n형식이 올바르지 않아 제외된 항목 ${bad.length}건: ${bad.slice(0, 5).join(", ")}` : ""));
    } catch (e) { flash("error", e.message); }
    setBusy(false);
  }

  // 저장된 기본값을 진행 중인 위저드에 명시적으로 덮어쓴다 (되돌릴 수 없으므로 확인을 받는다)
  function applyNow() {
    if (!settings?.qa_defaults) { flash("error", "먼저 기본 정책을 저장하세요."); return; }
    if (!confirm("저장된 QA 기본 정책을 진행 중인 프로젝트에 적용합니다.\n" +
      "위저드에서 이미 조정한 규모·설계방식·프로세스 등급·SDLC 요인이 덮어쓰기 됩니다. 계속할까요?")) return;
    onApplyDefaults(settings);
    flash("ok", "진행 중인 프로젝트에 기본 정책을 적용했습니다. 테일러링 단계에서 결과를 확인하세요.");
  }

  return (
    <div>
      <SettingsSection
        title="테일러링 기본값"
        desc="새 프로젝트를 시작할 때 자동 선택되는 값입니다. PMBOK® 8판 테일러링 원칙에 따라 프로젝트별로 언제든 위저드에서 변경할 수 있으며, 여기서 정하는 값은 조직의 통상적 기준선(baseline)에 해당합니다."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <Select label="기본 프로젝트 규모" value={q.scale || "중형"} onChange={v => setQ(p => ({ ...p, scale: v }))}
            options={["(초)대형", "중형", "소형"].map(v => ({ value: v, label: v }))} />
          <Select label="기본 설계 방식" value={q.method || "UML"} onChange={v => setQ(p => ({ ...p, method: v }))}
            options={[{ value: "UML", label: "UML (객체지향)" }, { value: "IE", label: "IE (정보공학)" }]} />
          <Select label="프로세스 적용 등급" value={q.processLevel || "L3"} onChange={v => setQ(p => ({ ...p, processLevel: v }))}
            options={[
              { value: "L3", label: "L3 — 정의된 프로세스 (CMMI L3)" },
              { value: "L4", label: "L4 — 정량적 관리" },
              { value: "L5", label: "L5 — 최적화" },
            ]} />
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 12, lineHeight: 1.6 }}>
          전사 기준: 10MM 이상 SI-AD·OS-AD 프로젝트는 최소 L3 적용. 사업본부 별도 기준이 있으면 그에 따릅니다.
        </div>
      </SettingsSection>

      <SettingsSection
        title="개발접근법 선정 요인 기본값"
        desc="SDLC 추천(규칙 기반) 화면에 미리 채워지는 초기값입니다. 조직에서 주로 수행하는 사업 유형의 통상적 특성을 설정해 두면 착수 단계 입력 시간이 줄어듭니다."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {SDLC_FACTORS.map(fa => (
            <Select key={fa.id} label={fa.label} value={(q.sdlcFactors || {})[fa.id] || fa.options[1]}
              onChange={v => setFactor(fa.id, v)} options={fa.options.map(o => ({ value: o, label: o }))} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="기본 공휴일 (근무일 캘린더)"
        desc="WBS 일정 산정 시 근무일에서 제외할 날짜입니다. 주말은 자동 제외되므로 법정공휴일·회사 지정 휴일만 입력하세요. YYYY-MM-DD 형식으로 한 줄에 하나씩 입력합니다."
      >
        <textarea value={holidayText} onChange={e => setHolidayText(e.target.value)}
          placeholder={"2026-01-01\n2026-03-01\n2026-05-05"}
          style={{ width: "100%", minHeight: 130, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: "monospace", outline: "none", resize: "vertical", lineHeight: 1.7 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.6, flex: 1, minWidth: 240 }}>
            <b>저장</b>은 새로 시작하는 프로젝트에만 적용됩니다.
            진행 중인 프로젝트에도 반영하려면 <b>현재 프로젝트에 적용</b>을 누르세요.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="outline" onClick={applyNow} disabled={busy} style={{ fontSize: 12, padding: "7px 16px" }}>현재 프로젝트에 적용</Btn>
            <Btn onClick={save} disabled={busy} style={{ fontSize: 12, padding: "7px 18px" }}>{busy ? "저장 중…" : "저장"}</Btn>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

// ── 5. 내 계정 ────────────────────────────────────────────────────────
function AccountTab({ flash, session, onLogout }) {
  const [cur, setCur] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [busy, setBusy] = useState(false);
  const isEnvAccount = session?.source === "env" || session?.uid === "env";

  async function change() {
    if (np !== np2) { flash("error", "새 비밀번호 확인이 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ action: "change_own_pw", currentPw: cur, newPw: np }) });
      setCur(""); setNp(""); setNp2("");
      flash("ok", "비밀번호를 변경했습니다.");
    } catch (e) { flash("error", e.message); }
    setBusy(false);
  }

  const row = (k, v) => (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ width: 120, fontSize: 11.5, color: T.muted, flexShrink: 0 }}>{k}</div>
      <div style={{ fontSize: 12.5 }}>{v}</div>
    </div>
  );

  return (
    <div>
      <SettingsSection title="계정 정보">
        {row("아이디", session?.login_id || "—")}
        {row("이름", session?.name || "—")}
        {row("역할", <span><Badge color={session?.role === "admin" ? T.amber : T.accent}>{ROLE_LABELS[session?.role] || session?.role}</Badge>
          <span style={{ color: T.muted, marginLeft: 8, fontSize: 11 }}>{ROLE_DESC[session?.role] || ""}</span></span>)}
        {row("계정 출처", isEnvAccount ? "환경변수 부트스트랩 관리자" : "등록 사용자 (app_users)")}
        {row("세션 만료", session?.exp ? new Date(session.exp).toLocaleString("ko-KR") : "—")}
        <div style={{ marginTop: 16 }}>
          <Btn variant="ghost" onClick={onLogout} style={{ fontSize: 12, padding: "7px 16px" }}>⏻ 로그아웃</Btn>
        </div>
      </SettingsSection>

      <SettingsSection
        title="비밀번호 변경"
        desc={isEnvAccount
          ? "환경변수 기반 부트스트랩 계정은 화면에서 비밀번호를 변경할 수 없습니다. Vercel 환경변수 APP_LOGIN_PW를 수정하거나, 사용자 관리에서 정식 관리자 계정을 등록해 사용하세요."
          : "8자 이상, 영문과 숫자를 각각 1자 이상 포함해야 합니다."}
      >
        {!isEnvAccount && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <Input label="현재 비밀번호" type="password" value={cur} onChange={setCur} placeholder="현재 비밀번호" />
              <Input label="새 비밀번호" type="password" value={np} onChange={setNp} placeholder="8자 이상, 영문+숫자" />
              <Input label="새 비밀번호 확인" type="password" value={np2} onChange={setNp2} placeholder="다시 입력" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Btn onClick={change} disabled={busy || !cur || !np} style={{ fontSize: 12, padding: "7px 18px" }}>{busy ? "변경 중…" : "비밀번호 변경"}</Btn>
            </div>
          </>
        )}
      </SettingsSection>
    </div>
  );
}

// ── 6. 시스템 진단 · 감사 로그 ────────────────────────────────────────
function SystemTab({ flash }) {
  const [diag, setDiag] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  async function runDiag() {
    setBusy(true);
    try { setDiag(await apiFetch("/api/settings?action=diag")); }
    catch (e) { flash("error", e.message); }
    setBusy(false);
  }
  async function loadLogs() {
    try { setLogs(await apiFetch("/api/settings?action=audit&limit=100")); }
    catch (e) { flash("error", e.message); }
  }
  useEffect(() => { runDiag(); loadLogs(); }, []);

  const dot = (ok, warnOnly = false) => (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? T.green : (warnOnly ? T.amber : T.red), marginRight: 8, flexShrink: 0 }} />
  );

  const ENV_HELP = {
    SUPABASE_URL: "필수 — 데이터베이스 연결",
    SUPABASE_ANON_KEY: "필수 — 읽기 전용 키",
    SUPABASE_SERVICE_KEY: "권장 — 설정·사용자 테이블 쓰기 및 세션 서명",
    ANTHROPIC_API_KEY: "선택 — 설정 화면에서 키를 등록하면 불필요",
    APP_LOGIN_ID: "권장 — 부트스트랩 관리자 로그인",
    APP_SESSION_SECRET: "선택 — 미설정 시 SUPABASE_SERVICE_KEY로 대체",
  };
  const OPTIONAL_ENV = ["ANTHROPIC_API_KEY", "APP_SESSION_SECRET"];

  const th = { textAlign: "left", padding: "9px 10px", fontSize: 10.5, color: T.muted, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  const td = { padding: "9px 10px", fontSize: 11.5, borderBottom: `1px solid ${T.border}`, verticalAlign: "top" };

  return (
    <div>
      <SettingsSection
        title="연결 상태 진단"
        desc="환경변수와 데이터베이스 테이블 준비 상태를 점검합니다. 배포 직후나 오류 발생 시 원인 파악에 사용하세요."
        right={<Btn variant="outline" onClick={runDiag} disabled={busy} style={{ fontSize: 12, padding: "6px 14px" }}>{busy ? "점검 중…" : "다시 점검"}</Btn>}
      >
        {!diag ? <Spinner text="점검 중…" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 10, letterSpacing: 0.6 }}>환경변수</div>
              {Object.entries(diag.env).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", padding: "6px 0", fontSize: 11.5 }}>
                  {dot(v, OPTIONAL_ENV.includes(k))}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: "monospace", color: v ? T.text : T.muted }}>{k}</span>
                    <span style={{ color: T.muted, fontSize: 10, marginLeft: 8 }}>{v ? "설정됨" : "없음"} · {ENV_HELP[k]}</span>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 10, letterSpacing: 0.6 }}>데이터베이스 테이블</div>
              {Object.entries(diag.tables).map(([k, v]) => {
                // 구버전 응답은 문자열("ok"), 신버전은 { status, message } — 양쪽 모두 처리
                const st = typeof v === "string" ? v : v?.status;
                const detail = typeof v === "string" ? "" : (v?.message || "");
                return (
                  <div key={k} style={{ display: "flex", alignItems: "flex-start", padding: "6px 0", fontSize: 11.5 }}>
                    <span style={{ marginTop: 4 }}>{dot(st === "ok")}</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: "monospace", color: st === "ok" ? T.text : T.muted }}>{k}</span>
                      <span style={{ color: T.muted, fontSize: 10, marginLeft: 8 }}>
                        {st === "ok" ? "정상" : st === "missing" ? "미생성 — 설치 SQL 실행 필요" : "조회 오류"}
                      </span>
                      {st !== "ok" && detail && (
                        <div style={{ color: T.red, fontSize: 9.5, marginTop: 2, lineHeight: 1.5, wordBreak: "break-word" }}>{detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11.5, color: T.muted, lineHeight: 1.9 }}>
                등록 사용자 <b style={{ color: T.text }}>{diag.userCount}</b>명 (활성 관리자 <b style={{ color: diag.adminCount ? T.text : T.amber }}>{diag.adminCount}</b>명)<br />
                AI 키 출처 <b style={{ color: T.text }}>{{ db: "설정 저장값", env: "환경변수", none: "미설정" }[diag.aiKeySource]}</b><br />
                런타임 <b style={{ color: T.text }}>Node {diag.node}</b> · 점검 {new Date(diag.checkedAt).toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="감사 로그"
        desc="설정 변경 및 사용자 계정 조작 이력입니다. 최근 100건까지 표시하며 CMMI 형상·변경 관리 증적으로 활용할 수 있습니다."
        right={<Btn variant="ghost" onClick={loadLogs} style={{ fontSize: 12, padding: "6px 14px" }}>새로고침</Btn>}
      >
        {logs.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: T.muted }}>기록된 변경 이력이 없습니다.</div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr><th style={th}>시각</th><th style={th}>수행자</th><th style={th}>동작</th><th style={th}>대상</th><th style={th}>내용</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ ...td, whiteSpace: "nowrap", color: T.muted }}>{new Date(l.created_at).toLocaleString("ko-KR")}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.actor || "—"}</td>
                    <td style={td}><span style={{ fontFamily: "monospace", fontSize: 10.5, color: T.accent }}>{l.action}</span></td>
                    <td style={td}>{l.target || "—"}</td>
                    <td style={{ ...td, color: T.muted }}>{l.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
