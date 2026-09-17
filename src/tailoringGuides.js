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

// ── 2) Waterfall — 등록 자산 "Waterfall 테일러링 가이드 V1.0" 기준 (22건)
// 규모 매핑: 대규모→large / 중규모→medium / 소규모→small.
export const WATERFALL_TAILORING_MATRIX = [
  {"code": "WF1101", "name": "프로젝트 관리 계획서(PMP)", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF1102", "name": "요구사항 정의서", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF1103", "name": "요구사항 추적표(RTM)", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF1104", "name": "품질보증 계획서", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF1105", "name": "리스크 관리대장", "phase": "요구분석", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF2101", "name": "아키텍처 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF2102", "name": "상세 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF2103", "name": "인터페이스 설계서", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "O", "note": "소규모는 연계 시 M"},
  {"code": "WF2104", "name": "DB 설계서(ERD)", "phase": "설계", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF3101", "name": "프로그램 소스코드", "phase": "구현", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF3102", "name": "코딩 표준 준수 검토서", "phase": "구현", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF3103", "name": "단위테스트 결과서", "phase": "구현", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF4101", "name": "통합테스트 계획서/결과서", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF4102", "name": "테스트 케이스·시나리오", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF4103", "name": "결함 관리 대장", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF5101", "name": "배포(이행) 계획서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "WF5102", "name": "인수테스트 결과서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF5103", "name": "사용자·운영자 매뉴얼", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "WF5104", "name": "릴리즈 노트", "phase": "배포", "method": "공통", "large": "M", "medium": "O", "small": "O"},
  {"code": "WF6101", "name": "변경 요청서(CR)", "phase": "유지보수", "method": "공통", "large": "M", "medium": "M", "small": "M"},
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

// ── 4) DevOps — 등록 자산 "DevOps 테일러링 가이드 V1.0" 기준 (16건)
// 규모 매핑: 대규모→large / 중규모→medium / 소규모→small. CI·롤백·Runbook은 전 규모 필수 원칙.
export const DEVOPS_TAILORING_MATRIX = [
  {"code": "DO1101", "name": "제품 로드맵", "phase": "계획", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO1102", "name": "SLO/SLA 정의서", "phase": "계획", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO2101", "name": "프로그램 소스코드", "phase": "코딩", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO2102", "name": "코드 리뷰(PR) 기록", "phase": "코딩", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO2103", "name": "코딩 표준 가이드", "phase": "코딩", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO3101", "name": "CI 파이프라인 정의서", "phase": "빌드", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO3102", "name": "빌드 결과 리포트", "phase": "빌드", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO4101", "name": "자동화 테스트 스위트", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO4102", "name": "테스트 커버리지 리포트", "phase": "테스트", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO5101", "name": "CD 파이프라인 정의서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO5102", "name": "배포 승인 기록", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO5103", "name": "롤백 절차서", "phase": "배포", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO6101", "name": "운영 매뉴얼(Runbook)", "phase": "운영", "method": "공통", "large": "M", "medium": "M", "small": "M"},
  {"code": "DO6102", "name": "장애 대응 절차서", "phase": "운영", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO7101", "name": "모니터링 대시보드 정의서", "phase": "모니터링", "method": "공통", "large": "M", "medium": "M", "small": "O"},
  {"code": "DO7102", "name": "장애 회고 보고서(Postmortem)", "phase": "모니터링", "method": "공통", "large": "M", "medium": "M", "small": "O"},
];


// ── 5) 자동차 SW(ASPICE 4.0) — 등록 자산 "자동차SW 테일러링 가이드 V1.1" 기준 (41건, ASPICE 프로세스 산출물로 한정)
// 목표 능력수준 매핑: CL3(테일러링 적용, PA 3.1)→large / CL2(표준 프로세스 전면 적용)→medium.
// CL2 열은 전 산출물 M(테일러링 없음). 기능안전(ISO 26262)·사이버보안(ISO/SAE 21434) 산출물은 본 가이드 범위 밖(제외). note = ASPICE 프로세스 · 정보항목(WP) · 테일러링 조건.
export const ASPICE_TAILORING_MATRIX = [
  {"code": "PM1101", "name": "프로젝트 계획서", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "MAN.3 · 08-53, 08-56, 08-61"},
  {"code": "PM1102", "name": "프로젝트 진척 보고서", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "MAN.3 · 15-06, 13-14"},
  {"code": "PM1103", "name": "착수보고 자료", "phase": "착수·계획", "method": "공통", "large": "O", "medium": "M", "note": "MAN.3 · 13-52"},
  {"code": "RK1101", "name": "리스크 관리대장", "phase": "착수·계획", "method": "공통", "large": "O", "medium": "M", "note": "MAN.5 · 08-55, 15-09 · VDA 범위 외"},
  {"code": "QA1101", "name": "품질보증 계획서", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "SUP.1 · 18-07, 18-52"},
  {"code": "QA1102", "name": "산출물 검토 기록부", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "PA 2.2 · 13-19 · CL2 이상 필수"},
  {"code": "QA1103", "name": "QA 평가 보고서", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "SUP.1 · 13-18, 14-02"},
  {"code": "CM1101", "name": "형상관리 계획서", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "SUP.8 · 18-53, 16-03"},
  {"code": "CR1101", "name": "문제·변경관리 계획서", "phase": "착수·계획", "method": "공통", "large": "M", "medium": "M", "note": "SUP.9, SUP.10 · 18-57"},
  {"code": "SP1101", "name": "공급자 모니터링 계획서", "phase": "착수·계획", "method": "공통", "large": "O", "medium": "M", "note": "ACQ.4 · 02-01, 13-52 · 협력사 개발 포함 시 필수"},
  {"code": "SY2101", "name": "이해관계자 요구사항 목록", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.1 · 17-00, 17-54"},
  {"code": "SY2102", "name": "시스템 요구사항 명세서", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.2 · 17-00, 17-54, 15-51"},
  {"code": "SY2103", "name": "시스템 아키텍처 설계서", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.3 · 04-06, 17-54, 15-51"},
  {"code": "SY2104", "name": "인터페이스 정의서", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.3 · 04-06 · 통신 연계 시 필수"},
  {"code": "SY2105", "name": "요구사항 추적 매트릭스", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.2~SWE.6 · 13-51"},
  {"code": "SY2106", "name": "시스템 검증 명세서", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.5 · 08-60, 08-58"},
  {"code": "SY2107", "name": "시스템 통합 검증 명세서", "phase": "시스템 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SYS.4 · 08-60, 06-50"},
  {"code": "SW3101", "name": "SW 요구사항 명세서", "phase": "SW 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SWE.1 · 17-00, 17-54, 15-51"},
  {"code": "SW3102", "name": "SW 아키텍처 설계서", "phase": "SW 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SWE.2 · 04-04, 17-54, 15-51"},
  {"code": "SW3103", "name": "SW 통합 검증 명세서", "phase": "SW 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SWE.5 · 08-60, 06-50"},
  {"code": "SW3104", "name": "SW 검증 명세서", "phase": "SW 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SWE.6 · 08-60, 08-58"},
  {"code": "SW3105", "name": "코딩 가이드라인", "phase": "SW 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SWE.3 · 18-00"},
  {"code": "SW3106", "name": "리소스 사용 분석서", "phase": "SW 요구·설계", "method": "공통", "large": "M", "medium": "M", "note": "SWE.2 · 15-51"},
  {"code": "SW3107", "name": "재사용 SW 분석서", "phase": "SW 요구·설계", "method": "공통", "large": "O", "medium": "M", "note": "SWE.2, REU.2 · 15-07 · 파생(Carry-over) 개발 시 필수"},
  {"code": "SW4101", "name": "SW 상세설계서", "phase": "SW 상세설계·구현", "method": "공통", "large": "M", "medium": "M", "note": "SWE.3 · 04-05"},
  {"code": "SW4102", "name": "SW 소스코드", "phase": "SW 상세설계·구현", "method": "공통", "large": "M", "medium": "M", "note": "SWE.3 · 11-05"},
  {"code": "SW4103", "name": "SW 유닛 검증 명세서", "phase": "SW 상세설계·구현", "method": "공통", "large": "M", "medium": "M", "note": "SWE.4 · 08-60, 08-58"},
  {"code": "SW4104", "name": "정적분석 결과서", "phase": "SW 상세설계·구현", "method": "공통", "large": "M", "medium": "M", "note": "SWE.4 · 15-52"},
  {"code": "SW4105", "name": "코드 리뷰 기록", "phase": "SW 상세설계·구현", "method": "공통", "large": "M", "medium": "M", "note": "SWE.4 · 13-19, 15-52"},
  {"code": "SW4106", "name": "SW 유닛 검증 결과서", "phase": "SW 상세설계·구현", "method": "공통", "large": "M", "medium": "M", "note": "SWE.4 · 15-52, 03-50 · 커버리지 기준 A: MC/DC · B: Branch · C: Statement"},
  {"code": "SW5101", "name": "SW 통합 검증 결과서", "phase": "SW 통합·검증", "method": "공통", "large": "M", "medium": "M", "note": "SWE.5 · 15-52, 01-50"},
  {"code": "SW5102", "name": "SW 검증 결과서", "phase": "SW 통합·검증", "method": "공통", "large": "M", "medium": "M", "note": "SWE.6 · 15-52"},
  {"code": "PR5101", "name": "문제 관리대장", "phase": "SW 통합·검증", "method": "공통", "large": "M", "medium": "M", "note": "SUP.9 · 13-07, 15-12"},
  {"code": "CR5101", "name": "변경요청 관리대장", "phase": "SW 통합·검증", "method": "공통", "large": "M", "medium": "M", "note": "SUP.10 · 13-16"},
  {"code": "SY6101", "name": "시스템 통합 검증 결과서", "phase": "시스템 통합·검증", "method": "공통", "large": "M", "medium": "M", "note": "SYS.4 · 15-52, 11-06"},
  {"code": "SY6102", "name": "시스템 검증 결과서", "phase": "시스템 통합·검증", "method": "공통", "large": "M", "medium": "M", "note": "SYS.5 · 15-52"},
  {"code": "VL6101", "name": "밸리데이션 보고서", "phase": "시스템 통합·검증", "method": "공통", "large": "O", "medium": "M", "note": "VAL.1 · 13-24 · 실차 밸리데이션 수행 시 필수"},
  {"code": "RL7101", "name": "릴리즈 노트", "phase": "릴리즈", "method": "공통", "large": "M", "medium": "M", "note": "SPL.2 · 11-03"},
  {"code": "RL7102", "name": "릴리즈 승인서", "phase": "릴리즈", "method": "공통", "large": "M", "medium": "M", "note": "SPL.2 · 13-13, 18-06"},
  {"code": "CM7101", "name": "형상 감사 보고서", "phase": "릴리즈", "method": "공통", "large": "M", "medium": "M", "note": "SUP.8 · 13-08, 15-56"},
  {"code": "PM7101", "name": "프로젝트 종료 보고서", "phase": "릴리즈", "method": "공통", "large": "O", "medium": "M", "note": "MAN.3 · 15-06"},
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
    subtitle: "전통적 순차(예측형) 개발 방법론 · V1.0",
    hasDesignMethod: false,
    phaseOrder: ["요구분석", "설계", "구현", "테스트", "배포", "유지보수"],
    scaleOptions: [
      { value: "(초)대형", label: "대규모" },
      { value: "중형",    label: "중규모" },
      { value: "소형",    label: "소규모" },
    ],
    sizeNote: "※ 투입 인원·기간 기준 — 대규모 20인 초과 또는 12개월 초과(다수 연계) / 중규모 5~20인 또는 6~12개월 / 소규모 5인 미만 또는 6개월 미만",
    sizeCriteria: {
      headers: ["구분", "기준(예시)", "특징"],
      rows: [
        ["소규모", "투입 5인 미만 또는 6개월 미만", "산출물 통합·간소화 중심 테일러링"],
        ["중규모", "투입 5~20인 또는 6~12개월", "표준 산출물 대부분 적용"],
        ["대규모", "투입 20인 초과 또는 12개월 초과, 다수 연계", "전 산출물 필수 + 감리 대응 강화"],
      ],
      notes: ["본 시스템의 규모 선택(대규모/중규모/소규모)은 내부 저장 값 (초)대형/중형/소형에 각각 대응됩니다."],
    },
    matrixNote: "선택(O) 산출물은 프로젝트 특성(연계 유무, 규제, 발주처 요구)에 따라 PDP 확정 시 적용 여부를 결정한다. 필수(M) 산출물의 생략은 승인 절차를 거쳐야 한다.",
    purpose: "본 가이드는 Waterfall 방법론(OSSP)을 프로젝트 특성에 맞게 조정(Tailoring)하여 프로젝트 정의 프로세스(PDP)를 수립하기 위한 기준을 정의한다. PMBOK 8판의 조정(Tailoring) 원칙에 따라 프로젝트 규모·복잡도·리스크를 고려하되, 필수(M) 산출물의 생략은 승인 절차를 거쳐야 한다.",
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
    subtitle: "지속적 통합·배포·운영 방법론 · V1.0",
    hasDesignMethod: false,
    phaseOrder: ["계획", "코딩", "빌드", "테스트", "배포", "운영", "모니터링"],
    scaleOptions: [
      { value: "(초)대형", label: "대규모" },
      { value: "중형",    label: "중규모" },
      { value: "소형",    label: "소규모" },
    ],
    sizeTitle: "서비스 규모·성숙도 판정 기준",
    sizeNote: "※ 서비스 규모·성숙도 기준 — 대규모 다수 팀·서비스(미션 크리티컬) / 중규모 복수 서비스 또는 대외 서비스 / 소규모 단일 서비스·1개 팀(사내용)",
    sizeCriteria: {
      headers: ["구분", "기준(예시)", "특징"],
      rows: [
        ["소규모", "단일 서비스, 1개 팀, 사내용", "필수 자동화 중심, 문서 간소화"],
        ["중규모", "복수 서비스 또는 대외 서비스", "SLO 기반 운영, 표준 산출물 적용"],
        ["대규모", "다수 팀·서비스, 미션 크리티컬", "전 산출물 필수 + 승인·감사 이력 강화"],
      ],
      notes: ["본 시스템의 규모 선택(대규모/중규모/소규모)은 내부 저장 값 (초)대형/중형/소형에 각각 대응됩니다."],
    },
    matrixNote: "CI 파이프라인 정의서·롤백 절차서·운영 매뉴얼(Runbook)은 안전한 전달의 최소 장치로서 규모와 무관하게 필수(M)를 원칙으로 한다.",
    purpose: "본 가이드는 DevOps 방법론(OSSP)을 서비스 특성과 조직 성숙도에 맞게 조정하여 PDP를 수립하기 위한 기준을 정의한다. PMBOK 8판의 조정(Tailoring) 원칙에 따라 조정하되, 안전한 전달의 최소 장치(CI, 코드리뷰, 롤백 절차, Runbook)는 규모와 무관하게 유지한다.",
    matrix: DEVOPS_TAILORING_MATRIX,
  },
  aspice: {
    id: "aspice",
    title: "자동차SW 테일러링 가이드",
    subtitle: "Automotive SPICE 4.0 · V1.1 (ASPICE 프로세스 산출물 한정)",
    hasDesignMethod: false,
    phaseOrder: ["착수·계획", "시스템 요구·설계", "SW 요구·설계", "SW 상세설계·구현", "SW 통합·검증", "시스템 통합·검증", "릴리즈"],
    scaleTitle: "목표 능력수준",
    criteriaTitle: "능력수준별 적용 방식",
    hideDesignMethod: true,   // PDP 2장에서 "설계방식: 해당 없음" 행 숨김
    // 확정 요구사항을 채울 xlsx 산출물 (헤더 라벨 → 값). 값: id·name·source·type·priority·summary·nameSummary·module·bus·message·periodMs
    //  {seq:"STK-"} = 순번 ID, {const:"..."} = 고정값. bus·message·periodMs는 요구사항 문장에 명시된 경우에만 추출(추정 금지).
    reqXlsxFill: [
      { match: "이해관계자 요구사항 목록", sheet: "템플릿", cols: {
          "요구 ID": { seq: "STK-" }, "출처(OEM 사양서·조항)": "source", "요구사항 내용": "summary",
          "유형(기능/비기능/규제)": "type", "우선순위": "priority", "합의 상태": { const: "검토 중" },
          "시스템 요구 ID(추적)": "id", "비고": "name" } },
      { match: "인터페이스 정의서", sheet: "템플릿", types: ["인터페이스"], cols: {
          "인터페이스 ID": { seq: "IF-" }, "관련 요구사항 ID": "id", "인터페이스 내용": "nameSummary",
          "버스(CAN/LIN/ETH)": "bus", "메시지명": "message", "주기(ms)": "periodMs",
          "비고": { const: "메시지 ID·시그널·비트 배치는 DBC/ICD 확정 후 작성" } } },
    ],
    // 요구사항 AI 작성 모달 문구·AI 역할 (OSSP별)
    reqGen: {
      desc: "OEM·이해관계자 요구 원문 → 도출(SYS.1)·명세(SYS.2) → 검토·확정 시 시스템 요구사항 명세서와 요구사항 추적 매트릭스(13-51)에 자동 반영",
      srcHint: "OEM 사양서 발췌·RFQ·고객 회의록·법규 요구 등 붙여넣기 또는 파일 업로드",
      placeholder: "예) 차속 15km/h 이상이 되면 전 도어를 자동 잠금해야 한다. 스마트키 인증 후 도어 잠금 해제까지 200ms 이내여야 한다. …",
      roleDerive: "당신은 Automotive SPICE 4.0 SYS.1(이해관계자 요구사항 도출)·SYS.2(시스템 요구사항 분석)에 정통한 차량 전장 품질보증 전문가입니다. 아래 OEM·이해관계자 요구사항 원문에서 기능·비기능(성능·타이밍·전원·진단)·인터페이스(CAN/LIN·진단) 요구사항을 도출하세요. 원문에 명시된 속성(주기·임계값·조건)은 요약에 그대로 반영하세요.",
      qualityStd: { name: "ISO/IEC 25010", chars: "기능 적합성/성능 효율성/호환성/사용성/신뢰성/보안성/유지보수성/이식성" },
      roleSpec: "당신은 Automotive SPICE 4.0 SYS.2(시스템 요구사항 분석, BP1~BP3)에 정통한 차량 전장 품질보증 전문가입니다. 아래 요구사항 각각을 검증 가능성(정량 기준·검증 방법)과 구현 가능성을 고려해 상세 명세하세요. 비기능은 측정기준(단위·임계값·측정 조건)을 포함하세요.",
    },
    scaleOptions: [
      { value: "(초)대형", label: "CL3 · 테일러링 적용" },
      { value: "중형",    label: "CL2 · 표준 프로세스 전면 적용" },
    ],
    // 선택한 능력수준 아래에 표시하는 설명 (value 기준)
    scaleDesc: {
      "(초)대형": "CL3(PA 3.1 프로세스 정의): 조직 표준 프로세스(OSSP)를 테일러링 가이드에 따라 조정해 PDP를 수립합니다. 필수(M) 산출물은 고정, 선택(O) 산출물은 적용 여부와 사유를 기록합니다.",
      "중형":    "CL2: 테일러링 없이 조직 표준 프로세스의 산출물 템플릿을 전면 적용합니다(선택 산출물 없음). 테일러링 기반 PDP 수립은 CL3부터 적용됩니다.",
    },
    sizeTitle: "목표 능력수준별 적용 방식",
    sizeNote: "※ 목표 Automotive SPICE 능력수준(CL) 기준 — CL3 테일러링 가이드에 따라 조정(PA 3.1) / CL2 표준 프로세스 전면 적용(테일러링 없음)",
    sizeCriteria: {
      headers: ["구분", "적용 방식", "특징"],
      rows: [
        ["CL2", "표준 프로세스 전면 적용", "OSSP 산출물 템플릿을 그대로 사용, 선택 산출물 없음, 검토 기록(PA 2.2) 필수"],
        ["CL3", "테일러링 가이드에 따라 조정(PA 3.1)", "필수(M) 고정, 선택(O) 산출물의 적용 여부·사유를 PDP(테일러링결과서)에 기록"],
      ],
      notes: [
        "본 시스템의 능력수준 선택(CL3/CL2)은 내부 저장 값 (초)대형/중형에 각각 대응됩니다.",
        "협력사 개발·파생(Carry-over) 개발·실차 밸리데이션 해당 시 관련 선택(O) 산출물은 필수로 전환합니다.",
        "기능안전(ISO 26262)·사이버보안(ISO/SAE 21434) 산출물은 본 가이드 범위에 포함하지 않으며, 제품 특성에 따라 별도 프로세스로 적용합니다.",
      ],
    },
    matrixNote: "필수(M) 산출물은 통합·병합만 허용하며 생략 시 사유 기록·QA 검토·PM 승인이 필요하다. CL2 열은 표준 프로세스 전면 적용으로 전 산출물 필수(M)이다. 비고는 ASPICE 프로세스 · 정보항목(WP) · 테일러링 조건이다.",
    purpose: "본 가이드는 조직 표준 프로세스(OSSP)인 「자동차 SW 개발 표준프로세스(ASPICE 4.0)」를 프로젝트 특성에 맞게 조정하여 PDP(테일러링 결과서)를 수립하기 위한 기준을 정의한다. PMBOK® 8판의 조정(Tailoring) 원칙에 따르되, 고객(OEM)이 요구하는 Automotive SPICE 목표 능력수준을 충족하는 산출물은 유지하는 것을 원칙으로 한다. 적용 범위는 ASPICE 프로세스 산출물로 한정한다.",
    matrix: ASPICE_TAILORING_MATRIX,
    // 관리활동 테일러링 산출물 → 개발산출물(OSSP) 산출물 대체 매핑 (단일 산출물 원칙)
    // [정규식, 대체 산출물명] — 위에서부터 첫 일치 적용 (포함 표기가 있는 항목을 먼저 둔다)
    mgmtOutputMap: [
      [/품질보증\s*계획서/, "품질보증 계획서"],
      [/구성관리\s*계획서/, "형상관리 계획서"],
      [/품질보증\s*검토\s*결과서/, "QA 평가 보고서"],
      [/위험관리\s*내역서/, "리스크 관리대장"],
      [/요구사항\s*(정의서|명세서)|정의서\s*\/\s*명세서/, "시스템 요구사항 명세서"],
      [/요구사항\s*추적\s*매트릭스/, "요구사항 추적 매트릭스"],
      [/변경\s*내역서/, "변경요청 관리대장"],
      [/Inspection\s*계획\s*및\s*결과서/i, "산출물 검토 기록부"],
      [/프로젝트\s*상태\s*보고서/, "프로젝트 진척 보고서"],
      [/프로젝트\s*완료\s*보고서/, "프로젝트 종료 보고서"],
      [/협력업체\s*프로젝트\s*(계획서|현황\s*보고서)/, "공급자 모니터링 계획서"],
      [/테일러링\s*내역서/, "테일러링결과서"],
      [/프로젝트\s*기술서/, "프로젝트 계획서"],
    ],
  },
};

// 관리활동 산출물명 → 가이드의 mgmtOutputMap으로 개발산출물명 대체 (매핑 없는 가이드는 원래 이름 그대로)
export function mapMgmtOutput(name, guide) {
  const n = String(name || "");
  const map = guide?.mgmtOutputMap;
  if (!n || !Array.isArray(map)) return n;
  for (const [re, to] of map) { if (re.test(n)) return to; }
  return n;
}

// 방법론 label → 가이드 key (DB 시딩된 기본 방법론이 UUID id를 갖는 경우 대비)
const LABEL_TO_GUIDE = { "Waterfall": "waterfall", "Agile/Scrum": "agile", "DevOps": "devops" };

// 선택된 OSSP에 해당하는 테일러링 가이드 반환.
// 기본 제공 3종은 전용 가이드, 그 외(사내 등록 OSSP 포함)는 IE 기반 v2.0 가이드를 기본 적용.
export function getGuideForOSSP(ossp) {
  if (!ossp) return TAILORING_GUIDES.ie;
  if (ossp.id && TAILORING_GUIDES[ossp.id]) return TAILORING_GUIDES[ossp.id];
  const byLabel = LABEL_TO_GUIDE[ossp.label];
  if (byLabel) return TAILORING_GUIDES[byLabel];
  // 사내 등록 OSSP 중 자동차(ASPICE) 방법론은 이름으로 식별하여 자동차 전용 가이드 적용
  const nm = String(ossp.label || ossp.name || "");
  if (/ASPICE|자동차/i.test(nm)) return TAILORING_GUIDES.aspice;
  return TAILORING_GUIDES.ie;
}
