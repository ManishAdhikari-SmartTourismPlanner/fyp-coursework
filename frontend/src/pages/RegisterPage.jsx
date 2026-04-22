import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerTourist, verifyRegistrationOtp } from '../services/auth'

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '' })
  const [otpCode, setOtpCode] = useState('')
  const [otpChallengeId, setOtpChallengeId] = useState('')
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function updateField(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  useEffect(() => {
    if (!otpRequired || !otpExpiresAt) {
      setRemainingSeconds(0)
      return
    }

    function tick() {
      const seconds = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000))
      setRemainingSeconds(seconds)
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [otpRequired, otpExpiresAt])

  function formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const data = await registerTourist(form)
      setOtpRequired(true)
      setOtpChallengeId(data.challenge_id)
      const expiresInSeconds = Number(data.expires_in_seconds || 300)
      setOtpExpiresAt(Date.now() + expiresInSeconds * 1000)
      setInfo(data.message || 'Registration OTP sent to your email. Enter it to continue.')
    } catch (err) {
      setError(err.message || 'Registration failed.')
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
      await verifyRegistrationOtp(otpChallengeId, otpCode, { autoLogin: false })
      navigate('/login', {
        replace: true,
        state: { message: 'Registration verified. Please login to continue.' },
      })
    } catch (err) {
      setError(err.message || 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleBackToRegister() {
    setOtpRequired(false)
    setOtpChallengeId('')
    setOtpExpiresAt(null)
    setOtpCode('')
    setInfo('')
    setError('')
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"></div>
        <h1 className="auth-title">Smart Tourism Planner</h1>
        <p className="auth-subtitle">Create your tourist account</p>

        {error && <p className="alert alert-error">{error}</p>}
        {info && <p className="alert alert-success">{info}</p>}

        {!otpRequired && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={updateField}
                placeholder="Choose a username"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password <span className="hint">(min. 8 characters)</span></label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                placeholder="Choose a password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm_password">Confirm Password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={updateField}
                placeholder="Repeat your password"
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Register as Tourist'}
            </button>
          </form>
        )}

        {otpRequired && (
          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <p className="auth-note">
              OTP valid for 5 minutes. Remaining time: <strong>{formatCountdown(remainingSeconds)}</strong>
            </p>
            <div className="form-group">
              <label htmlFor="otp">Registration OTP</label>
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
            <button className="btn-primary" type="submit" disabled={loading || remainingSeconds === 0}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button className="btn-secondary" type="button" disabled={loading} onClick={handleBackToRegister}>
              Back
            </button>
          </form>
        )}

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </main>
  )
}

