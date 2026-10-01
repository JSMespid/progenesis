// ═══════════════════════════════════════════════════════════════════════════
// ASPICE V-모델 엔지니어링 엔진 — Automotive SPICE 3.1 / 4.0 겸용
// ───────────────────────────────────────────────────────────────────────────
// 설계 원칙
//  1) 문서가 아니라 "추적 모델"을 생성한다. SyRS·SyAD·SRS·SWAD·HW 문서·검증명세·RTM은
//     모두 이 모델의 뷰(렌더링)이며, 그래야 ASPICE의 일관성·양방향 추적성 BP가 구조적으로 보장된다.
//  2) AI 최소화: ID 채번·품질 점검·검증방법 결정·경계값 TC 도출·DBC 파싱·일관성/충족도 점검은
//     전부 결정적(규칙 기반)으로 처리한다. AI는 요소 분해·하위 요구 파생·TC 서술 초안에만 쓴다.
//  3) 근거 없는 내용을 만들지 않는다. 입력자료가 없는 WP 특성은 '누락(TBD)'으로 남긴다.
//  4) 3.1과 4.0의 WP 체계를 동시에 표기한다(3.1: 17-12/04-06/08-50…, 4.0: 17-00/04-06/08-60…).
//     HWE는 4.0 정식 프로세스이며 3.1 단독 모드에서는 "PAM 확장(4.0 HWE 준용)"으로 표기한다.
// 이 파일은 React에 의존하지 않는다 (Node에서 단독 테스트 가능).
// ═══════════════════════════════════════════════════════════════════════════

export const ASPICE_VERSIONS = [
  { id: "both", label: "3.1 + 4.0 겸용", desc: "두 버전의 WP 체계를 함께 표기 (고객사 심사 버전 미확정·혼재 시 권장)" },
  { id: "4.0", label: "ASPICE 4.0", desc: "17-00/17-54 · 08-60/08-58 · 13-51 · HWE.1~4 정식" },
  { id: "3.1", label: "ASPICE 3.1", desc: "17-12/17-11 · 08-50/08-52 · 13-22 · HWE는 PAM 확장으로 표기" },
];
export const versionsOf = v => (v === "3.1" ? ["3.1"] : v === "4.0" ? ["4.0"] : ["3.1", "4.0"]);

// ── 레벨·프로세스 정의 ────────────────────────────────────────────────────
// 각 레벨은 (요구사항 프로세스, 설계 프로세스, 통합검증, 요구사항검증)의 V 짝으로 구성된다.
export const LEVELS = {
  SYS: { label: "시스템", reqProc: "SYS.2", archProc: "SYS.3", integProc: "SYS.4", qualProc: "SYS.5",
         reqPrefix: "", compPrefix: "SYE-", compLabel: "시스템 요소" },
  SW:  { label: "SW", reqProc: "SWE.1", archProc: "SWE.2", integProc: "SWE.5", qualProc: "SWE.6",
         reqPrefix: "SWR-", compPrefix: "SWC-", compLabel: "SW 컴포넌트" },
  HW:  { label: "HW", reqProc: "HWE.1", archProc: "HWE.2", integProc: "HWE.3", qualProc: "HWE.4",
         reqPrefix: "HWR-", compPrefix: "HWC-", compLabel: "HW 컴포넌트" },
};

// 프로세스명 (버전별)
export const PROC_NAMES = {
  "SYS.2": { "3.1": "System Requirements Analysis", "4.0": "System Requirements Analysis" },
  "SYS.3": { "3.1": "System Architectural Design", "4.0": "System Architectural Design" },
  "SYS.4": { "3.1": "System Integration and Integration Test", "4.0": "System Integration and Integration Verification" },
  "SYS.5": { "3.1": "System Qualification Test", "4.0": "System Verification" },
  "SWE.1": { "3.1": "Software Requirements Analysis", "4.0": "Software Requirements Analysis" },
  "SWE.2": { "3.1": "Software Architectural Design", "4.0": "Software Architectural Design" },
  "SWE.5": { "3.1": "Software Integration and Integration Test", "4.0": "Software Component Verification and Integration Verification" },
  "SWE.6": { "3.1": "Software Qualification Test", "4.0": "Software Verification" },
  "HWE.1": { "3.1": "Hardware Requirements Analysis (PAM 확장)", "4.0": "Hardware Requirements Analysis" },
  "HWE.2": { "3.1": "Hardware Design (PAM 확장)", "4.0": "Hardware Design" },
  "HWE.3": { "3.1": "Verification against Hardware Design (PAM 확장)", "4.0": "Verification against Hardware Design" },
  "HWE.4": { "3.1": "Verification against Hardware Requirements (PAM 확장)", "4.0": "Verification against Hardware Requirements" },
};
export function procLabel(proc, version) {
  const n = PROC_NAMES[proc] || {};
  const vs = versionsOf(version);
  if (vs.length === 1) return `${proc} ${n[vs[0]] || ""}`.trim();
  return n["3.1"] === n["4.0"] ? `${proc} ${n["4.0"]}` : `${proc} ${n["4.0"]} (3.1: ${n["3.1"]})`;
}

// ── 검증 레벨 (V 우측) ────────────────────────────────────────────────────
// targetKind: req = 같은 레벨 요구사항 검증 / if = 요소 간 인터페이스·통합 검증
export const TEST_LEVELS = {
  SYS5: { proc: "SYS.5", level: "SYS", targetKind: "req", label: "시스템 검증(적격성)", prefix: "SQT-" },
  SYS4: { proc: "SYS.4", level: "SYS", targetKind: "if",  label: "시스템 통합 검증", prefix: "SIT-" },
  SWE6: { proc: "SWE.6", level: "SW",  targetKind: "req", label: "SW 검증(적격성)", prefix: "SWQT-" },
  SWE5: { proc: "SWE.5", level: "SW",  targetKind: "if",  label: "SW 통합·컴포넌트 검증", prefix: "SWIT-" },
  HWE4: { proc: "HWE.4", level: "HW",  targetKind: "req", label: "HW 요구사항 검증", prefix: "HWQT-" },
  HWE3: { proc: "HWE.3", level: "HW",  targetKind: "if",  label: "HW 설계 검증", prefix: "HWDT-" },
};

