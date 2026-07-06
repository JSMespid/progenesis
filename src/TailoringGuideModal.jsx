// src/TailoringGuideModal.jsx
// 테일러링 화면에서 가이드 링크 클릭 시 해당 방법론의 테일러링 가이드 전문
// (목적 / 규모 분류 기준 / M-O 매트릭스)을 보여주는 모달.
// guide prop(src/tailoringGuides.js의 TAILORING_GUIDES 항목)을 받아 방법론별로 렌더링.
// guide 없이 matrix만 넘기던 이전 호출 방식도 하위 호환 지원.

import React, { useEffect, useMemo, useState } from "react";

/* ── 프로젝트 규모에 따른 분류 (방법론 테일러링 가이드 v2.0, p.82 / 전 방법론 공통 규모 기준) ── */
const SIZE_CRITERIA = [
  { 구분: "초대형", 기간: "11개월 이상", 인원: "60명 이상", mm: "600MM 초과", 용역: "50억 이상", 매출: "100억 이상", infra: "50억 이상" },
  { 구분: "대형",   기간: "7개월 이상",  인원: "45명 이상", mm: "300MM 초과", 용역: "25억~50억",  매출: "50억~100억", infra: "25억~50억" },
  { 구분: "중형",   기간: "5개월 이상",  인원: "25명 이상", mm: "125MM 초과", 용역: "10억~25억",  매출: "20억~50억",  infra: "10억~25억" },
  { 구분: "소형",   기간: "4개월 미만",  인원: "25명 미만", mm: "125MM 이하", 용역: "10억 미만",  매출: "20억 미만",  infra: "10억 미만" },
];

const SIZE_NOTES = [
  "프로젝트 규모는 기간·월평균 투입인원 기반으로 산정된 전체 투입 MM를 기준으로 함",
  "투입 MM 기준 적용이 어려운 경우 인건비 및 매출액을 대신 사용 (적용 순서: 투입 MM > 인건비 > 매출액)",
  "규모 구분은 절대적인 기준이 아니며 프로젝트 유형·특성, 인건비/재료비 비율 등을 고려하여 판단",
  "'공통 Infra' 부분의 적용 기준은 투입 MM가 아닌 해당 프로젝트 Infra(장비) 부분의 매출액임",
];

const DEFAULT_PURPOSE =
  "프로젝트 유형 또는 특성에 따라 프로젝트에서 수행되어야 할 태스크와 산출물 선정 작업을 지원하기 위한 기준을 제시하고 방법론 테일러링을 가이드한다. 본 가이드는 조직 표준 프로세스(OSSP)를 프로젝트 정의 프로세스(PDP)로 테일러링할 때의 기준으로 사용된다.";

