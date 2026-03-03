function corrColor(value) {
  const v = Math.max(-1, Math.min(1, Number(value || 0)))
  if (v >= 0) {
    const alpha = Math.min(0.82, 0.12 + Math.abs(v) * 0.7)
    return `rgba(30, 64, 175, ${alpha})`
  }
  const alpha = Math.min(0.82, 0.12 + Math.abs(v) * 0.7)
  return `rgba(185, 28, 28, ${alpha})`
}

function textColor(value) {
  return Math.abs(Number(value || 0)) >= 0.55 ? '#ffffff' : '#0f172a'
}

export default function EdaCorrelation({ correlation }) {
  if (!correlation) return null

  const features = correlation.features || []
  const matrix = correlation.matrix || []
  const pairs = correlation.high_correlation_pairs || []
  const heatmapLimit = Math.min(14, features.length)
  const heatmapFeatures = features.slice(0, heatmapLimit)
  const heatmapIndices = heatmapFeatures.map((_, idx) => idx)

  return (
    <section className="section-card soft">
      <h2>상관분석 (Correlation)</h2>
      <p className="section-card-subtitle">
        method: {correlation.method} / 분석 feature 수: {features.length}
      </p>

      {!!heatmapFeatures.length && (
        <div className="section-card">
          <h3>상관 히트맵</h3>
          <p className="helper-text">
            가독성을 위해 상위 {heatmapLimit}개 feature를 표시합니다.
          </p>

          <div className="corr-legend">
            <span className="corr-chip neg">음의 상관 (-1)</span>
            <span className="corr-chip zero">0</span>
            <span className="corr-chip pos">양의 상관 (+1)</span>
          </div>

          <div className="corr-heatmap-wrap">
            <table className="corr-heatmap-table">
              <thead>
                <tr>
                  <th />
                  {heatmapFeatures.map((feature) => (
                    <th key={`h-${feature}`} className="corr-head-cell">{feature}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapFeatures.map((feature, rowIdx) => (
                  <tr key={`r-${feature}`}>
                    <th className="corr-head-cell">{feature}</th>
                    {heatmapIndices.map((colIdx) => {
                      const corr = matrix?.[rowIdx]?.[colIdx] ?? 0
                      return (
                        <td
                          key={`${feature}-${colIdx}`}
                          className="corr-value-cell"
                          style={{ backgroundColor: corrColor(corr), color: textColor(corr) }}
                          title={`${feature} ↔ ${heatmapFeatures[colIdx]}: ${Number(corr).toFixed(4)}`}
                        >
                          {Number(corr).toFixed(2)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section-card">
        <h3>고상관 피처 쌍 Top</h3>
        {pairs.length === 0 ? (
          <p className="helper-text">임계값 이상 상관 쌍이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature A</th>
                  <th>Feature B</th>
                  <th style={{ textAlign: 'right' }}>Corr</th>
                </tr>
              </thead>
              <tbody>
                {pairs.slice(0, 30).map((pair, idx) => (
                  <tr key={`${pair.left}-${pair.right}-${idx}`}>
                    <td>{pair.left}</td>
                    <td>{pair.right}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(pair.corr).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
