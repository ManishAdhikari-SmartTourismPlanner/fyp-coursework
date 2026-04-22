import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchMyBookings } from '../services/tourism'

export default function BookingConfirmationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const bookingCode = searchParams.get('code') || ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    loadBooking()
  }, [bookingCode])

  async function loadBooking() {
    setLoading(true)
    setError('')
    try {
      let rows = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const data = await fetchMyBookings({ page })
        if (Array.isArray(data)) {
          rows = [...rows, ...data]
          hasMore = false
        } else {
          rows = [...rows, ...(data?.results || [])]
          hasMore = Boolean(data?.next)
          page += 1
        }
      }

      const match = rows.find((item) => item.booking_code === bookingCode)
      if (!match) {
        throw new Error('Booking not found. Please open the confirmation link from your latest payment.')
      }
      setBooking(match)
    } catch (err) {
      setError(err.message || 'Failed to load booking confirmation.')
    } finally {
      setLoading(false)
    }
  }

  const agencyName = useMemo(() => {
    return booking?.package?.created_by_username || booking?.package?.created_by?.username || 'Travel agency'
  }, [booking])

  if (loading) {
    return <div className="dashboard"><div className="loading-text">Loading booking confirmation...</div></div>
  }

  if (error && !booking) {
    return <div className="dashboard"><div className="alert alert-error">{error}</div></div>
  }

  if (!booking) {
    return <div className="dashboard"><div className="alert alert-error">Booking confirmation unavailable.</div></div>
  }

  return (
    <div className="dashboard">
      <div className="dashboard-main" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        <div className="dashboard-header">
          <h1>Booking Confirmed</h1>
          <p>Your package is booked under {agencyName}. This booking will appear in that agent dashboard only.</p>
        </div>

        <div className="card" style={{ marginBottom: '18px' }}>
          <div className="booking-summary">
            <div className="summary-item"><strong>Booking Code:</strong> <code>{booking.booking_code}</code></div>
            <div className="summary-item"><strong>Package:</strong> {booking.package_title}</div>
            <div className="summary-item"><strong>Destination:</strong> {booking.destination_name}</div>
            <div className="summary-item"><strong>Agency:</strong> {agencyName}</div>
            <div className="summary-item"><strong>Status:</strong> {booking.status}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => navigate('/tourist')}>Go to Dashboard</button>
          <button className="btn-secondary" onClick={() => navigate('/agencies')}>Browse More Agencies</button>
        </div>
      </div>
    </div>
  )
}