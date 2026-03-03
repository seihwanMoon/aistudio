function toPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

function qualityColor(score) {
  if (score >= 85) return '#166534'
  if (score >= 70) return '#1d4ed8'
  if (score >= 50) return '#b45309'
  return '#b91c1c'
}

export default function EdaOverview({ summary }) {
  if (!summary) return null

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 8 }}>EDA 요약</h2>
      <p style={{ margin: '0 0 12px', color: '#4b5563' }}>
        데이터 품질 점수: <strong style={{ color: qualityColor(summary.quality_score) }}>{summary.quality_score}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>행 / 열</div>
          <strong>{summary.rows} / {summary.columns}</strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>결측 비율</div>
          <strong>{toPercent(summary.missing_overall_ratio)}</strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>중복 비율</div>
          <strong>{toPercent(summary.duplicate_ratio)}</strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>타입 분포</div>
          <strong>
            숫자 {summary.type_counts?.numeric ?? 0} / 범주 {summary.type_counts?.categorical ?? 0}
          </strong>
        </div>
      </div>

      <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>결측 Top 10</h3>
        {(summary.missing_top || []).length === 0 && <p style={{ color: '#4b5563' }}>결측 컬럼이 없습니다.</p>}
        {(summary.missing_top || []).map((item) => (
          <div key={item.column} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{item.column}</span>
              <strong>{toPercent(item.missing_ratio)}</strong>
            </div>
            <div style={{ height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(2, Math.min(100, (item.missing_ratio || 0) * 100))}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {(summary.warnings || []).length > 0 && (
        <div style={{ marginTop: 12, border: '1px solid #fde68a', borderRadius: 10, padding: 12, backgroundColor: '#fffbeb' }}>
          <h3 style={{ marginTop: 0 }}>데이터 경고</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.warnings.slice(0, 8).map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
