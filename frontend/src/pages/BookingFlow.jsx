import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createBooking, createPayment, initiateESewaPayment } from '../services/tourism'
import { useAuth } from '../context/AuthContext'

export default function BookingFlowPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  const bookingState = location.state || {}
  const {
    packageId,
    packageTitle,
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
  const [transactionId, setTransactionId] = useState('')

  const [booking, setBooking] = useState({
    special_request: '',
    payment_method: 'khalti', // khalti, esewa, cash
  })

  const totalAmount = price * travelersCount

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
      
      if (booking.payment_method === 'cash') {
        // For cash, move to confirmation
        setStep('confirmation')
      } else {
        // For online payments, move to payment step
        setStep('payment')
      }
    } catch (err) {
      setError(err.message || 'Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  async function handleProcessPayment() {
    // For eSewa, redirect to payment gateway
    if (booking.payment_method === 'esewa') {
      if (!bookingId) {
        setError('Booking ID not found. Please try again.')
        return
      }

      setLoading(true)
      setError('')
      try {
        console.log('Initiating eSewa payment with:', { bookingId, totalAmount })
        const result = await initiateESewaPayment(bookingId, totalAmount)
        console.log('eSewa payment initiated:', result)
        
        // Redirect to eSewa payment portal
        if (result.payment_url) {
          console.log('Redirecting to:', result.payment_url)
          window.location.href = result.payment_url
        } else {
          setError('Failed to generate payment URL. Please try again.')
          setLoading(false)
        }
      } catch (err) {
        console.error('eSewa payment error:', err)
        setError(err.message || 'Failed to initiate eSewa payment')
        setLoading(false)
      }
      return
    }

    // For manual payments (Khalti, etc.)
    if (!transactionId) {
      setError('Please enter transaction ID')
      return
    }

    setLoading(true)
    setError('')
    try {
      const payload = {
        booking_code: bookingCode,
        method: booking.payment_method,
        transaction_id: transactionId,
        amount_npr: totalAmount,
        status: 'pending',
      }
      
      await createPayment(payload)
      setStep('confirmation')
    } catch (err) {
      setError(err.message || 'Failed to process payment')
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
                    <option value="esewa">eSewa (Online)</option>
                    <option value="cash">Cash at Counter</option>
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
                     {booking.payment_method === 'khalti' ? 'Khalti' : 'eSewa'} Payment Instructions
                  </h4>
                  {booking.payment_method === 'khalti' && (
                    <ol>
                      <li>Open Khalti app or visit khalti.com</li>
                      <li>Select "Send Money"</li>
                      <li>Enter amount: NPR {totalAmount}</li>
                      <li>Select Smart Tourism Planner as recipient</li>
                      <li>Complete the payment</li>
                      <li>Paste the transaction ID below</li>
                    </ol>
                  )}
                  {booking.payment_method === 'esewa' && (
                    <ol>
                      <li>Click "Pay with eSewa" button below</li>
                      <li>You will be redirected to eSewa payment portal</li>
                      <li>Complete the payment securely on eSewa</li>
                      <li>You will be automatically redirected back</li>
                      <li>Your booking will be confirmed instantly upon successful payment</li>
                    </ol>
                  )}
                </div>

                {booking.payment_method === 'khalti' && (
                  <div className="form-group">
                    <label htmlFor="transaction_id">Transaction ID / Reference Number</label>
                    <input
                      id="transaction_id"
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g., KHA123456789"
                      className="form-control"
                    />
                  </div>
                )}

                {error && <p className="alert alert-error">{error}</p>}

                <div className="button-group">
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
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : booking.payment_method === 'esewa' ? 'Pay with eSewa' : 'Confirm Payment'}
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

