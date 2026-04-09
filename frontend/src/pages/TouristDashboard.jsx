import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  fetchDestinations,
  fetchPackages,
  fetchMyBookings,
  fetchLatestOfflineMaps,
} from '../services/tourism'

const navItems = [
  { id: 'overview', label: 'Overview', badge: '' },
  { id: 'destinations', label: 'Destinations', badge: '' },
  { id: 'packages', label: 'Packages', badge: '' },
  { id: 'bookings', label: 'Bookings', badge: '' },
  { id: 'maps', label: 'Offline Maps', badge: '' },
  { id: 'payments', label: 'Payments', badge: '' },
]

function featureCardLabel(id) {
  switch (id) {
    case 'destinations':
      return 'DS'
    case 'packages':
      return 'PK'
    case 'bookings':
      return 'BK'
    case 'maps':
      return 'MP'
    case 'payments':
      return 'PY'
    default:
      return 'ST'
  }
}

export default function TouristDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('packages')
  const [loadingPage, setLoadingPage] = useState(true)
  const [error, setError] = useState('')
  const [destinations, setDestinations] = useState([])
  const [destinationSearch, setDestinationSearch] = useState('')
  const [packageSearch, setPackageSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const [packages, setPackages] = useState([])
  const [bookings, setBookings] = useState([])
  const [selectedMapDestinationId, setSelectedMapDestinationId] = useState('')
  const [offlineMaps, setOfflineMaps] = useState([])
  const [mapsLoading, setMapsLoading] = useState(false)
  const [tabLoading, setTabLoading] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (activeTab === 'maps' && selectedMapDestinationId) {
      loadMaps(selectedMapDestinationId)
    }
  }, [activeTab, selectedMapDestinationId])

  useEffect(() => {
    if (!selectedMapDestinationId && destinations.length > 0) {
      setSelectedMapDestinationId(String(destinations[0].id))
    }
  }, [destinations, selectedMapDestinationId])

  async function loadAllPages(fetchFunc, initialData = {}) {
    let allResults = [...(initialData.results || [initialData])]
    let nextUrl = initialData.next

    while (nextUrl) {
      try {
        const url = new URL(nextUrl)
        const params = Object.fromEntries(url.searchParams)
        const response = await fetchFunc(params)
        allResults = [...allResults, ...(response.results || [])]
        nextUrl = response.next
      } catch (err) {
        console.error('Error loading next page:', err)
        break
      }
    }

    return allResults
  }

  async function loadDashboard() {
    setLoadingPage(true)
    setError('')
    try {
      const [destsData, pkgsData, bookingsData] = await Promise.all([
        fetchDestinations(),
        fetchPackages(),
        fetchMyBookings(),
      ])

      const dests = await loadAllPages(fetchDestinations, destsData)
      const pkgs = await loadAllPages(fetchPackages, pkgsData)
      const bks = await loadAllPages(fetchMyBookings, bookingsData)

      setDestinations(dests)
      setPackages(pkgs)
      setBookings(bks)
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.')
    } finally {
      setLoadingPage(false)
    }
  }

  async function loadMaps(destinationId) {
    setMapsLoading(true)
    setError('')
    try {
      const data = await fetchLatestOfflineMaps(destinationId)
      setOfflineMaps(Array.isArray(data) ? data : [])
    } catch (err) {
      setOfflineMaps([])
      setError(err.message || 'Failed to load offline maps.')
    } finally {
      setMapsLoading(false)
    }
  }

  const bookingStats = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }), [bookings])

  const destinationStats = useMemo(() => ({
    total: destinations.length,
    active: destinations.filter((d) => d.is_active !== false).length,
  }), [destinations])

  const packageStats = useMemo(() => ({
    total: packages.length,
    normal: packages.filter((p) => p.package_type === 'normal').length,
    standard: packages.filter((p) => p.package_type === 'standard').length,
    deluxe: packages.filter((p) => p.package_type === 'deluxe').length,
  }), [packages])

  const recentBookings = useMemo(() => bookings.slice(0, 4), [bookings])
  const featuredDestinations = useMemo(() => destinations.slice(0, 4), [destinations])
  const selectedMapDestination = useMemo(
    () => destinations.find((d) => String(d.id) === String(selectedMapDestinationId)),
    [destinations, selectedMapDestinationId]
  )
  const filteredDestinations = useMemo(() => {
    const query = destinationSearch.trim().toLowerCase()
    if (!query) {
      return destinations
    }

    return destinations.filter((dest) => {
      const values = [dest.name, dest.province, dest.district, dest.best_season, dest.tour_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return values.includes(query)
    })
  }, [destinations, destinationSearch])
  const filteredPackages = useMemo(() => {
    const query = packageSearch.trim().toLowerCase()
    if (!query) {
      return packages
    }

    return packages.filter((pkg) => {
      const values = [pkg.title, pkg.destination_name, pkg.package_type, pkg.tour_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return values.includes(query)
    })
  }, [packages, packageSearch])
  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase()
    if (!query) {
      return bookings
    }

    return bookings.filter((booking) => {
      const values = [
        booking.booking_code,
        booking.package_title,
        booking.destination_name,
        booking.status,
        booking.departure_date,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return values.includes(query)
    })
  }, [bookings, bookingSearch])

  async function handleNavClick(tabId) {
    setTabLoading(tabId)
    try {
      setActiveTab(tabId)
    } finally {
      setTabLoading('')
    }
  }

  if (loadingPage) {
    return (
      <div className="dashboard tourist-dashboard-modern">
        <Navbar />
        <main className="dashboard-main">
          <p className="loading-text">Loading your travel dashboard...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard tourist-dashboard-modern">
      <Navbar />
      <div className="agent-container">
        <aside className="agent-sidebar tourist-sidebar">
          <div className="sidebar-header">
            <h2>Travel Panel</h2>
            <p className="sidebar-user">You: <strong>{user?.username}</strong></p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <span className="nav-icon">{featureCardLabel(item.id)}</span>
                <span className="nav-label">{item.label}</span>
                {item.id === 'destinations' && <span className="nav-badge">{destinationStats.total}</span>}
                {item.id === 'packages' && <span className="nav-badge">{packageStats.total}</span>}
                {item.id === 'bookings' && <span className="nav-badge">{bookingStats.total}</span>}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="btn-secondary btn-block" onClick={loadDashboard}>
              Refresh
            </button>
            <button className="btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={() => navigate('/destinations')}>
              Browse Destinations
            </button>
            <button className="btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={() => navigate('/offline-maps')}>
              Offline Maps
            </button>
          </div>
        </aside>

        <main className="agent-main tourist-main">
          {error && <div className="alert alert-error" style={{ marginBottom: '24px' }}>{error}</div>}

          {activeTab === 'overview' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Welcome back, {user?.username}</h1>
                <p>Your personal travel control center for Nepal.</p>
              </div>

              <section className="card tourist-hero-card">
                <div className="tourist-hero-layout">
                  <div className="tourist-hero-copy">
                    <div className="tourist-hero-kicker">Plan smarter, travel smoother</div>
                    <h1>Everything you need for planning is here</h1>
                    <p>
                      Explore destinations, compare packages, manage bookings, open offline maps, and keep your next trip organized from one elegant dashboard.
                    </p>
                    <div className="tourist-hero-actions">
                      <button className="btn-primary" onClick={() => handleNavClick('destinations')}>
                        Explore Destinations
                      </button>
                      <button className="btn-secondary" onClick={() => handleNavClick('packages')}>
                        Browse Packages
                      </button>
                      <button className="btn-secondary" onClick={() => handleNavClick('maps')}>
                        Offline Maps
                      </button>
                    </div>
                  </div>

                  <div className="tourist-hero-panel">
                    <div className="tourist-hero-panel-title">Trip Snapshot</div>
                    <div className="tourist-mini-stats">
                      <div>
                        <strong>{bookingStats.total}</strong>
                        <span>Total Bookings</span>
                      </div>
                      <div>
                        <strong>{bookingStats.confirmed}</strong>
                        <span>Confirmed Trips</span>
                      </div>
                      <div>
                        <strong>{destinationStats.active}</strong>
                        <span>Active Destinations</span>
                      </div>
                      <div>
                        <strong>{packageStats.total}</strong>
                        <span>Available Packages</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="stats-row tourist-stats-row">
                <div className="stat-card tourist">
                  <p className="stat-number">{bookingStats.total}</p>
                  <p className="stat-label">Total Bookings</p>
                </div>
                <div className="stat-card tourist">
                  <p className="stat-number">{destinationStats.total}</p>
                  <p className="stat-label">Destinations</p>
                </div>
                <div className="stat-card tourist">
                  <p className="stat-number">{packageStats.total}</p>
                  <p className="stat-label">Packages</p>
                </div>
                <div className="stat-card tourist">
                  <p className="stat-number">{offlineMaps.length}</p>
                  <p className="stat-label">Offline Maps</p>
                </div>
              </section>

              <div className="tourist-section-grid">
                <div className="card tourist-summary-card compact">
                  <div className="section-heading compact">
                    <h2>Quick actions</h2>
                    <p>Fast access to your main travel tools.</p>
                  </div>
                  <div className="tourist-feature-grid">
                    {[
                      { id: 'destinations', title: 'Destinations', desc: 'Discover active places and open destinations.' },
                      { id: 'packages', title: 'Packages', desc: 'Compare normal, standard, and deluxe packages.' },
                      { id: 'bookings', title: 'Bookings', desc: 'Review booking status and trip progress.' },
                      { id: 'maps', title: 'Offline Maps', desc: 'Open latest map packs for selected destinations.' },
                    ].map((feature) => (
                      <button
                        key={feature.id}
                        className="tourist-feature-card"
                        onClick={() => handleNavClick(feature.id)}
                        disabled={tabLoading === feature.id}
                      >
                        <div className="tourist-feature-tag">{featureCardLabel(feature.id)}</div>
                        <h3>{feature.title}</h3>
                        <p>{feature.desc}</p>
                        <span>{tabLoading === feature.id ? 'Opening...' : 'Open'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tourist-sidebar-stack">
                  <div className="card tourist-summary-card" id="tourist-recent-bookings">
                    <div className="section-heading compact">
                      <h2>Recent bookings</h2>
                      <p>Your latest trip activity at a glance.</p>
                    </div>
                    {recentBookings.length === 0 ? (
                      <p className="empty-state">No bookings yet. Start by exploring destinations and packages.</p>
                    ) : (
                      <div className="tourist-booking-list">
                        {recentBookings.map((booking) => (
                          <div className="tourist-booking-item" key={booking.id}>
                            <div>
                              <strong>{booking.package_title}</strong>
                              <p>{booking.destination_name}</p>
                            </div>
                            <span className={`badge badge-${booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'warning'}`}>
                              {booking.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card tourist-summary-card subtle" id="tourist-travel-tips">
                    <div className="section-heading compact">
                      <h2>Travel tips</h2>
                      <p>Simple reminders before your next trip.</p>
                    </div>
                    <ul className="tourist-tips-list">
                      <li>Download offline maps before traveling.</li>
                      <li>Keep your booking code handy for check-in and support.</li>
                      <li>Use standard or deluxe packages for more comfort.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'destinations' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Destinations</h1>
                <p>Browse the active Nepal destinations available for travel planning.</p>
              </div>

              <div className="card tourist-summary-card compact" style={{ marginBottom: '20px' }}>
                <div className="search-box" style={{ maxWidth: '520px' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search destinations by name, province, or district..."
                    value={destinationSearch}
                    onChange={(e) => setDestinationSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                  <span className="badge badge-info">Showing {filteredDestinations.length} of {destinations.length}</span>
                  {destinationSearch && (
                    <button className="btn-secondary" type="button" onClick={() => setDestinationSearch('')}>
                      Clear Search
                    </button>
                  )}
                </div>
              </div>

              {filteredDestinations.length === 0 ? (
                <div className="card">
                  <p className="empty-state">No destinations match your search.</p>
                </div>
              ) : (
                <div className="tourist-destination-grid">
                  {filteredDestinations.map((dest) => (
                    <div key={dest.id} className="tourist-destination-card" onClick={() => navigate('/destinations')}>
                      <img src={dest.image_url || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/png/dummy.png'} alt={dest.name} />
                      <div className="body">
                        <h3>{dest.name}</h3>
                        <p>{dest.province}, {dest.district}</p>
                        <div className="destination-badges">
                          <span className="badge badge-info">{dest.best_season}</span>
                          <span className={`badge badge-${dest.difficulty}`}>{dest.difficulty}</span>
                        </div>
                        <button className="btn-secondary" onClick={() => navigate('/destinations')}>Open Destinations</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Packages</h1>
                <p>Compare travel tiers and choose the experience you want.</p>
              </div>

              <div className="card tourist-package-table">
                <div className="search-box" style={{ maxWidth: '520px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search packages by title, destination, or type..."
                    value={packageSearch}
                    onChange={(e) => setPackageSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span className="badge badge-info">Showing {filteredPackages.length} of {packages.length}</span>
                  {packageSearch && (
                    <button className="btn-secondary" type="button" onClick={() => setPackageSearch('')}>
                      Clear Search
                    </button>
                  )}
                </div>

                {filteredPackages.length === 0 ? (
                  <p className="empty-state">No packages found for your search.</p>
                ) : (
                  <div className="modern-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Destination</th>
                          <th>Type</th>
                          <th>Duration</th>
                          <th>Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPackages.map((pkg) => (
                          <tr key={pkg.id}>
                            <td><strong>{pkg.title}</strong></td>
                            <td>{pkg.destination_name}</td>
                            <td><span className="badge badge-secondary">{pkg.package_type}</span></td>
                            <td>{pkg.duration_days} days</td>
                            <td><span className="price">NPR {Number(pkg.price_npr || 0).toLocaleString()}</span></td>
                            <td>
                              <button className="btn-secondary" onClick={() => navigate(`/package/${pkg.id}`)}>
                                View & Book
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Bookings</h1>
                <p>Track your current and past bookings in one place.</p>
              </div>

              <div className="card">
                <div className="search-box" style={{ maxWidth: '520px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search bookings by code, package, destination, or status..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span className="badge badge-info">Showing {filteredBookings.length} of {bookings.length}</span>
                  {bookingSearch && (
                    <button className="btn-secondary" type="button" onClick={() => setBookingSearch('')}>
                      Clear Search
                    </button>
                  )}
                </div>

                {filteredBookings.length === 0 ? (
                  <p className="empty-state">No bookings yet. Your booked trips will appear here.</p>
                ) : (
                  <div className="modern-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Package</th>
                          <th>Destination</th>
                          <th>Status</th>
                          <th>Total</th>
                          <th>Departure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBookings.map((b) => (
                          <tr key={b.id}>
                            <td><code>{b.booking_code}</code></td>
                            <td>{b.package_title}</td>
                            <td>{b.destination_name}</td>
                            <td>
                              <span className={`badge badge-${b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}`}>
                                {b.status}
                              </span>
                            </td>
                            <td><strong>NPR {Number(b.total_amount_npr || 0).toLocaleString()}</strong></td>
                            <td>{b.departure_date || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'maps' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Offline Maps</h1>
                <p>Choose any destination and open the latest active map pack.</p>
              </div>

              <div className="card tourist-map-selector">
                <div className="form-group">
                  <label>Choose Destination</label>
                  <select
                    value={selectedMapDestinationId}
                    onChange={(e) => setSelectedMapDestinationId(e.target.value)}
                  >
                    <option value="">Select destination</option>
                    {destinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>{dest.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="card">
                <h3>Available Map Packs</h3>
                {mapsLoading ? (
                  <p className="loading-text">Loading offline maps...</p>
                ) : !selectedMapDestinationId ? (
                  <p className="empty-state">Select a destination to view available maps.</p>
                ) : offlineMaps.length === 0 ? (
                  <p className="empty-state">No active offline maps found for this destination.</p>
                ) : (
                  <div className="tourist-map-list">
                    {offlineMaps.map((mapRow) => (
                      <div className="tourist-map-item" key={mapRow.id}>
                        <div>
                          <h4>{mapRow.title}</h4>
                          <p>
                            {mapRow.destination_name} • {mapRow.version} • {mapRow.file_size_mb} MB
                          </p>
                        </div>
                        <div className="tourist-map-actions">
                          <a className="btn-secondary" href={mapRow.file_url} target="_blank" rel="noreferrer">
                            View
                          </a>
                          <a className="btn-secondary" href={mapRow.file_url} download>
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Payments</h1>
                <p>Review payment flow and continue to booking payment when needed.</p>
              </div>

              <div className="analytics-grid">
                <div className="card analytics-card">
                  <h3>Payment Journey</h3>
                  <div className="analytics-item">
                    <span className="label">Pending Bookings:</span>
                    <span className="value warning">{bookingStats.pending}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Confirmed Trips:</span>
                    <span className="value success">{bookingStats.confirmed}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Action:</span>
                    <span className="value">Continue from booking flow</span>
                  </div>
                </div>

                <div className="card analytics-card">
                  <h3>Supported Methods</h3>
                  <div className="analytics-item">
                    <span className="label">eSewa</span>
                    <span className="value success">Online</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Khalti</span>
                    <span className="value success">Online</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Cash</span>
                    <span className="value warning">At booking</span>
                  </div>
                </div>
              </div>

              <div className="tourist-hero-actions">
                <button className="btn-primary tourist-cta" onClick={() => navigate('/packages')}>Browse Packages</button>
                <button className="btn-secondary tourist-cta" onClick={() => navigate('/booking')}>Continue Booking</button>
                <button className="btn-secondary tourist-cta" onClick={() => navigate('/offline-maps')}>Offline Maps</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
