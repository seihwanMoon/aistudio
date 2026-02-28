import { useState } from 'react'

export default function AlertSettingsPage() {
  const [threshold, setThreshold] = useState(0.7)
  const [email, setEmail] = useState('qa@example.com')
  const [phone, setPhone] = useState('010-0000-0000')
  const [saved, setSaved] = useState(false)

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>알림 설정</h1>
      <label>임계값: {threshold.toFixed(2)}</label>
      <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: '100%' }} />
      <div>
        <label>수신 이메일</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginLeft: 8 }} />
      </div>
      <div>
        <label>카카오 수신번호</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ marginLeft: 8 }} />
      </div>
      <button type="button" onClick={() => setSaved(true)}>저장</button>
      {saved && <p style={{ color: '#15803d' }}>저장되었습니다.</p>}
    </section>
  )
}
