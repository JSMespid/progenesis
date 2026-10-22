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
  "SUP.1": { "3.1": "Quality Assurance", "4.0": "Quality Assurance" },
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
  HW_AD:  { title: "HW 아키텍처 설계서", proc: "HWE.2", wp: { "3.1": "PAM 확장(4.0 HWE.2 준용)", "4.0": "04-52, 15-51" }, code: "HW3102" },
  HW_DD:  { title: "HW 상세설계서", proc: "HWE.2", wp: { "3.1": "PAM 확장(4.0 HWE.2 준용)", "4.0": "04-53, 13-51, 13-52" }, code: "HW4101" },
  HW_BOM: { title: "HW 부품 목록(BOM)", proc: "HWE.2", wp: { "3.1": "PAM 확장(4.0 HWE.2 준용)", "4.0": "14-54" }, code: "HW4102" },
  HW_SC:  { title: "HW 특별 특성 목록", proc: "HWE.2", wp: { "3.1": "PAM 확장(4.0 HWE.2 준용)", "4.0": "17-57" }, code: "HW4103" },
  HW_AN:  { title: "HW 설계 분석 결과서", proc: "HWE.2", wp: { "3.1": "PAM 확장(4.0 HWE.2 준용)", "4.0": "15-51" }, code: "HW4104" },
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
export const HW_DOC_KINDS = ["HW_RS", "HW_AD", "HW_DD", "HW_BOM", "HW_SC", "HW_AN", "V_HWE3", "V_HWE4", "R_HWE3", "R_HWE4"];
export const HW_DESIGN_KINDS = ["HW_DD", "HW_BOM", "HW_SC", "HW_AN"];   // HWE.2 회로 설계(hd)가 있어야 내용이 채워지는 문서
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
  if (n.includes("BOM") || n.includes("부품목록") || n.includes("자재명세")) return "HW_BOM";
  if (n.includes("특별특성")) return "HW_SC";
  if (n.startsWith("HW")) {
    if (n.includes("요구사항검증")) return isResult ? "R_HWE4" : isSpec ? "V_HWE4" : null;
    if (n.includes("설계검증")) return isResult ? "R_HWE3" : isSpec ? "V_HWE3" : null;
    if (n.includes("요구사항명세")) return "HW_RS";
    if (n.includes("분석결과") || n.includes("설계분석")) return "HW_AN";
    if (n.includes("상세설계")) return "HW_DD";
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

export const STD_REF_RE = /\b(CISPR|ISO(?:\/IEC|\/SAE)?|IEC|SAE\s?J|UN(?:ECE)?\s?R|ECE\s?R|LV\s?\d|AEC-?Q|MIL-STD|GB\/T|JASO|IEEE|ASPICE|ASIL\s?[A-D]|VDA)\s*-?\s*\d*/i;
export function qualityFlags(req) {
  const text = `${req.title || ""} ${req.text || ""}`;
  const low = text.toLowerCase();
  const flags = [];
  const weak = WEAK_WORDS.filter(w => low.includes(w.toLowerCase()));
  if (weak.length) flags.push({ code: "ambiguous", msg: `모호어: ${weak.slice(0, 3).join(", ")}` });
  if (!String(req.verifCriteria || "").trim()) flags.push({ code: "noCriteria", msg: "검증 기준 없음" });
  // 정량 기준: 제목·내용뿐 아니라 검증 기준의 수치+단위도 인정하고, 규격 참조(CISPR 25 · ISO 26262 · UN R10 · LV124 · AEC-Q100 등)는 그 규격이 기준값을 정하므로 정량으로 본다
  const quantText = `${text} ${req.verifCriteria || ""}`;
  if ((req.type === "비기능" || req.type === "성능") && !new RegExp(NUM_RE.source, "i").test(quantText) && !STD_REF_RE.test(quantText)) flags.push({ code: "noQuant", msg: "정량 기준 없음 — 제목·내용·검증 기준에 수치+단위 또는 적용 규격(예: CISPR 25 Class 3)을 명시" });
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
// 정확도·오차·분해능 절(clause)의 수치는 '입력 조건'이 아니라 허용오차 — 경계값 시험 대상이 아니다.
// 그 절 안의 범위(예: 정확도 ±5 mV (15~45 ℃))는 '운용 조건'으로 표시한다.
const TOL_RE = /정확도|오차|분해능|허용\s*편차|accuracy|tolerance|resolution/i;
function clauseOf(s, idx) {
  const before = s.slice(0, idx), after = s.slice(idx);
  const b = Math.max(...[",", ";", ".", "이며", "하고", "하며", "\n"].map(d => before.lastIndexOf(d)));
  const ends = [",", ";", ". ", "이며", "하고", "하며", "\n"].map(d => after.indexOf(d)).filter(x => x > 0);
  let c = s.slice(b < 0 ? 0 : b, idx + (ends.length ? Math.min(...ends) : after.length));
  // 괄호 안 조건은 괄호 앞 절의 성격을 따른다: "정확도 ±5 mV(셀 온도 15~45 ℃)"
  const open = before.lastIndexOf("("), close = before.lastIndexOf(")");
  if (open > close) c = s.slice(Math.max(0, before.lastIndexOf(",", open) + 1), idx + 1) + c;
  return c;
}
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
    const cond = TOL_RE.test(clauseOf(s, m.index));
    out.push({ kind: cond ? "cond" : "range", min: Math.min(a, b), max: Math.max(a, b), unit, raw: m[0].trim() });
  }
  // 단일 값 + 비교 연산 (앞: ≥ 100ms / 뒤: 100ms 이내)
  const re = new RegExp(NUM_RE.source, "gi");
  while ((m = re.exec(s))) {
    const val = Number(m[1]); const unit = m[2].toLowerCase();
    if (out.some(o => (o.kind === "range" || o.kind === "cond") && o.unit === unit && (o.min === val || o.max === val))) continue;
    const pm = /[±]\s*$|\+\/-\s*$/.test(s.slice(Math.max(0, m.index - 3), m.index));
    // '±500 A 범위'는 측정·입력 범위(-500~+500)
    if (pm && /^\s*(의\s*)?(범위|range)/i.test(s.slice(re.lastIndex, re.lastIndex + 6)) && !TOL_RE.test(clauseOf(s, m.index))) {
      const key = `R${-val}-${val}${unit}`; if (!seen.has(key)) { seen.add(key); out.push({ kind: "range", min: -val, max: val, unit, raw: `±${m[1]} ${m[2]}` }); } continue; }
    // 허용오차(±값, 정확도·오차·분해능 절)는 경계 조건이 아니다
    if (pm || TOL_RE.test(clauseOf(s, m.index))) continue;
    const after = s.slice(re.lastIndex, re.lastIndex + 14);
    const before = s.slice(Math.max(0, m.index - 4), m.index);
    let op = null;
    for (const p of OP_WORDS_AFTER) { if (p.re.test(after)) { op = p.op; break; } }
    if (!op) for (const p of OP_SYMS_AFTER) { if (p.re.test(after)) { op = p.op; break; } }
    // 수치 앞의 기호는 수치가 우변: "HV ≤ 850V" → x ≤ 850
    if (!op) { if (/(≥|>=)\s*$/.test(before)) op = ">="; else if (/(≤|<=)\s*$/.test(before)) op = "<="; else if (/>\s*$/.test(before)) op = ">"; else if (/<\s*$/.test(before)) op = "<"; }
    const key = `S${val}${unit}`;
    const dup = out.findIndex(o => o.kind === "single" && `S${o.value}${o.unit}` === key);
    if (dup >= 0) { if (!out[dup].op && op) { const sy = { ">=": "≥", ">": ">", "<=": "≤", "<": "<" }[op]; out[dup] = { ...out[dup], op, raw: `x ${sy} ${m[1]} ${m[2]}` }; } continue; }
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
// 단위 표기(내부 비교는 소문자) — 시험 문장에는 일반 표기로
const UNIT_DISP = { v: "V", mv: "mV", kv: "kV", a: "A", ma: "mA", ua: "µA", "µa": "µA", w: "W", kw: "kW", hz: "Hz", khz: "kHz", mhz: "MHz", kbps: "kbps", mbps: "Mbps", bps: "bps", kb: "KB", mb: "MB", "°c": "℃", n: "N", nm: "N·m", kpa: "kPa", db: "dB" };
const U = u => UNIT_DISP[String(u || "").toLowerCase()] || u;
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
  // 온도 범위인데 요구 주제가 온도가 아니면 '입력'이 아니라 '운용 조건'
  const subjTemp = /온도|temp/i.test(`${req.title || ""}`);
  bounds.forEach(b => { if (b.kind === "range" && /^(℃|°c|도)$/.test(b.unit) && !subjTemp) b.kind = "cond"; });
  const condSeen = new Set();
  bounds.filter(b => b.kind === "cond").forEach(b => {
    const k = `${b.min}~${b.max}${U(b.unit)}`; if (condSeen.has(k)) return; condSeen.add(k);
    tests.push({ ...base, title: `${name} — 운용 조건 경계 (${b.min}~${b.max} ${U(b.unit)})`, technique: "운용(환경) 조건 경계 시험",
      precondition: `조건(${U(b.unit)})을 정밀 설정할 수 있는 환경(챔버·전원 등)`,
      steps: `1) 조건을 ${b.min} ${U(b.unit)}로 설정한 뒤 요구 '${name}'의 동작·정확도를 확인한다; 2) 조건을 ${b.max} ${U(b.unit)}로 설정한 뒤 같은 확인을 한다`,
      expected: `${b.min} ${U(b.unit)}와 ${b.max} ${U(b.unit)} 두 조건 모두에서 요구(허용오차 포함)를 충족`, passCriteria: "두 조건점 모두 기대 결과와 일치" });
  });
  bounds.filter(b => b.kind === "range" || b.op).forEach(b => {
    const isTime = TIME_UNITS.includes(b.unit);
    if (b.kind === "range") {
      const st = stepOf(b.max, b.unit);
      const pts = [b.min - st, b.min, b.max, b.max + st];
      tests.push({ ...base, title: `${name} — 범위 경계값 (${b.raw})`, technique: "동치분할·경계값 분석",
        precondition: "입력 값을 정밀 인가할 수 있는 계측·시뮬레이션 환경",
        steps: pts.map((p, i) => `${i + 1}) 입력 ${fmt(p, st)} ${U(b.unit)} 인가 후 응답 관측`).join("; "),
        expected: `${fmt(b.min, st)}~${fmt(b.max, st)} ${U(b.unit)} 구간: 요구 동작 수행 / 구간 밖(${fmt(pts[0], st)}, ${fmt(pts[3], st)} ${U(b.unit)}): 요구 동작 미수행 또는 정의된 이탈 처리`,
        passCriteria: "4개 경계점 모두 기대 결과와 일치" });
      return;
    }
    if (isTime && (b.op === "<=" || b.op === "<" || !b.op)) {
      tests.push({ ...base, title: `${name} — 타이밍 측정 (${b.raw})`, technique: "타이밍 측정(반복 측정·최악값)",
        precondition: "타임스탬프 계측 장비(오실로스코프·CAN 로거 등) 준비",
        steps: `1) 트리거 조건을 인가하고 응답까지 시간을 측정한다; 2) 최소 30회 반복 측정한다; 3) 최대값(최악값)을 기록한다`,
        expected: `측정 최대값 ${b.op === "<" ? "<" : "≤"} ${b.value} ${U(b.unit)}`, passCriteria: `전 회차 ${b.op === "<" ? "<" : "≤"} ${b.value} ${U(b.unit)}` });
      return;
    }
    const st = stepOf(b.value, b.unit);
    const pts = [b.value - st, b.value, b.value + st];
    const on = v => b.op === ">=" ? v >= b.value : b.op === ">" ? v > b.value : b.op === "<=" ? v <= b.value : b.op === "<" ? v < b.value : null;
    const exp = pts.map(p => { const r = on(p); return `${fmt(p, st)} ${U(b.unit)}: ${r === null ? "판정 조건 확인 필요" : r ? "조건 충족 → 요구 동작 수행" : "조건 미충족 → 요구 동작 미수행"}`; }).join(" / ");
    tests.push({ ...base, title: `${name} — 경계값 (${b.raw})`, technique: "경계값 분석",
      precondition: "입력 값을 정밀 인가할 수 있는 계측·시뮬레이션 환경",
      steps: pts.map((p, i) => `${i + 1}) 입력 ${fmt(p, st)} ${U(b.unit)} 인가 후 응답 관측`).join("; "),
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

// 회귀 시험 대상 기본값 — 생성 규칙과 같은 기준: 결함 주입·인터페이스 통합 시험은 회귀, 요구 기반은 우선순위 '상'·안전 관련일 때, 유닛·컴포넌트 거동은 아님
export function defaultRegression(model, t) {
  const m = normalizeModel(model); const tl = TEST_LEVELS[t?.level]; if (!tl) return false;
  if (/결함 주입|fault injection/i.test(String(t.technique || ""))) return true;
  if (tl.targetKind === "unit") return false;
  const tg = t.targets || [];
  if (tl.targetKind === "if") return (m.interfaces[tl.level] || []).some(i => tg.includes(i.id));
  return (m.reqs[tl.level] || []).some(r => tg.includes(r.id) && (r.priority === "상" || !!r.safety));
}
// ── 검증 결과 기록 (3.1 13-50 / 4.0 15-52·03-50) — 시험마다 t.result = { state, date, by, config, defect, note, at }, 이전 값은 t.resultLog ──
export const RESULT_STATES = { pass: "Pass", fail: "Fail", blocked: "Blocked", none: "Not executed" };
export const RESULT_KO = { pass: "통과", fail: "불합격", blocked: "수행 불가", none: "미수행" };
export const RESULT_LIST = ["Pass", "Fail", "Not executed", "Blocked"];
export function normResult(v) {
  const s = String(v == null ? "" : v).trim().toLowerCase(); if (!s) return "";
  if (/^(pass|passed|ok|통과|합격|p|o)$/.test(s)) return "pass";
  if (/^(fail|failed|ng|불합격|실패|f|x)$/.test(s)) return "fail";
  if (/block|차단|수행 ?불가|보류/.test(s)) return "blocked";
  if (/not ?executed|미수행|미실시|n\/?a|^-$/.test(s)) return "none";
  return "";
}
export function setTestResults(model, ids, patch) {
  const m = normalizeModel(model); const want = new Set(ids); const at = new Date().toISOString();
  m.tests = m.tests.map(t => { if (!want.has(t.id)) return t;
    const prev = t.result || null; const next = { ...(prev || {}), ...patch, at };
    if (!next.state) return { ...t, result: null, resultLog: prev ? [...(t.resultLog || []), prev].slice(-20) : t.resultLog };
    const changed = prev && prev.state && prev.state !== next.state;
    return { ...t, result: next, resultLog: changed ? [...(t.resultLog || []), prev].slice(-20) : (t.resultLog || []) }; });
  return m;
}
export function resultSummary(tests, utRun = null) {
  const s = { pass: 0, fail: 0, blocked: 0, none: 0, total: (tests || []).length };
  (tests || []).forEach(t => { const st = effectiveResult(t, utRun)?.state || "none"; s[st] = (s[st] || 0) + 1; });
  return s;
}
// 화면 입력 결과가 있으면 그것, 없으면(SWE.4) 호스트 실행 결과
export function effectiveResult(t, utRun) {
  if (t?.result?.state) return { ...t.result, src: "manual" };
  if (utRun && t?.level === "SWE4") { const r = (t.targets || []).map(x => utRun.units?.[x]).find(Boolean); if (r && r.result && r.result !== "Not executed") return { state: r.result === "Pass" ? "pass" : "fail", date: String(r.ranAt || r.at || "").slice(0, 10), by: "SPIDer 호스트 실행(자동)", config: `호스트 SIL · ${r.cc || ""}`.trim(), defect: "", note: `케이스 ${r.pass}/${r.cases} 통과`, src: "auto" }; }
  return null;
}
// 결과 엑셀(결과서·명세서의 결과 열) 가져오기 — rows: [{ id, state, date, by, config, defect, note }]
export function importResultRows(model, rows) {
  let m = normalizeModel(model); const ids = new Set(m.tests.map(t => t.id));
  let updated = 0, unknown = 0, skipped = 0;
  rows.forEach(r => { const id = String(r.id || "").trim(); if (!id) return; if (!ids.has(id)) { unknown++; return; }
    const st = normResult(r.state); if (!st) { skipped++; return; }
    const patch = { state: st }; ["date", "by", "config", "defect", "note"].forEach(k => { if (String(r[k] || "").trim()) patch[k] = String(r[k]).trim().slice(0, 200); });
    // 엑셀에서 날짜로 입력하면 일련번호(예: 46316)로 저장된다 → YYYY-MM-DD
    if (patch.date && /^\d{5}(\.\d+)?$/.test(patch.date)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(patch.date)) * 86400000); patch.date = d.toISOString().slice(0, 10); }
    else if (patch.date) patch.date = patch.date.replace(/[./]/g, "-").replace(/^(\d{4})-(\d)-/, "$1-0$2-").replace(/-(\d)$/, "-0$1");
    m = setTestResults(m, [id], { ...patch, src: "import" }); updated++; });
  return { model: m, updated, unknown, skipped };
}
export const REGRESSION_ABOUT = "회귀 시험 대상 — 설계·코드가 바뀐 뒤 다시 수행할 시험 (3.1 08-50 회귀 전략 / 4.0 08-58 검증 수단 선택 세트). 기본값: 인터페이스 통합·결함 주입 시험은 체크, 요구 기반은 우선순위 '상'·안전 관련일 때 체크, 유닛·컴포넌트 거동 시험은 해제.";
// 인터페이스(요소 간 관계) → 통합 검증 수단 (SYS.4 / SWE.5 / HWE.3)
export function ruleTestsForInterface(itf, testLevel, compName = {}) {
  const from = compName[itf.from] || itf.from || "?";
  const to = compName[itf.to] || itf.to || "?";
  const base = { level: testLevel, targets: [itf.id], origin: "rule", regression: true, env: "" };
  const sig = itf.signals ? ` (${String(itf.signals).slice(0, 60)})` : "";
  // HWE.3(HW 설계 검증): 인터페이스 종류별 전기적 검증 — SW식 '연동·타임아웃' 대신 측정·물리층 시험
  if (testLevel === "HWE3") {
    const k = `${itf.kind || ""} ${itf.signals || ""}`;
    if (/전원|power|supply|vdd|vcc|\d\s*v\b/i.test(k) && !/버스|bus|can|lin|spi|i2c|uart/i.test(itf.kind || "")) return [
      { ...base, title: `${from} → ${to} 전원 품질 (전압 정확도·리플)${sig}`, technique: "측정(전압·리플)", precondition: "정상 부하, 오실로스코프·DMM 준비",
        steps: `1) ${to} 입력단에서 정상 부하 시 전압을 측정한다; 2) 리플·노이즈(peak-to-peak)를 측정한다; 3) 최소·최대 입력 전압 조건에서 반복한다`, expected: "설계 전압·허용 편차·리플 한계 이내", passCriteria: "전 조건에서 설계 사양 이내" },
      { ...base, title: `${from} → ${to} 부하 과도 응답${sig}`, technique: "측정(과도 응답)", precondition: "전자 부하·오실로스코프",
        steps: "1) 부하를 최소↔최대로 계단 변화시킨다; 2) 전압 언더슈트·오버슈트와 회복 시간을 측정한다", expected: "과도 전압이 하위 회로 동작 범위 안에서 회복", passCriteria: "언더·오버슈트와 회복 시간이 설계 기준 이내", regression: false }];
    if (/버스|bus|can|lin|spi|i2c|uart|ethernet/i.test(k)) return [
      { ...base, title: `${from} → ${to} 물리층 파형·타이밍${sig}`, technique: "측정(신호 무결성·타이밍)", precondition: "오실로스코프·프로토콜 분석기",
        steps: "1) 신호 레벨(High/Low)·상승·하강 시간을 측정한다; 2) 셋업·홀드 또는 비트 타이밍을 측정한다; 3) 종단·노이즈를 확인한다", expected: "레벨·타이밍이 부품 데이터시트·버스 규격 이내", passCriteria: "전 항목 규격 이내" },
      { ...base, title: `${from} → ${to} 배선 결함(단선·단락) 주입`, technique: "결함 주입(fault injection)", precondition: "결함 주입 박스(단선·GND/전원 단락)",
        steps: "1) 신호선 단선·GND 단락·전원 단락을 차례로 주입한다; 2) 부품 손상 여부와 보호 동작을 확인한다; 3) 해제 후 정상 동작 복귀를 확인한다", expected: "부품 손상 없음, 결함 해제 후 정상 동작", passCriteria: "손상 없음·복귀 확인" }];
    return [{ ...base, title: `${from} → ${to} 신호 레벨·잡음${sig}`, technique: "측정(신호 레벨·잡음)", precondition: "오실로스코프·신호 발생기",
      steps: `1) ${from} 출력 신호의 레벨·범위를 측정한다; 2) ${to} 입력단에서 잡음·필터 응답을 측정한다; 3) 최소·최대 신호 조건에서 반복한다`, expected: `${to} 입력 허용 범위 안의 신호, 잡음은 설계 한계 이내`, passCriteria: "레벨·잡음이 설계 기준 이내" }];
  }
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
    aiReview: { runs: [], findings: [], hashes: {}, edits: [] }, // 3단 교차검토(규칙 → 검토 AI 의견 → 사람 판정 → 대상 수정 기록) — 11절
  };
}
// 이전 생성본의 클래스명이 한글→"____"로 저장된 경우를 영문 식별자로 복구 (코드 파일명·XMI·다이어그램 공통)
function repairUnitDD(u) {
  const dd = u && u.dd; if (!dd || !Array.isArray(dd.classes) || !dd.classes.length) return u;
  // 영문자 3개 미만이거나 밑줄이 3개 이상 이어지는 이름(한글이 _로 치환된 흔적)은 비정상으로 본다
  const bad = n => !n || n === "Unnamed" || (String(n).match(/[A-Za-z]/g) || []).length < 3 || /_{3,}/.test(n) || /^_{2,}/.test(n);
  if (!dd.classes.some(c => bad(c.name))) return u;
  const base = asciiName(u.name, `Unit_${String(u.id || "").replace(/[^A-Za-z0-9]/g, "_")}`);
  const map = {}; let k = 0;
  const swcBad = bad((dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0]).name);
  const classes = dd.classes.map(c => { if (!bad(c.name)) return c; const nn = c.stereotype === "SWC" || k === 0 ? base : `${base}_C${k}`; k++; map[c.name] = nn; return { ...c, name: nn }; });
  const fix = n => map[n] || n;
  return { ...u, dd: { ...dd, classes, assoc: (dd.assoc || []).map(a => ({ ...a, from: fix(a.from), to: fix(a.to) })),
    sequences: (dd.sequences || []).map(sq => ({ ...sq, lifelines: (sq.lifelines || []).map(fix), steps: (sq.steps || []).map(st => ({ ...st, from: fix(st.from), to: fix(st.to) })) })),
    // 파일명을 정하는 SWC 클래스명이 바뀐 경우에만 기존 코드를 폐기(재생성 대상). 내부 클래스명만 고친 경우 코드는 유지
    code: swcBad ? undefined : dd.code } };
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
    units: { SW: [...((x.units || {}).SW || [])].map(repairUnitDD).map(repairCodeInit) },
    aiReview: { runs: [...((x.aiReview || {}).runs || [])], findings: [...((x.aiReview || {}).findings || [])], hashes: { ...((x.aiReview || {}).hashes || {}) }, edits: [...((x.aiReview || {}).edits || [])] },
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
      status: o.status || "Draft", release: o.release || "", rationale: o.rationale || "",
      ...((o.reqClass || it.reqClass) ? { reqClass: o.reqClass || it.reqClass } : {}) };
    return merged;
  });
}

