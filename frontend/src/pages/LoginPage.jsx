import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginWithUsername } from '../services/auth'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  function updateField(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await loginWithUsername(form.username, form.password)
      setUser(data.user)
      navigate(`/${data.user.role}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Check your username and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"></div>
        <h1 className="auth-title">Smart Tourism Planner</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {error && <p className="alert alert-error">{error}</p>}

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={updateField}
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder="Enter your password"
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="auth-footer">
          New tourist? <Link to="/register">Create account</Link>
        </p>
        <p className="auth-note">
          Agents and Admins login with credentials provided by admin.
        </p>
      </div>
    </main>
  )
}

