export default function EdaTargetInsight({
  columns = [],
  targetColumn = '',
  onChangeTarget,
  insight,
  isLoading = false,
}) {
  if (!columns.length) return null

  const related = insight?.top_related_features || []
  const maxScore = related.length ? Math.max(...related.map((item) => Number(item.abs_score || 0))) : 0
  const targetSummary = insight?.target_summary

  return (
    <section style={{ marginTop: 20, border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, backgroundColor: '#fff' }}>
      <h3 style={{ margin: 0 }}>타겟 인사이트 (EDA)</h3>
      <p style={{ margin: '6px 0 12px', color: '#4b5563', fontSize: 14 }}>
        타겟 기준으로 연관도가 높은 피처를 자동 분석합니다.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <label htmlFor="eda-target-column" style={{ fontWeight: 700 }}>타겟 컬럼</label>
        <select
          id="eda-target-column"
          value={targetColumn}
          onChange={(e) => onChangeTarget?.(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', minWidth: 220 }}
        >
          {columns.map((column) => (
            <option key={column} value={column}>{column}</option>
          ))}
        </select>
        {insight?.task_type && (
          <span style={{ padding: '4px 8px', borderRadius: 999, backgroundColor: '#f3f4f6', fontSize: 13 }}>
            task: {insight.task_type}
          </span>
        )}
      </div>

      {isLoading && <p style={{ color: '#6b7280' }}>타겟 인사이트 계산 중...</p>}

      {!isLoading && targetSummary?.type === 'regression' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <small>mean: {Number(targetSummary.mean || 0).toFixed(4)}</small>
          <small>std: {Number(targetSummary.std || 0).toFixed(4)}</small>
          <small>min: {Number(targetSummary.min || 0).toFixed(4)}</small>
          <small>max: {Number(targetSummary.max || 0).toFixed(4)}</small>
        </div>
      )}

      {!isLoading && targetSummary?.type === 'classification' && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>타겟 클래스 분포</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(targetSummary.class_distribution || []).slice(0, 8).map((item) => (
              <span key={item.label} style={{ border: '1px solid #d1d5db', borderRadius: 999, padding: '4px 8px', fontSize: 13 }}>
                {item.label}: {item.count} ({(Number(item.ratio || 0) * 100).toFixed(1)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {!isLoading && related.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>타겟 연관 Top Features</p>
          {related.map((item) => {
            const ratio = maxScore > 0 ? Number(item.abs_score || 0) / maxScore : 0
            return (
              <div key={item.feature} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{item.feature}</span>
                  <span style={{ color: '#4b5563', fontSize: 13 }}>
                    {item.method}: {Number(item.score || 0).toFixed(4)}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(4, ratio * 100)}%`, height: '100%', backgroundColor: '#0ea5e9' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && insight?.warnings?.length > 0 && (
        <p style={{ marginTop: 10, color: '#92400e', fontSize: 13 }}>
          {insight.warnings.join(' / ')}
        </p>
      )}
    </section>
  )
}
