import { useState, useEffect } from 'react'
import { fetchDestinations } from '../services/tourism'

export default function DestinationSearchPage() {
  const [destinations, setDestinations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [filters, setFilters] = useState({
    province: '',
    tour_type: '',
    difficulty: '',
    best_season: '',
  })
  const [selectedDestination, setSelectedDestination] = useState(null)

  useEffect(() => {
    loadDestinations()
  }, [search, filters])

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

  async function loadDestinations() {
    setLoading(true)
    setError('')
    try {
      const params = {
        search: search,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      }
      const data = await fetchDestinations(params)
      const rows = await loadAllPages(fetchDestinations, data)
      setDestinations(rows)
    } catch (err) {
      setError(err.message || 'Failed to load destinations')
    } finally {
      setLoading(false)
    }
  }

  function updateFilter(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  function clearFilters() {
    setFilters({
      province: '',
      tour_type: '',
      difficulty: '',
      best_season: '',
    })
    setSearch('')
  }

  function getSortedDestinations() {
    let sorted = [...destinations]
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'altitude':
        return sorted.sort((a, b) => b.altitude_m - a.altitude_m)
      case 'difficulty':
        const diffLevel = { easy: 1, moderate: 2, hard: 3 }
        return sorted.sort((a, b) => diffLevel[a.difficulty] - diffLevel[b.difficulty])
      default:
        return sorted
    }
  }

  const getRatingStars = (rating) => {
    const stars = []
    for (let i = 0; i < 5; i++) {
      stars.push(<span key={i}>{i < Math.floor(rating) ? '' : ''}</span>)
    }
    return stars
  }

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1> Explore Destinations</h1>
          <p>Discover amazing places to visit in Nepal - Information Only</p>
        </div>

        {/* Search & Filters */}
        <div className="search-filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search destinations by name or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filters-grid">
            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="name">Name (A-Z)</option>
                <option value="altitude">Altitude (Highest)</option>
                <option value="difficulty">Difficulty (Easiest)</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Tour Type</label>
              <select
                value={filters.tour_type}
                onChange={(e) => updateFilter('tour_type', e.target.value)}
                className="filter-select"
              >
                <option value="">All Types</option>
                <option value="trekking">Trekking</option>
                <option value="traveling">Traveling</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Difficulty Level</label>
              <select
                value={filters.difficulty}
                onChange={(e) => updateFilter('difficulty', e.target.value)}
                className="filter-select"
              >
                <option value="">All Levels</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Best Season</label>
              <select
                value={filters.best_season}
                onChange={(e) => updateFilter('best_season', e.target.value)}
                className="filter-select"
              >
                <option value="">All Seasons</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="autumn">Autumn</option>
                <option value="winter">Winter</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Province</label>
              <select
                value={filters.province}
                onChange={(e) => updateFilter('province', e.target.value)}
                className="filter-select"
              >
                <option value="">All Provinces</option>
                <option value="Bagmati">Bagmati</option>
                <option value="Gandaki">Gandaki</option>
                <option value="Lumbini">Lumbini</option>
                <option value="Karnali">Karnali</option>
                <option value="Sudurpaschim">Sudurpaschim</option>
              </select>
            </div>

            <button className="btn-clear-filters" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </div>

        {error && <p className="alert alert-error">{error}</p>}
        {loading && <p className="loading-text">Loading destinations...</p>}

        {!loading && destinations.length === 0 && (
          <p className="no-results">No destinations found. Try adjusting your filters.</p>
        )}

        {!loading && destinations.length > 0 && (
          <div className="destinations-grid">
            {getSortedDestinations().map((dest) => (
              <div
                key={dest.id}
                className="destination-card"
                onClick={() => setSelectedDestination(dest)}
              >
                <div className="dest-card-image">
                  {dest.image_url && (
                    <img src={dest.image_url} alt={dest.name} className="destination-image" />
                  )}
                  <div className="dest-card-overlay">
                    <button className="btn-view-details">View Details</button>
                  </div>
                </div>
                <div className="destination-content">
                  <h3>{dest.name}</h3>
                  <p className="destination-location">
                     {dest.province}, {dest.district}
                  </p>
                  <div className="dest-meta-info">
                    <span className="meta-badge"> {dest.altitude_m}m</span>
                    <span className="meta-badge"> {dest.suggested_duration_days}d</span>
                  </div>
                  <div className="destination-badges">
                    <span className={`badge badge-${dest.tour_type}`}>{dest.tour_type}</span>
                    <span className={`badge badge-${dest.difficulty}`}>
                      {dest.difficulty.charAt(0).toUpperCase() + dest.difficulty.slice(1)}
                    </span>
                  </div>
                  <div className="dest-footer">
                    <p className="destination-packages"> {dest.packages_count} packages</p>
                    <span className="season-badge"> {dest.best_season}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Destination Detail Modal */}
        {selectedDestination && (
          <div className="modal-overlay" onClick={() => setSelectedDestination(null)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedDestination(null)}>|</button>
              <div className="destination-detail">
                {selectedDestination.image_url && (
                  <div className="detail-image-container">
                    <img
                      src={selectedDestination.image_url}
                      alt={selectedDestination.name}
                      className="detail-image"
                    />
                  </div>
                )}
                <div className="destination-detail-content">
                  <h2>{selectedDestination.name}</h2>
                  <p className="location-full">
                     {selectedDestination.province}, {selectedDestination.district}
                    {selectedDestination.nearest_city && ` (near ${selectedDestination.nearest_city})`}
                  </p>
                  <div className="detail-description">
                    <p>{selectedDestination.description}</p>
                  </div>
                  
                  <div className="detail-sections">
                    <div className="detail-section">
                      <h4> Key Information</h4>
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="info-label">Altitude</span>
                          <span className="info-value">{selectedDestination.altitude_m.toLocaleString()}m</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Duration</span>
                          <span className="info-value">{selectedDestination.suggested_duration_days} days</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Best Season</span>
                          <span className="info-value">{selectedDestination.best_season}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Tour Type</span>
                          <span className="info-value">{selectedDestination.tour_type}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Difficulty</span>
                          <span className="info-value">{selectedDestination.difficulty}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Available Tours</span>
                          <span className="info-value">{selectedDestination.packages_count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

