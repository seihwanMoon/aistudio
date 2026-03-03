import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { getEdaMultivariate } from '../../api/eda.api'

function toPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`
}

function toFixed(value, digits = 4) {
  const n = Number(value)
  if (Number.isNaN(n)) return '-'
  return n.toFixed(digits)
}

function formatPValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'N/A'
  return `${n.toFixed(6)} (${n.toExponential(2)})`
}

function buildHistogramData(distribution) {
  const bins = distribution?.histogram?.bins || []
  const counts = distribution?.histogram?.counts || []
  const stats = distribution?.stats || {}
  if (!bins.length || !counts.length) return []

  const mean = Number(stats.mean || 0)
  const std = Number(stats.std || 0)
  const sampleSize = Number(stats.count || counts.reduce((acc, v) => acc + Number(v || 0), 0))

  return counts.map((count, idx) => {
    const left = Number(bins[idx])
    const right = Number(bins[idx + 1])
    const center = (left + right) / 2
    const binWidth = Math.max(1e-9, right - left)
    let normalCount = 0
    if (std > 1e-12 && sampleSize > 0) {
      const z = (center - mean) / std
      const pdf = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI))
      normalCount = pdf * sampleSize * binWidth
    }

    return {
      range: `[${toFixed(left, 2)} ~ ${toFixed(right, 2)})`,
      center,
      count: Number(count || 0),
      normalCount,
    }
  })
}

function buildQqLineData(qqData) {
  if (!qqData?.length) return []
  const values = qqData.flatMap((item) => [Number(item.theoretical || 0), Number(item.sample || 0)])
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  return [
    { x: minValue, y: minValue },
    { x: maxValue, y: maxValue },
  ]
}

function metricColor(metricName, value) {
  const v = Number(value || 0)
  if (metricName === 'outlier') return '#0284c7'
  if (metricName === 'skew') return v >= 0 ? '#2563eb' : '#ef4444'
  return v >= 0 ? '#0ea5e9' : '#f97316'
}

function normalityReasonLabel(reason) {
  if (reason === 'scipy_unavailable') return '검정 라이브러리 미설치로 p-value 계산을 생략했습니다.'
  if (reason === 'insufficient_samples') return '표본 수가 부족해 검정을 수행할 수 없습니다.'
  if (reason === 'zero_variance') return '분산이 0에 가까워 검정을 수행할 수 없습니다.'
  if (reason === 'test_failed') return '검정 계산 중 오류가 발생했습니다.'
  return 'p ≥ 0.05 이면 정규성 가정 유지'
}

export default function EdaStatistics({ stats, fileId }) {
  const distributions = stats?.numeric_distributions || []
  const categorical = stats?.categorical_distributions || []
  const numericFeatures = stats?.numeric_features || distributions.map((item) => item.feature)
  const [selectedFeature, setSelectedFeature] = useState('')
  const [multiX, setMultiX] = useState('')
  const [multiY, setMultiY] = useState('')
  const [multiZ, setMultiZ] = useState('')
  const [multivariate, setMultivariate] = useState(null)
  const [multivariateLoading, setMultivariateLoading] = useState(false)
  const [multivariateError, setMultivariateError] = useState('')

  useEffect(() => {
    if (!distributions.length) {
      setSelectedFeature('')
      return
    }
    if (!selectedFeature || !distributions.some((item) => item.feature === selectedFeature)) {
      setSelectedFeature(distributions[0].feature)
    }
  }, [distributions, selectedFeature])

  useEffect(() => {
    if (numericFeatures.length < 2) {
      setMultiX('')
      setMultiY('')
      setMultiZ('')
      return
    }
    const featureSet = new Set(numericFeatures)
    const defaultX = featureSet.has(multiX) ? multiX : numericFeatures[0]
    let defaultY = featureSet.has(multiY) && multiY !== defaultX ? multiY : numericFeatures.find((f) => f !== defaultX) || ''
    let defaultZ = featureSet.has(multiZ) ? multiZ : ''
    if (defaultZ === defaultX || defaultZ === defaultY) defaultZ = ''

    if (defaultX !== multiX) setMultiX(defaultX)
    if (defaultY !== multiY) setMultiY(defaultY)
    if (defaultZ !== multiZ) setMultiZ(defaultZ)
  }, [numericFeatures, multiX, multiY, multiZ])

  useEffect(() => {
    async function loadMultivariate() {
      if (!fileId || !multiX || !multiY) {
        setMultivariate(null)
        setMultivariateError('')
        return
      }
      if (multiX === multiY) {
        setMultivariate(null)
        setMultivariateError('X와 Y는 서로 다른 피처를 선택해 주세요.')
        return
      }
      const selected = [multiX, multiY]
      if (multiZ && multiZ !== multiX && multiZ !== multiY) selected.push(multiZ)
      setMultivariateLoading(true)
      try {
        const data = await getEdaMultivariate(fileId, {
          features: selected.join(','),
          max_points: 1200,
          use_cache: true,
        })
        setMultivariate(data)
        setMultivariateError('')
      } catch (error) {
        setMultivariate(null)
        setMultivariateError(error?.response?.data?.detail || '다변량 시각화 데이터를 불러오지 못했습니다.')
      } finally {
        setMultivariateLoading(false)
      }
    }
    loadMultivariate()
  }, [fileId, multiX, multiY, multiZ])

  const selectedDist = useMemo(
    () => distributions.find((item) => item.feature === selectedFeature) || distributions[0] || null,
    [distributions, selectedFeature],
  )

  const histogramData = useMemo(() => buildHistogramData(selectedDist), [selectedDist])
  const qqData = selectedDist?.qq_plot || []
  const qqChartData = useMemo(
    () =>
      qqData
        .map((p) => ({ x: Number(p.theoretical), y: Number(p.sample) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [qqData],
  )
  const qqLine = useMemo(() => buildQqLineData(qqData), [qqData])
  const normality =
    selectedDist?.normality ||
    (stats?.normality_tests || []).find((item) => item.feature === selectedDist?.feature) ||
    null
  const multivariatePoints = multivariate?.points || []
  const has3D = Boolean(multivariate?.axes?.z)
  const zStats = multivariate?.stats?.z || null

  const outlierChart = (stats?.outlier_top || []).slice(0, 8).map((item) => ({
    feature: item.feature,
    value: Number(item.value || 0),
    display: Number(item.value || 0) * 100,
  }))
  const skewChart = (stats?.skewness_top || []).slice(0, 8).map((item) => ({
    feature: item.feature,
    value: Number(item.value || 0),
  }))
  const kurtChart = (stats?.kurtosis_top || []).slice(0, 8).map((item) => ({
    feature: item.feature,
    value: Number(item.value || 0),
  }))

  if (!stats) return null

  return (
    <section className="section-card soft">
      <h2>통계 분석 대시보드</h2>
      <p className="section-card-subtitle">
        분포, 정규성, 이상치, 왜도/첨도를 시각화해 데이터 품질을 빠르게 점검합니다.
      </p>

      <div className="split-grid">
        <div className="metric-card">
          <div className="metric-label">Rows</div>
          <strong>{stats.rows}</strong>
        </div>
        <div className="metric-card">
          <div className="metric-label">Numeric Features</div>
          <strong>{stats.numeric_feature_count}</strong>
        </div>
        <div className="metric-card">
          <div className="metric-label">Categorical Features</div>
          <strong>{stats.categorical_feature_count}</strong>
        </div>
      </div>

      {!!distributions.length && (
        <div className="section-card">
          <h3>분포 히스토그램 + 정규곡선</h3>
          <div className="pill-row">
            {distributions.map((item) => (
              <button
                key={item.feature}
                type="button"
                className={selectedDist?.feature === item.feature ? 'pill-button is-active' : 'pill-button'}
                onClick={() => setSelectedFeature(item.feature)}
              >
                {item.feature}
              </button>
            ))}
          </div>

          {selectedDist && (
            <>
              <div className="split-grid">
                <div className="metric-card">
                  <div className="metric-label">평균 / 표준편차</div>
                  <strong>{toFixed(selectedDist.stats?.mean)} / {toFixed(selectedDist.stats?.std)}</strong>
                </div>
                <div className="metric-card">
                  <div className="metric-label">왜도 / 첨도</div>
                  <strong>{toFixed(selectedDist.stats?.skew)} / {toFixed(selectedDist.stats?.kurtosis)}</strong>
                </div>
                <div className="metric-card">
                  <div className="metric-label">IQR 이상치 비율</div>
                  <strong>{toPercent(selectedDist.stats?.outlier_ratio_iqr)}</strong>
                </div>
              </div>

              <div className="chart-frame" style={{ minHeight: 320 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={histogramData} margin={{ top: 12, right: 16, left: 4, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" interval={Math.max(0, Math.floor(histogramData.length / 8))} angle={-20} textAnchor="end" height={58} />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'normalCount') return [toFixed(value, 2), '정규분포 기대빈도']
                        return [value, '실제 빈도']
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" name="빈도" fill="#60a5fa" />
                    <Line
                      type="monotone"
                      dataKey="normalCount"
                      name="정규분포 기대빈도"
                      stroke="#b91c1c"
                      dot={false}
                      strokeWidth={2}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="section-card">
                <h3>QQ Plot + 정규성 검정</h3>
                <div className="split-grid">
                  <div className="metric-card">
                    <div className="metric-label">Shapiro p-value</div>
                    <strong>{formatPValue(normality?.shapiro?.p_value)}</strong>
                    <div className="helper-text">{normalityReasonLabel(normality?.reason)}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">KS p-value</div>
                    <strong>{formatPValue(normality?.ks?.p_value)}</strong>
                    <div className="helper-text">표준화 후 정규분포와의 차이 검정</div>
                  </div>
                </div>

                <div className="chart-frame" style={{ minHeight: 300 }}>
                  {qqChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart margin={{ top: 10, right: 18, left: 8, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name="이론분위수" />
                        <YAxis type="number" dataKey="y" name="표본분위수" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="QQ points" data={qqChartData} fill="#2563eb" />
                        {qqLine.length === 2 && (
                          <ReferenceLine
                            segment={qqLine}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                          />
                        )}
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty">QQ Plot 데이터를 생성할 수 없습니다.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {numericFeatures.length >= 2 && (
        <div className="section-card">
          <h3>2/3변수 선택 시각화</h3>
          <p className="section-card-subtitle">
            X, Y는 필수이며 Z 선택 시 버블 크기로 3번째 변수를 함께 표현합니다.
          </p>
          <div className="form-row" style={{ marginTop: 10 }}>
            <label>
              X
              <select value={multiX} onChange={(event) => setMultiX(event.target.value)} style={{ marginLeft: 8, minWidth: 160 }}>
                {numericFeatures.map((feature) => (
                  <option key={`x-${feature}`} value={feature}>{feature}</option>
                ))}
              </select>
            </label>
            <label>
              Y
              <select value={multiY} onChange={(event) => setMultiY(event.target.value)} style={{ marginLeft: 8, minWidth: 160 }}>
                {numericFeatures.map((feature) => (
                  <option key={`y-${feature}`} value={feature}>{feature}</option>
                ))}
              </select>
            </label>
            <label>
              Z(선택)
              <select value={multiZ} onChange={(event) => setMultiZ(event.target.value)} style={{ marginLeft: 8, minWidth: 160 }}>
                <option value="">없음</option>
                {numericFeatures.map((feature) => (
                  <option key={`z-${feature}`} value={feature}>{feature}</option>
                ))}
              </select>
            </label>
          </div>

          {multivariateError && <p className="notice error">{multivariateError}</p>}

          <div className="chart-frame" style={{ minHeight: 340, marginTop: 10 }}>
            {multivariateLoading ? (
              <div className="chart-empty">다변량 시각화 데이터를 불러오는 중입니다...</div>
            ) : multivariatePoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 18, left: 8, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name={multivariate?.axes?.x || 'X'} />
                  <YAxis type="number" dataKey="y" name={multivariate?.axes?.y || 'Y'} />
                  {has3D && (
                    <ZAxis
                      type="number"
                      dataKey="z"
                      name={multivariate?.axes?.z || 'Z'}
                      range={[64, 360]}
                    />
                  )}
                  <Tooltip
                    formatter={(value, name) => [toFixed(value, 6), name]}
                    labelFormatter={() => ''}
                  />
                  <Scatter name={has3D ? '3변수 버블' : '2변수 산점도'} data={multivariatePoints} fill="#2563eb" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">선택한 피처 조합에서 시각화 가능한 데이터가 없습니다.</div>
            )}
          </div>

          {!!multivariate && (
            <div className="split-grid">
              <div className="metric-card">
                <div className="metric-label">유효 행 / 샘플링 행</div>
                <strong>{multivariate.rows_valid} / {multivariate.rows_sampled}</strong>
              </div>
              <div className="metric-card">
                <div className="metric-label">축 정보</div>
                <strong>
                  X: {multivariate?.axes?.x} / Y: {multivariate?.axes?.y}
                  {has3D ? ` / Z: ${multivariate?.axes?.z}` : ''}
                </strong>
              </div>
              <div className="metric-card">
                <div className="metric-label">Z 분포(선택 시)</div>
                <strong>{zStats ? `${toFixed(zStats.min, 3)} ~ ${toFixed(zStats.max, 3)}` : '-'}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="section-card">
        <h3>이상치/왜도/첨도: 수치 + 그래프</h3>
        <div className="split-grid">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th style={{ textAlign: 'right' }}>이상치(%)</th>
                </tr>
              </thead>
              <tbody>
                {outlierChart.map((item) => (
                  <tr key={`out-${item.feature}`}>
                    <td>{item.feature}</td>
                    <td style={{ textAlign: 'right' }}>{toPercent(item.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-frame" style={{ minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={outlierChart} layout="vertical" margin={{ left: 28, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `${toFixed(v, 1)}%`} />
                <YAxis dataKey="feature" type="category" width={90} />
                <Tooltip formatter={(v) => `${toFixed(v, 3)}%`} />
                <Bar dataKey="display" fill={metricColor('outlier', 1)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="split-grid">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th style={{ textAlign: 'right' }}>왜도</th>
                </tr>
              </thead>
              <tbody>
                {skewChart.map((item) => (
                  <tr key={`sk-${item.feature}`}>
                    <td>{item.feature}</td>
                    <td style={{ textAlign: 'right' }}>{toFixed(item.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-frame" style={{ minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={skewChart} layout="vertical" margin={{ left: 28, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="feature" type="category" width={90} />
                <Tooltip formatter={(v) => toFixed(v, 6)} />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="split-grid">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th style={{ textAlign: 'right' }}>첨도</th>
                </tr>
              </thead>
              <tbody>
                {kurtChart.map((item) => (
                  <tr key={`ku-${item.feature}`}>
                    <td>{item.feature}</td>
                    <td style={{ textAlign: 'right' }}>{toFixed(item.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-frame" style={{ minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={kurtChart} layout="vertical" margin={{ left: 28, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="feature" type="category" width={90} />
                <Tooltip formatter={(v) => toFixed(v, 6)} />
                <Bar dataKey="value" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {!!categorical.length && (
        <div className="section-card">
          <h3>범주형 분포 Top</h3>
          {categorical.map((item) => (
            <div key={item.feature} className="category-block">
              <p className="category-title">
                {item.feature}
                <span className="badge" style={{ marginLeft: 8 }}>unique {item.unique_count}</span>
              </p>
              {(item.top_values || []).map((entry) => (
                <div className="histogram-item" key={`${item.feature}-${entry.label}`}>
                  <div className="histogram-label">{entry.label}</div>
                  <div className="histogram-track">
                    <div className="histogram-fill" style={{ width: `${Math.max(2, Number(entry.ratio || 0) * 100)}%` }} />
                  </div>
                  <div className="histogram-value">{entry.count}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