// 확정된 이해관계자 요구(requirements.stk.items) → STK 레벨 요구로 동기화 (원문 그대로 — 변경 감지 대상: 제목·내용·유형)
// 이해관계자 요구 '해당 없음' — 시스템 요구로 도출하지 않기로 결정하고 사유를 남긴 요구 (사유가 있어야 종결로 인정)
export const stkClosed = k => k?.status === "해당 없음" && !!String(k?.naReason || "").trim();
export function syncStkReqs(items, prev) {
  const old = Object.fromEntries((prev || []).map(r => [r.id, r]));
  return (items || []).filter(it => it && it.id).map(it => {
    const o = old[it.id] || {};
    const text = String(it.text || "");
    return { id: it.id, level: "STK", title: String(it.title || text).slice(0, 60), text, type: it.type || "기능",
      source: it.source || "", stakeholder: it.stakeholder || "", status: it.status || "검토 중", verifCriteria: "",
      naReason: String(it.naReason || ""), note: o.note || "" };
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
  // 다시 만들어도 대상·제목이 같은 시험은 이전 ID·검증 결과·회귀 지정을 이어받는다(교차검토·결과 기록 보존)
  const keyOf = t => `${t.level}|${(t.targets || []).join(",")}|${t.title}`;
  const oldBy = new Map(); (model.tests || []).filter(t => t.origin !== "manual" && levels.includes(t.level)).forEach(o => { if (!oldBy.has(keyOf(o))) oldBy.set(keyOf(o), o); });
  const used = new Set(kept.map(t => t.id));
  const all = [...kept];
  const rest = [];
  fresh.map(({ id, ...t }) => t).forEach(t => { const o = oldBy.get(keyOf(t)); if (o && o.id && !used.has(o.id)) { used.add(o.id); all.push({ ...t, id: o.id, ...(o.result ? { result: o.result } : {}), ...(o.resultLog ? { resultLog: o.resultLog } : {}), regression: o.regression }); } else rest.push(t); });
  // 나머지는 레벨별로 기존 ID와 충돌하지 않게 이어서 채번
  rest.forEach(t => { const p = TEST_LEVELS[t.level].prefix; all.push({ ...t, id: nextId(p, all.filter(x => x.level === t.level), 4) }); });
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
  VERIF_RESULT: { "3.1": "검증 결과 기록 BP (13-50)", "4.0": "검증 결과 기록 BP (15-52)" },
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
    // 버스·직렬 통신 인터페이스는 주기(또는 이벤트 구분)가 있어야 통합 시험(주기·타임아웃 TC)의 근거가 된다
    const noPer = (m.interfaces.SYS || []).filter(i => /CAN|LIN|SPI|UART|I2C|이더넷|ETH|FlexRay/i.test(`${i.kind || ""} ${i.signals || ""}`) && !String(i.periodMs || "").trim() && !/이벤트|event|on.?change|요청 시/i.test(`${i.signals || ""} ${i.desc || ""}`)).map(i => i.id);
    if (noPer.length) add("info", "SYS_IF", `주기(ms)가 없는 통신 인터페이스 ${noPer.length}건 — 주기 통신이면 주기를, 이벤트 통신이면 신호 설명에 '이벤트'를 적으세요 (통합 시험의 주기·타임아웃 근거)`, noPer);
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
    const noDerive = m.reqs.STK.filter(k => !covStk.has(k.id) && !stkClosed(k)).map(k => k.id);
    if (noDerive.length) add("warn", "STK_TRACE", `시스템 요구가 도출되지 않은 이해관계자 요구 ${noDerive.length}건 — 분석·합의 후 도출하거나 '해당 없음' 사유 기록`, noDerive);
    const naNoReason = m.reqs.STK.filter(k => k.status === "해당 없음" && !stkClosed(k)).map(k => k.id);
    if (naNoReason.length) add("warn", "STK_TRACE", `'해당 없음'으로 정했지만 사유가 없는 이해관계자 요구 ${naNoReason.length}건 — 사유를 기록해야 종결로 인정`, naNoReason);
    const naDerived = m.reqs.STK.filter(k => k.status === "해당 없음" && covStk.has(k.id)).map(k => k.id);
    if (naDerived.length) add("warn", "STK_TRACE", `'해당 없음'인데 시스템 요구가 연결된 이해관계자 요구 ${naDerived.length}건 — 처리 구분과 연결 중 하나를 바로잡을 것`, naDerived);
    const na = m.reqs.STK.filter(stkClosed).length;
    if (na) add("info", "STK_TRACE", `'해당 없음'(사유 기록)으로 종결한 이해관계자 요구 ${na}건 — 추적 매트릭스에 사유와 함께 출력`, m.reqs.STK.filter(stkClosed).map(k => k.id));
    const stkIds = new Set(m.reqs.STK.map(k => k.id));
    const noStk = m.reqs.SYS.filter(r => r?.reqClass !== "project" && !(r.parents || []).some(p => stkIds.has(p))).map(r => r.id);
    if (noStk.length) add("info", "STK_TRACE", `근거 이해관계자 요구가 지정되지 않은 시스템 요구 ${noStk.length}건`, noStk);
    const pend = m.reqs.STK.filter(k => k.status !== "합의" && k.status !== "해당 없음");
    if (pend.length) add("info", "STK_TRACE", `합의되지 않은 이해관계자 요구 ${pend.length}건 (합의 상태: 검토 중·보류)`, pend.map(k => k.id));
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
  // 검증 결과 기록 — Fail은 결함(문제) ID로 추적(SUP.9), 결과 없는 시험은 수행 전 상태
  const ut = (typeof utLatest === "function" ? utLatest(m) : null)?.run || null;
  const scopedTests = m.tests.filter(t => TEST_LEVELS[t.level] && m.scope[TEST_LEVELS[t.level].level]);
  const er = scopedTests.map(t => [t, effectiveResult(t, ut)]);
  const failNoDef = er.filter(([, r]) => r?.state === "fail" && r.src !== "auto" && !String(r.defect || "").trim()).map(([t]) => t.id);
  if (failNoDef.length) add("warn", "VERIF_RESULT", `불합격(Fail)인데 결함·문제 ID가 없는 시험 ${failNoDef.length}건 — 문제 보고(SUP.9)를 등록하고 ID를 기록`, failNoDef);
  const blkNoNote = er.filter(([, r]) => r?.state === "blocked" && !String(r.note || "").trim()).map(([t]) => t.id);
  if (blkNoNote.length) add("info", "VERIF_RESULT", `수행 불가(Blocked) 사유가 없는 시험 ${blkNoNote.length}건`, blkNoNote);
  const noRes = er.filter(([, r]) => !r || r.state === "none").map(([t]) => t.id);
  if (scopedTests.length && noRes.length) add("info", "VERIF_RESULT", `검증 결과가 아직 없는 시험 ${noRes.length}건 / ${scopedTests.length}건 — 시험 수행 후 결과를 입력(검증 탭 또는 결과서 엑셀 가져오기)`, noRes);
  return F;
}

// 커버리지 지표
export function coverageMetrics(model) {
  const m = normalizeModel(model);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const out = {};
  const ci = new Set(m.comps.SYS.map(c => c.id));
  out.sysAlloc = pct(m.reqs.SYS.filter(r => (m.alloc.SYS[r.id] || []).some(c => ci.has(c))).length, m.reqs.SYS.length);
  if (m.reqs.STK.length) { const covStk = new Set(m.reqs.SYS.flatMap(r => r.parents || [])); const live = m.reqs.STK.filter(k => !stkClosed(k)); out.stkDerive = pct(live.filter(k => covStk.has(k.id)).length, live.length); }
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
  // 요구 목록 텍스트 + 구조 토큰: 검증 기준·검증 방법이 요구의 80% 이상에 있으면 '적격성(검증) 요구·검증 기준' 특성 충족,
  // 요구 ID·우선순위·상태·출처는 항상 속성으로 기록되므로 토큰 포함, 설계 제약 성격 요구가 있으면 '제약' 토큰
  const reqTxt = lv => { const rs = m.reqs[lv]; if (!rs.length) return "";
    const vc = rs.filter(r => nz(r.verifCriteria)).length / rs.length, vm = rs.filter(r => r.verifMethod).length / rs.length;
    const cons = rs.some(r => /제약|constraint/i.test(`${r.type} ${r.title}`) || qualityFlags(r).some(f => f.code === "design"));
    return rs.map(r => `${r.title} ${r.text} ${r.verifCriteria} ${r.type} ${r.source} ${r.verifMethod || ""} ${r.parents?.length ? "상위 추적 근거" : ""}`).join("\n")
      + "\n요구사항 ID 우선순위 상태 release" + (vc >= 0.8 ? " 검증 기준 검증 방법 합격 기준 verification" : "") + (cons ? " 제약 constraint" : ""); };
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
    // 판정 순서: 모델 내용에 있음 → 충족 / 등록 템플릿에 해당 항목이 있음 → 충족(문서에서 작성되는 항목) / 입력자료 확보 → 대기 / 그 밖에 → 누락
    const byTplOnly = !byModel && byTpl === true;
    let state = byModel || byTplOnly ? "ok" : haveInput ? "input" : "gap";
    if (c.origin !== "ASPICE" && !haveInput && !byModel && !byTplOnly) state = "na";
    if (allNa && !byModel && !byTplOnly) state = "na";
    const manual = !!(ov && ov.state);
    if (manual) state = ov.state;
    return { ...c, source: charSource(c, m.version), state, byModel, byTpl, byTplOnly, manual, note: (ov && ov.note) || "", inputs: inputs.map(i => i.id) };
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
export function promptDerive({ level, parents, sysCompName, version, guideBlock = "" }) {
  const L = LEVELS[level];
  const hw = level === "HW";
  return `당신은 Automotive SPICE ${version === "3.1" && hw ? "4.0 HWE.1(3.1 PAM 확장 준용)" : L.reqProc}(${level} 요구사항 분석)에 정통한 차량 전장 ${hw ? "HW" : "SW"} 엔지니어입니다.
아래 시스템 요구를 ${hw ? "하드웨어" : "소프트웨어"} 관점의 검증 가능한 요구로 파생하세요. 상위 요구 1건당 1~3건.
${hw ? "HW 관점: 회로 기능 거동·전압/전류·소비전력·온도·신호 지연·필터·파워 시퀀스·연산 자원 등." : "SW 관점: 입력 신호·처리 로직·출력·타이밍·상태·오류 처리·진단·자원."}
블랙박스 관점으로 작성하고 구현 결정(함수명·변수명)은 쓰지 말 것. verifCriteria는 측정 가능한 기준 1문장.
${AI_FIDELITY}
JSON만 출력: {"items":[{"parent":"상위 id","title":"25자 이내","text":"~해야 한다 1~2문장","type":"기능|비기능|인터페이스","verifCriteria":""}]}
${guideBlock}
--- 시스템 요구 (할당 요소) ---
${JSON.stringify(parents.map(p => ({ id: p.id, type: p.type, t: short(p.title, 40), d: short(p.text, 110), crit: short(p.verifCriteria, 70), elems: (p.elems || []).map(e => sysCompName[e] || e) })))}`;
}
export function promptComponents({ level, reqs, sysElems, version, guideBlock = "" }) {
  const L = LEVELS[level];
  const hw = level === "HW";
  return `당신은 Automotive SPICE ${hw ? (version === "3.1" ? "4.0 HWE.2(PAM 확장 준용)" : "HWE.2") : "SWE.2"} ${hw ? "HW 아키텍처" : "SW 아키텍처"} 설계 전문가입니다.
아래 ${level} 요구를 만족하는 ${L.compLabel}를 3~10개로 정의하고 컴포넌트 간 인터페이스를 작성하세요.
kind 후보: ${COMP_KINDS[level].join("|")}. ${hw ? "전원·클럭·입력 회로·구동 회로·통신 트랜시버 등 회로 블록 단위." : "애플리케이션 SWC·BSW/플랫폼·진단·통신·모드 관리 등. 외부 공급/자동 생성 코드는 kind로 구분."}
sysElem은 아래 시스템 요소 id 중 구현 대상. 응답 분량 제한: 컴포넌트 최대 10개, 인터페이스 최대 15건, 설명류는 각 30자 이내. rationale은 구조 선정 근거 2문장. ${AI_FIDELITY}
JSON만 출력: {"components":[{"name":"","kind":"","desc":"책임 1문장","behavior":"동적 거동 1문장","sysElem":"SYE-..."}],"interfaces":[{"from":"컴포넌트명","to":"컴포넌트명","kind":"${hw ? "전기 신호|전원|버스" : "API|RTE 포트|공유 데이터|콜백"}","signals":"","desc":""}],"rationale":""}
시스템 요소: ${JSON.stringify(sysElems.map(e => ({ id: e.id, name: e.name, kind: e.kind })))}
${guideBlock}
--- ${level} 요구 ---
${JSON.stringify(reqs.slice(0, 60).map(r => ({ id: r.id, t: short(r.title, 40), d: short(r.text, 80) })))}`;
}
export function promptTests({ testLevel, reqs, version, guideBlock = "" }) {
  const tl = TEST_LEVELS[testLevel];
  const term = version === "3.1" ? "테스트 케이스(08-50)" : version === "4.0" ? "검증 수단(08-60)" : "검증 수단(4.0 08-60 / 3.1 08-50)";
  return `당신은 Automotive SPICE ${tl.proc} ${tl.label} 전문가입니다. 각 요구의 정상 동작 ${term}를 1건씩 작성하세요.
(경계값·결함주입 케이스는 규칙 엔진이 별도로 생성하므로 정상 시나리오만.) steps는 3~5단계를 '; '로 구분. passCriteria는 판정 가능한 기준.
${AI_FIDELITY}
JSON만 출력: {"items":[{"target":"요구 id","title":"30자 이내","precondition":"","steps":"","expected":"","passCriteria":"","env":"HILS|벤치|실차|챔버|시뮬레이션 중 해당"}]}
${guideBlock}
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
// 추적 연결 상태 — 화면 표기. (내부 값 valid/invalid는 저장 호환을 위해 유지. 'valid' = 상위 변경이 이 하위에 영향 없음·연결 유지, 'invalid' = 하위를 고쳐야 함)
export const LINK_STATES = { valid: "영향 없음(연결 유지)", suspect: "변경 검토 필요", invalid: "하위 수정 필요", orphan: "상위 삭제(고아 연결)", new: "신규", removed: "연결 제거" };

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
  if (sus.length) { const ups = uniq(sus.map(l => l.up)); F.push({ sev: "error", bp: "CHANGE", msg: `[변경 영향 검토 대기] 요구 ${ups.length}건(${ups.slice(0, 3).join(", ")}${ups.length > 3 ? " …" : ""})을 고친 뒤 하위 연결 ${sus.length}건이 아직 확인되지 않음 — 고장이 아니라 '고친 뒤 하위를 확인했는가'가 비어 있는 상태. '빠진 곳 점검'의 변경 영향 검토에서 '영향 없음' 또는 '하위 수정 필요'로 판정하면 해소`, ids: ups.slice(0, 30), count: ups.length }); }
  const inv = st.links.filter(l => l.state === "invalid");
  if (inv.length) { const ds = uniq(inv.map(l => l.down)); F.push({ sev: "error", bp: "CHANGE", msg: `'하위 수정 필요'로 판정했지만 아직 완료 처리되지 않은 추적 연결 ${inv.length}건 — 하위 항목을 고친 뒤 '빠진 곳 점검'에서 '✓ 수정 완료'`, ids: ds.slice(0, 30), count: ds.length }); }
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
    const naN = m.reqs.STK.filter(stkClosed).length;
    push({ key: "stkDerive", group: "req", q: "고객(OEM) 요구가 시스템 요구로 분석됐나", sub: `이해관계자 요구 → 시스템 요구 · SYS.1→SYS.2${naN ? ` · 해당 없음(사유) ${naN}건 제외` : ""}`, tab: "req", total: m.reqs.STK.length - naN, missing: m.reqs.STK.filter(k => !cov.has(k.id) && !stkClosed(k)).map(k => k.id) });
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
// QA 판정 — 화면 표기는 '지적이 맞는가'가 바로 읽히도록. (내부 값 valid/invalid/opinion은 저장·내보내기 호환을 위해 유지)
export const REVIEW_JUDGE = { valid: "지적 맞음 → 산출물 수정", invalid: "지적 틀림 → 수정 불필요", opinion: "보류 → 참고만" };
export const REVIEW_JUDGE_SHORT = { valid: "✓ 맞음 → 고침", invalid: "✕ 틀림", opinion: "△ 보류" };
export const REVIEW_BATCH = 4;   // 한 번에 보내는 요구 수 — Vercel 약 10초 제한 대응

// ── 3차 검토 기준: 조직 작성 가이드(등록된 작성 가이드 요약) — 가이드가 있을 때만 프롬프트에 붙는다 ──
export const ORG_GUIDE_CRITERION = { code: "ORG-GUIDE", label: "조직 작성 가이드 준수", desc: "등록된 작성 가이드의 규칙(용어·필수 항목·표기·측정 기준)과 어긋남" };
export function orgGuideCriteria(guideBlock) {
  const g = String(guideBlock || "").replace(/^\s*---[^\n]*---\s*/m, "").replace(/--- 작성 가이드 끝 ---[\s\S]*$/m, "").trim();
  if (!g) return "";
  return `\n\n[3차 — 조직 작성 가이드 (코드: ${ORG_GUIDE_CRITERION.code})]\n${ORG_GUIDE_CRITERION.desc}. 아래 규칙에 어긋나는 항목만 지적한다.\n${g.slice(0, 3000)}`;
}
export function reviewSystemPrompt() {
  return "You are an independent quality assurance reviewer for Automotive SPICE work products. " +
    "Review only what is given. Never invent requirement IDs, numbers, or quotes. Respond with valid JSON only, no markdown.";
}

// 검토 대상 요구(batch)와 상위 요구(parents)로 검토 프롬프트를 만든다.
export function promptReview({ level, reqs, parents = [], version = "both", guideBlock = "" }) {
  const proc = (LEVELS[level] || {}).reqProc || level;
  const vda = vdaCriteria(proc, version);
  const crit = `[1차 — ${vdaBasis(version)}]\n${vda.map(c => `- ${c.code}: ${c.label} — ${c.desc}`).join("\n")}\n\n[2차 — ${REVIEW_CRITERIA_VER}, ${REVIEW_CRITERIA_BASIS}]\n${REVIEW_CRITERIA.map(c => `- ${c.code}: ${c.label} — ${c.desc}`).join("\n")}`;
  const crit3 = orgGuideCriteria(guideBlock);
  const brief = r => ({ id: r.id, title: nz(r.title), text: nz(r.text), type: r.type || "", verifCriteria: nz(r.verifCriteria), parents: r.parents || [] });
  const usedParents = new Set(reqs.flatMap(r => r.parents || []));
  const par = parents.filter(p => usedParents.has(p.id)).map(p => ({ id: p.id, title: nz(p.title), text: nz(p.text) }));
  return `역할: 당신은 ASPICE ${proc} (${procLabel(proc, version)}) 산출물을 검토하는 독립 품질보증(QA) 검토자입니다.
아래 [검토 대상] 요구사항을 [검토 기준]에 따라 검토하고, 문제가 있는 것만 지적하세요.
검토 순서: 먼저 1차 기준(Automotive SPICE PAM 프로세스 BP 요건)으로 항목마다 점검하고, 그 다음 2차 기준(요구 품질 특성)으로, 3차 기준(조직 작성 가이드)이 있으면 마지막으로 점검한다. 같은 문제가 두 기준에 모두 해당하면 1차 기준 코드로 한 번만 지적한다.

[검토 기준]
${crit}${crit3}

[규칙]
1) id는 반드시 [검토 대상]에 있는 ID만 사용한다. 다른 ID를 만들지 않는다.
2) criterion은 위 1차·2차·3차 기준 코드 중 하나만 쓴다(1차 코드는 VDA-로 시작, 3차는 ORG-GUIDE).
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
    const edits = (m.aiReview.edits || []).filter(e => e.via !== "qa-review" && e.scope === f.level && e.id === f.reqId && (!f.runAt || e.at > f.runAt));
    return { ...f, reqTitle: it?.title || f.targetTitle || "", removed: !it, stale: !!it && f.reqHash !== it.hash, edits };
  });
  const count = (lv) => {
    const xs = list.filter(f => !lv || f.level === lv);
    return { total: xs.length, open: xs.filter(f => !f.judge).length, valid: xs.filter(f => f.judge?.state === "valid").length,
      invalid: xs.filter(f => f.judge?.state === "invalid").length, opinion: xs.filter(f => f.judge?.state === "opinion").length,
      stale: xs.filter(f => f.stale).length, edited: xs.filter(f => f.edits.length).length };
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
export function reviewPrompt(model, key, batch, version = "both", guideBlock = "") {
  const S = reviewScope(key), K = reviewKindOf(key);
  const m = normalizeModel(model);
  if (S.kind === "req") {
    const parents = S.lv === "SYS" ? m.reqs.STK : parentsForLevel(m, S.lv);
    return promptReview({ level: S.lv, reqs: batch.map(b => b.src), parents, version, guideBlock });
  }
  const vda = vdaCriteria(S.proc, version);
  const crit = `[1차 — ${vdaBasis(version)}]\n${vda.map(c => `- ${c.code}: ${c.label} — ${c.desc}`).join("\n")}\n\n[2차 — ${K.ver}, ${K.basis}]\n${K.criteria.map(c => `- ${c.code}: ${c.label} — ${c.desc}`).join("\n")}` + orgGuideCriteria(guideBlock);
  // 관련 항목은 판단 근거일 뿐이므로 길이를 제한한다 — 서버가 프롬프트를 24,000자에서 자르면 [출력 형식]이 잘려 응답 형식이 깨진다
  const ctx = reviewContext(m, batch.flatMap(b => b.refs || []));
  while (ctx.length && JSON.stringify(ctx).length > 9000) ctx.pop();
  return `역할: 당신은 ASPICE ${S.proc} (${procLabel(S.proc, version)}) 산출물 「${S.label}」을 검토하는 독립 품질보증(QA) 검토자입니다.
아래 [검토 대상] ${K.noun}을 [검토 기준]에 따라 검토하고, 문제가 있는 것만 지적하세요.
검토 순서: 먼저 1차 기준(Automotive SPICE PAM 프로세스 BP 요건)으로 항목마다 점검하고, 그 다음 2차 기준으로, 3차 기준(조직 작성 가이드)이 있으면 마지막으로 점검한다. 같은 문제가 두 기준에 모두 해당하면 1차 기준 코드로 한 번만 지적한다.

[검토 기준]
${crit}

[규칙]
1) id는 반드시 [검토 대상]에 있는 ID만 사용한다. [관련 항목]의 ID로 지적하지 않는다. 다른 ID를 만들지 않는다.
2) criterion은 위 1차·2차·3차 기준 코드 중 하나만 쓴다(1차 코드는 VDA-로 시작, 3차는 ORG-GUIDE).
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
export function validateReviewScope(raw, batch, key, version = "both") {
  const S = reviewScope(key);
  const all = reviewCriteriaFor(key, version).all;
  if (!S || S.kind === "req") return validateReview(raw, batch.map(b => b.src || b), { criteria: all });
  return validateReview(raw, batch, { criteria: all, evOf: b => b.ev || "" });
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
  valid: "AI 지적이 맞습니다 → 산출물을 고칩니다. '✎ 대상 수정'으로 고치면 '수정함' 표시가 붙습니다.",
  invalid: "AI 지적이 틀렸거나 이 과제에 맞지 않습니다 → 산출물은 그대로 둡니다. 왜 틀렸는지 사유를 적어야 심사 증적이 됩니다.",
  opinion: "지금 판단하기 어렵거나 참고만 합니다 → 보류 사유를 적어 둡니다.",
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
export function applyReviewEdit(model, key, id, patch, meta = {}) {
  const S = reviewScope(key); if (!S) return model;
  const m = normalizeModel(JSON.parse(JSON.stringify(model)));
  const lv = S.lv, p = { ...patch };
  // 수정 기록(조치 증적) — 어떤 필드를 무엇에서 무엇으로 바꿨는지. 판정 화면에서 '수정함' 표시와 RTM 기록에 쓴다
  const spec = reviewEditSpec(m, key, id);
  if (spec) {
    const changes = spec.fields.filter(f => f.k in patch && String(patch[f.k] ?? "") !== String(spec.values[f.k] ?? ""))
      .map(f => ({ k: f.k, label: f.label, before: String(spec.values[f.k] ?? ""), after: String(patch[f.k] ?? "") }));
    if (changes.length) m.aiReview.edits = [...m.aiReview.edits, { at: meta.at || new Date().toISOString(), scope: key, id, changes, by: meta.by || "user", via: meta.via || "review" }].slice(-500);
  }
  if (S.kind === "req") {
    const i = (m.reqs[lv] || []).findIndex(x => x.id === id); if (i < 0) return m;
    // SYS 요구의 제목·내용도 모델에 바로 반영한다(확정 요구 items는 화면이 함께 고침 → 다음 동기화 때 같은 값). 검증 기준은 사용자 수정 표시
    if (lv === "SYS" && "verifCriteria" in p) p.verifCriteriaEdited = true;
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
export const bpKnown = key => !!BP[key];

// ═══════════════════════════════════════════════════════════════════════════
// 11-d) 증분 생성 — '빠진 것만' 추가 (기존 유닛·시험의 ID·내용·교차검토 연결을 바꾸지 않는다)
//  · ruleUnits / generateRuleTests는 규칙 생성분을 통째로 다시 만들며 ID를 다시 매기므로,
//    요구 몇 건을 추가한 뒤에는 이 함수로 빠진 대상만 채운다.
// ═══════════════════════════════════════════════════════════════════════════
export function addMissingUnits(model) {
  const m = normalizeModel(model);
  const out = [...(m.units.SW || [])], added = [];
  const covered = new Set(out.flatMap(u => u.reqs || []));
  const compOf = r => (m.comps.SW || []).find(c => (m.alloc.SW[r.id] || []).includes(c.id));
  // 기능 요구: 유닛 1개씩
  m.reqs.SW.filter(r => r.type !== "비기능" && !covered.has(r.id)).forEach(r => {
    const c = compOf(r); if (!c) return;
    const u = { id: nextId(UNIT_PREFIX, out), comp: c.id, name: r.title || r.id,
      desc: `[상세설계 TBD] ${r.title || r.id} 처리 — 할당 요구 ${r.id}. 알고리즘·자료구조·동적 동작은 코드·플랫폼 확정 후 기술`,
      reqs: [r.id], funcs: [], types: [], macros: [], origin: "rule", file: "", designDone: false };
    out.push(u); added.push(u.id); covered.add(r.id);
  });
  // 비기능 요구: 같은 컴포넌트의 첫 유닛에 제약으로 덧붙임(없으면 새 유닛)
  m.reqs.SW.filter(r => r.type === "비기능" && !covered.has(r.id)).forEach(r => {
    const c = compOf(r); if (!c) return;
    const i = out.findIndex(u => u.comp === c.id);
    if (i >= 0) { out[i] = { ...out[i], reqs: [...new Set([...(out[i].reqs || []), r.id])] }; added.push(`${out[i].id}(+${r.id})`); }
    else { const u = { id: nextId(UNIT_PREFIX, out), comp: c.id, name: `${c.name} 메인`, desc: `[상세설계 TBD] ${c.name} — 제약 ${r.id}`, reqs: [r.id], funcs: [], types: [], macros: [], origin: "rule", file: "", designDone: false }; out.push(u); added.push(u.id); }
    covered.add(r.id);
  });
  const unalloc = m.reqs.SW.filter(r => !covered.has(r.id)).map(r => r.id);   // 컴포넌트 미할당이라 유닛을 못 만든 요구
  return { units: out, added, unalloc };
}
export function addMissingTests(model, levels) {
  const m = normalizeModel(model);
  const lv = (levels || Object.keys(TEST_LEVELS)).filter(L => m.scope[TEST_LEVELS[L].level]);
  const gen = generateRuleTests({ ...m, tests: [] }, lv);
  const all = [...m.tests], added = [];
  const has = (L, tgt) => m.tests.some(x => x.level === L && (x.targets || []).includes(tgt));
  gen.forEach(t => {
    if (has(t.level, (t.targets || [])[0])) return;
    const nt = { ...t, id: nextId(TEST_LEVELS[t.level].prefix, all.filter(x => x.level === t.level), 4) };
    all.push(nt); added.push(nt.id);
  });
  return { tests: all, added };
}
// 시험이 하나도 없는 대상 수 (레벨별) — '빠진 시험만 생성' 버튼 표시용
export function missingTestTargets(model, levels) {
  const m = normalizeModel(model);
  const lv = (levels || Object.keys(TEST_LEVELS)).filter(L => m.scope[TEST_LEVELS[L].level]);
  const gen = generateRuleTests({ ...m, tests: [] }, lv);
  return [...new Set(gen.filter(t => !m.tests.some(x => x.level === t.level && (x.targets || []).includes((t.targets || [])[0]))).map(t => `${t.level}|${(t.targets || [])[0]}`))].length;
}

// 교차검토로 확인이 끝난 Draft 요구 — 현재 내용으로 검토됐고, 미판정 의견·'유효인데 미수정' 의견이 없는 요구
//  (상태를 Reviewed로 올릴 근거가 교차검토·판정 기록으로 남아 있는 요구만 고른다)
export function reviewReadyReqs(model) {
  const m = normalizeModel(model);
  const v = reviewView(m);
  const out = [];
  ["SYS", "SW", "HW"].filter(lv => lv === "SYS" || m.scope[lv]).forEach(lv => {
    const done = reviewedIds(m, lv);
    (m.reqs[lv] || []).filter(r => (r.status || "Draft") === "Draft" && done.has(r.id)).forEach(r => {
      const fs = v.list.filter(f => f.level === lv && f.reqId === r.id && !f.removed);
      if (fs.some(f => !f.judge || (f.judge.state === "valid" && !f.edits.length))) return;
      out.push({ lv, id: r.id });
    });
  });
  return out;
}
export function markReviewed(model, list, by = "QA") {
  const m = normalizeModel(JSON.parse(JSON.stringify(model)));
  const at = new Date().toISOString();
  list.forEach(({ lv, id }) => {
    const i = (m.reqs[lv] || []).findIndex(r => r.id === id); if (i < 0) return;
    m.reqs[lv][i] = { ...m.reqs[lv][i], status: "Reviewed" };
    m.aiReview.edits = [...m.aiReview.edits, { at, scope: lv, id, changes: [{ k: "status", label: "상태", before: "Draft", after: "Reviewed" }], by, via: "qa-review" }];
  });
  m.aiReview.edits = m.aiReview.edits.slice(-1000);
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11-e) 판정 보조 — 관련 상위 항목 표시 · 같은 지적의 검토 AI 간 일치 · 수정안 초안 프롬프트
//  · 판정은 사람이 한다. 보조 기능은 '판단에 필요한 근거를 한 화면에 모으고, 수정 초안을 만들어 주는 것'까지다.
// ═══════════════════════════════════════════════════════════════════════════
// 검토 대상 항목의 관련(상위·참조) 항목 — 의견을 판정할 때 원문을 찾아다니지 않도록 카드 안에 보여준다
export function reviewRefs(model, key, id) {
  const m = normalizeModel(model);
  const it = reviewItems(m, key).find(x => x.id === id);
  return it ? reviewContext(m, it.refs || []) : [];
}
// 같은 대상·같은 기준을 서로 다른 검토 AI가 지적했으면 '일치' — 독립된 두 검토가 같은 문제를 봤다는 뜻이므로 판정 우선순위가 높다
export function reviewAgreement(findings) {
  const byKey = {};
  findings.forEach(f => { const k = `${f.level}|${f.reqId}|${f.criterion}`; (byKey[k] = byKey[k] || new Set()).add(f.provider || f.reviewer || ""); });
  return Object.fromEntries(Object.entries(byKey).map(([k, s]) => [k, s.size]));
}
// 수정안 초안 프롬프트 — 대상 항목의 현재 값 + 판정된(틀림 제외) 의견 + 관련 항목 → 필드별 수정안(JSON)
export function promptFixDraft({ scopeKey, item, fields, opinions, refs }) {
  const S = reviewScope(scopeKey);
  return `역할: ASPICE ${S?.proc || ""} 산출물 「${S?.label || scopeKey}」의 항목 ${item.id}를, 독립 검토 AI의 지적을 반영해 고쳐 쓰는 작성자.
${AI_FIDELITY}
규칙:
1) 아래 [지적]을 모두 반영하되, [관련 항목](상위 요구·원문)에 없는 수치·조건을 새로 만들지 않는다. 근거가 없으면 'TBD(확인 필요)'로 쓴다.
2) 지적이 없는 부분은 원문을 유지한다(불필요한 문장 재배열 금지).
3) 각 필드는 한 문단, 줄바꿈 없이. 바꾸지 않을 필드는 결과에서 생략한다.
4) 출력은 JSON만: {"fields":{"<필드키>":"<수정안>"},"rationale":"무엇을 왜 바꿨는지 한두 문장"}

[필드 키와 현재 값]
${JSON.stringify(Object.fromEntries(fields.map(f => [f.k, { label: f.label, value: item.values[f.k] || "" }])))}

[지적] (기준 · 심각도 · 근거 인용 · 내용 · 제안)
${JSON.stringify(opinions.map(o => ({ criterion: o.criterion, severity: o.severity, evidence: o.evidence || "", issue: o.issue, suggestion: o.suggestion || "" })))}

[관련 항목]
${refs.length ? JSON.stringify(refs) : "(없음)"}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11-f) 수정안 승인 큐 — 규칙으로 되는 것은 규칙이, 문장은 생성 AI가 초안을 만들고 사람은 승인·반려만 한다
//  · 규칙 수정안: 결정론적(상위 요구 검증 기준 상속 등). AI 수정안: 의견+관련 상위 원문 근거, 원문에 없는 수치는 TBD.
//  · 승인 = 해당 의견 '맞음' 판정 + 수정 적용 + 이력("AI/규칙 초안, QA 승인"). 반려 = 아무것도 바꾸지 않음.
// ═══════════════════════════════════════════════════════════════════════════
export const FIX_BATCH = 4;
// 승인 큐 대상 — 미판정 또는 '맞음인데 미수정' 의견이 달린 항목 (틀림·보류만 달린 항목은 제외)
export function fixQueueTargets(model, key) {
  const m = normalizeModel(model);
  const v = reviewView(m);
  const by = {};
  v.list.filter(f => f.level === key && !f.removed && (!f.judge || (f.judge.state === "valid" && !f.edits.length))).forEach(f => { (by[f.reqId] = by[f.reqId] || []).push(f); });
  return Object.entries(by).map(([id, fs]) => ({ id, findings: fs, allFindings: v.list.filter(f => f.level === key && f.reqId === id && !f.removed && f.judge?.state !== "invalid") }))
    .filter(t => reviewEditSpec(m, key, t.id));
}
// 규칙 수정안 — 지금은 '검증 기준 비어 있음 + 상위 요구에 검증 기준 있음'일 때 상속 제안. 의견이 모두 VERIF 계열이면 규칙만으로 처리
export function ruleFixProposal(model, key, id, findings) {
  const S = reviewScope(key); if (!S || S.kind !== "req") return null;
  const m = normalizeModel(model);
  const r = (m.reqs[S.lv] || []).find(x => x.id === id); if (!r || nz(r.verifCriteria)) return null;
  const parents = S.lv === "SYS" ? [] : (m.reqs.SYS || []).filter(p => (r.parents || []).includes(p.id) && nz(p.verifCriteria));
  if (!parents.length) return null;
  const onlyVerif = findings.every(f => f.criterion === "VERIF");
  if (!onlyVerif) return null;
  const vc = parents.map(p => `${p.verifCriteria} (상위 ${p.id} 기준 상속 — ${S.lv} 관점으로 조정 필요)`).join("; ");
  return { kind: "rule", fields: { verifCriteria: vc }, rationale: `상위 요구 ${parents.map(p => p.id).join(", ")}의 검증 기준을 상속(규칙). 하위 관점의 수치·조건으로 다듬어 승인하세요.` };
}
// AI 수정안 프롬프트(묶음) — 여러 항목을 한 번에
export function promptFixDraftBatch({ scopeKey, targets }) {
  const S = reviewScope(scopeKey);
  return `역할: ASPICE ${S?.proc || ""} 산출물 「${S?.label || scopeKey}」의 항목들을, 독립 검토 AI의 지적을 반영해 고쳐 쓰는 작성자.
${AI_FIDELITY}
규칙:
1) 항목마다 [지적]을 모두 반영하되, [관련 항목](상위 요구·원문)에 없는 수치·조건을 새로 만들지 않는다. 근거가 없으면 'TBD(확인 필요)'로 쓴다.
2) 지적이 없는 부분은 원문을 유지한다. 바꾸지 않을 필드는 결과에서 생략한다. 각 필드는 한 문단, 줄바꿈 없이.
3) 단일성(SINGULAR) 지적은 한 항목 안에서 문장을 정리하되 항목을 쪼개지는 않는다(분할은 사람이 한다). 대신 rationale에 '분할 권장'을 적는다.
4) id는 [항목]에 있는 것만 쓴다. 출력은 JSON만:
{"items":[{"id":"","fields":{"<필드키>":"<수정안>"},"rationale":"무엇을 왜 바꿨는지 한두 문장"}]}

[항목] (id · 필드 키와 현재 값 · 지적 · 관련 항목)
${JSON.stringify(targets.map(t => ({ id: t.id, fields: Object.fromEntries(t.fields.map(f => [f.k, { label: f.label, value: t.values[f.k] || "" }])),
    지적: t.opinions.map(o => ({ criterion: o.criterion, severity: o.severity, evidence: o.evidence || "", issue: o.issue, suggestion: o.suggestion || "" })),
    관련항목: t.refs })))}`;
}
// ⑦ 변경 영향: '검증 기준만 바뀐' 상위의 요소 할당·파생 요구 연결은 영향 없음 후보 (시험 연결은 후보 아님 — 합격 기준 확인 필요)
export function impactNoEffectCandidates(links) {
  return links.filter(l => l.state === "suspect" && (l.kind === "alloc" || l.kind === "derive") && (l.fields || []).length > 0 && (l.fields || []).every(f => f === "검증 기준")).map(l => l.key);
}

// ═══════════════════════════════════════════════════════════════════════════
// 12) 길잡이 — 8단계 진행 상태와 '다음 할 일' (기존 커버리지·일관성 로직을 그대로 읽어서 계산)
// ═══════════════════════════════════════════════════════════════════════════
export const AE_STEP_ORDER = ["setup", "req", "SYS", "SW", "HW", "verif", "trace", "review"];
const STEP_COV = { req: ["stkDerive"], SYS: ["sysAlloc"], SW: ["swDerive", "swAlloc", "swUnit"], HW: ["hwDerive", "hwAlloc"] };
export function aeProgress(model, opts = {}) {
  const m = normalizeModel(model);
  const cov = coverageDetail(m);
  const byKey = Object.fromEntries(cov.map(c => [c.key, c]));
  const missOf = keys => keys.map(k => byKey[k]).filter(c => c && c.missing.length);
  const errs = checkConsistency(m).filter(f => f.sev === "error");
  const openLinks = linkStatus(m).open.length;
  const rcov = opts.reviewCov || reviewCoverage(m);
  const steps = [];
  const add = (id, state, note, next) => steps.push({ id, state, note, next });
  add("setup", opts.saved || m.reqs.SYS.length ? "done" : (Object.keys(m.inputs || {}).length ? "partial" : "todo"), "적용 버전·개발 범위·입력자료 체크", { tab: "setup" });
  { const mi = missOf(STEP_COV.req); add("req", !m.reqs.SYS.length ? "todo" : mi.length ? "partial" : "done", m.reqs.SYS.length ? `시스템 요구 ${m.reqs.SYS.length}건 확정` : "고객 요구에서 시스템 요구를 도출·확정", mi[0] ? { cov: mi[0] } : { tab: "req" }); }
  { const mi = missOf(STEP_COV.SYS); add("SYS", !m.comps.SYS.length ? "todo" : mi.length ? "partial" : "done", m.comps.SYS.length ? `요소 ${m.comps.SYS.length}개 · 인터페이스 ${m.interfaces.SYS.length}건` : "시스템 요소를 나누고 요구를 할당", mi[0] ? { cov: mi[0] } : { tab: "SYS" }); }
  ["SW", "HW"].forEach(lv => { if (!m.scope[lv]) return; const mi = missOf(STEP_COV[lv]); const n = m.reqs[lv].length;
    add(lv, !n ? "todo" : mi.length ? "partial" : "done", n ? `${lv} 요구 ${n}건 · 컴포넌트 ${m.comps[lv].length}개${lv === "SW" ? ` · 유닛 ${m.units.SW.length}개` : ""}` : `시스템 요구를 ${lv} 요구로 내리고 컴포넌트에 할당`, mi[0] ? { cov: mi[0] } : { tab: lv }); });
  { const mi = cov.filter(c => c.group === "verif" && c.missing.length); add("verif", !m.tests.length ? "todo" : mi.length ? "partial" : "done", m.tests.length ? `시험 ${m.tests.length}건` : "요구·인터페이스·유닛마다 시험 생성", mi[0] ? { cov: mi[0] } : { tab: "verif" }); }
  add("trace", !m.reqs.SYS.length ? "todo" : errs.length || openLinks ? "partial" : "done", errs.length || openLinks ? `오류 ${errs.length} · 변경 영향 확인 대기 ${openLinks}` : "오류 없음", { tab: "trace" });
  { const tot = rcov.reduce((a, c) => a + c.total, 0), rv = rcov.reduce((a, c) => a + c.reviewedAny, 0), op = rcov.reduce((a, c) => a + c.open, 0);
    add("review", tot && rv === tot && !op ? "done" : rv ? "partial" : "todo", tot ? `전체 항목 ${tot}건 중 검토 끝남 ${rv}건 · 판정 기다리는 의견 ${op}건` : "검토할 산출물 없음", { tab: "review" }); }
  // 다음 할 일: 순서상 첫 미완료 단계. 단, 앞 단계가 아직이면 뒤 단계의 '부분'은 보이지 않게 한다
  const next = steps.find(s => s.state !== "done") || null;
  const done = steps.filter(s => s.state === "done").length;
  return { steps, next, pct: Math.round(done / steps.length * 100) };
}


// ═══════════════════════════════════════════════════════════════════════════
// 12) SWE.3 상세설계(DD) — 유닛별 정적 구조·동적 동작을 AI가 전부 작성하되, 모든 요소에 요구 ID 추적을 남긴다
//    unit.dd = { guid, summary, dataTypes[], classes[], ports[], runnables[], assoc[], states{}, sequences[], activities[], origin, generatedAt }
//    model.swDesign = 대상 플랫폼·릴리스·MISRA 판본·정적분석 도구 (코드 생성·체크리스트 기준)
//    GUID: 요소마다 프로젝트·유닛·요소 이름으로 결정되는 영구 GUID — EA(XMI) 왕복 시 같은 요소로 매칭하기 위함
// ═══════════════════════════════════════════════════════════════════════════
export const DD_DEFAULT = {
  target: "CP",                       // CP: AUTOSAR Classic(C) / AP: AUTOSAR Adaptive(C++17)
  release: "R25-11",
  misraC: "MISRA C:2023", misraCpp: "MISRA C++:2023", cppGuide: "AUTOSAR C++14",
  tools: ["Helix QAC", "Polyspace"],
  stack: "표준 RTE API (Vector MICROSAR/DaVinci 등 벤더 중립)",
};
export const DD_TARGETS = {
  CP: { label: "AUTOSAR Classic Platform — C", lang: "C", std: "C99 (MISRA C:2023)", api: "Rte_Read/Rte_Write/Rte_Call · Runnable", unitKind: "SWC(Software Component)" },
  AP: { label: "AUTOSAR Adaptive Platform — C++", lang: "C++17", std: "C++17 (MISRA C++:2023 · AUTOSAR C++14)", api: "ara::com Proxy/Skeleton · ara::core", unitKind: "Adaptive Application" },
};
export const ddSettings = m => ({ ...DD_DEFAULT, ...((m && m.swDesign) || {}) });

// 결정적 GUID (FNV-1a 64비트 두 번 → 32 hex) — 같은 seed면 항상 같은 값. EA 형식 {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
function fnv64(str, seed) {
  let h = BigInt(seed) ^ 0xcbf29ce484222325n;
  for (let i = 0; i < str.length; i++) { h ^= BigInt(str.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, "0");
}
export function guidFor(seed) {
  const s = String(seed || "");
  const hex = (fnv64(s, 1) + fnv64(s + "#2", 2)).toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}}`;
}
export const xmiIdOf = guid => "EAID_" + String(guid || "").replace(/[{}]/g, "").replace(/-/g, "_");

export function emptyDD() {
  return { guid: "", summary: "", dataTypes: [], classes: [], ports: [], runnables: [], assoc: [], states: { initial: "", states: [], transitions: [] }, sequences: [], activities: [], origin: "", generatedAt: "" };
}
const cid = s => String(s || "").trim().replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1").slice(0, 60) || "Unnamed";
// 한글 이름 → 코드·파일명용 ASCII 식별자. 영문이 없으면 fallback(유닛 ID 기반)으로 — "____.c" 같은 파일명 방지
export const asciiName = (s, fallback) => { const c = cid(String(s || "").replace(/\s+/g, "_")); const weak = c === "Unnamed" || (c.match(/[A-Za-z]/g) || []).length < 3 || /_{3,}/.test(c) || /^_{2,}/.test(c); return weak ? cid(fallback || "Unit") : c; };
const unitIdent = u => asciiName(u?.name, `Unit_${String(u?.id || "").replace(/[^A-Za-z0-9]/g, "_")}`);
const arr = x => (Array.isArray(x) ? x : []);
const str = (x, n = 400) => String(x == null ? "" : x).slice(0, n);
const ids = x => arr(x).map(v => String(v || "").trim()).filter(Boolean);

// AI 출력 → 정규화 (식별자 정리, 요구 ID는 이 유닛 범위의 SW 요구로만 제한, 빈 곳은 규칙 보강)
export function normalizeDD(raw, unit, model, seedKey) {
  const r = raw && typeof raw === "object" ? raw : {};
  const m = normalizeModel(model);
  const okReq = new Set([...(m.reqs.SW || []).map(x => x.id), ...(m.reqs.SYS || []).map(x => x.id)]);
  const rq = x => ids(x).filter(i => okReq.has(i));
  const unitReqs = ids(unit?.reqs);
  const g = name => guidFor(`${seedKey}|${unit?.id}|${name}`);
  const dd = emptyDD();
  dd.guid = g("unit");
  dd.summary = str(r.summary, 600);
  dd.dataTypes = arr(r.dataTypes).slice(0, 30).map(t => ({ name: cid(t.name), base: str(t.base || "uint8", 40), desc: str(t.desc, 200), range: str(t.range, 80), reqs: rq(t.reqs) }));
  dd.classes = arr(r.classes).slice(0, 12).map(c => ({
    guid: g(`class:${asciiName(c.name, unitIdent(unit))}`), name: asciiName(c.name, unitIdent(unit)), stereotype: str(c.stereotype || (c.name === unit?.name ? "SWC" : ""), 30), desc: str(c.desc, 300), reqs: rq(c.reqs).length ? rq(c.reqs) : unitReqs,
    attrs: arr(c.attrs).slice(0, 30).map(a => ({ name: cid(a.name), type: str(a.type || "uint8", 40), init: str(a.init, 40), desc: str(a.desc, 160), vis: /^[+#-]$/.test(a.vis) ? a.vis : "-" })),
    ops: arr(c.ops).slice(0, 30).map(o => ({ name: cid(o.name), ret: str(o.ret || "void", 40), vis: /^[+#-]$/.test(o.vis) ? o.vis : "+",
      params: arr(o.params).slice(0, 10).map(p => ({ name: cid(p.name), type: str(p.type || "uint8", 40), dir: ["in", "out", "inout"].includes(p.dir) ? p.dir : "in" })),
      desc: str(o.desc, 300), pre: str(o.pre, 200), post: str(o.post, 200), algo: arr(o.algo).slice(0, 25).map(s => str(s, 220)), reqs: rq(o.reqs) })),
  }));
  dd.ports = arr(r.ports).slice(0, 30).map(p => ({ guid: g(`port:${cid(p.name)}`), name: cid(p.name), dir: /^R/i.test(p.dir) ? "R" : "P", interface: cid(p.interface || p.name + "_If"), kind: /client|server|cs/i.test(p.kind) ? "C/S" : "S/R",
    elements: arr(p.elements).slice(0, 20).map(e => ({ name: cid(e.name), type: str(e.type || "uint8", 40), unit: str(e.unit, 20), range: str(e.range, 60) })), source: str(p.source, 80), reqs: rq(p.reqs) }));
  dd.runnables = arr(r.runnables).slice(0, 20).map(x => ({ guid: g(`run:${cid(x.name)}`), name: cid(x.name), trigger: /event|evt/i.test(x.trigger) ? "event" : /init/i.test(x.trigger) ? "init" : "periodic",
    periodMs: Number(x.periodMs) > 0 ? Number(x.periodMs) : (/event|init/i.test(x.trigger) ? 0 : 10), event: str(x.event, 60), reads: ids(x.reads), writes: ids(x.writes), calls: ids(x.calls), desc: str(x.desc, 300), wcetUs: Number(x.wcetUs) > 0 ? Number(x.wcetUs) : 0, reqs: rq(x.reqs) }));
  dd.assoc = arr(r.assoc).slice(0, 40).map(a => ({ from: cid(a.from), to: cid(a.to), kind: ["comp", "agg", "dep", "gen", "assoc"].includes(a.kind) ? a.kind : "assoc", label: str(a.label, 60), mult: str(a.mult, 20) }));
  const st = r.states && typeof r.states === "object" ? r.states : {};
  dd.states = { initial: cid(st.initial || (arr(st.states)[0] || {}).name || ""),
    states: arr(st.states).slice(0, 20).map(s => ({ guid: g(`state:${cid(s.name)}`), name: cid(s.name), entry: str(s.entry, 200), do: str(s.do, 200), exit: str(s.exit, 200), desc: str(s.desc, 200), reqs: rq(s.reqs) })),
    transitions: arr(st.transitions).slice(0, 60).map(t => ({ from: cid(t.from), to: cid(t.to), trigger: str(t.trigger, 80), guard: str(t.guard, 120), effect: str(t.effect, 120), reqs: rq(t.reqs) })) };
  const splitMsg = x => { const raw = String(x?.msg || ""); const mm = raw.match(/^\s*([^(]+?)\s*\((.*)\)\s*$/); return mm ? { msg: cid(mm[1]), args: str(x.args && !/^\(?none\)?$/i.test(x.args) ? x.args : mm[2], 120) } : { msg: cid(raw), args: str(/^\(?none\)?$/i.test(String(x?.args || "")) ? "" : x?.args, 120) }; };
  dd.sequences = arr(r.sequences).slice(0, 10).map((s, si) => ({ guid: g(`seq:${cid(s.name)}`), name: asciiName(s.name, `SEQ_${String(si + 1).padStart(3, "0")}`), title: str(s.name, 80), desc: str(s.desc, 300), lifelines: ids(s.lifelines).map(cid),
    steps: arr(s.steps).slice(0, 40).map(x => ({ from: cid(x.from), to: cid(x.to), ...splitMsg(x), ret: str(x.ret, 80), kind: /async|signal/i.test(x.kind) ? "async" : "sync", note: str(x.note, 120) })), reqs: rq(s.reqs) }));
  dd.activities = arr(r.activities).slice(0, 12).map(a => {
    const nodes = arr(a.nodes).slice(0, 40).map((n, i) => ({ id: cid(n.id || `n${i + 1}`), kind: ["start", "action", "decision", "merge", "end", "fork", "join"].includes(n.kind) ? n.kind : "action", text: str(n.text, 160) }));
    const have = new Set(nodes.map(n => n.id));
    return { guid: g(`act:${cid(a.name)}`), name: cid(a.name), op: cid(a.op || a.name), desc: str(a.desc, 200), nodes,
      edges: arr(a.edges).slice(0, 60).map(e => ({ from: cid(e.from), to: cid(e.to), guard: str(e.guard, 80) })).filter(e => have.has(e.from) && have.has(e.to)), reqs: rq(a.reqs) };
  });
  // 참조 무결성: 시퀀스 라이프라인이 비어 있으면 단계에서 수집, 상태 전이의 미정의 상태는 제거
  dd.sequences.forEach(s => { if (!s.lifelines.length) s.lifelines = [...new Set(s.steps.flatMap(x => [x.from, x.to]))]; });
  const stNames = new Set(dd.states.states.map(s => s.name));
  dd.states.transitions = dd.states.transitions.filter(t => stNames.has(t.from) && stNames.has(t.to));
  if (dd.states.states.length && !stNames.has(dd.states.initial)) dd.states.initial = dd.states.states[0].name;
  dd.origin = "ai"; dd.generatedAt = new Date().toISOString();
  return fillDDGaps(dd, unit, model, seedKey);
}

// 규칙 보강/규칙 생성 — AI 미사용이거나 AI 출력이 비어 있는 부분을 근거(요구·인터페이스·모드)로 채운다
export function fillDDGaps(dd0, unit, model, seedKey) {
  const m = normalizeModel(model);
  const dd = dd0 || emptyDD();
  const g = name => guidFor(`${seedKey}|${unit?.id}|${name}`);
  if (!dd.guid) dd.guid = g("unit");
  const uName = unitIdent(unit);
  const reqs = (m.reqs.SW || []).filter(r => ids(unit?.reqs).includes(r.id));
  const comp = (m.comps.SW || []).find(c => c.id === unit?.comp);
  const ifs = (m.interfaces.SW || []).filter(i => comp && (i.from === comp.id || i.to === comp.id));
  if (!dd.classes.length) {
    dd.classes.push({ guid: g(`class:${uName}`), name: uName, stereotype: "SWC", desc: unit?.desc || "", reqs: ids(unit?.reqs),
      attrs: [{ name: "state", type: `${uName}_StateType`, init: "INIT", desc: "유닛 운영 상태", vis: "-" }],
      ops: [{ name: `${uName}_Init`, ret: "void", vis: "+", params: [], desc: "초기화 — 내부 상태·버퍼 초기화", pre: "", post: "state == INIT", algo: ["내부 변수 초기화", "state := INIT"], reqs: [] },
        ...reqs.filter(r => r.type !== "비기능").slice(0, 12).map(r => ({ name: `${uName}_${asciiName(r.title, cid(r.id)).slice(0, 28)}`, ret: "Std_ReturnType", vis: "+", params: [], desc: `${r.title} 처리 (${r.id})`, pre: "", post: "", algo: [`입력 유효성 검사`, `${r.title} 수행`, `결과 반환`], reqs: [r.id] })),
        { name: `${uName}_MainFunction`, ret: "void", vis: "+", params: [], desc: "주기 처리 — 입력 읽기 → 상태 천이 → 출력 쓰기", pre: "", post: "", algo: ["RTE에서 입력 읽기", "상태 머신 수행", "RTE로 출력 쓰기"], reqs: ids(unit?.reqs) }],
    });
  }
  if (!dd.dataTypes.length) dd.dataTypes.push({ name: `${uName}_StateType`, base: "enum", desc: "유닛 상태 열거형", range: "INIT, RUN, DEGRADED, ERROR", reqs: [] });
  if (!dd.ports.length) {
    ifs.forEach(i => {
      const isIn = i.to === comp.id;
      const els = String(i.signals || "").split(/[,;·/]/).map(s => s.trim()).filter(Boolean).slice(0, 12).map(s => ({ name: cid(s), type: "uint16", unit: "", range: "" }));
      dd.ports.push({ guid: g(`port:${i.id}`), name: cid(`${isIn ? "R" : "P"}p_${i.id}`), dir: isIn ? "R" : "P", interface: cid(`${i.id}_If`), kind: "S/R", elements: els.length ? els : [{ name: cid(i.kind || "data"), type: "uint16", unit: "", range: "" }], source: i.id, reqs: [] });
    });
    if (!dd.ports.length) dd.ports.push({ guid: g("port:Rp_Input"), name: "Rp_Input", dir: "R", interface: `${uName}_InIf`, kind: "S/R", elements: [{ name: "inValue", type: "uint16", unit: "", range: "" }], source: "", reqs: [] },
      { guid: g("port:Pp_Output"), name: "Pp_Output", dir: "P", interface: `${uName}_OutIf`, kind: "S/R", elements: [{ name: "outValue", type: "uint16", unit: "", range: "" }], source: "", reqs: [] });
  }
  if (!dd.runnables.length) {
    const per = ifs.map(i => Number(i.periodMs)).find(n => n > 0) || 10;
    dd.runnables.push({ guid: g("run:Init"), name: `${uName}_Init`, trigger: "init", periodMs: 0, event: "", reads: [], writes: [], calls: [`${uName}_Init`], desc: "초기화 Runnable", wcetUs: 0, reqs: [] },
      { guid: g("run:Main"), name: `${uName}_MainFunction`, trigger: "periodic", periodMs: per, event: "", reads: dd.ports.filter(p => p.dir === "R").map(p => p.name), writes: dd.ports.filter(p => p.dir === "P").map(p => p.name), calls: [`${uName}_MainFunction`], desc: `${per}ms 주기 Runnable`, wcetUs: 0, reqs: ids(unit?.reqs) });
  }
  if (!dd.states.states.length) {
    const modes = (m.modes || []).map(x => cid(x.name || x)).filter(Boolean);
    const names = modes.length ? ["INIT", ...modes.filter(x => x !== "INIT"), "ERROR"] : ["INIT", "RUN", "DEGRADED", "ERROR"];
    dd.states = { initial: "INIT", states: names.map(n => ({ guid: g(`state:${n}`), name: n, entry: n === "INIT" ? "내부 변수·버퍼 초기화" : n === "ERROR" ? "안전 출력 설정, DTC 기록" : "", do: n === "RUN" ? "입력 읽기 → 처리 → 출력" : "", exit: "", desc: "", reqs: [] })),
      transitions: [{ from: "INIT", to: names[1], trigger: "Init 완료", guard: "자가진단 OK", effect: "", reqs: [] },
        ...names.slice(1, -1).map(n => ({ from: n, to: "ERROR", trigger: "고장 검출", guard: "결함 확정(디바운스)", effect: "안전 상태 진입", reqs: [] })),
        { from: "ERROR", to: "INIT", trigger: "복구 조건", guard: "결함 해소", effect: "재초기화", reqs: [] }] };
  }
  if (!dd.sequences.length) {
    const main = dd.runnables.find(r => r.trigger === "periodic") || dd.runnables[0];
    const steps = [{ from: "RTE", to: uName, msg: main.name, args: "", ret: "", kind: "sync", note: `${main.periodMs}ms 주기` }];
    dd.ports.filter(p => p.dir === "R").slice(0, 4).forEach(p => steps.push({ from: uName, to: "RTE", msg: `Rte_Read_${p.name}`, args: p.elements[0]?.name || "", ret: "Std_ReturnType", kind: "sync", note: "" }));
    steps.push({ from: uName, to: uName, msg: "process", args: "", ret: "", kind: "sync", note: "상태 머신 수행" });
    dd.ports.filter(p => p.dir === "P").slice(0, 4).forEach(p => steps.push({ from: uName, to: "RTE", msg: `Rte_Write_${p.name}`, args: p.elements[0]?.name || "", ret: "Std_ReturnType", kind: "sync", note: "" }));
    dd.sequences.push({ guid: g("seq:Main"), name: `${uName}_MainCycle`, desc: "주기 실행 시나리오", lifelines: ["RTE", uName], steps, reqs: ids(unit?.reqs) });
  }
  if (!dd.activities.length) {
    const op = dd.classes[0].ops.find(o => /Main/.test(o.name)) || dd.classes[0].ops[0];
    const nodes = [{ id: "n0", kind: "start", text: "" }, { id: "n1", kind: "action", text: "입력 읽기" }, { id: "n2", kind: "decision", text: "입력 유효?" }, { id: "n3", kind: "action", text: "처리·상태 천이" }, { id: "n4", kind: "action", text: "대체값·결함 카운트" }, { id: "n5", kind: "merge", text: "" }, { id: "n6", kind: "action", text: "출력 쓰기" }, { id: "n7", kind: "end", text: "" }];
    dd.activities.push({ guid: g(`act:${op.name}`), name: op.name, op: op.name, desc: op.desc, nodes,
      edges: [{ from: "n0", to: "n1", guard: "" }, { from: "n1", to: "n2", guard: "" }, { from: "n2", to: "n3", guard: "예" }, { from: "n2", to: "n4", guard: "아니오" }, { from: "n3", to: "n5", guard: "" }, { from: "n4", to: "n5", guard: "" }, { from: "n5", to: "n6", guard: "" }, { from: "n6", to: "n7", guard: "" }], reqs: op.reqs || [] });
  }
  if (!dd.summary) dd.summary = `${uName}: ${comp ? comp.name + " 컴포넌트의 " : ""}유닛 — 클래스 ${dd.classes.length}·포트 ${dd.ports.length}·Runnable ${dd.runnables.length}·상태 ${dd.states.states.length}·시나리오 ${dd.sequences.length}`;
  if (!dd.origin) dd.origin = "rule";
  if (!dd.generatedAt) dd.generatedAt = new Date().toISOString();
  return dd;
}
export const ruleDD = (unit, model, seedKey) => fillDDGaps(emptyDD(), unit, model, seedKey);

// ── AI 프롬프트 (유닛 1개 = 2회 호출: A 정적 구조 → B 동적 동작) — 근거 자료를 모두 넣고, 요구 ID 추적을 강제한다 ──
function ddContext(unit, model, version) {
  const m = normalizeModel(model);
  const comp = (m.comps.SW || []).find(c => c.id === unit.comp);
  const swReqs = (m.reqs.SW || []).filter(r => ids(unit.reqs).includes(r.id));
  const sysIds = new Set(swReqs.flatMap(r => r.parents || []));
  const sysReqs = (m.reqs.SYS || []).filter(r => sysIds.has(r.id));
  const ifs = (m.interfaces.SW || []).filter(i => comp && (i.from === comp.id || i.to === comp.id));
  const cn = Object.fromEntries((m.comps.SW || []).map(c => [c.id, c.name]));
  const siblings = (m.units.SW || []).filter(u => u.comp === unit.comp && u.id !== unit.id).map(u => `${u.id} ${u.name}`);
  return [
    `[유닛] ${unit.id} ${unit.name} — ${unit.desc || ""}`,
    comp ? `[소속 SW 컴포넌트] ${comp.id} ${comp.name} (${comp.kind || ""}) ${comp.desc || ""}${comp.behavior ? " / 동작: " + comp.behavior : ""}` : "",
    siblings.length ? `[같은 컴포넌트의 다른 유닛] ${siblings.join(", ")}` : "",
    `[할당 SW 요구 — 설계의 근거, 모든 요소의 reqs에 이 ID를 적을 것]\n${swReqs.map(r => `- ${r.id} [${r.type}] ${r.title}: ${r.text}${r.verifCriteria ? " / 검증 기준: " + r.verifCriteria : ""}`).join("\n") || "- (없음)"}`,
    sysReqs.length ? `[상위 시스템 요구]\n${sysReqs.map(r => `- ${r.id} ${r.title}: ${String(r.text || "").slice(0, 200)}`).join("\n")}` : "",
    ifs.length ? `[컴포넌트 인터페이스 — 포트의 근거]\n${ifs.map(i => `- ${i.id} ${cn[i.from] || i.from} → ${cn[i.to] || i.to}: ${i.kind || ""} ${i.signals || ""}${i.periodMs ? ` (${i.periodMs}ms)` : ""} ${i.desc || ""}`).join("\n")}` : "",
    m.modes?.length ? `[운영 모드 — 상태 머신의 근거] ${m.modes.map(x => x.name || x).join(", ")}` : "",
    (unit.funcs || []).length ? `[기존 코드 헤더 ${unit.file}] ${unit.funcs.map(f => `${f.ret} ${f.name}(${f.params})`).join("; ")}` : "",
  ].filter(Boolean).join("\n");
}
export function promptDDStructure({ unit, model, version, settings, guideBlock = "" }) {
  const s = { ...DD_DEFAULT, ...(settings || {}) };
  const T = DD_TARGETS[s.target] || DD_TARGETS.CP;
  return `역할: ASPICE SWE.3(소프트웨어 상세설계 및 유닛 구현) 담당 수석 SW 설계자. 대상 플랫폼 ${T.label} (${s.release}), 코딩 표준 ${s.target === "CP" ? s.misraC : s.misraCpp + " · " + s.cppGuide}.