// ── 문서(산출물) 종류 ─────────────────────────────────────────────────────
// wp: 버전별 정보항목(Work Product / Information Item) ID
export const ASPICE_DOCS = {
  SYS_RS: { title: "시스템 요구사항 명세서", proc: "SYS.2", wp: { "3.1": "17-12, 17-08, 17-50", "4.0": "17-00, 17-54, 15-51" }, code: "SY2102" },
  SYS_AD: { title: "시스템 아키텍처 설계서", proc: "SYS.3", wp: { "3.1": "04-06, 17-08", "4.0": "04-06, 15-51, 17-57" }, code: "SY2103" },
  SW_RS:  { title: "SW 요구사항 명세서", proc: "SWE.1", wp: { "3.1": "17-11, 17-08, 17-50", "4.0": "17-00, 17-54, 15-51" }, code: "SW3101" },
  SW_AD:  { title: "SW 아키텍처 설계서", proc: "SWE.2", wp: { "3.1": "04-04, 17-08", "4.0": "04-04, 15-51" }, code: "SW3102" },
  HW_RS:  { title: "HW 요구사항 명세서", proc: "HWE.1", wp: { "3.1": "PAM 확장(4.0 HWE.1 준용)", "4.0": "17-00, 17-54, 15-51" }, code: "HW3101" },
  HW_AD:  { title: "HW 아키텍처 설계서", proc: "HWE.2", wp: { "3.1": "PAM 확장(4.0 HWE.2 준용)", "4.0": "04-52, 04-53, 15-51" }, code: "HW3102" },
  V_SYS5: { title: "시스템 검증 명세서", proc: "SYS.5", test: "SYS5", wp: { "3.1": "08-50, 08-52", "4.0": "08-60, 08-58" }, code: "SY2106" },
  V_SYS4: { title: "시스템 통합 검증 명세서", proc: "SYS.4", test: "SYS4", wp: { "3.1": "08-50, 08-52", "4.0": "08-60, 08-58, 06-50" }, code: "SY2107" },
  V_SWE6: { title: "SW 검증 명세서", proc: "SWE.6", test: "SWE6", wp: { "3.1": "08-50, 08-52", "4.0": "08-60, 08-58" }, code: "SW3104" },
  V_SWE5: { title: "SW 통합 검증 명세서", proc: "SWE.5", test: "SWE5", wp: { "3.1": "08-50, 08-52", "4.0": "08-60, 08-58, 06-50" }, code: "SW3103" },
  V_HWE4: { title: "HW 요구사항 검증 명세서", proc: "HWE.4", test: "HWE4", wp: { "3.1": "PAM 확장", "4.0": "08-60, 08-58" }, code: "HW5102" },
  V_HWE3: { title: "HW 설계 검증 명세서", proc: "HWE.3", test: "HWE3", wp: { "3.1": "PAM 확장", "4.0": "08-60, 08-58" }, code: "HW5101" },
  R_SYS5: { title: "시스템 검증 결과서", proc: "SYS.5", test: "SYS5", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SY6102" },
  R_SYS4: { title: "시스템 통합 검증 결과서", proc: "SYS.4", test: "SYS4", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SY6101" },
  R_SWE6: { title: "SW 검증 결과서", proc: "SWE.6", test: "SWE6", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SW5102" },
  R_SWE5: { title: "SW 통합 검증 결과서", proc: "SWE.5", test: "SWE5", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SW5101" },
  RTM:    { title: "요구사항 추적 매트릭스", proc: "SYS.2~SWE.6", wp: { "3.1": "13-22", "4.0": "13-51" }, code: "SY2105" },
};
export function wpLabel(docKind, version) {
  const d = ASPICE_DOCS[docKind]; if (!d) return "";
  return versionsOf(version).map(v => `${v}: ${d.wp[v]}`).join(" / ");
}

// 산출물명 → 문서 종류 (OSSP 산출물 목록의 이름과 매칭). 생성 불가 산출물(유닛 검증 등)은 null.
export function aspiceDocKind(name) {
  const n = String(name || "").replace(/\s|\(|\)|·|-/g, "").toUpperCase()
    .replace(/소프트웨어/g, "SW").replace(/하드웨어/g, "HW");
  if (!n) return null;
  if (n.includes("유닛") || n.includes("단위")) return null;            // SWE.4·SWE.3 — 코드 없이 생성하지 않음
  if (n.includes("추적") && (n.includes("매트릭스") || n.includes("MATRIX"))) return "RTM";
  const isResult = n.includes("결과서");
  const isSpec = n.includes("명세서");
  if (n.startsWith("시스템") || n.startsWith("SYSTEM")) {
    if (n.includes("아키텍처") || n.includes("구조설계")) return "SYS_AD";
    if (n.includes("통합검증") || n.includes("통합시험")) return isResult ? "R_SYS4" : isSpec ? "V_SYS4" : null;
    if (n.includes("검증") || n.includes("적격성") || n.includes("시험")) return isResult ? "R_SYS5" : isSpec ? "V_SYS5" : null;
    if (n.includes("요구사항명세")) return "SYS_RS";
    return null;
  }
  if (n.startsWith("SW")) {
    if (n.includes("아키텍처")) return "SW_AD";
    if (n.includes("요구사항명세")) return "SW_RS";
    if (n.includes("통합검증") || n.includes("통합시험")) return isResult ? "R_SWE5" : isSpec ? "V_SWE5" : null;
    if (n.includes("검증") || n.includes("적격성")) return isResult ? "R_SWE6" : isSpec ? "V_SWE6" : null;
    return null;
  }
  if (n.startsWith("HW")) {
    if (n.includes("요구사항검증")) return isSpec ? "V_HWE4" : null;
    if (n.includes("설계검증")) return isSpec ? "V_HWE3" : null;
    if (n.includes("요구사항명세")) return "HW_RS";
    if (n.includes("아키텍처") || n.includes("설계서")) return "HW_AD";
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1) WP 특성 카탈로그 — 3.1 Annex B / 4.0 Annex B 원문 기준
//    src: 버전별 출처(WP ID 또는 BP). 해당 버전에 없는 특성은 그 키가 없다.
//    origin: ASPICE | ISO 26262 | ISO/SAE 21434 — ASPICE 외 특성은 "선택"으로만 표시(테일러링 판단 대상)
//    kw: 템플릿·모델 텍스트에서 해당 특성의 존재를 판단하는 키워드(한/영) — 결정적 점검
// ═══════════════════════════════════════════════════════════════════════════
const C = (id, label, src, kw, extra = {}) => ({ id, label, src, kw, origin: "ASPICE", ...extra });

export const WP_CATALOG = {
  SYS_RS: [
    C("sys_func", "시스템 기능·능력(capabilities) 요구", { "3.1": "17-12", "4.0": "17-00" }, ["기능 요구", "기능요구", "functional", "기능 목록"]),
    C("sys_biz", "비즈니스·조직·사용자 요구", { "3.1": "17-12" }, ["사용자", "운전자", "운용자", "user requirement", "고객 요구"]),
    C("sys_safety", "안전 요구사항", { "3.1": "17-12", "4.0": "17-00" }, ["안전", "safety", "asil", "fail-safe", "페일세이프"]),
    C("sys_security", "보안 요구사항", { "3.1": "17-12" }, ["보안", "security", "사이버", "인증", "암호"]),
    C("sys_hf", "인간공학(ergonomics) 요구", { "3.1": "17-12" }, ["인간공학", "ergonom", "human factor", "human-factor", "조작성", "hmi"]),
    C("sys_if", "인터페이스 요구 (외부 시스템·커넥터·하네스·하우징)", { "3.1": "17-12, 17-08", "4.0": "17-00" }, ["인터페이스", "interface", "can", "lin", "커넥터", "connector", "하네스", "harness", "housing", "하우징"]),
    C("sys_ops", "운용(operations) 요구·운용 능력", { "3.1": "17-12" }, ["운용", "운영 모드", "운영모드", "operation", "동작 모드"]),
    C("sys_maint", "유지보수 요구", { "3.1": "17-12" }, ["유지보수", "정비", "maintenance", "수리", "repair", "a/s"]),
    C("sys_constraint", "설계 제약(Design Constraint)", { "3.1": "17-12", "4.0": "17-00" }, ["제약", "constraint", "설계 컨셉", "제한 사항"]),
    C("sys_qual", "적격성(검증) 요구·검증 기준", { "3.1": "17-12, 17-50", "4.0": "17-00 (verifiable)" }, ["검증 기준", "검증기준", "검증 방법", "검증방법", "verification", "시험 방법", "합격 기준"]),
    C("sys_overview", "시스템 개요", { "3.1": "17-12" }, ["시스템 개요", "개요", "overview", "system summary"]),
    C("sys_elemrel", "시스템 요소 간 상호관계·제약", { "3.1": "17-12" }, ["요소 간", "엘리먼트", "element", "구성 요소", "pbs", "breakdown"]),
    C("sys_elemsw", "시스템 요소와 SW의 관계·제약", { "3.1": "17-12" }, ["소프트웨어", "software", "sw 로직", "sw logic", "펌웨어", "firmware"]),
    C("sys_mem", "메모리·용량 요구", { "3.1": "17-12", "4.0": "17-00 (HW: computing resources)" }, ["메모리", "memory", "용량", "ram", "rom", "flash", "eeprom"]),
    C("sys_ui", "사용자 인터페이스 요구", { "3.1": "17-12" }, ["사용자 인터페이스", "user interface", "표시", "display", "클러스터", "hmi"]),
    C("sys_perf", "성능 요구 (응답시간·주기·정확도)", { "3.1": "17-12" }, ["성능", "performance", "응답", "주기", "정확도", "latency", "ms 이내"]),
    C("sys_cmd", "명령 구조(command structures)", { "3.1": "17-12" }, ["명령", "command", "서비스", "service", "커맨드"]),
    C("sys_dataprot", "보안·데이터 보호 특성", { "3.1": "17-12" }, ["데이터 보호", "data protection", "암호화", "무결성", "integrity", "개인정보"]),
    C("sys_param", "응용 파라미터 설정", { "3.1": "17-12" }, ["파라미터", "parameter", "캘리브레이션", "calibration", "configuration", "설정값", "코딩"]),
    C("sys_manual", "수동 운용(manual operations)", { "3.1": "17-12" }, ["수동", "manual", "비상", "emergency"]),
    C("sys_reuse", "재사용 컴포넌트", { "3.1": "17-12" }, ["재사용", "reuse", "carry-over", "carry over", "과거차", "기존 부품", "파생"]),
    C("sys_env", "환경 능력 (온도·습도·진동·EMC)", { "3.1": "17-12", "4.0": "17-00 (thermal 등)" }, ["환경", "온도", "습도", "진동", "emc", "thermal", "열", "방수", "ip"]),
    C("sys_doc", "문서화 요구", { "3.1": "17-12" }, ["문서화", "documentation", "매뉴얼", "manual 제공", "사용 설명"]),
    C("sys_rel", "신뢰성 요구", { "3.1": "17-12" }, ["신뢰성", "reliability", "내구", "수명", "mtbf", "durability"]),
    C("sys_logistic", "물류 요구 (보관·운송·포장)", { "3.1": "17-12", "4.0": "17-00 (HW: storage/transportation)" }, ["물류", "logistic", "보관", "운송", "포장", "storage", "transport"]),
    C("sys_diag", "진단 요구", { "3.1": "17-12" }, ["진단", "diagnos", "dtc", "uds", "obd", "고장 검출"]),
    C("sys_physical", "물리 특성 (발열·치수·중량·재질)", { "4.0": "17-00" }, ["치수", "중량", "무게", "재질", "발열", "dimension", "weight", "material", "heat dissipation"]),
    C("sys_attr", "요구사항 속성 (ID·우선순위·상태·릴리스 범위)", { "3.1": "SYS.2.BP2", "4.0": "17-54" }, ["우선순위", "priority", "상태", "status", "release", "릴리즈", "요구사항 id", "요구사항 ID"]),
    C("sys_impact", "운영 환경·시스템 컨텍스트 영향 분석", { "3.1": "SYS.2.BP4 (15-01)", "4.0": "SYS.2.BP4 (15-51)" }, ["영향", "impact", "컨텍스트", "context", "운영 환경", "operating environment"]),
    C("sys_trace", "상위(이해관계자) 요구 추적", { "3.1": "13-22", "4.0": "13-51" }, ["추적", "trace", "출처", "source", "근거", "상위 요구"]),
    C("sys_fsc", "Safety Goal·기능안전 컨셉(FSC)", { "3.1": "-", "4.0": "-" }, ["safety goal", "fsc", "기능안전", "asil"], { origin: "ISO 26262" }),
    C("sys_cs", "사이버보안 목표·요구", { "3.1": "-", "4.0": "-" }, ["사이버보안", "cybersecurity", "tara", "cal"], { origin: "ISO/SAE 21434" }),
  ],
  SYS_AD: [
    C("ad_overview", "시스템 설계 전체 개요", { "3.1": "04-06" }, ["개요", "overview", "구조"]),
    C("ad_elems", "시스템 요소 식별 (정적 구조)", { "3.1": "04-06", "4.0": "SYS.3.BP1, 04-06" }, ["엘리먼트", "element", "구성요소", "구성 요소", "블록", "block", "component"]),
    C("ad_rel", "시스템 요소 간 상호관계", { "3.1": "04-06", "4.0": "04-06" }, ["상호관계", "관계", "interrelation", "연결", "블록 다이어그램", "block diagram"]),
    C("ad_sw", "시스템 요소와 SW의 관계", { "3.1": "04-06" }, ["소프트웨어", "software", "sw", "펌웨어"]),
    C("ad_mem", "요소별 메모리·용량 설계", { "3.1": "04-06" }, ["메모리", "memory", "용량", "ram", "flash"]),
    C("ad_if", "인터페이스 정의 (버스·HSI·열·EMC·기계)", { "3.1": "04-06, 17-08", "4.0": "04-06" }, ["인터페이스", "interface", "can", "spi", "pwm", "hsi", "커넥터", "핀", "pin"]),
    C("ad_cmd", "명령 구조", { "3.1": "04-06" }, ["명령", "command", "서비스"]),
    C("ad_param", "시스템 파라미터 설정", { "3.1": "04-06", "4.0": "04-06" }, ["파라미터", "parameter", "calibration", "설정값", "configuration"]),
    C("ad_manual", "수동 운용·사람의 제어 행위", { "3.1": "04-06", "4.0": "04-06 (STPA 등)" }, ["수동", "manual", "human control", "운전자 조작"]),
    C("ad_reuse", "재사용 컴포넌트", { "3.1": "04-06" }, ["재사용", "reuse", "carry-over", "기존"]),
    C("ad_alloc", "요구사항 → 시스템 요소 매핑(할당)", { "3.1": "04-06, SYS.3.BP2", "4.0": "SYS.3.BP4" }, ["할당", "allocation", "매핑", "mapping", "요구사항 id"]),
    C("ad_modes", "운영 모드 (startup·shutdown·sleep·진단)", { "3.1": "04-06", "4.0": "SYS.3.BP2" }, ["모드", "mode", "sleep", "startup", "shutdown", "state", "상태"]),
    C("ad_modedep", "운영 모드에 따른 요소 간 의존", { "3.1": "04-06" }, ["의존", "dependency", "모드별"]),
    C("ad_dynamic", "동적 거동 (시퀀스·상태 천이·타이밍)", { "3.1": "04-06, SYS.3.BP4", "4.0": "SYS.3.BP2" }, ["동적", "dynamic", "시퀀스", "sequence", "천이", "transition", "타이밍", "timing"]),
    C("ad_behavior", "요소별 개별 거동", { "4.0": "04-06" }, ["거동", "behavior", "behaviour", "동작 설명"]),
    C("ad_rationale", "아키텍처 선정 근거·대안 평가", { "3.1": "SYS.3.BP5", "4.0": "04-06, SYS.3.BP3" }, ["근거", "rationale", "대안", "alternative", "선정", "trade"]),
    C("ad_analysis", "아키텍처 분석 결과", { "3.1": "SYS.3.BP5 (15-01)", "4.0": "SYS.3.BP3 (15-51)" }, ["분석", "analysis", "평가", "검토 결과"]),
    C("ad_special", "특별 특성(Special Characteristics)", { "4.0": "17-57" }, ["특별 특성", "special characteristic", "iatf", "sc/cc"]),
    C("ad_tsc", "기술안전컨셉(TSC)·HW 메트릭", { "3.1": "-", "4.0": "-" }, ["기술안전", "technical safety", "tsc", "pmhf", "spfm", "lfm"], { origin: "ISO 26262" }),
  ],
  SW_RS: [
    C("sw_func", "SW 기능 요구", { "3.1": "17-11", "4.0": "17-00" }, ["기능 요구", "functional", "기능"]),
    C("sw_standards", "적용 표준", { "3.1": "17-11" }, ["표준", "standard", "autosar", "misra", "iso"]),
    C("sw_struct", "SW 구조 고려사항·제약", { "3.1": "17-11" }, ["구조", "structure", "제약", "constraint"]),
    C("sw_elems", "필요 SW 요소·요소 간 관계", { "3.1": "17-11" }, ["요소", "element", "모듈", "module", "컴포넌트"]),
    C("sw_perf", "SW 성능 특성", { "3.1": "17-11" }, ["성능", "performance", "주기", "응답", "ms"]),
    C("sw_if", "SW 인터페이스", { "3.1": "17-11, 17-08", "4.0": "17-00" }, ["인터페이스", "interface", "입력 신호", "출력 신호", "signal", "can"]),
    C("sw_sec", "SW 보안 특성", { "3.1": "17-11" }, ["보안", "security", "인증", "암호"]),
    C("sw_db", "데이터베이스·데이터 설계 요구", { "3.1": "17-11" }, ["데이터", "data", "nvm", "eeprom", "저장"]),
    C("sw_err", "오류 처리·복구 속성", { "3.1": "17-11" }, ["오류", "error", "fault", "고장", "복구", "recovery"]),
    C("sw_res", "자원 소비 특성 (RAM·ROM·CPU)", { "3.1": "17-11" }, ["자원", "resource", "ram", "rom", "cpu", "부하", "load"]),
    C("sw_verif", "검증 기준", { "3.1": "17-50", "4.0": "17-00 (verifiable)" }, ["검증", "verification", "검증방법", "검증 방법"]),
    C("sw_attr", "요구사항 속성", { "3.1": "SWE.1.BP2", "4.0": "17-54" }, ["우선순위", "priority", "상태", "variant", "variants"]),
    C("sw_trace", "시스템 요구·아키텍처 추적", { "3.1": "13-22", "4.0": "13-51" }, ["추적", "trace", "관련 요구사항", "근거", "상위"]),
    C("sw_impact", "운영 환경 영향 분석", { "3.1": "SWE.1.BP4", "4.0": "SWE.1.BP4 (15-51)" }, ["영향", "impact", "운영 환경"]),
  ],
  SW_AD: [
    C("swa_struct", "전체 SW 구조 (정적 측면)", { "3.1": "04-04", "4.0": "SWE.2.BP1" }, ["구조", "structure", "아키텍처", "layer", "계층"]),
    C("swa_os", "OS·태스크 구조 (주기·우선순위)", { "3.1": "04-04", "4.0": "04-04 (dynamics)" }, ["태스크", "task", "os", "주기", "cycle", "우선순위", "priority"]),
    C("swa_ipc", "태스크/프로세스 간 통신", { "3.1": "04-04", "4.0": "04-04" }, ["통신", "ipc", "inter-task", "rte", "메시지"]),
    C("swa_elems", "SW 요소 식별", { "3.1": "04-04", "4.0": "04-04" }, ["컴포넌트", "component", "모듈", "module", "swc"]),
    C("swa_own", "자체 개발·공급(외부) 코드 구분", { "3.1": "04-04" }, ["자체 개발", "공급", "supplied", "third", "cots", "bsw", "오픈소스"]),
    C("swa_rel", "SW 요소 간 관계·의존성", { "3.1": "04-04", "4.0": "04-04" }, ["관계", "의존", "dependency", "호출"]),
    C("swa_if", "인터페이스 기술 특성 (API·콜백·라이브러리)", { "3.1": "04-04", "4.0": "04-04" }, ["인터페이스", "interface", "api", "callback", "콜백"]),
    C("swa_data", "데이터 저장 위치·손상 방지(체크섬 등)", { "3.1": "04-04" }, ["체크섬", "checksum", "crc", "redundancy", "저장 위치"]),
    C("swa_variant", "변형(variant) 도출 방법", { "3.1": "04-04" }, ["variant", "변형", "사양별"]),
    C("swa_dyn", "동적 거동 (startup·shutdown·업데이트·오류 처리)", { "3.1": "04-04", "4.0": "SWE.2.BP2" }, ["startup", "shutdown", "초기화", "동적", "dynamic", "상태", "mode"]),
    C("swa_persist", "영속 데이터와 조건", { "3.1": "04-04" }, ["영속", "persistent", "nvm", "eeprom"]),
    C("swa_param", "응용 파라미터 설정", { "4.0": "04-04" }, ["파라미터", "parameter", "calibration", "configuration"]),
    C("swa_irq", "인터럽트·우선순위·타임 슬라이스", { "4.0": "04-04 (dynamics)" }, ["인터럽트", "interrupt", "isr", "time slice"]),
    C("swa_res", "자원 소비 목표", { "3.1": "SWE.2.BP5", "4.0": "SWE.2.BP3 (15-51)" }, ["자원", "resource", "ram", "rom", "cpu", "부하"]),
    C("swa_rationale", "아키텍처 선정 근거·대안 평가", { "3.1": "SWE.2.BP6", "4.0": "04-04, SWE.2.BP3" }, ["근거", "rationale", "대안", "alternative"]),
    C("swa_alloc", "SW 요구 → 컴포넌트 할당", { "3.1": "SWE.2.BP2", "4.0": "SWE.2.BP4" }, ["할당", "allocation", "매핑"]),
  ],
  HW_RS: [
    C("hw_func", "아날로그·디지털 회로 기능 거동", { "4.0": "17-00 (HW)" }, ["회로", "circuit", "아날로그", "디지털", "analog", "digital"]),
    C("hw_life", "수명·미션 프로파일·내구", { "4.0": "17-00 (HW)" }, ["수명", "lifetime", "mission profile", "미션 프로파일", "내구"]),
    C("hw_price", "최대 가격", { "4.0": "17-00 (HW)" }, ["가격", "price", "원가", "cost"]),
    C("hw_storage", "보관·운송 요구", { "4.0": "17-00 (HW)" }, ["보관", "운송", "storage", "transport"]),
    C("hw_power", "대기전류·전압 응답 (크랭크·스타트스톱·로드덤프)", { "4.0": "17-00 (HW)" }, ["대기전류", "암전류", "quiescent", "crank", "크랭크", "load dump", "로드덤프", "drop-out"]),
    C("hw_thermal", "온도·최대 발열", { "4.0": "17-00 (HW)" }, ["온도", "temperature", "발열", "열"]),
    C("hw_powerstate", "동작 상태별 소비전력 (sleep·startup·reset)", { "4.0": "17-00 (HW)" }, ["소비전력", "소비 전류", "power consumption", "sleep", "슬립"]),
    C("hw_signal", "주파수·변조·신호 지연·필터·제어루프", { "4.0": "17-00 (HW)" }, ["주파수", "frequency", "변조", "지연", "filter", "필터", "pwm"]),
    C("hw_seq", "파워업/다운 시퀀스·신호 취득 정확도", { "4.0": "17-00 (HW)" }, ["파워업", "power-up", "power up", "시퀀스", "정확도", "accuracy"]),
    C("hw_compute", "연산 자원 (메모리·CPU 클럭 공차)", { "4.0": "17-00 (HW)" }, ["메모리", "memory", "clock", "클럭", "mcu"]),
    C("hw_mech", "마모·전단력 (핀·솔더 조인트)", { "4.0": "17-00 (HW)" }, ["마모", "전단", "솔더", "solder", "핀", "pin"]),
    C("hw_lessons", "교훈(Lessons learned) 반영 요구", { "4.0": "17-00 (HW)" }, ["교훈", "lessons", "과거차", "이슈"]),
    C("hw_if", "HW 인터페이스·운영 환경 영향", { "4.0": "HWE.1.BP4" }, ["인터페이스", "interface", "커넥터", "영향"]),
    C("hw_verif", "검증 가능성·검증 기준", { "4.0": "17-00 (verifiable)" }, ["검증", "verification", "시험"]),
    C("hw_attr", "요구사항 속성", { "4.0": "17-54" }, ["우선순위", "priority", "상태"]),
    C("hw_trace", "시스템 요구·아키텍처 추적", { "4.0": "13-51" }, ["추적", "trace", "상위", "근거"]),
    C("hw_safety", "기술안전컨셉 유래 안전 요구", { "3.1": "-", "4.0": "17-00 (HW)" }, ["안전", "safety", "tsc", "asil"], { origin: "ISO 26262" }),
  ],
  HW_AD: [
    C("hwa_floor", "초기 floorplan·전체 HW 구조", { "4.0": "04-52" }, ["floorplan", "배치", "구조", "블록"]),
    C("hwa_comps", "필요 HW 컴포넌트 식별", { "4.0": "04-52" }, ["컴포넌트", "component", "부품", "회로 블록"]),
    C("hwa_rationale", "HW 아키텍처 선정 근거", { "4.0": "04-52" }, ["근거", "rationale", "선정"]),
    C("hwa_own", "자체 개발·공급 HW 구분", { "4.0": "04-52" }, ["자체", "공급", "supplied", "구매"]),
    C("hwa_if", "내부·외부 HW 인터페이스 식별·명세", { "4.0": "04-52, 04-53" }, ["인터페이스", "interface", "핀", "pin", "커넥터"]),
    C("hwa_dyn", "동적 거동 (전기적 상태 천이·파워 시퀀스)", { "4.0": "04-52, HWE.2.BP3" }, ["동적", "dynamic", "시퀀스", "천이", "power-up"]),
    C("hwa_dep", "HW 컴포넌트 간 관계·의존", { "4.0": "04-52" }, ["관계", "의존", "dependency"]),
    C("hwa_variant", "HW 변형(variant)", { "4.0": "04-52" }, ["variant", "변형", "사양"]),
    C("hwa_power", "전원·열·접지 컨셉", { "4.0": "04-52" }, ["전원", "power supply", "접지", "ground", "열 설계", "thermal"]),
    C("hwa_alloc", "HW 요구 → 컴포넌트 할당", { "4.0": "HWE.2.BP5" }, ["할당", "allocation", "매핑"]),
  ],
  VERIF: [
    C("v_tc", "검증 수단(TC) 명세", { "3.1": "08-50", "4.0": "08-60" }, ["테스트 케이스", "test case", "검증 수단", "tc"]),
    C("v_pass", "합격/불합격 기준", { "3.1": "08-50, 17-50", "4.0": "08-60" }, ["합격", "pass", "fail", "기대 결과", "expected"]),
    C("v_entry", "진입·종료 기준 / 중단·재개 기준", { "3.1": "08-52", "4.0": "08-60" }, ["진입", "종료", "entry", "exit", "중단", "재개"]),
    C("v_tech", "검증 기법 (동치·경계값·결함주입)", { "3.1": "08-52", "4.0": "08-60" }, ["경계값", "boundary", "동치", "equivalence", "결함 주입", "fault injection"]),
    C("v_env", "검증 환경·인프라", { "3.1": "08-52", "4.0": "08-60" }, ["환경", "environment", "hils", "벤치", "bench", "챔버"]),
    C("v_seq", "필요 순서", { "3.1": "08-50", "4.0": "08-60" }, ["순서", "sequence", "ordering"]),
    C("v_regr", "회귀 검증 대상·기준", { "3.1": "08-50", "4.0": "08-58" }, ["회귀", "regression"]),
    C("v_sel", "검증 수단 선택 세트·선택 근거", { "3.1": "SYS.5.BP3", "4.0": "08-58" }, ["선택", "selection"]),
    C("v_strategy", "검증 전략", { "3.1": "08-52 (SYS.5.BP1)" }, ["전략", "strategy", "계획"]),
    C("v_integ", "통합 대상 요소·통합 순서", { "3.1": "08-50 (system integration)", "4.0": "06-50" }, ["통합 순서", "integration sequence", "통합 대상"]),
    C("v_result", "결과 기록 (통과·미통과·미수행·일자·수행자)", { "3.1": "13-50", "4.0": "15-52" }, ["결과", "result", "수행자", "일자"]),
  ],
};
// 문서 → 카탈로그 그룹
export const DOC_CATALOG = {
  SYS_RS: "SYS_RS", SYS_AD: "SYS_AD", SW_RS: "SW_RS", SW_AD: "SW_AD", HW_RS: "HW_RS", HW_AD: "HW_AD",
  V_SYS5: "VERIF", V_SYS4: "VERIF", V_SWE6: "VERIF", V_SWE5: "VERIF", V_HWE4: "VERIF", V_HWE3: "VERIF",
};

// 특성이 선택 버전에서 적용되는가 (HW 그룹은 3.1 단독 모드에서도 "PAM 확장"으로 적용)
export function charApplies(ch, version, group) {
  const vs = versionsOf(version);
  if (ch.origin !== "ASPICE") return true;                       // 타 표준 특성: 선택 표시
  if ((group === "HW_RS" || group === "HW_AD") && !ch.src["3.1"]) return true;
  return vs.some(v => ch.src[v]);
}
export function charSource(ch, version) {
  if (ch.origin !== "ASPICE") return ch.origin;
  return versionsOf(version).map(v => ch.src[v] ? `${v}: ${ch.src[v]}` : null).filter(Boolean).join(" / ") || "4.0 준용(PAM 확장)";
}

// ── 키워드 매칭 (결정적) ──────────────────────────────────────────────────
function kwHit(text, kw) {
  const t = String(text || "").toLowerCase();
  return kw.some(k => {
    const kk = String(k).toLowerCase();
    // 짧은 영문 키워드(can, lin, ip, sw…)는 단어 경계로 매칭 — "scan"·"line"·"tip" 오탐 방지
    if (/^[a-z0-9/\-]{1,4}$/.test(kk)) return new RegExp(`(^|[^a-z0-9])${kk.replace(/[/\-]/g, m => "\\" + m)}([^a-z0-9]|$)`).test(t);
    return t.includes(kk);
  });
}

// 문서 텍스트 → 목차(outline) 줄만 추출. 본문 전체로 판정하면 요구 문장 속 단어(예: '환경 시험' 본문)까지
// 걸려 거의 모든 특성이 '있음'으로 나오므로, 섹션 제목 수준에서 존재 여부를 본다.
export function outlineOf(text) {
  const lines = String(text || "").split(/\n/).map(l => l.replace(/\s+$/, ""));
  const out = [];
  lines.forEach(l => {
    const t = l.trim(); if (!t || t.length > 90) return;
    if (t.startsWith("§ ")) { out.push(t.slice(2).trim()); return; }   // 제목 스타일 문단 (docxOutlineText가 표시)
    const toc = /\t\s*\d{1,4}\s*$/.test(l);                               // 목차: "제목<TAB>쪽번호"
    const num = /^(\d{1,2}(\.\d{1,2}){0,4}\.?|[IVX]{1,4}\.|제\s*\d+\s*[장절])\s+\S/.test(t);  // 번호 제목
    if (toc || num) out.push(t.replace(/\t\s*\d{1,4}\s*$/, "").trim());
  });
  // 표의 항목 라벨(요구사항별 속성표의 "검증 기준"·"요구사항 근거" 등)은 짧은 줄이 반복 등장한다 — 3회 이상이면 양식 항목으로 본다
  const cnt = {};
  lines.forEach(l => { const t = l.trim(); if (t && t.length <= 24 && !/^[\d\s.,:%~\-+]+$/.test(t)) cnt[t] = (cnt[t] || 0) + 1; });
  Object.entries(cnt).forEach(([t, n]) => { if (n >= 3) out.push(t); });
  return [...new Set(out)];
}
// 템플릿(또는 기존 문서) 텍스트 → 특성별 존재 여부. mode: "outline"(목차 기준, 기본) | "full"(본문 전체)
export function checkTemplateCoverage(text, group, version, mode = "outline") {
  const ol = outlineOf(text);
  const useOutline = mode === "outline" && ol.length >= 5;      // 목차 추출이 안 되는 문서는 본문 기준으로 폴백
  const basis = useOutline ? ol.join("\n") : String(text || "");
  const list = (WP_CATALOG[group] || []).filter(c => charApplies(c, version, group));
  return { mode: useOutline ? "outline" : "full", outlineCount: ol.length,
    items: list.map(c => ({ id: c.id, label: c.label, origin: c.origin, source: charSource(c, version), hit: kwHit(basis, c.kw) })) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) 입력자료 체크리스트 — "무엇이 있으면 채울 수 있는가"
// ═══════════════════════════════════════════════════════════════════════════
export const INPUT_CHECKLIST = [
  { id: "in_cust", label: "고객(OEM) 요구사양서·RFQ·SOR", feeds: ["SYS_RS"], chars: ["sys_func", "sys_biz", "sys_perf", "sys_ops"] },
  { id: "in_reg", label: "적용 법규·표준 목록", feeds: ["SYS_RS", "SW_RS"], chars: ["sys_constraint", "sw_standards"] },
  { id: "in_dbc", label: "통신 DB (CAN DBC·LDF·ARXML)", feeds: ["SYS_RS", "SYS_AD", "SW_RS"], chars: ["sys_if", "ad_if", "sw_if"], parsable: true },
  { id: "in_diag", label: "진단 사양 (UDS 서비스·DTC 목록)", feeds: ["SYS_RS", "SW_RS"], chars: ["sys_diag", "sys_cmd"] },
  { id: "in_env", label: "환경·내구 시험 규격 (온도·진동·EMC)", feeds: ["SYS_RS", "HW_RS"], chars: ["sys_env", "sys_rel", "hw_thermal", "hw_life"] },
  { id: "in_prev", label: "전대(동일 부품) 산출물·과거차 이슈 이력", feeds: ["SYS_RS", "SYS_AD", "SW_RS", "SW_AD", "HW_RS", "HW_AD"], chars: ["sys_reuse", "ad_reuse", "hw_lessons"] },
  { id: "in_mech", label: "기구·레이아웃 도면, 커넥터 핀맵", feeds: ["SYS_AD", "HW_AD"], chars: ["sys_physical", "ad_if", "hwa_if"] },
  { id: "in_sch", label: "회로도·주요 부품 데이터시트", feeds: ["HW_RS", "HW_AD"], chars: ["hw_func", "hw_signal", "hwa_comps"] },
  { id: "in_mcu", label: "MCU·플랫폼 사양 (메모리·클럭·BSW)", feeds: ["SW_AD", "HW_AD"], chars: ["sys_mem", "swa_res", "swa_own", "hw_compute"] },
  { id: "in_mission", label: "미션 프로파일·전원 사양 (크랭크·로드덤프)", feeds: ["HW_RS"], chars: ["hw_life", "hw_power", "hw_powerstate"] },
  { id: "in_testenv", label: "검증 환경 정보 (HILS·벤치·챔버·계측장비)", feeds: ["VERIF"], chars: ["v_env"] },
  { id: "in_safety", label: "기능안전 분석 (HARA·FSC·TSC) — ISO 26262 대상 시", feeds: ["SYS_RS", "SYS_AD", "HW_RS"], chars: ["sys_fsc", "ad_tsc", "hw_safety"], optional: true },
  { id: "in_cs", label: "사이버보안 분석 (TARA) — ISO/SAE 21434 대상 시", feeds: ["SYS_RS"], chars: ["sys_cs", "sys_security"], optional: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3) 요구사항 품질 점검 (결정적) — 4.0 17-00 / 3.1 SYS.2.BP3·BP5 관점
// ═══════════════════════════════════════════════════════════════════════════
const WEAK_WORDS = ["적절히", "적절한", "충분히", "충분한", "빠르게", "신속히", "신속하게", "가능한 한", "가능한한", "최대한", "효율적", "원활", "용이", "등등", "기타", "일반적으로", "대략", "약간", "user-friendly", "as appropriate", "as fast as possible", "adequate", "sufficient", "etc"];
const DESIGN_HINTS = ["mcu", "spi", "i2c", "uart", "rtos", "autosar", "알고리즘", "함수", "변수", "레지스터", "pi 제어", "pid"];
const UNIT_RE = "(ms|µs|us|s|초|분|v|mv|kv|a|ma|ua|µa|w|kw|℃|°c|도|%|km\\/h|kph|rpm|hz|khz|mhz|bps|kbps|mbps|byte|bytes|kb|mb|mm|cm|m|kg|g|n|nm|bar|kpa|lux|db|회|건|개)";
export const NUM_RE = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}(?![a-z])`, "gi");

export function qualityFlags(req) {
  const text = `${req.title || ""} ${req.text || ""}`;
  const low = text.toLowerCase();
  const flags = [];
  const weak = WEAK_WORDS.filter(w => low.includes(w.toLowerCase()));
  if (weak.length) flags.push({ code: "ambiguous", msg: `모호어: ${weak.slice(0, 3).join(", ")}` });
  if (!String(req.verifCriteria || "").trim()) flags.push({ code: "noCriteria", msg: "검증 기준 없음" });
  if ((req.type === "비기능" || req.type === "성능") && !new RegExp(NUM_RE.source, "i").test(text)) flags.push({ code: "noQuant", msg: "정량 기준 없음" });
  const conj = (text.match(/(?:하고|하며|및|그리고|또한)\s/g) || []).length;
  if (conj >= 3) flags.push({ code: "compound", msg: "복합 요구 의심(분할 검토)" });
  const dz = DESIGN_HINTS.filter(w => low.includes(w));
  if (dz.length && req.level !== "SW" && req.level !== "HW") flags.push({ code: "design", msg: `설계 제약 성격(${dz[0]}) — 4.0 17-00 Design Constraint 분류 검토` });
  if (!String(req.text || req.title || "").trim()) flags.push({ code: "empty", msg: "요구 내용 없음" });
  return flags;
}

// 검증 방법 기본값 (4.0 08-60: test·measurement·calculation·simulation·review·inspection·analysis)
export const VERIF_METHODS = ["Test", "Measurement", "Analysis", "Simulation", "Inspection", "Review", "Demonstration"];
export function defaultVerifMethod(req) {
  const t = `${req.title || ""} ${req.text || ""}`.toLowerCase();
  if (/치수|중량|무게|재질|외관|레이아웃|장착|라벨|표기|dimension|weight|material/.test(t)) return "Inspection";
  if (/문서|매뉴얼|법규|인증서|규정 준수|documentation/.test(t)) return "Review";
  if (/메모리|ram|rom|flash|cpu 부하|cpu load|자원|resource/.test(t)) return "Analysis";
  if (/수명|mtbf|신뢰성|reliability/.test(t)) return "Analysis";
  if (/응답|이내|지연|latency|주기|cycle|timing/.test(t) && new RegExp(NUM_RE.source, "i").test(t)) return "Measurement";
  return "Test";
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) 수치 조건 추출 → 경계값/동치/타이밍/결함주입 TC 도출 (결정적)
// ═══════════════════════════════════════════════════════════════════════════
const TIME_UNITS = ["ms", "µs", "us", "s", "초", "분"];
// 수치 뒤에 오는 한글·영문 비교어: "855V 이상" → x ≥ 855
const OP_WORDS_AFTER = [
  { re: /^\s*(이상|이 상|at least|or more)/i, op: ">=" },
  { re: /^\s*(초과|over|above|more than)/i, op: ">" },
  { re: /^\s*(이하|이내|within|or less|at most|까지)/i, op: "<=" },
  { re: /^\s*(미만|under|below|less than)/i, op: "<" },
];
// 수치 뒤에 오는 기호는 수치가 좌변이므로 방향을 뒤집는다: "810V < HV" → x > 810, "855V ≤ HV" → x ≥ 855
const OP_SYMS_AFTER = [
  { re: /^\s*(≤|<=)/, op: ">=" }, { re: /^\s*</, op: ">" },
  { re: /^\s*(≥|>=)/, op: "<=" }, { re: /^\s*>/, op: "<" },
];
export function extractBounds(text) {
  const s = String(text || "");
  const out = [];
  const seen = new Set();
  // 범위 표기 "A ~ B 단위" / "A–B 단위" / "A부터 B까지"
  const rangeRe = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}?\\s*(?:~|∼|–|부터|에서)\\s*(-?\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}`, "gi");
  let m;
  while ((m = rangeRe.exec(s))) {
    const unit = (m[4] || m[2] || "").toLowerCase();
    const a = Number(m[1]), b = Number(m[3]);
    const key = `R${a}-${b}${unit}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ kind: "range", min: Math.min(a, b), max: Math.max(a, b), unit, raw: m[0].trim() });
  }
  // 단일 값 + 비교 연산 (앞: ≥ 100ms / 뒤: 100ms 이내)
  const re = new RegExp(NUM_RE.source, "gi");
  while ((m = re.exec(s))) {
    const val = Number(m[1]); const unit = m[2].toLowerCase();
    if (out.some(o => o.kind === "range" && o.unit === unit && (o.min === val || o.max === val))) continue;
    const after = s.slice(re.lastIndex, re.lastIndex + 14);
    const before = s.slice(Math.max(0, m.index - 4), m.index);
    let op = null;
    for (const p of OP_WORDS_AFTER) { if (p.re.test(after)) { op = p.op; break; } }
    if (!op) for (const p of OP_SYMS_AFTER) { if (p.re.test(after)) { op = p.op; break; } }
    // 수치 앞의 기호는 수치가 우변: "HV ≤ 850V" → x ≤ 850
    if (!op) { if (/(≥|>=)\s*$/.test(before)) op = ">="; else if (/(≤|<=)\s*$/.test(before)) op = "<="; else if (/>\s*$/.test(before)) op = ">"; else if (/<\s*$/.test(before)) op = "<"; }
    const key = `S${val}${unit}`;
    const dup = out.findIndex(o => o.kind === "single" && `S${o.value}${o.unit}` === key);
    if (dup >= 0) { if (!out[dup].op && op) out[dup] = { ...out[dup], op, raw: `${m[0].trim()} ${op}` }; continue; }
    if (seen.has(key + op)) continue; seen.add(key + op);
    const sym = { ">=": "≥", ">": ">", "<=": "≤", "<": "<" }[op];
    out.push({ kind: "single", value: val, unit, op, raw: op ? `x ${sym} ${m[1]} ${m[2]}` : m[0].trim() });
  }
  return out.slice(0, 6);   // 요구 1건당 최대 6개 조건 — 과도한 TC 폭증 방지
}
function stepOf(val, unit) {
  const u = unit.toLowerCase();
  if (["v", "a", "w"].includes(u)) return Math.abs(val) >= 100 ? 1 : 0.1;
  if (["mv", "ma", "ua", "µa"].includes(u)) return Math.abs(val) >= 100 ? 1 : 0.1;
  if (u === "rpm") return Math.abs(val) >= 1000 ? 10 : 1;
  if (u === "s" || u === "초" || u === "분") return Math.abs(val) >= 10 ? 1 : 0.1;
  if (Number.isInteger(val)) return 1;
  return Math.pow(10, -String(val).split(".")[1].length);
}
const fmt = (v, step) => { const d = String(step).includes(".") ? String(step).split(".")[1].length : 0; return Number(v).toFixed(d); };

// 요구 1건 → 규칙 기반 검증 수단 목록 (id는 나중에 채번)
export function ruleTestsForReq(req, testLevel) {
  const tl = TEST_LEVELS[testLevel];
  const method = req.verifMethod || defaultVerifMethod(req);
  const crit = String(req.verifCriteria || "").trim();
  const base = { level: testLevel, targets: [req.id], origin: "rule", regression: req.priority === "상" || !!req.safety, env: "" };
  const name = req.title || req.id;
  // 시험이 아닌 검증 방법은 해당 방식의 검증 수단 1건으로 명세 (4.0 08-60은 review·inspection·analysis도 검증 수단)
  if (["Inspection", "Review", "Analysis", "Simulation"].includes(method)) {
    const tech = { Inspection: "인스펙션(육안·계측 확인)", Review: "리뷰(문서·기록 검토)", Analysis: "분석(계산·자원 측정 분석)", Simulation: "시뮬레이션" }[method];
    return [{ ...base, title: `${name} — ${method}`, technique: tech, precondition: "검증 대상 형상(SW/HW 버전) 확정",
      steps: `1) 검증 대상과 근거 자료를 식별한다; 2) ${tech} 방식으로 요구 '${name}' 충족 여부를 확인한다; 3) 결과와 근거를 기록한다`,
      expected: crit || `요구 '${name}'의 내용이 충족됨`, passCriteria: crit || "요구 내용 충족 근거 확인", }];
  }
  const tests = [];
  tests.push({ ...base, title: `${name} — 정상 동작`, technique: "요구사항 기반(블랙박스)",
    precondition: `${tl.label} 대상 형상 준비, 정상 동작 조건`,
    steps: `1) 정상 동작 조건을 설정한다; 2) 요구 '${name}'의 트리거 조건을 인가한다; 3) 출력·상태를 관측·기록한다`,
    expected: crit || req.text || name, passCriteria: crit || "기대 결과와 일치" });
  const bounds = extractBounds(`${req.text || ""} ${crit}`);
  // 비교 조건이 없는 단일 수치(예: "6000RPM 지령")는 조건이 아니라 설정값이므로 경계값 TC를 만들지 않는다
  bounds.filter(b => b.kind === "range" || b.op).forEach(b => {
    const isTime = TIME_UNITS.includes(b.unit);
    if (b.kind === "range") {
      const st = stepOf(b.max, b.unit);
      const pts = [b.min - st, b.min, b.max, b.max + st];
      tests.push({ ...base, title: `${name} — 범위 경계값 (${b.raw})`, technique: "동치분할·경계값 분석",
        precondition: "입력 값을 정밀 인가할 수 있는 계측·시뮬레이션 환경",
        steps: pts.map((p, i) => `${i + 1}) 입력 ${fmt(p, st)} ${b.unit} 인가 후 응답 관측`).join("; "),
        expected: `${fmt(b.min, st)}~${fmt(b.max, st)} ${b.unit} 구간: 요구 동작 수행 / 구간 밖(${fmt(pts[0], st)}, ${fmt(pts[3], st)} ${b.unit}): 요구 동작 미수행 또는 정의된 이탈 처리`,
        passCriteria: "4개 경계점 모두 기대 결과와 일치" });
      return;
    }
    if (isTime && (b.op === "<=" || b.op === "<" || !b.op)) {
      tests.push({ ...base, title: `${name} — 타이밍 측정 (${b.raw})`, technique: "타이밍 측정(반복 측정·최악값)",
        precondition: "타임스탬프 계측 장비(오실로스코프·CAN 로거 등) 준비",
        steps: `1) 트리거 조건을 인가하고 응답까지 시간을 측정한다; 2) 최소 30회 반복 측정한다; 3) 최대값(최악값)을 기록한다`,
        expected: `측정 최대값 ${b.op === "<" ? "<" : "≤"} ${b.value} ${b.unit}`, passCriteria: `전 회차 ${b.op === "<" ? "<" : "≤"} ${b.value} ${b.unit}` });
      return;
    }
    const st = stepOf(b.value, b.unit);
    const pts = [b.value - st, b.value, b.value + st];
    const on = v => b.op === ">=" ? v >= b.value : b.op === ">" ? v > b.value : b.op === "<=" ? v <= b.value : b.op === "<" ? v < b.value : null;
    const exp = pts.map(p => { const r = on(p); return `${fmt(p, st)} ${b.unit}: ${r === null ? "판정 조건 확인 필요" : r ? "조건 충족 → 요구 동작 수행" : "조건 미충족 → 요구 동작 미수행"}`; }).join(" / ");
    tests.push({ ...base, title: `${name} — 경계값 (${b.raw})`, technique: "경계값 분석",
      precondition: "입력 값을 정밀 인가할 수 있는 계측·시뮬레이션 환경",
      steps: pts.map((p, i) => `${i + 1}) 입력 ${fmt(p, st)} ${b.unit} 인가 후 응답 관측`).join("; "),
      expected: exp, passCriteria: "3개 경계점 모두 기대 결과와 일치" });
  });
  const t = `${req.title || ""} ${req.text || ""}`;
  if (/고장|오류|에러|결함|진단|fault|error|단선|단락|open|short|과전압|저전압|과전류|타임아웃|timeout|bus.?off|stall|고착/i.test(t)) {
    tests.push({ ...base, title: `${name} — 결함 주입`, technique: "결함 주입(fault injection)", regression: true,
      precondition: "결함 주입 가능 환경(HILS·결함 주입 박스 등)",
      steps: "1) 정상 동작 상태를 확인한다; 2) 요구에 명시된 결함 조건을 주입한다; 3) 검출·보호 동작과 상태(DTC·플래그)를 확인한다; 4) 결함 해제 후 복귀 동작을 확인한다",
      expected: "결함 검출 및 정의된 보호·복귀 동작 수행 (검출 시간·복귀 조건은 요구 기준 적용)", passCriteria: "검출·보호·복귀 동작이 요구와 일치" });
  }
  return tests;
}

// 인터페이스(요소 간 관계) → 통합 검증 수단 (SYS.4 / SWE.5 / HWE.3)
export function ruleTestsForInterface(itf, testLevel, compName = {}) {
  const from = compName[itf.from] || itf.from || "?";
  const to = compName[itf.to] || itf.to || "?";
  const base = { level: testLevel, targets: [itf.id], origin: "rule", regression: true, env: "" };
  const sig = itf.signals ? ` (${String(itf.signals).slice(0, 60)})` : "";
  const tests = [{ ...base, title: `${from} → ${to} 연동${sig}`, technique: "인터페이스 기반 통합 검증",
    precondition: `${from}, ${to} 통합 형상 준비`,
    steps: `1) ${from}에서 인터페이스 출력(${itf.kind || "신호"})을 발생시킨다; 2) ${to}의 수신·처리 결과를 관측한다; 3) 값·단위·범위 일치를 확인한다`,
    expected: `${to}가 ${from}의 ${itf.kind || "신호"}를 정의된 형식·값으로 수신·처리`, passCriteria: "송신값과 수신·처리값 일치" }];
  if (Number(itf.periodMs) > 0) {
    tests.push({ ...base, title: `${from} → ${to} 주기 검증 (${itf.periodMs} ms)`, technique: "타이밍 측정",
      precondition: "버스 로거·타임스탬프 계측 준비",
      steps: "1) 정상 동작 중 메시지를 1분 이상 로깅한다; 2) 송신 간격의 평균·최대·최소를 산출한다",
      expected: `송신 주기 ${itf.periodMs} ms (허용 편차는 통신 사양 기준)`, passCriteria: "주기 편차 허용 범위 이내" });
  }
  if (/can|lin|ethernet|flexray|버스|bus/i.test(`${itf.kind || ""}`)) {
    tests.push({ ...base, title: `${from} → ${to} 통신 이상 (타임아웃·Bus-off)`, technique: "결함 주입(fault injection)",
      precondition: "통신 결함 주입 환경",
      steps: "1) 메시지 송신을 차단해 타임아웃을 발생시킨다; 2) 수신 측 대체값·고장 처리 동작을 확인한다; 3) 통신 복구 후 정상 복귀를 확인한다",
      expected: "타임아웃 검출 및 정의된 대체값·고장 처리, 복구 후 정상 복귀", passCriteria: "검출·처리·복귀가 사양과 일치" });
  }
  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) 모델 생성·동기화·채번
// ═══════════════════════════════════════════════════════════════════════════
export function emptyModel() {
  return {
    schema: 1, version: "both", scope: { SYS: true, SW: true, HW: false }, useAI: true,
    inputs: {}, charOverride: {}, templateChecks: {},
    reqs: { SYS: [], SW: [], HW: [] },
    comps: { SYS: [], SW: [], HW: [] },
    interfaces: { SYS: [], SW: [], HW: [] },
    alloc: { SYS: {}, SW: {}, HW: {} },
    modes: [], rationale: { SYS: "", SW: "", HW: "" },
    tests: [], updatedAt: null,
  };
}
export function normalizeModel(m) {
  const e = emptyModel();
  const x = m && typeof m === "object" ? m : {};
  const lv = k => ({ SYS: [...((x[k] || {}).SYS || [])], SW: [...((x[k] || {}).SW || [])], HW: [...((x[k] || {}).HW || [])] });
  return {
    ...e, ...x,
    scope: { ...e.scope, ...(x.scope || {}) },
    inputs: { ...(x.inputs || {}) }, charOverride: { ...(x.charOverride || {}) }, templateChecks: { ...(x.templateChecks || {}) },
    reqs: lv("reqs"), comps: lv("comps"), interfaces: lv("interfaces"),
    alloc: { SYS: { ...((x.alloc || {}).SYS || {}) }, SW: { ...((x.alloc || {}).SW || {}) }, HW: { ...((x.alloc || {}).HW || {}) } },
    modes: [...(x.modes || [])], rationale: { ...e.rationale, ...(x.rationale || {}) },
    tests: [...(x.tests || [])],
  };
}

// 확정된 시스템 요구사항(requirements.items) → SYS 레벨 요구로 동기화.
// 원문 필드(제목·내용)는 항상 최신화하되, ASPICE 전용 속성(검증방법·기준·안전·보안·상태)은 사용자 수정을 보존한다.
export function syncSysReqs(items, prev) {
  const old = Object.fromEntries((prev || []).map(r => [r.id, r]));
  return (items || []).filter(it => it && it.id).map(it => {
    const o = old[it.id] || {};
    const text = it.detail || it.summary || "";
    const base = {
      id: it.id, level: "SYS", title: it.name || "", text, type: it.type || "기능",
      source: it.source || "", priority: it.priority || "중", stkId: it.stkId || "",
    };
    const merged = { ...base,
      verifMethod: o.verifMethod || defaultVerifMethod(base),
      verifCriteria: o.verifCriteriaEdited ? o.verifCriteria : (it.acceptance || o.verifCriteria || ""),
      verifCriteriaEdited: !!o.verifCriteriaEdited,
      safety: o.safety || "", security: !!o.security, special: !!o.special,
      status: o.status || "Draft", release: o.release || "", rationale: o.rationale || "" };
    return merged;
  });
}

export function nextId(prefix, list, width = 3) {
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[-]/g, "\\-")}(\\d+)$`);
  (list || []).forEach(x => { const m = re.exec(String(x.id || "")); if (m) max = Math.max(max, Number(m[1])); });
  return prefix + String(max + 1).padStart(width, "0");
}
// 레벨별 요구 접두 (SYS는 기존 RF/RN/RI 체계를 그대로 사용 — SyRS·RTM과 ID 일치)
export const REQ_PREFIX = { SW: "SWR-", HW: "HWR-" };

