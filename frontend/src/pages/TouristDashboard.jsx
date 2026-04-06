import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { fetchMyBookings, fetchAllReviews } from '../services/tourism'

const features = [
  {
    id: 'destinations',
    icon: '-',
    title: 'View Destinations',
    desc: 'Explore available destinations by location and season.',
  },
  {
    id: 'packages',
    icon: '',
    title: 'Tour Packages',
    desc: 'Browse Standard and Deluxe packages  trekking or traveling.',
  },
  {
    id: 'bookings',
    icon: '',
    title: 'My Bookings',
    desc: 'View, reschedule or cancel your tour bookings.',
  },
  {
    id: 'payments',
    icon: '',
    title: 'Payments',
    desc: 'Pay securely via Khalti or eSewa in NPR.',
  },
  {
    id: 'maps',
    icon: '-',
    title: 'Offline Maps',
    desc: 'Download offline maps of your booked destinations.',
  },
]

export default function TouristDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [bookings, setBookings] = useState(null)

  async function handleFeatureClick(featureId) {
    setLoading(featureId)

    try {
      switch (featureId) {
        case 'destinations':
          navigate('/destinations')
          break

        case 'packages':
          navigate('/packages')
          break

        case 'bookings':
          const bookingsData = await fetchMyBookings()
          setBookings(bookingsData.results || bookingsData)
          // Could show a modal or navigate to bookings page
          console.log('My Bookings:', bookingsData)
          alert(`You have ${(bookingsData.results || bookingsData).length} bookings`)
          break

        case 'payments':
          alert('Payment history coming soon! For now, view payment status in your bookings.')
          break

        case 'maps':
          alert('Offline maps download coming soon!')
          break

        default:
          break
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="dashboard">
      <Navbar />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1>Welcome back, {user?.username}! </h1>
          <p>Explore Nepal's best destinations and plan your perfect tour.</p>
        </div>

        <div className="dashboard-grid">
          {features.map(f => (
            <div className="card" key={f.id}>
              <div className="card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <button
                className="btn-secondary"
                onClick={() => handleFeatureClick(f.id)}
                disabled={loading === f.id}
              >
                {loading === f.id ? 'Loading...' : 'Explore'}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

