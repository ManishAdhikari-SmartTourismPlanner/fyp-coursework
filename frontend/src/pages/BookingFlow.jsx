import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createBooking, initiateKhaltiPayment, cancelBooking } from '../services/tourism'
import { useAuth } from '../context/AuthContext'

export default function BookingFlowPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  const bookingState = location.state || {}
  const {
    packageId,
    packageTitle,
    packageAgentId,
    packageAgentName,
    departureId,
    departureDate,
    price,
    travelersCount,
  } = bookingState

  const [step, setStep] = useState('details') // details  payment  confirmation
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingCode, setBookingCode] = useState('')
  const [bookingId, setBookingId] = useState(null)
  const [paymentDueAt, setPaymentDueAt] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())

  const [booking, setBooking] = useState({
    special_request: '',
    payment_method: 'khalti',
  })

  const totalAmount = price * travelersCount

  useEffect(() => {
    if (!paymentDueAt || step === 'confirmation') {
      return undefined
    }

    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(id)
  }, [paymentDueAt, step])

  const remainingMs = useMemo(() => {
    if (!paymentDueAt) {
      return 0
    }
    const due = new Date(paymentDueAt).getTime()
    return Math.max(0, due - nowMs)
  }, [paymentDueAt, nowMs])

  const isPaymentExpired = Boolean(paymentDueAt) && remainingMs <= 0
  const remainingMinutes = Math.floor(remainingMs / 60000)
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)

  useEffect(() => {
    async function expireIfNeeded() {
      if (!isPaymentExpired || !bookingId || step === 'confirmation') {
        return
      }
      setError('Payment window expired. Your booking has been cancelled automatically.')
      try {
        await cancelBooking(bookingId)
      } catch {
        // Backend may have already auto-cancelled.
      }
      setStep('details')
    }

    expireIfNeeded()
  }, [isPaymentExpired, bookingId, step])

  async function handleCreateBooking() {
    setLoading(true)
    setError('')
    try {
      const payload = {
        package_id: packageId,
        departure_id: departureId,
        travelers_count: travelersCount,
        special_request: booking.special_request,
        total_amount_npr: totalAmount,
      }
      
      const result = await createBooking(payload)
      setBookingCode(result.booking_code)
      setBookingId(result.id)
      
      setPaymentDueAt(result.payment_due_at || '')
      setStep('payment')
    } catch (err) {
      setError(err.message || 'Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  async function handleProcessPayment() {
    // Khalti hosted checkout flow
    if (isPaymentExpired) {
      setError('Payment window has expired. Please create a new booking.')
      return
    }

    if (!bookingId) {
      setError('Booking ID not found. Please try again.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await initiateKhaltiPayment(bookingId, totalAmount)
      if (result.payment_url) {
        window.location.href = result.payment_url
      } else {
        setError('Failed to start Khalti payment. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment')
    } finally {
      setLoading(false)
    }
  }

  async function handleManualCancel() {
    if (!bookingId) {
      return
    }

    if (isPaymentExpired) {
      setError('Payment window has already expired.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await cancelBooking(bookingId)
      setError('Booking cancelled successfully within 5-minute payment window.')
      setStep('details')
      setBookingCode('')
      setBookingId(null)
      setPaymentDueAt('')
    } catch (err) {
      setError(err.message || 'Failed to cancel booking')
    } finally {
      setLoading(false)
    }
  }

  if (!packageId) {
    return (
      <div className="dashboard">
        <div className="alert alert-error">Invalid booking state. Please start from destination search.</div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <button className="btn-back" onClick={() => navigate(-1)}> Back</button>

        <div className="booking-header">
          <h1> Complete Your Booking</h1>
          <div className="booking-steps">
            <div className={`step ${step === 'details' ? 'active' : step !== 'details' ? 'completed' : ''}`}>
              1. Details
            </div>
            <div className={`step ${step === 'payment' ? 'active' : step === 'confirmation' ? 'completed' : ''}`}>
              2. Payment
            </div>
            <div className={`step ${step === 'confirmation' ? 'active' : ''}`}>
              3. Confirmation
            </div>
          </div>
        </div>

        <div className="booking-content">
          {/* Step 1: Booking Details */}
          {step === 'details' && (
            <div className="booking-form-section">
              <div className="form-card">
                <h3> Booking Details</h3>
                
                <div className="booking-summary">
                  <div className="summary-item">
                    <strong>Package:</strong> {packageTitle}
                  </div>
                  <div className="summary-item">
                    <strong>Agent:</strong> {packageAgentName || packageAgentId || 'Travel agency'}
                  </div>
                  <div className="summary-item">
                    <strong>Departure:</strong> {new Date(departureDate).toLocaleDateString()}
                  </div>
                  <div className="summary-item">
                    <strong>Travelers:</strong> {travelersCount}
                  </div>
                  <div className="summary-item">
                    <strong>Price per person:</strong> NPR {price?.toLocaleString()}
                  </div>
                  <div className="summary-item total">
                    <strong>Total Amount:</strong> NPR {totalAmount.toLocaleString()}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="special_request">Special Requests (Optional)</label>
                  <textarea
                    id="special_request"
                    value={booking.special_request}
                    onChange={(e) => setBooking({ ...booking, special_request: e.target.value })}
                    placeholder="e.g., Dietary restrictions, accessibility needs, etc."
                    rows="4"
                    className="textarea-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payment_method">Payment Method</label>
                  <select
                    id="payment_method"
                    value={booking.payment_method}
                    onChange={(e) => setBooking({ ...booking, payment_method: e.target.value })}
                    className="filter-select"
                  >
                    <option value="khalti">Khalti (Online)</option>
                  </select>
                </div>

                <div className="booking-terms">
                  <input type="checkbox" id="terms" required />
                  <label htmlFor="terms">
                    I agree to the cancellation policy and booking terms
                  </label>
                </div>

                {error && <p className="alert alert-error">{error}</p>}

                <button
                  className="btn-primary"
                  onClick={handleCreateBooking}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Continue to Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 'payment' && (
            <div className="booking-form-section">
              <div className="form-card">
                <h3> Payment Information</h3>

                <div className={`alert ${isPaymentExpired ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '12px' }}>
                  {isPaymentExpired
                    ? 'Payment window expired.'
                    : `Complete payment in ${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')} (mm:ss)`}
                </div>
                
                <div className="booking-summary">
                  <div className="summary-item">
                    <strong>Booking Code:</strong>
                    <code className="booking-code">{bookingCode}</code>
                  </div>
                  <div className="summary-item total">
                    <strong>Amount to Pay:</strong> NPR {totalAmount.toLocaleString()}
                  </div>
                </div>

                <div className="payment-instructions">
                  <h4>
                     Khalti Payment Instructions
                  </h4>
                  <ol>
                    <li>Click "Pay with Khalti" button below</li>
                    <li>You will be redirected to official Khalti payment page</li>
                    <li>Enter your Khalti PIN/MPIN on Khalti securely</li>
                    <li>After payment, you will return to this app automatically</li>
                  </ol>
                </div>

                {error && <p className="alert alert-error">{error}</p>}

                <div className="button-group">
                  <button
                    className="btn-secondary"
                    onClick={handleManualCancel}
                    disabled={loading || isPaymentExpired}
                    type="button"
                  >
                    Cancel Booking
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setStep('details')}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleProcessPayment}
                    disabled={loading || isPaymentExpired}
                  >
                    {loading ? 'Processing...' : 'Pay with Khalti'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirmation' && (
            <div className="booking-form-section">
              <div className="confirmation-card">
                <div className="confirmation-icon"></div>
                <h2>Booking Confirmed!</h2>
                <p className="confirmation-message">
                  Your booking has been successfully created and is under confirmation.
                </p>

                <div className="confirmation-details">
                  <div className="detail-row">
                    <strong>Booking Code:</strong>
                    <code className="booking-code">{bookingCode}</code>
                  </div>
                  <div className="detail-row">
                    <strong>Package:</strong>
                    {packageTitle}
                  </div>
                  <div className="detail-row">
                    <strong>Department Date:</strong>
                    {new Date(departureDate).toLocaleDateString()}
                  </div>
                  <div className="detail-row">
                    <strong>Travelers:</strong>
                    {travelersCount}
                  </div>
                  <div className="detail-row">
                    <strong>Total Amount:</strong>
                    NPR {totalAmount.toLocaleString()}
                  </div>
                  {booking.payment_method !== 'cash' && (
                    <div className="detail-row">
                      <strong>Payment Status:</strong>
                      <span className="status-pending">Pending Confirmation</span>
                    </div>
                  )}
                </div>

                <p className="confirmation-next-steps">
                   A confirmation email will be sent to {user?.email} shortly.
                  <br />
                  This booking belongs to {packageAgentName || 'the selected agent'} and will appear in that agent dashboard after payment is completed.
                  <br />
                  You can view your booking details in your dashboard.
                </p>

                <div className="button-group center">
                  <button
                    className="btn-primary"
                    onClick={() => navigate('/tourist')}
                  >
                    Go to Dashboard
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => navigate('/destinations')}
                  >
                    Browse More
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