// 어떤 시스템 요소가 SW/HW 범위인가
export const COMP_KINDS = { SYS: ["HW", "SW", "HW+SW", "ME", "외부"], SW: ["자체 개발", "BSW·플랫폼", "외부 공급", "자동 생성"], HW: ["회로 블록", "주요 부품", "전원", "커넥터·기구"] };
export const elemHasSW = e => /SW/.test(String(e?.kind || ""));
export const elemHasHW = e => /HW/.test(String(e?.kind || ""));

// 하위 레벨로 파생해야 하는 상위 요구 (SW: SW 포함 요소에 할당된 SYS 요구 / HW: HW 포함 요소)
export function parentsForLevel(model, level) {
  const sysComps = Object.fromEntries((model.comps.SYS || []).map(c => [c.id, c]));
  const want = level === "SW" ? elemHasSW : elemHasHW;
  return (model.reqs.SYS || []).filter(r => (model.alloc.SYS[r.id] || []).some(cid => sysComps[cid] && want(sysComps[cid])))
    .map(r => ({ ...r, elems: (model.alloc.SYS[r.id] || []).filter(cid => sysComps[cid] && want(sysComps[cid])) }));
}

// ── 규칙 기반(AI 미사용) 초안 ──────────────────────────────────────────────
// 시스템 요소: 요구사항의 기능 모듈(WBS 배정)을 요소 후보로, 인터페이스 요구가 있으면 통신 요소를 추가
export function ruleSysArchitecture(items, specLeaves) {
  const leafName = Object.fromEntries((specLeaves || []).map(l => [l.wbsNo, l.name]));
  const mods = [...new Set((items || []).map(i => i.wbsNo).filter(w => w && w !== "공통" && leafName[w]))];
  const comps = mods.map((w, i) => ({ id: `SYE-${String(i + 1).padStart(3, "0")}`, name: leafName[w], kind: "HW+SW", desc: `기능 모듈 '${leafName[w]}' 담당 요소 (규칙 기반 초안 — 물리 요소로 재분해 필요)`, behavior: "", origin: "rule", wbsNo: w }));
  if (!comps.length) comps.push({ id: "SYE-001", name: "제어부(ECU)", kind: "HW+SW", desc: "시스템 제어 요소 (규칙 기반 초안 — 재분해 필요)", behavior: "", origin: "rule" });
  if ((items || []).some(i => i.type === "인터페이스")) comps.push({ id: nextId("SYE-", comps), name: "통신 인터페이스", kind: "HW+SW", desc: "차량 네트워크 송수신 (CAN/LIN 등)", behavior: "", origin: "rule" });
  const byWbs = Object.fromEntries(comps.filter(c => c.wbsNo).map(c => [c.wbsNo, c.id]));
  const ifComp = comps.find(c => c.name === "통신 인터페이스");
  const alloc = {};
  (items || []).forEach(i => {
    if (i.type === "인터페이스" && ifComp) alloc[i.id] = [ifComp.id];
    else if (byWbs[i.wbsNo]) alloc[i.id] = [byWbs[i.wbsNo]];
    else alloc[i.id] = comps.filter(c => c !== ifComp).map(c => c.id);   // 공통(비기능): 전 요소
  });
  return { comps, alloc };
}
// 하위 요구 규칙 파생: 상위 요구를 상속한 초안(Draft) — 사용자가 SW/HW 관점으로 구체화
export function ruleDeriveReqs(model, level) {
  const prefix = REQ_PREFIX[level];
  const parents = parentsForLevel(model, level);
  const keep = (model.reqs[level] || []).filter(r => r.origin === "manual");
  const out = [...keep];
  const sysComps = Object.fromEntries((model.comps.SYS || []).map(c => [c.id, c]));
  parents.forEach(p => {
    if (keep.some(k => (k.parents || []).includes(p.id))) return;
    const id = nextId(prefix, out, 4);
    out.push({ id, level, parents: [p.id], sysElems: p.elems, title: p.title,
      text: `[${level} 관점 구체화 필요] ${p.text || p.title}`, type: p.type, priority: p.priority,
      verifMethod: p.verifMethod || defaultVerifMethod(p), verifCriteria: p.verifCriteria || "",
      safety: p.safety || "", security: !!p.security, status: "Draft", origin: "rule",
      note: `상위 ${p.id} 상속 초안 — 할당 요소: ${p.elems.map(e => sysComps[e]?.name || e).join(", ")}` });
  });
  return out;
}
// 하위 컴포넌트 규칙 초안: 상위 시스템 요소 1개당 컴포넌트 1개, 요구는 해당 요소 컴포넌트에 할당
export function ruleComponents(model, level) {
  const prefix = LEVELS[level].compPrefix;
  const want = level === "SW" ? elemHasSW : elemHasHW;
  const elems = (model.comps.SYS || []).filter(want);
  const comps = elems.map((e, i) => ({ id: `${prefix}${String(i + 1).padStart(3, "0")}`, name: `${e.name} ${level}`, kind: level === "SW" ? "자체 개발" : "회로 블록", desc: `시스템 요소 ${e.id} '${e.name}'의 ${level} 구현 (규칙 기반 초안)`, behavior: "", sysElem: e.id, origin: "rule" }));
  const bySys = Object.fromEntries(comps.map(c => [c.sysElem, c.id]));
  const alloc = {};
  (model.reqs[level] || []).forEach(r => { alloc[r.id] = [...new Set((r.sysElems || []).map(s => bySys[s]).filter(Boolean))]; });
  return { comps, alloc };
}

