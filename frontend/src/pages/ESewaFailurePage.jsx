import { useNavigate } from 'react-router-dom'
import '../styles/payment-callback.css'

export default function ESewaFailurePage() {
  const navigate = useNavigate()

  return (
    <div className="payment-callback-page">
      <div className="callback-container">
        <div className="callback-card error">
          <div className="callback-icon">
            <span className="error-icon">|</span>
          </div>

          <h1 className="callback-title">Payment Failed</h1>

          <p className="callback-message">
            Your eSewa payment could not be completed. Please try again or contact our support team.
          </p>

          <div className="error-details">
            <h3>What happened?</h3>
            <ul>
              <li>Your payment was declined or cancelled</li>
              <li>Network connection was interrupted</li>
              <li>eSewa server encountered an error</li>
            </ul>
          </div>

          <div className="error-actions">
            <button className="btn-primary" onClick={() => navigate(-1)}>
              Try Again
            </button>
            <button className="btn-secondary" onClick={() => navigate('/')}>
              Back to Home
            </button>
            <button className="btn-outline" onClick={() => navigate('/contact')}>
              Contact Support
            </button>
          </div>

          <p className="support-text">
            Need help? Contact us at support@smarttourism.np or call +977-1-XXXXXX
          </p>
        </div>
      </div>
    </div>
  )
}

