export default function EdaCorrelation({ correlation }) {
  if (!correlation) return null

  const pairs = correlation.high_correlation_pairs || []

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ marginBottom: 8 }}>상관분석 (Correlation)</h2>
      <p style={{ margin: '0 0 10px', color: '#4b5563' }}>
        method: {correlation.method} / 분석 feature 수: {correlation.features?.length ?? 0}
      </p>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>고상관 피처 쌍 Top</h3>
        {pairs.length === 0 ? (
          <p style={{ color: '#4b5563' }}>임계값 이상 상관 쌍이 없습니다.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Feature A</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Feature B</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Corr</th>
              </tr>
            </thead>
            <tbody>
              {pairs.slice(0, 20).map((pair, idx) => (
                <tr key={`${pair.left}-${pair.right}-${idx}`}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{pair.left}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{pair.right}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 700 }}>
                    {Number(pair.corr).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