// 전체 TC 재생성 (manual은 보존). level 지정 시 해당 검증 레벨만.
export function generateRuleTests(model, onlyLevels) {
  const levels = onlyLevels || Object.keys(TEST_LEVELS).filter(k => model.scope[TEST_LEVELS[k].level]);
  const kept = (model.tests || []).filter(t => t.origin === "manual" || !levels.includes(t.level));
  const aiKeep = (model.tests || []).filter(t => t.origin === "ai" && levels.includes(t.level));
  const fresh = [];
  levels.forEach(L => {
    const tl = TEST_LEVELS[L];
    if (tl.targetKind === "req") {
      (model.reqs[tl.level] || []).forEach(r => {
        const manualCover = kept.some(t => t.level === L && (t.targets || []).includes(r.id));
        const aiCover = aiKeep.filter(t => (t.targets || []).includes(r.id));
        const rules = ruleTestsForReq(r, L);
        // AI가 서술한 '정상 동작' TC가 있으면 규칙 정상동작 TC를 대체 (경계값·결함주입은 규칙 유지)
        const merged = aiCover.length ? [...aiCover, ...rules.slice(1)] : rules;
        if (!manualCover) fresh.push(...merged);
      });
    } else {
      const names = Object.fromEntries((model.comps[tl.level] || []).map(c => [c.id, c.name]));
      (model.interfaces[tl.level] || []).forEach(itf => {
        if (kept.some(t => t.level === L && (t.targets || []).includes(itf.id))) return;
        fresh.push(...ruleTestsForInterface(itf, L, names));
      });
      // 인터페이스가 정의되지 않은 컴포넌트는 컴포넌트 단위 통합 검증 1건 (SWE.5.BP2: component behavior)
      (model.comps[tl.level] || []).forEach(c => {
        const hasIf = (model.interfaces[tl.level] || []).some(i => i.from === c.id || i.to === c.id);
        if (hasIf || kept.some(t => t.level === L && (t.targets || []).includes(c.id))) return;
        fresh.push({ level: L, targets: [c.id], origin: "rule", regression: false, title: `${c.name} 통합·거동 검증`,
          technique: "컴포넌트 거동 검증", precondition: `${c.name} 통합 형상`, env: "",
          steps: "1) 컴포넌트를 통합 형상에 탑재한다; 2) 할당된 요구의 대표 시나리오를 수행한다; 3) 거동·출력을 관측한다",
          expected: "할당 요구에 정의된 거동 수행", passCriteria: "거동이 설계와 일치" });
      });
    }
  });
  // 레벨별 채번 — 기존 ID와 충돌하지 않게 이어서 부여
  const all = [...kept];
  fresh.forEach(t => { const p = TEST_LEVELS[t.level].prefix; all.push({ ...t, id: nextId(p, all.filter(x => x.level === t.level), 4) }); });
  return all;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) 일관성·양방향 추적성 점검 (3.1 BP6·BP7 / 4.0 BP5·BP4) — 결정적