/* ── 매트릭스 항목 필드명 정규화 ── */
function normalizeEntry(e) {
  const sz = e.size || e.sizes || {};
  return {
    id: e.id ?? e.code ?? "",
    name: e.name ?? e.title ?? e.deliverable ?? "",
    phase: e.phase ?? e.stage ?? "기타",
    task: e.task ?? e.process ?? "",
    large: e.large ?? e.xlarge ?? sz.large ?? sz["(초)대형"] ?? "",
    medium: e.medium ?? sz.medium ?? sz["중형"] ?? "",
    small: e.small ?? sz.small ?? sz["소형"] ?? "",
    method: e.method ?? e.designMethod ?? e.design ?? "공통",
  };
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "#12151c", border: "1px solid #2a2f3a", borderRadius: 12, width: "min(960px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", color: "#e6e9ef" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #2a2f3a" },
  title: { fontSize: 16, fontWeight: 700 },
  subtitle: { fontSize: 11.5, color: "#8892a4", marginTop: 2 },
  closeBtn: { background: "transparent", border: "1px solid #3a4150", color: "#aab2c0", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13 },
  body: { overflowY: "auto", padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "#8ab4ff", margin: "18px 0 8px" },
  p: { fontSize: 13, lineHeight: 1.7, color: "#c4cad6", margin: "4px 0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  th: { background: "#1b202b", border: "1px solid #2a2f3a", padding: "6px 8px", textAlign: "center", whiteSpace: "nowrap", color: "#aab8d0" },
  td: { border: "1px solid #262b36", padding: "6px 8px", textAlign: "center" },
  tdLeft: { border: "1px solid #262b36", padding: "6px 8px", textAlign: "left" },
  note: { fontSize: 12, color: "#8892a4", lineHeight: 1.6, margin: "3px 0" },
  legend: { display: "flex", gap: 16, fontSize: 12, color: "#aab2c0", margin: "8px 0 12px" },
  phaseHead: { background: "#1a2233", color: "#8ab4ff", fontWeight: 700, textAlign: "left", padding: "7px 8px", border: "1px solid #2a2f3a", fontSize: 12.5 },
  badgeM: { display: "inline-block", minWidth: 22, padding: "1px 6px", borderRadius: 5, background: "#1e3a8a", color: "#bfd4ff", fontWeight: 700, fontSize: 11.5 },
  badgeO: { display: "inline-block", minWidth: 22, padding: "1px 6px", borderRadius: 5, background: "#2b303b", color: "#aab2c0", fontWeight: 600, fontSize: 11.5 },
  badgeNA: { color: "#4d5563", fontSize: 11.5 },
  methodTag: { fontSize: 10.5, padding: "1px 6px", borderRadius: 4, border: "1px solid #3a4150", color: "#9aa4b5" },
  searchBox: { width: "100%", boxSizing: "border-box", background: "#0d1017", border: "1px solid #2a2f3a", borderRadius: 8, color: "#e6e9ef", padding: "8px 12px", fontSize: 13, margin: "4px 0 12px", outline: "none" },
};

function MOBadge({ v }) {
  const u = String(v || "").toUpperCase();
  if (u === "M") return <span style={S.badgeM}>M</span>;
  if (u === "O") return <span style={S.badgeO}>O</span>;
  return <span style={S.badgeNA}>—</span>;
}

export default function TailoringGuideModal({ guide, matrix = [], onClose }) {
  const [q, setQ] = useState("");

  // guide가 있으면 그것을, 없으면(구버전 호출) matrix prop만으로 렌더링
  const data = guide?.matrix || matrix;
  const title = guide?.title || "방법론 테일러링 가이드 v2.0";
  const subtitle = guide?.subtitle || "";
  const purpose = guide?.purpose || DEFAULT_PURPOSE;
  const hasDesignMethod = guide ? !!guide.hasDesignMethod : true;
  const phaseOrder = guide?.phaseOrder || null;
  const colCount = hasDesignMethod ? 6 : 5;
  const scaleLabels = guide?.scaleOptions?.map((o) => o.label) || ["(초)대형", "중형", "소형"];
  const sizeCriteria = guide?.sizeCriteria || null;   // 방법론 전용 규모 기준 (없으면 공통 MM 기준표)
  const matrixNote = guide?.matrixNote || null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const grouped = useMemo(() => {
    const rows = data.map(normalizeEntry).filter((r) => {
      if (!q.trim()) return true;
      const t = q.trim().toLowerCase();
      return r.id.toLowerCase().includes(t) || r.name.toLowerCase().includes(t) || String(r.phase).toLowerCase().includes(t);
    });
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.phase)) map.set(r.phase, []);
      map.get(r.phase).push(r);
    });
    const entries = [...map.entries()];
    // 가이드의 단계 순서대로 정렬 (정의되지 않은 단계는 뒤로)
    if (phaseOrder) {
      entries.sort((a, b) => {
        const ia = phaseOrder.indexOf(a[0]); const ib = phaseOrder.indexOf(b[0]);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return entries;
  }, [data, q, phaseOrder]);

  const total = data.length;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div style={S.header}>
          <div>
            <div style={S.title}>{title}</div>
            {subtitle && <div style={S.subtitle}>{subtitle}</div>}
          </div>
          <button style={S.closeBtn} onClick={onClose}>닫기 ✕</button>
        </div>

        <div style={S.body}>
          {/* 1. 목적 */}
          <div style={{ ...S.sectionTitle, marginTop: 0 }}>1. 목적</div>
          <p style={S.p}>{purpose}</p>

          {/* 2. 규모 분류 기준 — 방법론 전용 기준이 정의된 가이드는 해당 표, 그 외는 공통 MM 기준표 */}
          <div style={S.sectionTitle}>2. 프로젝트 규모 판정 기준</div>
          {sizeCriteria ? (
            <>
              <table style={S.table}>
                <thead>
                  <tr>{sizeCriteria.headers.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sizeCriteria.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((c, j) => (
                        <td key={j} style={j === 0 ? { ...S.td, fontWeight: 700 } : S.tdLeft}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8 }}>
                {(sizeCriteria.notes || []).map((n, i) => <p key={i} style={S.note}>※ {n}</p>)}
              </div>
            </>
          ) : (
            <>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>구분</th><th style={S.th}>기간</th><th style={S.th}>월평균 인원</th>
                    <th style={S.th}>투입 MM</th><th style={S.th}>용역 매출액</th><th style={S.th}>매출액</th><th style={S.th}>Infra(장비) 매출액</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_CRITERIA.map((r) => (
                    <tr key={r.구분}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{r.구분}</td>
                      <td style={S.td}>{r.기간}</td><td style={S.td}>{r.인원}</td><td style={S.td}>{r.mm}</td>
                      <td style={S.td}>{r.용역}</td><td style={S.td}>{r.매출}</td><td style={S.td}>{r.infra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8 }}>
                {SIZE_NOTES.map((n, i) => <p key={i} style={S.note}>※ {n}</p>)}
              </div>
              <p style={{ ...S.note, marginTop: 6 }}>
                ※ 본 시스템의 테일러링 단계에서는 초대형·대형을 "(초)대형"으로 통합하여 3단계(초·대형 / 중형 / 소형)로 적용합니다.
              </p>
            </>
          )}

          {/* 3. 매트릭스 */}
          <div style={S.sectionTitle}>3. 산출물 테일러링 매트릭스 (총 {total}건)</div>
          <div style={S.legend}>
            <span><span style={S.badgeM}>M</span> Mandatory (필수)</span>
            <span><span style={S.badgeO}>O</span> Optional (선택)</span>
            <span><span style={S.badgeNA}>—</span> N/A (해당 없음)</span>
          </div>
          {matrixNote && <p style={{ ...S.note, marginTop: -6, marginBottom: 10 }}>※ {matrixNote}</p>}
          <input
            style={S.searchBox}
            placeholder="산출물 ID / 명칭 / 단계 검색…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={{ ...S.th, textAlign: "left" }}>산출물</th>
                <th style={S.th}>{scaleLabels[0]}</th>
                <th style={S.th}>{scaleLabels[1]}</th>
                <th style={S.th}>{scaleLabels[2]}</th>
                {hasDesignMethod && <th style={S.th}>설계방식</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([phase, rows]) => (
                <React.Fragment key={phase}>
                  <tr><td colSpan={colCount} style={S.phaseHead}>{phase}</td></tr>
                  {rows.map((r) => (
                    <tr key={`${phase}-${r.id}-${r.name}`}>
                      <td style={{ ...S.td, color: "#8892a4", fontFamily: "monospace" }}>{r.id}</td>
                      <td style={S.tdLeft}>{r.name}</td>
                      <td style={S.td}><MOBadge v={r.large} /></td>
                      <td style={S.td}><MOBadge v={r.medium} /></td>
                      <td style={S.td}><MOBadge v={r.small} /></td>
                      {hasDesignMethod && (
                        <td style={S.td}>
                          <span style={S.methodTag}>{r.method || "공통"}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {grouped.length === 0 && (
                <tr><td colSpan={colCount} style={{ ...S.td, color: "#6a7284", padding: 20 }}>검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
