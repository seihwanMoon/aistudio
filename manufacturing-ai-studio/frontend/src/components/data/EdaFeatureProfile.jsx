function toPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

export default function EdaFeatureProfile({ columns = [], selectedFeature = '', onChangeFeature, profile }) {
  if (!columns.length) return null

  const histogram = profile?.histogram
  const maxCount = Math.max(1, ...(histogram?.counts || [1]))

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ marginBottom: 8 }}>피처 프로필</h2>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <div style={{ marginBottom: 10 }}>
          <label htmlFor="eda-feature-select" style={{ marginRight: 8, fontWeight: 600 }}>분석 피처</label>
          <select
            id="eda-feature-select"
            value={selectedFeature}
            onChange={(e) => onChangeFeature(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
          >
            {columns.map((column) => (
              <option key={column} value={column}>{column}</option>
            ))}
          </select>
        </div>

        {!profile ? (
          <p style={{ color: '#4b5563' }}>피처 프로필을 불러오는 중입니다.</p>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', color: '#4b5563' }}>
              dtype: {profile.dtype} / 결측: {profile.missing_count} ({toPercent(profile.missing_ratio)}) / unique: {profile.unique_count}
            </p>

            {profile.numeric_stats && (
              <>
                <h4 style={{ margin: '8px 0' }}>수치 통계</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {Object.entries(profile.numeric_stats).map(([key, value]) => (
                      <tr key={key}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', width: 180 }}>{key}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 700 }}>
                          {Number(value).toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <ul style={{ margin: 0, paddingLeft: 18 }}>
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
