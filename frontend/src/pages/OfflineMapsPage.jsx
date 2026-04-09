import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { fetchDestinations, fetchMyBookings, fetchLatestOfflineMaps } from '../services/tourism'

export default function OfflineMapsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookings, setBookings] = useState([])
  const [allDestinations, setAllDestinations] = useState([])
  const [selectedDestinationId, setSelectedDestinationId] = useState('')
  const [maps, setMaps] = useState([])
  const [mapsLoading, setMapsLoading] = useState(false)

  const bookedDestinations = useMemo(() => {
    const map = new Map()
    bookings.forEach((b) => {
      const destination = b.package?.destination
      if (destination?.id && destination?.name) {
        map.set(destination.id, destination.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [bookings])

  const destinations = useMemo(() => {
    const merged = new Map()
    bookedDestinations.forEach((d) => merged.set(d.id, d.name))
    allDestinations.forEach((d) => {
      if (!merged.has(d.id)) {
        merged.set(d.id, d.name)
      }
    })
    return Array.from(merged.entries()).map(([id, name]) => ({ id, name }))
  }, [bookedDestinations, allDestinations])

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedDestinationId) {
      loadMaps(selectedDestinationId)
    } else {
      setMaps([])
    }
  }, [selectedDestinationId])

  async function loadInitialData() {
    setLoading(true)
    setError('')
    try {
      const [bookingsData, destinationsData] = await Promise.all([
        fetchMyBookings(),
        fetchDestinations(),
      ])

      const data = bookingsData
      const rows = Array.isArray(data) ? data : data.results || []
      setBookings(rows)

      const destinationRows = Array.isArray(destinationsData)
        ? destinationsData
        : destinationsData.results || []
      setAllDestinations(destinationRows.map((d) => ({ id: d.id, name: d.name })))

      if (rows.length > 0) {
        const firstDestinationId = rows.find((b) => b.package?.destination?.id)?.package?.destination?.id
        if (firstDestinationId) {
          setSelectedDestinationId(String(firstDestinationId))
        }
      } else if (destinationRows.length > 0) {
        setSelectedDestinationId(String(destinationRows[0].id))
      }
    } catch (err) {
      setError(err.message || 'Failed to load offline map data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadMaps(destinationId) {
    setMapsLoading(true)
    setError('')
    try {
      const data = await fetchLatestOfflineMaps(destinationId)
      setMaps(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load offline maps.')
      setMaps([])
    } finally {
      setMapsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <Navbar />
        <main className="dashboard-main">
          <p className="loading-text">Loading offline maps...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Navbar />
      <main className="dashboard-main" style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <div className="dashboard-header">
          <button className="btn-secondary" onClick={() => navigate('/tourist')}>Back</button>
          <h1 style={{ marginTop: '14px' }}>Offline Maps</h1>
          <p>Download latest active map packs for your booked destinations.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label htmlFor="destination-select">Choose Destination</label>
            <select
              id="destination-select"
              value={selectedDestinationId}
              onChange={(e) => setSelectedDestinationId(e.target.value)}
              className="form-control"
            >
              <option value="">Select destination</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card">
          <h3>Available Map Packs</h3>
          {mapsLoading ? (
            <p>Loading maps...</p>
          ) : maps.length === 0 ? (
            <p className="empty-state">No active offline maps found for this destination.</p>
          ) : (
            <div className="modern-table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Version</th>
                    <th>File Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {maps.map((m) => (
                    <tr key={m.id}>
                      <td>{m.title}</td>
                      <td>{m.version}</td>
                      <td>{m.file_size_mb} MB</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <a className="btn-secondary" href={m.file_url} target="_blank" rel="noreferrer">
                            View
                          </a>
                          <a className="btn-secondary" href={m.file_url} download>
                            Download
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
