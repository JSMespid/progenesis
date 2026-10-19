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
  "SWE.3": { "3.1": "Software Detailed Design and Unit Construction", "4.0": "Software Detailed Design and Unit Construction" },
  "SWE.4": { "3.1": "Software Unit Verification", "4.0": "Software Unit Verification" },
  "SYS.1": { "3.1": "Requirements Elicitation", "4.0": "Requirements Elicitation" },
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
  SWE4: { proc: "SWE.4", level: "SW",  targetKind: "unit", label: "SW 유닛 검증", prefix: "SWUT-" },
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
  V_HWE4: { title: "HW 요구사항 검증 명세서", proc: "HWE.4", test: "HWE4", wp: { "3.1": "PAM 확장(4.0 HWE.4 준용)", "4.0": "08-60, 08-58" }, code: "HW5102" },
  V_HWE3: { title: "HW 설계 검증 명세서", proc: "HWE.3", test: "HWE3", wp: { "3.1": "PAM 확장(4.0 HWE.3 준용)", "4.0": "08-60, 08-58" }, code: "HW5101" },
  R_SYS5: { title: "시스템 검증 결과서", proc: "SYS.5", test: "SYS5", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SY6102" },
  R_SYS4: { title: "시스템 통합 검증 결과서", proc: "SYS.4", test: "SYS4", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SY6101" },
  R_SWE6: { title: "SW 검증 결과서", proc: "SWE.6", test: "SWE6", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SW5102" },
  R_SWE5: { title: "SW 통합 검증 결과서", proc: "SWE.5", test: "SWE5", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SW5101" },
  STK_LIST: { title: "이해관계자 요구사항 목록", proc: "SYS.1", wp: { "3.1": "17-03", "4.0": "17-00, 17-54" }, code: "SY2101" },
  SW_DD:  { title: "SW 상세설계서", proc: "SWE.3", wp: { "3.1": "04-05, 11-05", "4.0": "04-05, 15-51" }, code: "SW4101" },
  V_SWE4: { title: "SW 유닛 검증 명세서", proc: "SWE.4", test: "SWE4", wp: { "3.1": "08-50, 08-52", "4.0": "08-60, 08-58" }, code: "SW4103" },
  R_SWE4: { title: "SW 유닛 검증 결과서", proc: "SWE.4", test: "SWE4", result: true, wp: { "3.1": "13-50", "4.0": "15-52, 03-50" }, code: "SW4106" },
  R_HWE3: { title: "HW 설계 검증 결과서", proc: "HWE.3", test: "HWE3", result: true, wp: { "3.1": "PAM 확장(4.0 HWE.3 준용)", "4.0": "15-52, 03-50" }, code: "HW6101" },
  R_HWE4: { title: "HW 요구사항 검증 결과서", proc: "HWE.4", test: "HWE4", result: true, wp: { "3.1": "PAM 확장(4.0 HWE.4 준용)", "4.0": "15-52, 03-50" }, code: "HW6102" },
  RTM:    { title: "요구사항 추적 매트릭스", proc: "SYS.2~SWE.6", wp: { "3.1": "13-22", "4.0": "13-51" }, code: "SY2105" },
};
// HW 레벨 문서 종류 — OSSP 라이브러리에 HW 템플릿이 없어도 V-모델 추적 모델에서 구조화된 문서(근거 없는 칸은 TBD)를 만든다
export const HW_DOC_KINDS = ["HW_RS", "HW_AD", "V_HWE3", "V_HWE4", "R_HWE3", "R_HWE4"];
export function wpLabel(docKind, version) {
  const d = ASPICE_DOCS[docKind]; if (!d) return "";
  return versionsOf(version).map(v => `${v}: ${d.wp[v]}`).join(" / ");
}

// 산출물명 → 문서 종류 (OSSP 산출물 목록의 이름과 매칭). 생성 불가 산출물(유닛 검증 등)은 null.
export function aspiceDocKind(name) {
  const n = String(name || "").replace(/\s|\(|\)|·|-/g, "").toUpperCase()
    .replace(/소프트웨어/g, "SW").replace(/하드웨어/g, "HW");
  if (!n) return null;
  if (n.includes("이해관계자") && n.includes("요구")) return "STK_LIST";   // SYS.1
  if (n.includes("유닛") || n.includes("단위")) {                          // SWE.3·SWE.4 — 골격(유닛 분해·추적·검증 틀)만 생성, 내용은 코드 확정 후
    if (n.includes("검증") || n.includes("시험") || n.includes("테스트")) return n.includes("결과서") ? "R_SWE4" : "V_SWE4";
    if (n.includes("설계")) return "SW_DD";
    return null;
  }
  if (n.startsWith("SW") && n.includes("상세설계")) return "SW_DD";
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
    if (n.includes("요구사항검증")) return isResult ? "R_HWE4" : isSpec ? "V_HWE4" : null;
    if (n.includes("설계검증")) return isResult ? "R_HWE3" : isSpec ? "V_HWE3" : null;
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
    reqs: { STK: [], SYS: [], SW: [], HW: [] },   // STK = 이해관계자 요구(SYS.1), SYS 요구의 상위
    comps: { SYS: [], SW: [], HW: [] },
    interfaces: { SYS: [], SW: [], HW: [] },
    alloc: { SYS: {}, SW: {}, HW: {} },
    modes: [], rationale: { SYS: "", SW: "", HW: "" },
    tests: [], updatedAt: null,
    linkReview: {}, reqSnaps: {}, reviewLog: [],   // 변경 영향 분석(링크 단위 의심 표시) — 9절
    units: { SW: [] },                              // SWE.3 유닛 골격 — 10절
    aiReview: { runs: [], findings: [], hashes: {} },           // 3단 교차검토(규칙 → 검토 AI 의견 → 사람 판정) — 11절
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
    reqs: { STK: [...((x.reqs || {}).STK || [])], ...lv("reqs") }, comps: lv("comps"), interfaces: lv("interfaces"),
    alloc: { SYS: { ...((x.alloc || {}).SYS || {}) }, SW: { ...((x.alloc || {}).SW || {}) }, HW: { ...((x.alloc || {}).HW || {}) } },
    modes: [...(x.modes || [])], rationale: { ...e.rationale, ...(x.rationale || {}) },
    tests: [...(x.tests || [])],
    linkReview: { ...(x.linkReview || {}) }, reqSnaps: { ...(x.reqSnaps || {}) }, reviewLog: [...(x.reviewLog || [])],
    units: { SW: [...((x.units || {}).SW || [])] },
    aiReview: { runs: [...((x.aiReview || {}).runs || [])], findings: [...((x.aiReview || {}).findings || [])], hashes: { ...((x.aiReview || {}).hashes || {}) } },
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
      parents: Array.isArray(it.stkIds) ? it.stkIds.filter(Boolean) : (it.stkId ? [it.stkId] : []),   // 이해관계자 요구(STK) 추적
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

// 확정된 이해관계자 요구(requirements.stk.items) → STK 레벨 요구로 동기화 (원문 그대로 — 변경 감지 대상: 제목·내용·유형)
export function syncStkReqs(items, prev) {
  const old = Object.fromEntries((prev || []).map(r => [r.id, r]));
  return (items || []).filter(it => it && it.id).map(it => {
    const o = old[it.id] || {};
    const text = String(it.text || "");
    return { id: it.id, level: "STK", title: String(it.title || text).slice(0, 60), text, type: it.type || "기능",
      source: it.source || "", stakeholder: it.stakeholder || "", status: it.status || "검토 중", verifCriteria: "",
      note: o.note || "" };
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
    } else if (tl.targetKind === "unit") {
      // SWE.4 유닛 검증 골격 — 유닛마다 정적 검증 + 구조적 커버리지 틀 1건. 구체 케이스는 코드 확정 후 작성(TBD)
      ((model.units || {}).SW || []).forEach(u => {
        if (kept.some(t => t.level === L && (t.targets || []).includes(u.id))) return;
        fresh.push({ level: L, targets: [u.id], origin: "rule", regression: false, title: `${u.name} 유닛 검증`,
          technique: "정적 검증(코딩 가이드라인·정적분석) + 유닛 테스트(구조적 커버리지)", precondition: `${u.name} 유닛 구현 완료 · 유닛 테스트 하네스 준비`, env: "",
          steps: `1) 코딩 가이드라인 준수 여부를 정적분석으로 확인한다; 2) 할당 요구(${(u.reqs || []).join(", ") || "-"})별 입력·경계값 케이스를 작성·수행한다 (TBD — 코드 확정 후); 3) 구조적 커버리지를 측정한다`,
          expected: "정적분석 위반 0건(허용 편차는 사유 기록) · 할당 요구 동작 확인", passCriteria: "구조적 커버리지 목표 달성 — 기준 등급 TBD (Statement / Branch / MC/DC 중 프로젝트 기준 선택)" });
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
  CHANGE: { "3.1": "SUP.10 변경 영향 분석 · 추적 일관성", "4.0": "SUP.10 변경 영향 분석 · 추적 일관성" },
  STK_TRACE: { "3.1": "SYS.2.BP6 (이해관계자 요구 ↔ 시스템 요구)", "4.0": "SYS.2.BP5 (이해관계자 요구 ↔ 시스템 요구)" },
  SW_UNIT: { "3.1": "SWE.3.BP1·BP5", "4.0": "SWE.3.BP1·BP3" },
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
    const targets = tl.targetKind === "req" ? m.reqs[tl.level] : tl.targetKind === "unit" ? (m.units.SW || []) : (m.interfaces[tl.level].length ? m.interfaces[tl.level] : m.comps[tl.level]);
    if (!targets.length) return;
    const covered = new Set(ts.flatMap(t => t.targets || []));
    const unc = targets.filter(x => !covered.has(x.id)).map(x => x.id);
    if (unc.length) add(tl.targetKind === "req" ? "error" : "warn", bpk, `${tl.label} 검증 수단이 없는 ${tl.targetKind === "req" ? "요구" : tl.targetKind === "unit" ? "유닛" : "인터페이스·컴포넌트"} ${unc.length}건`, unc);
    const known = new Set([...targets.map(x => x.id), ...m.comps[tl.level].map(c => c.id)]);
    const dangling = ts.filter(t => !(t.targets || []).some(x => known.has(x))).map(t => t.id);
    if (dangling.length) add("error", bpk, `존재하지 않는 대상을 참조하는 ${tl.label} 검증 수단 ${dangling.length}건`, dangling);
    const noPass = ts.filter(t => !String(t.passCriteria || t.expected || "").trim()).map(t => t.id);
    if (noPass.length) add("warn", bpk, `합격 기준이 없는 ${tl.label} 검증 수단 ${noPass.length}건 (08-60)`, noPass);
  });

  // 이해관계자 요구(STK) ↔ 시스템 요구 추적 (SYS.1 → SYS.2)
  if (m.reqs.STK.length) {
    const covStk = new Set(m.reqs.SYS.flatMap(r => r.parents || []));
    const noDerive = m.reqs.STK.filter(k => covStk.has(k.id) ? false : true).map(k => k.id);
    if (noDerive.length) add("warn", "STK_TRACE", `시스템 요구가 도출되지 않은 이해관계자 요구 ${noDerive.length}건 — 분석·합의 후 도출하거나 '해당 없음' 사유 기록`, noDerive);
    const stkIds = new Set(m.reqs.STK.map(k => k.id));
    const noStk = m.reqs.SYS.filter(r => r?.reqClass !== "project" && !(r.parents || []).some(p => stkIds.has(p))).map(r => r.id);
    if (noStk.length) add("info", "STK_TRACE", `근거 이해관계자 요구가 지정되지 않은 시스템 요구 ${noStk.length}건`, noStk);
    const pending = m.reqs.STK.filter(k => k.status !== "합의").length;
    if (pending) add("info", "STK_TRACE", `합의되지 않은 이해관계자 요구 ${pending}건 (합의 상태: 검토 중·보류)`, m.reqs.STK.filter(k => k.status !== "합의").map(k => k.id));
  }
  // SWE.3 유닛 골격 — SW 요구 ↔ 유닛
  if (m.scope.SW && (m.units.SW || []).length) {
    const covU = new Set(m.units.SW.flatMap(u => u.reqs || []));
    const noUnit = m.reqs.SW.filter(r => !covU.has(r.id)).map(r => r.id);
    if (noUnit.length) add("warn", "SW_UNIT", `유닛에 할당되지 않은 SW 요구 ${noUnit.length}건`, noUnit);
    const tbd = m.units.SW.filter(u => u.origin !== "header" && !u.designDone).length;
    if (tbd) add("info", "SW_UNIT", `상세설계 내용이 골격(TBD) 상태인 유닛 ${tbd}건 — 코드·헤더 확정 후 작성`, m.units.SW.filter(u => u.origin !== "header" && !u.designDone).map(u => u.id));
  }
  // 변경 영향 — 상위 요구 변경으로 의심(suspect) 상태가 된 추적 연결 (9절)
  changeFindings(m).forEach(f => F.push(f));

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
  if (m.reqs.STK.length) { const covStk = new Set(m.reqs.SYS.flatMap(r => r.parents || [])); out.stkDerive = pct(m.reqs.STK.filter(k => covStk.has(k.id)).length, m.reqs.STK.length); }
  if (m.scope.SW && (m.units.SW || []).length) { const covU = new Set(m.units.SW.flatMap(u => u.reqs || [])); out.swUnit = pct(m.reqs.SW.filter(r => covU.has(r.id)).length, m.reqs.SW.length); }
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
    const targets = tl.targetKind === "req" ? m.reqs[tl.level] : tl.targetKind === "unit" ? (m.units.SW || []) : (m.interfaces[tl.level].length ? m.interfaces[tl.level] : m.comps[tl.level]);
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


// ═══════════════════════════════════════════════════════════════════════════
// 9) 변경 영향 분석 — 링크 단위 의심(suspect) 표시 (SUP.10 영향 분석 · 양방향 추적 일관성)
//    원칙: 상위 요구의 내용(제목·내용·검증 기준·유형)이 바뀌면 그 요구에서 나가는 추적 연결
//          (요소 할당·하위 요구 파생·검증 수단)을 '변경 검토 필요'로 표시한다.
//          하위 항목은 자동으로 고치지 않는다 — 사람이 유효/무효 판정과 의견을 남겨 해소한다.
//    linkReview[key] = { h: 판정 시점 상위 요구 지문, dh: 판정 시점 하위 항목 지문, state: valid|invalid, note, by: auto|user, at }
//    key = "상위ID>종류>하위ID"   (종류: alloc | derive | verify)
// ═══════════════════════════════════════════════════════════════════════════
export const SUSPECT_FIELDS = [["title", "제목"], ["text", "내용"], ["verifCriteria", "검증 기준"], ["type", "유형"]];
const TEST_HASH_FIELDS = ["title", "precondition", "steps", "expected", "passCriteria"];
const nz = s => String(s ?? "").replace(/\s+/g, " ").trim();
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
export function reqHash(r) { return fnv1a(SUSPECT_FIELDS.map(([k]) => nz(r?.[k])).join("\u241f")); }
function testHash(t) { return fnv1a(TEST_HASH_FIELDS.map(k => nz(t?.[k])).join("\u241f")); }
export function reqSnap(r) { return Object.fromEntries(SUSPECT_FIELDS.map(([k]) => [k, nz(r?.[k])])); }
// 변경 전 스냅샷과 현재 요구를 비교해 바뀐 필드 라벨 목록
export function changedFields(snap, r) {
  if (!snap) return [];
  return SUSPECT_FIELDS.filter(([k]) => nz(snap[k]) !== nz(r?.[k])).map(([, l]) => l);
}
export const LINK_KINDS = { alloc: "요소 할당", derive: "하위 요구 파생", verify: "검증 수단" };
export const LINK_STATES = { valid: "유효", suspect: "변경 검토 필요", invalid: "무효(조치 필요)", orphan: "상위 삭제(고아 연결)", new: "신규", removed: "연결 제거" };

// 모델의 모든 추적 연결 (하위 쪽에서 수집 — 상위가 삭제돼도 연결은 남아 고아로 드러난다)
export function listLinks(model) {
  const m = model;
  const out = [];
  const lvOn = lv => lv === "SYS" || !!(m.scope || {})[lv];
  const reqById = {};
  ["STK", "SYS", "SW", "HW"].forEach(lv => (m.reqs[lv] || []).forEach(r => { reqById[r.id] = { ...r, _lv: lv }; }));
  // 이해관계자 요구(STK) → 시스템 요구 파생 (SYS 요구의 parents)
  if ((m.reqs.STK || []).length) (m.reqs.SYS || []).forEach(r => [...new Set(r.parents || [])].forEach(p =>
    out.push({ key: `${p}>derive>${r.id}`, up: p, kind: "derive", down: r.id, downLevel: "SYS", downTitle: r.title || "", dh: reqHash(r) })));
  ["SYS", "SW", "HW"].forEach(lv => {
    if (!lvOn(lv)) return;
    const comps = Object.fromEntries((m.comps[lv] || []).map(c => [c.id, c]));
    (m.reqs[lv] || []).forEach(r => [...new Set(m.alloc[lv][r.id] || [])].forEach(cid => {
      if (comps[cid]) out.push({ key: `${r.id}>alloc>${cid}`, up: r.id, kind: "alloc", down: cid, downLevel: lv, downTitle: comps[cid].name || "", dh: "" });
    }));
  });
  ["SW", "HW"].forEach(lv => {
    if (!lvOn(lv)) return;
    (m.reqs[lv] || []).forEach(r => [...new Set(r.parents || [])].forEach(p =>
      out.push({ key: `${p}>derive>${r.id}`, up: p, kind: "derive", down: r.id, downLevel: lv, downTitle: r.title || "", dh: reqHash(r) })));
  });
  (m.tests || []).forEach(t => {
    const tl = TEST_LEVELS[t.level];
    if (!tl || tl.targetKind !== "req" || !lvOn(tl.level)) return;
    [...new Set(t.targets || [])].forEach(x =>
      out.push({ key: `${x}>verify>${t.id}`, up: x, kind: "verify", down: t.id, downLevel: tl.level, downTitle: t.title || "", dh: testHash(t) }));
  });
  return { links: out, reqById };
}

// 연결별 상태: valid / suspect / invalid / orphan / new(아직 기준선 없음 — 저장 시 등록)
export function linkStatus(model) {
  const m = normalizeModel(model);
  const { links, reqById } = listLinks(m);
  const lr = m.linkReview;
  const res = links.map(l => {
    const up = reqById[l.up];
    if (!up) return { ...l, state: "orphan" };
    const h = reqHash(up), rec = lr[l.key];
    if (!rec) return { ...l, state: "new", h };
    if (rec.h !== h) return { ...l, state: "suspect", h, rec, downChanged: !!(l.dh && rec.dh && rec.dh !== l.dh), fields: changedFields(m.reqSnaps[rec.h], up) };
    if (rec.state === "invalid") return { ...l, state: "invalid", h, rec };
    return { ...l, state: "valid", h, rec };
  });
  const open = res.filter(x => x.state === "suspect" || x.state === "invalid" || x.state === "orphan");
  const cnt = s => res.filter(x => x.state === s).length;
  return { links: res, reqById, open, suspect: cnt("suspect"), invalid: cnt("invalid"), orphan: cnt("orphan") };
}

function keepSnaps(lr, snaps, reqById, links) {
  const out = {};
  const upOf = Object.fromEntries(links.map(l => [l.key, l.up]));
  Object.entries(lr).forEach(([k, rec]) => {
    if (!rec || out[rec.h]) return;
    if (snaps[rec.h]) { out[rec.h] = snaps[rec.h]; return; }
    const up = reqById[upOf[k]];
    if (up && reqHash(up) === rec.h) out[rec.h] = reqSnap(up);
  });
  return out;
}

// 기준선 등록: 기록이 없는 연결(신규)을 현재 상위 내용으로 '유효' 등록하고, 사라진 연결의 기록은 정리한다.
// ⚠ 상위 요구를 새 내용으로 바꾸기 '전에' 호출해야 변경이 감지된다 (요구사항 확정 저장·V-모델 열기 시점).
export function baselineLinks(model) {
  const m = normalizeModel(model);
  const st = linkStatus(m);
  const keys = new Set(st.links.map(l => l.key));
  const lr = {};
  Object.entries(m.linkReview).forEach(([k, v]) => { if (keys.has(k)) lr[k] = v; });
  const at = new Date().toISOString();
  st.links.forEach(l => { if (l.state === "new") lr[l.key] = { h: l.h, dh: l.dh, state: "valid", by: "auto", at }; });
  return { ...m, linkReview: lr, reqSnaps: keepSnaps(lr, m.reqSnaps, st.reqById, st.links) };
}

// 판정: 유효(영향 없음/하위 반영 완료) 또는 무효(하위 수정 필요). 판정 시점의 상위·하위 지문을 새 기준선으로 기록.
export function resolveLinks(model, keys, state, note = "") {
  const m = normalizeModel(model);
  const st = linkStatus(m);
  const byKey = Object.fromEntries(st.links.map(l => [l.key, l]));
  const at = new Date().toISOString();
  const lr = { ...m.linkReview }, snaps = { ...m.reqSnaps }, log = [...m.reviewLog];
  (keys || []).forEach(k => {
    const l = byKey[k];
    if (!l || l.state === "orphan") return;
    const up = st.reqById[l.up];
    const prev = lr[k];
    const fields = prev && prev.h !== l.h ? changedFields(snaps[prev.h], up) : [];
    lr[k] = { h: l.h, dh: l.dh, state, note: nz(note), by: "user", at };
    snaps[l.h] = reqSnap(up);
    log.push({ at, key: k, up: l.up, kind: l.kind, down: l.down, state, note: nz(note), fields });
  });
  return { ...m, linkReview: lr, reqSnaps: keepSnaps(lr, snaps, st.reqById, st.links), reviewLog: log.slice(-500) };
}

// 연결 제거 (고아 연결 정리 또는 무효 판정 후 연결 자체를 끊을 때)
export function removeLinks(model, keys, note = "") {
  const m = normalizeModel(JSON.parse(JSON.stringify(model)));
  const at = new Date().toISOString();
  (keys || []).forEach(k => {
    const [up, kind, down] = String(k).split(">");
    if (kind === "derive") ["SW", "HW"].forEach(lv => m.reqs[lv].forEach(r => { if (r.id === down) r.parents = (r.parents || []).filter(p => p !== up); }));
    if (kind === "verify") m.tests.forEach(t => { if (t.id === down) t.targets = (t.targets || []).filter(x => x !== up); });
    if (kind === "alloc") ["SYS", "SW", "HW"].forEach(lv => { if (m.alloc[lv][up]) m.alloc[lv][up] = m.alloc[lv][up].filter(c => c !== down); });
    delete m.linkReview[k];
    m.reviewLog.push({ at, key: k, up, kind, down, state: "removed", note: nz(note), fields: [] });
  });
  m.reviewLog = m.reviewLog.slice(-500);
  return m;
}

// 일관성 점검용 변경 영향 항목
export function changeFindings(model) {
  const st = linkStatus(model);
  const F = [];
  const uniq = a => [...new Set(a)];
  const sus = st.links.filter(l => l.state === "suspect");
  if (sus.length) { const ups = uniq(sus.map(l => l.up)); F.push({ sev: "error", bp: "CHANGE", msg: `상위 요구 변경으로 검토가 필요한 추적 연결 ${sus.length}건 (변경된 요구 ${ups.length}건) — '변경 영향 검토'에서 유효/무효 판정`, ids: ups.slice(0, 30), count: ups.length }); }
  const inv = st.links.filter(l => l.state === "invalid");
  if (inv.length) { const ds = uniq(inv.map(l => l.down)); F.push({ sev: "error", bp: "CHANGE", msg: `무효 판정 후 조치되지 않은 추적 연결 ${inv.length}건 — 하위 항목을 수정한 뒤 유효로 전환`, ids: ds.slice(0, 30), count: ds.length }); }
  const orp = st.links.filter(l => l.state === "orphan");
  if (orp.length) { const ds = uniq(orp.map(l => l.down)); F.push({ sev: "error", bp: "CHANGE", msg: `삭제된 상위 요구를 참조하는 추적 연결 ${orp.length}건 (고아 연결) — 연결 제거 또는 상위 재지정 필요`, ids: ds.slice(0, 30), count: ds.length }); }
  return F;
}

// 요구사항 확정 전 미리보기: 지금 확정하면 어떤 연결이 의심·고아가 되는가
export function previewImpact(aspice, items, stkItems) {
  if (!aspice) return null;
  const base = baselineLinks(aspice);
  const next = { ...base, reqs: { ...base.reqs, ...(Array.isArray(stkItems) ? { STK: syncStkReqs(stkItems, base.reqs.STK) } : {}), SYS: syncSysReqs(items, base.reqs.SYS) } };
  const before = Object.fromEntries(linkStatus(base).links.map(l => [l.key, l.state]));
  const st = linkStatus(next);
  // 이번 확정으로 '새로' 의심·고아가 되는 연결만 (이미 미해결인 연결은 제외)
  const sus = st.links.filter(l => l.state === "suspect" && before[l.key] !== "suspect");
  const orp = st.links.filter(l => l.state === "orphan" && before[l.key] !== "orphan");
  return { changedReqs: new Set(sus.map(l => l.up)).size, suspect: sus.length, orphan: orp.length, removedReqs: new Set(orp.map(l => l.up)).size };
}


// ═══════════════════════════════════════════════════════════════════════════
// 10) SWE.3 유닛 골격 — 근거가 있는 부분만 결정적으로 생성
//    · 규칙 골격: SW 컴포넌트에 할당된 SW 요구 → 유닛 1개(요구↔유닛 추적). 알고리즘·동적 동작은 TBD.
//    · 헤더 가져오기: C 헤더(.h)의 함수 원형·자료형·상수를 읽어 유닛 인터페이스를 채운다 (AI 미사용, 코드가 근거).
//    unit = { id, comp, name, desc, reqs:[SW 요구 ID], funcs:[{ret,name,params}], types:[], macros:[{name,value}], origin: rule|header|manual, file, designDone }
// ═══════════════════════════════════════════════════════════════════════════
export const UNIT_PREFIX = "SWU-";
export function ruleUnits(model) {
  const m = normalizeModel(model);
  const keep = (m.units.SW || []).filter(u => u.origin !== "rule");
  const out = [...keep];
  const covered = new Set(keep.flatMap(u => u.reqs || []));
  m.comps.SW.forEach(c => {
    const reqs = m.reqs.SW.filter(r => (m.alloc.SW[r.id] || []).includes(c.id));
    const fn = reqs.filter(r => r.type !== "비기능" && !covered.has(r.id));
    const nf = reqs.filter(r => r.type === "비기능").map(r => r.id);
    if (!reqs.length && !keep.some(u => u.comp === c.id)) {
      out.push({ id: nextId(UNIT_PREFIX, out), comp: c.id, name: `${c.name} 메인`, desc: `[상세설계 TBD] ${c.name}의 기본 유닛 — 할당 요구 없음`, reqs: [], funcs: [], types: [], macros: [], origin: "rule", file: "", designDone: false });
      return;
    }
    fn.forEach(r => {
      out.push({ id: nextId(UNIT_PREFIX, out), comp: c.id, name: r.title || r.id,
        desc: `[상세설계 TBD] ${r.title} 처리 — 할당 요구 ${r.id}${nf.length ? ` · 제약 ${nf.join(", ")}` : ""}. 알고리즘·자료구조·동적 동작은 코드·플랫폼 확정 후 기술`,
        reqs: [r.id, ...nf], funcs: [], types: [], macros: [], origin: "rule", file: "", designDone: false });
    });
  });
  return out;
}
// C 헤더(.h) 해석 — 함수 원형·typedef·#define (주석 제거 후 정규식)
export function parseCHeader(text, fileName) {
  const src = String(text || "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const funcs = [];
  const fre = /(?:^|[;\n}])\s*(?:extern\s+)?(?:static\s+)?(?:inline\s+)?((?:const\s+|unsigned\s+|signed\s+|struct\s+|enum\s+)?[A-Za-z_]\w*(?:\s*\*+)?(?:\s+const)?)\s+\*?\s*([A-Za-z_]\w*)\s*\(([^()]*)\)\s*;/g;
  let mm;
  while ((mm = fre.exec(src))) {
    const ret = mm[1].replace(/\s+/g, " ").trim(), name = mm[2], params = mm[3].replace(/\s+/g, " ").trim();
    if (/^(if|for|while|switch|return|sizeof|typedef)$/.test(name) || /^(typedef|define)$/.test(ret)) continue;
    if (!funcs.some(f => f.name === name)) funcs.push({ ret, name, params: params === "void" ? "" : params });
  }
  const types = [];
  const tre = /typedef\s+(?:struct|enum|union)\s*\w*\s*\{[\s\S]*?\}\s*([A-Za-z_]\w*)\s*;|typedef\s+[^;{]+?\s([A-Za-z_]\w*)\s*;/g;
  while ((mm = tre.exec(src))) { const t = mm[1] || mm[2]; if (t && !types.includes(t)) types.push(t); }
  const macros = [];
  const dre = /^[ \t]*#define[ \t]+([A-Za-z_]\w*)(?:\(([^)]*)\))?[ \t]+([^\n\\]+)/gm;
  while ((mm = dre.exec(String(text || "")))) { if (macros.length < 60) macros.push({ name: mm[1] + (mm[2] !== undefined ? `(${mm[2]})` : ""), value: mm[3].trim() }); }
  const base = String(fileName || "unit.h").replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  return { name: base, file: String(fileName || ""), funcs, types, macros };
}
// 헤더 해석 결과 → 유닛 (같은 파일명 유닛이 있으면 인터페이스만 갱신, 없으면 추가)
export function unitsFromHeader(model, parsed, compId) {
  const m = normalizeModel(model);
  const out = [...(m.units.SW || [])];
  const idx = out.findIndex(u => u.origin === "header" && u.file === parsed.file);
  const base = { comp: compId || "", name: parsed.name, file: parsed.file, origin: "header", designDone: false,
    funcs: parsed.funcs, types: parsed.types, macros: parsed.macros,
    desc: `헤더 파일 ${parsed.file}에서 추출 — 함수 ${parsed.funcs.length}개 · 자료형 ${parsed.types.length}개 · 상수 ${parsed.macros.length}개 (코드가 근거). 동적 동작·알고리즘은 소스 확정 후 기술` };
  if (idx >= 0) out[idx] = { ...out[idx], ...base, reqs: out[idx].reqs || [] };
  else out.push({ id: nextId(UNIT_PREFIX, out), reqs: [], ...base });
  return out;
}


// ═══════════════════════════════════════════════════════════════════════════
// 11) 커버리지 상세 — 각 지표의 비율과 '빠진 항목' 목록 (화면의 "빠짐 N건" 버튼용)
//    항목: { key, group: req|verif, q: 쉬운 질문, sub: 연결·프로세스, pct, missing:[id], total, tab, level?, kind }
// ═══════════════════════════════════════════════════════════════════════════
export function coverageDetail(model) {
  const m = normalizeModel(model);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const out = [];
  const push = (o) => out.push({ ...o, covered: o.total - o.missing.length, pct: pct(o.total - o.missing.length, o.total) });
  if (m.reqs.STK.length) {
    const cov = new Set(m.reqs.SYS.flatMap(r => r.parents || []));
    push({ key: "stkDerive", group: "req", q: "고객(OEM) 요구가 시스템 요구로 분석됐나", sub: "이해관계자 요구 → 시스템 요구 · SYS.1→SYS.2", tab: "req", total: m.reqs.STK.length, missing: m.reqs.STK.filter(k => !cov.has(k.id)).map(k => k.id) });
  }
  const ci = new Set(m.comps.SYS.map(c => c.id));
  const sysP = m.reqs.SYS.filter(r => r?.reqClass !== "project");
  push({ key: "sysAlloc", group: "req", q: "시스템 요구마다 담당 요소가 정해졌나", sub: "시스템 요구 → 시스템 요소 · SYS.3", tab: "SYS", total: sysP.length, missing: sysP.filter(r => !(m.alloc.SYS[r.id] || []).some(c => ci.has(c))).map(r => r.id) });
  ["SW", "HW"].forEach(lv => {
    if (!m.scope[lv]) return;
    const parents = parentsForLevel(m, lv);
    const cov = new Set(m.reqs[lv].flatMap(r => r.parents || []));
    push({ key: lv.toLowerCase() + "Derive", group: "req", q: `${lv} 담당 시스템 요구가 ${lv} 요구로 내려갔나`, sub: `시스템 요구 → ${lv} 요구 · ${LEVELS[lv].reqProc}`, tab: lv, total: parents.length, missing: parents.filter(p => !cov.has(p.id)).map(p => p.id) });
    const lci = new Set(m.comps[lv].map(c => c.id));
    push({ key: lv.toLowerCase() + "Alloc", group: "req", q: `${lv} 요구마다 담당 컴포넌트가 정해졌나`, sub: `${lv} 요구 → ${LEVELS[lv].compLabel} · ${LEVELS[lv].archProc}`, tab: lv, total: m.reqs[lv].length, missing: m.reqs[lv].filter(r => !(m.alloc[lv][r.id] || []).some(c => lci.has(c))).map(r => r.id) });
    if (lv === "SW" && (m.units.SW || []).length) {
      const cu = new Set(m.units.SW.flatMap(u => u.reqs || []));
      push({ key: "swUnit", group: "req", q: "SW 요구가 유닛까지 내려갔나", sub: "SW 요구 → 유닛 · SWE.3", tab: "SW", total: m.reqs.SW.length, missing: m.reqs.SW.filter(r => !cu.has(r.id)).map(r => r.id) });
    }
  });
  // 검증 — V 오른쪽 아래에서 위로 (유닛 → SW → 시스템)
  const ORDER = ["SWE4", "SWE5", "SWE6", "HWE3", "HWE4", "SYS4", "SYS5"];
  ORDER.forEach(L => {
    const tl = TEST_LEVELS[L]; if (!tl || !m.scope[tl.level]) return;
    const targets = tl.targetKind === "req" ? m.reqs[tl.level] : tl.targetKind === "unit" ? (m.units.SW || []) : (m.interfaces[tl.level].length ? m.interfaces[tl.level] : m.comps[tl.level]);
    const cov = new Set(m.tests.filter(t => t.level === L).flatMap(t => t.targets || []));
    const what = tl.targetKind === "req" ? `${LEVELS[tl.level].label} 요구` : tl.targetKind === "unit" ? "SW 유닛" : `${LEVELS[tl.level].label} 통합 인터페이스`;
    push({ key: "t" + L, group: "verif", kind: tl.targetKind, q: `${what}마다 ${tl.targetKind === "if" ? "통합 시험" : "시험"}이 있나`, sub: `${what} → ${tl.label} · ${tl.proc}`, tab: "verif", level: L, total: targets.length, missing: targets.filter(x => !cov.has(x.id)).map(x => x.id) });
  });
  return out;
}


// ═══════════════════════════════════════════════════════════════════════════
// 11) 3단 교차검토 — ① 규칙 검사(checkConsistency·qualityFlags) → ② 검토 AI 의견 → ③ QA 담당자 판정
//  · 검토 AI는 생성 AI와 다른 모델(기본 Gemini)을 /api/review 로 호출한다.
//  · AI 의견도 규칙으로 거른다: 대상 ID·기준 코드·근거 인용(원문 일치)을 검증하고 어긋나면 버린다.
//  · 검토 기준은 버전으로 고정하고, 실행마다 모델·일시·기준 버전을 기록한다(재현성·심사 증적).
//  · 판정(유효·무효·의견)은 사람만 한다. AI 의견 자체는 심사 증적이 아니라 판정 기록이 증적이다.
// ═══════════════════════════════════════════════════════════════════════════
export const REVIEW_CRITERIA_VER = "RC-1.0";
export const REVIEW_CRITERIA_BASIS = "ISO/IEC/IEEE 29148 요구사항 특성 기반";
export const REVIEW_CRITERIA = [
  { code: "AMBIG",    label: "모호성",       desc: "해석이 둘 이상 가능한 표현, 모호어, 정의되지 않은 용어" },
  { code: "VERIF",    label: "검증 가능성",   desc: "합격·불합격을 판정할 정량 기준·조건·허용오차가 없음" },
  { code: "SINGULAR", label: "단일성",       desc: "하나의 요구에 둘 이상의 요구가 결합되어 있음" },
  { code: "COMPLETE", label: "완전성",       desc: "동작 조건·입력 범위·예외·상태(모드) 등 필요한 정보가 빠짐" },
  { code: "CONSIST",  label: "일관성",       desc: "상위 요구 또는 다른 요구와 모순되거나 수치·용어가 불일치" },
  { code: "DESIGN",   label: "구현 중립성",   desc: "무엇(What)이 아니라 구현 해법(How)을 서술함" },
  { code: "FEASIBLE", label: "실현 가능성",   desc: "기술·자원 측면에서 달성 여부가 의심됨" },
];
export const REVIEW_SEV = { major: "중대", minor: "경미", info: "제안" };
export const REVIEW_JUDGE = { valid: "유효 (수정 필요)", invalid: "무효 (지적 부적절)", opinion: "의견 (참고·보류)" };
export const REVIEW_BATCH = 4;   // 한 번에 보내는 요구 수 — Vercel 약 10초 제한 대응

export function reviewSystemPrompt() {
  return "You are an independent quality assurance reviewer for Automotive SPICE work products. " +
    "Review only what is given. Never invent requirement IDs, numbers, or quotes. Respond with valid JSON only, no markdown.";
}

// 검토 대상 요구(batch)와 상위 요구(parents)로 검토 프롬프트를 만든다.
export function promptReview({ level, reqs, parents = [], version = "both" }) {
  const proc = (LEVELS[level] || {}).reqProc || level;
  const crit = REVIEW_CRITERIA.map(c => `- ${c.code}: ${c.label} — ${c.desc}`).join("\n");
  const brief = r => ({ id: r.id, title: nz(r.title), text: nz(r.text), type: r.type || "", verifCriteria: nz(r.verifCriteria), parents: r.parents || [] });
  const usedParents = new Set(reqs.flatMap(r => r.parents || []));
  const par = parents.filter(p => usedParents.has(p.id)).map(p => ({ id: p.id, title: nz(p.title), text: nz(p.text) }));
  return `역할: 당신은 ASPICE ${proc} (${procLabel(proc, version)}) 산출물을 검토하는 독립 품질보증(QA) 검토자입니다.
아래 [검토 대상] 요구사항을 [검토 기준]에 따라 검토하고, 문제가 있는 것만 지적하세요.

[검토 기준] (${REVIEW_CRITERIA_VER}, ${REVIEW_CRITERIA_BASIS})
${crit}

[규칙]
1) id는 반드시 [검토 대상]에 있는 ID만 사용한다. 다른 ID를 만들지 않는다.
2) criterion은 위 기준 코드 중 하나만 쓴다.
3) evidence는 해당 요구의 title·text·verifCriteria에서 그대로 복사한 짧은 구절(30자 이내)이다. 원문에 없는 문구를 쓰지 않는다. 빠진 정보를 지적할 때(COMPLETE·VERIF)는 빈 문자열로 둔다.
4) severity는 major(검증·구현 불가 수준) / minor(수정 권장) / info(개선 제안) 중 하나.
5) 문제가 없는 요구는 지적하지 않는다. 요구 하나당 최대 3건.
6) issue와 suggestion은 한국어 한 문장, 줄바꿈 없이 작성한다. suggestion에 원문에 없는 수치를 확정값처럼 쓰지 말고 필요하면 'TBD(확인 필요)'로 쓴다.
7) CONSIST는 [상위 요구]와 비교해 판단한다.

[상위 요구]
${par.length ? JSON.stringify(par) : "(없음)"}

[검토 대상]
${JSON.stringify(reqs.map(brief))}

[출력 형식] JSON만:
{"findings":[{"id":"","criterion":"AMBIG","severity":"minor","evidence":"","issue":"","suggestion":""}]}`;
}

// 검토 AI 응답 텍스트 → JSON (마크다운 섞임·잘림 방어)
export function parseReviewJson(text) {
  let t = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    const body = t.slice(a, b + 1);
    try { return JSON.parse(body); } catch (_) { /* 아래에서 복구 */ }
    try { return JSON.parse(body.replace(/[\r\n\t]+/g, " ")); } catch (_) { /* 아래에서 복구 */ }
  }
  // 잘린 응답: 완결된 { ... } 객체만 골라 살린다 (중첩 없는 finding 객체 가정)
  const objs = [];
  const re = /\{[^{}]*"id"\s*:[^{}]*\}/g; let mm;
  while ((mm = re.exec(t))) { try { objs.push(JSON.parse(mm[0].replace(/[\r\n\t]+/g, " "))); } catch (_) { /* 버림 */ } }
  if (objs.length) return { findings: objs, _salvaged: true };
  throw new Error("검토 AI 응답을 JSON으로 해석하지 못했습니다.");
}

// AI 의견을 규칙으로 거른다 — kept(채택 후보)와 dropped(버린 이유) 반환
export function validateReview(raw, batch, opts = {}) {
  const byId = Object.fromEntries(batch.map(r => [r.id, r]));
  const codes = new Set((opts.criteria || REVIEW_CRITERIA).map(c => c.code));
  const evOf = opts.evOf || (r => `${r.title} ${r.text} ${r.verifCriteria}`);
  const kept = [], dropped = [], seen = new Set();
  const norm = s => nz(s).replace(/["'“”‘’`]/g, "").toLowerCase();
  (Array.isArray(raw?.findings) ? raw.findings : []).forEach(f => {
    const id = nz(f?.id), crit = nz(f?.criterion).toUpperCase();
    const r = byId[id];
    if (!r) return dropped.push({ id, reason: "검토 대상에 없는 ID" });
    if (!codes.has(crit)) return dropped.push({ id, reason: `알 수 없는 기준(${crit || "없음"})` });
    const issue = nz(f?.issue);
    if (!issue) return dropped.push({ id, reason: "지적 내용 없음" });
    const ev = nz(f?.evidence);
    if (ev && !norm(evOf(r)).includes(norm(ev))) return dropped.push({ id, reason: `근거 인용이 원문과 불일치("${ev.slice(0, 20)}")` });
    const k = `${id}|${crit}|${norm(issue).slice(0, 40)}`;
    if (seen.has(k)) return dropped.push({ id, reason: "중복 지적" });
    seen.add(k);
    const sev = ["major", "minor", "info"].includes(String(f?.severity)) ? f.severity : "minor";
    kept.push({ reqId: id, criterion: crit, severity: sev, evidence: ev, issue, suggestion: nz(f?.suggestion) });
  });
  return { kept, dropped };
}

// 검토 실행 결과를 모델에 반영 — 같은 검토 AI가 다시 검토한 요구의 '미판정' 지적만 교체하고,
// 판정된 지적과 다른 검토 AI(예: Gemini ↔ ChatGPT)의 지적은 보존한다
export function applyReviewRun(model, { level, reviewedIds, kept, meta }) {
  const m = normalizeModel(model);
  const at = meta?.at || new Date().toISOString();
  const prov = meta?.provider || "";
  const itemById = Object.fromEntries(reviewItems(m, level).map(it => [it.id, it]));
  const ids = new Set(reviewedIds);
  const keep = m.aiReview.findings.filter(f => !(f.level === level && ids.has(f.reqId) && !f.judge && (f.provider || "") === prov));
  const judgedKeys = new Set(keep.map(f => f.key));
  const fresh = kept.map(f => ({
    ...f, level, runAt: at, reqHash: itemById[f.reqId]?.hash || "", targetTitle: itemById[f.reqId]?.title || "",
    provider: prov, reviewer: meta?.label || prov, reviewerModel: meta?.model || "",
    key: `${level}|${f.reqId}|${f.criterion}|${fnv1a(f.issue)}|${prov}`,
  })).filter(f => !judgedKeys.has(f.key));
  m.aiReview.findings = [...keep, ...fresh];
  const hk = prov ? `${prov}:${level}` : level;   // 검토 AI별로 '어디까지 검토했는지' 따로 기록
  const hs = { ...((m.aiReview.hashes || {})[hk] || {}) };
  reviewedIds.forEach(id => { if (itemById[id]) hs[id] = itemById[id].hash; });
  m.aiReview.hashes = { ...(m.aiReview.hashes || {}), [hk]: hs };
  m.aiReview.runs = [...m.aiReview.runs, {
    at, level, provider: meta?.provider || "", label: meta?.label || "", model: meta?.model || "",
    criteria: reviewKindOf(level).ver, reviewed: reviewedIds.length, kept: fresh.length, dropped: meta?.dropped || 0,
    failed: meta?.failed || 0, sameAsGenerator: !!meta?.sameAsGenerator,
  }].slice(-30);
  return m;
}

// 사람 판정 — state: valid | invalid | opinion | null(판정 취소)
export function judgeReview(model, keys, state, note = "", by = "user") {
  const m = normalizeModel(model);
  const ks = new Set(keys);
  m.aiReview.findings = m.aiReview.findings.map(f => ks.has(f.key)
    ? { ...f, judge: state ? { state, note: nz(note), by, at: new Date().toISOString() } : null }
    : f);
  return m;
}

// 지적 이후 요구가 바뀌었는지(재검토 필요) 표시
export function reviewView(model) {
  const m = normalizeModel(model);
  const byScope = {};
  const itemOf = (lv, id) => { if (!byScope[lv]) byScope[lv] = Object.fromEntries(reviewItems(m, lv).map(it => [it.id, it])); return byScope[lv][id]; };
  const list = m.aiReview.findings.map(f => {
    const it = itemOf(f.level, f.reqId);
    return { ...f, reqTitle: it?.title || f.targetTitle || "", removed: !it, stale: !!it && f.reqHash !== it.hash };
  });
  const count = (lv) => {
    const xs = list.filter(f => !lv || f.level === lv);
    return { total: xs.length, open: xs.filter(f => !f.judge).length, valid: xs.filter(f => f.judge?.state === "valid").length,
      invalid: xs.filter(f => f.judge?.state === "invalid").length, opinion: xs.filter(f => f.judge?.state === "opinion").length,
      stale: xs.filter(f => f.stale).length };
  };
  const reviewedAt = {};
  m.aiReview.runs.forEach(r => { reviewedAt[r.level] = r.at; });
  return { list, count, runs: m.aiReview.runs, reviewedAt };
}

// 다시 검토할 대상: mode "all" = 전체 / "changed" = 아직 검토하지 않았거나 마지막 검토 이후 내용이 바뀐 요구
export function reviewTargets(model, level, mode = "all", provider = "") {
  const m = normalizeModel(model);
  const items = reviewItems(m, level);
  if (mode === "all") return items;
  const hsAll = m.aiReview.hashes || {};
  const snap = hsAll[provider ? `${provider}:${level}` : level] || {};
  return items.filter(it => snap[it.id] !== it.hash);
}

// ═══════════════════════════════════════════════════════════════════════════
// 11-b) 산출물 전체 교차검토 — 요구(SYS.2·SWE.1·HWE.1) · 아키텍처(SYS.3·SWE.2·HWE.2) · 상세설계(SWE.3) · 검증 명세(SWE.4~6·HWE.3·4·SYS.4·5)
//  · 산출물 종류마다 검토 기준(버전 고정)을 따로 둔다. 요구 기준(RC)을 설계·시험에 쓰면 엉뚱한 지적이 나온다.
//  · 검토 단위(항목)는 모두 ID를 가진다 — 요소·인터페이스·유닛·시험은 자체 ID, 동작 모드는 MODE:모드명, 설계 근거는 RATIONALE-레벨.
//  · 항목 해시로 '검토 이후 내용 변경(재검토 필요)'·'삭제'를 판정한다(요구는 기존 reqHash 그대로 — 저장된 검토 기록 호환).
//  · 검토하지 않는 산출물: 이해관계자 요구 목록(고객 원문 — ① 규칙의 합의 상태로 관리), 검증 결과서(실행 전),
//    추적 매트릭스(① 규칙 검사가 결정론적으로 전수 점검). 화면에 이유를 표시한다.
// ═══════════════════════════════════════════════════════════════════════════
export const REVIEW_KINDS = {
  req: { ver: REVIEW_CRITERIA_VER, basis: REVIEW_CRITERIA_BASIS, criteria: REVIEW_CRITERIA, noun: "요구" },
  arch: { ver: "AC-1.0", basis: "ISO/IEC/IEEE 42010 아키텍처 기술 · ASPICE SYS.3/SWE.2/HWE.2 BP 기반", noun: "설계 항목", criteria: [
    { code: "RESP",      label: "책임 명확성",   desc: "요소의 책임·기능이 모호하거나 다른 요소와 중복·누락됨" },
    { code: "ALLOC",     label: "할당 적합성",   desc: "할당된 요구가 요소의 책임과 맞지 않거나, 책임에 비해 필요한 요구가 할당되지 않은 것으로 보임" },
    { code: "IFDEF",     label: "인터페이스 정의", desc: "인터페이스의 방향·데이터(신호)·주기·프로토콜·범위 등 정의가 빠지거나 불명확함" },
    { code: "DYN",       label: "동적 측면",     desc: "동작 모드·상태 전이·타이밍·거동 기술이 빠지거나 서로 모순됨" },
    { code: "CONSIST",   label: "일관성",       desc: "요소·인터페이스·모드·요구 사이에 명칭·수치·방향이 불일치" },
    { code: "RATIONALE", label: "설계 근거",     desc: "구조 선택의 근거·대안 검토가 없거나 요구와 연결되지 않음" },
    { code: "AMBIG",     label: "모호성",       desc: "해석이 둘 이상 가능한 표현, 정의되지 않은 용어" },
  ] },
  unit: { ver: "DC-1.0", basis: "ASPICE SWE.3 BP(상세설계·유닛 인터페이스·동적 동작) 기반", noun: "유닛", criteria: [
    { code: "RESP",    label: "유닛 책임",     desc: "유닛의 책임이 모호하거나 할당 요구와 맞지 않음" },
    { code: "IFACE",   label: "유닛 인터페이스", desc: "함수 원형·매개변수·반환값·자료형·상수의 의미나 범위가 불명확하거나 할당 요구 처리에 필요한 인터페이스가 없어 보임" },
    { code: "TRACE",   label: "요구 할당",     desc: "할당된 SW 요구와 유닛 내용(이름·설계·인터페이스)이 대응하지 않음" },
    { code: "DESIGN",  label: "설계 기술",     desc: "작성된 알고리즘·자료구조·동적 동작 기술이 구현·검증하기에 불충분하거나 모순됨 (TBD로 계획된 미작성은 제외)" },
    { code: "CONSIST", label: "일관성",       desc: "유닛명·컴포넌트·요구·인터페이스 사이의 명칭·수치 불일치" },
    { code: "AMBIG",   label: "모호성",       desc: "해석이 둘 이상 가능한 표현" },
  ] },
  test: { ver: "TC-1.0", basis: "ISO/IEC/IEEE 29119-3 시험 명세 특성 기반", noun: "시험 항목", criteria: [
    { code: "TARGET",  label: "대상 적합성",   desc: "시험 내용이 대상(요구·인터페이스·유닛)을 실제로 검증하지 않거나 일부만 검증함" },
    { code: "PRECOND", label: "사전조건·환경",  desc: "시험 수행에 필요한 사전조건·환경·입력 데이터가 빠지거나 불명확함" },
    { code: "STEPS",   label: "절차 재현성",   desc: "절차가 모호해 다른 사람이 같은 방법으로 재현할 수 없음" },
    { code: "EXPECT",  label: "판정 가능성",   desc: "기대 결과·합격 기준이 정량적이지 않아 합격·불합격을 판정할 수 없음" },
    { code: "COVER",   label: "케이스 충분성",  desc: "대상 요구에 비해 경계값·예외·고장 상황 등 필요한 케이스가 빠진 것으로 보임" },
    { code: "CONSIST", label: "일관성",       desc: "대상 요구와 수치·조건·용어가 불일치" },
    { code: "TECH",    label: "기법 적합성",   desc: "검증 기법이 대상의 성격(기능·성능·인터페이스·유닛)에 맞지 않음" },
  ] },
};
// 검토 범위 — V-모델 순서(왼쪽 위 → 아래 → 오른쪽 아래 → 위)
export const REVIEW_SCOPES = [
  { key: "SYS",    kind: "req",  lv: "SYS", proc: "SYS.2", doc: "SYS_RS", group: "요구" },
  { key: "AD_SYS", kind: "arch", lv: "SYS", proc: "SYS.3", doc: "SYS_AD", group: "설계" },
  { key: "SW",     kind: "req",  lv: "SW",  proc: "SWE.1", doc: "SW_RS",  group: "요구" },
  { key: "AD_SW",  kind: "arch", lv: "SW",  proc: "SWE.2", doc: "SW_AD",  group: "설계" },
  { key: "DD_SW",  kind: "unit", lv: "SW",  proc: "SWE.3", doc: "SW_DD",  group: "설계" },
  { key: "HW",     kind: "req",  lv: "HW",  proc: "HWE.1", doc: "HW_RS",  group: "요구" },
  { key: "AD_HW",  kind: "arch", lv: "HW",  proc: "HWE.2", doc: "HW_AD",  group: "설계" },
  { key: "T_SWE4", kind: "test", lv: "SW",  proc: "SWE.4", doc: "V_SWE4", group: "검증", test: "SWE4" },
  { key: "T_SWE5", kind: "test", lv: "SW",  proc: "SWE.5", doc: "V_SWE5", group: "검증", test: "SWE5" },
  { key: "T_SWE6", kind: "test", lv: "SW",  proc: "SWE.6", doc: "V_SWE6", group: "검증", test: "SWE6" },
  { key: "T_HWE3", kind: "test", lv: "HW",  proc: "HWE.3", doc: "V_HWE3", group: "검증", test: "HWE3" },
  { key: "T_HWE4", kind: "test", lv: "HW",  proc: "HWE.4", doc: "V_HWE4", group: "검증", test: "HWE4" },
  { key: "T_SYS4", kind: "test", lv: "SYS", proc: "SYS.4", doc: "V_SYS4", group: "검증", test: "SYS4" },
  { key: "T_SYS5", kind: "test", lv: "SYS", proc: "SYS.5", doc: "V_SYS5", group: "검증", test: "SYS5" },
].map(x => ({ ...x, label: ASPICE_DOCS[x.doc].title }));
export const REVIEW_EXCLUDED = [
  { doc: "STK_LIST", why: "고객(OEM) 원문 — 우리가 작성한 산출물이 아니므로 품질 검토 대신 합의 상태를 ① 규칙 검사로 관리" },
  { doc: "RTM", why: "추적 관계는 ① 규칙 검사가 전수·결정론적으로 점검(AI 의견 불필요)" },
  { doc: null, label: "검증 결과서", why: "시험 실행 전에는 결과가 없음 — 실행 결과 기록 후 검토" },
];
export function reviewScope(key) { return REVIEW_SCOPES.find(x => x.key === key) || null; }
export function reviewKindOf(key) { return REVIEW_KINDS[reviewScope(key)?.kind || "req"]; }
// 현재 모델에서 검토할 수 있는 범위 (개발 범위 SW/HW 반영)
export function reviewScopesFor(model) {
  const m = normalizeModel(model);
  return REVIEW_SCOPES.filter(x => x.lv === "SYS" || m.scope[x.lv]);
}

const clip = (s, n = 240) => { const t = nz(s); return t.length > n ? t.slice(0, n) + "…" : t; };
// 검토 단위 항목 — { id, title, hash, body(검토 AI에 보내는 내용), ev(근거 인용 검증용 원문), refs(관련 항목 ID), src }
export function reviewItems(model, key) {
  const S = reviewScope(key); if (!S) return [];
  const m = normalizeModel(model);
  const lv = S.lv;
  if (S.kind === "req") return (m.reqs[lv] || []).map(r => ({ id: r.id, title: nz(r.title), hash: reqHash(r), src: r,
    ev: `${r.title} ${r.text} ${r.verifCriteria}`, refs: r.parents || [] }));
  if (S.kind === "arch") {
    const comps = m.comps[lv] || [], ifs = m.interfaces[lv] || [];
    const nameOf = Object.fromEntries(comps.map(c => [c.id, c.name]));
    const reqsOf = cid => (m.reqs[lv] || []).filter(r => (m.alloc[lv][r.id] || []).includes(cid)).map(r => r.id);
    const out = comps.map(c => {
      const ar = reqsOf(c.id), cif = ifs.filter(i => i.from === c.id || i.to === c.id).map(i => i.id);
      return { id: c.id, title: nz(c.name), hash: fnv1a(JSON.stringify([c.name, c.kind, c.desc, c.behavior, ar])),
        body: { id: c.id, 항목: "요소", 이름: nz(c.name), 구분: nz(c.kind), 책임: nz(c.desc) || "(작성 안 됨)", 거동: nz(c.behavior) || "(작성 안 됨)", 할당요구: ar, 인터페이스: cif },
        ev: `${c.name} ${c.kind} ${c.desc} ${c.behavior}`, refs: ar };
    });
    ifs.forEach(i => out.push({ id: i.id, title: `${nameOf[i.from] || i.from || "?"} → ${nameOf[i.to] || i.to || "?"}`,
      hash: fnv1a(JSON.stringify([i.from, i.to, i.kind, i.signals, i.periodMs, i.desc])),
      body: { id: i.id, 항목: "인터페이스", 송신: `${i.from || ""} ${nameOf[i.from] || ""}`.trim(), 수신: `${i.to || ""} ${nameOf[i.to] || ""}`.trim(), 종류: nz(i.kind), "신호·데이터": nz(i.signals) || "(작성 안 됨)", 주기ms: nz(i.periodMs), 설명: nz(i.desc) },
      ev: `${nameOf[i.from] || ""} ${nameOf[i.to] || ""} ${i.kind} ${i.signals} ${i.periodMs} ${i.desc}`, refs: [] }));
    if (lv === "SYS") m.modes.filter(md => nz(md.name)).forEach(md => out.push({ id: `MODE:${nz(md.name)}`, title: `동작 모드 ${nz(md.name)}`,
      hash: fnv1a(JSON.stringify([md.name, md.desc, md.transition])),
      body: { id: `MODE:${nz(md.name)}`, 항목: "동작 모드", 모드: nz(md.name), 설명: nz(md.desc), "진입·이탈": nz(md.transition) || "(작성 안 됨)" },
      ev: `${md.name} ${md.desc} ${md.transition}`, refs: [] }));
    const rt = nz(m.rationale[lv]);
    out.push({ id: `RATIONALE-${lv}`, title: "아키텍처 분석·설계 근거", hash: fnv1a(rt),
      body: { id: `RATIONALE-${lv}`, 항목: "설계 근거", 내용: rt || "(작성 안 됨)", 요소수: comps.length, 인터페이스수: ifs.length }, ev: rt, refs: [] });
    return out;
  }
  if (S.kind === "unit") {
    const cn = Object.fromEntries((m.comps.SW || []).map(c => [c.id, c.name]));
    return (m.units.SW || []).map(u => {
      const fs = (u.funcs || []).map(f => `${f.ret} ${f.name}(${f.params || ""})`), ms = (u.macros || []).map(x => `${x.name}=${x.value}`);
      return { id: u.id, title: nz(u.name), hash: fnv1a(JSON.stringify([u.name, u.comp, u.desc, u.reqs, u.funcs, u.types, u.macros])),
        body: { id: u.id, 유닛: nz(u.name), 컴포넌트: `${u.comp || ""} ${cn[u.comp] || ""}`.trim() || "(미지정)", 할당요구: u.reqs || [],
          설계: nz(u.desc) || "(작성 안 됨)", 설계상태: u.designDone || u.origin === "header" ? "작성(또는 코드 근거)" : "TBD — 코드 확정 후 작성 예정",
          함수: fs.slice(0, 15), 자료형: (u.types || []).slice(0, 15), 상수: ms.slice(0, 15) },
        ev: `${u.name} ${u.desc} ${fs.join(" ")} ${(u.types || []).join(" ")} ${ms.join(" ")}`, refs: u.reqs || [] };
    });
  }
  // test
  return (m.tests || []).filter(t => t.level === S.test).map(t => ({ id: t.id, title: nz(t.title),
    hash: fnv1a(JSON.stringify([t.title, t.technique, t.precondition, t.env, t.steps, t.expected, t.passCriteria, t.targets])),
    body: { id: t.id, 시험명: nz(t.title), 대상: t.targets || [], 기법: nz(t.technique), 사전조건: nz(t.precondition) || "(작성 안 됨)", 환경: nz(t.env),
      절차: nz(t.steps) || "(작성 안 됨)", 기대결과: nz(t.expected) || "(작성 안 됨)", 합격기준: nz(t.passCriteria) || "(작성 안 됨)" },
    ev: `${t.title} ${t.technique} ${t.precondition} ${t.env} ${t.steps} ${t.expected} ${t.passCriteria}`, refs: t.targets || [] }));
}
// 관련 항목(판단 근거) — 참조 ID를 요구·요소·인터페이스·유닛에서 찾아 짧게 요약
function reviewContext(m, ids) {
  const want = [...new Set(ids)].slice(0, 40);
  if (!want.length) return [];
  const pool = {};
  (m.reqs.STK || []).forEach(r => { pool[r.id] = { id: r.id, 구분: "이해관계자 요구", 내용: clip(r.text) }; });
  ["SYS", "SW", "HW"].forEach(lv => {
    (m.reqs[lv] || []).forEach(r => { pool[r.id] = { id: r.id, 구분: `${LEVELS[lv].label} 요구`, 제목: nz(r.title), 내용: clip(r.text), 검증기준: clip(r.verifCriteria, 160) }; });
    (m.comps[lv] || []).forEach(c => { pool[c.id] = { id: c.id, 구분: LEVELS[lv].compLabel, 이름: nz(c.name), 책임: clip(c.desc, 160) }; });
    (m.interfaces[lv] || []).forEach(i => { pool[i.id] = { id: i.id, 구분: `${LEVELS[lv].label} 인터페이스`, "송신→수신": `${i.from}→${i.to}`, "신호·데이터": clip(i.signals, 160), 주기ms: nz(i.periodMs) }; });
  });
  (m.units.SW || []).forEach(u => { pool[u.id] = { id: u.id, 구분: "SW 유닛", 이름: nz(u.name), 설계: clip(u.desc, 160) }; });
  return want.map(id => pool[id]).filter(Boolean);
}
const KIND_NOTES = {
  arch: "8) 구분이 '외부'인 요소는 시스템 경계 밖 상대이므로 책임 기술이 짧아도 지적하지 않는다. '(작성 안 됨)'은 빠진 정보이므로 해당 기준으로 지적할 수 있다(이때 evidence는 빈 문자열).",
  unit: "8) 설계상태가 'TBD — 코드 확정 후 작성 예정'인 유닛은 알고리즘·자료구조·동적 동작이 아직 없는 것이 계획된 상태이므로 그 누락 자체는 지적하지 않는다(규칙 검사가 관리). 유닛명·컴포넌트·할당 요구·함수 원형·자료형 사이의 불일치와 책임 모호성을 본다.",
  test: "8) 'TBD'로 명시된 부분(예: 코드 확정 후 작성, 기준 등급 TBD)은 계획된 미작성이므로 지적하지 않는다. 시험이 [관련 항목]의 대상을 실제로 검증하는지, 기대 결과·합격 기준으로 합격·불합격을 판정할 수 있는지를 중심으로 본다.",
};
// 검토 프롬프트 — 요구는 기존 프롬프트(promptReview) 그대로, 그 밖의 산출물은 종류별 기준으로
export function reviewPrompt(model, key, batch, version = "both") {
  const S = reviewScope(key), K = reviewKindOf(key);
  const m = normalizeModel(model);
  if (S.kind === "req") {
    const parents = S.lv === "SYS" ? m.reqs.STK : parentsForLevel(m, S.lv);
    return promptReview({ level: S.lv, reqs: batch.map(b => b.src), parents, version });
  }
  const crit = K.criteria.map(c => `- ${c.code}: ${c.label} — ${c.desc}`).join("\n");
  // 관련 항목은 판단 근거일 뿐이므로 길이를 제한한다 — 서버가 프롬프트를 24,000자에서 자르면 [출력 형식]이 잘려 응답 형식이 깨진다
  const ctx = reviewContext(m, batch.flatMap(b => b.refs || []));
  while (ctx.length && JSON.stringify(ctx).length > 9000) ctx.pop();
  return `역할: 당신은 ASPICE ${S.proc} (${procLabel(S.proc, version)}) 산출물 「${S.label}」을 검토하는 독립 품질보증(QA) 검토자입니다.
아래 [검토 대상] ${K.noun}을 [검토 기준]에 따라 검토하고, 문제가 있는 것만 지적하세요.

[검토 기준] (${K.ver}, ${K.basis})
${crit}

[규칙]
1) id는 반드시 [검토 대상]에 있는 ID만 사용한다. [관련 항목]의 ID로 지적하지 않는다. 다른 ID를 만들지 않는다.
2) criterion은 위 기준 코드 중 하나만 쓴다.
3) evidence는 해당 항목의 값에서 그대로 복사한 짧은 구절(30자 이내)이다. 원문에 없는 문구를 쓰지 않는다. 빠진 정보를 지적할 때는 빈 문자열로 둔다.
4) severity는 major(검증·구현 불가 수준) / minor(수정 권장) / info(개선 제안) 중 하나.
5) 문제가 없는 항목은 지적하지 않는다. 항목 하나당 최대 3건.
6) issue와 suggestion은 한국어 한 문장, 줄바꿈 없이 작성한다. suggestion에 원문에 없는 수치를 확정값처럼 쓰지 말고 필요하면 'TBD(확인 필요)'로 쓴다.
7) [관련 항목]은 일관성·적합성 판단의 근거로만 쓴다.
${KIND_NOTES[S.kind] || ""}

[관련 항목]
${ctx.length ? JSON.stringify(ctx) : "(없음)"}

[검토 대상]
${JSON.stringify(batch.map(b => b.body))}

[출력 형식] JSON만:
{"findings":[{"id":"","criterion":"${K.criteria[0].code}","severity":"minor","evidence":"","issue":"","suggestion":""}]}`;
}
// 검토 범위에 맞춘 의견 검증 (대상 ID·기준 코드·근거 인용)
export function validateReviewScope(raw, batch, key) {
  const S = reviewScope(key);
  if (!S || S.kind === "req") return validateReview(raw, batch.map(b => b.src || b));
  return validateReview(raw, batch, { criteria: reviewKindOf(key).criteria, evOf: b => b.ev || "" });
}
// 검토 범위별 현황 — 항목 수 · 현재 내용 기준 검토 완료 수(선택 검토 AI / 아무 검토 AI) · 의견 판정 현황
export function reviewCoverage(model, provider = "") {
  const m = normalizeModel(model);
  const v = reviewView(m);
  const hs = m.aiReview.hashes || {};
  return reviewScopesFor(m).map(S => {
    const items = reviewItems(m, S.key);
    const snaps = Object.entries(hs).filter(([k]) => k === S.key || k.endsWith(`:${S.key}`)).map(([, x]) => x || {});
    const mine = hs[provider ? `${provider}:${S.key}` : S.key] || {};
    const cur = it => snaps.some(sn => sn[it.id] === it.hash);
    const fs = v.list.filter(f => f.level === S.key);
    return { ...S, total: items.length, reviewedAny: items.filter(cur).length, reviewedMine: items.filter(it => mine[it.id] === it.hash).length,
      open: fs.filter(f => !f.judge).length, valid: fs.filter(f => f.judge?.state === "valid").length, stale: fs.filter(f => f.stale || f.removed).length, findings: fs.length };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 11-c) 검토 기준 안내(쉬운 설명·나쁜 예→좋은 예) · 검토 대상 직접 수정
// ═══════════════════════════════════════════════════════════════════════════
export const REVIEW_KIND_ABOUT = {
  req: { what: "요구사항 문장이 제대로 쓰였는지 보는 점검표", std: "ISO/IEC/IEEE 29148은 요구사항 공학 국제표준입니다. '좋은 요구'가 갖춰야 할 특성(모호하지 않음·검증 가능·하나의 요구·빠짐없음·서로 모순 없음·구현 방법이 아닌 목적·실현 가능)을 정해 두었고, 이 점검표는 그 특성을 그대로 옮긴 것입니다." },
  arch: { what: "구조(요소·인터페이스·동작 모드·설계 근거)가 분명한지 보는 점검표", std: "ISO/IEC/IEEE 42010은 아키텍처를 어떻게 기술할지 정한 국제표준이고, ASPICE SYS.3·SWE.2·HWE.2의 BP는 '요소 정의·요구 할당·인터페이스·동적 측면·설계 근거'를 요구합니다. 이 점검표는 두 가지를 합친 것입니다." },
  unit: { what: "SW 유닛의 설계가 할당 요구·인터페이스와 맞는지 보는 점검표", std: "ASPICE SWE.3 BP는 유닛마다 상세설계·인터페이스·동적 동작을 정의하고 요구와 추적하도록 요구합니다. 아직 TBD(코드 확정 후 작성)인 부분은 계획된 미작성이므로 지적하지 않습니다." },
  test: { what: "시험 항목을 다른 사람이 그대로 수행해 같은 판정을 낼 수 있는지 보는 점검표", std: "ISO/IEC/IEEE 29119-3은 시험 문서 국제표준으로, 시험 케이스가 갖춰야 할 요소(시험 대상·사전조건·입력과 절차·기대 결과)를 정해 두었습니다. 이 점검표는 그 요소에 '대상 요구를 실제로 확인하는가'를 더한 것입니다." },
};
const EASY = {
  req: {
    AMBIG:    ["읽는 사람마다 다르게 이해할 수 있는 말이 있나요?", "충분히 빠르게 응답해야 한다", "요청 수신 후 100 ms 이내에 응답해야 한다"],
    VERIF:    ["합격·불합격을 가를 숫자나 조건이 있나요?", "셀 전압을 정확하게 측정한다", "셀 전압을 ±5 mV 이내 오차로 측정한다 (셀 온도 15~45 ℃)"],
    SINGULAR: ["한 문장에 요구가 하나만 들어 있나요?", "셀 전압을 측정하고 CAN으로 전송해야 한다", "① 셀 전압을 측정한다 ② 측정값을 100 ms 주기로 CAN 전송한다 (두 요구로 분리)"],
    COMPLETE: ["언제·어떤 조건에서·예외일 때 어떻게 하는지 빠지지 않았나요?", "밸런싱을 수행한다", "충전 중 셀 간 전압 편차가 30 mV 이상이면 밸런싱을 시작하고 10 mV 이하이면 종료한다"],
    CONSIST:  ["상위 요구나 다른 요구와 숫자·용어가 어긋나지 않나요?", "상위 요구는 ±5 mV인데 이 요구는 ±10 mV를 허용", "상위 요구와 같은 ±5 mV로 맞추거나, 구간별 기준을 상위 요구에서 먼저 정의"],
    DESIGN:   ["'무엇'을 써야 할 요구에 '어떻게(구현 방법)'를 쓰지 않았나요?", "칼만 필터로 SOC를 계산한다", "SOC를 ±3 % 이내로 추정한다 (계산 방법은 설계 단계에서 결정)"],
    FEASIBLE: ["현재 기술·자원으로 정말 달성할 수 있나요?", "96셀 전압을 1 µs 주기로 측정한다", "AFE 사양 범위 안의 주기(예: 100 ms)로 측정한다 — 근거 사양 확인"],
  },
  arch: {
    RESP:      ["요소마다 맡은 일이 분명하고, 두 요소가 같은 일을 하지 않나요?", "책임: 제어", "책임: 96셀 전압 수집과 밸런싱 필요 여부 판정"],
    ALLOC:     ["요구가 그 일을 실제로 맡는 요소에 배정됐나요?", "CAN 송신 요구가 전원부에 할당됨", "CAN 송신 요구를 CAN 통신부에 할당"],
    IFDEF:     ["인터페이스에 누가 → 누구에게, 무엇을, 얼마나 자주 보내는지 적혀 있나요?", "MCU → CAN 통신부: 데이터", "MCU → CAN 통신부: BMS_Status(0x3A0) 셀 전압·온도, 100 ms 주기"],
    DYN:       ["동작 모드·상태 전이·타이밍이 빠지거나 서로 모순되지 않나요?", "sleep 모드: 진입 조건만 있고 이탈 조건 없음", "sleep 이탈: 웨이크업 신호 또는 CAN 활동 감지 시 normal로 전이"],
    CONSIST:   ["요소·인터페이스·모드 사이에 이름이나 숫자가 다르지 않나요?", "normal 모드는 100 ms 수집인데 인터페이스 주기는 200 ms", "수집 주기와 인터페이스 주기를 같은 값으로 맞추거나 차이 이유를 기록"],
    RATIONALE: ["왜 이렇게 나눴는지(대안·선택 이유)가 적혀 있나요?", "3계층 구조로 설계하였다", "3계층 구조 채택 — 측정 주기 100 ms와 저전력 100 µA 요구를 동시에 만족하기 위해 측정부를 분리(대안: 단일 MCU, 전력 요구 불충족)"],
    AMBIG:     ["해석이 둘 이상 가능한 표현이 있나요?", "필요 시 통신한다", "충전 모드 진입 시 VCU와 통신을 시작한다"],
  },
  unit: {
    RESP:    ["유닛 하나가 맡는 일이 분명한가요?", "유닛명: Util — 여러 처리", "유닛명: CellVoltMon — 셀 전압 수집·범위 판정"],
    IFACE:   ["함수의 매개변수·반환값 의미, 범위, 단위가 분명한가요?", "int16 GetVolt(uint8 ch)", "int16 GetVolt(uint8 ch) — ch: 0~95, 반환: mV, 오류 시 −1"],
    TRACE:   ["할당된 요구를 처리할 내용이 유닛에 실제로 있나요?", "밸런싱 요구가 할당됐는데 함수는 온도 읽기뿐", "밸런싱 판정 함수를 추가하거나 요구를 맞는 유닛으로 재할당"],
    DESIGN:  ["작성된 설계가 구현·시험할 만큼 구체적인가요? (TBD는 제외)", "평균을 낸다", "최근 8개 샘플의 이동 평균, 샘플 누락 시 직전값 유지"],
    CONSIST: ["유닛·컴포넌트·요구·함수 사이에 이름이나 숫자가 다르지 않나요?", "요구는 mV인데 함수 설명은 V", "단위를 mV로 통일"],
    AMBIG:   ["해석이 둘 이상 가능한 표현이 있나요?", "적절히 처리한다", "범위 초과 시 DTC 기록 후 직전값 유지"],
  },
  test: {
    TARGET:  ["이 시험이 대상 요구(인터페이스·유닛)를 실제로 확인하나요?", "요구: 200 ms 이내 잠금 해제 / 시험: 해제 여부만 확인", "해제 명령부터 해제 완료까지 시간을 측정해 200 ms 이내인지 확인"],
    PRECOND: ["시작 전 상태·장비·입력이 적혀 있나요?", "정상 상태에서", "SOC 50 %, 셀 온도 25 ℃, CAN 로거 연결, 진단 툴 접속"],
    STEPS:   ["다른 사람이 그대로 따라 해도 같은 결과가 나오나요?", "적절히 전압을 변경한다", "셀 3 전압을 3.0 V에서 2.5 V까지 0.1 V씩 낮추며 각 단계 1 s 유지"],
    EXPECT:  ["기대 결과로 합격·불합격을 판정할 수 있나요?", "정상 동작할 것", "500 ms 이내 DTC B1A01 기록, 밸런싱 정지 플래그 1"],
    COVER:   ["경계값·예외·고장 상황이 빠지지 않았나요?", "15 km/h 요구에 20 km/h 시험 1건뿐", "14 / 15 / 16 km/h 경계값과 차속 신호 끊김 상황 추가"],
    CONSIST: ["요구와 시험의 숫자·조건이 같은가요?", "요구 ±5 mV / 시험 합격 기준 ±10 mV", "합격 기준을 요구와 같은 ±5 mV로"],
    TECH:    ["검증 방법이 대상에 맞나요?", "타이밍 요구를 코드 리뷰로 검증", "타이밍 요구는 계측(로거·오실로스코프)으로 측정"],
  },
};
Object.entries(EASY).forEach(([k, m]) => (REVIEW_KINDS[k]?.criteria || []).forEach(c => { const e = m[c.code]; if (e) Object.assign(c, { easy: e[0], bad: e[1], good: e[2] }); }));
export const REVIEW_SEV_ABOUT = { major: "이대로면 구현하거나 검증할 수 없는 수준", minor: "고치는 것이 좋음", info: "개선 아이디어" };
export const REVIEW_JUDGE_ABOUT = {
  valid: "AI 지적이 맞음 → 산출물을 수정합니다. 수정하면 '수정함 — 재검토로 확인' 상태가 됩니다.",
  invalid: "AI 지적이 틀렸거나 맞지 않음 → 산출물은 그대로 둡니다. 사유를 남겨야 심사 증적이 됩니다.",
  opinion: "지금 판단하기 어렵거나 참고만 함 → 보류 사유를 남깁니다.",
};

// 검토 대상 항목 직접 수정 — 화면에서 고칠 수 있는 필드 정의와 현재 값, 적용
//  · SYS 요구의 제목·내용은 확정 요구(requirements.items)가 원본이므로 화면에서 items를 함께 고친다(sysItem: 표시)
export function reviewEditSpec(model, key, id) {
  const S = reviewScope(key); if (!S) return null;
  const m = normalizeModel(model);
  const lv = S.lv;
  const F = (k, label, rows = 2, extra = {}) => ({ k, label, rows, ...extra });
  if (S.kind === "req") {
    const r = (m.reqs[lv] || []).find(x => x.id === id); if (!r) return null;
    return { tab: lv === "SYS" ? "SYS" : lv, values: { title: r.title || "", text: r.text || "", verifCriteria: r.verifCriteria || "" },
      fields: [F("title", "제목", 1, lv === "SYS" ? { sysItem: "name" } : {}), F("text", "내용", 3, lv === "SYS" ? { sysItem: "detail" } : {}), F("verifCriteria", "검증 기준", 2)] };
  }
  if (S.kind === "arch") {
    if (id === `RATIONALE-${lv}`) return { tab: lv, values: { rationale: m.rationale[lv] || "" }, fields: [F("rationale", "아키텍처 분석·설계 근거", 4)] };
    if (id.startsWith("MODE:")) { const md = m.modes.find(x => `MODE:${nz(x.name)}` === id); if (!md) return null;
      return { tab: "SYS", values: { desc: md.desc || "", transition: md.transition || "" }, fields: [F("desc", "모드 설명", 2), F("transition", "진입·이탈 조건", 2)] }; }
    const c = (m.comps[lv] || []).find(x => x.id === id);
    if (c) return { tab: lv, values: { name: c.name || "", desc: c.desc || "", behavior: c.behavior || "" }, fields: [F("name", "이름", 1), F("desc", "책임", 2), F("behavior", "거동(동적 측면)", 2)] };
    const i = (m.interfaces[lv] || []).find(x => x.id === id);
    if (i) return { tab: lv, values: { kind: i.kind || "", signals: i.signals || "", periodMs: String(i.periodMs ?? ""), desc: i.desc || "" }, fields: [F("kind", "종류", 1), F("signals", "신호·데이터", 2), F("periodMs", "주기(ms)", 1), F("desc", "설명", 2)] };
    return null;
  }
  if (S.kind === "unit") {
    const u = (m.units.SW || []).find(x => x.id === id); if (!u) return null;
    return { tab: "SW", values: { name: u.name || "", desc: u.desc || "" }, fields: [F("name", "유닛명", 1), F("desc", "상세설계(알고리즘·자료구조·동적 동작)", 4)] };
  }
  const t = (m.tests || []).find(x => x.id === id && x.level === S.test); if (!t) return null;
  return { tab: "verif", values: { title: t.title || "", precondition: t.precondition || "", steps: t.steps || "", expected: t.expected || "", passCriteria: t.passCriteria || "" },
    fields: [F("title", "시험명", 1), F("precondition", "사전조건", 2), F("steps", "절차", 3), F("expected", "기대 결과", 2), F("passCriteria", "합격 기준", 2)] };
}
// 수정 적용 (SYS 요구 제목·내용 제외 — 화면이 확정 요구 items로 처리). 수정한 시험은 수동 작성으로 표시해 규칙 재생성 때 덮어쓰지 않는다.
export function applyReviewEdit(model, key, id, patch) {
  const S = reviewScope(key); if (!S) return model;
  const m = normalizeModel(JSON.parse(JSON.stringify(model)));
  const lv = S.lv, p = { ...patch };
  if (S.kind === "req") {
    const i = (m.reqs[lv] || []).findIndex(x => x.id === id); if (i < 0) return m;
    if (lv === "SYS") { delete p.title; delete p.text; if ("verifCriteria" in p) p.verifCriteriaEdited = true; }
    m.reqs[lv][i] = { ...m.reqs[lv][i], ...p };
  } else if (S.kind === "arch") {
    if (id === `RATIONALE-${lv}`) m.rationale[lv] = p.rationale ?? m.rationale[lv];
    else if (id.startsWith("MODE:")) m.modes = m.modes.map(x => `MODE:${nz(x.name)}` === id ? { ...x, ...p } : x);
    else if ((m.comps[lv] || []).some(x => x.id === id)) m.comps[lv] = m.comps[lv].map(x => x.id === id ? { ...x, ...p } : x);
    else m.interfaces[lv] = (m.interfaces[lv] || []).map(x => x.id === id ? { ...x, ...p } : x);
  } else if (S.kind === "unit") {
    m.units.SW = m.units.SW.map(u => u.id === id ? { ...u, ...p, ...("desc" in p ? { designDone: !/TBD/.test(p.desc) } : {}) } : u);
  } else {
    m.tests = m.tests.map(t => t.id === id && t.level === S.test ? { ...t, ...p, origin: "manual" } : t);
  }
  return m;
}
// 현재 내용 그대로(해시 일치) 어느 검토 AI로든 검토된 항목 ID
export function reviewedIds(model, key) {
  const m = normalizeModel(model);
  const snaps = Object.entries(m.aiReview.hashes || {}).filter(([k]) => k === key || k.endsWith(`:${key}`)).map(([, x]) => x || {});
  return new Set(reviewItems(m, key).filter(it => snaps.some(sn => sn[it.id] === it.hash)).map(it => it.id));
}