// ═══════════════════════════════════════════════════════════════════════════
const BP = {
  SYS_REQ_TRACE: { "3.1": "SYS.2.BP6·BP7", "4.0": "SYS.2.BP5" },
  SYS_VERIF: { "3.1": "SYS.2.BP5 (17-50)", "4.0": "SYS.2.BP1 (verifiable)" },
  SYS_ALLOC: { "3.1": "SYS.3.BP2·BP6", "4.0": "SYS.3.BP4" },
  SYS_IF: { "3.1": "SYS.3.BP3", "4.0": "SYS.3.BP1" },
  SYS_DYN: { "3.1": "SYS.3.BP4", "4.0": "SYS.3.BP2" },
  SW_TRACE: { "3.1": "SWE.1.BP6·BP7", "4.0": "SWE.1.BP5" },
  SW_ALLOC: { "3.1": "SWE.2.BP2·BP7", "4.0": "SWE.2.BP4" },
  HW_TRACE: { "3.1": "HWE.1 (PAM 확장)", "4.0": "HWE.1.BP5" },
  HW_ALLOC: { "3.1": "HWE.2 (PAM 확장)", "4.0": "HWE.2.BP5" },
  T_SYS5: { "3.1": "SYS.5.BP5·BP6", "4.0": "SYS.5.BP4" }, T_SYS4: { "3.1": "SYS.4.BP7·BP8", "4.0": "SYS.4.BP4" },
  T_SWE6: { "3.1": "SWE.6.BP5·BP6", "4.0": "SWE.6.BP4" }, T_SWE5: { "3.1": "SWE.5.BP7·BP8", "4.0": "SWE.5.BP6" },
  T_HWE4: { "3.1": "HWE.4 (PAM 확장)", "4.0": "HWE.4.BP5" }, T_HWE3: { "3.1": "HWE.3 (PAM 확장)", "4.0": "HWE.3.BP5" },
  REVIEW: { "3.1": "GP 2.2.4 (13-19)", "4.0": "GP 2.2.4 · 13-52" },
};
export const bpLabel = (key, version) => versionsOf(version).map(v => `${v}: ${(BP[key] || {})[v] || "-"}`).join(" / ");

