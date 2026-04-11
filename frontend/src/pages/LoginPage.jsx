import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginWithUsername, verifyTouristOtp } from '../services/auth'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [otpCode, setOtpCode] = useState('')
  const [otpChallengeId, setOtpChallengeId] = useState('')
  const [otpRequired, setOtpRequired] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
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
    setInfo('')
    try {
      const data = await loginWithUsername(form.username, form.password)
      if (data.otp_required) {
        setOtpRequired(true)
        setOtpChallengeId(data.challenge_id)
        const baseMessage = data.message || 'OTP sent to your email. Enter it to continue.'
        const debugMessage = data.debug_otp ? `${baseMessage} Dev OTP: ${data.debug_otp}` : baseMessage
        setInfo(debugMessage)
        return
      }

      setUser(data.user)
      navigate(`/${data.user.role}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Check your username and password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const data = await verifyTouristOtp(otpChallengeId, otpCode)
      setUser(data.user)
      navigate(`/${data.user.role}`, { replace: true })
    } catch (err) {
      setError(err.message || 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleBackToLogin() {
    setOtpRequired(false)
    setOtpChallengeId('')
    setOtpCode('')
    setInfo('')
    setError('')
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"></div>
        <h1 className="auth-title">Smart Tourism Planner</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {error && <p className="alert alert-error">{error}</p>}
        {info && <p className="alert alert-success">{info}</p>}

        {!otpRequired && (
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
        )}

        {otpRequired && (
          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label htmlFor="otp">Email OTP</label>
              <input
                id="otp"
                name="otp"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                required
                maxLength={10}
                autoFocus
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button className="btn-secondary" type="button" disabled={loading} onClick={handleBackToLogin}>
              Back
            </button>
          </form>
        )}

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

