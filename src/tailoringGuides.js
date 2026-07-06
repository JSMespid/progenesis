// src/tailoringGuides.js
// OSSP 방법론별 테일러링 가이드 데이터 및 매핑.
// PDP(Project's Defined Process) = OSSP를 아래 가이드 기준으로 테일러링한 테일러링결과서.
// M = Mandatory(필수), O = Optional(선택). large = (초)대형 / medium = 중형 / small = 소형.
// method: IE 가이드만 '공통'/'UML'/'IE' 구분, 그 외 방법론은 전부 '공통'.

// ── 1) 정보공학(IE)/UML 기반 — 방법론 테일러링 가이드 v2.0 (85건, 가이드 원문 기준) ──
export const IE_TAILORING_MATRIX = [
  {"code": "RD1101", "name": "현행 시스템 분석서", "phase": "요구정의", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "RD1201", "name": "목표 비즈니스 프로세스 정의서", "phase": "요구정의", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "RD1202", "name": "요구사항 정의서", "phase": "요구정의", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "CB1101", "name": "유스케이스 모형 기술서", "phase": "요구정의", "method": "UML", "large": "M", "medium": "M", "small": "M"},
  {"code": "CB1201", "name": "재사용 컴포넌트 활용 및 확보 목록", "phase": "요구정의", "method": "UML", "large": "O", "medium": "O", "small": "O"},
  {"code": "RD1301", "name": "요구사항 명세서", "phase": "요구정의", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AR1101", "name": "아키텍처 정의서", "phase": "요구정의", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DM3101", "name": "개념 ERD", "phase": "요구정의", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "DM3102", "name": "데이터 주제 영역 정의서", "phase": "요구정의", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "TS1101", "name": "테스트 전략", "phase": "요구정의", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "TS1201", "name": "인수테스트 계획서", "phase": "요구정의", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "CB2101", "name": "유스케이스 분석서", "phase": "분석", "method": "UML", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS2101", "name": "업무기능 분해도", "phase": "분석", "method": "IE", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS2102", "name": "프로세스 다이어그램", "phase": "분석", "method": "IE", "large": "O", "medium": "O", "small": "O"},
  {"code": "PS2103", "name": "프로세스 명세서", "phase": "분석", "method": "IE", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS2201", "name": "UI 목록", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS2202", "name": "UI 정의서", "phase": "분석", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "PS2301", "name": "인터페이스 정의서", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS2401", "name": "패키지 기능 명세서", "phase": "분석", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "PS2402", "name": "매핑 & Gap 분석서", "phase": "분석", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "AR2101", "name": "개발 표준 정의서", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DM3201", "name": "논리 ERD", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DM3202", "name": "Entity 정의서", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DM3203", "name": "논리 Relationship 정의서", "phase": "분석", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "DM3204", "name": "Process vs. Entity Matrix", "phase": "분석", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "MG4121", "name": "데이터 이행 계획서", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "MG4131", "name": "데이터 이행 목록", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "MG4141", "name": "데이터 Cleansing 요건 목록 및 정의서", "phase": "분석", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "TS2101", "name": "인수테스트 시나리오", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS2102", "name": "인수테스트 케이스", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS2201", "name": "시스템테스트 계획서", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "TS2202", "name": "시스템테스트 시나리오", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "TS2203", "name": "시스템테스트 케이스", "phase": "분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AR1101", "name": "아키텍처 정의서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS2201", "name": "UI 목록", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS3101", "name": "UI 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS3102", "name": "보고서 목록", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS3103", "name": "보고서 레이아웃", "phase": "설계", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "PS3201", "name": "인터페이스 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "CB3101", "name": "컴포넌트 명세서", "phase": "설계", "method": "UML", "large": "O", "medium": "O", "small": "O"},
  {"code": "CB3201", "name": "컴포넌트 설계서", "phase": "설계", "method": "UML", "large": "O", "medium": "O", "small": "O"},
  {"code": "CB3301", "name": "유스케이스 설계서", "phase": "설계", "method": "UML", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS3301", "name": "프로그램 목록", "phase": "설계", "method": "IE", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS3302", "name": "프로그램 명세서", "phase": "설계", "method": "IE", "large": "M", "medium": "M", "small": "M"},
  {"code": "PS3303", "name": "프로그램 명세서(배치)", "phase": "설계", "method": "IE", "large": "O", "medium": "O", "small": "O"},
  {"code": "DM3301", "name": "물리 ERD", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DM3302", "name": "Table 정의서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DM3303", "name": "Database 정의서", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "DM3304", "name": "Object 정의서", "phase": "설계", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "DM3305", "name": "데이터 용량 산정 결과서", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "DM3306", "name": "Index 정의서", "phase": "설계", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "MG4211", "name": "데이터 이행 시나리오", "phase": "설계", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "MG4221", "name": "Table 매핑 정의서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "MG4222", "name": "Column 매핑 정의서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "MG4223", "name": "변환 프로그램 목록", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "MG4224", "name": "변환 프로그램 명세서", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "MG4225", "name": "Code 매핑 정의서", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "MG4231", "name": "검증 프로그램 목록", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "MG4232", "name": "검증 프로그램 명세서", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "MG4233", "name": "오류 관리 목록", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "TS3101", "name": "통합테스트 계획서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS3102", "name": "통합테스트 시나리오", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS3103", "name": "통합테스트 케이스", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS3201", "name": "단위테스트 계획서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "TS3202", "name": "단위테스트 시나리오", "phase": "설계", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "TS3203", "name": "단위테스트 케이스", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TR3101", "name": "교육훈련 계획서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AR4201", "name": "운영전환 계획서", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "MG4311", "name": "리허설결과서(통합테스트결과서/리허설 결과서)", "phase": "구축", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "TS3203", "name": "단위테스트 케이스/로그", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS4101", "name": "단위테스트 결과서", "phase": "구축", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "TS3103", "name": "통합테스트 케이스/로그", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS4201", "name": "통합테스트 결과서", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS4202", "name": "결함추적", "phase": "구축", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "TS4203", "name": "원인분석 보고서", "phase": "구축", "method": "공통", "large": "O", "medium": "O", "small": "O"},
  {"code": "TS2203", "name": "시스템테스트 케이스/로그", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "TS4301", "name": "시스템테스트 결과서", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "TR4101", "name": "사용자 매뉴얼", "phase": "구축", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TR4102", "name": "운영자 매뉴얼", "phase": "구축", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "AR5201", "name": "운영전환 점검 결과서", "phase": "운영전환", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "MG4431", "name": "데이터 이행 결과서", "phase": "운영전환", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "TS2102", "name": "인수테스트 케이스/로그", "phase": "운영전환", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS5101", "name": "인수테스트 결과서", "phase": "운영전환", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "TS4202", "name": "결함추적", "phase": "운영전환", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "TR5101", "name": "교육훈련 결과서", "phase": "운영전환", "method": "공통", "large": "O", "medium": "O", "small": "O"},];

// ── 2) Waterfall — PMBOK 8판 예측형 접근 기준 QA 필수 산출물 포함 (27건) ──
export const WATERFALL_TAILORING_MATRIX = [
  {"code": "WF1101", "name": "프로젝트 관리 계획서(PMP)", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF1102", "name": "요구사항 정의서", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF1103", "name": "요구사항 추적표(RTM)", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF1104", "name": "품질보증 계획서", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF1105", "name": "리스크 관리대장", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF1106", "name": "범위 기술서(Scope Statement)", "phase": "요구분석", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF2101", "name": "아키텍처 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF2102", "name": "상세 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF2103", "name": "인터페이스 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF2104", "name": "DB 설계서(ERD)", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF2105", "name": "화면(UI) 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF3101", "name": "프로그램 소스코드", "phase": "구현", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF3102", "name": "코딩 표준 준수 검토서", "phase": "구현", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF3103", "name": "단위테스트 결과서", "phase": "구현", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF3104", "name": "코드 리뷰 기록", "phase": "구현", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF4101", "name": "통합테스트 계획서", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF4102", "name": "테스트 케이스·시나리오", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF4103", "name": "통합테스트 결과서", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF4104", "name": "결함 관리 대장", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF4105", "name": "성능테스트 결과서", "phase": "테스트", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF5101", "name": "배포(이행) 계획서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF5102", "name": "인수테스트 결과서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF5103", "name": "사용자·운영자 매뉴얼", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF5104", "name": "릴리즈 노트", "phase": "배포", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF6101", "name": "변경 요청서(CR)", "phase": "유지보수", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF6102", "name": "형상관리 대장", "phase": "유지보수", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF6103", "name": "교훈(Lessons Learned) 보고서", "phase": "유지보수", "method": "공통", "large": "M", "medium": "O", "small": "O"},
];

// ── 3) Agile/Scrum — 등록 자산 "Agile/Scrum 테일러링 가이드 V1.0" 기준 (16건)
// 규모 매핑: 대규모→large / 중규모→medium / 소규모→small. DoD·회고 산출물은 규모 무관 필수 원칙.
export const AGILE_TAILORING_MATRIX = [
  {"code": "AG1101", "name": "스프린트 계획서", "phase": "스프린트 계획", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AG1102", "name": "스프린트 백로그", "phase": "스프린트 계획", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG1103", "name": "완료 기준(DoD) 정의서", "phase": "스프린트 계획", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG2101", "name": "제품 백로그", "phase": "백로그 관리", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG2102", "name": "사용자 스토리", "phase": "백로그 관리", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG2103", "name": "스토리 맵", "phase": "백로그 관리", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "AG3101", "name": "프로그램 소스코드", "phase": "개발", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG3102", "name": "단위테스트 코드", "phase": "개발", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AG3103", "name": "번다운 차트", "phase": "개발", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AG4101", "name": "스프린트 리뷰 결과서", "phase": "리뷰", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AG4102", "name": "제품 증분(Increment) 데모 자료", "phase": "리뷰", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "AG5101", "name": "회고 결과서", "phase": "회고", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG5102", "name": "개선 액션 아이템 목록", "phase": "회고", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG6101", "name": "릴리즈 계획서", "phase": "릴리즈", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "AG6102", "name": "릴리즈 노트", "phase": "릴리즈", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "AG6103", "name": "배포 체크리스트", "phase": "릴리즈", "method": "공통", "large": "M", "medium": "M", "small": "O"},
];

// ── 4) DevOps — 지속적 통합·배포, SLO/보안·운영 QA 산출물 포함 (20건) ──
export const DEVOPS_TAILORING_MATRIX = [
  {"code": "DO1101", "name": "제품 로드맵", "phase": "계획", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO1102", "name": "SLO/SLA 정의서", "phase": "계획", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO1103", "name": "품질보증 계획서(DevOps)", "phase": "계획", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO1104", "name": "보안 요구사항 정의서", "phase": "계획", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO2101", "name": "프로그램 소스코드", "phase": "코딩", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO2102", "name": "코드 리뷰(PR) 기록", "phase": "코딩", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO2103", "name": "코딩 표준 가이드", "phase": "코딩", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "DO3101", "name": "CI 파이프라인 정의서", "phase": "빌드", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO3102", "name": "빌드 결과 리포트", "phase": "빌드", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "DO4101", "name": "자동화 테스트 스위트", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO4102", "name": "테스트 커버리지 리포트", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO4103", "name": "보안 취약점 점검 결과서", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO5101", "name": "CD 파이프라인 정의서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO5102", "name": "배포 승인 기록", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO5103", "name": "롤백 절차서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO6101", "name": "운영 매뉴얼(Runbook)", "phase": "운영", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO6102", "name": "장애 대응 절차서", "phase": "운영", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO7101", "name": "모니터링 대시보드 정의서", "phase": "모니터링", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO7102", "name": "장애 회고 보고서(Postmortem)", "phase": "모니터링", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO7103", "name": "SLO 준수 리포트", "phase": "모니터링", "method": "공통", "large": "M", "medium": "O", "small": "O"},
];

const SIZE_NOTE = "※ 투입 MM 기준 — (초)대형 600MM 초과 / 중형 125MM 초과 / 소형 125MM 이하";

// ── 방법론별 가이드 정의 ──
export const TAILORING_GUIDES = {
  ie: {
    id: "ie",
    title: "방법론 테일러링 가이드 v2.0",
    subtitle: "정보공학(IE)/UML 기반 SI 개발 방법론",
    hasDesignMethod: true,                       // UML/IE 설계방식 선택 있음
    phaseOrder: ["요구정의", "분석", "설계", "구축", "운영전환"],
    scaleOptions: [
      { value: "(초)대형", label: "(초)대형" },
      { value: "중형",    label: "중형" },
      { value: "소형",    label: "소형" },
    ],
    sizeNote: SIZE_NOTE,
    purpose: "프로젝트 유형 또는 특성에 따라 프로젝트에서 수행되어야 할 태스크와 산출물 선정 작업을 지원하기 위한 기준을 제시하고 방법론 테일러링을 가이드한다. 본 가이드는 조직 표준 프로세스(OSSP)를 프로젝트 정의 프로세스(PDP)로 테일러링할 때의 기준으로 사용된다.",
    matrix: IE_TAILORING_MATRIX,
  },
  waterfall: {
    id: "waterfall",
    title: "Waterfall 테일러링 가이드",
    subtitle: "전통적 순차(예측형) 개발 방법론",
    hasDesignMethod: false,
    phaseOrder: ["요구분석", "설계", "구현", "테스트", "배포", "유지보수"],
    scaleOptions: [
      { value: "(초)대형", label: "(초)대형" },
      { value: "중형",    label: "중형" },
      { value: "소형",    label: "소형" },
    ],
    sizeNote: SIZE_NOTE,
    purpose: "Waterfall(폭포수) 방법론 적용 프로젝트에서 규모에 따라 필수/선택 산출물을 선정하기 위한 기준을 제시한다. PMBOK 8판 예측형 접근의 품질보증 필수 산출물(품질보증 계획서, 요구사항 추적표(RTM), 결함 관리 대장 등)을 포함하며, OSSP를 PDP(테일러링결과서)로 테일러링할 때의 기준으로 사용된다.",
    matrix: WATERFALL_TAILORING_MATRIX,
  },
  agile: {
    id: "agile",
    title: "Agile/Scrum 테일러링 가이드",
    subtitle: "반복·점진적(적응형) 개발 방법론 · V1.0",
    hasDesignMethod: false,
    phaseOrder: ["스프린트 계획", "백로그 관리", "개발", "리뷰", "회고", "릴리즈"],
    scaleOptions: [
      { value: "(초)대형", label: "대규모" },
      { value: "중형",    label: "중규모" },
      { value: "소형",    label: "소규모" },
    ],
    sizeNote: "※ 팀 수·기간 기준 — 대규모 3개 팀 이상 또는 12개월 초과 / 중규모 1~2개 팀·3~12개월 / 소규모 1개 팀(7인 이하)·3개월 미만",
    sizeCriteria: {
      headers: ["구분", "기준(예시)", "특징"],
      rows: [
        ["소규모", "1개 팀(7인 이하), 3개월 미만", "이벤트·산출물 간소화, 구두 소통 비중 확대"],
        ["중규모", "1~2개 팀, 3~12개월", "표준 산출물 대부분 적용"],
        ["대규모", "3개 팀 이상 또는 12개월 초과", "팀 간 동기화 산출물 추가(스토리 맵 필수 등)"],
      ],
      notes: ["본 시스템의 규모 선택(대규모/중규모/소규모)은 내부 저장 값 (초)대형/중형/소형에 각각 대응됩니다."],
    },
    matrixNote: "DoD·회고 관련 산출물은 규모와 무관하게 필수(M)를 원칙으로 한다.",
    purpose: "본 가이드는 Agile/Scrum 방법론(OSSP)을 프로젝트 특성에 맞게 조정하여 PDP를 수립하기 위한 기준을 정의한다. 적응형 접근에서도 PMBOK 8판의 조정(Tailoring) 원칙에 따라 품질 순환(DoD·회고)에 관련된 필수 산출물은 유지하는 것을 원칙으로 한다.",
    matrix: AGILE_TAILORING_MATRIX,
  },
  devops: {
    id: "devops",
    title: "DevOps 테일러링 가이드",
    subtitle: "지속적 통합·배포·운영 방법론",
    hasDesignMethod: false,
    phaseOrder: ["계획", "코딩", "빌드", "테스트", "배포", "운영", "모니터링"],
    scaleOptions: [
      { value: "(초)대형", label: "(초)대형" },
      { value: "중형",    label: "중형" },
      { value: "소형",    label: "소형" },
    ],
    sizeNote: SIZE_NOTE,
    purpose: "DevOps 방법론 적용 프로젝트에서 규모에 따라 필수/선택 산출물을 선정하기 위한 기준을 제시한다. SLO/SLA·보안 점검·롤백 절차 등 운영 품질 산출물과 PMBOK 8판 품질·리스크 성과영역 관점의 QA 산출물을 포함하며, OSSP를 PDP(테일러링결과서)로 테일러링할 때의 기준으로 사용된다.",
    matrix: DEVOPS_TAILORING_MATRIX,
  },
};

// 방법론 label → 가이드 key (DB 시딩된 기본 방법론이 UUID id를 갖는 경우 대비)
const LABEL_TO_GUIDE = { "Waterfall": "waterfall", "Agile/Scrum": "agile", "DevOps": "devops" };

// 선택된 OSSP에 해당하는 테일러링 가이드 반환.
// 기본 제공 3종은 전용 가이드, 그 외(사내 등록 OSSP 포함)는 IE 기반 v2.0 가이드를 기본 적용.
export function getGuideForOSSP(ossp) {
  if (!ossp) return TAILORING_GUIDES.ie;
  if (ossp.id && TAILORING_GUIDES[ossp.id]) return TAILORING_GUIDES[ossp.id];
  const byLabel = LABEL_TO_GUIDE[ossp.label];
  if (byLabel) return TAILORING_GUIDES[byLabel];
  return TAILORING_GUIDES.ie;
}
