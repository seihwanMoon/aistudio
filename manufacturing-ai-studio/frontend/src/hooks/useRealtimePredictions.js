import { useCallback, useEffect, useRef, useState } from 'react'

export function useRealtimePredictions(maxItems = 200) {
  const [predictions, setPredictions] = useState([])
  const [latestBatch, setLatestBatch] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef(null)
  const pingRef = useRef(null)

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    wsRef.current = new WebSocket(`${wsUrl}/ws/predictions`)

    wsRef.current.onopen = () => {
      setIsConnected(true)
      pingRef.current = setInterval(() => {
        wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send('ping')
      }, 15000)
    }

    wsRef.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'batch_prediction') {
          setLatestBatch(payload)
          setPredictions((prev) => [...payload.predictions, ...prev].slice(0, maxItems))
          if (payload.alert_level === 'danger') {
            setAlerts((prev) => [payload, ...prev].slice(0, 50))
          }
        }
      } catch {
        // no-op
      }
    }

    wsRef.current.onclose = () => {
      setIsConnected(false)
      if (pingRef.current) clearInterval(pingRef.current)
    }
  }, [maxItems])

  useEffect(() => {
    connect()
    return () => {
      if (pingRef.current) clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { predictions, latestBatch, alerts, isConnected }
}
