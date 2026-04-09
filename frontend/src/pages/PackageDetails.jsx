import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPackageDetail, fetchPackageDepartures } from '../services/tourism'

export default function PackageDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pkg, setPkg] = useState(null)
  const [departures, setDepartures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDeparture, setSelectedDeparture] = useState(null)
  const [travelersCount, setTravelersCount] = useState(1)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadPackageDetails()
  }, [id])

  async function loadPackageDetails() {
    setLoading(true)
    setError('')
    try {
      const [pkgData, departuresData] = await Promise.all([
        fetchPackageDetail(id),
        fetchPackageDepartures(id),
      ])
      setPkg(pkgData)
      
      setDepartures(Array.isArray(departuresData) ? departuresData : departuresData?.results || pkgData.departures || [])
    } catch (err) {
      setError(err.message || 'Failed to load package details')
    } finally {
      setLoading(false)
    }
  }

  function splitList(text) {
    if (!text) {
      return []
    }

    return String(text)
      .split(/\r?\n|\s*\u2022\s*|\s*-\s*/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const includedItems = useMemo(() => splitList(pkg?.includes), [pkg])
  const excludedItems = useMemo(() => splitList(pkg?.excludes), [pkg])
  const heroImage = pkg?.destination?.image_url || pkg?.image_url || 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1600&q=80'

  function handleBooking() {
    if (!selectedDeparture) {
      setError('Please select a departure date')
      return
    }
    
    if (selectedDeparture.available_seats < travelersCount) {
      setError(`Only ${selectedDeparture.available_seats} seats available`)
      return
    }

    navigate('/booking', {
      state: {
        packageId: pkg.id,
        packageTitle: pkg.title,
        departureId: selectedDeparture.id,
        departureDate: selectedDeparture.departure_date,
        price: pkg.price_npr,
        travelersCount,
      }
    })
  }

  const getPriceCategory = (price) => {
    if (price < 50000) return { label: ' Budget Package', color: 'green' }
    if (price < 150000) return { label: ' Mid-Range Package', color: 'gold' }
    return { label: ' Luxury Package', color: 'purple' }
  }

  const getPackageTypeLabel = (type) => {
    return type === 'deluxe' ? ' DELUXE' : ' STANDARD'
  }

  if (loading) return <div className="dashboard"><div className="loading-text">Loading package details...</div></div>
  if (error) return <div className="dashboard"><div className="alert alert-error">{error}</div></div>
  if (!pkg) return <div className="dashboard"><p>Package not found</p></div>

  const priceCategory = getPriceCategory(pkg.price_npr)

  return (
    <div className="dashboard package-details-page">
      <div className="dashboard-main package-details-main">
        <button className="btn-back package-back-btn" onClick={() => navigate(-1)}>Back</button>

        <section className="package-hero-card">
          <div className="package-hero-copy">
            <div className="package-header-badges">
              <span className={`package-type-badge badge-${pkg.package_type}`}>
                {getPackageTypeLabel(pkg.package_type)}
              </span>
              <span className={`price-category-badge category-${priceCategory.color}`}>
                {priceCategory.label}
              </span>
            </div>
            <h1>{pkg.title}</h1>
            <p className="package-destination">{pkg.destination.name} • {pkg.destination.province}</p>
            <p className="package-hero-description">{pkg.description}</p>

            <div className="package-hero-meta">
              <div>
                <span>Duration</span>
                <strong>{pkg.duration_days} days</strong>
              </div>
              <div>
                <span>Group Size</span>
                <strong>Max {pkg.max_group_size} people</strong>
              </div>
              <div>
                <span>Tour Type</span>
                <strong>{pkg.tour_type}</strong>
              </div>
              <div>
                <span>Best Season</span>
                <strong>{pkg.destination.best_season}</strong>
              </div>
            </div>
          </div>

          <div className="package-hero-media">
            <img src={heroImage} alt={pkg.destination.name} />
          </div>
        </section>

        <div className="package-detail-layout">
          <div className="package-details-column">
            <div className="package-tabs package-tabs-modern">
              <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
              <button className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`} onClick={() => setActiveTab('itinerary')}>Itinerary</button>
              <button className={`tab-btn ${activeTab === 'includes' ? 'active' : ''}`} onClick={() => setActiveTab('includes')}>Includes & Excludes</button>
            </div>

            {activeTab === 'overview' && (
              <div className="tab-content package-tab-card">
                <div className="overview-cards package-overview-grid">
                  <div className="overview-card">
                    <div className="card-text">
                      <strong>Destination</strong>
                      <p>{pkg.destination.name}</p>
                    </div>
                  </div>
                  <div className="overview-card">
                    <div className="card-text">
                      <strong>Price</strong>
                      <p>NPR {Number(pkg.price_npr || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="overview-card">
                    <div className="card-text">
                      <strong>Departures</strong>
                      <p>{departures.length} options</p>
                    </div>
                  </div>
                  <div className="overview-card">
                    <div className="card-text">
                      <strong>Availability</strong>
                      <p>{departures.filter((dep) => dep.available_seats > 0).length} open</p>
                    </div>
                  </div>
                </div>

                <div className="package-highlights">
                  <div className="package-highlight-card">
                    <h3>Why this package</h3>
                    <p>{pkg.itinerary_overview || 'A thoughtfully curated travel plan with clear departure options and flexible booking.'}</p>
                  </div>
                  <div className="package-highlight-card muted">
                    <h3>Quick note</h3>
                    <p>Select a departure from the right panel to continue booking.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'itinerary' && (
              <div className="tab-content package-tab-card">
                <h3>Itinerary Overview</h3>
                <p className="itinerary-text">{pkg.itinerary_overview || 'No itinerary overview has been added for this package yet.'}</p>
              </div>
            )}

            {activeTab === 'includes' && (
              <div className="tab-content package-tab-card">
                <div className="includes-section">
                  <h4>What’s Included</h4>
                  {includedItems.length === 0 ? (
                    <p className="empty-state">No included items have been listed yet.</p>
                  ) : (
                    <ul className="feature-list">
                      {includedItems.map((item, i) => (
                        <li key={i}><span className="checkmark">✓</span>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="excludes-section">
                  <h4>What’s Excluded</h4>
                  {excludedItems.length === 0 ? (
                    <p className="empty-state">No excluded items have been listed yet.</p>
                  ) : (
                    <ul className="feature-list excludes">
                      {excludedItems.map((item, i) => (
                        <li key={i}><span className="crossmark">–</span>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="booking-sidebar booking-sidebar-sticky">
            <div className="price-display-card booking-price-card">
              <div className="price-block">
                <p className="price-per">Per person</p>
                <div className="price-number">
                  <span className="currency">NPR</span>
                  <span className="amount">{Number(pkg.price_npr || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="panel-section">
              <h4>Select Departure</h4>
              {departures.length === 0 ? (
                <p className="no-departures">No departures available</p>
              ) : (
                <div className="departures-list departures-list-modern">
                  {departures.map((dep) => (
                    <button
                      key={dep.id}
                      type="button"
                      className={`departure-option ${selectedDeparture?.id === dep.id ? 'selected' : ''} ${dep.available_seats === 0 ? 'disabled' : ''}`}
                      onClick={() => dep.available_seats > 0 && setSelectedDeparture(dep)}
                    >
                      <div>
                        <div className="departure-date">
                          {new Date(dep.departure_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="departure-seat-text">
                          {dep.available_seats > 0 ? `${dep.available_seats} seats available` : 'Full'}
                        </div>
                      </div>
                      <span className={`seats-badge ${dep.available_seats <= 3 && dep.available_seats > 0 ? 'low' : dep.available_seats > 0 ? 'available' : 'full'}`}>
                        {dep.available_seats > 0 ? 'Open' : 'Full'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedDeparture && (
              <div className="panel-section">
                <label>Number of travelers</label>
                <input
                  type="number"
                  min="1"
                  max={selectedDeparture.available_seats}
                  value={travelersCount}
                  onChange={(e) => setTravelersCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="travelers-input"
                />
                <p className="input-hint">Max {selectedDeparture.available_seats} travelers available</p>
              </div>
            )}

            {selectedDeparture && (
              <div className="price-summary-card">
                <div className="summary-row"><span>Price per person</span><strong>NPR {Number(pkg.price_npr || 0).toLocaleString()}</strong></div>
                <div className="summary-row"><span>Travelers</span><strong>{travelersCount}</strong></div>
                <div className="summary-row divider"><span>Departure date</span><strong>{new Date(selectedDeparture.departure_date).toLocaleDateString()}</strong></div>
                <div className="summary-row total"><span>Total amount</span><strong>NPR {(Number(pkg.price_npr || 0) * travelersCount).toLocaleString()}</strong></div>
              </div>
            )}

            <button
              className={`btn-primary btn-book-now ${!selectedDeparture || departures.length === 0 ? 'disabled' : ''}`}
              onClick={handleBooking}
              disabled={!selectedDeparture || departures.length === 0}
            >
              {selectedDeparture ? 'Proceed to Booking' : 'Select a Departure'}
            </button>

            {error && <p className="alert alert-error" style={{ marginTop: '12px' }}>{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

