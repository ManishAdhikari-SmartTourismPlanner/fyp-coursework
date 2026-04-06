import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TouristDashboard from './pages/TouristDashboard'
import AgentDashboard from './pages/AgentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import DestinationSearch from './pages/DestinationSearch'
import PackagesBrowse from './pages/PackagesBrowse'
import PackageDetails from './pages/PackageDetails'
import BookingFlow from './pages/BookingFlow'
import ESewaSuccessPage from './pages/ESewaSuccessPage'
import ESewaFailurePage from './pages/ESewaFailurePage'
import MockESewaPayment from './pages/MockESewaPayment'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading"><span className="loading-text">Loading Smart Tourism Planner...</span></div>
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to={`/${user.role}`} replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={`/${user.role}`} replace /> : <RegisterPage />} />
      
      {/* Tourism Pages - Available to authenticated users */}
      <Route path="/destinations" element={<ProtectedRoute><DestinationSearch /></ProtectedRoute>} />
      <Route path="/packages" element={<ProtectedRoute><PackagesBrowse /></ProtectedRoute>} />
      <Route path="/package/:id" element={<ProtectedRoute><PackageDetails /></ProtectedRoute>} />
      <Route path="/booking" element={<ProtectedRoute><BookingFlow /></ProtectedRoute>} />
      
      {/* Payment Callback Pages */}
      <Route path="/payment/esewa-success" element={<ESewaSuccessPage />} />
      <Route path="/payment/esewa-failure" element={<ESewaFailurePage />} />
      <Route path="/payment/mock-esewa" element={<MockESewaPayment />} />
      
      {/* Role-based Dashboards */}
      <Route path="/tourist" element={<ProtectedRoute role="tourist"><TouristDashboard /></ProtectedRoute>} />
      <Route path="/agent" element={<ProtectedRoute role="agent"><AgentDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App

