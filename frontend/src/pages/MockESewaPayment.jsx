import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import '../styles/payment-callback.css'

export default function MockESewaPayment() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [paymentData, setPaymentData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate eSewa payment processing
    const params = Object.fromEntries(searchParams)
    console.log('Mock eSewa received params:', params)
    
    setPaymentData(params)
    
    // Simulate 3 second processing time
    const timer = setTimeout(() => {
      setLoading(false)
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [searchParams])

  const handleSuccess = () => {
    const params = paymentData
    // Redirect to success page with params
    const successUrl = params.su + `?oid=${params.pid}&amt=${params.tAmt}&refId=MOCK_${Date.now()}&rid=${params.rid}`
    window.location.href = successUrl
  }

  const handleFailure = () => {
    const params = paymentData
    // Redirect to failure page
    window.location.href = params.fu
  }

  if (!paymentData) {
    return <div className="loading"><span className="loading-text">Loading mock payment...</span></div>
  }

  return (
    <div className="payment-callback-page">
      <div className="callback-container">
        <div className="callback-card" style={{ maxWidth: '600px', padding: '40px' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '20px' }}> Mock eSewa Payment Portal</h1>
          
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>
            This is a test payment simulator. In production, this would be the actual eSewa payment portal.
          </p>

          <div style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '20px', 
            borderRadius: '8px', 
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <h3 style={{ marginTop: 0 }}> Payment Details</h3>
            <p><strong>Amount:</strong> NPR {paymentData.tAmt}</p>
            <p><strong>Merchant:</strong> {paymentData.scd}</p>
            <p><strong>Product:</strong> {paymentData.psc}</p>
            <p><strong>Order ID:</strong> {paymentData.pid}</p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                fontSize: '48px',
                animation: 'spin 2s linear infinite',
                marginBottom: '20px'
              }}></div>
              <p>Processing payment...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button
                onClick={handleSuccess}
                style={{
                  padding: '14px 28px',
                  fontSize: '16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                 Complete Payment (Success)
              </button>
              <button
                onClick={handleFailure}
                style={{
                  padding: '14px 28px',
                  fontSize: '16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
              >
                | Cancel Payment (Failure)
              </button>
            </div>
          )}

          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    </div>
  )
}