export function checkConsistency(model) {
  const m = normalizeModel(model);
  const F = [];
  const add = (sev, bp, msg, ids = []) => F.push({ sev, bp, msg, ids: ids.slice(0, 30), count: ids.length });
  const scope = m.scope;
  const sysReq = m.reqs.SYS, sysComp = m.comps.SYS;
  const compIds = lv => new Set((m.comps[lv] || []).map(c => c.id));
  const reqIds = lv => new Set((m.reqs[lv] || []).map(r => r.id));

  if (!sysReq.length) add("error", "SYS_REQ_TRACE", "시스템 요구사항이 없습니다 — 요구사항 AI 작성(SYS.2)을 먼저 확정하세요.");
  const noCrit = sysReq.filter(r => !String(r.verifCriteria || "").trim()).map(r => r.id);
  if (noCrit.length) add("warn", "SYS_VERIF", `검증 기준이 없는 시스템 요구 ${noCrit.length}건`, noCrit);
  const ambiguous = sysReq.filter(r => qualityFlags(r).some(f => f.code === "ambiguous" || f.code === "noQuant")).map(r => r.id);
  if (ambiguous.length) add("warn", "SYS_VERIF", `모호어·정량 기준 미흡 시스템 요구 ${ambiguous.length}건`, ambiguous);
  const noSrc = sysReq.filter(r => !String(r.source || "").trim()).map(r => r.id);
  if (noSrc.length) add("info", "SYS_REQ_TRACE", `출처(이해관계자 요구) 미기재 시스템 요구 ${noSrc.length}건`, noSrc);

  // 시스템 아키텍처
  if (sysReq.length && !sysComp.length) add("error", "SYS_ALLOC", "시스템 요소가 정의되지 않았습니다 (SYS.3).");
  if (sysComp.length) {
    const ci = compIds("SYS");
    const unalloc = sysReq.filter(r => !(m.alloc.SYS[r.id] || []).some(c => ci.has(c))).map(r => r.id);
    if (unalloc.length) add("error", "SYS_ALLOC", `요소에 할당되지 않은 시스템 요구 ${unalloc.length}건`, unalloc);
    const used = new Set(Object.values(m.alloc.SYS).flat());
    const orphan = sysComp.filter(c => !used.has(c.id) && c.kind !== "외부").map(c => c.id);
    if (orphan.length) add("warn", "SYS_ALLOC", `할당된 요구가 없는 시스템 요소 ${orphan.length}건 (불필요 요소 또는 누락 요구 확인)`, orphan);
    const badIf = (m.interfaces.SYS || []).filter(i => !ci.has(i.from) || !ci.has(i.to)).map(i => i.id);
    if (badIf.length) add("error", "SYS_IF", `존재하지 않는 요소를 참조하는 인터페이스 ${badIf.length}건`, badIf);
    if (sysComp.length > 1 && !(m.interfaces.SYS || []).length) add("warn", "SYS_IF", "시스템 요소 간 인터페이스가 정의되지 않았습니다.");
    if (!(m.modes || []).length) add("warn", "SYS_DYN", "운영 모드·상태(동적 측면)가 정의되지 않았습니다.");
  }

  // SW / HW 레벨
  [["SW", "SW_TRACE", "SW_ALLOC"], ["HW", "HW_TRACE", "HW_ALLOC"]].forEach(([lv, tk, ak]) => {
    if (!scope[lv]) return;
    const parents = parentsForLevel(m, lv);
    const rs = m.reqs[lv];
    if (parents.length && !rs.length) { add("error", tk, `${lv} 요구사항이 없습니다 — ${lv} 포함 요소에 할당된 시스템 요구 ${parents.length}건을 ${lv} 요구로 파생하세요.`, parents.map(p => p.id)); return; }
    const sysIds = reqIds("SYS");
    const noParent = rs.filter(r => !(r.parents || []).some(p => sysIds.has(p))).map(r => r.id);
    if (noParent.length) add("warn", tk, `상위 시스템 요구로 추적되지 않는 ${lv} 요구 ${noParent.length}건 (파생 근거 기재 필요)`, noParent);
    const covered = new Set(rs.flatMap(r => r.parents || []));
    const uncovered = parents.filter(p => !covered.has(p.id)).map(p => p.id);
    if (uncovered.length) add("error", tk, `${lv} 요구로 파생되지 않은 시스템 요구 ${uncovered.length}건 (${lv} 포함 요소에 할당됨)`, uncovered);
    const inherited = rs.filter(r => /관점 구체화 필요/.test(r.text || "")).map(r => r.id);
    if (inherited.length) add("warn", tk, `상위 요구를 그대로 상속한 ${lv} 요구 ${inherited.length}건 — ${lv} 관점으로 구체화 필요`, inherited);
    const noCrit2 = rs.filter(r => !String(r.verifCriteria || "").trim()).map(r => r.id);
    if (noCrit2.length) add("warn", tk, `검증 기준이 없는 ${lv} 요구 ${noCrit2.length}건`, noCrit2);
    const cs = m.comps[lv];
    if (rs.length && !cs.length) add("error", ak, `${LEVELS[lv].compLabel}가 정의되지 않았습니다 (${LEVELS[lv].archProc}).`);
    if (cs.length) {
      const ci = compIds(lv);
      const ua = rs.filter(r => !(m.alloc[lv][r.id] || []).some(c => ci.has(c))).map(r => r.id);
      if (ua.length) add("error", ak, `${LEVELS[lv].compLabel}에 할당되지 않은 ${lv} 요구 ${ua.length}건`, ua);
      const used = new Set(Object.values(m.alloc[lv]).flat());
      const orphan = cs.filter(c => !used.has(c.id)).map(c => c.id);
      if (orphan.length) add("warn", ak, `할당된 요구가 없는 ${LEVELS[lv].compLabel} ${orphan.length}건`, orphan);
    }
  });

  // 검증 레벨
  Object.entries(TEST_LEVELS).forEach(([L, tl]) => {
    if (!scope[tl.level]) return;
    const ts = m.tests.filter(t => t.level === L);
    const bpk = "T_" + L;
    const targets = tl.targetKind === "req" ? m.reqs[tl.level] : (m.interfaces[tl.level].length ? m.interfaces[tl.level] : m.comps[tl.level]);
    if (!targets.length) return;
    const covered = new Set(ts.flatMap(t => t.targets || []));
    const unc = targets.filter(x => !covered.has(x.id)).map(x => x.id);
    if (unc.length) add(tl.targetKind === "req" ? "error" : "warn", bpk, `${tl.label} 검증 수단이 없는 ${tl.targetKind === "req" ? "요구" : "인터페이스·컴포넌트"} ${unc.length}건`, unc);
    const known = new Set([...targets.map(x => x.id), ...m.comps[tl.level].map(c => c.id)]);
    const dangling = ts.filter(t => !(t.targets || []).some(x => known.has(x))).map(t => t.id);
    if (dangling.length) add("error", bpk, `존재하지 않는 대상을 참조하는 ${tl.label} 검증 수단 ${dangling.length}건`, dangling);
    const noPass = ts.filter(t => !String(t.passCriteria || t.expected || "").trim()).map(t => t.id);
    if (noPass.length) add("warn", bpk, `합격 기준이 없는 ${tl.label} 검증 수단 ${noPass.length}건 (08-60)`, noPass);
  });

  // 리뷰·합의 증적
  const drafts = [...m.reqs.SYS, ...(scope.SW ? m.reqs.SW : []), ...(scope.HW ? m.reqs.HW : [])].filter(r => (r.status || "Draft") === "Draft").length;
  if (drafts) add("info", "REVIEW", `상태가 Draft인 요구 ${drafts}건 — 검토·합의 후 Reviewed/Agreed로 전환하고 검토 기록(QA1102)을 남기세요.`);
  return F;
}

