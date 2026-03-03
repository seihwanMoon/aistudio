function renderCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return <span className="badge" style={{ color: '#b91c1c' }}>결측값</span>
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export default function DataPreview({ preview }) {
  if (!preview) return null

  const { columns = [], data = [], missing_counts: missingCounts = {} } = preview
  const dataRef = preview.data_ref || preview.data_id || preview.file_id || '-'
  const dataName = preview.data_name || preview.filename || '-'

  return (
    <section className="section-card soft">
      <h2>데이터 미리보기 (상위 100행)</h2>
      <p className="section-card-subtitle">
        총 {preview.total_rows}행 / {preview.total_columns}열, 인코딩: {preview.encoding || 'xlsx'}
      </p>
      <p className="helper-text">
        데이터명: {dataName} / 데이터 식별자: {dataRef}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>
                  <div>{col}</div>
                  <div className="helper-text" style={{ margin: 0 }}>
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
                        backgroundColor: isMissing ? '#fef2f2' : 'transparent',
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
