import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function RealtimeChart({ predictions = [] }) {
  const chartData = predictions.slice(0, 60).map((row, idx) => ({
    idx,
    probability: row.probability ?? 0,
  }))

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="idx" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Line dataKey="probability" stroke="#ef4444" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