// 커버리지 지표
export function coverageMetrics(model) {
  const m = normalizeModel(model);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const out = {};
  const ci = new Set(m.comps.SYS.map(c => c.id));
  out.sysAlloc = pct(m.reqs.SYS.filter(r => (m.alloc.SYS[r.id] || []).some(c => ci.has(c))).length, m.reqs.SYS.length);
  ["SW", "HW"].forEach(lv => {
    if (!m.scope[lv]) return;
    const parents = parentsForLevel(m, lv);
    const cov = new Set(m.reqs[lv].flatMap(r => r.parents || []));
    out[lv.toLowerCase() + "Derive"] = pct(parents.filter(p => cov.has(p.id)).length, parents.length);
    const lci = new Set(m.comps[lv].map(c => c.id));
    out[lv.toLowerCase() + "Alloc"] = pct(m.reqs[lv].filter(r => (m.alloc[lv][r.id] || []).some(c => lci.has(c))).length, m.reqs[lv].length);
  });
  Object.entries(TEST_LEVELS).forEach(([L, tl]) => {
    if (!m.scope[tl.level]) return;
    const targets = tl.targetKind === "req" ? m.reqs[tl.level] : (m.interfaces[tl.level].length ? m.interfaces[tl.level] : m.comps[tl.level]);
    const cov = new Set(m.tests.filter(t => t.level === L).flatMap(t => t.targets || []));
    out["t" + L] = pct(targets.filter(x => cov.has(x.id)).length, targets.length);
  });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) WP 특성 충족도 — (a) 등록 템플릿 점검 (b) 모델 내용 (c) 입력자료 (d) 수동 판정
//    상태: ok(충족) / input(자료 확보·작성 대기) / gap(누락 TBD) / na(해당 없음)
// ═══════════════════════════════════════════════════════════════════════════
export function modelTextFor(model, group) {
  const m = normalizeModel(model);
  const reqTxt = lv => m.reqs[lv].map(r => `${r.title} ${r.text} ${r.verifCriteria} ${r.type} ${r.source} 우선순위 상태 ${r.parents ? "상위 추적" : ""}`).join("\n");
  const compTxt = lv => m.comps[lv].map(c => `${c.name} ${c.kind} ${c.desc} ${c.behavior || ""} 컴포넌트 element`).join("\n")
    + "\n" + m.interfaces[lv].map(i => `인터페이스 ${i.kind} ${i.signals || ""} ${i.desc || ""}`).join("\n")
    + (Object.keys(m.alloc[lv]).length ? "\n할당 allocation" : "");
  switch (group) {
    case "SYS_RS": return reqTxt("SYS") + (m.reqs.SYS.some(r => r.source) ? "\n출처 추적" : "");
    case "SYS_AD": return compTxt("SYS") + "\n" + m.modes.map(x => `모드 mode ${x.name} ${x.desc} ${x.transition || ""} 천이 transition`).join("\n") + "\n" + (m.rationale.SYS ? `근거 rationale ${m.rationale.SYS}` : "");
    case "SW_RS": return reqTxt("SW");
    case "SW_AD": return compTxt("SW") + "\n" + (m.rationale.SW ? `근거 rationale ${m.rationale.SW}` : "");
    case "HW_RS": return reqTxt("HW");
    case "HW_AD": return compTxt("HW") + "\n" + (m.rationale.HW ? `근거 rationale ${m.rationale.HW}` : "");
    case "VERIF": return m.tests.length ? m.tests.map(t => `${t.title} ${t.technique} ${t.expected} ${t.passCriteria} ${t.regression ? "회귀 regression" : ""}`).join("\n") + "\n검증 수단 테스트 케이스 합격 기준 진입 종료 선택 결과 순서" : "";
    default: return "";
  }
}
export function charStatusList(model, group) {
  const m = normalizeModel(model);
  const list = (WP_CATALOG[group] || []).filter(c => charApplies(c, m.version, group));
  const modelTxt = modelTextFor(m, group);
  const tpl = m.templateChecks[group];
  return list.map(c => {
    const ov = m.charOverride[c.id];
    const byModel = kwHit(modelTxt, c.kw);
    const byTpl = tpl ? !!(tpl.hits || {})[c.id] : null;
    const inputs = INPUT_CHECKLIST.filter(i => i.chars.includes(c.id));
    const haveInput = inputs.some(i => m.inputs[i.id] === "have");
    const allNa = inputs.length > 0 && inputs.every(i => m.inputs[i.id] === "na");
    let state = byModel ? "ok" : haveInput ? "input" : "gap";
    if (c.origin !== "ASPICE" && !haveInput && !byModel) state = "na";
    if (allNa && !byModel) state = "na";
    if (ov && ov.state) state = ov.state;
    return { ...c, source: charSource(c, m.version), state, byModel, byTpl, note: (ov && ov.note) || "", inputs: inputs.map(i => i.id) };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 8) CAN DBC 파서 (결정적) — 메시지·시그널·주기 → 인터페이스·인터페이스 요구사항
// ═══════════════════════════════════════════════════════════════════════════
export function parseDbc(text) {
  const src = String(text || "").replace(/\r/g, "");
  const nodes = [];
  const bu = /^BU_\s*:\s*(.*)$/m.exec(src);
  if (bu) bu[1].trim().split(/\s+/).filter(Boolean).forEach(n => nodes.push(n));
  const msgs = [];
  let cur = null;
  src.split("\n").forEach(line => {
    const bo = /^BO_\s+(\d+)\s+(\w+)\s*:\s*(\d+)\s+(\w+)/.exec(line);
    if (bo) {
      const raw = Number(bo[1]);
      const ext = raw >= 0x80000000;
      cur = { id: ext ? raw - 0x80000000 : raw, ext, name: bo[2], dlc: Number(bo[3]), tx: bo[4], signals: [], cycleMs: null };
      msgs.push(cur); return;
    }
    const sg = /^\s+SG_\s+(\w+)\s*(?:[mM]\d*\s*)?:\s*(\d+)\|(\d+)@([01])([+-])\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)\s*\[\s*([-\d.eE+]+)\s*\|\s*([-\d.eE+]+)\s*\]\s*"([^"]*)"\s*(.*)$/.exec(line);
    if (sg && cur) {
      cur.signals.push({ name: sg[1], start: Number(sg[2]), len: Number(sg[3]), order: sg[4] === "1" ? "Intel" : "Motorola", signed: sg[5] === "-",
        factor: Number(sg[6]), offset: Number(sg[7]), min: Number(sg[8]), max: Number(sg[9]), unit: sg[10], rx: sg[11].split(/[,\s]+/).filter(Boolean) });
      return;
    }
    if (!/^\s/.test(line)) cur = null;
  });
  const byId = Object.fromEntries(msgs.map(x => [x.id + (x.ext ? 0x80000000 : 0), x]));
  const cyc = /BA_\s+"GenMsgCycleTime"\s+BO_\s+(\d+)\s+(\d+)\s*;/g;
  let mm;
  while ((mm = cyc.exec(src))) { const x = byId[Number(mm[1])]; if (x) x.cycleMs = Number(mm[2]); }
  msgs.forEach(x => { if (!nodes.includes(x.tx) && x.tx !== "Vector__XXX") nodes.push(x.tx); });
  return { nodes, messages: msgs };
}