아래 근거 자료만으로 유닛 1개의 **정적 구조**를 완전하게 설계하세요. 추측한 값은 desc에 "(가정)"이라고 적되 비워 두지 마세요.

${ddContext(unit, model, version)}

설계 규칙:
- 식별자는 영문 C 식별자(ASCII, 공백 없음). 자료형은 AUTOSAR Platform Types(uint8·uint16·sint32·float32·boolean 등) 또는 여기서 정의한 dataTypes 이름만.
- 모든 요소(class·op·port·runnable·dataType)에 reqs: 근거 SW 요구 ID 배열(위 목록의 ID만). 근거가 없으면 [].
- ports: 인터페이스 목록에서 R(수신)/P(송신) 포트를 만들고 elements에 신호(이름·형·단위·범위)를 적는다. ${s.target === "CP" ? "S/R 또는 C/S 포트." : "ara::com 서비스 인터페이스의 이벤트/필드/메서드를 elements로 표현."}
- runnables: 주기(periodMs)·이벤트·init 트리거와 reads/writes(포트 이름)·calls(연산 이름). 주기는 인터페이스 주기나 요구 문장의 수치에서 가져온다.
- classes: 유닛 자체(stereotype "SWC") 1개 + 필요한 내부 클래스(필터·디바운스·진단 등). ops.algo는 구현 가능한 단계별 의사코드 5~15줄 — 수치 조건(이상·이하·범위·시간)은 요구의 값을 그대로 쓴다.
- assoc: 클래스 간 관계(comp 합성·agg 집합·dep 의존·assoc 연관).

${guideBlock}
JSON만 출력 (마크다운 금지):
{"summary":"유닛 역할 2~3문장","dataTypes":[{"name":"","base":"uint16|enum|struct","desc":"","range":"","reqs":[]}],
"classes":[{"name":"","stereotype":"SWC|class","desc":"","reqs":[],"attrs":[{"name":"","type":"","init":"","desc":"","vis":"-"}],"ops":[{"name":"","ret":"","vis":"+","params":[{"name":"","type":"","dir":"in|out|inout"}],"desc":"","pre":"","post":"","algo":["단계"],"reqs":[]}]}],
"ports":[{"name":"","dir":"R|P","kind":"S/R|C/S","interface":"","elements":[{"name":"","type":"","unit":"","range":""}],"source":"인터페이스 ID","reqs":[]}],
"runnables":[{"name":"","trigger":"periodic|event|init","periodMs":10,"event":"","reads":[],"writes":[],"calls":[],"wcetUs":0,"desc":"","reqs":[]}],
"assoc":[{"from":"","to":"","kind":"comp|agg|dep|assoc","label":"","mult":""}]}`;
}
export function promptDDBehavior({ unit, model, version, settings, structure, guideBlock = "" }) {
  const s = { ...DD_DEFAULT, ...(settings || {}) };
  const st = structure || emptyDD();
  const brief = {
    classes: st.classes.map(c => ({ name: c.name, ops: c.ops.map(o => o.name) })),
    ports: st.ports.map(p => `${p.dir}:${p.name}`), runnables: st.runnables.map(r => `${r.name}(${r.trigger}${r.periodMs ? " " + r.periodMs + "ms" : ""})`),
  };
  return `역할: ASPICE SWE.3 담당 수석 SW 설계자 (${DD_TARGETS[s.target]?.label || ""}). 아래 유닛의 **동적 동작**을 완전하게 설계하세요: 상태 머신 1개, 시퀀스 시나리오 2~4개(정상 주기·초기화·고장 처리·인터페이스 이상 중 근거가 있는 것), 핵심 연산의 액티비티 2~4개.

${ddContext(unit, model, version)}

[이미 설계된 정적 구조 — 이 이름만 사용]
${JSON.stringify(brief)}

규칙:
- 상태·전이·시나리오·액티비티마다 reqs에 근거 SW 요구 ID(위 목록의 ID만). 고장·진단 문장이 있으면 ERROR/DEGRADED 상태와 복구 전이를 반드시 포함.
- transitions의 trigger는 이벤트(신호 수신·타이머·진단 결과), guard는 조건식(요구의 수치 그대로), effect는 동작.
- sequences.steps의 from/to는 lifelines의 이름(RTE·유닛 클래스·내부 클래스·다른 유닛), msg는 연산/포트 이름.
- activities.nodes의 kind: start|action|decision|merge|end|fork|join, edges.guard는 decision 분기 조건. 각 액티비티는 op(연산 이름)에 대응.

${guideBlock}
JSON만 출력:
{"states":{"initial":"","states":[{"name":"","entry":"","do":"","exit":"","desc":"","reqs":[]}],"transitions":[{"from":"","to":"","trigger":"","guard":"","effect":"","reqs":[]}]},
"sequences":[{"name":"","desc":"","lifelines":[],"steps":[{"from":"","to":"","msg":"","args":"","ret":"","kind":"sync|async","note":""}],"reqs":[]}],
"activities":[{"name":"","op":"","desc":"","nodes":[{"id":"n1","kind":"start|action|decision|merge|end","text":""}],"edges":[{"from":"","to":"","guard":""}],"reqs":[]}]}`;
}
// 설계가 없는(또는 TBD 골격만인) 유닛
export const ddMissingUnits = m => (normalizeModel(m).units.SW || []).filter(u => !u.dd || !u.dd.classes?.length);

// ═══ 다이어그램 SVG — UML 2.5 표준 표기, 흰 배경(문서·EA 비교용). kind: component|class|state|sequence|activity|bdd|ibd ═══
const X = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tw = (s, fs = 11) => { let w = 0; for (const ch of String(s || "")) w += ch.charCodeAt(0) > 255 ? fs * 0.98 : fs * 0.58; return w; };
const SVG_FONT = "font-family=\"'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',Arial,sans-serif\"";
function svgWrap(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" ${SVG_FONT} font-size="11">
<defs><marker id="ar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#222"/></marker>
<marker id="oar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="#222" stroke-width="1.2"/></marker>
<marker id="dia" viewBox="0 0 12 10" refX="0" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M0,5 L6,0 L12,5 L6,10 z" fill="#222"/></marker>
<marker id="odia" viewBox="0 0 12 10" refX="0" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M0,5 L6,0 L12,5 L6,10 z" fill="#fff" stroke="#222"/></marker>
<marker id="tri" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="11" markerHeight="11" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#fff" stroke="#222"/></marker></defs>
<rect width="100%" height="100%" fill="#fff"/>
<text x="10" y="16" font-size="12" font-weight="700" fill="#333">${X(title)}</text>
${body}</svg>`;
}
const boxText = (x, y, lines, opt = {}) => lines.map((l, i) => `<text x="${x}" y="${y + i * (opt.lh || 14)}" ${opt.anchor ? `text-anchor="${opt.anchor}"` : ""} ${opt.bold && i === 0 ? 'font-weight="700"' : ""} ${opt.italic ? 'font-style="italic"' : ""} fill="#222">${X(l)}</text>`).join("");
function arrowPath(a, b, marker = "ar", dash = "", label = "", opt = {}) {
  const t = opt.t ?? 0.5, mx = a.x + (b.x - a.x) * t, my = a.y + (b.y - a.y) * t;
  const lw = tw(label, 10) + 8;
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#222" stroke-width="1.2" ${dash ? `stroke-dasharray="${dash}"` : ""} marker-end="url(#${marker})"/>${label ? `${opt.bg ? `<rect x="${mx - lw / 2}" y="${my - 13}" width="${lw}" height="13" fill="#fff" fill-opacity="0.9"/>` : ""}<text x="${mx}" y="${my - 3}" text-anchor="middle" font-size="10" fill="#333">${X(label)}</text>` : ""}`;
}
// 사각형 경계와 중심 연결선의 교점
function edgePoint(r, toward) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const sx = dx ? (r.w / 2) / Math.abs(dx) : Infinity, sy = dy ? (r.h / 2) / Math.abs(dy) : Infinity, s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}
function gridLayout(items, estW, estH, perRow = 3, pad = 24, top = 36, left = 20) {
  const rects = []; let x = left, y = top, rowH = 0;
  items.forEach((it, i) => {
    const w = estW(it), h = estH(it);
    if (i && i % perRow === 0) { x = left; y += rowH + pad; rowH = 0; }
    rects.push({ it, x, y, w, h }); x += w + pad; rowH = Math.max(rowH, h);
  });
  const W = Math.max(...rects.map(r => r.x + r.w), 300) + left, H = y + rowH + 24;
  return { rects, W, H };
}

