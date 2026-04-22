import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logoutSession } from '../services/auth'

export default function Navbar() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await logoutSession()
    } finally {
      setUser(null)
      setLoading(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand"> Smart Tourism Planner</div>
      <div className="navbar-user">
        <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
        <span className="navbar-username">{user?.username}</span>
        <button className="btn-secondary" onClick={() => navigate('/profile')}>
          Profile
        </button>
        <button className="btn-logout" onClick={handleLogout} disabled={loading}>
          {loading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </nav>
  )
}

