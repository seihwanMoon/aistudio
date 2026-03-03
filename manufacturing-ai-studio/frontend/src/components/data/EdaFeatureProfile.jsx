function toPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

export default function EdaFeatureProfile({ columns = [], selectedFeature = '', onChangeFeature, profile }) {
  if (!columns.length) return null

  const histogram = profile?.histogram
  const maxCount = Math.max(1, ...(histogram?.counts || [1]))

  return (
    <section className="section-card soft">
      <h2>피처 프로필</h2>
      <div className="section-card">
        <div className="actions-row" style={{ marginBottom: 10 }}>
          <label htmlFor="eda-feature-select" style={{ marginRight: 8, fontWeight: 600 }}>분석 피처</label>
          <select
            id="eda-feature-select"
            value={selectedFeature}
            onChange={(e) => onChangeFeature(e.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>{column}</option>
            ))}
          </select>
        </div>

        {!profile ? (
          <p className="helper-text">피처 프로필을 불러오는 중입니다.</p>
        ) : (
          <>
            <p className="section-card-subtitle">
              dtype: {profile.dtype} / 결측: {profile.missing_count} ({toPercent(profile.missing_ratio)}) / unique: {profile.unique_count}
            </p>

            {profile.numeric_stats && (
              <>
                <h4 style={{ margin: '8px 0' }}>수치 통계</h4>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {Object.entries(profile.numeric_stats).map(([key, value]) => (
                        <tr key={key}>
                          <td style={{ width: 180 }}>{key}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {Number(value).toFixed(6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {histogram && (
              <>
                <h4 style={{ margin: '12px 0 8px' }}>히스토그램</h4>
                {histogram.counts.map((count, idx) => (
                  <div key={idx} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4b5563' }}>
                      <span>
                        [{Number(histogram.bins[idx]).toFixed(3)} ~ {Number(histogram.bins[idx + 1]).toFixed(3)})
                      </span>
                      <strong>{count}</strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(3, Math.min(100, (count / maxCount) * 100))}%`,
                          backgroundColor: '#0ea5e9',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}

            {Array.isArray(profile.top_values) && profile.top_values.length > 0 && (
              <>
                <h4 style={{ margin: '12px 0 8px' }}>범주 빈도 Top</h4>
                <ul className="log-list">
                  {profile.top_values.slice(0, 15).map((item) => (
                    <li key={`${item.value}-${item.count}`}>{item.value}: {item.count}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