// 자기 노드(ownNode) 기준으로 송신/수신 메시지 → 인터페이스 + 인터페이스 요구사항(초안)
export function dbcToInterfaces(parsed, ownNode, opts = {}) {
  const own = String(ownNode || "");
  const relevant = (parsed?.messages || []).filter(x => x.tx === own || x.signals.some(s => s.rx.includes(own)));
  const reqs = [], itfs = [];
  relevant.forEach(x => {
    const isTx = x.tx === own;
    const hex = "0x" + x.id.toString(16).toUpperCase();
    const sigs = (isTx ? x.signals : x.signals.filter(s => s.rx.includes(own)));
    const peer = isTx ? [...new Set(x.signals.flatMap(s => s.rx))].filter(n => n !== own && n !== "Vector__XXX").join(", ") || "수신 노드" : x.tx;
    const sigTxt = sigs.slice(0, 8).map(s => `${s.name}[${s.min}~${s.max}${s.unit ? " " + s.unit : ""}]`).join(", ") + (sigs.length > 8 ? ` 외 ${sigs.length - 8}개` : "");
    const per = x.cycleMs ? `${x.cycleMs} ms 주기로 ` : "";
    reqs.push({
      type: "인터페이스", name: `${x.name}(${hex}) ${isTx ? "송신" : "수신"}`.slice(0, 60), source: `DBC: ${opts.fileName || "통신 DB"}`, priority: "중",
      summary: `시스템은 ${x.name}(${hex}, DLC ${x.dlc}) 메시지를 ${per}${isTx ? `${peer}로 송신` : `${peer}로부터 수신`}해야 한다.`,
      detail: `시그널: ${sigTxt || "-"}`,
      acceptance: x.cycleMs ? `${isTx ? "송신" : "수신"} 주기 ${x.cycleMs} ms, 시그널 값·범위가 통신 DB 정의와 일치` : "시그널 값·범위가 통신 DB 정의와 일치",
      quality: "", assumptions: x.cycleMs ? "" : "주기 정보가 DBC에 없음 — 통신 사양 확인 필요", wbsNo: "공통",
      actors: "", basicFlow: "", subFlow: "", exceptionFlow: "", precondition: "", postcondition: "",
      _dbc: { msg: x.name, id: hex, tx: isTx },
    });
    itfs.push({ kind: "CAN", msg: x.name, msgId: hex, dir: isTx ? "TX" : "RX", peer, periodMs: x.cycleMs || "", signals: sigTxt, dlc: x.dlc });
  });
  return { reqs, itfs };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9) AI 프롬프트 빌더 — 호출은 App.jsx(callClaudeJson)가 수행. 청크 단위로 Vercel 10초 제한 대응
// ═══════════════════════════════════════════════════════════════════════════
export const AI_FIDELITY = "원문 충실성: 입력에 없는 수치(시간·전압·전류·주기·온도)·메시지 ID·부품 번호·ASIL 등급을 새로 만들지 말 것. 근거가 없으면 'TBD(원문 확인 필요)'로 표기. 모든 문자열은 줄바꿈 없이 한 문단.";
const short = (s, n) => String(s || "").replace(/\s+/g, " ").slice(0, n);

export function promptSysArch({ form, reqs, version, guideBlock = "" }) {
  return `당신은 Automotive SPICE ${version === "3.1" ? "3.1" : "4.0"} SYS.3(시스템 아키텍처 설계)에 정통한 차량 전장 시스템 엔지니어입니다.
아래 시스템 요구사항을 만족하는 시스템 아키텍처의 정적·동적 측면 초안을 작성하세요.
제품: ${form?.name || ""} / 고객사: ${form?.client || ""} / 시스템명: ${form?.systemName || ""}
규칙: 시스템 요소는 물리·논리 단위(예: MCU, 전원부, 센서 입력부, 구동부, 통신부, SW 로직, 하우징)로 4~12개. kind는 HW|SW|HW+SW|ME|외부 중 하나(외부=시스템 경계 밖 상대 ECU·센서).
인터페이스는 요소 간 신호·버스·전원·기계 연결을 from/to 요소명으로. 운영 모드는 startup·normal·sleep·shutdown·diagnosis·fault 등 요구에 근거한 것만.
응답 분량 제한(서버 시간 제한 대응): 요소 최대 10개, 인터페이스 최대 15건, 모드 최대 6개, desc·behavior·signals는 각 30자 이내. rationale은 이 구조를 택한 근거 2~3문장. ${AI_FIDELITY}
JSON만 출력: {"elements":[{"name":"","kind":"HW+SW","desc":"책임 1문장","behavior":"거동 1문장"}],"interfaces":[{"from":"요소명","to":"요소명","kind":"CAN|LIN|SPI|PWM|아날로그|디지털 I/O|전원|기계|내부 SW","signals":"주요 신호","desc":""}],"modes":[{"name":"","desc":"","transition":"진입/이탈 조건"}],"rationale":""}
${guideBlock}--- 시스템 요구사항 ---
${JSON.stringify(reqs.slice(0, 60).map(r => ({ id: r.id, type: r.type, t: short(r.title, 40), d: short(r.text, 90) })))}`;
}
export function promptAllocate({ level, reqs, comps }) {
  const L = LEVELS[level];
  return `당신은 Automotive SPICE ${L.archProc} 할당 전문가입니다. 각 ${level === "SYS" ? "시스템" : level} 요구를 만족하는 ${L.compLabel}(1~3개)에 할당하세요.
규칙: 반드시 아래 목록의 id만 사용. 전원·환경·신뢰성처럼 전체에 걸친 요구는 관련 요소 모두에 할당.
JSON만 출력: {"items":[{"id":"요구 id","comps":["요소 id"]}]}
${L.compLabel} 목록: ${JSON.stringify(comps.map(c => ({ id: c.id, name: c.name, kind: c.kind, desc: short(c.desc, 50) })))}
--- 요구 ---
${JSON.stringify(reqs.map(r => ({ id: r.id, t: short(r.title, 40), d: short(r.text, 80) })))}`;
}
export function promptDerive({ level, parents, sysCompName, version }) {
  const L = LEVELS[level];
  const hw = level === "HW";
  return `당신은 Automotive SPICE ${version === "3.1" && hw ? "4.0 HWE.1(3.1 PAM 확장 준용)" : L.reqProc}(${level} 요구사항 분석)에 정통한 차량 전장 ${hw ? "HW" : "SW"} 엔지니어입니다.
아래 시스템 요구를 ${hw ? "하드웨어" : "소프트웨어"} 관점의 검증 가능한 요구로 파생하세요. 상위 요구 1건당 1~3건.
${hw ? "HW 관점: 회로 기능 거동·전압/전류·소비전력·온도·신호 지연·필터·파워 시퀀스·연산 자원 등." : "SW 관점: 입력 신호·처리 로직·출력·타이밍·상태·오류 처리·진단·자원."}
블랙박스 관점으로 작성하고 구현 결정(함수명·변수명)은 쓰지 말 것. verifCriteria는 측정 가능한 기준 1문장.
${AI_FIDELITY}
JSON만 출력: {"items":[{"parent":"상위 id","title":"25자 이내","text":"~해야 한다 1~2문장","type":"기능|비기능|인터페이스","verifCriteria":""}]}
--- 시스템 요구 (할당 요소) ---
${JSON.stringify(parents.map(p => ({ id: p.id, type: p.type, t: short(p.title, 40), d: short(p.text, 110), crit: short(p.verifCriteria, 70), elems: (p.elems || []).map(e => sysCompName[e] || e) })))}`;
}
export function promptComponents({ level, reqs, sysElems, version }) {
  const L = LEVELS[level];
  const hw = level === "HW";
  return `당신은 Automotive SPICE ${hw ? (version === "3.1" ? "4.0 HWE.2(PAM 확장 준용)" : "HWE.2") : "SWE.2"} ${hw ? "HW 아키텍처" : "SW 아키텍처"} 설계 전문가입니다.
아래 ${level} 요구를 만족하는 ${L.compLabel}를 3~10개로 정의하고 컴포넌트 간 인터페이스를 작성하세요.
kind 후보: ${COMP_KINDS[level].join("|")}. ${hw ? "전원·클럭·입력 회로·구동 회로·통신 트랜시버 등 회로 블록 단위." : "애플리케이션 SWC·BSW/플랫폼·진단·통신·모드 관리 등. 외부 공급/자동 생성 코드는 kind로 구분."}
sysElem은 아래 시스템 요소 id 중 구현 대상. 응답 분량 제한: 컴포넌트 최대 10개, 인터페이스 최대 15건, 설명류는 각 30자 이내. rationale은 구조 선정 근거 2문장. ${AI_FIDELITY}
JSON만 출력: {"components":[{"name":"","kind":"","desc":"책임 1문장","behavior":"동적 거동 1문장","sysElem":"SYE-..."}],"interfaces":[{"from":"컴포넌트명","to":"컴포넌트명","kind":"${hw ? "전기 신호|전원|버스" : "API|RTE 포트|공유 데이터|콜백"}","signals":"","desc":""}],"rationale":""}
시스템 요소: ${JSON.stringify(sysElems.map(e => ({ id: e.id, name: e.name, kind: e.kind })))}
--- ${level} 요구 ---
${JSON.stringify(reqs.slice(0, 60).map(r => ({ id: r.id, t: short(r.title, 40), d: short(r.text, 80) })))}`;
}
export function promptTests({ testLevel, reqs, version }) {
  const tl = TEST_LEVELS[testLevel];
  const term = version === "3.1" ? "테스트 케이스(08-50)" : version === "4.0" ? "검증 수단(08-60)" : "검증 수단(4.0 08-60 / 3.1 08-50)";
  return `당신은 Automotive SPICE ${tl.proc} ${tl.label} 전문가입니다. 각 요구의 정상 동작 ${term}를 1건씩 작성하세요.
(경계값·결함주입 케이스는 규칙 엔진이 별도로 생성하므로 정상 시나리오만.) steps는 3~5단계를 '; '로 구분. passCriteria는 판정 가능한 기준.
${AI_FIDELITY}
JSON만 출력: {"items":[{"target":"요구 id","title":"30자 이내","precondition":"","steps":"","expected":"","passCriteria":"","env":"HILS|벤치|실차|챔버|시뮬레이션 중 해당"}]}
--- 요구 ---
${JSON.stringify(reqs.map(r => ({ id: r.id, t: short(r.title, 40), d: short(r.text, 110), crit: short(r.verifCriteria, 80) })))}`;
}

// AI 응답 → 모델 반영 헬퍼 (이름 → id 해석)
export function applyArchResult(level, res, prevComps = []) {
  const prefix = LEVELS[level].compPrefix;
  const comps = [];
  const list = Array.isArray(res?.elements) ? res.elements : Array.isArray(res?.components) ? res.components : [];
  list.slice(0, 14).forEach(e => {
    const name = String(e?.name || "").trim(); if (!name) return;
    if (comps.some(c => c.name === name)) return;
    const prev = prevComps.find(p => p.name === name);
    comps.push({ id: prev?.id || nextId(prefix, comps.concat(prevComps)), name: name.slice(0, 40),
      kind: COMP_KINDS[level].includes(e.kind) ? e.kind : COMP_KINDS[level][level === "SYS" ? 2 : 0],
      desc: String(e.desc || ""), behavior: String(e.behavior || ""), sysElem: e.sysElem || "", origin: "ai" });
  });
  const byName = Object.fromEntries(comps.map(c => [c.name, c.id]));
  const ifPrefix = level === "SYS" ? "SIF-" : level === "SW" ? "SWIF-" : "HWIF-";
  const interfaces = [];
  (Array.isArray(res?.interfaces) ? res.interfaces : []).slice(0, 40).forEach(i => {
    const from = byName[String(i?.from || "").trim()], to = byName[String(i?.to || "").trim()];
    if (!from || !to || from === to) return;
    interfaces.push({ id: nextId(ifPrefix, interfaces), from, to, kind: String(i.kind || ""), signals: String(i.signals || ""), desc: String(i.desc || ""), periodMs: "", origin: "ai" });
  });
  const modes = (Array.isArray(res?.modes) ? res.modes : []).slice(0, 12).map(x => ({ name: String(x?.name || ""), desc: String(x?.desc || ""), transition: String(x?.transition || "") })).filter(x => x.name);
  return { comps, interfaces, modes, rationale: String(res?.rationale || "") };
}
