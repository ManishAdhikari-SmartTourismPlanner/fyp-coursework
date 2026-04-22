import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  fetchDestinations,
  createDestination,
  updateDestination,
  deleteDestination,
  fetchPackages,
  createPackage,
  fetchPackageDetail,
  updatePackage,
  deletePackage,
  cancelPackage,
  createPackageDeparture,
  fetchAllBookings,
  fetchAllPayments,
} from '../services/tourism'
import { buildCountSeries, buildMonthlySeries } from '../utils/analytics'

const AnalyticsCharts = lazy(() => import('../components/AnalyticsCharts'))

export default function AgentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [destinations, setDestinations] = useState([])
  const [packages, setPackages] = useState([])
  const [bookings, setBookings] = useState([])
  const [payments, setPayments] = useState([])
  const [loadingPage, setLoadingPage] = useState(true)
  const [error, setError] = useState('')
  const [processingPackageId, setProcessingPackageId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [destinationSearch, setDestinationSearch] = useState('')
  const [packageSearch, setPackageSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingFilter, setBookingFilter] = useState('all')
  const [destinationMessage, setDestinationMessage] = useState('')
  const [savingDestination, setSavingDestination] = useState(false)
  const [editingDestinationId, setEditingDestinationId] = useState(null)
  const [packageMessage, setPackageMessage] = useState('')
  const [savingPackage, setSavingPackage] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState(null)
  const [departureMessage, setDepartureMessage] = useState('')
  const [savingDeparture, setSavingDeparture] = useState(false)
  const [destinationForm, setDestinationForm] = useState({
    name: '',
    slug: '',
    description: '',
    province: '',
    district: '',
    nearest_city: '',
    altitude_m: 0,
    best_season: 'all',
    tour_type: 'traveling',
    difficulty: 'easy',
    suggested_duration_days: 1,
    image_url: '',
    is_active: true,
  })
  const [packageForm, setPackageForm] = useState({
    destination_id: '',
    title: '',
    slug: '',
    description: '',
    package_type: 'standard',
    tour_type: 'traveling',
    duration_days: 1,
    max_group_size: 10,
    price_npr: 0,
    includes: '',
    excludes: '',
    itinerary_overview: '',
    is_active: true,
  })
  const [departureForm, setDepartureForm] = useState({
    package_id: '',
    departure_date: '',
    total_seats: 10,
    status: 'open',
  })

  useEffect(() => {
    if (user?.id) {
      loadAgentData()
    }
  }, [user?.id])

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

  async function loadAgentData() {
    setLoadingPage(true)
    setError('')
    try {
      const [destsData, pkgsData, bksData, pmsData] = await Promise.allSettled([
        fetchDestinations(),
        fetchPackages({ created_by: user?.id }),
        fetchAllBookings(),
        fetchAllPayments(),
      ])

      const errors = []

      const dests = destsData.status === 'fulfilled'
        ? await loadAllPages(fetchDestinations, destsData.value)
        : []
      const pkgs = pkgsData.status === 'fulfilled'
        ? await loadAllPages(fetchPackages, pkgsData.value)
        : []
      const bks = bksData.status === 'fulfilled'
        ? await loadAllPages(fetchAllBookings, bksData.value)
        : []
      const pms = pmsData.status === 'fulfilled'
        ? await loadAllPages(fetchAllPayments, pmsData.value)
        : []

      if (destsData.status === 'rejected') errors.push(destsData.reason?.message || 'Failed to load destinations.')
      if (pkgsData.status === 'rejected') errors.push(pkgsData.reason?.message || 'Failed to load packages.')
      if (bksData.status === 'rejected') errors.push(bksData.reason?.message || 'Failed to load bookings.')
      if (pmsData.status === 'rejected') errors.push(pmsData.reason?.message || 'Failed to load payments.')

      setDestinations(dests)
      setPackages(pkgs)
      setBookings(bks)
      setPayments(pms)

      if (errors.length > 0) {
        setError(errors.join(' | '))
      }
    } catch (err) {
      setError(err.message || 'Failed to load agent data.')
    } finally {
      setLoadingPage(false)
    }
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  function resetDestinationForm() {
    setEditingDestinationId(null)
    setDestinationForm({
      name: '',
      slug: '',
      description: '',
      province: '',
      district: '',
      nearest_city: '',
      altitude_m: 0,
      best_season: 'all',
      tour_type: 'traveling',
      difficulty: 'easy',
      suggested_duration_days: 1,
      image_url: '',
      is_active: true,
    })
  }

  function resetPackageForm() {
    setEditingPackageId(null)
    setPackageForm({
      destination_id: '',
      title: '',
      slug: '',
      description: '',
      package_type: 'standard',
      tour_type: 'traveling',
      duration_days: 1,
      max_group_size: 10,
      price_npr: 0,
      includes: '',
      excludes: '',
      itinerary_overview: '',
      is_active: true,
    })
  }

  function updateDestinationField(e) {
    const { name, value, type, checked } = e.target
    setDestinationForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function updatePackageField(e) {
    const { name, value, type, checked } = e.target
    setPackageForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function updateDepartureField(e) {
    const { name, value } = e.target
    setDepartureForm((prev) => ({ ...prev, [name]: value }))
  }

  function resetDepartureForm() {
    setDepartureForm({
      package_id: '',
      departure_date: '',
      total_seats: 10,
      status: 'open',
    })
  }

  function handleEditDestination(dest) {
    setDestinationMessage('')
    setError('')
    setEditingDestinationId(dest.id)
    setDestinationForm({
      name: dest.name || '',
      slug: dest.slug || '',
      description: dest.description || '',
      province: dest.province || '',
      district: dest.district || '',
      nearest_city: dest.nearest_city || '',
      altitude_m: dest.altitude_m || 0,
      best_season: dest.best_season || 'all',
      tour_type: dest.tour_type || 'traveling',
      difficulty: dest.difficulty || 'easy',
      suggested_duration_days: dest.suggested_duration_days || 1,
      image_url: dest.image_url || '',
      is_active: dest.is_active !== false,
    })
  }

  async function handleSubmitDestination(e) {
    e.preventDefault()
    setSavingDestination(true)
    setDestinationMessage('')
    setError('')

    const payload = {
      ...destinationForm,
      slug: destinationForm.slug || slugify(destinationForm.name),
      altitude_m: Number(destinationForm.altitude_m || 0),
      suggested_duration_days: Number(destinationForm.suggested_duration_days || 1),
    }

    try {
      if (editingDestinationId) {
        await updateDestination(editingDestinationId, payload)
        setDestinationMessage(
          payload.is_active
            ? 'Destination updated successfully.'
            : 'Destination updated as inactive. It will not appear in tourist app lists.'
        )
      } else {
        await createDestination(payload)
        setDestinationMessage(
          payload.is_active
            ? 'Destination created successfully.'
            : 'Destination created as inactive. It will not appear in tourist app lists.'
        )
      }

      resetDestinationForm()
      await loadAgentData()
    } catch (err) {
      setError(err.message || 'Failed to save destination.')
    } finally {
      setSavingDestination(false)
    }
  }

  async function handleEditPackage(packageId) {
    setError('')
    setPackageMessage('')
    setProcessingPackageId(packageId)
    try {
      const detail = await fetchPackageDetail(packageId)
      setEditingPackageId(detail.id)
      setPackageForm({
        destination_id: detail.destination?.id || '',
        title: detail.title || '',
        slug: detail.slug || '',
        description: detail.description || '',
        package_type: detail.package_type || 'standard',
        tour_type: detail.tour_type || 'traveling',
        duration_days: detail.duration_days || 1,
        max_group_size: detail.max_group_size || 10,
        price_npr: detail.price_npr || 0,
        includes: detail.includes || '',
        excludes: detail.excludes || '',
        itinerary_overview: detail.itinerary_overview || '',
        is_active: detail.is_active !== false,
      })
    } catch (err) {
      setError(err.message || 'Failed to load package details.')
    } finally {
      setProcessingPackageId(null)
    }
  }

  async function handleSubmitPackage(e) {
    e.preventDefault()

    setSavingPackage(true)
    setError('')
    setPackageMessage('')

    const destinationId = Number(packageForm.destination_id)
    const packagesForDestination = packages.filter(
      (pkg) => Number(pkg.destination_id) === destinationId && pkg.id !== editingPackageId
    ).length

    if (!editingPackageId && packagesForDestination >= 3) {
      setSavingPackage(false)
      setError('This destination already has 3 packages. Please edit existing packages instead of creating more.')
      return
    }

    const payload = {
      ...packageForm,
      slug: packageForm.slug || slugify(packageForm.title),
      destination_id: destinationId,
      duration_days: Number(packageForm.duration_days || 1),
      max_group_size: Number(packageForm.max_group_size || 1),
      price_npr: Number(packageForm.price_npr || 0),
    }

    try {
      if (editingPackageId) {
        await updatePackage(editingPackageId, payload)
        setPackageMessage('Package updated successfully.')
      } else {
        await createPackage(payload)
        setPackageMessage('Package created successfully.')
      }
      resetPackageForm()
      await loadAgentData()
    } catch (err) {
      setError(err.message || 'Failed to save package.')
    } finally {
      setSavingPackage(false)
    }
  }

  async function handleCancelPackage(packageId) {
    const ok = window.confirm('Cancel this package? All active related bookings will be cancelled and paid users will be queued for refund.')
    if (!ok) {
      return
    }

    setProcessingPackageId(packageId)
    setError('')
    setPackageMessage('')
    try {
      await cancelPackage(packageId)
      if (editingPackageId === packageId) {
        resetPackageForm()
      }
      setPackageMessage('Package cancelled successfully. Admin can now process refunds for paid Khalti bookings.')
      await loadAgentData()
    } catch (err) {
      setError(err.message || 'Failed to cancel package.')
    } finally {
      setProcessingPackageId(null)
    }
  }

  async function handleDeletePackage(packageId) {
    const ok = window.confirm('Delete this package? This cannot be undone.')
    if (!ok) {
      return
    }

    setProcessingPackageId(packageId)
    setError('')
    setPackageMessage('')
    try {
      await deletePackage(packageId)
      if (editingPackageId === packageId) {
        resetPackageForm()
      }
      setPackageMessage('Package deleted successfully.')
      await loadAgentData()
    } catch (err) {
      setError(err.message || 'Failed to delete package.')
    } finally {
      setProcessingPackageId(null)
    }
  }

  async function handleSubmitDeparture(e) {
    e.preventDefault()
    setSavingDeparture(true)
    setError('')
    setDepartureMessage('')

    const payload = {
      package_id: Number(departureForm.package_id),
      departure_date: departureForm.departure_date,
      total_seats: Number(departureForm.total_seats || 1),
      status: departureForm.status || 'open',
    }

    try {
      await createPackageDeparture(payload)
      setDepartureMessage('Departure created successfully.')
      resetDepartureForm()
      await loadAgentData()
    } catch (err) {
      setError(err.message || 'Failed to create departure.')
    } finally {
      setSavingDeparture(false)
    }
  }

  async function handleDeleteDestination(destinationId) {
    const ok = window.confirm('Are you sure you want to delete this destination? Related packages may also be removed.')
    if (!ok) {
      return
    }

    setError('')
    setDestinationMessage('')
    try {
      await deleteDestination(destinationId)
      if (editingDestinationId === destinationId) {
        resetDestinationForm()
      }
      setDestinationMessage('Destination deleted successfully.')
      await loadAgentData()
    } catch (err) {
      setError(err.message || 'Failed to delete destination.')
    }
  }

  const bookingStats = useMemo(() => ({
    total: bookings.filter((b) => b.status !== 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }), [bookings])

  const analytics = useMemo(() => {
    const totalRevenue = bookings
      .filter(b => ['confirmed', 'completed', 'rescheduled'].includes(b.status))
      .reduce((sum, b) => sum + Number(b.total_amount_npr || 0), 0)

    const paidRevenue = payments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + Number(p.amount_npr || 0), 0)

    const pendingPayments = payments.filter(p => p.status === 'pending').length

    return {
      totalRevenue,
      paidRevenue,
      pendingPayments,
    }
  }, [bookings, payments])

  const customers = useMemo(() => {
    const map = new Map()
    bookings.forEach((b) => {
      const key = b.tourist_username || 'unknown'
      if (!map.has(key)) {
        map.set(key, {
          username: key,
          bookingsCount: 0,
          totalSpend: 0,
        })
      }
      const item = map.get(key)
      item.bookingsCount += 1
      item.totalSpend += Number(b.total_amount_npr || 0)
    })
    return Array.from(map.values()).sort((a, b) => b.bookingsCount - a.bookingsCount)
  }, [bookings])

  const destinationPackageCounts = useMemo(() => {
    const counts = new Map()
    packages.forEach((pkg) => {
      const key = Number(pkg.destination_id)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [packages])

  const selectedDestinationPackageCount = useMemo(() => {
    const key = Number(packageForm.destination_id || 0)
    if (!key) {
      return 0
    }
    return destinationPackageCounts.get(key) || 0
  }, [destinationPackageCounts, packageForm.destination_id])

  const filteredDestinations = useMemo(() => {
    const q = destinationSearch.trim().toLowerCase()
    if (!q) {
      return destinations
    }
    return destinations.filter((d) => {
      const haystack = [d.name, d.province, d.district, d.tour_type, d.difficulty].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [destinations, destinationSearch])

  const filteredPackages = useMemo(() => {
    const q = packageSearch.trim().toLowerCase()
    if (!q) {
      return packages
    }
    return packages.filter((p) => {
      const haystack = [p.title, p.destination_name, p.package_type, p.tour_type].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [packages, packageSearch])

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase()
    return bookings.filter((b) => {
      if (b.status === 'pending') {
        return false
      }
      const statusMatches = bookingFilter === 'all' || b.status === bookingFilter
      if (!statusMatches) {
        return false
      }
      if (!q) {
        return true
      }
      const haystack = [b.booking_code, b.tourist_username, b.package_title, b.status].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [bookings, bookingFilter, bookingSearch])

  const packageTypePieData = useMemo(() => ([
    { name: 'Normal', value: packages.filter((pkg) => pkg.package_type === 'normal').length, color: '#2563eb' },
    { name: 'Standard', value: packages.filter((pkg) => pkg.package_type === 'standard').length, color: '#0f766e' },
    { name: 'Deluxe', value: packages.filter((pkg) => pkg.package_type === 'deluxe').length, color: '#7c3aed' },
  ]), [packages])

  const revenueTrendData = useMemo(() => buildMonthlySeries(
    payments.filter((payment) => payment.status === 'success'),
    'created_at',
    (payment) => Number(payment.amount_npr || 0)
  ), [payments])

  const destinationDemandData = useMemo(() => buildCountSeries(
    bookings,
    (booking) => booking.destination_name || 'Unknown destination',
    () => 1,
    6
  ), [bookings])

  const destinationDemandTotal = destinationDemandData.reduce((sum, item) => sum + Number(item.value || 0), 0)

  if (loadingPage) {
    return (
      <div className="dashboard">
        <Navbar />
        <main className="dashboard-main">
          <p className="loading-text">Loading agent dashboard...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard agent-dashboard-modern">
      <Navbar />
      <div className="agent-container">
        {/* SIDEBAR NAVIGATION */}
        <aside className="agent-sidebar">
          <div className="sidebar-header">
            <h2>Control Panel</h2>
            <p className="sidebar-user">You: <strong>{user?.username}</strong></p>
          </div>
          
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span className="nav-icon">OV</span>
              <span className="nav-label">Overview</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'destinations' ? 'active' : ''}`}
              onClick={() => setActiveTab('destinations')}
            >
              <span className="nav-icon">DS</span>
              <span className="nav-label">Destinations</span>
              <span className="nav-badge">{destinations.length}</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'packages' ? 'active' : ''}`}
              onClick={() => setActiveTab('packages')}
            >
              <span className="nav-icon">PK</span>
              <span className="nav-label">Packages</span>
              <span className="nav-badge">{packages.length}</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <span className="nav-icon">BK</span>
              <span className="nav-label">Bookings</span>
              <span className="nav-badge">{bookingStats.total}</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <span className="nav-icon">AN</span>
              <span className="nav-label">Analytics</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="btn-secondary btn-block" onClick={loadAgentData}>
               Refresh
            </button>
            <button className="btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={() => navigate('/destinations')}>
               Public View
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="agent-main">
          {error && <div className="alert alert-error" style={{ marginBottom: '24px' }}>{error}</div>}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Welcome back, {user?.username}</h1>
                <p>Quick overview of your agency performance</p>
              </div>

              <div className="metrics-grid">
                <div className="metric-card primary">
                  <div className="metric-icon">DS</div>
                  <div className="metric-info">
                    <p className="metric-value">{destinations.length}</p>
                    <p className="metric-label">Destinations</p>
                  </div>
                </div>
                <div className="metric-card accent">
                  <div className="metric-icon">PK</div>
                  <div className="metric-info">
                    <p className="metric-value">{packages.length}</p>
                    <p className="metric-label">Packages</p>
                  </div>
                </div>
                <div className="metric-card success">
                  <div className="metric-icon">BK</div>
                  <div className="metric-info">
                    <p className="metric-value">{bookingStats.total}</p>
                    <p className="metric-label">Total Bookings</p>
                  </div>
                </div>
                <div className="metric-card special">
                  <div className="metric-icon">NR</div>
                  <div className="metric-info">
                    <p className="metric-value"> {Math.round(analytics.totalRevenue / 100000).toFixed(1)}L</p>
                    <p className="metric-label">Total Revenue</p>
                  </div>
                </div>
              </div>

              <div className="overview-grid">
                <div className="card overview-card">
                  <h3>Booking Status</h3>
                  <div className="status-list">
                    <div className="status-item">
                      <span className="status-label">Confirmed</span>
                      <span className="status-count confirmed">{bookingStats.confirmed}</span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Cancelled</span>
                      <span className="status-count cancelled">{bookingStats.cancelled}</span>
                    </div>
                  </div>
                </div>

                <div className="card overview-card">
                  <h3>Payment Status</h3>
                  <div className="status-list">
                    <p className="status-value">Paid: <strong> {Math.round(analytics.paidRevenue).toLocaleString()}</strong></p>
                    <p className="status-value">Pending: <strong>{analytics.pendingPayments}</strong> payments</p>
                    <p className="status-value">Customers: <strong>{customers.length}</strong> unique</p>
                  </div>
                </div>

                <div className="card overview-card">
                  <h3>Quick Actions</h3>
                  <div className="action-buttons">
                    <button className="btn-outline" onClick={() => setActiveTab('destinations')}>
                      + Add Destination
                    </button>
                    <button className="btn-outline" onClick={() => setActiveTab('packages')}>
                      + Create Package
                    </button>
                    <button className="btn-outline" onClick={() => setActiveTab('bookings')}>
                      View Bookings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DESTINATIONS TAB */}
          {activeTab === 'destinations' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Manage Destinations</h1>
                <p>Create and manage travel destinations</p>
              </div>

              <div className="content-grid">
                <div className="card form-card">
                  <h3>{editingDestinationId ? 'Edit Destination' : 'New Destination'}</h3>
                  {destinationMessage && <div className="alert alert-success">{destinationMessage}</div>}
                  <form className="modern-form" onSubmit={handleSubmitDestination}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name</label>
                        <input name="name" value={destinationForm.name} onChange={updateDestinationField} required />
                      </div>
                      <div className="form-group">
                        <label>Tour Type</label>
                        <select name="tour_type" value={destinationForm.tour_type} onChange={updateDestinationField}>
                          <option value="traveling">Traveling</option>
                          <option value="trekking">Trekking</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <input name="description" value={destinationForm.description} onChange={updateDestinationField} placeholder="Detailed description" required />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Province</label>
                        <input name="province" value={destinationForm.province} onChange={updateDestinationField} required />
                      </div>
                      <div className="form-group">
                        <label>District</label>
                        <input name="district" value={destinationForm.district} onChange={updateDestinationField} required />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Best Season</label>
                        <select name="best_season" value={destinationForm.best_season} onChange={updateDestinationField}>
                          <option value="all">All Year</option>
                          <option value="spring">Spring</option>
                          <option value="summer">Summer</option>
                          <option value="autumn">Autumn</option>
                          <option value="winter">Winter</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Difficulty</label>
                        <select name="difficulty" value={destinationForm.difficulty} onChange={updateDestinationField}>
                          <option value="easy">Easy</option>
                          <option value="moderate">Moderate</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Altitude (m)</label>
                        <input name="altitude_m" type="number" min="0" value={destinationForm.altitude_m} onChange={updateDestinationField} />
                      </div>
                      <div className="form-group">
                        <label>Duration (days)</label>
                        <input name="suggested_duration_days" type="number" min="1" value={destinationForm.suggested_duration_days} onChange={updateDestinationField} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Image URL</label>
                      <input name="image_url" value={destinationForm.image_url} onChange={updateDestinationField} placeholder="https://..." />
                    </div>

                    <div className="form-checkbox">
                      <input id="dest-active" name="is_active" type="checkbox" checked={destinationForm.is_active} onChange={updateDestinationField} />
                      <label htmlFor="dest-active">Active Destination</label>
                    </div>

                    <div className="form-actions">
                      <button className="btn-primary" type="submit" disabled={savingDestination}>
                        {savingDestination ? 'Saving...' : (editingDestinationId ? 'Update Destination' : 'Create Destination')}
                      </button>
                      {editingDestinationId && (
                        <button className="btn-secondary" type="button" onClick={resetDestinationForm}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="card list-card">
                  <div className="list-headline">
                    <h3>Destinations ({filteredDestinations.length})</h3>
                    <input
                      className="list-search"
                      placeholder="Search by name, province, district, type..."
                      value={destinationSearch}
                      onChange={(e) => setDestinationSearch(e.target.value)}
                    />
                  </div>
                  {filteredDestinations.length === 0 ? (
                    <p className="empty-state">No destinations yet. Create one to get started!</p>
                  ) : (
                    <div className="modern-table-wrapper">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Location</th>
                            <th>Packages</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDestinations.map((d) => {
                            const isUpperMustang = String(d.name || '').trim().toLowerCase() === 'upper mustang'
                            const canManageDestination = isUpperMustang
                              ? d.created_by_username === user?.username
                              : true
                            return (
                              <tr key={d.id}>
                                <td><strong>{d.name}</strong></td>
                                <td>{d.province}, {d.district}</td>
                                <td><span className="badge badge-info">{destinationPackageCounts.get(Number(d.id)) || 0}/3</span></td>
                                <td>{d.difficulty}</td>
                                <td><span className={`badge badge-${d.is_active ? 'success' : 'muted'}`}>{d.is_active ? 'Active' : 'Inactive'}</span></td>
                                <td>
                                  <div className="action-buttons-compact">
                                    <button
                                      className="btn-icon btn-edit"
                                      onClick={() => handleEditDestination(d)}
                                      title={canManageDestination ? 'Edit Destination' : 'Only the creator can edit Upper Mustang'}
                                      disabled={!canManageDestination}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="btn-icon btn-delete"
                                      onClick={() => handleDeleteDestination(d.id)}
                                      title={canManageDestination ? 'Delete Destination' : 'Only the creator can delete Upper Mustang'}
                                      disabled={!canManageDestination}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PACKAGES TAB */}
          {activeTab === 'packages' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Manage Packages</h1>
                <p>Create and manage tour packages (max 3 per destination)</p>
              </div>

              <div className="content-grid">
                <div className="card form-card">
                  <h3>{editingPackageId ? 'Edit Package' : 'New Package'}</h3>
                  {packageMessage && <div className="alert alert-success">{packageMessage}</div>}
                  <form className="modern-form" onSubmit={handleSubmitPackage}>
                    <div className="form-group">
                      <label>Destination</label>
                      <select name="destination_id" value={packageForm.destination_id} onChange={updatePackageField} required>
                        <option value="">Select a destination</option>
                        {destinations.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({destinationPackageCounts.get(Number(d.id)) || 0}/3 packages)
                          </option>
                        ))}
                      </select>
                    </div>

                    {!editingPackageId && packageForm.destination_id && selectedDestinationPackageCount >= 3 && (
                      <div className="alert alert-error">
                         This destination has reached the 3-package limit. Edit existing packages instead.
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label>Title</label>
                        <input name="title" value={packageForm.title} onChange={updatePackageField} required />
                      </div>
                      <div className="form-group">
                        <label>Package Type</label>
                        <select name="package_type" value={packageForm.package_type} onChange={updatePackageField}>
                          <option value="normal">Normal</option>
                          <option value="standard">Standard</option>
                          <option value="deluxe">Deluxe</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <input name="description" value={packageForm.description} onChange={updatePackageField} placeholder="Package details" required />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Duration (days)</label>
                        <input name="duration_days" type="number" min="1" value={packageForm.duration_days} onChange={updatePackageField} required />
                      </div>
                      <div className="form-group">
                        <label>Max Group Size</label>
                        <input name="max_group_size" type="number" min="1" value={packageForm.max_group_size} onChange={updatePackageField} required />
                      </div>
                      <div className="form-group">
                        <label>Price (NPR)</label>
                        <input name="price_npr" type="number" min="0" value={packageForm.price_npr} onChange={updatePackageField} required />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Tour Type</label>
                      <select name="tour_type" value={packageForm.tour_type} onChange={updatePackageField}>
                        <option value="traveling">Traveling</option>
                        <option value="trekking">Trekking</option>
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Includes</label>
                        <input name="includes" value={packageForm.includes} onChange={updatePackageField} placeholder="Use  separators" />
                      </div>
                      <div className="form-group">
                        <label>Excludes</label>
                        <input name="excludes" value={packageForm.excludes} onChange={updatePackageField} placeholder="Use  separators" />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Itinerary Overview</label>
                      <input name="itinerary_overview" value={packageForm.itinerary_overview} onChange={updatePackageField} placeholder="Day-by-day breakdown" />
                    </div>

                    <div className="form-checkbox">
                      <input id="pkg-active" name="is_active" type="checkbox" checked={packageForm.is_active} onChange={updatePackageField} />
                      <label htmlFor="pkg-active">Active Package</label>
                    </div>

                    <div className="form-actions">
                      <button
                        className="btn-primary"
                        type="submit"
                        disabled={savingPackage || (!editingPackageId && packageForm.destination_id && selectedDestinationPackageCount >= 3)}
                      >
                        {savingPackage ? 'Saving...' : (editingPackageId ? 'Update Package' : 'Create Package')}
                      </button>
                      {editingPackageId && (
                        <button className="btn-secondary" type="button" onClick={resetPackageForm}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>

                  <hr style={{ margin: '20px 0', opacity: 0.2 }} />
                  <h3>New Departure</h3>
                  <p className="auth-note">Past departure dates are automatically closed and cannot be booked.</p>
                  {departureMessage && <div className="alert alert-success">{departureMessage}</div>}
                  <form className="modern-form" onSubmit={handleSubmitDeparture}>
                    <div className="form-group">
                      <label>Package</label>
                      <select name="package_id" value={departureForm.package_id} onChange={updateDepartureField} required>
                        <option value="">Select a package</option>
                        {packages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Departure Date</label>
                        <input name="departure_date" type="date" value={departureForm.departure_date} onChange={updateDepartureField} required />
                      </div>
                      <div className="form-group">
                        <label>Total Seats</label>
                        <input name="total_seats" type="number" min="1" value={departureForm.total_seats} onChange={updateDepartureField} required />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Status</label>
                      <select name="status" value={departureForm.status} onChange={updateDepartureField}>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="form-actions">
                      <button className="btn-primary" type="submit" disabled={savingDeparture}>
                        {savingDeparture ? 'Saving...' : 'Create Departure'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card list-card">
                  <div className="list-headline">
                    <h3>All Packages ({filteredPackages.length})</h3>
                    <input
                      className="list-search"
                      placeholder="Search by title, destination, type..."
                      value={packageSearch}
                      onChange={(e) => setPackageSearch(e.target.value)}
                    />
                  </div>
                  {filteredPackages.length === 0 ? (
                    <p className="empty-state">No packages yet. Create one to start offering tours!</p>
                  ) : (
                    <div className="modern-table-wrapper">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Destination</th>
                            <th>Duration</th>
                            <th>Price</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPackages.map((p) => (
                            <tr key={p.id}>
                              <td><strong>{p.title}</strong></td>
                              <td>{p.destination_name}</td>
                              <td>{p.duration_days} days</td>
                              <td><span className="price"> {Number(p.price_npr || 0).toLocaleString()}</span></td>
                              <td><span className="badge badge-secondary">{p.package_type}</span></td>
                              <td><span className={`badge badge-${p.is_active ? 'success' : 'muted'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                              <td>
                                <div className="action-buttons-compact">
                                  <button className="btn-icon btn-edit" onClick={() => handleEditPackage(p.id)} disabled={processingPackageId === p.id} title="Edit Package">Edit</button>
                                  <button className="btn-icon btn-delete" onClick={() => handleDeletePackage(p.id)} disabled={processingPackageId === p.id} title="Delete Package">Delete</button>
                                  <button className="btn-icon btn-secondary" onClick={() => handleCancelPackage(p.id)} disabled={processingPackageId === p.id || !p.is_active} title="Cancel Package">Cancel</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === 'bookings' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Manage Bookings</h1>
                <p>Review and manage customer bookings</p>
              </div>

              <div className="card">
                <div className="list-headline booking-headline">
                  <h3>Booking Queue ({filteredBookings.length})</h3>
                  <div className="booking-controls">
                    <input
                      className="list-search"
                      placeholder="Search by code, customer, package..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                    />
                    <select
                      className="list-filter"
                      value={bookingFilter}
                      onChange={(e) => setBookingFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <p className="empty-state">No bookings yet. Once customers book your packages, they'll appear here.</p>
                ) : (
                  <div className="modern-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Customer</th>
                          <th>Agency</th>
                          <th>Package</th>
                          <th>Status</th>
                          <th>Total</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBookings.map((b) => (
                          <tr key={b.id}>
                            <td><code>{b.booking_code}</code></td>
                            <td>{b.tourist_username}</td>
                            <td>{user?.username}</td>
                            <td>{b.package_title}</td>
                            <td>
                              <span className={`badge badge-${b.status === 'confirmed' ? 'success' : 'danger'}`}>
                                {b.status}
                              </span>
                            </td>
                            <td><strong> {Number(b.total_amount_npr || 0).toLocaleString()}</strong></td>
                            <td>
                              <div className="action-buttons-compact">
                                <button
                                  className="btn-icon"
                                  disabled={true}
                                  title="Bookings are managed by the payment flow or package cancellation"
                                >
                                  Managed
                                </button>
                              </div>
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

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="agent-content">
              <div className="content-header">
                <h1>Analytics & Insights</h1>
                <p>Performance metrics and customer data</p>
              </div>

              <Suspense fallback={<div className="dashboard-chart-loading">Loading analytics charts...</div>}>
                <AnalyticsCharts
                  pieTitle="Package Mix"
                  pieDescription="Your package inventory split by tier."
                  pieData={packageTypePieData}
                  pieTotalLabel="Total packages"
                  pieTotalValue={packages.length}
                  pieLegendItems={packageTypePieData}
                  lineTitle="Revenue Trend"
                  lineDescription="Successful payments by month."
                  lineData={revenueTrendData}
                  lineValueSuffix=" NPR"
                  lineStroke="#0f766e"
                  lineTotalLabel="Paid revenue"
                  lineTotalValue={analytics.paidRevenue}
                  lineTotalSuffix=" NPR"
                  lineLegendItems={[{ label: 'Successful payments', color: '#0f766e' }]}
                  barTitle="Top Destination Demand"
                  barDescription="Where bookings are concentrating right now."
                  barData={destinationDemandData}
                  barColor="#f59e0b"
                  barTotalLabel="Bookings"
                  barTotalValue={destinationDemandTotal}
                  barLegendItems={[{ label: 'Booking count', color: '#f59e0b' }]}
                />
              </Suspense>

              <div className="analytics-grid">
                <div className="card analytics-card">
                  <h3>Revenue Summary</h3>
                  <div className="analytics-item">
                    <span className="label">Total Revenue:</span>
                    <span className="value"> {Math.round(analytics.totalRevenue).toLocaleString()}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Paid:</span>
                    <span className="value success"> {Math.round(analytics.paidRevenue).toLocaleString()}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Pending Payments:</span>
                    <span className="value warning">{analytics.pendingPayments}</span>
                  </div>
                </div>

                <div className="card analytics-card">
                  <h3>Booking Summary</h3>
                  <div className="analytics-item">
                    <span className="label">Total Bookings:</span>
                    <span className="value">{bookingStats.total}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Confirmed:</span>
                    <span className="value success">{bookingStats.confirmed}</span>
                  </div>
                </div>

                <div className="card analytics-card">
                  <h3>Customer Insights</h3>
                  <div className="analytics-item">
                    <span className="label">Unique Customers:</span>
                    <span className="value">{customers.length}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Total Destinations:</span>
                    <span className="value">{destinations.length}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="label">Total Packages:</span>
                    <span className="value">{packages.length}</span>
                  </div>
                </div>
              </div>

              <div className="analytics-tables">
                <div className="card">
                  <h3>Top Customers</h3>
                  {customers.length === 0 ? (
                    <p className="empty-state">No customer data yet.</p>
                  ) : (
                    <div className="modern-table-wrapper">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Bookings</th>
                            <th>Total Spend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customers.slice(0, 10).map((c) => (
                            <tr key={c.username}>
                              <td><strong>{c.username}</strong></td>
                              <td>{c.bookingsCount}</td>
                              <td><span className="price"> {Math.round(c.totalSpend).toLocaleString()}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3>Recent Payments</h3>
                  {payments.length === 0 ? (
                    <p className="empty-state">No payment data yet.</p>
                  ) : (
                    <div className="modern-table-wrapper">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Booking</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.slice(0, 10).map((p) => (
                            <tr key={p.id}>
                              <td><code>{p.booking_code}</code></td>
                              <td><strong> {Number(p.amount_npr || 0).toLocaleString()}</strong></td>
                              <td>{p.method}</td>
                              <td>
                                <span className={`badge badge-${p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

