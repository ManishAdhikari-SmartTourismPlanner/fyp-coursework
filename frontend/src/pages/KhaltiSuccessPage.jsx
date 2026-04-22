import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { verifyKhaltiPayment } from '../services/tourism'
import '../styles/payment-callback.css'

export default function KhaltiSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Verifying your Khalti payment...')
  const [bookingCode, setBookingCode] = useState('')

  useEffect(() => {
    processPayment()
  }, [])

  async function processPayment() {
    try {
      const pidx = searchParams.get('pidx')
      if (!pidx) {
        setStatus('error')
        setMessage('Missing Khalti payment reference (pidx).')
        return
      }

      const result = await verifyKhaltiPayment(pidx)
      if (result.success) {
        setStatus('success')
        setMessage('Khalti payment successful. Your booking is confirmed.')
        setBookingCode(result.booking_code)
        setTimeout(() => navigate(`/booking-confirmation?code=${result.booking_code}`), 2500)
      } else {
        setStatus('error')
        setMessage(result.message || result.error || 'Khalti payment verification failed.')
      }
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Error verifying Khalti payment.')
    }
  }

  return (
    <div className="payment-callback-page">
      <div className="callback-container">
        <div className={`callback-card ${status}`}>
          <div className="callback-icon">
            {status === 'processing' && <span className="spinner"></span>}
            {status === 'success' && <span className="success-icon"></span>}
            {status === 'error' && <span className="error-icon">x</span>}
          </div>

          <h1 className="callback-title">
            {status === 'processing' && 'Processing Khalti Payment'}
            {status === 'success' && 'Payment Successful!'}
            {status === 'error' && 'Payment Failed'}
          </h1>

          <p className="callback-message">{message}</p>

          {bookingCode && (
            <div className="booking-info">
              <p>Your booking code: <code>{bookingCode}</code></p>
              <p className="info-text">Redirecting to your dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="error-actions">
              <button className="btn-primary" onClick={() => navigate('/booking')}>
                Try Again
              </button>
              <button className="btn-secondary" onClick={() => navigate('/tourist')}>
                Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
