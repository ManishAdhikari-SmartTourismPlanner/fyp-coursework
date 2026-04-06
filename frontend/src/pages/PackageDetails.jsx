import { useState, useEffect } from 'react'
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
      const pkgData = await fetchPackageDetail(id)
      setPkg(pkgData)
      
      if (pkgData.departures) {
        setDepartures(pkgData.departures)
      }
    } catch (err) {
      setError(err.message || 'Failed to load package details')
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) return <div className="dashboard"><div className="loading-text">Loading...</div></div>
  if (error) return <div className="dashboard"><div className="alert alert-error">{error}</div></div>
  if (!pkg) return <div className="dashboard"><p>Package not found</p></div>

  const priceCategory = getPriceCategory(pkg.price_npr)

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <button className="btn-back" onClick={() => navigate(-1)}> Back</button>

        {/* Header with Price Category */}
        <div className={`package-header-section ${pkg.package_type === 'deluxe' ? 'deluxe' : 'standard'}`}>
          <div className="package-header-badges">
            <span className={`package-type-badge badge-${pkg.package_type}`}>
              {getPackageTypeLabel(pkg.package_type)}
            </span>
            <span className={`price-category-badge category-${priceCategory.color}`}>
              {priceCategory.label}
            </span>
          </div>
          <h1>{pkg.title}</h1>
          <p className="package-destination"> {pkg.destination.name}  {pkg.destination.province}</p>
        </div>

        {/* Two Column Layout */}
        <div className="package-detail-layout">
          {/* Left Column: Details */}
          <div className="package-details-column">
            {/* Tabs */}
            <div className="package-tabs">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`}
                onClick={() => setActiveTab('itinerary')}
              >
                Itinerary
              </button>
              <button
                className={`tab-btn ${activeTab === 'includes' ? 'active' : ''}`}
                onClick={() => setActiveTab('includes')}
              >
                Includes & Excludes
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="tab-content">
                <p className="package-full-description">{pkg.description}</p>
                
                <div className="overview-cards">
                  <div className="overview-card">
                    <span className="card-icon"></span>
                    <div className="card-text">
                      <strong>Duration</strong>
                      <p>{pkg.duration_days} days</p>
                    </div>
                  </div>
                  <div className="overview-card">
                    <span className="card-icon"></span>
                    <div className="card-text">
                      <strong>Group Size</strong>
                      <p>Max {pkg.max_group_size} people</p>
                    </div>
                  </div>
                  <div className="overview-card">
                    <span className="card-icon">-</span>
                    <div className="card-text">
                      <strong>Tour Type</strong>
                      <p>{pkg.tour_type}</p>
                    </div>
                  </div>
                  <div className="overview-card">
                    <span className="card-icon"></span>
                    <div className="card-text">
                      <strong>Best Season</strong>
                      <p>{pkg.destination.best_season}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'itinerary' && (
              <div className="tab-content">
                <h3> Itinerary</h3>
                <p className="itinerary-text">{pkg.itinerary_overview}</p>
              </div>
            )}

            {activeTab === 'includes' && (
              <div className="tab-content">
                <div className="includes-section">
                  <h4> What's Included</h4>
                  <ul className="includes-list">
                    {pkg.includes && pkg.includes.split('').map((item, i) => (
                      <li key={i}>
                        <span className="checkmark"></span>
                        {item.trim()}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="excludes-section">
                  <h4> What's Excluded</h4>
                  <ul className="excludes-list">
                    {pkg.excludes && pkg.excludes.split('').map((item, i) => (
                      <li key={i}>
                        <span className="crossmark">-</span>
                        {item.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Booking Panel */}
          <div className="booking-sidebar">
            {/* Price Display */}
            <div className="price-display-card">
              <div className="price-block">
                <p className="price-per">Per Person</p>
                <div className="price-number">
                  <span className="currency">NPR</span>
                  <span className="amount">{pkg.price_npr?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Departure Selection */}
            <div className="panel-section">
              <h4> Select Departure</h4>
              
              {departures.length === 0 ? (
                <p className="no-departures">No departures available</p>
              ) : (
                <div className="departures-list">
                  {departures.map((dep) => (
                    <div
                      key={dep.id}
                      className={`departure-option ${selectedDeparture?.id === dep.id ? 'selected' : ''} ${dep.available_seats === 0 ? 'disabled' : ''}`}
                      onClick={() => dep.available_seats > 0 && setSelectedDeparture(dep)}
                    >
                      <div className="departure-date">
                        {new Date(dep.departure_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="departure-seats">
                        {dep.available_seats > 0 ? (
                          <span className={`seats-badge ${dep.available_seats <= 3 ? 'low' : 'available'}`}>
                            {dep.available_seats} seats
                          </span>
                        ) : (
                          <span className="seats-badge full">Full</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Travelers Input */}
            {selectedDeparture && (
              <div className="panel-section">
                <label> Number of Travelers</label>
                <input
                  type="number"
                  min="1"
                  max={selectedDeparture.available_seats}
                  value={travelersCount}
                  onChange={(e) => setTravelersCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="travelers-input"
                />
                <p className="input-hint">Max {selectedDeparture.available_seats} travelers available</p>
              </div>
            )}

            {/* Price Summary */}
            {selectedDeparture && (
              <div className="price-summary-card">
                <div className="summary-row">
                  <span>Price per person:</span>
                  <strong>NPR {pkg.price_npr?.toLocaleString()}</strong>
                </div>
                <div className="summary-row">
                  <span>Number of travelers:</span>
                  <strong>{travelersCount}</strong>
                </div>
                <div className="summary-row divider">
                  <span>Departure Date:</span>
                  <strong>{new Date(selectedDeparture.departure_date).toLocaleDateString()}</strong>
                </div>
                <div className="summary-row total">
                  <span>Total Amount:</span>
                  <strong>NPR {(pkg.price_npr * travelersCount)?.toLocaleString()}</strong>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <button
              className={`btn-primary btn-book-now ${!selectedDeparture || departures.length === 0 ? 'disabled' : ''}`}
              onClick={handleBooking}
              disabled={!selectedDeparture || departures.length === 0}
            >
              {selectedDeparture ? 'Proceed to Booking ' : 'Select a Departure'}
            </button>

            {error && <p className="alert alert-error" style={{ marginTop: '12px' }}>{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

