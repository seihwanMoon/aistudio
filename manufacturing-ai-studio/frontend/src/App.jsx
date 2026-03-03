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
        <Route path="/upload" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><UploadPage /></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><SetupPage /></ProtectedRoute>} />
        <Route path="/train" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><SetupPage /></ProtectedRoute>} />
        <Route path="/training" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><TrainingPage /></ProtectedRoute>} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/predict" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><PredictPage /></ProtectedRoute>} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/model-history" element={<ModelHistoryPage />} />
        <Route path="/registry" element={<ProtectedRoute allowedRoles={['admin']}><RegistryPage /></ProtectedRoute>} />
        <Route path="/drift" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><DriftPage /></ProtectedRoute>} />
        <Route path="/realtime" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><RealtimePage /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute allowedRoles={['admin']}><AlertSettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
