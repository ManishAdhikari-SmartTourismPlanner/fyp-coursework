import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { handleESewaCallback } from '../services/tourism'
import '../styles/payment-callback.css'

export default function ESewaSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing') // processing, success, error
  const [message, setMessage] = useState('Verifying your eSewa payment...')
  const [bookingCode, setBookingCode] = useState('')

  useEffect(() => {
    processPayment()
  }, [])

  async function processPayment() {
    try {
      const params = Object.fromEntries(searchParams)
      
      if (!params.refId) {
        setStatus('error')
        setMessage('Invalid payment response from eSewa')
        return
      }

      // Call backend to verify payment
      const result = await handleESewaCallback(params)
      
      if (result.success) {
        setStatus('success')
        setMessage('Payment Successful! Your booking is confirmed.')
        setBookingCode(result.booking_code)
        
        // Redirect to booking confirmation after 3 seconds
        setTimeout(() => {
          navigate(`/booking-confirmation?code=${result.booking_code}`)
        }, 3000)
      } else {
        setStatus('error')
        setMessage(result.error || 'Payment verification failed. Please contact support.')
      }
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Error processing payment callback')
    }
  }

  return (
    <div className="payment-callback-page">
      <div className="callback-container">
        <div className={`callback-card ${status}`}>
          <div className="callback-icon">
            {status === 'processing' && <span className="spinner"></span>}
            {status === 'success' && <span className="success-icon"></span>}
            {status === 'error' && <span className="error-icon">|</span>}
          </div>

          <h1 className="callback-title">
            {status === 'processing' && 'Processing Payment'}
            {status === 'success' && 'Payment Successful!'}
            {status === 'error' && 'Payment Failed'}
          </h1>

          <p className="callback-message">{message}</p>

          {bookingCode && (
            <div className="booking-info">
              <p>Your booking code: <code>{bookingCode}</code></p>
              <p className="info-text">You will be redirected to your booking confirmation shortly...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="error-actions">
              <button className="btn-primary" onClick={() => navigate(-1)}>
                Go Back
              </button>
              <button className="btn-secondary" onClick={() => navigate('/')}>
                Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

