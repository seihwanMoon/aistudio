function renderCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#dc2626', fontWeight: 600 }}>결측값</span>
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export default function DataPreview({ preview }) {
  if (!preview) return null

  const { columns = [], data = [], missing_counts: missingCounts = {} } = preview

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 8 }}>데이터 미리보기 (상위 100행)</h2>
      <p style={{ margin: '0 0 12px', color: '#4b5563' }}>
        총 {preview.total_rows}행 / {preview.total_columns}열, 인코딩: {preview.encoding || 'xlsx'}
      </p>

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          backgroundColor: 'white',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              {columns.map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 700 }}>{col}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {preview.dtypes?.[col]} · 결측 {missingCounts[col] ?? 0}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col) => {
                  const value = row[col]
                  const isMissing = value === null || value === undefined || value === ''

                  return (
                    <td
                      key={`${rowIdx}-${col}`}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: isMissing ? '#fef2f2' : 'transparent',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderCellValue(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
