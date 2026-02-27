import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import TrainPage from './pages/TrainPage'
import PredictPage from './pages/PredictPage'
import ModelsPage from './pages/ModelsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/train" element={<TrainPage />} />
        <Route path="/predict" element={<PredictPage />} />
        <Route path="/models" element={<ModelsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
