import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import SetupPage from './pages/SetupPage'
import TrainingPage from './pages/TrainingPage'
import ResultsPage from './pages/ResultsPage'
import PredictPage from './pages/PredictPage'
import ModelsPage from './pages/ModelsPage'
import ModelHistoryPage from './pages/ModelHistoryPage'
import RegistryPage from './pages/RegistryPage'
import DriftPage from './pages/DriftPage'
import RealtimePage from './pages/RealtimePage'
import AlertSettingsPage from './pages/AlertSettingsPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={(
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        )}
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/train" element={<SetupPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/predict" element={<PredictPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/model-history" element={<ModelHistoryPage />} />
        <Route path="/registry" element={<RegistryPage />} />
        <Route path="/drift" element={<DriftPage />} />
        <Route path="/realtime" element={<RealtimePage />} />
        <Route path="/alerts" element={<AlertSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