export function ddSvg(kind, unit, model) {
  const dd = unit?.dd; if (!dd) return "";
  const m = normalizeModel(model);
  const uName = (dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0])?.name || unitIdent(unit);
  const comp = (m.comps.SW || []).find(c => c.id === unit.comp);
  const title = `${unit.id} ${unit.name} — ${({ component: "컴포넌트 다이어그램", class: "클래스 다이어그램", state: "상태 머신 다이어그램", sequence: "시퀀스 다이어그램", activity: "액티비티 다이어그램", bdd: "SysML 블록 정의 다이어그램(BDD)", ibd: "SysML 내부 블록 다이어그램(IBD)" })[kind] || kind}`;
  if (kind === "class") {
    const est = c => { const lines = [`«${c.stereotype || "class"}»`, c.name, ...c.attrs.map(a => `${a.vis} ${a.name}: ${a.type}${a.init ? " = " + a.init : ""}`), ...c.ops.map(o => `${o.vis} ${o.name}(${o.params.map(p => `${p.dir !== "in" ? p.dir + " " : ""}${p.name}: ${p.type}`).join(", ")}): ${o.ret}`)]; return Math.min(360, Math.max(140, ...lines.map(l => tw(l) + 20))); };
    const { rects, W, H } = gridLayout(dd.classes, est, c => 40 + 14 * (c.attrs.length || 1) + 14 * (c.ops.length || 1) + 16, 3);
    const byName = Object.fromEntries(rects.map(r => [r.it.name, r]));
    let b = rects.map(r => { const c = r.it; const aH = 14 * (c.attrs.length || 1) + 8, y1 = r.y + 34;
      return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#FFFFE0" stroke="#222"/>
<text x="${r.x + r.w / 2}" y="${r.y + 13}" text-anchor="middle" font-size="9" fill="#555">«${X(c.stereotype || "class")}»</text><text x="${r.x + r.w / 2}" y="${r.y + 27}" text-anchor="middle" font-weight="700" fill="#222">${X(c.name)}</text>
<line x1="${r.x}" y1="${y1}" x2="${r.x + r.w}" y2="${y1}" stroke="#222"/>${boxText(r.x + 6, y1 + 13, c.attrs.length ? c.attrs.map(a => `${a.vis} ${a.name}: ${a.type}${a.init ? " = " + a.init : ""}`.slice(0, 52)) : [""])}
<line x1="${r.x}" y1="${y1 + aH}" x2="${r.x + r.w}" y2="${y1 + aH}" stroke="#222"/>${boxText(r.x + 6, y1 + aH + 13, c.ops.length ? c.ops.map(o => `${o.vis} ${o.name}(${o.params.map(p => p.name).join(", ")}): ${o.ret}`.slice(0, 52)) : [""])}`; }).join("");
    dd.assoc.forEach(a => { const f = byName[a.from], t = byName[a.to]; if (!f || !t) return; const p1 = edgePoint(f, { x: t.x + t.w / 2, y: t.y + t.h / 2 }), p2 = edgePoint(t, { x: f.x + f.w / 2, y: f.y + f.h / 2 });
      b += a.kind === "dep" ? arrowPath(p1, p2, "oar", "5,4", a.label) : a.kind === "gen" ? arrowPath(p1, p2, "tri", "", a.label) : `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#222" stroke-width="1.2" ${a.kind === "comp" ? 'marker-start="url(#dia)"' : a.kind === "agg" ? 'marker-start="url(#odia)"' : ""}/>${a.label || a.mult ? `<text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 4}" text-anchor="middle" font-size="10" fill="#333">${X([a.label, a.mult].filter(Boolean).join(" "))}</text>` : ""}`; });
    return svgWrap(W, H, b, title);
  }
  if (kind === "component" || kind === "ibd") {
    // 중앙: 유닛(컴포넌트/파트), 좌: 수신 포트와 상대 컴포넌트, 우: 송신 포트와 상대
    const Rp = dd.ports.filter(p => p.dir === "R"), Pp = dd.ports.filter(p => p.dir === "P");
    const rows = Math.max(Rp.length, Pp.length, 1), rowH = 46, cx = 360, cw = 300, ch = Math.max(110, rows * rowH + 70), top = 50;
    const cutC = (t, n) => { const x = String(t || ""); return x.length > n ? x.slice(0, n - 1) + "…" : x; };
    const cn = Object.fromEntries((m.comps.SW || []).map(c => [c.id, c.name]));
    const other = p => { const i = (m.interfaces.SW || []).find(x => x.id === p.source); return i ? (p.dir === "R" ? cn[i.from] || i.from : cn[i.to] || i.to) : (p.dir === "R" ? "Sender" : "Receiver"); };
    const compIcon = (x, y) => `<rect x="${x}" y="${y}" width="14" height="18" fill="#fff" stroke="#222"/><rect x="${x - 4}" y="${y + 3}" width="8" height="4" fill="#fff" stroke="#222"/><rect x="${x - 4}" y="${y + 10}" width="8" height="4" fill="#fff" stroke="#222"/>`;
    let b = kind === "ibd" ? `<rect x="40" y="${top - 22}" width="${cx + cw + 360}" height="${ch + 60}" fill="none" stroke="#222"/><text x="48" y="${top - 8}" font-weight="700">ibd [block] ${X(comp?.name || uName)}</text>` : "";
    b += `<rect x="${cx}" y="${top}" width="${cw}" height="${ch}" fill="#E8F0FE" stroke="#222" stroke-width="1.4"/>${kind === "component" ? compIcon(cx + cw - 24, top + 6) : ""}
<text x="${cx + cw / 2}" y="${top + 16}" text-anchor="middle" font-size="9" fill="#555">${kind === "ibd" ? "«part»" : "«component» " + X(DD_TARGETS[ddSettings(m).target]?.unitKind || "")}</text><text x="${cx + cw / 2}" y="${top + 32}" text-anchor="middle" font-weight="700">${X(uName)}</text>
<text x="${cx + cw / 2}" y="${top + 46}" text-anchor="middle" font-size="9.5" fill="#555">${X(dd.runnables.map(r => `${r.name}${r.periodMs ? " " + r.periodMs + "ms" : ""}`).join(" · ").slice(0, 44))}</text>`;
    Rp.forEach((p, i) => { const y = top + 70 + i * rowH; const ox = 60, ow = 150;
      b += `<rect x="${ox}" y="${y - 14}" width="${ow}" height="30" fill="#F5F5F5" stroke="#222"/><text x="${ox + ow / 2}" y="${y + 5}" text-anchor="middle" font-size="10">${X(other(p))}</text>
<rect x="${cx - 7}" y="${y - 7}" width="14" height="14" fill="#fff" stroke="#222"/><line x1="${ox + ow}" y1="${y}" x2="${cx - 26}" y2="${y}" stroke="#222"/><path d="M${cx - 26},${y - 8} a8,8 0 0 0 0,16" fill="none" stroke="#222"/><circle cx="${ox + ow + 10}" cy="${y}" r="0" />
<text x="${cx + 10}" y="${y + 4}" font-size="9.5"><title>${X(`${p.name}: ${p.interface}`)}</title>${X(cutC(p.name, 20))}</text><g><title>${X(p.elements.map(e => `${e.name}: ${e.type}`).join(", "))}</title><text x="${(ox + ow + cx - 26) / 2}" y="${y - 6}" text-anchor="middle" font-size="8.5" fill="#555">${X(cutC(p.elements.map(e => e.name).join(", "), 22))}</text></g>`; });
    Pp.forEach((p, i) => { const y = top + 70 + i * rowH; const ox = cx + cw + 170, ow = 150;
      b += `<rect x="${ox}" y="${y - 14}" width="${ow}" height="30" fill="#F5F5F5" stroke="#222"/><text x="${ox + ow / 2}" y="${y + 5}" text-anchor="middle" font-size="10">${X(other(p))}</text>
<rect x="${cx + cw - 7}" y="${y - 7}" width="14" height="14" fill="#fff" stroke="#222"/><line x1="${cx + cw + 7}" y1="${y}" x2="${cx + cw + 44}" y2="${y}" stroke="#222"/><circle cx="${cx + cw + 50}" cy="${y}" r="6" fill="#fff" stroke="#222"/><line x1="${cx + cw + 56}" y1="${y}" x2="${ox}" y2="${y}" stroke="#222"/>
<text x="${cx + cw - 10}" y="${y + 4}" text-anchor="end" font-size="9.5"><title>${X(`${p.name}: ${p.interface}`)}</title>${X(cutC(p.name, 20))}</text><g><title>${X(p.elements.map(e => `${e.name}: ${e.type}`).join(", "))}</title><text x="${(cx + cw + 56 + ox) / 2}" y="${y - 6}" text-anchor="middle" font-size="8.5" fill="#555">${X(cutC(p.elements.map(e => e.name).join(", "), 22))}</text></g>`; });
    return svgWrap(cx + cw + 380, top + ch + 50, b, title);
  }
  if (kind === "bdd") {
    // 블록: 컴포넌트(상위) ◆→ 유닛 블록 → 내부 클래스 블록. 값(values)=속성, 연산(operations)
    const blocks = [{ name: comp?.name || "SW", st: "block", vals: [], ops: [], top: true }, ...dd.classes.map(c => ({ name: c.name, st: "block", vals: c.attrs.map(a => `${a.name}: ${a.type}`), ops: c.ops.map(o => `${o.name}()`), ports: c.name === dd.classes[0].name ? dd.ports.map(p => `${p.dir === "R" ? "in" : "out"} ${p.name}: ${p.interface}`) : [] }))];
    const estW = bk => Math.min(300, Math.max(150, ...[bk.name, ...bk.vals, ...bk.ops, ...(bk.ports || [])].map(l => tw(l) + 20)));
    const estH = bk => 36 + (bk.vals.length ? 16 + 13 * bk.vals.length : 0) + (bk.ops.length ? 16 + 13 * bk.ops.length : 0) + ((bk.ports || []).length ? 16 + 13 * bk.ports.length : 0) + 8;
    const topR = { it: blocks[0], x: 20, y: 36, w: estW(blocks[0]), h: estH(blocks[0]) };
    const { rects: rs, W, H } = gridLayout(blocks.slice(1), estW, estH, 3, 24, topR.y + topR.h + 50);
    const rects = [topR, ...rs];
    let b = rects.map(r => { const bk = r.it; let y = r.y + 30; let s = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#FFF" stroke="#222"/><text x="${r.x + r.w / 2}" y="${r.y + 12}" text-anchor="middle" font-size="9" fill="#555">«block»</text><text x="${r.x + r.w / 2}" y="${r.y + 25}" text-anchor="middle" font-weight="700">${X(bk.name)}</text>`;
      const sect = (label, lines) => { if (!lines.length) return; s += `<line x1="${r.x}" y1="${y + 2}" x2="${r.x + r.w}" y2="${y + 2}" stroke="#222"/><text x="${r.x + r.w / 2}" y="${y + 13}" text-anchor="middle" font-size="9" fill="#555">${label}</text>${boxText(r.x + 6, y + 26, lines.map(l => l.slice(0, 48)), { lh: 13 })}`; y += 16 + 13 * lines.length; };
      sect("values", bk.vals); sect("operations", bk.ops); sect("ports", bk.ports || []); return s; }).join("");
    rects.slice(1).forEach(r => { const a = edgePoint(topR, { x: r.x + r.w / 2, y: r.y + r.h / 2 }), c = edgePoint(r, { x: topR.x + topR.w / 2, y: topR.y + topR.h / 2 }); b += `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="#222" stroke-width="1.2" marker-start="url(#dia)"/>`; });
    return svgWrap(Math.max(W, topR.x + topR.w + 20), H, b, title);
  }
  if (kind === "state") {
    const S = dd.states.states; if (!S.length) return svgWrap(400, 80, `<text x="20" y="50">상태 없음</text>`, title);
    const cut = (t, n) => { const x = String(t || ""); return x.length > n ? x.slice(0, n - 1) + "…" : x; };
    const n = S.length, R = Math.max(150, n * 48) + (n > 4 ? 40 : 0), cx0 = R + 180, cy0 = R + 80;
    const rects = S.map((s, i) => { const ang = -Math.PI / 2 + (2 * Math.PI * i) / n; const w = Math.max(120, tw(s.name) + 30, ...[s.entry, s.do, s.exit].filter(Boolean).map(x => tw(cut("entry / " + x, 34)) + 14)), h = 34 + (s.entry ? 13 : 0) + (s.do ? 13 : 0) + (s.exit ? 13 : 0); return { it: s, x: cx0 + Math.cos(ang) * R - w / 2, y: cy0 + Math.sin(ang) * R - h / 2, w: Math.min(w, 230), h }; });
    const by = Object.fromEntries(rects.map(r => [r.it.name, r]));
    let b = rects.map(r => { const s = r.it; const full = [s.entry && `entry / ${s.entry}`, s.do && `do / ${s.do}`, s.exit && `exit / ${s.exit}`].filter(Boolean); const extra = full.map(l => cut(l, 34));
      return `<g><title>${X(full.join("\n"))}</title><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="#FFFFE0" stroke="#222"/><text x="${r.x + r.w / 2}" y="${r.y + 16}" text-anchor="middle" font-weight="700">${X(s.name)}</text>${extra.length ? `<line x1="${r.x}" y1="${r.y + 22}" x2="${r.x + r.w}" y2="${r.y + 22}" stroke="#222"/>${boxText(r.x + 6, r.y + 34, extra, { lh: 13 })}` : ""}</g>`; }).join("");
    const init = by[dd.states.initial]; if (init) { const p = { x: init.x + init.w / 2, y: init.y - 36 }; b += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#222"/>` + arrowPath({ x: p.x, y: p.y + 7 }, { x: init.x + init.w / 2, y: init.y }); }
    const seen = {};
    const legend = [];
    dd.states.transitions.forEach((t, ti) => { const f = by[t.from], g2 = by[t.to]; if (!f || !g2) return; const full = [t.trigger, t.guard ? `[${t.guard}]` : "", t.effect ? `/ ${t.effect}` : ""].filter(Boolean).join(" "); const id = `T${ti + 1}`; const lab = `${id} ${cut(full, 26)}`; legend.push([id, `${t.from} → ${t.to}`, full]);
      const lw = tw(lab, 9.5) + 6;
      if (f === g2) { const x = f.x + f.w, y = f.y + 10; b += `<g><title>${X(full)}</title><path d="M${x},${y} C${x + 40},${y - 30} ${x + 40},${y + 40} ${x},${y + 24}" fill="none" stroke="#222" marker-end="url(#ar)"/><rect x="${x + 42}" y="${y - 2}" width="${lw}" height="12" fill="#fff" fill-opacity="0.9"/><text x="${x + 45}" y="${y + 8}" font-size="9.5">${X(lab)}</text></g>`; return; }
      const k = [t.from, t.to].sort().join("|"); const nth = (seen[k] = (seen[k] || 0) + 1); const off = (nth - 1) * 22;
      const p1 = edgePoint(f, { x: g2.x + g2.w / 2, y: g2.y + g2.h / 2 }), p2 = edgePoint(g2, { x: f.x + f.w / 2, y: f.y + f.h / 2 });
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, nx = -(p2.y - p1.y), ny = p2.x - p1.x, L = Math.hypot(nx, ny) || 1, c = { x: mx + (nx / L) * (30 + off), y: my + (ny / L) * (30 + off) };
      // 라벨은 출발점에서 35% 지점(곡선 위) — 같은 쌍의 역방향 전이와 겹치지 않도록
      const tt = 0.35, qx = (1 - tt) * (1 - tt) * p1.x + 2 * (1 - tt) * tt * c.x + tt * tt * p2.x, qy = (1 - tt) * (1 - tt) * p1.y + 2 * (1 - tt) * tt * c.y + tt * tt * p2.y;
      b += `<g><title>${X(full)}</title><path d="M${p1.x},${p1.y} Q${c.x},${c.y} ${p2.x},${p2.y}" fill="none" stroke="#222" stroke-width="1.2" marker-end="url(#ar)"/><rect x="${qx - lw / 2}" y="${qy - 11}" width="${lw}" height="12" fill="#fff" fill-opacity="0.9"/><text x="${qx}" y="${qy - 2}" text-anchor="middle" font-size="9.5" fill="#333">${X(lab)}</text></g>`; });
    let ly = cy0 + R + 70; const W = Math.max(cx0 + R + 180, 720);
    if (legend.length) { b += `<text x="30" y="${ly}" font-weight="700">전이 범례 (trigger [guard] / effect)</text>`; ly += 6; legend.forEach(([id, ft, d]) => { ly += 14; b += `<text x="30" y="${ly}" font-size="9.5" fill="#333"><tspan font-family="monospace">${X(id)}</tspan>  ${X(ft)} — ${X(cut(d, 110))}</text>`; }); ly += 16; }
    return svgWrap(W, ly, b, title);
  }
  if (kind === "sequence") {
    const seqs = dd.sequences; if (!seqs.length) return svgWrap(400, 80, `<text x="20" y="50">시나리오 없음</text>`, title);
    let y0 = 30, W = 400; const parts = [];
    seqs.forEach(sq => {
      const ll = sq.lifelines.length ? sq.lifelines : [...new Set(sq.steps.flatMap(s => [s.from, s.to]))];
      const colW = Math.max(130, ...ll.map(l => tw(l) + 30)), x0 = 40, xs = Object.fromEntries(ll.map((l, i) => [l, x0 + colW / 2 + i * colW]));
      const top = y0 + 22, H = 60 + sq.steps.length * 30 + 20;
      let s = `<rect x="${x0 - 20}" y="${y0}" width="${ll.length * colW + 40}" height="${H}" fill="none" stroke="#222"/><path d="M${x0 - 20},${y0} h${Math.min(320, tw("sd " + (sq.title || sq.name)) + 24)} v16 l-8,8 H${x0 - 20} z" fill="#F5F5F5" stroke="#222"/><text x="${x0 - 14}" y="${y0 + 13}" font-weight="700">sd ${X(sq.title || (/_{3,}/.test(sq.name) ? String(sq.name).replace(/_+$/, "").replace(/_{2,}/g, " ") : sq.name))}</text>`;
      ll.forEach(l => { const x = xs[l]; s += `<rect x="${x - colW / 2 + 10}" y="${top + 10}" width="${colW - 20}" height="26" fill="#E8F0FE" stroke="#222"/><text x="${x}" y="${top + 27}" text-anchor="middle" font-weight="700">${X(l)}</text><line x1="${x}" y1="${top + 36}" x2="${x}" y2="${y0 + H - 6}" stroke="#222" stroke-dasharray="4,3"/>`; });
      sq.steps.forEach((st, i) => { const y = top + 60 + i * 30, a = xs[st.from], c = xs[st.to]; if (a == null || c == null) return; const cleanMsg = String(st.msg || "").replace(/_{2,}/g, "_").replace(/_+$/, ""); const lab = `${i + 1}: ${cleanMsg}(${/^\(?none\)?$/i.test(String(st.args || "")) ? "" : st.args || ""})`.slice(0, 60);
        if (a === c) s += `<path d="M${a},${y} h30 v16 h-30" fill="none" stroke="#222" marker-end="url(#ar)"/><text x="${a + 34}" y="${y + 12}" font-size="9.5">${X(lab)}</text>`;
        else s += `<line x1="${a}" y1="${y}" x2="${c}" y2="${y}" stroke="#222" stroke-width="1.2" ${st.kind === "async" ? 'marker-end="url(#oar)"' : 'marker-end="url(#ar)"'}/><text x="${(a + c) / 2}" y="${y - 4}" text-anchor="middle" font-size="9.5">${X(lab)}</text>${st.ret ? `<line x1="${c}" y1="${y + 14}" x2="${a}" y2="${y + 14}" stroke="#222" stroke-dasharray="4,3" marker-end="url(#oar)"/><text x="${(a + c) / 2}" y="${y + 25}" text-anchor="middle" font-size="8.5" fill="#555">${X(st.ret)}</text>` : ""}`; });
      parts.push(s); W = Math.max(W, ll.length * colW + 80); y0 += H + 30;
    });
    return svgWrap(W, y0, parts.join(""), title);
  }
  if (kind === "activity") {
    const acts = dd.activities; if (!acts.length) return svgWrap(400, 80, `<text x="20" y="50">액티비티 없음</text>`, title);
    let x0 = 20, W = 0, H = 0; const parts = [];
    acts.forEach(a => {
      // 위상 정렬로 세로 배치, decision의 두 번째 분기는 오른쪽 열
      const out = {}; a.edges.forEach(e => { (out[e.from] = out[e.from] || []).push(e); });
      const depth = {}; const start = a.nodes.find(n => n.kind === "start") || a.nodes[0]; const q = [[start?.id, 0]]; const seen = new Set();
      while (q.length) { const [id, d] = q.shift(); if (!id || seen.has(id)) continue; seen.add(id); depth[id] = d; (out[id] || []).forEach(e => q.push([e.to, d + 1])); }
      a.nodes.forEach((n, i) => { if (depth[n.id] == null) depth[n.id] = i; });
      const col = {}; a.nodes.forEach(n => { col[n.id] = 0; }); a.nodes.filter(n => n.kind === "decision").forEach(n => { (out[n.id] || []).slice(1).forEach(e => { col[e.to] = 1; }); });
      const colW = 230, rowH = 64, pos = {}; a.nodes.forEach(n => { pos[n.id] = { x: x0 + 110 + col[n.id] * colW, y: 60 + depth[n.id] * rowH }; });
      const sz = n => n.kind === "action" ? { w: Math.min(200, Math.max(90, tw(n.text) + 24)), h: 34 } : n.kind === "decision" || n.kind === "merge" ? { w: 36, h: 36 } : n.kind === "fork" || n.kind === "join" ? { w: 120, h: 6 } : { w: 18, h: 18 };
      let s = `<text x="${x0}" y="${36}" font-weight="700">act ${X(a.name)}${a.op && a.op !== a.name ? ` (${X(a.op)})` : ""}</text>`;
      const rect = {}; a.nodes.forEach(n => { const p = pos[n.id], d = sz(n); rect[n.id] = { x: p.x - d.w / 2, y: p.y - d.h / 2, w: d.w, h: d.h };
        s += n.kind === "action" ? `<rect x="${p.x - d.w / 2}" y="${p.y - d.h / 2}" width="${d.w}" height="${d.h}" rx="12" fill="#FFFFE0" stroke="#222"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="10">${X(n.text.slice(0, 32))}</text>`
          : n.kind === "decision" || n.kind === "merge" ? `<path d="M${p.x},${p.y - 18} L${p.x + 18},${p.y} L${p.x},${p.y + 18} L${p.x - 18},${p.y} z" fill="#fff" stroke="#222"/>${n.text ? `<text x="${p.x + 22}" y="${p.y - 14}" font-size="9.5">${X(n.text.slice(0, 30))}</text>` : ""}`
          : n.kind === "start" ? `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#222"/>` : n.kind === "end" ? `<circle cx="${p.x}" cy="${p.y}" r="10" fill="#fff" stroke="#222"/><circle cx="${p.x}" cy="${p.y}" r="6" fill="#222"/>` : `<rect x="${p.x - 60}" y="${p.y - 3}" width="120" height="6" fill="#222"/>`; });
      a.edges.forEach(e => { const f = rect[e.from], t = rect[e.to]; if (!f || !t) return; const p1 = edgePoint(f, { x: t.x + t.w / 2, y: t.y + t.h / 2 }), p2 = edgePoint(t, { x: f.x + f.w / 2, y: f.y + f.h / 2 }); s += arrowPath(p1, p2, "ar", "", e.guard ? `[${e.guard}]` : ""); });
      const maxD = Math.max(...Object.values(depth), 0), maxC = Math.max(...Object.values(col), 0);
      parts.push(s); W = Math.max(W, x0 + 110 + maxC * colW + 130); H = Math.max(H, 60 + (maxD + 1) * rowH + 20); x0 += 110 + (maxC + 1) * colW + 40;
    });
    return svgWrap(Math.max(W, x0), H, parts.join(""), title);
  }
  return "";
}
export const DD_DIAGRAMS = [["component", "컴포넌트"], ["class", "클래스"], ["sequence", "시퀀스"], ["state", "상태 머신"], ["activity", "액티비티"], ["bdd", "SysML BDD"], ["ibd", "SysML IBD"]];


// ═══════════════════════════════════════════════════════════════════════════
// 13) SWE.3 → XMI 2.1 (UML 2.x) 내보내기 — Sparx Systems Enterprise Architect 17.x 'Import Package from XMI' 입력용
//    표준 부분: uml:Model/Package/Component/Class/Interface/StateMachine/Interaction/Activity/Association/Dependency
//    확장 부분(xmi:Extension extender="Enterprise Architect"): 요소 속성·커넥터·다이어그램 배치 — 상호운용을 위한 형식 호환이며
//    Cadence/Sparx의 라이브러리·아이콘·프로파일 자산은 포함하지 않는다. SysML 블록은 표준 SysML 네임스페이스 + 스테레오타입 태그로 표기.
//    xmi:id는 추적 모델의 영구 GUID(EAID_…)를 쓰므로 재내보내기·재반입 시 같은 요소로 매칭된다.
// ═══════════════════════════════════════════════════════════════════════════
export function buildXmi(model, meta, opts = {}) {
  const m = normalizeModel(model);
  const units = (m.units.SW || []).filter(u => u.dd?.classes?.length && (!opts.unitIds || opts.unitIds.includes(u.id)));
  const seed = opts.seed || meta?.name || "project";
  const G = s => xmiIdOf(guidFor(`${seed}|xmi|${s}`));
  const PK = s => "EAPK_" + guidFor(`${seed}|pkg|${s}`).replace(/[{}]/g, "").replace(/-/g, "_");
  const A = s => X(s);
  let lid = 1; const localId = () => lid++;
  const E = [];        // 확장: elements
  const C = [];        // 확장: connectors
  const D = [];        // 확장: diagrams
  const STEREO = [];   // SysML 스테레오타입 적용(표준 네임스페이스)
  const rootPk = PK("root");
  const ext = (id, type, name, pkg, { sType, nType = 0, stereotype = "", doc = "", tags = [] } = {}) => {
    E.push(`<element xmi:idref="${id}" xmi:type="${type}" name="${A(name)}" scope="public"><model package="${pkg}" tpos="0" ea_localid="${localId()}" ea_eleType="element"/><properties documentation="${A(doc)}" isSpecification="false" sType="${sType || type.replace("uml:", "")}" nType="${nType}" scope="public"${stereotype ? ` stereotype="${A(stereotype)}"` : ""}/><project author="${A(meta?.author || meta?.pm || "SPIDer QA Agent")}" version="1.0" phase="1.0" created="${new Date().toISOString().slice(0, 19)}" modified="${new Date().toISOString().slice(0, 19)}" complexity="1" status="Proposed"/>${tags.length ? `<tags>${tags.map(t => `<tag xmi:id="${G(id + ":tag:" + t[0])}" name="${A(t[0])}" value="${A(t[1])}" modelElement="${id}"/>`).join("")}</tags>` : ""}</element>`);
  };
  const conn = (id, type, src, dst, { name = "", eaType = type.replace("uml:", ""), srcAgg = 0, dstAgg = 0, seqno = 0, direction = "Source -> Destination", guard = "" } = {}) => {
    C.push(`<connector xmi:idref="${id}"><source xmi:idref="${src}"><model type="Class"/><role visibility="Public" targetScope="instance"/><type aggregation="${srcAgg === 2 ? "composite" : srcAgg === 1 ? "shared" : "none"}" containment="Unspecified"/><modifiers isOrdered="false" changeable="none" isNavigable="false"/></source><target xmi:idref="${dst}"><model type="Class"/><role visibility="Public" targetScope="instance"/><type aggregation="${dstAgg === 2 ? "composite" : dstAgg === 1 ? "shared" : "none"}" containment="Unspecified"/><modifiers isOrdered="false" changeable="none" isNavigable="true"/></target><model ea_localid="${localId()}"/><properties ea_type="${eaType}" direction="${direction}"${seqno ? ` seqno="${seqno}"` : ""}/><labels${name ? ` mt="${A(name)}"` : ""}/>${guard ? `<extendedProperties guard="${A(guard)}"/>` : ""}</connector>`);
  };
  const dia = (id, name, type, pkg, placed, style = "") => {
    D.push(`<diagram xmi:id="${id}"><model package="${pkg}" localID="${localId()}" owner="${pkg}"/><properties name="${A(name)}" type="${type}"/><project author="SPIDer QA Agent" version="1.0" created="${new Date().toISOString().slice(0, 19)}" modified="${new Date().toISOString().slice(0, 19)}"/><style1 value="ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;PPgs.cy=0;DocSize.cx=795;DocSize.cy=1138;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=9;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;${style}"/><style2 value="SaveTag=;ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=1;MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;MatrixLocked=0;TConnectorNotation=UML 2.1;TExplicitNavigability=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ProfileData=;MDGDgm=${style.includes("MDGDgm") ? "" : ""};STBLDgm=;ShowNotes=0;VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;SuppressedCompartments=;Theme=:119;"/><swimlanes value="locked=false;orientation=0;width=0;inbar=false;names=false;color=-1;bold=false;fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;hh=0;cls=0;bw=0;hli=0;bro=0;SwimlaneFont=lfh:-13,lfw:0,lfi:0,lfu:0,lfs:0,lfface:Calibri,lfSize:10;"/><matrixitems value="locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;"/><extendedProperties/><elements>${placed.map((p, i) => `<element geometry="Left=${Math.round(p.x)};Top=${Math.round(p.y)};Right=${Math.round(p.x + p.w)};Bottom=${Math.round(p.y + p.h)};" subject="${p.id}" seqno="${i + 1}" style="DUID=${guidFor(id + p.id).slice(1, 9)};"/>`).join("")}</elements></diagram>`);
  };

  let body = `<packagedElement xmi:type="uml:Package" xmi:id="${rootPk}" name="${A((meta?.name || "Project") + " — SWE.3 상세설계")}">`;
  ext(rootPk, "uml:Package", (meta?.name || "Project") + " — SWE.3 상세설계", "EAPK_ROOT", { sType: "Package" });
  // 공용 자료형 패키지
  const typePk = PK("types"), typeEls = [];
  ext(typePk, "uml:Package", "DataTypes", rootPk, { sType: "Package" });
  const typeIds = {};
  const typeId = name => { const n = cid(name); if (!typeIds[n]) { typeIds[n] = G("type:" + n); typeEls.push(`<packagedElement xmi:type="uml:DataType" xmi:id="${typeIds[n]}" name="${A(n)}"/>`); ext(typeIds[n], "uml:DataType", n, typePk, { sType: "DataType" }); } return typeIds[n]; };
  ["uint8", "uint16", "uint32", "sint8", "sint16", "sint32", "float32", "boolean", "Std_ReturnType", "void"].forEach(typeId);

  units.forEach(u => {
    const dd = u.dd, uPk = PK(u.id);
    body += `<packagedElement xmi:type="uml:Package" xmi:id="${uPk}" name="${A(u.id + " " + u.name)}">`;
    ext(uPk, "uml:Package", `${u.id} ${u.name}`, rootPk, { sType: "Package", doc: dd.summary, tags: [["reqs", (u.reqs || []).join(", ")]] });
    dd.dataTypes.forEach(t => typeId(t.name));
    // 클래스 / 컴포넌트(SWC) / 블록
    const clsId = {};
    dd.classes.forEach(c => {
      const id = xmiIdOf(c.guid); clsId[c.name] = id;
      const isSwc = c.stereotype === "SWC";
      body += `<packagedElement xmi:type="${isSwc ? "uml:Component" : "uml:Class"}" xmi:id="${id}" name="${A(c.name)}">`;
      c.attrs.forEach((a, i) => { const aid = G(`${c.guid}:attr:${a.name}`); body += `<ownedAttribute xmi:type="uml:Property" xmi:id="${aid}" name="${A(a.name)}" visibility="${a.vis === "+" ? "public" : a.vis === "#" ? "protected" : "private"}" isStatic="false" isReadOnly="false" isDerived="false" isOrdered="false" isUnique="true" isDerivedUnion="false" aggregation="none"><type xmi:idref="${typeId(a.type)}"/>${a.init ? `<defaultValue xmi:type="uml:LiteralString" xmi:id="${aid}_dv" value="${A(a.init)}"/>` : ""}</ownedAttribute>`; });
      c.ops.forEach(o => { const oid = G(`${c.guid}:op:${o.name}`); body += `<ownedOperation xmi:id="${oid}" name="${A(o.name)}" visibility="${o.vis === "-" ? "private" : "public"}" concurrency="sequential">${o.params.map(p => `<ownedParameter xmi:id="${G(oid + ":p:" + p.name)}" name="${A(p.name)}" direction="${p.dir}"><type xmi:idref="${typeId(p.type)}"/></ownedParameter>`).join("")}<ownedParameter xmi:id="${oid}_ret" name="return" direction="return"><type xmi:idref="${typeId(o.ret)}"/></ownedParameter></ownedOperation>`; });
      if (isSwc) dd.ports.forEach(p => { const pid = xmiIdOf(p.guid); body += `<ownedAttribute xmi:type="uml:Port" xmi:id="${pid}" name="${A(p.name)}" visibility="public" isService="${p.dir === "P"}" aggregation="composite"><type xmi:idref="${G("if:" + p.interface)}"/></ownedAttribute>`; ext(pid, "uml:Port", p.name, uPk, { sType: "Port", doc: `${p.dir === "R" ? "Required" : "Provided"} · ${p.kind} · ${p.elements.map(e => `${e.name}:${e.type}`).join(", ")}`, tags: [["direction", p.dir === "R" ? "required" : "provided"], ["interface", p.interface], ["reqs", (p.reqs || []).join(", ")]] }); });
      body += `</packagedElement>`;
      ext(id, isSwc ? "uml:Component" : "uml:Class", c.name, uPk, { sType: isSwc ? "Component" : "Class", stereotype: isSwc ? "SWC,block" : "block", doc: c.desc, tags: [["reqs", (c.reqs || []).join(", ")], ["algorithm", c.ops.map(o => `${o.name}: ${(o.algo || []).join(" → ")}`).join(" | ").slice(0, 2000)]] });
      STEREO.push(`<sysml:Block xmi:id="${G("stereo:block:" + id)}" base_Class="${id}"/>`);
    });
    // 인터페이스(포트 타입)
    const ifSeen = new Set();
    dd.ports.forEach(p => { if (ifSeen.has(p.interface)) return; ifSeen.add(p.interface); const iid = G("if:" + p.interface);
      body += `<packagedElement xmi:type="uml:Interface" xmi:id="${iid}" name="${A(p.interface)}">${p.elements.map(e => `<ownedAttribute xmi:type="uml:Property" xmi:id="${G(iid + ":el:" + e.name)}" name="${A(e.name)}" visibility="public"><type xmi:idref="${typeId(e.type)}"/></ownedAttribute>`).join("")}</packagedElement>`;
      ext(iid, "uml:Interface", p.interface, uPk, { sType: "Interface", stereotype: p.kind === "C/S" ? "ClientServerInterface" : "SenderReceiverInterface", doc: `${p.kind} 인터페이스 · 출처 ${p.source || "-"}` }); });
    // 관계
    dd.assoc.forEach((a, i) => { const f = clsId[a.from], t = clsId[a.to]; if (!f || !t) return; const aid = G(`${u.id}:assoc:${i}:${a.from}-${a.to}`);
      if (a.kind === "dep") { body += `<packagedElement xmi:type="uml:Dependency" xmi:id="${aid}" name="${A(a.label)}" client="${f}" supplier="${t}"/>`; conn(aid, "uml:Dependency", f, t, { name: a.label }); }
      else if (a.kind === "gen") { body += `<packagedElement xmi:type="uml:Generalization" xmi:id="${aid}" general="${t}" specific="${f}"/>`; conn(aid, "uml:Generalization", f, t); }
      else { body += `<packagedElement xmi:type="uml:Association" xmi:id="${aid}" name="${A(a.label)}" memberEnd="${aid}_s ${aid}_d"><ownedEnd xmi:type="uml:Property" xmi:id="${aid}_s" association="${aid}" aggregation="${a.kind === "comp" ? "composite" : a.kind === "agg" ? "shared" : "none"}"><type xmi:idref="${f}"/></ownedEnd><ownedEnd xmi:type="uml:Property" xmi:id="${aid}_d" association="${aid}" aggregation="none"><type xmi:idref="${t}"/></ownedEnd></packagedElement>`; conn(aid, "uml:Association", f, t, { name: a.label, srcAgg: a.kind === "comp" ? 2 : a.kind === "agg" ? 1 : 0, eaType: a.kind === "comp" || a.kind === "agg" ? "Aggregation" : "Association" }); } });
    // 상태 머신
    const smId = G(`${u.id}:sm`), rgId = smId + "_rg", stId = {};
    if (dd.states.states.length) {
      body += `<packagedElement xmi:type="uml:StateMachine" xmi:id="${smId}" name="${A(u.name + " StateMachine")}"><region xmi:type="uml:Region" xmi:id="${rgId}" name="Region">`;
      ext(smId, "uml:StateMachine", `${u.name} StateMachine`, uPk, { sType: "StateMachine", doc: "운영 상태와 전이 — 근거 요구 ID는 각 전이의 reqs" });
      const initId = G(`${u.id}:sm:init`); body += `<subvertex xmi:type="uml:Pseudostate" xmi:id="${initId}" name="Initial" kind="initial"/>`; ext(initId, "uml:Pseudostate", "Initial", smId, { sType: "StateNode", nType: 3 });
      dd.states.states.forEach(s => { stId[s.name] = xmiIdOf(s.guid); body += `<subvertex xmi:type="uml:State" xmi:id="${stId[s.name]}" name="${A(s.name)}">${s.entry ? `<entry xmi:type="uml:OpaqueBehavior" xmi:id="${stId[s.name]}_en" name="entry" body="${A(s.entry)}"/>` : ""}${s.do ? `<doActivity xmi:type="uml:OpaqueBehavior" xmi:id="${stId[s.name]}_do" name="do" body="${A(s.do)}"/>` : ""}${s.exit ? `<exit xmi:type="uml:OpaqueBehavior" xmi:id="${stId[s.name]}_ex" name="exit" body="${A(s.exit)}"/>` : ""}</subvertex>`; ext(stId[s.name], "uml:State", s.name, smId, { sType: "State", doc: [s.entry && `entry / ${s.entry}`, s.do && `do / ${s.do}`, s.exit && `exit / ${s.exit}`, s.desc].filter(Boolean).join("\n"), tags: [["reqs", (s.reqs || []).join(", ")]] }); });
      if (stId[dd.states.initial]) { const tid = G(`${u.id}:sm:t:init`); body += `<transition xmi:id="${tid}" source="${initId}" target="${stId[dd.states.initial]}"/>`; conn(tid, "uml:Transition", initId, stId[dd.states.initial], { eaType: "StateFlow" }); }
      dd.states.transitions.forEach((t, i) => { const f = stId[t.from], g2 = stId[t.to]; if (!f || !g2) return; const tid = G(`${u.id}:sm:t:${i}`);
        body += `<transition xmi:id="${tid}" source="${f}" target="${g2}" name="${A(t.trigger)}">${t.trigger ? `<trigger xmi:id="${tid}_tr" name="${A(t.trigger)}"/>` : ""}${t.guard ? `<guard xmi:type="uml:Constraint" xmi:id="${tid}_gd"><specification xmi:type="uml:OpaqueExpression" xmi:id="${tid}_gx" body="${A(t.guard)}"/></guard>` : ""}${t.effect ? `<effect xmi:type="uml:OpaqueBehavior" xmi:id="${tid}_ef" name="${A(t.effect)}" body="${A(t.effect)}"/>` : ""}</transition>`;
        conn(tid, "uml:Transition", f, g2, { name: [t.trigger, t.guard ? `[${t.guard}]` : "", t.effect ? `/ ${t.effect}` : ""].filter(Boolean).join(" "), eaType: "StateFlow", guard: t.guard }); });
      body += `</region></packagedElement>`;
    }
    // 시퀀스(Interaction)
    const seqIds = [];
    dd.sequences.forEach(sq => { const iid = xmiIdOf(sq.guid), colId = iid + "_col"; seqIds.push({ sq, iid });
      body += `<packagedElement xmi:type="uml:Collaboration" xmi:id="${colId}" name="${A(sq.name)}"><ownedBehavior xmi:type="uml:Interaction" xmi:id="${iid}" name="${A(sq.name)}">`;
      ext(colId, "uml:Collaboration", sq.name, uPk, { sType: "Collaboration" }); ext(iid, "uml:Interaction", sq.name, colId, { sType: "Interaction", doc: sq.desc, tags: [["reqs", (sq.reqs || []).join(", ")]] });
      const llId = {}; sq.lifelines.forEach(l => { llId[l] = G(`${iid}:ll:${l}`); body += `<lifeline xmi:id="${llId[l]}" name="${A(l)}"${clsId[l] ? ` represents="${G(iid + ":part:" + l)}"` : ""}/>`; ext(llId[l], "uml:Lifeline", l, iid, { sType: "Sequence", doc: clsId[l] ? `instance of ${l}` : "" }); });
      sq.steps.forEach((st, i) => { const a = llId[st.from], b2 = llId[st.to]; if (!a || !b2) return; const mid = G(`${iid}:msg:${i}`);
        body += `<fragment xmi:type="uml:MessageOccurrenceSpecification" xmi:id="${mid}_s" covered="${a}" message="${mid}"/><fragment xmi:type="uml:MessageOccurrenceSpecification" xmi:id="${mid}_r" covered="${b2}" message="${mid}"/><message xmi:id="${mid}" name="${A(st.msg)}" messageSort="${st.kind === "async" ? "asynchCall" : "synchCall"}" sendEvent="${mid}_s" receiveEvent="${mid}_r"/>`;
        conn(mid, "uml:Message", a, b2, { name: `${st.msg}(${st.args || ""})`, eaType: "Sequence", seqno: i + 1 }); });
      body += `</ownedBehavior></packagedElement>`; });
    // 액티비티
    const actIds = [];
    dd.activities.forEach(a => { const aid = xmiIdOf(a.guid); actIds.push({ a, aid });
      body += `<packagedElement xmi:type="uml:Activity" xmi:id="${aid}" name="${A(a.name)}">`;
      ext(aid, "uml:Activity", a.name, uPk, { sType: "Activity", doc: a.desc, tags: [["operation", a.op], ["reqs", (a.reqs || []).join(", ")]] });
      const nId = {}; const kindMap = { start: ["uml:InitialNode", "StateNode", 100], end: ["uml:ActivityFinalNode", "StateNode", 101], action: ["uml:OpaqueAction", "Action", 0], decision: ["uml:DecisionNode", "Decision", 0], merge: ["uml:MergeNode", "MergeNode", 0], fork: ["uml:ForkNode", "Synchronization", 0], join: ["uml:JoinNode", "Synchronization", 0] };
      a.nodes.forEach(n => { nId[n.id] = G(`${aid}:n:${n.id}`); const [ut, sT, nT] = kindMap[n.kind] || kindMap.action; body += `<node xmi:type="${ut}" xmi:id="${nId[n.id]}" name="${A(n.text || n.kind)}"/>`; ext(nId[n.id], ut, n.text || n.kind, aid, { sType: sT, nType: nT }); });
      a.edges.forEach((e, i) => { const f = nId[e.from], t = nId[e.to]; if (!f || !t) return; const eid = G(`${aid}:e:${i}`); body += `<edge xmi:type="uml:ControlFlow" xmi:id="${eid}" source="${f}" target="${t}"${e.guard ? ` name="${A(e.guard)}"` : ""}>${e.guard ? `<guard xmi:type="uml:OpaqueExpression" xmi:id="${eid}_g" body="${A(e.guard)}"/>` : ""}</edge>`; conn(eid, "uml:ControlFlow", f, t, { name: e.guard ? `[${e.guard}]` : "", eaType: "ControlFlow", guard: e.guard }); });
      body += `</packagedElement>`; });
    body += `</packagedElement>`;

    // ── 다이어그램 배치 (화면 SVG와 같은 레이아웃 규칙) ──
    const uName = (dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0])?.name || unitIdent(u);
    const classRects = []; { let x = 40, y = 40, rowH = 0; dd.classes.forEach((c, i) => { const w = 220, h = 50 + 16 * (c.attrs.length + c.ops.length); if (i && i % 3 === 0) { x = 40; y += rowH + 60; rowH = 0; } classRects.push({ id: clsId[c.name], x, y, w, h, name: c.name }); x += w + 80; rowH = Math.max(rowH, h); }); }
    dia(G(`${u.id}:dg:class`), `${u.id} ${uName} — Class`, "Logical", uPk, classRects);
    dia(G(`${u.id}:dg:bdd`), `${u.id} ${uName} — SysML BDD`, "Logical", uPk, classRects, "MDGDgm=SysML1.6::BlockDefinition;");
    const swc = dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0];
    const compPlaced = [{ id: clsId[swc.name], x: 300, y: 80, w: 260, h: Math.max(100, 40 + dd.ports.length * 30) }]; [...ifSeen].forEach((ifn, i) => compPlaced.push({ id: G("if:" + ifn), x: i % 2 ? 640 : 40, y: 80 + Math.floor(i / 2) * 70, w: 180, h: 50 }));
    dia(G(`${u.id}:dg:comp`), `${u.id} ${uName} — Component`, "Component", uPk, compPlaced);
    dia(G(`${u.id}:dg:ibd`), `${u.id} ${uName} — SysML IBD`, "CompositeStructure", uPk, compPlaced, "MDGDgm=SysML1.6::InternalBlock;");
    if (dd.states.states.length) { const n = dd.states.states.length, R = Math.max(150, n * 40), cx = R + 200, cy = R + 120; const pl = dd.states.states.map((s, i) => { const ang = -Math.PI / 2 + (2 * Math.PI * i) / n; return { id: stId[s.name], x: cx + Math.cos(ang) * R - 70, y: cy + Math.sin(ang) * R - 25, w: 140, h: 50 }; }); pl.unshift({ id: G(`${u.id}:sm:init`), x: cx - 10, y: 30, w: 20, h: 20 }); dia(G(`${u.id}:dg:sm`), `${u.id} ${uName} — StateMachine`, "Statechart", smId, pl); }
    seqIds.forEach(({ sq, iid }) => dia(G(`${iid}:dg`), `${u.id} ${uName} — Sequence ${sq.name}`, "Sequence", iid, sq.lifelines.map((l, i) => ({ id: G(`${iid}:ll:${l}`), x: 60 + i * 180, y: 50, w: 100, h: 50 }))));
    actIds.forEach(({ a, aid }) => { const pl = a.nodes.map((n, i) => ({ id: G(`${aid}:n:${n.id}`), x: 120 + (i % 2) * 220, y: 40 + i * 70, w: n.kind === "action" ? 160 : 30, h: n.kind === "action" ? 40 : 30 })); dia(G(`${aid}:dg`), `${u.id} ${uName} — Activity ${a.name}`, "Activity", aid, pl); });
  });
  // 자료형 패키지를 루트 패키지 맨 앞에 넣고 루트를 닫는다
  const rootOpen = `<packagedElement xmi:type="uml:Package" xmi:id="${rootPk}" name="${A((meta?.name || "Project") + " — SWE.3 상세설계")}">`;
  body = body.replace(rootOpen, rootOpen + `<packagedElement xmi:type="uml:Package" xmi:id="${typePk}" name="DataTypes">${typeEls.join("")}</packagedElement>`) + `</packagedElement>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:sysml="http://www.omg.org/spec/SysML/20161101/SysML">
	<xmi:Documentation exporter="SPIDer QA Agent" exporterVersion="1.0" exporterID="SWE.3"/>
	<uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">
		${body}
	</uml:Model>
	${STEREO.join("\n\t")}
	<xmi:Extension extender="Enterprise Architect" extenderID="6.5">
		<elements>${E.join("")}</elements>
		<connectors>${C.join("")}</connectors>
		<primitivetypes><packagedElement xmi:type="uml:Package" xmi:id="EAPrimitiveTypesPackage" name="EA_PrimitiveTypes_Package" visibility="public"/></primitivetypes>
		<profiles/>
		<diagrams>${D.join("")}</diagrams>
	</xmi:Extension>
</xmi:XMI>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 14) SWE.3 → 소스코드 (MISRA 준거 지향). 뼈대(파일·헤더·RTE 호출·상태 머신·추적 주석)는 결정적으로, 연산 본문은 AI가 설계(algo)대로 작성.
//    CP: C99 · Std_Types.h · Rte_<SWC>.h · Runnable → 연산 / AP: C++17 · ara::core::Result · 클래스 단위
//    최종 MISRA 준수 판정은 정적분석 도구(Helix QAC · Polyspace) 결과로 한다 — 생성기는 결정 가능한 규칙을 구조적으로 회피한다.
// ═══════════════════════════════════════════════════════════════════════════
const C_TYPES = { uint8: "uint8", uint16: "uint16", uint32: "uint32", sint8: "sint8", sint16: "sint16", sint32: "sint32", float32: "float32", float64: "float64", boolean: "boolean", void: "void", Std_ReturnType: "Std_ReturnType", bool: "boolean", int: "sint32", "unsigned int": "uint32", char: "uint8", u8: "uint8", u16: "uint16", u32: "uint32", s8: "sint8", s16: "sint16", s32: "sint32" };
const CPP_TYPES = { uint8: "std::uint8_t", uint16: "std::uint16_t", uint32: "std::uint32_t", sint8: "std::int8_t", sint16: "std::int16_t", sint32: "std::int32_t", float32: "float", float64: "double", boolean: "bool", void: "void", Std_ReturnType: "ara::core::Result<void>", bool: "bool" };
const cT = (t, own) => C_TYPES[t] || (own.has(cid(t)) ? cid(t) : "uint16");
const cppT = (t, own) => CPP_TYPES[t] || (own.has(cid(t)) ? cid(t) : "std::uint16_t");
const BANNER = (file, unit, meta, S, lang) => `/*
 * File     : ${file}
 * Unit     : ${unit.id} ${unit.name}
 * Project  : ${meta?.name || ""}
 * Platform : ${DD_TARGETS[S.target].label} (AUTOSAR ${S.release})
 * Standard : ${lang === "C" ? S.misraC : S.misraCpp + " / " + S.cppGuide}  — compliance to be confirmed with ${S.tools.join(", ")}
 * Traces   : ${(unit.reqs || []).join(", ") || "-"}
 * Generated: SPIDer QA Agent ${new Date().toISOString().slice(0, 10)} — generated from SWE.3 detailed design; review before release
${CODE_NOTICE}
 */
`;
export function promptCode({ unit, model, settings, meta, guideBlock = "" }) {
  const S = { ...DD_DEFAULT, ...(settings || {}) }; const dd = unit.dd; const lang = S.target === "CP" ? "C" : "C++17";
  const ctx = ddContext(unit, model, model.version);
  const ops = dd.classes.flatMap(c => c.ops.map(o => ({ cls: c.name, name: o.name, ret: o.ret, params: o.params, algo: o.algo, desc: o.desc, pre: o.pre, post: o.post })));
  return `역할: ${DD_TARGETS[S.target].label} 임베디드 SW 엔지니어. ${S.target === "CP" ? S.misraC : S.misraCpp + " · " + S.cppGuide} 준수를 목표로 아래 상세설계의 **연산 본문**과 **상태 전이 조건식**을 ${lang}로 작성하세요.

${ctx}

[자료형] ${dd.dataTypes.map(t => `${t.name}(${t.base}${t.range ? ": " + t.range : ""})`).join(", ") || "-"}
[클래스 속성] ${dd.classes.map(c => `${c.name}{${c.attrs.map(a => `${a.type} ${a.name}${a.init ? "=" + a.init : ""}`).join("; ")}}`).join(" ")}
[포트] ${dd.ports.map(p => `${p.dir}:${p.name}(${p.elements.map(e => `${e.type} ${e.name}`).join(", ")})`).join("; ")}
[상태] ${dd.states.states.map(s => s.name).join(", ")} / 전이: ${dd.states.transitions.map((t, i) => `T${i}: ${t.from}→${t.to} when "${t.trigger}" [${t.guard}]`).join("; ")}
[연산과 알고리즘(설계)]
${ops.map(o => `- ${o.cls}::${o.name}(${o.params.map(p => `${p.dir} ${p.type} ${p.name}`).join(", ")}) -> ${o.ret}: ${o.desc}\n  algo: ${(o.algo || []).join(" / ")}`).join("\n")}

규칙:
- ${S.target === "CP"
    ? "C99, AUTOSAR Platform Types(uint8·uint16·sint32·float32·boolean), Std_ReturnType(E_OK/E_NOT_OK). 포트 접근은 Rte_Read_<Port>_<Element>(&var) / Rte_Write_<Port>_<Element>(var)만 사용. 전역 변수는 static, 동적 메모리·재귀·goto·가변 인자 금지, 함수는 단일 반환점, 모든 if/else/switch(default 포함)에 중괄호, 정수 형변환은 명시적, 부동소수 등가 비교 금지, 매직 넘버 대신 설계의 상수 이름."
    : "C++17, std::uint8_t 등 고정폭 정수, 예외 대신 ara::core::Result, new/delete·C 캐스트·goto 금지, 멤버는 private, const·noexcept 명시, switch에 default, 단일 반환점."}
- 본문은 설계의 algo 단계를 그대로 구현하고, 각 단계 앞에 한 줄 주석(한국어 가능)과 끝에 관련 요구 ID 주석을 둔다. 외부 호출은 위 연산·포트 이름만 사용(새 함수 지어내지 않음). 외부 값이 필요하면 매개변수로 받는다.
- 상태 전이 조건식(guards)은 클래스 속성·포트 값·상수로 쓴 불리언 식 1줄(${lang}).
- 길이: 연산 1개당 10~40줄.

${guideBlock}
JSON만 출력:
{"ops":[{"name":"","body":"함수 본문만(선언·중괄호 제외, 줄바꿈 \\n)"}],"guards":[{"index":0,"expr":"불리언 식"}],"consts":[{"name":"","type":"","value":"","desc":""}],"notes":["MISRA 편차가 필요할 수 있는 지점"]}`;
}
// 들여쓰기·금지어 정리
const indent = (s, n = 4) => String(s || "").split("\n").map(l => (l.trim() ? " ".repeat(n) + l.replace(/^\s+/, m => m.slice(0, Math.max(0, m.length - 0))) : "")).join("\n");
const sanitizeBody = (s, lang) => String(s || "").replace(/```[a-z]*\n?/g, "").replace(/\bgoto\b[^;]*;/g, "/* goto removed (MISRA) */").replace(lang === "C" ? /\b(malloc|calloc|realloc|free)\s*\(/g : /\b(new|delete)\b/g, "/* dynamic memory removed (MISRA) */ (");
function ruleBody(o, unit, lang) {
  const steps = (o.algo || []).length ? o.algo : [o.desc || "처리"];
  const retDecl = o.ret === "void" ? "" : lang === "C" ? (o.ret === "Std_ReturnType" ? "Std_ReturnType ret = E_OK;\n" : `${cT(o.ret, new Set())} ret = (${cT(o.ret, new Set())})0;\n`) : (o.ret === "void" ? "" : `auto ret = ${o.ret === "Std_ReturnType" ? "ara::core::Result<void>{}" : cppT(o.ret, new Set()) + "{}"};\n`);
  return retDecl + steps.map((st, i) => `/* step ${i + 1}: ${st} */`).join("\n") + `\n/* traces: ${(o.reqs || unit.reqs || []).join(", ") || "-"} */` + (o.ret === "void" ? "" : "\nreturn ret;");
}
// 구조체(비스칼라) 자료형 — (Type)0 캐스트 대입이 C에서 컴파일 오류이므로 memset으로 0 초기화한다
function nonScalarTypes(dd) { return new Set(arr(dd?.dataTypes).filter(t => t.base === "struct" || /\[/.test(String(t.base || ""))).map(t => cid(t.name))); }
function initAttrC(cls, a, own, nonScalar) {
  const t = cT(a.type, own);
  return nonScalar.has(t) ? `    (void)memset(&${cls}_Data.${a.name}, 0, sizeof(${cls}_Data.${a.name}));` : `    ${cls}_Data.${a.name} = (${t})${/^[\d.]+$/.test(a.init) ? a.init : "0"};`;
}
// 이미 저장된 CP 코드의 같은 결함을 결정적으로 고친다(AI가 쓴 연산 본문은 그대로 유지) — 생성기 수정본과 같은 결과
export function repairCodeInit(u) {
  const dd = u && u.dd; const code = dd && dd.code;
  if (!code || code.target !== "CP" || !Array.isArray(code.files)) return u;
  const own = new Set(arr(dd.dataTypes).map(t => cid(t.name))); const ns = nonScalarTypes(dd);
  if (!ns.size) return u;
  let changed = false;
  const files = code.files.map(f => {
    if (!/\.c$/.test(f.name)) return f;
    let text = f.text.replace(/^(\s*)(\w+)_Data\.(\w+) = \((\w+)\)[\d.]+;$/gm, (all, sp, c, at, ty) => (ns.has(ty) ? (changed = true, `${sp}(void)memset(&${c}_Data.${at}, 0, sizeof(${c}_Data.${at}));`) : all));
    if (text !== f.text && !/#include <string\.h>/.test(text)) text = text.replace(/(\*\/\n)(#include ")/, `$1#include <string.h>   /* memset: zero-init of structured data (MISRA C:2023 Dir 4.x — library use documented) */\n$2`);
    return text === f.text ? f : { ...f, text };
  });
  return changed ? { ...u, dd: { ...dd, code: { ...code, files, repaired: "struct-init" } } } : u;
}
export function generateCode(unit, model, meta, settings, ai = null) {
  const S = { ...DD_DEFAULT, ...(settings || {}) }; const dd = unit.dd; if (!dd) return null;
  const m = normalizeModel(model); const u = (dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0])?.name || unitIdent(unit); const own = new Set(dd.dataTypes.map(t => cid(t.name)));
  const bodies = Object.fromEntries(((ai && ai.ops) || []).map(o => [cid(o.name), o.body]));
  const guards = Object.fromEntries(((ai && ai.guards) || []).map(g => [Number(g.index), g.expr]));
  const consts = ((ai && ai.consts) || []).map(c => ({ name: cid(c.name), type: str(c.type || "uint16", 30), value: str(c.value, 40), desc: str(c.desc, 120) }));
  const notes = ((ai && ai.notes) || []).map(n => str(n, 200));
  const files = [];
  const stEnum = dd.states.states.length ? dd.states.states.map(s => `${u}_ST_${s.name}`.toUpperCase()) : [];
  const swc = dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0];
  const allOps = dd.classes.flatMap(c => c.ops.map(o => ({ ...o, cls: c.name })));
  const traceCmt = o => `/* Traces: ${(o.reqs || []).join(", ") || (unit.reqs || []).join(", ") || "-"} */`;
  const runnableNames = new Set(dd.runnables.map(r => cid(r.name)));
  if (S.target === "CP") {
    const lang = "C";
    const nonScalar = nonScalarTypes(dd);
    const needMemset = dd.classes.some(c => c.attrs.some(a => nonScalar.has(cT(a.type, own))));
    const typesH = `${u}_Types.h`, rteH = `Rte_${u}.h`, cfgH = `${u}_Cfg.h`, hdr = `${u}.h`, src = `${u}.c`;
    const guard = f => f.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    // Types
    files.push({ name: typesH, text: BANNER(typesH, unit, meta, S, lang) + `#ifndef ${guard(typesH)}\n#define ${guard(typesH)}\n\n#include "Std_Types.h"\n\n#ifdef __cplusplus\nextern "C" {\n#endif\n\n` +
      (stEnum.length ? `/* Operating states of ${u} (state machine, SWE.3) */\ntypedef enum {\n${stEnum.map((e, i) => `    ${e} = ${i}u${i < stEnum.length - 1 ? "," : ""}`).join("\n")}\n} ${u}_StateType;\n\n` : "") +
      dd.dataTypes.filter(t => cid(t.name) !== `${u}_StateType`).map(t => t.base === "enum" ? `/* ${t.desc} */\ntypedef enum {\n${String(t.range || "VALUE_0").split(/[,;]/).map(x => x.trim()).filter(Boolean).map((x, i, a) => `    ${cid(t.name).toUpperCase()}_${cid(x).toUpperCase()} = ${i}u${i < a.length - 1 ? "," : ""}`).join("\n")}\n} ${cid(t.name)};\n` : t.base === "struct" ? `/* ${t.desc} */\ntypedef struct {\n${String(t.range || "uint16 value").split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => { const p = x.split(/\s+/); return `    ${cT(p[0], own)} ${cid(p[1] || p[0])};`; }).join("\n")}\n} ${cid(t.name)};\n` : `/* ${t.desc}${t.range ? " — range " + t.range : ""} */\ntypedef ${cT(t.base, own)} ${cid(t.name)};\n`).join("\n") +
      dd.classes.filter(c => c.attrs.length).map(c => `\n/* Internal data of ${c.name} */\ntypedef struct {\n${c.attrs.map(a => `    ${cT(a.type, own)} ${a.name};${a.desc ? ` /* ${a.desc} */` : ""}`).join("\n")}\n} ${c.name}_DataType;\n`).join("") +
      `\n#ifdef __cplusplus\n}\n#endif\n\n#endif /* ${guard(typesH)} */\n` });
    // Cfg (constants)
    const macros = [...(unit.macros || []).map(x => ({ name: cid(x.name), type: "", value: x.value, desc: "from header" })), ...consts];
    files.push({ name: cfgH, text: BANNER(cfgH, unit, meta, S, lang) + `#ifndef ${guard(cfgH)}\n#define ${guard(cfgH)}\n\n#include "Std_Types.h"\n\n/* Design constants (no magic numbers in ${src}) */\n` +
      dd.runnables.filter(r => r.periodMs).map(r => `#define ${u.toUpperCase()}_${cid(r.name).toUpperCase()}_PERIOD_MS   (${r.periodMs}u)\n`).join("") +
      macros.map(c => `#define ${c.name.toUpperCase().replace(/\(.*$/, "")}   (${/^[\d.]+$/.test(c.value) ? c.value + (c.value.includes(".") ? "f" : "u") : c.value || "0u"})${c.desc ? `   /* ${c.desc} */` : ""}\n`).join("") +
      `\n#endif /* ${guard(cfgH)} */\n` });
    // Rte stub (placeholder — real one from RTE generator)
    files.push({ name: rteH, text: BANNER(rteH, unit, meta, S, lang) + `/* PLACEHOLDER for the RTE generator output (DaVinci / EB tresos / ISOLAR). Replace with the generated Rte_${u}.h.\n * Port API derived from SWE.3 ports — same names must appear in the SWC description (ARXML). */\n#ifndef ${guard(rteH)}\n#define ${guard(rteH)}\n\n#include "Std_Types.h"\n#include "${typesH}"\n\n` +
      dd.ports.flatMap(p => p.elements.map(e => p.dir === "R" ? `Std_ReturnType Rte_Read_${p.name}_${e.name}(${cT(e.type, own)} *data);   /* ${p.interface} */` : `Std_ReturnType Rte_Write_${p.name}_${e.name}(${cT(e.type, own)} data);   /* ${p.interface} */`)).join("\n") +
      `\n\n${dd.runnables.map(r => `#define RTE_RUNNABLE_${cid(r.name)}\nvoid ${cid(r.name)}(void);   /* ${r.trigger}${r.periodMs ? " " + r.periodMs + "ms" : ""} */`).join("\n")}\n\n#endif /* ${guard(rteH)} */\n` });
    // Header
    files.push({ name: hdr, text: BANNER(hdr, unit, meta, S, lang) + `#ifndef ${guard(hdr)}\n#define ${guard(hdr)}\n\n#include "Std_Types.h"\n#include "${typesH}"\n\n#ifdef __cplusplus\nextern "C" {\n#endif\n\n/* Runnable entities (called by RTE) */\n${dd.runnables.map(r => `void ${cid(r.name)}(void);`).join("\n")}\n\n/* Unit operations (SWE.3) */\n${allOps.filter(o => o.vis !== "-" && !runnableNames.has(o.name)).map(o => `${traceCmt(o)}\n${cT(o.ret, own)} ${o.name}(${o.params.length ? o.params.map(p => `${p.dir === "in" ? "const " : ""}${cT(p.type, own)}${p.dir === "in" ? "" : " *"} ${p.name}`).join(", ") : "void"});`).join("\n")}\n\n#ifdef __cplusplus\n}\n#endif\n\n#endif /* ${guard(hdr)} */\n` });
    // Source
    const opDef = o => { const sig = `${cT(o.ret, own)} ${o.name}(${o.params.length ? o.params.map(p => `${p.dir === "in" ? "const " : ""}${cT(p.type, own)}${p.dir === "in" ? "" : " *"} ${p.name}`).join(", ") : "void"})`;
      const body = sanitizeBody(bodies[cid(o.name)] || ruleBody(o, unit, lang), lang);
      return `/*------------------------------------------------------------------\n * ${o.name} — ${o.desc || ""}\n${o.pre ? ` * Pre : ${o.pre}\n` : ""}${o.post ? ` * Post: ${o.post}\n` : ""} * ${traceCmt(o).replace(/\/\*|\*\//g, "").trim()}\n *----------------------------------------------------------------*/\n${o.vis === "-" ? "static " : ""}${sig}\n{\n${indent(body)}\n}\n`; };
    const smFunc = stEnum.length ? `/* State machine step — transitions from SWE.3 state machine */\nstatic void ${u}_StateMachine(void)\n{\n    switch (${u}_State)\n    {\n${dd.states.states.map(s => { const outs = dd.states.transitions.map((t, i) => ({ t, i })).filter(x => x.t.from === s.name); return `        case ${`${u}_ST_${s.name}`.toUpperCase()}:\n        {\n${outs.map(({ t, i }) => `            /* ${t.trigger}${t.guard ? ` [${t.guard}]` : ""} — traces: ${(t.reqs || []).join(", ") || "-"} */\n            if (${guards[i] || "FALSE /* TODO guard: " + (t.guard || t.trigger) + " */"})\n            {\n${t.effect ? `                /* effect: ${t.effect} */\n` : ""}                ${u}_State = ${`${u}_ST_${t.to}`.toUpperCase()};\n            }\n`).join("            else\n")}            break;\n        }\n`; }).join("")}        default:\n        {\n            ${u}_State = ${stEnum[0]};   /* defensive: unknown state → re-init (MISRA switch default) */\n            break;\n        }\n    }\n}\n` : "";
    files.push({ name: src, text: BANNER(src, unit, meta, S, lang) + `${needMemset ? "#include <string.h>   /* memset: zero-init of structured data (MISRA C:2023 Dir 4.x — library use documented) */\n" : ""}#include "${hdr}"\n#include "${cfgH}"\n#include "${rteH}"\n\n/*==================================================================\n * Internal data (static — no external linkage, MISRA C:2023 Rule 8.7/8.9)\n *================================================================*/\n${stEnum.length ? `static ${u}_StateType ${u}_State = ${stEnum[0]};\n` : ""}${dd.classes.filter(c => c.attrs.length).map(c => `static ${c.name}_DataType ${c.name}_Data;`).join("\n")}\n\n/* Port buffers */\n${dd.ports.flatMap(p => p.elements.map(e => `static ${cT(e.type, own)} ${p.name}_${e.name};`)).join("\n")}\n\n/* Private operations */\n${allOps.filter(o => o.vis === "-").map(o => `static ${cT(o.ret, own)} ${o.name}(${o.params.length ? o.params.map(p => `${p.dir === "in" ? "const " : ""}${cT(p.type, own)}${p.dir === "in" ? "" : " *"} ${p.name}`).join(", ") : "void"});`).join("\n")}\n${stEnum.length ? `static void ${u}_StateMachine(void);\n` : ""}\n/*==================================================================\n * Runnable entities\n *================================================================*/\n` +
      dd.runnables.map(r => `/* ${r.name} — ${r.desc || ""} (${r.trigger}${r.periodMs ? `, ${r.periodMs}ms` : ""}) traces: ${(r.reqs || []).join(", ") || "-"} */\nvoid ${cid(r.name)}(void)\n{\n${r.trigger === "init" ? `    ${stEnum.length ? `${u}_State = ${stEnum[0]};\n` : ""}${dd.classes.filter(c => c.attrs.length).map(c => c.attrs.map(a => initAttrC(c.name, a, own, nonScalar)).join("\n")).join("\n")}\n` : ""}${r.reads.flatMap(pn => (dd.ports.find(p => p.name === pn)?.elements || []).map(e => `    (void)Rte_Read_${pn}_${e.name}(&${pn}_${e.name});`)).join("\n")}\n${(() => { const self = allOps.find(o => o.name === cid(r.name)); return self ? indent(sanitizeBody(bodies[cid(self.name)] || ruleBody({ ...self, ret: "void" }, unit, lang), lang)) + "\n" : ""; })()}${r.calls.filter(c => allOps.some(o => o.name === c) && !runnableNames.has(c)).map(c => { const o = allOps.find(x => x.name === c); return `    ${o.ret === "void" ? "" : "(void)"}${c}(${o.params.map(p => p.dir === "in" ? `${p.name}` : `&${p.name}`).join(", ")});   /* ${o.desc || ""} */`; }).join("\n")}\n${stEnum.length && r.trigger !== "init" ? `    ${u}_StateMachine();\n` : ""}${r.writes.flatMap(pn => (dd.ports.find(p => p.name === pn)?.elements || []).map(e => `    (void)Rte_Write_${pn}_${e.name}(${pn}_${e.name});`)).join("\n")}\n}\n`).join("\n") +
      `\n/*==================================================================\n * Unit operations\n *================================================================*/\n` + allOps.filter(o => !runnableNames.has(o.name)).map(opDef).join("\n") + "\n" + smFunc });
    return { target: "CP", lang, files, notes, generatedAt: new Date().toISOString(), origin: ai ? "ai" : "rule" };
  }
  // ── AP: C++17 ──
  const lang = "C++";
  const hpp = `${u}.hpp`, cpp = `${u}.cpp`, cfg = `${u}_config.hpp`;
  const ns = `app::${u.toLowerCase()}`;
  const guardM = f => f.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const stEnumCpp = dd.states.states.map(s => s.name.toUpperCase());
  files.push({ name: cfg, text: BANNER(cfg, unit, meta, S, lang) + `#ifndef ${guardM(cfg)}\n#define ${guardM(cfg)}\n\n#include <cstdint>\n#include <chrono>\n\nnamespace ${ns} {\nnamespace config {\n${dd.runnables.filter(r => r.periodMs).map(r => `constexpr std::chrono::milliseconds k${cid(r.name)}Period{${r.periodMs}};`).join("\n")}\n${consts.map(c => `constexpr ${cppT(c.type, own)} k${c.name.replace(/^k/, "")}{${c.value || "0"}};${c.desc ? ` // ${c.desc}` : ""}`).join("\n")}\n}  // namespace config\n}  // namespace ${ns}\n\n#endif  // ${guardM(cfg)}\n` });
  files.push({ name: hpp, text: BANNER(hpp, unit, meta, S, lang) + `#ifndef ${guardM(hpp)}\n#define ${guardM(hpp)}\n\n#include <cstdint>\n#include "ara/core/result.h"\n#include "ara/core/error_code.h"\n#include "${cfg}"\n// Service proxies/skeletons are generated by the ara::com generator from the service interface description:\n${dd.ports.map(p => `// #include "${p.interface.toLowerCase()}_${p.dir === "R" ? "proxy" : "skeleton"}.h"   // ${p.dir === "R" ? "required" : "provided"} ${p.kind}`).join("\n")}\n\nnamespace ${ns} {\n\n${dd.dataTypes.map(t => t.base === "enum" ? `enum class ${cid(t.name)} : std::uint8_t { ${String(t.range || "Value0").split(/[,;]/).map(x => cid(x.trim())).filter(Boolean).join(", ")} };  // ${t.desc}` : t.base === "struct" ? `struct ${cid(t.name)} {\n${String(t.range || "uint16 value").split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => { const p = x.split(/\s+/); return `  ${cppT(p[0], own)} ${cid(p[1] || p[0])}{};`; }).join("\n")}\n};  // ${t.desc}` : `using ${cid(t.name)} = ${cppT(t.base, own)};  // ${t.desc}${t.range ? " range " + t.range : ""}`).join("\n")}\n${stEnumCpp.length ? `\nenum class State : std::uint8_t { ${stEnumCpp.join(", ")} };\n` : ""}\n` +
    dd.classes.map(c => `/// ${c.desc || c.name}\n/// Traces: ${(c.reqs || []).join(", ") || "-"}\nclass ${c.name} final {\n public:\n  ${c.name}() noexcept = default;\n  ~${c.name}() noexcept = default;\n  ${c.name}(const ${c.name}&) = delete;\n  ${c.name}& operator=(const ${c.name}&) = delete;\n  ${c.name}(${c.name}&&) = delete;\n  ${c.name}& operator=(${c.name}&&) = delete;\n\n${c.ops.filter(o => o.vis !== "-").map(o => `  /// ${o.desc || ""}\n  /// Traces: ${(o.reqs || []).join(", ") || "-"}\n  ${cppT(o.ret, own)} ${o.name}(${o.params.map(p => `${p.dir === "in" ? "const " : ""}${cppT(p.type, own)}${p.dir === "in" ? "" : "&"} ${p.name}`).join(", ")}) noexcept;`).join("\n")}\n${c.stereotype === "SWC" ? `\n  /// Runnables (scheduled by the application main / ara::exec)\n${dd.runnables.map(r => `  void ${cid(r.name)}() noexcept;  // ${r.trigger}${r.periodMs ? " " + r.periodMs + "ms" : ""}`).join("\n")}\n` : ""}\n private:\n${c.ops.filter(o => o.vis === "-").map(o => `  ${cppT(o.ret, own)} ${o.name}(${o.params.map(p => `${p.dir === "in" ? "const " : ""}${cppT(p.type, own)}${p.dir === "in" ? "" : "&"} ${p.name}`).join(", ")}) noexcept;`).join("\n")}${c.stereotype === "SWC" && stEnumCpp.length ? `\n  void StepStateMachine() noexcept;\n  State state_{State::${stEnumCpp[0]}};` : ""}\n${c.attrs.map(a => `  ${cppT(a.type, own)} ${a.name}_{${/^[\d.]+$/.test(a.init) ? a.init : ""}};${a.desc ? `  // ${a.desc}` : ""}`).join("\n")}\n${c.stereotype === "SWC" ? dd.ports.flatMap(p => p.elements.map(e => `  ${cppT(e.type, own)} ${p.name}_${e.name}_{};  // ${p.dir === "R" ? "last received" : "to publish"} via ${p.interface}`)).join("\n") : ""}\n};\n`).join("\n") +
    `\n}  // namespace ${ns}\n\n#endif  // ${guardM(hpp)}\n` });
  const opDefCpp = (c, o) => { const body = sanitizeBody(bodies[cid(o.name)] || ruleBody(o, unit, "C++"), "C++").replace(/\b(\w+)_Data\.(\w+)/g, "$2_"); return `// ${o.desc || ""}\n// Traces: ${(o.reqs || []).join(", ") || "-"}\n${cppT(o.ret, own)} ${c.name}::${o.name}(${o.params.map(p => `${p.dir === "in" ? "const " : ""}${cppT(p.type, own)}${p.dir === "in" ? "" : "&"} ${p.name}`).join(", ")}) noexcept {\n${indent(body, 2)}\n}\n`; };
  files.push({ name: cpp, text: BANNER(cpp, unit, meta, S, lang) + `#include "${hpp}"\n\nnamespace ${ns} {\n\n` +
    dd.classes.map(c => c.ops.filter(o => !(c.stereotype === "SWC" && dd.runnables.some(r => cid(r.name) === o.name))).map(o => opDefCpp(c, o)).join("\n") + (c.stereotype === "SWC" ? dd.runnables.map(r => `// ${r.desc || r.name} (${r.trigger}${r.periodMs ? `, ${r.periodMs}ms` : ""}) Traces: ${(r.reqs || []).join(", ") || "-"}\nvoid ${c.name}::${cid(r.name)}() noexcept {\n${r.reads.map(pn => `  // receive: ${pn} (ara::com proxy GetNewSamples / field Get)`).join("\n")}\n${(() => { const self = c.ops.find(o => o.name === cid(r.name)); return self ? indent(sanitizeBody(bodies[cid(self.name)] || ruleBody({ ...self, ret: "void" }, unit, "C++"), "C++").replace(/\b(\w+)_Data\.(\w+)/g, "$2_"), 2) + "\n" : ""; })()}${r.calls.filter(x => x !== cid(r.name) && !dd.runnables.some(rr => cid(rr.name) === x) && c.ops.some(o => o.name === x)).map(x => { const o = c.ops.find(y => y.name === x); return `  ${o.ret === "void" ? "" : "static_cast<void>("}${x}(${o.params.map(p => p.name + "_").join(", ")})${o.ret === "void" ? "" : ")"};`; }).join("\n")}\n${stEnumCpp.length && r.trigger !== "init" ? "  StepStateMachine();\n" : ""}${r.writes.map(pn => `  // publish: ${pn} (ara::com skeleton event Send / field Update)`).join("\n")}\n}\n`).join("\n") + (stEnumCpp.length ? `\nvoid ${c.name}::StepStateMachine() noexcept {\n  switch (state_) {\n${dd.states.states.map(s => `    case State::${s.name.toUpperCase()}: {\n${dd.states.transitions.map((t, i) => ({ t, i })).filter(x => x.t.from === s.name).map(({ t, i }) => `      // ${t.trigger}${t.guard ? ` [${t.guard}]` : ""} — traces: ${(t.reqs || []).join(", ") || "-"}\n      if (${(guards[i] || "false /* TODO guard: " + (t.guard || t.trigger) + " */").replace(/\b(\w+)_Data\.(\w+)/g, "$2_")}) {\n${t.effect ? `        // effect: ${t.effect}\n` : ""}        state_ = State::${t.to.toUpperCase()};\n      }`).join(" else\n")}\n      break;\n    }\n`).join("")}    default: {\n      state_ = State::${stEnumCpp[0]};  // defensive\n      break;\n    }\n  }\n}\n` : "") : "")).join("\n") +
    `\n}  // namespace ${ns}\n` });
  return { target: "AP", lang, files, notes, generatedAt: new Date().toISOString(), origin: ai ? "ai" : "rule" };
}

// ═══ 상표·이용 고지 (UI·생성 문서·생성 코드 공통) ═══
//   상표는 지명적 사용(해당 표준·도구를 가리키기 위한 사용)에 한하며, 각 권리자의 귀속 문구를 함께 표시한다.
//   VDA 상표 기준: 출판물에서 Automotive SPICE®가 처음 나올 때 귀속 문구를 눈에 띄게 표시해야 한다.
export const LEGAL = {
  tm: [
    ["Automotive SPICE®", "Automotive SPICE® is a registered trademark of the Verband der Automobilindustrie e.V. (VDA)."],
    ["PMBOK®", "PMBOK is a registered mark of Project Management Institute, Inc."],
    ["CMMI®", "CMMI® is a registered trademark of ISACA."],
    ["MISRA®", "MISRA® is a registered trademark of HORIBA MIRA Ltd, held on behalf of The MISRA Consortium."],
    ["AUTOSAR®", "AUTOSAR® is a registered trademark of AUTOSAR GbR."],
    ["Enterprise Architect", "Enterprise Architect is a trademark of Sparx Systems Pty Ltd."],
    ["OrCAD · Allegro", "OrCAD and Allegro are trademarks of Cadence Design Systems, Inc."],
  ],
  vda: "Automotive SPICE® is a registered trademark of the Verband der Automobilindustrie e.V. (VDA).",
  pmi: "PMBOK is a registered mark of Project Management Institute, Inc.",
  noAffil: "SPIDer QA Agent는 위 권리자와 제휴·후원·보증 관계가 없으며, 상표는 해당 표준·도구를 가리키기 위해서만 사용합니다.",
  content: "ASPICE BP 점검문·검토 기준·작성 원칙은 VDA PAM·PMBOK® 등 원문을 옮긴 것이 아니라 SPIDer가 점검 목적으로 요약·재구성한 것입니다. 원문과 심사 기준은 각 발행처의 정식 문서를 참조하십시오.",
  autosar: "SWE.3 생성 코드는 AUTOSAR 인터페이스 명명 규칙(Rte_*, Std_ReturnType, ara::* 등)을 따르는 응용 SW 골격이며, AUTOSAR 규격 문서의 내용을 포함·재배포하지 않습니다. 타깃 통합에는 사용자 조직이 보유한 AUTOSAR 스택·RTE 생성기와 그 라이선스를 사용해야 하며, 생성 결과는 AUTOSAR 적합성(conformance)을 주장하거나 인증하지 않습니다.",
  misra: "MISRA 관련 산출물은 규칙 번호와 SPIDer 자체 요약만 기재하고 규칙 원문·예제는 포함하지 않습니다. 준수 여부의 최종 판정은 라이선스를 보유한 정적분석 도구와 MISRA 정식 문서로 하십시오.",
  eda: "EA·EDA 교환 파일은 공개 교환 형식(XMI 2.1, EDIF, IPC-2581, Gerber 등)으로 생성하며, Sparx Systems·Cadence의 라이브러리·심볼·아이콘·프로파일 자산은 포함하지 않습니다.",
  uploads: "사용자가 등록·업로드하는 자료(작성 가이드, OSSP 자산, 규제·Best Practice 문서, 고객 원문)는 업로더가 이용 권한을 보유한 자료여야 합니다. 구매한 표준 원문(ISO·VDA PAM·MISRA 등)은 라이선스상 조직 내 공유가 제한될 수 있습니다. 작성 가이드는 원문을 저장하지 않고 AI가 추출한 작성 규칙 요약만 저장합니다.",
  oss: [
    ["React · React DOM 18", "MIT License", "화면 구성 (번들 포함)"],
    ["@yowasp/clang", "ISC License (포함된 LLVM/Clang: Apache-2.0 WITH LLVM-exception)", "SWE.4 브라우저 실행 — 실행 시 CDN에서 받음"],
    ["DM Sans", "SIL Open Font License 1.1", "화면 글꼴 — Google Fonts에서 받음"],
    ["Vite · @vitejs/plugin-react", "MIT License", "빌드 도구 (배포물에 미포함)"],
  ],
};
// 생성 코드 주석용 (ASCII만 — 일부 MISRA 검사 도구가 주석의 비 ASCII 문자를 경고하므로)
const CODE_NOTICE = [
  " * Notice   : Application code skeleton using AUTOSAR interface naming only; contains no",
  " *            AUTOSAR specification text. Integrate with your own licensed AUTOSAR stack /",
  " *            RTE generator. This is not an AUTOSAR conformance claim. MISRA references are",
  " *            by rule number only; compliance is not certified by this generator.",
  " *            AUTOSAR(R) is a registered trademark of AUTOSAR GbR. MISRA(R) is a registered",
  " *            trademark of HORIBA MIRA Ltd, held on behalf of The MISRA Consortium.",
].join("\n");

// ═══ MISRA 적용 체크리스트 — 규칙 '번호'만 참조(원문은 MISRA 저작물). 생성기가 구조적으로 보장하는 항목 / 도구 확인 항목 구분 ═══
export const MISRA_C_ROWS = [
  ["Dir 4.6", "필수", "고정폭 정수형 사용", "AUTOSAR Platform Types(uint8·uint16…)만 사용", "생성기 보장"],
  ["Dir 4.12", "필수", "동적 메모리 미사용", "malloc/free 생성 금지(본문 필터)", "생성기 보장"],
  ["Rule 1.3", "필수", "미정의 동작 없음", "—", "도구 확인"],
  ["Rule 2.2", "필수", "불필요 코드 없음", "미사용 변수 검사", "도구 확인"],
  ["Rule 8.4", "필수", "외부 연결 객체·함수의 선언 가시", "모든 외부 함수는 .h에 원형 선언", "생성기 보장"],
  ["Rule 8.7", "권고", "단일 번역 단위 참조 객체는 내부 연결", "파일 내부 데이터·함수 static", "생성기 보장"],
  ["Rule 10.1~10.8", "필수", "필수 형 모델(암묵 변환 제한)", "명시적 캐스트, 상수 접미사 u/f", "도구 확인"],
  ["Rule 11.x", "필수", "포인터 변환 제한", "void* 미사용", "생성기 보장"],
  ["Rule 13.x", "필수", "부수 효과 순서", "—", "도구 확인"],
  ["Rule 14.4", "필수", "제어식은 불리언", "guard 식 불리언 검토", "도구 확인"],
  ["Rule 15.1", "권고", "goto 미사용", "goto 제거 필터", "생성기 보장"],
  ["Rule 15.5", "권고", "함수 단일 반환점", "ret 변수 후 단일 return", "생성기 보장(AI 본문은 도구 확인)"],
  ["Rule 15.6/15.7", "필수", "제어문 중괄호·else 종결", "모든 분기 중괄호", "생성기 보장(AI 본문은 도구 확인)"],
  ["Rule 16.1~16.4", "필수", "switch 구조·default", "상태 머신 switch에 default", "생성기 보장"],
  ["Rule 17.2", "필수", "재귀 금지", "—", "도구 확인"],
  ["Rule 17.7", "필수", "반환값 사용", "Rte_* 반환값 (void) 캐스트 또는 처리", "생성기 보장"],
  ["Rule 21.3", "필수", "stdlib 메모리 함수 금지", "미사용", "생성기 보장"],
  ["Rule 21.6", "필수", "stdio 금지", "미사용", "생성기 보장"],
  ["Rule 21.x/22.x", "필수", "표준 라이브러리 제한·자원", "—", "도구 확인"],
];
export const MISRA_CPP_ROWS = [
  ["Rule 0.1.x / 0.2.x", "필수", "도달 불가·불필요 코드 없음", "—", "도구 확인"],
  ["Rule 4.1.3", "필수", "미정의 동작 없음", "—", "도구 확인"],
  ["Rule 6.x", "필수", "선언·초기화·정적 저장", "멤버 기본값 초기화, static 미사용", "생성기 보장"],
  ["Rule 7.0.x", "필수", "표준 변환 제한", "static_cast만, C 캐스트 금지", "생성기 보장(AI 본문은 도구 확인)"],
  ["Rule 8.2.x", "필수", "캐스트 제한", "reinterpret_cast 금지", "도구 확인"],
  ["Rule 9.3.1 / 9.4.x", "필수", "제어문 중괄호·switch default", "switch default", "생성기 보장"],
  ["Rule 9.6.x", "필수", "goto 금지", "goto 제거 필터", "생성기 보장"],
  ["Rule 15.x", "필수", "특수 멤버 함수", "복사/이동 삭제·noexcept 소멸자", "생성기 보장"],
  ["Rule 18.x", "필수", "예외 처리 제한", "예외 대신 ara::core::Result", "생성기 보장"],
  ["Rule 21.6.x", "필수", "동적 메모리 제한", "new/delete 금지", "생성기 보장"],
  ["AUTOSAR C++14 A2-10-x", "필수", "식별자 숨김 금지", "—", "도구 확인"],
  ["AUTOSAR C++14 A5-1-1", "필수", "매직 넘버 금지", "constexpr 상수(config)", "생성기 보장(AI 본문은 도구 확인)"],
  ["AUTOSAR C++14 A8-4-x", "필수", "매개변수 전달 방식", "const& / 값", "생성기 보장"],
  ["AUTOSAR C++14 A12-x", "필수", "클래스 특수 멤버", "final, delete 복사/이동", "생성기 보장"],
];
export function misraChecklistRows(settings) {
  const S = { ...DD_DEFAULT, ...(settings || {}) };
  const rows = S.target === "CP" ? MISRA_C_ROWS : MISRA_CPP_ROWS;
  const std = S.target === "CP" ? S.misraC : `${S.misraCpp} · ${S.cppGuide}`;
  return [[`MISRA 적용 체크리스트 — ${std}`], [`대상 플랫폼: ${DD_TARGETS[S.target].label}`, `정적분석: ${S.tools.join(" · ")}`, "규칙 원문은 MISRA 라이선스 문서를 참조(본 표는 번호와 적용 조치만 기재)"], [LEGAL.misra], [LEGAL.tm.filter(t => /MISRA|AUTOSAR/.test(t[0])).map(t => t[1]).join(" ")], [],
    ["규칙 번호", "분류", "주제(SPIDer 자체 요약 — 원문 아님)", "생성 코드의 조치", "보장 수준", `${S.tools[0]} 점검`, `${S.tools[1]} 점검`, "편차 번호", "비고"],
    ...rows.map(r => [...r, `${std} 룰셋`, `${std} 체커`, "", r[4].includes("도구") ? "도구 결과로 판정" : "구조적 회피, 도구 결과로 재확인"])];
}


// ═══════════════════════════════════════════════════════════════════════════
// 15) HWE.2 HW 설계(HD) — HW 컴포넌트(회로 블록)별 회로·부품·넷·특별 특성·설계 분석을 AI가 전부 작성, 모든 요소에 HW 요구 ID 추적
//    comp.hd = { guid, summary, parts[], nets[], conns[], ifs[], specials[], analysis{derating,thermal,timing,worstCase}, rationale, origin, generatedAt }
//    model.hwDesign = EDA 호환 기준 (OrCAD Capture EDIF 2.0.0 / Allegro 넷리스트·배치·IPC-2581 / Gerber) — 다음 묶음의 EDA 파일 생성 기준
//    부품 제조사 PN은 AI '후보'이며 BOM에 그대로 표시한다(구매 PN은 확정 단계에서).
// ═══════════════════════════════════════════════════════════════════════════
export const HD_DEFAULT = {
  eda: "OrCAD X Capture · Allegro X PCB (23.1 계열, 17.4 하위 호환)",
  schematicFmt: "EDIF 2.0.0", layoutFmt: "Allegro 넷리스트·배치 텍스트 · IPC-2581", fabFmt: "Gerber RS-274X · Excellon · Pick&Place",
  layers: 4, env: "차량 탑재 전장(-40~+85°C, ISO 16750 전원 조건)",
};
export const hdSettings = m => ({ ...HD_DEFAULT, ...((m && m.hwDesign) || {}) });
export const PART_KINDS = ["IC", "MCU", "트랜지스터", "다이오드", "저항", "커패시터", "인덕터", "커넥터", "크리스탈", "퓨즈", "TVS", "릴레이", "기타"];
const REF_PREFIX = { IC: "U", MCU: "U", 트랜지스터: "Q", 다이오드: "D", TVS: "D", 저항: "R", 커패시터: "C", 인덕터: "L", 커넥터: "J", 크리스탈: "Y", 퓨즈: "F", 릴레이: "K", 기타: "X" };
export function emptyHD() {
  return { guid: "", summary: "", parts: [], nets: [], conns: [], ifs: [], specials: [], analysis: { derating: [], thermal: [], timing: [], worstCase: [] }, rationale: "", origin: "", generatedAt: "" };
}
const netName = s => String(s || "").trim().replace(/[^A-Za-z0-9_+\-.]/g, "_").slice(0, 40) || "NC";
export function normalizeHD(raw, comp, model, seedKey) {
  const r = raw && typeof raw === "object" ? raw : {};
  const m = normalizeModel(model);
  const okReq = new Set([...(m.reqs.HW || []).map(x => x.id), ...(m.reqs.SYS || []).map(x => x.id)]);
  const rq = x => ids(x).filter(i => okReq.has(i));
  const g = name => guidFor(`${seedKey}|${comp?.id}|${name}`);
  const hd = emptyHD(); hd.guid = g("comp"); hd.summary = str(r.summary, 600);
  const refSeen = new Set();
  hd.parts = arr(r.parts).slice(0, 120).map((p, i) => { const kind = PART_KINDS.includes(p.kind) ? p.kind : "기타"; let ref = cid(p.ref || `${REF_PREFIX[kind]}${i + 1}`).toUpperCase(); while (refSeen.has(ref)) ref += "A"; refSeen.add(ref);
    return { guid: g(`part:${ref}`), ref, kind, value: str(p.value, 40), pkg: str(p.pkg, 30), mfr: str(p.mfr, 40), mpn: str(p.mpn, 50), rating: str(p.rating, 80), desc: str(p.desc, 200), qty: Number(p.qty) > 0 ? Number(p.qty) : 1, special: !!p.special, grade: str(p.grade || "AEC-Q", 30), reqs: rq(p.reqs),
      pins: arr(p.pins).slice(0, 64).map((x, k) => ({ num: str(x.num || k + 1, 8), name: cid(x.name || `P${k + 1}`), type: ["in", "out", "io", "pwr", "gnd", "passive"].includes(x.type) ? x.type : "passive" })) }; });
  const refs = new Set(hd.parts.map(p => p.ref));
  hd.nets = arr(r.nets).slice(0, 200).map(n => ({ name: netName(n.name), kind: ["power", "gnd", "signal", "bus", "analog"].includes(n.kind) ? n.kind : (/GND|VSS/i.test(n.name) ? "gnd" : /^V|VCC|VDD|\+\d/i.test(n.name) ? "power" : "signal"), voltage: str(n.voltage, 20), desc: str(n.desc, 120), reqs: rq(n.reqs) }));
  const netSet = new Set(hd.nets.map(n => n.name));
  hd.conns = arr(r.conns).slice(0, 600).map(c => ({ ref: cid(c.ref).toUpperCase(), pin: str(c.pin, 8), net: netName(c.net) })).filter(c => refs.has(c.ref) && c.net);
  hd.conns.forEach(c => { if (!netSet.has(c.net)) { netSet.add(c.net); hd.nets.push({ name: c.net, kind: /GND/i.test(c.net) ? "gnd" : /^V|VCC|VDD|\+\d/i.test(c.net) ? "power" : "signal", voltage: "", desc: "", reqs: [] }); } });
  hd.ifs = arr(r.ifs).slice(0, 40).map(x => ({ name: str(x.name, 40), dir: /in/i.test(x.dir) ? "in" : /out/i.test(x.dir) ? "out" : "io", net: netName(x.net), connector: str(x.connector, 30), spec: str(x.spec, 120), source: str(x.source, 40), reqs: rq(x.reqs) }));
  hd.specials = arr(r.specials).slice(0, 40).map((x, i) => ({ id: cid(x.id || `SC-${String(i + 1).padStart(2, "0")}`).toUpperCase(), char: str(x.char, 120), type: ["안전", "법규", "기능", "품질"].includes(x.type) ? x.type : "기능", target: str(x.target, 60), value: str(x.value, 60), control: str(x.control, 160), verify: str(x.verify, 120), reqs: rq(x.reqs) }));
  const an = r.analysis && typeof r.analysis === "object" ? r.analysis : {};
  hd.analysis = {
    derating: arr(an.derating).slice(0, 80).map(x => ({ ref: cid(x.ref).toUpperCase(), param: str(x.param, 40), rated: str(x.rated, 30), applied: str(x.applied, 30), ratio: str(x.ratio, 12), limit: str(x.limit || "80%", 12), ok: x.ok === false ? false : true, note: str(x.note, 120) })),
    thermal: arr(an.thermal).slice(0, 40).map(x => ({ ref: cid(x.ref).toUpperCase(), pd_mW: str(x.pd_mW, 12), theta: str(x.theta, 20), ta: str(x.ta || "85", 8), tj: str(x.tj, 12), limit: str(x.limit, 12), ok: x.ok === false ? false : true, note: str(x.note, 120) })),
    timing: arr(an.timing).slice(0, 40).map(x => ({ item: str(x.item, 60), req: str(x.req, 40), calc: str(x.calc, 60), margin: str(x.margin, 30), ok: x.ok === false ? false : true, note: str(x.note, 120) })),
    worstCase: arr(an.worstCase).slice(0, 60).map(x => ({ item: str(x.item, 60), nominal: str(x.nominal, 30), min: str(x.min, 30), max: str(x.max, 30), limit: str(x.limit, 40), ok: x.ok === false ? false : true, method: str(x.method, 60), note: str(x.note, 120) })),
  };
  hd.rationale = str(r.rationale, 1500);
  hd.origin = "ai"; hd.generatedAt = new Date().toISOString();
  return fillHDGaps(hd, comp, model, seedKey);
}
// 규칙 보강 — 컴포넌트 종류(전원·MCU·통신·커넥터)에 맞는 기본 회로 뼈대와 분석 표
export function fillHDGaps(hd0, comp, model, seedKey) {
  const m = normalizeModel(model); const hd = hd0 || emptyHD();
  const g = name => guidFor(`${seedKey}|${comp?.id}|${name}`); if (!hd.guid) hd.guid = g("comp");
  const name = String(comp?.name || ""), kind = String(comp?.kind || "");
  const reqs = (m.reqs.HW || []).filter(r => (m.alloc.HW[r.id] || []).includes(comp?.id));
  const reqIds = reqs.map(r => r.id);
  const addP = (ref, kind, value, pkg, mfr, mpn, rating, desc, pins) => hd.parts.push({ guid: g(`part:${ref}`), ref, kind, value, pkg, mfr, mpn, rating, desc, qty: 1, special: false, grade: "AEC-Q", reqs: reqIds, pins: pins.map((x, k) => ({ num: String(k + 1), name: x[0], type: x[1] })) });
  const addN = (n, kind, v = "") => { if (!hd.nets.some(x => x.name === n)) hd.nets.push({ name: n, kind, voltage: v, desc: "", reqs: [] }); };
  const con = (ref, pin, net) => hd.conns.push({ ref, pin, net });
  if (!hd.parts.length) {
    if (/전원|POWER|PMIC|LDO|DCDC|레귤/i.test(name + kind)) {
      addN("VBAT", "power", "12V"); addN("VBAT_F", "power", "12V"); addN("3V3", "power", "3.3V"); addN("GND", "gnd");
      addP("F1", "퓨즈", "2A", "1206", "Littelfuse", "0466002.NR (후보)", "32V 2A", "입력 보호 퓨즈", [["1", "passive"], ["2", "passive"]]);
      addP("D1", "TVS", "SMBJ33A", "SMB", "Littelfuse", "SMBJ33A (후보)", "33V 600W", "ISO 7637 서지 보호", [["K", "passive"], ["A", "passive"]]);
      addP("D2", "다이오드", "SS34", "SMA", "onsemi", "SS34 (후보)", "40V 3A", "역접속 보호", [["A", "passive"], ["K", "passive"]]);
      addP("U1", "IC", "LDO 3.3V 500mA", "HTSSOP-16", "Texas Instruments", "TPS7B6933QDGNRQ1 (후보)", "Vin 4~40V, Iout 0.5A, AEC-Q100", "메인 3.3V 레귤레이터", [["IN", "pwr"], ["EN", "in"], ["OUT", "out"], ["GND", "gnd"]]);
      addP("C1", "커패시터", "10uF/50V", "1210", "Murata", "GCM32ER71H106KA03 (후보)", "X7R 50V AEC-Q200", "입력 벌크", [["1", "passive"], ["2", "passive"]]);
      addP("C2", "커패시터", "4.7uF/16V", "0805", "Murata", "GCM21BR71C475KA73 (후보)", "X7R 16V AEC-Q200", "출력 커패시터", [["1", "passive"], ["2", "passive"]]);
      con("F1", "1", "VBAT"); con("F1", "2", "VBAT_F"); con("D1", "K", "VBAT_F"); con("D1", "A", "GND"); con("D2", "A", "VBAT_F"); con("D2", "K", "VIN_P"); addN("VIN_P", "power", "12V");
      con("U1", "IN", "VIN_P"); con("U1", "EN", "VIN_P"); con("U1", "OUT", "3V3"); con("U1", "GND", "GND"); con("C1", "1", "VIN_P"); con("C1", "2", "GND"); con("C2", "1", "3V3"); con("C2", "2", "GND");
    } else if (/MCU|제어|프로세서|컨트롤/i.test(name + kind)) {
      addN("3V3", "power", "3.3V"); addN("GND", "gnd"); addN("MCU_RESET_N", "signal"); addN("SWDIO", "signal"); addN("SWCLK", "signal"); addN("CAN1_TX", "signal"); addN("CAN1_RX", "signal");
      addP("U2", "MCU", "32bit Automotive MCU", "LQFP-100", "Infineon", "TC375TP (후보)", "AEC-Q100 Grade 1, ASIL-D capable", "메인 MCU", [["VDD", "pwr"], ["VSS", "gnd"], ["PORST", "in"], ["TMS", "io"], ["TCK", "in"], ["CAN1_TXD", "out"], ["CAN1_RXD", "in"], ["XTAL1", "in"], ["XTAL2", "out"]]);
      addP("Y1", "크리스탈", "20MHz", "3225", "NDK", "NX3225GD-20MHz (후보)", "±20ppm AEC-Q200", "메인 클럭", [["1", "passive"], ["2", "passive"]]);
      addP("C10", "커패시터", "100nF/16V", "0402", "Murata", "GCM155R71C104KA55 (후보)", "X7R AEC-Q200", "디커플링", [["1", "passive"], ["2", "passive"]]);
      addP("R1", "저항", "10k", "0402", "Yageo", "AC0402FR-0710KL (후보)", "1% AEC-Q200", "리셋 풀업", [["1", "passive"], ["2", "passive"]]);
      addN("XTAL1", "signal"); addN("XTAL2", "signal");
      con("U2", "VDD", "3V3"); con("U2", "VSS", "GND"); con("U2", "PORST", "MCU_RESET_N"); con("U2", "TMS", "SWDIO"); con("U2", "TCK", "SWCLK"); con("U2", "CAN1_TXD", "CAN1_TX"); con("U2", "CAN1_RXD", "CAN1_RX"); con("U2", "XTAL1", "XTAL1"); con("U2", "XTAL2", "XTAL2");
      con("Y1", "1", "XTAL1"); con("Y1", "2", "XTAL2"); con("C10", "1", "3V3"); con("C10", "2", "GND"); con("R1", "1", "3V3"); con("R1", "2", "MCU_RESET_N");
    } else if (/CAN|LIN|통신|이더넷|ETH/i.test(name + kind)) {
      addN("5V", "power", "5V"); addN("GND", "gnd"); addN("CAN1_TX", "signal"); addN("CAN1_RX", "signal"); addN("CANH", "bus"); addN("CANL", "bus"); addN("CAN_STB", "signal");
      addP("U3", "IC", "CAN FD 트랜시버", "SOIC-8", "NXP", "TJA1051T/3 (후보)", "5Mbit/s, AEC-Q100", "CAN FD 트랜시버", [["TXD", "in"], ["GND", "gnd"], ["VCC", "pwr"], ["RXD", "out"], ["VIO", "pwr"], ["CANL", "io"], ["CANH", "io"], ["S", "in"]]);
      addP("L1", "인덕터", "100uH CMC", "1210", "TDK", "ACT45B-101-2P-TL003 (후보)", "AEC-Q200", "CAN 공통모드 초크", [["1", "passive"], ["2", "passive"], ["3", "passive"], ["4", "passive"]]);
      addP("D3", "TVS", "CAN ESD", "SOT-23", "Nexperia", "PESD2CANFD24V-T (후보)", "24V bidirectional", "CAN 버스 ESD 보호", [["1", "passive"], ["2", "passive"], ["3", "passive"]]);
      addP("R2", "저항", "60.4", "0603", "Vishay", "CRCW060360R4FKEA (후보)", "1% AEC-Q200", "종단 저항(분할)", [["1", "passive"], ["2", "passive"]]);
      addP("R3", "저항", "60.4", "0603", "Vishay", "CRCW060360R4FKEA (후보)", "1% AEC-Q200", "종단 저항(분할)", [["1", "passive"], ["2", "passive"]]);
      addP("C20", "커패시터", "4.7nF/50V", "0603", "Murata", "GCM188R71H472KA37 (후보)", "X7R AEC-Q200", "스플릿 종단 커패시터", [["1", "passive"], ["2", "passive"]]);
      addP("J1", "커넥터", "CAN 커넥터", "2pin", "TE Connectivity", "1-1718644-1 (후보)", "자동차용", "외부 CAN", [["CANH", "io"], ["CANL", "io"]]);
      addN("CANH_O", "bus"); addN("CANL_O", "bus"); addN("CAN_SPLIT", "signal");
      con("U3", "TXD", "CAN1_TX"); con("U3", "RXD", "CAN1_RX"); con("U3", "VCC", "5V"); con("U3", "VIO", "5V"); con("U3", "GND", "GND"); con("U3", "CANH", "CANH"); con("U3", "CANL", "CANL"); con("U3", "S", "CAN_STB");
      con("L1", "1", "CANH"); con("L1", "2", "CANH_O"); con("L1", "3", "CANL"); con("L1", "4", "CANL_O"); con("D3", "1", "CANH_O"); con("D3", "2", "CANL_O"); con("D3", "3", "GND");
      con("R2", "1", "CANH_O"); con("R2", "2", "CAN_SPLIT"); con("R3", "1", "CAN_SPLIT"); con("R3", "2", "CANL_O"); con("C20", "1", "CAN_SPLIT"); con("C20", "2", "GND"); con("J1", "CANH", "CANH_O"); con("J1", "CANL", "CANL_O");
    } else {
      addN("3V3", "power", "3.3V"); addN("GND", "gnd"); addN(`${cid(name).toUpperCase().slice(0, 12)}_SIG`, "signal");
      addP("U9", "IC", `${name} 주 기능 IC`, "TBD", "TBD", "(후보 미정)", "AEC-Q100", `${name} 기능 블록 — 요구 ${reqIds.join(", ") || "-"} 기준으로 부품 확정`, [["VDD", "pwr"], ["GND", "gnd"], ["IN", "in"], ["OUT", "out"]]);
      addP("C30", "커패시터", "100nF/16V", "0402", "Murata", "GCM155R71C104KA55 (후보)", "X7R AEC-Q200", "디커플링", [["1", "passive"], ["2", "passive"]]);
      con("U9", "VDD", "3V3"); con("U9", "GND", "GND"); con("U9", "OUT", `${cid(name).toUpperCase().slice(0, 12)}_SIG`); con("C30", "1", "3V3"); con("C30", "2", "GND");
    }
  }
  if (!hd.ifs.length) {
    (m.interfaces.HW || []).filter(i => i.from === comp?.id || i.to === comp?.id).forEach(i => hd.ifs.push({ name: i.kind || i.id, dir: i.to === comp.id ? "in" : "out", net: netName((i.signals || i.kind || i.id).split(/[,;]/)[0]), connector: "", spec: [i.signals, i.periodMs ? `${i.periodMs}ms` : ""].filter(Boolean).join(" · "), source: i.id, reqs: [] }));
  }
  if (!hd.specials.length) {
    const cand = hd.parts.filter(p => /TVS|퓨즈|레귤|트랜시버|MCU/i.test(p.kind + p.desc)).slice(0, 4);
    cand.forEach((p, i) => hd.specials.push({ id: `SC-${String(i + 1).padStart(2, "0")}`, char: `${p.ref} ${p.desc} — ${p.rating}`, type: /TVS|퓨즈/.test(p.kind + p.desc) ? "안전" : "기능", target: p.ref, value: p.value, control: "수입검사(인증서) · 공정 중 실장 검사 · 배치 추적", verify: "HWE.3 설계 검증(전기 특성 측정)", reqs: p.reqs }));
  }
  if (!hd.analysis.derating.length) hd.parts.filter(p => p.rating).slice(0, 12).forEach(p => hd.analysis.derating.push({ ref: p.ref, param: /커패/.test(p.kind) ? "정격 전압" : /저항/.test(p.kind) ? "정격 전력" : "정격 전압/전류", rated: p.rating.split(/[,·]/)[0], applied: "(가정) 동작 조건", ratio: "≤ 80%", limit: "80%", ok: true, note: "설계 가정값 — 회로 확정 후 실측·시뮬레이션으로 갱신" }));
  if (!hd.analysis.thermal.length) hd.parts.filter(p => /IC|MCU|트랜지스터/.test(p.kind)).slice(0, 6).forEach(p => hd.analysis.thermal.push({ ref: p.ref, pd_mW: "(계산)", theta: "데이터시트 θJA", ta: "85", tj: "(계산)", limit: "125", ok: true, note: "Tj = Ta + Pd × θJA — 데이터시트 값으로 계산" }));
  if (!hd.analysis.worstCase.length) hd.analysis.worstCase.push({ item: "입력 전압 범위", nominal: "13.5V", min: "6V (크랭킹)", max: "16V (ISO 16750-2) / 18V 점프", limit: "레귤레이터 Vin 4~40V", ok: true, method: "ISO 16750-2 조건 대입", note: "" }, { item: "동작 온도", nominal: "25°C", min: "-40°C", max: "+85°C(실내) / +105°C(엔진룸)", limit: "AEC-Q100 Grade 1", ok: true, method: "부품 등급 확인", note: "" });
  if (!hd.rationale) hd.rationale = `${name}: ${kind} 블록. 할당 HW 요구 ${reqIds.join(", ") || "없음"}을 근거로 부품·넷을 구성하고, 전원·EMC 보호(퓨즈·TVS·역접속)와 디커플링을 기본 포함. 부품 PN은 후보이며 구매·수명·2nd source 검토 후 확정.`;
  if (!hd.summary) hd.summary = `${name}: 부품 ${hd.parts.length}·넷 ${hd.nets.length}·특별특성 ${hd.specials.length}`;
  if (!hd.origin) hd.origin = "rule"; if (!hd.generatedAt) hd.generatedAt = new Date().toISOString();
  return hd;
}
export const ruleHD = (comp, model, seedKey) => fillHDGaps(emptyHD(), comp, model, seedKey);
export const hdMissingComps = m => (normalizeModel(m).comps.HW || []).filter(c => !c.hd?.parts?.length);

function hdContext(comp, model) {
  const m = normalizeModel(model);
  const hwReqs = (m.reqs.HW || []).filter(r => (m.alloc.HW[r.id] || []).includes(comp.id));
  const sysIds = new Set(hwReqs.flatMap(r => r.parents || [])); const sysReqs = (m.reqs.SYS || []).filter(r => sysIds.has(r.id));
  const cn = Object.fromEntries((m.comps.HW || []).map(c => [c.id, c.name]));
  const ifs = (m.interfaces.HW || []).filter(i => i.from === comp.id || i.to === comp.id);
  const S = hdSettings(m);
  return [`[HW 컴포넌트(회로 블록)] ${comp.id} ${comp.name} (${comp.kind || ""}) ${comp.desc || ""}${comp.behavior ? " / 동작: " + comp.behavior : ""}`,
    `[다른 HW 블록] ${(m.comps.HW || []).filter(c => c.id !== comp.id).map(c => `${c.id} ${c.name}`).join(", ") || "-"}`,
    `[할당 HW 요구 — 모든 요소의 reqs에 이 ID]\n${hwReqs.map(r => `- ${r.id} [${r.type}] ${r.title}: ${r.text}${r.verifCriteria ? " / 검증 기준: " + r.verifCriteria : ""}`).join("\n") || "- (없음)"}`,
    sysReqs.length ? `[상위 시스템 요구]\n${sysReqs.map(r => `- ${r.id} ${r.title}: ${String(r.text || "").slice(0, 200)}`).join("\n")}` : "",
    ifs.length ? `[HW 인터페이스]\n${ifs.map(i => `- ${i.id} ${cn[i.from] || i.from} → ${cn[i.to] || i.to}: ${i.kind || ""} ${i.signals || ""} ${i.desc || ""}`).join("\n")}` : "",
    `[환경·기준] ${S.env} · 부품 등급 AEC-Q100/Q200 · EDA ${S.eda}`].filter(Boolean).join("\n");
}
export function promptHDCircuit({ comp, model, guideBlock = "" }) {
  return `역할: 자동차 전장 ECU 수석 HW 설계자(ASPICE HWE.2 담당). 아래 근거 자료로 회로 블록 1개의 **회로 설계**(부품·핀·넷·연결·외부 인터페이스)를 완전하게 작성하세요. 제조사 부품번호(mpn)는 실제 유통되는 자동차용(AEC-Q) 부품을 **후보**로 적되 값 끝에 " (후보)"를 붙이세요. 추측한 값은 desc에 "(가정)".

${hdContext(comp, model)}

규칙:
- parts: 기능에 필요한 모든 부품(IC·수동소자·보호소자·커넥터). ref는 R1·C1·U1·D1·J1 규칙, pins에 핀 번호·이름·type(in|out|io|pwr|gnd|passive). value·pkg(0402·SOIC-8 등)·mfr·mpn·rating(정격)·grade(AEC-Q100/Q200)·special(특별 특성 후보면 true)·reqs.
- 보호(퓨즈·TVS·역접속)·디커플링·풀업/다운·종단 부품을 빠뜨리지 말 것. 핀 이름은 데이터시트 핀 이름(예 VDD·VSS·PA5·TXD). 2단자 수동소자의 핀은 "1"·"2".
- 넷(연결)은 다음 단계에서 따로 작성하므로 이번에는 nets·conns를 쓰지 말 것.
- ifs: 블록 밖으로 나가는 신호·전원(name·dir·net·connector·spec·source 인터페이스 ID·reqs).
- 수치(전압·전류·주파수·저항값)는 요구 문장의 값을 그대로 쓰고, 계산이 필요하면 desc에 식을 적는다.

${guideBlock}
JSON만 출력:
{"summary":"블록 역할 2~3문장","parts":[{"ref":"U1","kind":"IC|MCU|트랜지스터|다이오드|저항|커패시터|인덕터|커넥터|크리스탈|퓨즈|TVS|릴레이|기타","value":"","pkg":"","mfr":"","mpn":"xxx (후보)","rating":"","grade":"AEC-Q100","desc":"","special":false,"reqs":[],"pins":[{"num":"1","name":"VIN","type":"pwr"}]}],
"ifs":[{"name":"","dir":"in|out|io","net":"","connector":"J1.1","spec":"","source":"HWIF-001","reqs":[]}]}`;
}
// 넷(연결) 전용 — 넷 이름 → 핀 목록의 압축 형식으로 받아 응답 잘림을 피한다
export function promptHDNets({ comp, model, circuit, guideBlock = "" }) {
  const c = circuit || emptyHD();
  return `역할: 자동차 전장 ECU 수석 HW 설계자(ASPICE HWE.2). 아래 회로 블록의 부품·핀 목록으로 **넷(전기적 연결)**을 빠짐없이 작성하세요.

${hdContext(comp, model)}

[부품·핀 — "REF: 핀번호 핀이름(형)"]
${c.parts.map(p => `${p.ref} (${p.kind} ${p.value}${p.desc ? " · " + p.desc.slice(0, 40) : ""}): ${p.pins.map(pn => `${pn.num} ${pn.name}(${pn.type})`).join(", ")}`).join("\n")}
${c.ifs.length ? `[블록 밖 인터페이스 — 이 신호 이름을 넷 이름으로] ${c.ifs.map(x => `${x.name}(${x.dir}) net=${x.net}`).join("; ")}` : ""}

규칙:
- 넷마다 연결된 핀을 "REF.핀번호"로 모두 나열. 같은 넷 = 같은 전기적 노드.
- 전원(VBAT·5V·3V3 등)·GND·디커플링 커패시터 양단·풀업/풀다운·크리스탈·리셋·디버그·통신·아날로그 입력을 빠뜨리지 말 것. 2단자 부품은 두 핀 모두 어딘가에 연결.
- 쓰지 않는 핀은 어떤 넷에도 넣지 말 것(NC로 표시됨). 한 핀은 한 넷에만.
- 넷 이름은 영문 대문자·숫자·_ (예 3V3, GND, MCU_RESET_N, CAN1_TX). kind는 power|gnd|signal|bus|analog.

${guideBlock}
JSON만 출력:
{"nets":[{"name":"3V3","kind":"power","voltage":"3.3V","pins":["U1.1","C1.1"]}]}`;
}
// 넷 응답 → conns·nets (핀은 번호 또는 이름 허용, 없는 핀·중복 할당은 버림)
export function applyHDNets(hd0, raw) {
  const hd = { ...hd0, nets: [], conns: [] };
  const idx = {};
  hd0.parts.forEach(p => { const m = {}; p.pins.forEach(pn => { m[String(pn.num).toUpperCase()] = pn.num; m[String(pn.name).toUpperCase()] = pn.num; }); idx[p.ref] = m; });
  const used = new Set(); let dropped = 0;
  arr(raw?.nets).slice(0, 400).forEach(n => {
    const name = netName(n?.name); if (!name || name === "NC") return;
    const kind = ["power", "gnd", "signal", "bus", "analog"].includes(n.kind) ? n.kind : (/GND|VSS/i.test(name) ? "gnd" : /^(V|VCC|VDD|\+?\d+V|\d+V\d)/i.test(name) ? "power" : "signal");
    let any = false;
    arr(n.pins).slice(0, 300).forEach(s => {
      const mm = String(s || "").trim().match(/^([A-Za-z0-9_]+)[.:\-]([A-Za-z0-9_+\-#/]+)$/); if (!mm) { dropped++; return; }
      const ref = cid(mm[1]).toUpperCase(); const pin = idx[ref] && idx[ref][mm[2].toUpperCase()];
      if (!pin) { dropped++; return; }
      const k = `${ref}.${pin}`; if (used.has(k)) { dropped++; return; }
      used.add(k); hd.conns.push({ ref, pin, net: name }); any = true;
    });
    if (any && !hd.nets.some(x => x.name === name)) hd.nets.push({ name, kind, voltage: str(n.voltage, 20), desc: str(n.desc, 120), reqs: [] });
  });
  hd.netsDropped = dropped;
  return hd;
}
// AI 넷을 못 받았을 때의 최소 보강 — 핀 이름·형으로 전원/GND만 연결(신호는 NC로 남김)
export function rulePowerNets(hd0) {
  const hd = { ...hd0, nets: [...hd0.nets], conns: [...hd0.conns] };
  const done = new Set(hd.conns.map(c => `${c.ref}.${c.pin}`));
  const add = (n, kind, v) => { if (!hd.nets.some(x => x.name === n)) hd.nets.push({ name: n, kind, voltage: v, desc: "규칙 보강(핀 이름 기준)", reqs: [] }); };
  hd.parts.forEach(p => p.pins.forEach(pn => {
    if (done.has(`${p.ref}.${pn.num}`)) return;
    const nm = String(pn.name || "").toUpperCase();
    let net = null;
    if (pn.type === "gnd" || /^(A|D|P)?(GND|VSS)/.test(nm)) { net = "GND"; add("GND", "gnd", "0V"); }
    else if (/^(VBAT|VIN|VSUP|KL30)/.test(nm)) { net = "VBAT"; add("VBAT", "power", "12V"); }
    else if (pn.type === "pwr" || /^(VDD|VCC|AVDD|DVDD|VDDA|VDDIO|VCORE|VREF\+?)/.test(nm)) { net = "3V3"; add("3V3", "power", "3.3V"); }
    if (net) { hd.conns.push({ ref: p.ref, pin: pn.num, net }); done.add(`${p.ref}.${pn.num}`); }
  }));
  return hd;
}
export const hdPinStats = hd => { const total = (hd?.parts || []).reduce((s, p) => s + p.pins.length, 0); const con = new Set((hd?.conns || []).filter(c => c.net && c.net !== "NC").map(c => `${c.ref}.${c.pin}`)).size; return { total, con }; };
export const hdNeedsNets = hd => !!(hd && hd.parts?.length && hdPinStats(hd).con === 0);
export function promptHDAnalysis({ comp, model, circuit, guideBlock = "" }) {
  const c = circuit || emptyHD();
  return `역할: 자동차 전장 ECU 수석 HW 설계자(ASPICE HWE.2). 아래 회로 블록에 대해 **특별 특성(17-57)**과 **설계 분석 결과(15-51: Derating·열·타이밍·최악조건)**, **설계 근거**를 작성하세요. 수치는 부품 정격(rating)과 요구 값을 대입해 계산식과 함께 적으세요(가정값은 "(가정)").

${hdContext(comp, model)}

[회로 — 부품] ${c.parts.map(p => `${p.ref} ${p.kind} ${p.value} ${p.pkg} ${p.mpn} 정격:${p.rating}`).join("; ")}
[넷] ${c.nets.map(n => `${n.name}(${n.kind}${n.voltage ? " " + n.voltage : ""})`).join(", ")}

${guideBlock}
JSON만 출력:
{"specials":[{"id":"SC-01","char":"특성 설명","type":"안전|법규|기능|품질","target":"부품 ref 또는 넷","value":"관리 값·공차","control":"관리 방법(수입검사·공정검사·추적)","verify":"검증 방법(HWE.3/4)","reqs":[]}],
"analysis":{"derating":[{"ref":"","param":"정격 전압|전력|전류|온도","rated":"","applied":"","ratio":"%","limit":"80%","ok":true,"note":"계산식"}],
"thermal":[{"ref":"","pd_mW":"","theta":"θJA °C/W","ta":"85","tj":"","limit":"125","ok":true,"note":"Tj=Ta+Pd×θJA"}],
"timing":[{"item":"","req":"","calc":"","margin":"","ok":true,"note":""}],
"worstCase":[{"item":"","nominal":"","min":"","max":"","limit":"","ok":true,"method":"EVA|RSS|MC","note":""}]},
"rationale":"설계 대안 비교와 선택 이유(전원 토폴로지·트랜시버 선정·보호 수준 등) 5~10문장"}`;
}

// ── HW 다이어그램 SVG: block(아키텍처 블록도, 04-52) · schematic(회로도 — 넷 라벨 방식) ──
export const HD_DIAGRAMS = [["top", "통합 회로도(전체 보드)"], ["wired", "연결선 회로도(이 블록)"], ["schematic", "회로도(넷 라벨·EDA용)"], ["block", "블록도"]];
// 연결선 회로도(한눈에 보기) — 회로도 관례대로: 신호는 실제 선으로 잇고, 전원·GND는 핀마다 전원 깃발·접지 기호로 표시.
//  · 핀이 가장 많은 부품(허브: MCU·AFE 등)을 가운데, 나머지는 좌·우 열. 2단자 수동소자(R·C·L·D·퓨즈·크리스탈)는 표준 기호로 그린다.
//  · 허브와 좌·우 열 사이 '채널'에 신호 넷마다 세로선 1개 — 핀은 가로선으로 붙고 접점은 ●. 좌우에 걸친 신호는 허브 위 가로선으로 잇는다.
//  · 허브 핀과 열 부품 핀은 y가 반 칸 어긋나 가로선이 겹치지 않는다.
const SYM_KIND = /저항|커패시터|인덕터|다이오드|TVS|퓨즈|크리스탈/;
function symbolSvg(kind, value, cx, y1, y2, attrs) {
  const L = (a, b2, c, d) => `<line x1="${a}" y1="${b2}" x2="${c}" y2="${d}" stroke="#222" stroke-width="1.3"${attrs}/>`;
  const mid = (y1 + y2) / 2;
  if (/저항/.test(kind)) { const t = mid - 12, bt = mid + 12; let p = `M${cx},${t}`; for (let i = 0; i < 6; i++) p += ` L${cx + (i % 2 ? -5 : 5)},${t + 2 + i * 4}`; p += ` L${cx},${bt}`; return L(cx, y1, cx, t) + `<path d="${p}" fill="none" stroke="#222" stroke-width="1.3"/>` + L(cx, bt, cx, y2); }
  if (/커패시터/.test(kind)) return L(cx, y1, cx, mid - 3) + L(cx - 9, mid - 3, cx + 9, mid - 3) + L(cx - 9, mid + 3, cx + 9, mid + 3) + L(cx, mid + 3, cx, y2);
  if (/인덕터/.test(kind)) { let p = `M${cx},${mid - 12}`; for (let i = 0; i < 4; i++) p += ` a6,3 0 0,1 0,6`; return L(cx, y1, cx, mid - 12) + `<path d="${p}" fill="none" stroke="#222" stroke-width="1.3"/>` + L(cx, mid + 12, cx, y2); }
  if (/다이오드|TVS/.test(kind)) { const led = /LED/i.test(value); return L(cx, y1, cx, mid - 6) + `<path d="M${cx - 7},${mid - 6} L${cx + 7},${mid - 6} L${cx},${mid + 5} Z" fill="#fff" stroke="#222" stroke-width="1.2"/>` + L(cx - 7, mid + 5, cx + 7, mid + 5) + L(cx, mid + 5, cx, y2) + (led ? `<path d="M${cx + 9},${mid - 3} l6,-5 M${cx + 11},${mid + 2} l6,-5" stroke="#222" stroke-width="1"/>` : ""); }
  if (/퓨즈/.test(kind)) return L(cx, y1, cx, mid - 9) + `<rect x="${cx - 4}" y="${mid - 9}" width="8" height="18" fill="#fff" stroke="#222"/>` + L(cx, mid - 9, cx, mid + 9) + L(cx, mid + 9, cx, y2);
  if (/크리스탈/.test(kind)) return L(cx, y1, cx, mid - 8) + L(cx - 8, mid - 8, cx + 8, mid - 8) + `<rect x="${cx - 6}" y="${mid - 5}" width="12" height="10" fill="#fff" stroke="#222"/>` + L(cx - 8, mid + 8, cx + 8, mid + 8) + L(cx, mid + 8, cx, y2);
  return L(cx, y1, cx, y2);
}
function hdWiredSvg(comp, m, opt = {}) {
  const hd = comp?.hd; if (!hd || !hd.parts.length) return "";
  // 이 블록 밖으로 나가는 신호: 블록 인터페이스(ifs)의 넷, 다른 블록에도 같은 이름이 있는 넷
  const otherNets = new Set((m.comps.HW || []).filter(c => c.id !== comp.id && c.hd).flatMap(c => [...(c.hd.nets || []).map(n => n.name), ...(c.hd.ifs || []).map(x => x.net)]));
  const ifNets = new Set((hd.ifs || []).map(x => x.net));
  const extOf = n => opt.top ? "" : otherNets.has(n) ? "⇄ 다른 블록" : ifNets.has(n) ? "⇢ 블록 밖" : "";
  const P = 16, STUB = 18, TRK = 13, SP = 48;
  const netOf = {}; hd.conns.forEach(c => { if (c.net && c.net !== "NC") netOf[`${c.ref}.${c.pin}`] = c.net; });
  const pinNet = (p, pn) => netOf[`${p.ref}.${pn.num}`] || netOf[`${p.ref}.${pn.name}`] || null;
  const parts = hd.parts;
  const isSym = p => p.pins.length === 2 && SYM_KIND.test(p.kind);
  const hub = parts.length > 2 ? parts.reduce((a, p) => (p.pins.length > a.pins.length ? p : a), parts[0]) : null;
  const ml = xs => xs.reduce((s, q) => Math.max(s, String(q.name || "").length), 0);
  const kindOf = n => /GND|VSS/i.test(n) ? "gnd" : /^(V|VCC|VDD|\+?\d+V|\d+V\d)/i.test(n) ? "pwr" : "sig";
  const col = n => kindOf(n) === "gnd" ? "#333" : kindOf(n) === "pwr" ? "#B00020" : "#1A4D8F";
  let hubL = [], hubR = [];
  if (hub) { hubL = hub.pins.filter((pn, i) => pn.type === "in" || pn.type === "pwr" || (pn.type === "passive" && i % 2 === 0)); hubR = hub.pins.filter(pn => !hubL.includes(pn)); }
  const sideOfNet = {}; hubL.forEach(pn => { const n = pinNet(hub, pn); if (n) sideOfNet[n] = (sideOfNet[n] || 0) - 1; }); hubR.forEach(pn => { const n = pinNet(hub, pn); if (n) sideOfNet[n] = (sideOfNet[n] || 0) + 1; });
  const others = parts.filter(p => p !== hub);
  const colL = [], colR = []; let hL = 0, hR = 0;
  others.forEach(p => { const score = p.pins.reduce((s, pn) => { const n = pinNet(p, pn); return s + (n && kindOf(n) === "sig" ? (sideOfNet[n] || 0) : 0); }, 0); const ph = isSym(p) ? SP + 50 : 24 + p.pins.length * P + 30;
    const goL = score < 0 || (score === 0 && hL <= hR); if (goL) { colL.push(p); hL += ph; } else { colR.push(p); hR += ph; }
    p.pins.forEach(pn => { const n = pinNet(p, pn); if (n && kindOf(n) === "sig" && !sideOfNet[n]) sideOfNet[n] = goL ? -1 : 1; }); });
  const top0 = 70;
  const wOf = p => isSym(p) ? 70 : Math.max(70, Math.round(ml(p.pins) * 5.2 + 26));
  const colLW = Math.max(70, ...colL.map(wOf)), colRW = Math.max(70, ...colR.map(wOf));
  const leftX = 30;
  const sigOf = list => { const s = new Set(); list.forEach(([p, pn]) => { const n = pinNet(p, pn); if (n && kindOf(n) === "sig") s.add(n); }); return s; };
  const netsL = sigOf([...colL.flatMap(p => p.pins.map(pn => [p, pn])), ...hubL.map(pn => [hub, pn])]);
  const netsR = sigOf([...colR.flatMap(p => p.pins.map(pn => [p, pn])), ...hubR.map(pn => [hub, pn])]);
  const trL = [...netsL].sort(), trR = [...netsR].sort();
  const chLW = trL.length * TRK + 60, chRW = trR.length * TRK + 60;
  const colLx = leftX + 40;
  const chL0 = colLx + colLW + STUB + 40;
  const hubW = hub ? Math.max(120, Math.round((ml(hubL) + ml(hubR)) * 5.2 + 30)) : 0;
  const hubX = chL0 + chLW;
  const chR0 = hub ? hubX + hubW + STUB + 40 : chL0;
  const colRx = (hub ? chR0 + chRW : chL0 + chLW) + STUB + 40;
  const pinsAt = [], boxes = [];
  const place = (list, xBox, w, side) => { let y = top0 + 8;
    list.forEach(p => {
      if (isSym(p)) { const cx = side === "R" ? xBox + w - 18 : xBox + 18; boxes.push({ p, sym: true, cx, y1: y + 14, y2: y + 14 + SP, side });
        p.pins.forEach((pn, k) => { const py = y + 14 + k * SP; pinsAt.push({ p, pn, net: pinNet(p, pn), y: py, edge: cx, x: side === "R" ? cx + STUB : cx - STUB, dir: side, sym: true }); });
        y += SP + 48; }
      else { const h = 20 + p.pins.length * P; boxes.push({ p, x: xBox, y, w, h });
        p.pins.forEach((pn, k) => { const py = y + 14 + k * P; pinsAt.push({ p, pn, net: pinNet(p, pn), y: py, x: side === "R" ? xBox + w + STUB : xBox - STUB, edge: side === "R" ? xBox + w : xBox, dir: side }); });
        y += h + 34; }
      while ((y + 14 - top0) % P !== 8) y++; }); return y; };
  const yEndL = place(colL, colLx, colLW, "R");
  const yEndR = place(colR, colRx, colRW, "L");
  let hubH = 0;
  if (hub) { hubH = 24 + Math.max(hubL.length, hubR.length) * P; boxes.push({ p: hub, x: hubX, y: top0, w: hubW, h: hubH, hub: true });
    hubL.forEach((pn, k) => pinsAt.push({ p: hub, pn, net: pinNet(hub, pn), y: top0 + 16 + k * P, x: hubX - STUB, edge: hubX, dir: "L" }));
    hubR.forEach((pn, k) => pinsAt.push({ p: hub, pn, net: pinNet(hub, pn), y: top0 + 16 + k * P, x: hubX + hubW + STUB, edge: hubX + hubW, dir: "R" })); }
  const chOf = pa => (!hub ? "L" : (colL.includes(pa.p) || (pa.p === hub && pa.dir === "L")) ? "L" : "R");
  const trackX = (ch, n) => ch === "L" ? chL0 + 24 + trL.indexOf(n) * TRK : chR0 + 24 + trR.indexOf(n) * TRK;
  const both = hub ? trL.filter(n => trR.includes(n)) : [];
  const bridgeY = {}; both.forEach((n, i) => { bridgeY[n] = top0 - 26 - i * 10; });
  const minTop = Math.min(top0 - 30, ...Object.values(bridgeY).map(v => v - 12));
  const st = hdPinStats(hd);
  const shift = Math.max(0, 70 - minTop) + (st.con ? 0 : 28);
  let b = "";
  if (!st.con) b += `<rect x="${leftX - 10}" y="${minTop - 52}" width="760" height="24" rx="4" fill="#FFEBEE" stroke="#B00020"/><text x="${leftX}" y="${minTop - 35}" font-size="11" font-weight="700" fill="#B00020">⚠ 이 블록은 아직 연결(넷)이 없습니다 — 모든 핀이 NC입니다. HWE.2의 [🔗 연결 생성]을 실행하면 선이 그려집니다.</text>`;
  const dn = (n, pa) => n ? ` data-net="${X(n)}"${pa ? ` data-pin="${X(pa.p.ref)}.${X(pa.pn.name)}"` : ""} style="cursor:pointer"` : "";
  boxes.forEach(bx => { const p = bx.p;
    if (bx.sym) { const tx = bx.side === "R" ? bx.cx - 14 : bx.cx + 14, an = bx.side === "R" ? "end" : "start";
      b += symbolSvg(p.kind, p.value, bx.cx, bx.y1, bx.y2, "") + `<text x="${tx}" y="${(bx.y1 + bx.y2) / 2 - 2}" text-anchor="${an}" font-weight="700" font-size="10">${X(p.ref)}</text><text x="${tx}" y="${(bx.y1 + bx.y2) / 2 + 10}" text-anchor="${an}" font-size="8.5" fill="#555">${X(p.value)}</text>`; return; }
    b += `<rect x="${bx.x}" y="${bx.y}" width="${bx.w}" height="${bx.h}" fill="${bx.hub ? "#EEF4FF" : "#FFFDF2"}" stroke="#222"/><text x="${bx.x + bx.w / 2}" y="${bx.y - 6}" text-anchor="middle" font-weight="700" font-size="10.5">${X(p.ref)}</text><text x="${bx.x + bx.w / 2}" y="${bx.y + bx.h + 11}" text-anchor="middle" font-size="8.5" fill="#555">${X(p.value)}${p.pkg ? ` · ${X(p.pkg)}` : ""}</text>`; });
  const gndSym = (x, y, n, pa) => `<g${dn(n, pa)}><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="#333" stroke-width="1.3"/><line x1="${x - 8}" y1="${y + 8}" x2="${x + 8}" y2="${y + 8}" stroke="#333" stroke-width="1.3"/><line x1="${x - 5}" y1="${y + 11}" x2="${x + 5}" y2="${y + 11}" stroke="#333" stroke-width="1.3"/><line x1="${x - 2}" y1="${y + 14}" x2="${x + 2}" y2="${y + 14}" stroke="#333" stroke-width="1.3"/>${n !== "GND" ? `<text x="${x}" y="${y + 24}" text-anchor="middle" font-size="7" fill="#333">${X(n)}</text>` : ""}</g>`;
  const pwrSym = (x, y, n, pa) => `<g${dn(n, pa)}><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 8}" stroke="#B00020" stroke-width="1.3"/><line x1="${x - 7}" y1="${y - 8}" x2="${x + 7}" y2="${y - 8}" stroke="#B00020" stroke-width="1.6"/><text x="${x}" y="${y - 11}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#B00020">${X(n)}</text></g>`;
  const byNet = {};
  pinsAt.forEach(pa => {
    if (!pa.sym) { const nm = X(pa.pn.name); b += pa.dir === "R" ? `<text x="${pa.edge - 4}" y="${pa.y + 3}" text-anchor="end" font-size="8">${nm}</text>` : `<text x="${pa.edge + 4}" y="${pa.y + 3}" font-size="8">${nm}</text>`; }
    b += `<line x1="${pa.edge}" y1="${pa.y}" x2="${pa.x}" y2="${pa.y}" stroke="#222" stroke-width="1.2"${dn(pa.net, pa)}/>`;
    if (!pa.net) { b += `<text x="${pa.dir === "R" ? pa.x + 3 : pa.x - 3}" y="${pa.y + 3}" font-size="8" fill="#999" ${pa.dir === "R" ? "" : 'text-anchor="end"'}>NC ×</text>`; return; }
    const k = kindOf(pa.net);
    if (k === "gnd" || k === "pwr") {
      // 박스 부품의 이웃 핀(16px 간격)에 기호가 겹치지 않도록 한 칸 걸러 선을 더 뺀다
      const ext = 0; const xe = pa.x;
      if (ext) b += `<line x1="${pa.x}" y1="${pa.y}" x2="${xe}" y2="${pa.y}" stroke="#222" stroke-width="1.2"${dn(pa.net, pa)}/>`;
      if (pa.sym) { b += k === "gnd" ? gndSym(xe, pa.y, pa.net, pa) : pwrSym(xe, pa.y, pa.net, pa); return; }
      // 박스 부품 핀(16px 간격)은 기호를 옆으로 눕혀 위아래 핀의 선과 겹치지 않게
      const s = pa.dir === "R" ? 1 : -1;
      b += k === "gnd"
        ? `<g${dn(pa.net, pa)}><line x1="${xe}" y1="${pa.y - 7}" x2="${xe}" y2="${pa.y + 7}" stroke="#333" stroke-width="1.3"/><line x1="${xe + s * 3}" y1="${pa.y - 4.5}" x2="${xe + s * 3}" y2="${pa.y + 4.5}" stroke="#333" stroke-width="1.3"/><line x1="${xe + s * 6}" y1="${pa.y - 2}" x2="${xe + s * 6}" y2="${pa.y + 2}" stroke="#333" stroke-width="1.3"/>${pa.net !== "GND" ? `<text x="${xe + s * 10}" y="${pa.y + 3}" font-size="7" fill="#333" ${s < 0 ? 'text-anchor="end"' : ""}>${X(pa.net)}</text>` : ""}</g>`
        : `<g${dn(pa.net, pa)}><line x1="${xe}" y1="${pa.y - 6}" x2="${xe}" y2="${pa.y + 6}" stroke="#B00020" stroke-width="1.8"/><text x="${xe + s * 4}" y="${pa.y + 3}" font-size="7.5" font-weight="700" fill="#B00020" ${s < 0 ? 'text-anchor="end"' : ""}>${X(pa.net)}</text></g>`;
      return; }
    const ch = chOf(pa); const tx = trackX(ch, pa.net); const c = col(pa.net);
    b += `<line x1="${pa.x}" y1="${pa.y}" x2="${tx}" y2="${pa.y}" stroke="${c}" stroke-width="1.3"${dn(pa.net, pa)}/><circle cx="${tx}" cy="${pa.y}" r="2.6" fill="${c}"${dn(pa.net)}/>`;
    (byNet[pa.net] = byNet[pa.net] || { L: [], R: [], n: 0 }); byNet[pa.net][ch].push(pa.y); byNet[pa.net].n++;
  });
  Object.entries(byNet).forEach(([n, g]) => { const c = col(n); const lone = g.n < 2;
    ["L", "R"].forEach(ch => { const ys = g[ch]; if (!ys.length) return; const tx = trackX(ch, n);
      const y1 = both.includes(n) ? bridgeY[n] : Math.min(...ys), y2 = Math.max(...ys);
      if (y2 > y1) b += `<line x1="${tx}" y1="${y1}" x2="${tx}" y2="${y2}" stroke="${c}" stroke-width="1.4"${dn(n)}/>`;
      const ex = extOf(n); const warn = lone && !ex && !opt.top;
      if (!both.includes(n)) b += `<text x="${tx + 3}" y="${Math.min(...ys) - 4}" font-size="7.5" fill="${warn ? "#C77700" : c}" font-weight="700"${dn(n)}>${X(n)}${warn ? " ⚠" : ""}${ex ? `<tspan fill="#00796B"> ${ex}</tspan>` : ""}</text>`; });
    if (both.includes(n)) { const xa = trackX("L", n), xb = trackX("R", n), yb = bridgeY[n];
      b += `<line x1="${xa}" y1="${yb}" x2="${xb}" y2="${yb}" stroke="${c}" stroke-width="1.4"${dn(n)}/><circle cx="${xa}" cy="${yb}" r="2" fill="${c}"/><circle cx="${xb}" cy="${yb}" r="2" fill="${c}"/><text x="${(xa + xb) / 2}" y="${yb - 2.5}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${c}"${dn(n)}>${X(n)}</text>`; } });
  const W = Math.max(colRx + colRW + 60, (hub ? chR0 + chRW : chL0 + chLW) + 80, 800);
  const Hc = Math.max(yEndL, yEndR, top0 + hubH + 30);
  let ly = Hc + 10;
  (opt.notes || [`연결선 회로도(한눈에 보기) — 신호는 선으로 연결(● 접점, 선이 교차해도 ●가 없으면 연결 아님) · 전원은 빨간 깃발, GND는 접지 기호(같은 이름끼리 연결) · NC × 미연결 · ⚠ 한 핀만 연결(상대 확인 필요) · ⇄ 다른 블록과 연결 · ⇢ 블록 밖(커넥터 등).`,
    `연결된 핀 ${st.con}/${st.total} · 신호 넷 ${Object.keys(byNet).length} · 부품 ${parts.length}${hub ? ` · 가운데 ${hub.ref}` : ""} — 보기용 자동 배치입니다. 전체 보드는 '통합 회로도(전체)', EDA 납품용은 '회로도'(넷 라벨 방식, ${hdSettings(m).schematicFmt} 기준).`]).forEach((t, i) => { if (i) ly += 14; b += `<text x="${leftX}" y="${ly}" font-size="9" fill="#555">${X(t)}</text>`; });
  const H = ly + 20 + shift;
  return svgWrap(W, H, `<g transform="translate(0,${shift})">${b}</g>`, opt.title || `${comp.id} ${comp.name} — 연결선 회로도 (한눈에 보기)`);
}
// 블록 간 연결(최상위 넷) 계산 — ① HW 인터페이스(HWIF)마다 양 끝 블록의 포트를 잇고 ② 같은 이름의 전원·GND·신호 넷을 블록 사이에서 잇는다
export function hwTopNets(model) {
  const m = normalizeModel(model);
  const comps = (m.comps.HW || []).filter(c => c.hd?.parts?.length);
  const ports = {}; comps.forEach(c => { ports[c.id] = []; });
  const addPort = (cid0, name, type, net) => { const list = ports[cid0]; if (!list) return; const nm = netName(name); if (list.some(p => p.name === nm)) { const p = list.find(q => q.name === nm); if (!p.net) p.net = net; return; } list.push({ name: nm, type, net }); };
  const tops = [];
  (m.interfaces.HW || []).forEach(i => {
    const A = comps.find(c => c.id === i.from), B = comps.find(c => c.id === i.to); if (!A || !B) return;
    const sig = netName(String(i.signals || i.kind || i.id).split(/[,;·/]/)[0].trim()) || netName(i.id);
    const pa = (A.hd.ifs || []).find(x => x.source === i.id)?.net || sig, pb = (B.hd.ifs || []).find(x => x.source === i.id)?.net || sig;
    const top = netName(`${sig}`); tops.push({ net: top, ifId: i.id, from: A.id, to: B.id, kind: i.kind || "" });
    addPort(A.id, pa, "out", top); addPort(B.id, pb, "in", top);
  });
  // 같은 이름 넷이 둘 이상의 블록에 있으면 연결(전원·GND 포함)
  const byName = {}; comps.forEach(c => new Set([...(c.hd.nets || []).map(n => n.name), ...(c.hd.ifs || []).map(x => x.net)]).forEach(n => { if (n && n !== "NC") (byName[n] = byName[n] || []).push(c.id); }));
  Object.entries(byName).forEach(([n, cs]) => { if (cs.length < 2) return; const pwr = /GND|VSS/i.test(n) ? "gnd" : /^(V|VCC|VDD|\+?\d+V|\d+V\d)/i.test(n) ? "pwr" : "io"; cs.forEach(c => addPort(c, n, pwr, n)); if (pwr === "io") tops.push({ net: n, ifId: "", from: cs[0], to: cs.slice(1).join(","), kind: "같은 넷 이름" }); });
  // 블록 밖(커넥터)으로 나가는 인터페이스 — 어느 블록과도 이어지지 않은 ifs
  comps.forEach(c => (c.hd.ifs || []).forEach(x => { if (!ports[c.id].some(p => p.name === netName(x.net))) addPort(c.id, x.net, /in/.test(x.dir) ? "in" : /out/.test(x.dir) ? "out" : "io", null); }));
  return { comps, ports, tops };
}
function hwTopSvg(model) {
  const m = normalizeModel(model);
  const { comps, ports, tops } = hwTopNets(m);
  if (!comps.length) return svgWrap(700, 120, `<text x="20" y="60" font-size="12">회로 설계가 있는 HW 블록이 없습니다 — HWE.2에서 블록별 회로 설계를 먼저 만드세요.</text>`, "HW 통합 회로도 (전체 보드)");
  // 블록을 '부품', 포트를 '핀'으로 하는 가상 회로로 바꿔 연결선 회로도 엔진으로 그린다
  const parts = comps.map(c => ({ ref: c.id, kind: "블록", value: c.name, pkg: `부품 ${c.hd.parts.length}`, pins: ports[c.id].map((p, k) => ({ num: String(k + 1), name: p.name, type: p.type === "gnd" ? "gnd" : p.type === "pwr" ? "pwr" : p.type === "in" ? "in" : p.type === "out" ? "out" : "io" })) })).filter(p => p.pins.length);
  const conns = []; comps.forEach(c => ports[c.id].forEach((p, k) => { if (p.net) conns.push({ ref: c.id, pin: String(k + 1), net: netName(p.net) }); }));
  const pseudo = { id: "HW-TOP", name: "통합", hd: { parts, conns, nets: [], ifs: [] } };
  const nIf = tops.filter(t => t.ifId).length;
  const unlinked = (m.interfaces.HW || []).filter(i => !comps.some(c => c.id === i.from) || !comps.some(c => c.id === i.to)).length;
  return hdWiredSvg(pseudo, m, { top: true, title: `HW 통합 회로도 (전체 보드 · 최상위 계층 시트) — 블록 ${parts.length}개`,
    notes: [`최상위 계층 시트 — 상자 = HW 블록(내부는 블록별 연결선 회로도), 상자의 핀 = 블록 포트, 선 = 블록 간 연결. 연결 근거: HW 인터페이스 ${nIf}건(HWIF) + 여러 블록에 같은 이름으로 있는 넷. 전원·GND는 기호(같은 이름끼리 연결).`,
      `NC × 포트 = 어느 블록과도 이어지지 않은 블록 밖 신호(커넥터·외부 장치로 나가는 것 — 커넥터 블록에서 확인)${unlinked ? ` · 회로 설계가 없는 블록과의 인터페이스 ${unlinked}건은 표시되지 않음` : ""}. 전원 넷 이름이 블록마다 다르면(예 3V3 · AFE_3V3) 따로 표시되니 이름을 맞추세요.`] });
}
export function hdSvg(kind, comp, model) {
  const m = normalizeModel(model);
  if (kind === "block") {
    // 허브(연결이 가장 많은 블록)를 가운데, 나머지는 원형 배치 → 허브-블록 간선이 다른 블록을 가로지르지 않는다. 선에는 ID만, 내용은 하단 범례.
    const comps = m.comps.HW || []; const cn = Object.fromEntries(comps.map(c => [c.id, c.name])); const ifsAll = m.interfaces.HW || [];
    const deg = {}; ifsAll.forEach(i => { deg[i.from] = (deg[i.from] || 0) + 1; deg[i.to] = (deg[i.to] || 0) + 1; });
    const hub = comps.length > 3 && ifsAll.length ? comps.reduce((a, c) => (deg[c.id] || 0) > (deg[a.id] || 0) ? c : a, comps[0]) : null;
    const bw = c => Math.max(170, tw(c.name) + 40), bh = 64;
    let rects;
    if (hub) {
      const ring = comps.filter(c => c !== hub); const n = ring.length; const R = Math.max(230, n * 48); const cx = R + 160, cy = R + 90;
      rects = [{ it: hub, x: cx - bw(hub) / 2, y: cy - bh / 2, w: bw(hub), h: bh }, ...ring.map((c, i) => { const ang = -Math.PI / 2 + (2 * Math.PI * i) / n; return { it: c, x: cx + Math.cos(ang) * R - bw(c) / 2, y: cy + Math.sin(ang) * R - bh / 2, w: bw(c), h: bh }; })];
    } else rects = gridLayout(comps, bw, () => bh, 3, 130, 50, 40).rects;
    const W = Math.max(...rects.map(r => r.x + r.w), 700) + 40, H = Math.max(...rects.map(r => r.y + r.h)) + 30;
    const by = Object.fromEntries(rects.map(r => [r.it.id, r]));
    let b = rects.map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4" fill="${r.it.id === comp?.id ? "#E8F0FE" : r.it === hub ? "#FFF8E1" : "#F7F7F7"}" stroke="#222" stroke-width="${r.it.id === comp?.id ? 2 : 1}"/><text x="${r.x + r.w / 2}" y="${r.y + 24}" text-anchor="middle" font-weight="700">${X(r.it.name)}</text><text x="${r.x + r.w / 2}" y="${r.y + 42}" text-anchor="middle" font-size="9.5" fill="#555">${X(r.it.kind || "")}${r.it.hd?.parts?.length ? ` · 부품 ${r.it.hd.parts.length}` : ""}</text>`).join("");
    const pairN = {}; const legend = [];
    ifsAll.forEach(i => { const f = by[i.from], t = by[i.to]; if (!f || !t) return; const key = [i.from, i.to].sort().join("|"); const n = (pairN[key] = (pairN[key] || 0) + 1);
      const fc = { x: f.x + f.w / 2, y: f.y + f.h / 2 }, tc = { x: t.x + t.w / 2, y: t.y + t.h / 2 };
      // 같은 쌍의 여러 간선은 수직 방향으로 조금씩 비켜 그린다
      const dx = tc.x - fc.x, dy = tc.y - fc.y, L = Math.hypot(dx, dy) || 1, off = (n - 1 - (n > 1 ? 1 : 0)) * 14 * (n % 2 ? 1 : -1), ox = -dy / L * off, oy = dx / L * off;
      const p1 = edgePoint(f, { x: tc.x + ox, y: tc.y + oy }), p2 = edgePoint(t, { x: fc.x + ox, y: fc.y + oy });
      b += arrowPath({ x: p1.x + ox, y: p1.y + oy }, { x: p2.x + ox, y: p2.y + oy }, "ar", "", i.id, { t: 0.5, bg: true });
      legend.push([i.id, `${cn[i.from] || i.from} → ${cn[i.to] || i.to}`, `${i.kind || ""} ${i.signals || ""}${i.periodMs ? ` (${i.periodMs}ms)` : ""}`.trim()]); });
    let ly = H + 10; const legendRows = legend.slice(0, 60);
    if (legendRows.length) { b += `<text x="30" y="${ly}" font-weight="700">인터페이스 범례</text>`; ly += 8; legendRows.forEach(([id, ft, d]) => { ly += 14; b += `<text x="30" y="${ly}" font-size="9.5" fill="#333"><tspan font-family="monospace">${X(id)}</tspan>  ${X(ft)} — ${X(d.slice(0, 100))}</text>`; }); ly += 16; }
    return svgWrap(W, legendRows.length ? ly : H, b, `HW 아키텍처 블록도 (04-52)${comp ? ` — ${comp.name} 강조` : ""}`);
  }
  if (kind === "top") return hwTopSvg(m);
  if (kind === "wired") return hdWiredSvg(comp, m);
  const hd = comp?.hd; if (!hd) return "";
  // 회로도: 부품 심볼(사각 + 핀)을 격자 배치, 각 핀 끝에 넷 라벨. 전원/GND 넷은 심볼 표기.
  const parts = hd.parts; const perRow = 4, colW = 290, rowGap = 44, top = 44, left = 70;
  const netOf = {}; hd.conns.forEach(c => { netOf[`${c.ref}.${c.pin}`] = c.net; });
  let x = left, y = top, rowH = 0, W = 400; let b = "";
  parts.forEach((p, i) => {
    const L = p.pins.filter(pn => pn.type === "in" || pn.type === "pwr" || pn.type === "passive" && p.pins.indexOf(pn) % 2 === 0), Rr = p.pins.filter(pn => !L.includes(pn));
    const ml = xs => xs.reduce((s, q) => Math.max(s, String(q.name || "").length), 0);
    const h = Math.max(54, 24 + Math.max(L.length, Rr.length) * 16), w = Math.max(110, Math.round((ml(L) + ml(Rr)) * 5 + 26));   // 핀 이름이 길면 심볼을 넓혀 좌우 이름이 겹치지 않게
    if (i && i % perRow === 0) { x = left; y += rowH + rowGap; rowH = 0; }
    const bx = x + 55, by0 = y;
    b += `<rect x="${bx}" y="${by0}" width="${w}" height="${h}" fill="#FFFDF2" stroke="#222"/><text x="${bx + w / 2}" y="${by0 - 6}" text-anchor="middle" font-weight="700" font-size="10.5">${X(p.ref)}</text><text x="${bx + w / 2}" y="${by0 + h + 11}" text-anchor="middle" font-size="9">${X(p.value)}${p.pkg ? ` · ${X(p.pkg)}` : ""}</text>`;
    const pinRow = (pn, k, side) => { const py = by0 + 16 + k * 16; const net = netOf[`${p.ref}.${pn.num}`] || netOf[`${p.ref}.${pn.name}`] || "NC"; const isGnd = /GND|VSS/i.test(net), isPwr = /^(V|VCC|VDD|\+?\d+V|3V3|5V)/i.test(net) && !isGnd;
      const dn = net === "NC" ? "" : ` data-net="${X(net)}" data-pin="${X(p.ref)}.${X(pn.name)}" style="cursor:pointer"`;
      if (side === "L") { b += `<line${dn} x1="${bx - 24}" y1="${py}" x2="${bx}" y2="${py}" stroke="#222"/><text x="${bx + 4}" y="${py + 3.5}" font-size="8.5">${X(pn.name)}</text>`;
        b += isGnd ? `<line x1="${bx - 24}" y1="${py}" x2="${bx - 24}" y2="${py + 10}" stroke="#222"/><line x1="${bx - 31}" y1="${py + 10}" x2="${bx - 17}" y2="${py + 10}" stroke="#222"/><line x1="${bx - 28}" y1="${py + 13}" x2="${bx - 20}" y2="${py + 13}" stroke="#222"/>` : `<text${dn} x="${bx - 27}" y="${py + 3.5}" text-anchor="end" font-size="8" fill="${net === "NC" ? "#999" : isPwr ? "#B00020" : "#1A4D8F"}" ${isPwr ? 'font-weight="700"' : ""}>${X(net)}</text>`; }
      else { b += `<line${dn} x1="${bx + w}" y1="${py}" x2="${bx + w + 24}" y2="${py}" stroke="#222"/><text x="${bx + w - 4}" y="${py + 3.5}" text-anchor="end" font-size="8.5">${X(pn.name)}</text>`;
        b += isGnd ? `<line x1="${bx + w + 24}" y1="${py}" x2="${bx + w + 24}" y2="${py + 10}" stroke="#222"/><line x1="${bx + w + 17}" y1="${py + 10}" x2="${bx + w + 31}" y2="${py + 10}" stroke="#222"/><line x1="${bx + w + 20}" y1="${py + 13}" x2="${bx + w + 28}" y2="${py + 13}" stroke="#222"/>` : `<text${dn} x="${bx + w + 27}" y="${py + 3.5}" font-size="8" fill="${net === "NC" ? "#999" : isPwr ? "#B00020" : "#1A4D8F"}" ${isPwr ? 'font-weight="700"' : ""}>${X(net)}</text>`; } };
    L.forEach((pn, k) => pinRow(pn, k, "L")); Rr.forEach((pn, k) => pinRow(pn, k, "R"));
    rowH = Math.max(rowH, h + 24); x += Math.max(colW, w + 180); W = Math.max(W, x + 40);
  });
  // 넷 연결 목록 — 라벨 방식에서 '어디와 어디가 이어지는지'를 글로 보여 준다
  const members = {}; hd.conns.filter(c => c.net && c.net !== "NC").forEach(c => { const p = parts.find(q => q.ref === c.ref); const pn = p?.pins.find(q => q.num === c.pin || q.name === c.pin); (members[c.net] = members[c.net] || []).push(`${c.ref}.${pn ? pn.name : c.pin}`); });
  const st = hdPinStats(hd);
  let ly = y + rowH + 20;
  b += `<text x="${left}" y="${ly}" font-weight="700" font-size="10.5">넷 연결 목록 — 같은 이름의 라벨은 전선으로 이어진 것과 같습니다 (연결된 핀 ${st.con} / 전체 ${st.total})</text>`;
  if (!st.con) { ly += 18; b += `<text x="${left}" y="${ly}" font-size="10" fill="#B00020">⚠ 이 블록은 아직 연결(넷)이 없습니다 — 모든 핀이 NC입니다. HWE.2 화면의 [🔗 연결 생성]으로 부품은 그대로 두고 연결만 만드세요.</text>`; }
  const netRows = Object.entries(members).sort((p, q) => (/GND/.test(p[0]) ? 1 : 0) - (/GND/.test(q[0]) ? 1 : 0) || q[1].length - p[1].length);
  netRows.slice(0, 80).forEach(([n, ms]) => { ly += 13; const lone = ms.length < 2; b += `<text x="${left}" y="${ly}" font-size="9" fill="${lone ? "#C77700" : "#333"}" data-net="${X(n)}" style="cursor:pointer"><tspan font-weight="700" font-family="monospace">${X(n)}</tspan>  (${ms.length}핀) ${X(ms.slice(0, 18).join(", "))}${ms.length > 18 ? " …" : ""}${lone ? "  ⚠ 한 핀만 연결 — 상대 연결 확인 필요" : ""}</text>`; });
  if (netRows.length > 80) { ly += 13; b += `<text x="${left}" y="${ly}" font-size="9" fill="#555">… 외 ${netRows.length - 80}개 넷 (BOM·넷 표 참조)</text>`; }
  const H = ly + 44;
  b += `<text x="${left}" y="${H - 18}" font-size="9" fill="#555">넷 라벨 방식 회로도 — 같은 이름의 라벨은 서로 연결됨(빨강: 전원 넷, 파랑: 신호 넷, 회색 NC: 미연결, 기호: GND). 부품 PN은 후보(BOM 참조). 넷 ${hd.nets.length}개 · 부품 ${parts.length}개 · 연결 ${hd.conns.length}</text>`;
  return svgWrap(W, H, b, `${comp.id} ${comp.name} — 회로도 (04-54, ${hdSettings(m).schematicFmt} 내보내기 기준)`);
}


// ═══════════════════════════════════════════════════════════════════════════
// 16) 1차 검토 기준 — Automotive SPICE PAM(VDA QMC) 프로세스 BP 기반 (선택 버전 3.1 / 4.0 / 겸용)
//    기존 기준(RC/AC/DC/TC)은 그대로 2차로 쓰고, 그 앞에 해당 프로세스의 BP 요건을 항목 단위 점검문으로 둔다.
//    BP 문구는 PAM 원문을 옮기지 않고 점검 목적으로 요약한 것이다(원문·심사 기준은 VDA QMC 발행본 참조).
// ═══════════════════════════════════════════════════════════════════════════
const VDA_FAMILY = { "SYS.2": "req", "SWE.1": "req", "HWE.1": "req", "SYS.3": "arch", "SWE.2": "arch", "HWE.2": "arch", "SWE.3": "dd",
  "SYS.4": "ver", "SYS.5": "ver", "SWE.4": "ver", "SWE.5": "ver", "SWE.6": "ver", "HWE.3": "ver", "HWE.4": "ver" };
// [코드 접미, 4.0 BP, 3.1 BP, 라벨, 항목 점검문]
const VDA_BP = {
  req: [
    ["SPEC", "BP1", "BP1", "요구 명세", "상위(이해관계자·시스템) 요구에서 도출된 요구로서 기능·비기능이 식별되고 '무엇을' 하는지 완결된 문장으로 적혀 있는가"],
    ["STRUCT", "BP2", "BP2", "구조화", "요구가 유형(기능·비기능·인터페이스)·우선순위·그룹으로 구조화·분류되어 있는가"],
    ["ANALYZE", "BP3", "BP3", "분석·실현성", "정확성·기술적 실현 가능성·검증 가능성 관점에서 분석된 흔적(수치·조건·제약)이 있는가"],
    ["CONTEXT", "BP4", "BP4", "환경 영향", "운영 환경·시스템 컨텍스트(다른 요소·외부 시스템)에 미치는 영향이 고려되었는가"],
    ["VERIFC", "BP3", "BP5", "검증 기준", "합격·불합격을 가를 검증 기준(수치·허용오차·조건)이 요구에 붙어 있는가 (4.0은 BP3 분석에 포함)"],
    ["TRACE", "BP5", "BP6", "양방향 추적", "상위 요구와의 양방향 추적(부모 ID)이 있고 고아 요구가 아닌가"],
    ["CONSIST", "BP5", "BP7", "일관성", "상위 요구 및 같은 수준의 다른 요구와 내용·수치·용어가 일관되는가"],
    ["COMM", "BP6", "BP8", "합의·공유", "관련자(고객·설계)와 합의된 상태(status·release)가 표시되어 있는가"],
  ],
  arch: [
    ["DEVEL", "BP1", "BP1", "아키텍처 수립", "요소(컴포넌트)가 책임·기능과 함께 식별되고 상위 요구를 실현하는 구조로 정의되어 있는가"],
    ["ALLOC", "BP2", "BP2", "요구 할당", "상위 요구가 요소에 빠짐없이·중복 없이 할당되어 있는가"],
    ["IFACE", "BP3", "BP3", "인터페이스 정의", "요소 간·외부 인터페이스의 방향·데이터(신호)·주기·프로토콜·범위가 정의되어 있는가"],
    ["DYN", "BP4", "BP4", "동적 동작", "운영 모드·상태 전이·타이밍·시퀀스 등 동적 동작이 기술되고 요소 설명과 맞는가"],
    ["ALT", "BP5", "BP5", "대안 평가·근거", "아키텍처 대안 검토와 선택 근거(자원·성능·안전·비용)가 있는가 (SWE.2 3.1 BP6 자원 소비 목표 포함)"],
    ["TRACE", "BP6", "BP6", "양방향 추적", "요구 ↔ 요소(↔ 인터페이스) 양방향 추적이 성립하는가"],
    ["CONSIST", "BP6", "BP7", "일관성", "요구·요소·인터페이스·동적 동작 사이에 명칭·수치·방향이 일관되는가"],
    ["COMM", "BP7", "BP8", "합의·공유", "합의된 설계임이 식별되고 관련자에게 공유 가능한 상태인가"],
  ],
  dd: [
    ["DEVEL", "BP1", "BP1", "상세설계 수립", "유닛의 알고리즘·자료구조·내부 동작이 구현 가능할 만큼 구체적으로 설계되어 있는가"],
    ["IFACE", "BP2", "BP2", "유닛 인터페이스", "유닛 간·컴포넌트 간 인터페이스(함수 원형·포트·자료형·범위)가 정의되어 있는가"],
    ["DYN", "BP3", "BP3", "동적 동작", "유닛의 상태·호출 순서·타이밍이 기술되고 아키텍처의 동적 동작과 맞는가"],
    ["EVAL", "BP4", "BP4", "설계 평가", "상호운용성·상호작용·중요도·복잡도 등 평가 기준으로 설계가 검토된 근거가 있는가"],
    ["UNIT", "BP5", "BP8", "유닛 구현", "유닛(코드)이 상세설계와 일치하게 작성되었는가(명칭·인터페이스·알고리즘)"],
    ["TRACE", "BP6", "BP5", "양방향 추적", "SW 요구 ↔ 유닛 ↔ 코드의 양방향 추적이 성립하는가"],
    ["CONSIST", "BP6", "BP6", "일관성", "상세설계와 아키텍처·요구·코드 사이에 불일치가 없는가"],
    ["COMM", "BP7", "BP7", "합의·공유", "합의된 상세설계임이 식별되는가"],
  ],
  ver: [
    ["SPEC", "BP1", "BP2", "검증 수단 명세", "시험 항목이 검증 대상(요구·인터페이스·유닛)에 대응하고 입력·절차·기대 결과·합격 기준이 명세되어 있는가"],
    ["CRIT", "BP1", "BP2", "검증 기준·환경", "합격 기준이 정량적이고 시험 환경·사전조건·커버리지 기준(유닛 검증)이 정의되어 있는가"],
    ["SELECT", "BP2", "BP3", "선택·회귀", "릴리스·변경에 따라 수행할 시험(회귀 포함) 선택 기준과 선택 결과가 있는가"],
    ["PERFORM", "BP3", "BP4", "수행·기록", "수행 결과(통과·미통과·미수행)와 형상·일자·수행자 기록 틀이 갖춰져 있는가"],
    ["TRACE", "BP4", "BP5", "양방향 추적", "검증 수단 ↔ 대상(요구·설계·유닛) ↔ 결과의 양방향 추적이 성립하는가"],
    ["CONSIST", "BP4", "BP6", "일관성", "검증 수단이 대상 요구·설계의 수치·조건·용어와 일관되는가"],
    ["COMM", "BP5", "BP7", "요약·공유", "검증 결과 요약과 관련자 공유 상태가 있는가"],
  ],
};
export function vdaVersionLabel(version) { const vs = versionsOf(version); return vs.map(v => `PAM v${v}`).join(" + "); }
export function vdaCriteria(proc, version = "both") {
  const fam = VDA_FAMILY[proc]; if (!fam) return [];
  const vs = versionsOf(version);
  const bpLabel = r => vs.length === 1 ? (vs[0] === "4.0" ? r[1] : r[2]) : (r[1] === r[2] ? r[1] : `4.0 ${r[1]} / 3.1 ${r[2]}`);
  return VDA_BP[fam].map(r => ({ code: `VDA-${proc.replace(".", "")}-${r[0]}`, label: `ASPICE ${proc} ${bpLabel(r)} ${r[3]}`, desc: r[4], vda: true, bp: bpLabel(r) }));
}
export const vdaBasis = version => `Automotive SPICE ${vdaVersionLabel(version)} (VDA QMC) 프로세스 BP 요건 — 점검용 요약`;
export const isVdaCode = code => /^VDA-/.test(String(code || ""));
// 검토 범위 key의 전체 기준(1차 VDA + 2차 기존) — 화면 표기·의견 라벨·검증용
export function reviewCriteriaFor(key, version = "both") {
  const S = reviewScope(key); const K = reviewKindOf(key);
  return { vda: S ? vdaCriteria(S.proc, version) : [], base: K.criteria, all: [...(S ? vdaCriteria(S.proc, version) : []), ...K.criteria, ORG_GUIDE_CRITERION], ver: `${vdaVersionLabel(version)} + ${K.ver}`, baseVer: K.ver };
}

// ═══════════════════════════════════════════════════════════════════════════
// 15) SWE.4 호스트 유닛 시험 (SIL, Software-in-the-Loop on host) — CP(C) 대상
//  · 목적: SWE.3 코드를 PC(gcc)에서 빌드·실행해 유닛 단위로 검증하고, 결과를 SWE.4 결과서(3.1 13-50 / 4.0 15-52)에 반영.
//  · 구성: RTE 스텁(Rte_Read/Write → 시험용 버퍼) + 시험 케이스 + 경량 시험 프레임워크 + 실행 스크립트(sh·bat) — 외부 다운로드 없음.
//  · 케이스: ① 규칙(결정적) — 초기화·출력 갱신·견고성(형 최소/최대 입력)  ② AI 초안 — 할당 요구 근거의 입력→기대 출력.
//    AI 케이스의 기대값은 요구·설계 원문에 있는 수치(10의 거듭제곱 환산 허용) 또는 0/1만 허용, 근거 인용은 원문과 일치해야 함 — 어긋나면 버린다.
//    AI에는 소스코드가 아니라 요구·상세설계를 준다(구현을 보고 기대값을 맞추면 시험이 아니므로).
//  · 한계: 호스트 실행은 로직 검증이며 타깃 MCU의 타이밍·메모리·인터럽트 동작을 보증하지 않는다(결과서에 명시).
// ═══════════════════════════════════════════════════════════════════════════
export const UT_VER = "UT-1.0";
const UT_LIMITS = { uint8: [0, 255], uint16: [0, 65535], uint32: [0, 4294967295], sint8: [-128, 127], sint16: [-32768, 32767], sint32: [-2147483648, 2147483647], boolean: [0, 1], float32: [-1e6, 1e6], float64: [-1e6, 1e6] };
const utEsc = s => String(s == null ? "" : s).replace(/[\\"]/g, "'").replace(/[\r\n\t]+/g, " ").replace(/\*\//g, "* /").slice(0, 200);
export const utSupported = (settings) => ({ ...DD_DEFAULT, ...(settings || {}) }).target === "CP";
// 유닛 → 시험 생성에 필요한 구조(코드 생성기와 같은 명명 규칙)
export function utContext(unit) {
  const dd = unit?.dd; if (!dd || !arr(dd.classes).length) return null;
  const u = (dd.classes.find(c => c.stereotype === "SWC") || dd.classes[0])?.name || unitIdent(unit);
  const own = new Set(arr(dd.dataTypes).map(t => cid(t.name)));
  const dtOf = Object.fromEntries(arr(dd.dataTypes).map(t => [cid(t.name), t]));
  const limOf = type => {
    const ct = cT(type, own);
    if (UT_LIMITS[ct]) return { lim: UT_LIMITS[ct], float: /^float/.test(ct), scalar: true };
    const t = dtOf[ct];
    if (t && t.base === "enum") return { lim: [0, Math.max(0, String(t.range || "V").split(/[,;]/).filter(x => x.trim()).length - 1)], float: false, scalar: true };
    if (t && t.base !== "struct" && UT_LIMITS[cT(t.base, own)]) return { lim: UT_LIMITS[cT(t.base, own)], float: /^float/.test(cT(t.base, own)), scalar: true };
    return { lim: [0, 0], float: false, scalar: false };   // struct 등 — 시험 입력으로 직접 설정하지 않음
  };
  const els = dir => arr(dd.ports).filter(p => p.dir === dir).flatMap(p => arr(p.elements).map(e => ({ ref: `${p.name}.${e.name}`, rte: `${p.name}_${e.name}`, ctype: cT(e.type, own), port: p.name, ...limOf(e.type) })));
  const states = arr(dd.states?.states).map(s => s.name);
  const runs = arr(dd.runnables).map(r => ({ name: cid(r.name), trigger: r.trigger, periodMs: r.periodMs || 0, writes: arr(r.writes), reads: arr(r.reads), reqs: ids(r.reqs), desc: r.desc || "" }));
  return { u, own, inputs: els("R"), outputs: els("P"), states, stEnum: states.map(s => `${u}_ST_${s}`.toUpperCase()),
    inits: runs.filter(r => r.trigger === "init"), runs: runs.filter(r => r.trigger !== "init"),
    dataVars: arr(dd.classes).filter(c => arr(c.attrs).length).map(c => `${c.name}_Data`),
    attrs: arr(dd.classes).filter(c => arr(c.attrs).length).flatMap(c => c.attrs.filter(a => /^-?[\d.]+$/.test(String(a.init || "")) && limOf(a.type).scalar).map(a => ({ ref: `${c.name}.${a.name}`, c: `${c.name}_Data.${a.name}`, value: Number(a.init) }))) };
}
// ① 규칙 케이스 — 설계 구조만으로 결정되는 항목
export function ruleUnitTests(unit) {
  const x = utContext(unit); if (!x) return [];
  const cs = [];
  const id = n => `${unit.id}-RT${String(n).padStart(2, "0")}`;
  const allReqs = ids(unit.reqs);
  cs.push({ id: id(cs.length + 1), origin: "rule", title: "초기화 후 초기 상태·초기값", reqs: [], basis: "SWE.3 상태 머신 초기 상태·속성 초기값", state: "", inputs: {}, runnable: "", times: 0,
    expect: [...(x.states.length ? [{ kind: "state", value: x.states[0] }] : []), ...x.attrs.map(a => ({ kind: "attr", ref: a.ref, op: "==", value: a.value }))] });
  x.runs.forEach(r => {
    const outs = x.outputs.filter(o => r.writes.includes(o.port));
    cs.push({ id: id(cs.length + 1), origin: "rule", title: `${r.name} 1회 실행 — 출력 갱신`, reqs: r.reqs.length ? r.reqs : allReqs, basis: `Runnable 쓰기 포트(${r.writes.join(", ") || "없음"})`, state: "", inputs: {}, runnable: r.name, times: 1,
      expect: outs.length ? outs.map(o => ({ kind: "written", ref: o.ref, op: ">=", value: 1 })) : [{ kind: "stateValid" }] });
    const ins = x.inputs.filter(i => i.scalar);
    if (ins.length || x.states.length) {
      cs.push({ id: id(cs.length + 1), origin: "rule", title: `${r.name} 견고성 — 입력 최대값 10회`, reqs: r.reqs.length ? r.reqs : allReqs, basis: "입력 형 최대값에서 상태가 정의된 값 안에 머무름", state: "", inputs: Object.fromEntries(ins.map(i => [i.ref, "MAX"])), runnable: r.name, times: 10, expect: [{ kind: "stateValid" }] });
      cs.push({ id: id(cs.length + 1), origin: "rule", title: `${r.name} 견고성 — 입력 최소값 10회`, reqs: r.reqs.length ? r.reqs : allReqs, basis: "입력 형 최소값에서 상태가 정의된 값 안에 머무름", state: "", inputs: Object.fromEntries(ins.map(i => [i.ref, "MIN"])), runnable: r.name, times: 10, expect: [{ kind: "stateValid" }] });
    }
  });
  return cs;
}
// ② AI 케이스 프롬프트 — 요구·상세설계만 제공(코드는 주지 않음)
export function promptUnitTests({ unit, model, guideBlock = "" }) {
  const m = normalizeModel(model); const x = utContext(unit); const dd = unit.dd;
  const reqs = (m.reqs.SW || []).filter(r => ids(unit.reqs).includes(r.id));
  return `역할: ASPICE SWE.4 유닛 검증 엔지니어. 아래 SW 유닛의 할당 요구와 상세설계(SWE.3)로부터 호스트에서 실행할 유닛 시험 케이스를 작성하세요.

[할당 SW 요구]
${reqs.map(r => `- ${r.id} ${r.title}: ${r.text || ""}${r.verifCriteria ? ` / 검증 기준: ${r.verifCriteria}` : ""}`).join("\n") || "-"}
[입력 포트 요소(Rte_Read)] ${x.inputs.filter(i => i.scalar).map(i => `${i.ref}(${i.ctype} ${i.lim[0]}..${i.lim[1]})`).join(", ") || "-"}
[출력 포트 요소(Rte_Write)] ${x.outputs.filter(o => o.scalar).map(o => `${o.ref}(${o.ctype})`).join(", ") || "-"}
[Runnable] ${x.runs.map(r => `${r.name}(${r.trigger}${r.periodMs ? " " + r.periodMs + "ms" : ""}): ${r.desc}`).join("; ") || "-"}
[상태] ${x.states.join(", ") || "-"} / 전이: ${arr(dd.states?.transitions).map(t => `${t.from}→${t.to} when "${t.trigger}" [${t.guard || ""}]`).join("; ") || "-"}
[연산 알고리즘] ${arr(dd.classes).flatMap(c => arr(c.ops).map(o => `${o.name}: ${arr(o.algo).join(" / ")}`)).join(" | ").slice(0, 2500)}

규칙:
- 케이스는 요구 1건 이상을 근거로 하며 최대 6개. 각 케이스: 사전 상태(state, 없으면 ""), 입력값(inputs: "포트.요소": 숫자), 실행할 Runnable과 반복 횟수(times — 주기 ${x.runs[0]?.periodMs || 10}ms 기준으로 시간 조건을 횟수로 환산), 기대(expect).
- expect는 출력 포트 요소 값({"port":"포트.요소","op":"==|!=|>=|<=|>|<","value":숫자}) 또는 상태({"state":"상태명"}).
- 기대값 숫자는 요구·설계 원문에 있는 수치(단위 환산 시 10의 거듭제곱 배) 또는 0/1만. 원문에 근거가 없으면 그 케이스를 만들지 말 것.
- basis에는 근거가 된 요구 원문 구절을 그대로 인용(20자 이내).
- 경계값(조건 직전·직후)과 이상 입력 케이스를 우선한다. ${AI_FIDELITY}

${guideBlock}
JSON만 출력:
{"cases":[{"title":"","reqs":["SWR-..."],"basis":"","state":"","inputs":{"Rp_X.y":0},"runnable":"","times":1,"expect":[{"port":"Pp_X.y","op":"==","value":0},{"state":"RUN"}]}]}`;
}
// AI 케이스 검증 — 규칙으로 거른다 (kept / dropped)
export function validateUnitTests(raw, unit, model) {
  const m = normalizeModel(model); const x = utContext(unit); if (!x) return { kept: [], dropped: [] };
  const reqs = (m.reqs.SW || []).filter(r => ids(unit.reqs).includes(r.id));
  const dd = unit.dd;
  const srcText = [...reqs.map(r => `${r.title} ${r.text || ""} ${r.verifCriteria || ""}`), ...arr(dd.classes).flatMap(c => arr(c.ops).flatMap(o => [o.desc, ...arr(o.algo)])), ...arr(dd.states?.transitions).map(t => `${t.trigger} ${t.guard}`), ...arr(unit.macros).map(mm => mm.value)].join(" ");
  const nums = new Set((srcText.match(/-?\d+(?:\.\d+)?/g) || []).map(Number));
  const numOk = v => v === 0 || v === 1 || [...nums].some(n => [-3, -2, -1, 0, 1, 2, 3].some(k => Math.abs(n * Math.pow(10, k) - v) < 1e-9 * Math.max(1, Math.abs(v))));
  const norm = s => String(s || "").replace(/["'“”‘’`\s]/g, "").toLowerCase();
  const reqText = norm(reqs.map(r => `${r.title} ${r.text || ""} ${r.verifCriteria || ""}`).join(" "));
  const inByRef = Object.fromEntries(x.inputs.filter(i => i.scalar).map(i => [i.ref, i]));
  const outByRef = Object.fromEntries(x.outputs.filter(o => o.scalar).map(o => [o.ref, o]));
  const runNames = new Set(x.runs.map(r => r.name));
  const OPS = new Set(["==", "!=", ">=", "<=", ">", "<"]);
  const kept = [], dropped = [];
  arr(raw?.cases).slice(0, 8).forEach((c, i) => {
    const title = str(c?.title, 120) || `케이스 ${i + 1}`;
    const drop = reason => dropped.push({ title, reason });
    const rq = ids(c?.reqs).filter(r => ids(unit.reqs).includes(r));
    if (!rq.length) return drop("할당 요구가 아닌 근거");
    const basis = str(c?.basis, 120);
    if (basis && !reqText.includes(norm(basis))) return drop(`근거 인용이 요구 원문과 불일치("${basis.slice(0, 20)}")`);
    const run = cid(c?.runnable || x.runs[0]?.name || "");
    if (!runNames.has(run)) return drop(`없는 Runnable(${run})`);
    const st = str(c?.state, 40); if (st && !x.states.includes(st)) return drop(`없는 상태(${st})`);
    const inputs = {};
    for (const [k, v] of Object.entries(c?.inputs || {})) {
      const d = inByRef[k]; const n = Number(v);
      if (!d) return drop(`없는 입력 포트 요소(${k})`);
      if (!Number.isFinite(n) || n < d.lim[0] || n > d.lim[1]) return drop(`입력값이 형 범위 밖(${k}=${v})`);
      inputs[k] = d.float ? n : Math.round(n);
    }
    const expect = [];
    for (const e of arr(c?.expect)) {
      if (e && e.state != null) { if (!x.states.includes(String(e.state))) return drop(`없는 기대 상태(${e.state})`); expect.push({ kind: "state", value: String(e.state) }); continue; }
      const d = outByRef[e?.port]; const n = Number(e?.value); const op = OPS.has(e?.op) ? e.op : "==";
      if (!d) return drop(`없는 출력 포트 요소(${e?.port})`);
      if (!Number.isFinite(n)) return drop("기대값이 숫자가 아님");
      if (!numOk(n)) return drop(`기대값 ${n}이 요구·설계 원문에 없음`);
      expect.push({ kind: "port", ref: e.port, op, value: n });
    }
    if (!expect.length) return drop("기대 결과 없음");
    const times = Math.max(1, Math.min(1000, Math.round(Number(c?.times) || 1)));
    kept.push({ origin: "ai", title, reqs: rq, basis, state: st, inputs, runnable: run, times, expect });
  });
  kept.forEach((c, i) => { c.id = `${unit.id}-AT${String(i + 1).padStart(2, "0")}`; });
  return { kept, dropped };
}
// 유닛 시험 세트 = 규칙 + AI (unit.ut)
export function buildUnitTestSet(unit, aiKept = [], dropped = [], meta = {}) {
  return { ver: UT_VER, cases: [...ruleUnitTests(unit), ...arr(aiKept)], dropped: arr(dropped), generatedAt: new Date().toISOString(), aiModel: meta.aiModel || "", codeHash: utCodeHash(unit.dd?.code) };
}
export const utCodeHash = code => code && Array.isArray(code.files) ? fnv1a(code.files.map(f => f.text).join("\u241f")) : "";
// 시험 C 파일 (유닛 .c를 include해 내부 static 상태까지 확인)
export function utTestSource(unit, code, cases) {
  const x = utContext(unit); if (!x || !code) return "";
  const src = (code.files.find(f => /\.c$/.test(f.name)) || {}).name;
  const inRef = Object.fromEntries(x.inputs.map(i => [i.ref, i])), outRef = Object.fromEntries(x.outputs.map(o => [o.ref, o]));
  const lit = (d, v) => v === "MAX" ? (d.float ? `(${d.ctype})${d.lim[1]}` : `(${d.ctype})${d.lim[1]}${d.lim[1] > 2147483647 ? "u" : ""}`) : v === "MIN" ? `(${d.ctype})(${d.lim[0]})` : `(${d.ctype})(${d.float ? Number(v) : Math.round(Number(v))})`;
  const stVal = s => x.stEnum[x.states.indexOf(s)];
  const L = [];
  L.push(`/* SPIDer QA Agent — SWE.4 host unit test (${UT_VER}) for ${unit.id} ${utEsc(unit.name)}`, ` * Generated ${new Date().toISOString().slice(0, 10)} from SWE.3 detailed design. Host execution (SIL) — not target verification. */`);
  L.push(`#include <string.h>`, `#include "spider_test.h"`, `#include "${src}"   /* unit under test (static internals visible to the test) */`, ``);
  L.push(`#define UT_UNIT_ID   "${unit.id}"`, `#define UT_CODE_HASH "${utCodeHash(code)}"`, ``, `/* ---- RTE stub (replaces Rte_${x.u}.h implementation on host) ---- */`, `static Std_ReturnType TS_ret = E_OK;`);
  x.inputs.forEach(i => L.push(`static ${i.ctype} TS_in_${i.rte}; static uint32 TS_rd_${i.rte};`, `Std_ReturnType Rte_Read_${i.rte}(${i.ctype} *data) { if (data != NULL_PTR) { *data = TS_in_${i.rte}; } TS_rd_${i.rte}++; return TS_ret; }`));
  x.outputs.forEach(o => L.push(`static ${o.ctype} TS_out_${o.rte}; static uint32 TS_wr_${o.rte};`, `Std_ReturnType Rte_Write_${o.rte}(${o.ctype} data) { TS_out_${o.rte} = data; TS_wr_${o.rte}++; return TS_ret; }`));
  L.push(``, `static void TS_Reset(void)`, `{`);
  x.inputs.forEach(i => L.push(`    (void)memset(&TS_in_${i.rte}, 0, sizeof(TS_in_${i.rte})); TS_rd_${i.rte} = 0u;`, `    (void)memset(&${i.rte}, 0, sizeof(${i.rte}));`));
  x.outputs.forEach(o => L.push(`    (void)memset(&TS_out_${o.rte}, 0, sizeof(TS_out_${o.rte})); TS_wr_${o.rte} = 0u;`, `    (void)memset(&${o.rte}, 0, sizeof(${o.rte}));`));
  x.dataVars.forEach(v => L.push(`    (void)memset(&${v}, 0, sizeof(${v}));`));
  if (x.stEnum.length) L.push(`    ${x.u}_State = ${x.stEnum[0]};`);
  L.push(`    TS_ret = E_OK;`);
  x.inits.forEach(r => L.push(`    ${r.name}();`));
  x.outputs.forEach(o => L.push(`    TS_wr_${o.rte} = 0u;   /* count writes from the case only */`));
  L.push(`}`, ``);
  if (x.stEnum.length) L.push(`static int TS_StateValid(void) { return ((int)${x.u}_State >= 0) && ((int)${x.u}_State <= ${x.stEnum.length - 1}); }`, ``);
  const fnames = [];
  arr(cases).forEach(c => {
    const fn = `TC_${cid(c.id)}`; fnames.push(fn);
    L.push(`/* ${c.id} [${c.origin === "ai" ? "AI draft" : "rule"}] ${utEsc(c.title)} — traces: ${arr(c.reqs).join(", ") || "-"}${c.basis ? ` — basis: ${utEsc(c.basis)}` : ""} */`, `static void ${fn}(void)`, `{`, `    ST_BEGIN("${c.id}", "${utEsc(c.title)}", "${arr(c.reqs).join(",")}", "${c.origin}");`, `    TS_Reset();`);
    if (c.state && stVal(c.state)) L.push(`    ${x.u}_State = ${stVal(c.state)};`);
    Object.entries(c.inputs || {}).forEach(([k, v]) => { const d = inRef[k]; if (d && d.scalar) L.push(`    TS_in_${d.rte} = ${lit(d, v)};`); });
    if (c.runnable && c.times > 0) L.push(`    { uint32 n; for (n = 0u; n < ${c.times}u; n++) { ${c.runnable}(); } }`);
    arr(c.expect).forEach(e => {
      if (e.kind === "state" && stVal(e.value)) L.push(`    ST_CHECK((int)${x.u}_State == (int)${stVal(e.value)}, "state == ${e.value}", (double)${x.u}_State, (double)${stVal(e.value)});`);
      else if (e.kind === "stateValid") L.push(x.stEnum.length ? `    ST_CHECK(TS_StateValid(), "state within defined states", (double)${x.u}_State, -1.0);` : `    ST_CHECK(1, "executed without crash", 1.0, 1.0);`);
      else if (e.kind === "written") { const d = outRef[e.ref]; if (d) L.push(`    ST_CHECK(TS_wr_${d.rte} >= 1u, "${e.ref} written", (double)TS_wr_${d.rte}, 1.0);`); }
      else if (e.kind === "attr") { const a = x.attrs.find(q => q.ref === e.ref); if (a) L.push(`    ST_CHECK(ST_NUM_EQ((double)${a.c}, ${a.value}), "${e.ref} == ${a.value}", (double)${a.c}, ${a.value});`); }
      else if (e.kind === "port") { const d = outRef[e.ref]; if (d) { const a = `(double)TS_out_${d.rte}`; const cond = e.op === "==" ? `ST_NUM_EQ(${a}, ${e.value})` : e.op === "!=" ? `!ST_NUM_EQ(${a}, ${e.value})` : `${a} ${e.op} ${e.value}`; L.push(`    ST_CHECK(${cond}, "${e.ref} ${e.op} ${e.value}", ${a}, ${e.value});`); } }
    });
    L.push(`    ST_END();`, `}`, ``);
  });
  L.push(`int main(void)`, `{`, `    ST_START(UT_UNIT_ID, "${utEsc(unit.name)}", UT_CODE_HASH);`, ...fnames.map(f => `    ${f}();`), `    return ST_FINISH();`, `}`, ``);
  return L.join("\n");
}
const UT_STD_TYPES = `/* Host stub of AUTOSAR Std_Types.h / Platform_Types.h — for SPIDer host unit tests ONLY.
 * On target, use the BSW-provided headers. */
#ifndef STD_TYPES_H
#define STD_TYPES_H
#include <stdint.h>
typedef uint8_t  uint8;  typedef uint16_t uint16; typedef uint32_t uint32; typedef uint64_t uint64;
typedef int8_t   sint8;  typedef int16_t  sint16; typedef int32_t  sint32; typedef int64_t  sint64;
typedef float    float32; typedef double float64;
typedef uint8 boolean;
#ifndef TRUE
#define TRUE  ((boolean)1u)
#endif
#ifndef FALSE
#define FALSE ((boolean)0u)
#endif
typedef uint8 Std_ReturnType;
#define E_OK      ((Std_ReturnType)0u)
#define E_NOT_OK  ((Std_ReturnType)1u)
#define STD_ON    1u
#define STD_OFF   0u
#define STD_HIGH  1u
#define STD_LOW   0u
#ifndef NULL_PTR
#define NULL_PTR  ((void *)0)
#endif
#endif /* STD_TYPES_H */
`;
const UT_FW_H = `/* SPIDer host unit test framework (minimal, no external dependency) */
#ifndef SPIDER_TEST_H
#define SPIDER_TEST_H
void st_start(const char *unit, const char *name, const char *hash);
void st_begin(const char *id, const char *title, const char *reqs, const char *origin);
void st_check(int ok, const char *what, double actual, double expected, int line);
void st_end(void);
int  st_finish(void);
int  st_num_eq(double a, double b);
#define ST_START(u, n, h)        st_start((u), (n), (h))
#define ST_BEGIN(i, t, r, o)     st_begin((i), (t), (r), (o))
#define ST_CHECK(c, w, a, e)     st_check((c) ? 1 : 0, (w), (a), (e), __LINE__)
#define ST_END()                 st_end()
#define ST_FINISH()              st_finish()
#define ST_NUM_EQ(a, b)          st_num_eq((a), (b))
#endif
`;
const UT_FW_C = `/* SPIDer host unit test framework — results: stdout + JSON Lines (SPIDER_RESULTS, default swe4_results.jsonl) */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "spider_test.h"
static FILE *g_out = NULL;
static const char *g_unit = "", *g_hash = "";
static char g_id[64], g_title[256], g_reqs[256], g_origin[16], g_fail[512];
static int g_checks = 0, g_failed = 0, g_cases = 0, g_case_fail = 0;
static void js(FILE *f, const char *s) { fputc('"', f); for (; s && *s; s++) { unsigned char c = (unsigned char)*s; if (c == '"' || c == '\\\\') { fputc('\\\\', f); fputc(c, f); } else if (c < 0x20) { fputc(' ', f); } else { fputc(c, f); } } fputc('"', f); }
static void cp(char *d, size_t n, const char *s) { strncpy(d, s ? s : "", n - 1); d[n - 1] = '\\0'; }
int st_num_eq(double a, double b) { double t = 1e-4 * (fabs(b) > 1.0 ? fabs(b) : 1.0); return fabs(a - b) <= t; }
void st_start(const char *unit, const char *name, const char *hash) {
  g_unit = unit; g_hash = hash;
#ifdef SPIDER_STDOUT_JSON
  g_out = stdout;   /* in-browser run: JSON lines on stdout, prefixed with @@J */
#else
  { const char *p = getenv("SPIDER_RESULTS"); g_out = fopen(p ? p : "swe4_results.jsonl", "a"); }
#endif
  printf("== %s %s ==\\n", unit, name);
}
void st_begin(const char *id, const char *title, const char *reqs, const char *origin) { cp(g_id, sizeof g_id, id); cp(g_title, sizeof g_title, title); cp(g_reqs, sizeof g_reqs, reqs); cp(g_origin, sizeof g_origin, origin); g_checks = 0; g_failed = 0; g_fail[0] = '\\0'; }
void st_check(int ok, const char *what, double actual, double expected, int line) {
  g_checks++;
  if (!ok) { g_failed++; if (!g_fail[0]) { snprintf(g_fail, sizeof g_fail, "%s: actual %.6g (expected %.6g) at line %d", what, actual, expected, line); } }
}
void st_end(void) {
  g_cases++; if (g_failed) g_case_fail++;
  printf("  [%s] %s %s%s%s\\n", g_failed ? "FAIL" : "PASS", g_id, g_title, g_failed ? " -- " : "", g_failed ? g_fail : "");
  if (g_out) {
    if (g_out == stdout) { fputs("@@J ", g_out); }
    fputs("{\\"type\\":\\"case\\",\\"unit\\":", g_out); js(g_out, g_unit); fputs(",\\"code\\":", g_out); js(g_out, g_hash);
    fputs(",\\"case\\":", g_out); js(g_out, g_id); fputs(",\\"origin\\":", g_out); js(g_out, g_origin); fputs(",\\"reqs\\":", g_out); js(g_out, g_reqs);
    fprintf(g_out, ",\\"result\\":\\"%s\\",\\"checks\\":%d,\\"failed\\":%d,\\"detail\\":", g_failed ? "fail" : "pass", g_checks, g_failed); js(g_out, g_fail); fputs("}\\n", g_out);
  }
}
int st_finish(void) {
  printf("  %d case(s), %d failed\\n", g_cases, g_case_fail);
  if (g_out && g_out != stdout) { fclose(g_out); } g_out = NULL;
  fflush(stdout);
  return g_case_fail ? 1 : 0;
}
`;
const UT_RUN_SH = `#!/bin/sh
# SPIDer QA Agent — SWE.4 host unit test runner (gcc). Usage: ./run_tests.sh   (coverage: COVERAGE=1 ./run_tests.sh)
cd "$(dirname "$0")" || exit 1
CC=\${CC:-gcc}
OUT=swe4_results.jsonl
rm -f "$OUT"; rm -rf build; mkdir -p build
if ! command -v "$CC" >/dev/null 2>&1; then echo "C compiler '$CC' not found (install gcc / MinGW-w64)"; exit 2; fi
CCV=$("$CC" --version 2>/dev/null | head -n 1 | tr -d '"\\\\')
COVF=""; COVJ=false
if [ "\${COVERAGE:-0}" = "1" ]; then COVF="--coverage -O0"; COVJ=true; fi
printf '{"type":"run","ver":"${UT_VER}","at":"%s","cc":"%s","os":"%s","coverage":%s}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CCV" "$(uname -s 2>/dev/null)" "$COVJ" >> "$OUT"
for d in units/*/; do
  id=$(basename "$d"); mkdir -p "build/$id"
  t=$(ls "$d"test_*.c 2>/dev/null | head -n 1)
  if "$CC" -std=c99 -Wall -Wextra -Wno-unused-function -Wno-unused-variable -Wno-unused-parameter $COVF -I stubs -I framework -I "$d" -c "$t" -o "build/$id/test.o" 2> "build/$id/build.log" && \\
     "$CC" -std=c99 -I framework $COVF -c framework/spider_test.c -o "build/$id/fw.o" 2>> "build/$id/build.log" && \\
     "$CC" $COVF -o "build/$id/run" "build/$id/test.o" "build/$id/fw.o" -lm 2>> "build/$id/build.log"; then
    W=$(grep -c "warning:" "build/$id/build.log")
    printf '{"type":"build","unit":"%s","result":"ok","warnings":%s}\\n' "$id" "$W" >> "$OUT"
    SPIDER_RESULTS="$OUT" "./build/$id/run" || true
    if [ "$COVJ" = "true" ] && command -v gcov >/dev/null 2>&1; then
      src=$(ls "$d"*.c | grep -v '/test_' | head -n 1); sb=$(basename "$src")
      (cd "build/$id" && gcov -b -o test.o "../../$t" > gcov.txt 2>/dev/null)
      awk -v id="$id" -v sb="$sb" '
        /^File / { f=$0; gsub(/^File .|.$/,"",f); n=split(f,a,"/"); cur=(a[n]==sb) }
        cur && /^Lines executed:/ { split($2,p,":"); l=p[2]; sub(/%/,"",l); ln=$4 }
        cur && /^Branches executed:/ { split($2,p,":"); b=p[2]; sub(/%/,"",b); bn=$4 }
        cur && /^Taken at least once:/ { split($4,p,":"); tk=p[2]; sub(/%/,"",tk); if (tk=="") { tk=$4; sub(/%/,"",tk); sub(/.*:/,"",tk) } }
        END { if (l!="") printf("{\\"type\\":\\"coverage\\",\\"unit\\":\\"%s\\",\\"file\\":\\"%s\\",\\"stmt\\":%s,\\"stmtN\\":%s,\\"branch\\":%s,\\"branchN\\":%s}\\n", id, sb, l, ln+0, (tk==""?0:tk), bn+0) }' "build/$id/gcov.txt" >> "$OUT"
    fi
  else
    printf '{"type":"build","unit":"%s","result":"fail","log":"build/%s/build.log"}\\n' "$id" "$id" >> "$OUT"
    echo "== $id BUILD FAILED (see build/$id/build.log)"
  fi
done
echo ""; echo "Results: $OUT  ->  SPIDer V-model > SWE.4 > [실행 결과 가져오기]"
`;
const UT_RUN_BAT = `@echo off
rem SPIDer QA Agent - SWE.4 host unit test runner (MinGW-w64 gcc on PATH). Coverage: use run_tests.sh (Git Bash / MSYS2 / WSL)
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
set OUT=swe4_results.jsonl
if exist %OUT% del %OUT%
if exist build rmdir /s /q build
mkdir build
where gcc >nul 2>nul || (echo gcc not found - install MinGW-w64 and add to PATH & exit /b 2)
for /f "delims=" %%v in ('gcc -dumpfullversion') do set CCV=%%v
echo {"type":"run","ver":"${UT_VER}","at":"%date% %time%","cc":"gcc !CCV!","os":"Windows","coverage":false}>> %OUT%
for /d %%D in (units\\*) do (
  set ID=%%~nxD
  mkdir build\\!ID!
  set T=
  for %%F in (%%D\\test_*.c) do set T=%%F
  gcc -std=c99 -Wall -Wextra -Wno-unused-function -Wno-unused-variable -Wno-unused-parameter -I stubs -I framework -I %%D -o build\\!ID!\\run.exe !T! framework\\spider_test.c 2> build\\!ID!\\build.log
  if exist build\\!ID!\\run.exe (
    echo {"type":"build","unit":"!ID!","result":"ok"}>> %OUT%
    set SPIDER_RESULTS=%CD%\\%OUT%
    build\\!ID!\\run.exe
  ) else (
    echo {"type":"build","unit":"!ID!","result":"fail","log":"build/!ID!/build.log"}>> %OUT%
    echo == !ID! BUILD FAILED - see build\\!ID!\\build.log
  )
)
echo.
echo Results: %OUT%  -^>  SPIDer V-model ^> SWE.4 ^> Import results
endlocal
pause
`;
// 호스트 시험 패키지 — 경로·내용 목록 (ZIP은 화면에서 묶음)
export function buildHostTestPackage(model, meta, settings, folder = "SW4106_유닛시험_호스트실행") {
  const m = normalizeModel(model); const S = { ...DD_DEFAULT, ...(settings || ddSettings(m)) };
  if (S.target !== "CP") return { files: [], units: [], skipped: [], note: "AUTOSAR Adaptive(C++) 호스트 실행은 2단계 — 현재는 Classic(C)만 지원" };
  const files = [], units = [], skipped = [];
  (m.units.SW || []).filter(u => u.dd?.classes?.length).forEach(u => {
    let code = u.dd.code && u.dd.code.target === "CP" ? u.dd.code : null;
    if (!code) { try { code = generateCode(u, m, meta, S, null); } catch (_) { code = null; } }
    if (!code) { skipped.push({ id: u.id, reason: "코드 생성 실패" }); return; }
    const cases = [...ruleUnitTests(u), ...arr(u.ut?.cases).filter(c => c.origin === "ai")];   // 규칙 케이스는 항상 현재 설계로 다시 만든다(결정적)
    const dir = `${folder}/units/${u.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    code.files.forEach(f => files.push({ path: `${dir}/${f.name}`, content: f.text }));
    files.push({ path: `${dir}/test_${cid(u.id)}.c`, content: utTestSource(u, code, cases) });
    units.push({ id: u.id, name: u.name, cases: cases.length, ai: cases.filter(c => c.origin === "ai").length, codeHash: utCodeHash(code), codeOrigin: u.dd.code ? (u.dd.code.origin || "") : "rule" });
  });
  files.push({ path: `${folder}/stubs/Std_Types.h`, content: UT_STD_TYPES }, { path: `${folder}/framework/spider_test.h`, content: UT_FW_H }, { path: `${folder}/framework/spider_test.c`, content: UT_FW_C },
    { path: `${folder}/run_tests.sh`, content: UT_RUN_SH }, { path: `${folder}/run_tests.bat`, content: UT_RUN_BAT.replace(/\n/g, "\r\n") });
  files.push({ path: `${folder}/README.txt`, content: [
    `SWE.4 유닛 시험 — 호스트 실행 패키지 (${UT_VER}) · ${meta?.name || ""}`, ``,
    `무엇인가`, `  SWE.3에서 생성한 C 소스를 PC에서 빌드·실행해 유닛별로 검증합니다. RTE는 시험용 스텁(가짜 버퍼)으로 바꿔 입력을 넣고 출력을 확인합니다.`,
    `  케이스: 규칙(초기화·출력 갱신·견고성) + AI 초안(할당 요구 근거의 입력→기대 출력, 기대값은 요구·설계 원문 수치만 사용).`, ``,
    `필요한 것`, `  gcc (Linux 기본 / Windows는 MSYS2 또는 MinGW-w64). 패키지 자체는 외부 다운로드 없음.`,
    `  Windows 설치 예(MSYS2): https://www.msys2.org 에서 설치 → 'MSYS2 UCRT64' 창에서  pacman -S mingw-w64-ucrt-x86_64-gcc`,
    `                          → 시스템 PATH에 C:\\msys64\\ucrt64\\bin 추가 → 새 명령 프롬프트에서  gcc --version  확인`,
    `  설치 없이 보려면 SPIDer 화면의 [▶ 브라우저에서 실행]을 쓰세요(같은 시험 소스, clang WebAssembly).`, ``,
    `실행`, `  Linux·macOS·Git Bash·WSL : sh run_tests.sh        (커버리지 포함: COVERAGE=1 sh run_tests.sh)`, `  Windows 명령 프롬프트     : run_tests.bat          (커버리지는 run_tests.sh 사용)`, ``,
    `결과`, `  swe4_results.jsonl 이 만들어집니다. SPIDer V-모델 › SWE.4 › [실행 결과 가져오기]로 올리면 SW 유닛 검증 결과서(SW4106)에 반영됩니다.`,
    `  빌드 실패는 build/<유닛>/build.log 를 보세요 — 실패도 결과로 기록됩니다.`, ``,
    `주의`, `  · 호스트 실행(SIL)은 로직 검증입니다. 타깃 MCU의 타이밍·메모리·인터럽트 동작은 보증하지 않으며, 타깃·HILS 검증을 대체하지 않습니다.`,
    `  · stubs/Std_Types.h 는 시험 전용입니다. 타깃 빌드에는 BSW가 제공하는 헤더를 쓰세요.`,
    `  · 시험 파일은 유닛 .c 를 #include 해 내부 상태(static)까지 확인합니다 — 화이트박스 유닛 시험의 일반 기법입니다.`,
    `  · MISRA 최종 판정은 ${S.tools.join(" · ")} 결과로 합니다.`,
    `  · stubs/Std_Types.h 는 시험용 최소 정의를 SPIDer가 새로 작성한 것으로, AUTOSAR 규격 원문·BSW 헤더를 복제하지 않았습니다.`, ``,
    `고지`, `  ${LEGAL.autosar}`, `  ${LEGAL.tm.filter(t => /MISRA|AUTOSAR/.test(t[0])).map(t => t[1]).join(" ")}`, ``,
    `유닛 ${units.length}개 · 케이스 ${units.reduce((a, x) => a + x.cases, 0)}건 (AI 초안 ${units.reduce((a, x) => a + x.ai, 0)}건)${skipped.length ? ` · 제외 ${skipped.length}개` : ""}`,
  ].join("\r\n") });
  return { files, units, skipped, note: "" };
}
// 실행 결과(JSON Lines) 파싱
export function parseUtResults(text) {
  const out = { run: null, cases: [], builds: [], coverage: [], bad: 0 };
  String(text || "").split(/\r?\n/).forEach(l => {
    const s = l.trim(); if (!s) return;
    let o; try { o = JSON.parse(s); } catch (_) { out.bad++; return; }
    if (o.type === "run") out.run = o; else if (o.type === "case") out.cases.push(o); else if (o.type === "build") out.builds.push(o); else if (o.type === "coverage") out.coverage.push(o);
  });
  return out;
}
// 결과 반영 — model.utRuns(최근 10회) + 유닛별 요약. 코드가 실행 후 바뀌었으면 stale 표시
export function applyUtResults(model, parsed, fileName = "") {
  const m = normalizeModel(model);
  const known = new Set((m.units.SW || []).map(u => u.id));
  const cases = parsed.cases.filter(c => known.has(c.unit));
  if (!cases.length && !parsed.builds.some(b => known.has(b.unit))) throw new Error("이 프로젝트의 유닛 결과가 없습니다 — 다른 프로젝트의 결과 파일이거나 실행이 되지 않았습니다.");
  const units = {};
  (m.units.SW || []).forEach(u => {
    const cs = cases.filter(c => c.unit === u.id); const b = parsed.builds.find(x => x.unit === u.id); const cv = parsed.coverage.find(x => x.unit === u.id);
    if (!cs.length && !b) return;
    const pass = cs.filter(c => c.result === "pass").length;
    units[u.id] = { build: b ? b.result : (cs.length ? "ok" : ""), warnings: b?.warnings ?? null, cases: cs.length, pass, fail: cs.length - pass,
      result: b && b.result === "fail" ? "Fail" : cs.length && pass === cs.length ? "Pass" : cs.length ? "Fail" : "Not executed",
      code: cs[0]?.code || "", coverage: cv ? { stmt: Number(cv.stmt), stmtN: Number(cv.stmtN), branch: Number(cv.branch), branchN: Number(cv.branchN) } : null };
  });
  const run = { at: new Date().toISOString(), ranAt: parsed.run?.at || "", cc: parsed.run?.cc || "", os: parsed.run?.os || "", ver: parsed.run?.ver || "", coverage: !!parsed.run?.coverage, file: str(fileName, 120),
    cases: cases.map(c => ({ unit: c.unit, case: c.case, origin: c.origin, reqs: c.reqs, result: c.result, checks: c.checks, failed: c.failed, detail: str(c.detail, 300) })), units };
  // 유닛별 최신 결과를 누적 보관 — 유닛을 하나씩 실행해도 앞서 실행한 유닛의 결과가 사라지지 않는다
  m.utResults = { ...utResultsOf(m) };
  Object.entries(units).forEach(([uid, r]) => { m.utResults[uid] = { ...r, at: run.at, ranAt: run.ranAt, cc: run.cc, os: run.os, file: run.file, coverageOn: run.coverage, caseList: run.cases.filter(c => c.unit === uid) }; });
  // 실행 이력은 요약만(최근 30회)
  m.utRuns = [...arr(m.utRuns).map(x => ({ ...x, cases: undefined, units: Object.fromEntries(Object.entries(x.units || {}).map(([k, v]) => [k, { result: v.result, pass: v.pass, cases: v.cases }])) })),
    { ...run, cases: undefined, units: Object.fromEntries(Object.entries(units).map(([k, v]) => [k, { result: v.result, pass: v.pass, cases: v.cases }])) }].slice(-30);
  return { model: m, run };
}
// 유닛별 누적 결과 — 이전 형식(utRuns에 케이스까지 저장)도 시간순으로 합쳐 읽는다
function utResultsOf(m) {
  if (m.utResults && typeof m.utResults === "object") {
    // 이전 저장본 보정: cases 자리에 케이스 목록이 들어간 경우
    return Object.fromEntries(Object.entries(m.utResults).map(([k, r]) => Array.isArray(r?.cases) ? [k, { ...r, caseList: r.caseList || r.cases, cases: r.cases.length }] : [k, r]));
  }
  const out = {};
  arr(m.utRuns).forEach(run => { if (!Array.isArray(run.cases)) return; Object.entries(run.units || {}).forEach(([uid, r]) => { out[uid] = { ...r, at: run.at, ranAt: run.ranAt, cc: run.cc, os: run.os, file: run.file, coverageOn: run.coverage, caseList: run.cases.filter(c => c.unit === uid) }; }); });
  return out;
}
// 최신 실행 결과 + 현재 코드와의 일치 여부
export function utLatest(model) {
  const m = normalizeModel(model);
  const known = new Set((m.units.SW || []).map(u => u.id));
  const res = Object.fromEntries(Object.entries(utResultsOf(m)).filter(([k]) => known.has(k)));
  const ids = Object.keys(res); if (!ids.length) return null;
  const uniq = xs => [...new Set(xs.filter(Boolean))];
  const latest = ids.map(k => res[k]).sort((p, q) => String(q.at).localeCompare(String(p.at)))[0];
  // 화면·결과서가 쓰는 '실행' 모양으로 합친다 (유닛마다 자기 실행 일시·환경을 가짐)
  const run = { at: latest.at, ranAt: latest.ranAt, cc: uniq(ids.map(k => res[k].cc)).join(" / "), os: uniq(ids.map(k => res[k].os)).join(" / "), file: latest.file,
    coverage: ids.some(k => res[k].coverageOn), units: res, cases: ids.flatMap(k => arr(res[k].caseList)), runs: arr(m.utRuns).length };
  const stale = {};
  (m.units.SW || []).forEach(u => { const r = res[u.id]; if (!r) return; const h = utCodeHash(u.dd?.code); stale[u.id] = !!(r.code && h && r.code !== h); });
  return { run, stale };
}

// ═══════════════════════════════════════════════════════════════════════════
// 16) 브라우저 안 실행 (설치 없이) — Clang을 WebAssembly로 돌려 시험 파일을 wasm32-wasi로 컴파일하고,
//     최소 WASI 셈(shim)으로 실행한다. 코드는 브라우저 밖으로 나가지 않는다(컴파일러만 CDN에서 받음).
//     runClang은 화면에서 주입(@yowasp/clang). 결과 형식은 parseUtResults와 같다 → applyUtResults로 반영.
//     gcc 호스트 실행과 같은 시험 소스·같은 판정 — 차이: 컴파일러가 clang(wasm32), 커버리지 측정 없음.
// ═══════════════════════════════════════════════════════════════════════════
export const BROWSER_CC = { pkg: "@yowasp/clang", ver: "22.0.0-git20542-10", label: "clang 22 (WebAssembly · 브라우저 안 실행)" };
class WasiExit { constructor(code) { this.code = code; } }
function wasiShim(getMem, out) {
  const dec = new TextDecoder();
  const u32 = (p, v) => new DataView(getMem().buffer).setUint32(p, v, true);
  const imp = {
    args_sizes_get: (a, b) => { u32(a, 0); u32(b, 0); return 0; }, args_get: () => 0,
    environ_sizes_get: (a, b) => { u32(a, 0); u32(b, 0); return 0; }, environ_get: () => 0,
    fd_write: (fd, iovs, n, nw) => {
      const dv = new DataView(getMem().buffer); let tot = 0;
      for (let i = 0; i < n; i++) { const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true); const s = dec.decode(new Uint8Array(getMem().buffer, p, l)); if (fd === 2) out.err += s; else out.out += s; tot += l; }
      u32(nw, tot); return 0;
    },
    fd_fdstat_get: (fd, p) => { const dv = new DataView(getMem().buffer); dv.setUint8(p, 2); dv.setUint16(p + 2, 0, true); dv.setBigUint64(p + 8, 0xffffffffffffffffn, true); dv.setBigUint64(p + 16, 0xffffffffffffffffn, true); return 0; },
    fd_prestat_get: () => 8, fd_prestat_dir_name: () => 8, fd_close: () => 0, fd_seek: () => 70, fd_read: (fd, iovs, n, nr) => { u32(nr, 0); return 0; },
    path_open: () => 44, proc_exit: c => { throw new WasiExit(c); },
    clock_time_get: (id, prec, p) => { new DataView(getMem().buffer).setBigUint64(p, BigInt(Date.now()) * 1000000n, true); return 0; },
    random_get: (p, l) => { const b = new Uint8Array(getMem().buffer, p, l); for (let i = 0; i < l; i++) b[i] = (Math.random() * 256) | 0; return 0; },
  };
  return new Proxy(imp, { get: (t, k) => (k in t ? t[k] : () => 52) });   // 그 밖의 호출은 ENOSYS
}
// 실행 패키지 파일 → 유닛별 묶음
function groupPkgByUnit(files) {
  const common = { stubs: {}, framework: {} }, units = {};
  files.forEach(f => {
    const m = f.path.match(/\/(stubs|framework)\/([^/]+)$/); if (m) { common[m[1]][m[2]] = f.content; return; }
    const u = f.path.match(/\/units\/([^/]+)\/([^/]+)$/); if (u) { (units[u[1]] = units[u[1]] || {})[u[2]] = f.content; }
  });
  return { common, units };
}
const tick = (ms = 16) => new Promise(r => setTimeout(r, ms));   // 화면이 로그를 그릴 틈
export async function runUnitTestsInBrowser(model, meta, settings, runClang, { onProgress, onLog, only, shouldStop } = {}) {
  const pkg = buildHostTestPackage(model, meta, settings);
  if (!pkg.units.length) throw new Error(pkg.note || "상세설계가 있는 유닛이 없습니다.");
  const { common, units } = groupPkgByUnit(pkg.files);
  const parsed = { run: { type: "run", ver: UT_VER, at: new Date().toISOString(), cc: BROWSER_CC.label, os: "Browser (WASI)", coverage: false }, cases: [], builds: [], coverage: [], bad: 0 };
  const list = pkg.units.filter(u => !only || only.includes(u.id));
  for (let i = 0; i < list.length; i++) {
    if (shouldStop && shouldStop()) { parsed.stopped = true; break; }
    const uid = list[i].id, dir = uid.replace(/[^A-Za-z0-9_-]/g, "_"), uf = units[dir] || {};
    const test = Object.keys(uf).find(n => /^test_.*\.c$/.test(n));
    onProgress && onProgress({ i, n: list.length, unit: uid, phase: "compile" });
    onLog && onLog({ unit: uid, kind: "cmd", text: `$ clang --target=wasm32-wasip1 -std=c99 -O1 -Wall -Wextra -I stubs -I framework units/${dir}/${test} framework/spider_test.c -o ${dir}.wasm` });
    await tick(30);
    let err = "", wasm = null;
    try {
      const outTree = await runClang(["clang", "--target=wasm32-wasip1", "-std=c99", "-O1", "-DSPIDER_STDOUT_JSON", "-Wall", "-Wextra", "-Wno-unused-function", "-Wno-unused-variable", "-Wno-unused-parameter",
        "-Istubs", "-Iframework", "-Iu", `u/${test}`, "framework/spider_test.c", "-o", "t.wasm"], { stubs: common.stubs, framework: common.framework, u: uf },
        { stderr: b => { if (b) err += new TextDecoder().decode(b); } });
      wasm = outTree && outTree["t.wasm"];
    } catch (e) { err += (err ? "\n" : "") + String(e?.message || e); }
    const warnings = (err.match(/warning:/g) || []).length;
    if (!wasm) { parsed.builds.push({ type: "build", unit: uid, result: "fail", log: err.slice(0, 4000) }); onLog && onLog({ unit: uid, kind: "build-fail", text: err.slice(0, 4000) }); continue; }
    parsed.builds.push({ type: "build", unit: uid, result: "ok", warnings });
    onLog && onLog({ unit: uid, kind: "build-ok", text: `빌드 성공${warnings ? ` (경고 ${warnings})` : ""}` });
    onProgress && onProgress({ i, n: list.length, unit: uid, phase: "run" });
    onLog && onLog({ unit: uid, kind: "cmd", text: `$ ./${dir}.wasm` });
    await tick(16);
    const out = { out: "", err: "" }; let mem = null;
    try {
      const { instance } = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasiShim(() => mem, out) });
      mem = instance.exports.memory;
      instance.exports._start();
    } catch (e) { if (!(e instanceof WasiExit)) out.err += `\n[runtime] ${e?.message || e}`; }
    const lines = out.out.split("\n");
    lines.filter(l => l.startsWith("@@J ")).forEach(l => { try { const o = JSON.parse(l.slice(4)); if (o.type === "case") parsed.cases.push(o); } catch (_) { parsed.bad++; } });
    onLog && onLog({ unit: uid, kind: "run", text: lines.filter(l => l && !l.startsWith("@@J ")).join("\n") + (out.err ? `\n${out.err}` : "") });
    if (/\[runtime\]/.test(out.err) && !parsed.cases.some(c => c.unit === uid)) parsed.builds[parsed.builds.length - 1] = { type: "build", unit: uid, result: "fail", log: out.err.slice(0, 2000) };
    await tick(16);
  }
  return parsed;
}
