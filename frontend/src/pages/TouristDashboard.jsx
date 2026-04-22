import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  fetchDestinations,
  fetchPackages,
  fetchMyBookings,
  fetchAllPayments,
} from '../services/tourism'
import { buildCountSeries, buildMonthlySeries } from '../utils/analytics'

const AnalyticsCharts = lazy(() => import('../components/AnalyticsCharts'))

const navItems = [
  { id: 'overview', label: 'Overview', badge: '' },
  { id: 'destinations', label: 'Destinations', badge: '' },
  { id: 'packages', label: 'Packages', badge: '' },
  { id: 'bookings', label: 'Bookings', badge: '' },
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
  const [payments, setPayments] = useState([])
  const [tabLoading, setTabLoading] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

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
      const [destsData, pkgsData, bookingsData, paymentsData] = await Promise.allSettled([
        fetchDestinations(),
        fetchPackages(),
        fetchMyBookings(),
        fetchAllPayments(),
      ])

      const errors = []

      const dests = destsData.status === 'fulfilled'
        ? await loadAllPages(fetchDestinations, destsData.value)
        : []
      const pkgs = pkgsData.status === 'fulfilled'
        ? await loadAllPages(fetchPackages, pkgsData.value)
        : []
      const bks = bookingsData.status === 'fulfilled'
        ? await loadAllPages(fetchMyBookings, bookingsData.value)
        : []
      const pms = paymentsData.status === 'fulfilled'
        ? await loadAllPages(fetchAllPayments, paymentsData.value)
        : []

      if (destsData.status === 'rejected') errors.push(destsData.reason?.message || 'Failed to load destinations.')
      if (pkgsData.status === 'rejected') errors.push(pkgsData.reason?.message || 'Failed to load packages.')
      if (bookingsData.status === 'rejected') errors.push(bookingsData.reason?.message || 'Failed to load bookings.')
      if (paymentsData.status === 'rejected') errors.push(paymentsData.reason?.message || 'Failed to load payments.')

      setDestinations(dests)
      setPackages(pkgs)
      setBookings(bks)
      setPayments(pms)

      if (errors.length > 0) {
        setError(errors.join(' | '))
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.')
    } finally {
      setLoadingPage(false)
    }
  }

  const bookingStats = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }), [bookings])

  const paymentStats = useMemo(() => ({
    total: payments.length,
    refundedCount: payments.filter((payment) => payment.status === 'refunded').length,
    refundedAmount: payments
      .filter((payment) => payment.status === 'refunded')
      .reduce((sum, payment) => sum + Number(payment.amount_npr || 0), 0),
    successfulAmount: payments
      .filter((payment) => payment.status === 'success')
      .reduce((sum, payment) => sum + Number(payment.amount_npr || 0), 0),
  }), [payments])

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
        booking.agency_username,
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

  const bookingPieData = useMemo(() => ([
    { name: 'Confirmed', value: bookings.filter((booking) => booking.status === 'confirmed').length, color: '#2563eb' },
    { name: 'Pending', value: bookings.filter((booking) => booking.status === 'pending').length, color: '#f59e0b' },
    { name: 'Cancelled', value: bookings.filter((booking) => booking.status === 'cancelled').length, color: '#ef4444' },
  ]), [bookings])

  const bookingTrendData = useMemo(() => buildMonthlySeries(
    bookings,
    'booking_date',
    () => 1
  ), [bookings])

  const destinationProvinceData = useMemo(() => buildCountSeries(
    destinations,
    (destination) => destination.province || 'Unknown province',
    () => 1,
    6
  ), [destinations])

  const destinationProvinceTotal = destinationProvinceData.reduce((sum, item) => sum + Number(item.value || 0), 0)

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
            <button className="btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={() => navigate('/agencies')}>
              Browse Agencies
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
                      Explore destinations, compare packages, manage bookings, and keep your next trip organized from one elegant dashboard.
                    </p>
                    <div className="tourist-hero-actions">
                      <button className="btn-primary" onClick={() => handleNavClick('destinations')}>
                        Explore Destinations
                      </button>
                      <button className="btn-secondary" onClick={() => handleNavClick('packages')}>
                        Browse Packages
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
                  <p className="stat-number">{paymentStats.refundedCount}</p>
                  <p className="stat-label">Refunds</p>
                </div>
              </section>

              <section className="tourist-insights-section">
                <div className="section-heading compact">
                  <h2>Travel Insights</h2>
                  <p>A quick visual summary of your travel activity and destination spread.</p>
                </div>

                <Suspense fallback={<div className="dashboard-chart-loading">Loading analytics charts...</div>}>
                  <AnalyticsCharts
                    pieTitle="Booking Status"
                    pieDescription="How your trips are distributed right now."
                    pieData={bookingPieData}
                    pieTotalLabel="Total bookings"
                    pieTotalValue={bookingStats.total}
                    pieLegendItems={bookingPieData}
                    lineTitle="Booking Trend"
                    lineDescription="Your booking activity by month."
                    lineData={bookingTrendData}
                    lineStroke="#7c3aed"
                    lineTotalLabel="Bookings"
                    lineTotalValue={bookingStats.total}
                    lineLegendItems={[{ label: 'Bookings by month', color: '#7c3aed' }]}
                    barTitle="Destination Spread"
                    barDescription="Active destinations grouped by province."
                    barData={destinationProvinceData}
                    barColor="#ef4444"
                    barTotalLabel="Destinations"
                    barTotalValue={destinationProvinceTotal}
                    barLegendItems={[{ label: 'Destination count', color: '#ef4444' }]}
                  />
                </Suspense>
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
                      { id: 'agencies', title: 'Agencies', desc: 'See active agencies and compare their packages.' },
                      { id: 'packages', title: 'Packages', desc: 'Compare normal, standard, and deluxe packages.' },
                      { id: 'bookings', title: 'Bookings', desc: 'Review booking status and trip progress.' },
                    ].map((feature) => (
                      <button
                        key={feature.id}
                        className="tourist-feature-card"
                        onClick={() => {
                          if (feature.id === 'agencies') {
                            navigate('/agencies')
                            return
                          }
                          handleNavClick(feature.id)
                        }}
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
                      <li>Review your booking details before departure.</li>
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
                          <th>Agency</th>
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
                            <td>{b.agency_username || 'Travel agency'}</td>
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

          {activeTab === 'payments' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Payments</h1>
                <p>Track your payments and any Khalti refunds processed by the admin.</p>
              </div>

              <div className="analytics-grid">
                <div className="card analytics-card">
                  <h3>Refund Summary</h3>
                  <div className="analytics-item">
                    <span className="label">Refunded Payments:</span>
                    <span className="value success">{paymentStats.refundedCount}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Refunded Amount:</span>
                    <span className="value success">NPR {paymentStats.refundedAmount.toLocaleString()}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Paid Amount:</span>
                    <span className="value">NPR {paymentStats.successfulAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="card analytics-card">
                  <h3>Payment Methods</h3>
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

              <div className="card tourist-summary-card compact" style={{ marginTop: '20px' }}>
                <div className="section-heading compact">
                  <h2>Your Payments</h2>
                  <p>Refunded Khalti payments appear here with the same booking code and amount.</p>
                </div>

                {payments.length === 0 ? (
                  <p className="empty-state">No payments yet. Complete a booking to see payment records here.</p>
                ) : (
                  <div className="modern-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Booking</th>
                          <th>Method</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Paid At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id}>
                            <td><code>{payment.booking_code || 'N/A'}</code></td>
                            <td>{payment.method}</td>
                            <td>NPR {Number(payment.amount_npr || 0).toLocaleString()}</td>
                            <td>
                              <span className={`badge badge-${payment.status === 'refunded' ? 'success' : payment.status === 'success' ? 'info' : payment.status === 'failed' ? 'danger' : 'warning'}`}>
                                {payment.status === 'refunded' ? 'Refunded via Khalti' : payment.status}
                              </span>
                            </td>
                            <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : 'Pending'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="tourist-hero-actions">
                <button className="btn-primary tourist-cta" onClick={() => navigate('/packages')}>Browse Packages</button>
                <button className="btn-secondary tourist-cta" onClick={() => navigate('/booking')}>Continue Booking</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
