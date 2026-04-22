import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { requestPasswordReset, resetPasswordWithOtp } from '../services/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!otpStep || !otpExpiresAt) {
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
  }, [otpStep, otpExpiresAt])

  function formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  async function handleRequestReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    try {
      const data = await requestPasswordReset(email)
      setOtpStep(true)
      setChallengeId(data.challenge_id)
      const expiresInSeconds = Number(data.expires_in_seconds || 300)
      setOtpExpiresAt(Date.now() + expiresInSeconds * 1000)
      setInfo(data.message || 'Password reset OTP sent to your email.')
    } catch (err) {
      setError(err.message || 'Failed to request password reset OTP.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    try {
      const data = await resetPasswordWithOtp(challengeId, otpCode, newPassword, confirmPassword)
      setInfo(data.detail || 'Password reset successful. Redirecting to login...')
      setTimeout(() => navigate('/login', { replace: true }), 1600)
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setOtpStep(false)
    setChallengeId('')
    setOtpCode('')
    setNewPassword('')
    setConfirmPassword('')
    setOtpExpiresAt(null)
    setRemainingSeconds(0)
    setError('')
    setInfo('')
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"></div>
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Recover your account with email OTP</p>

        {error && <p className="alert alert-error">{error}</p>}
        {info && <p className="alert alert-success">{info}</p>}

        {!otpStep && (
          <form className="auth-form" onSubmit={handleRequestReset}>
            <div className="form-group">
              <label htmlFor="email">Registered Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
                autoFocus
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send Reset OTP'}
            </button>
          </form>
        )}

        {otpStep && (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <p className="auth-note">
              OTP valid for 5 minutes. Remaining time: <strong>{formatCountdown(remainingSeconds)}</strong>
            </p>

            <div className="form-group">
              <label htmlFor="otp">Reset OTP</label>
              <input
                id="otp"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter OTP"
                required
                maxLength={10}
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading || remainingSeconds === 0}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <button className="btn-secondary" type="button" onClick={handleBack} disabled={loading}>
              Back
            </button>
          </form>
        )}

        <p className="auth-footer">
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </main>
  )
}
