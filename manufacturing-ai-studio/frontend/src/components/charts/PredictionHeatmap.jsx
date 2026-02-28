export default function PredictionHeatmap({ predictions = [] }) {
  const matrix = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => 0))
  predictions.slice(0, 24).forEach((p, idx) => {
    const r = Math.floor(idx / 4)
    const c = idx % 4
    matrix[r][c] = p.probability ?? 0
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {matrix.flatMap((row, r) => row.map((v, c) => (
        <div
          key={`${r}-${c}`}
          style={{
            padding: 14,
            borderRadius: 8,
            textAlign: 'center',
            backgroundColor: `rgba(239,68,68,${Math.min(1, v)})`,
            color: v > 0.6 ? '#fff' : '#111827',
          }}
        >
          {(v * 100).toFixed(0)}%
        </div>
      )))}
    </div>
  )
}
