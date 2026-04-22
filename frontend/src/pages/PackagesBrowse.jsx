import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchPackages } from '../services/tourism'
import { fetchPublicAgencies } from '../services/auth'

export default function PackagesBrowsePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [destinationFilter, setDestinationFilter] = useState(location.state?.destinationId || '')
  const [priceFilter, setPriceFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState(location.state?.agentId || '')
  const [sortBy, setSortBy] = useState('price-low')
  const [agencies, setAgencies] = useState([])

  useEffect(() => {
    loadAgencies()
  }, [])

  useEffect(() => {
    loadPackages()
  }, [destinationFilter, priceFilter, typeFilter, agentFilter])

  async function loadAgencies() {
    try {
      const data = await fetchPublicAgencies()
      setAgencies(Array.isArray(data) ? data : [])
    } catch {
      setAgencies([])
    }
  }

  async function loadPackages() {
    setLoading(true)
    setError('')
    try {
      if (!agentFilter) {
        setPackages([])
        setLoading(false)
        return
      }

      const params = {
        ...(destinationFilter && { destination: destinationFilter }),
        created_by: agentFilter,
        ordering: '-created_at'
      }
      
      // Load all pages of packages
      let allPackages = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        const data = await fetchPackages({ ...params, page })
        if (data.results) {
          allPackages = [...allPackages, ...data.results]
          hasMore = !!data.next
          page++
        } else {
          allPackages = data
          hasMore = false
        }
      }
      
      setPackages(allPackages)
    } catch (err) {
      setError(err.message || 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  }

  function getSortedAndFilteredPackages() {
    let filtered = [...packages]

    // Filter by price range
    if (priceFilter !== 'all') {
      if (priceFilter === 'budget') {
        filtered = filtered.filter(p => p.price_npr < 50000)
      } else if (priceFilter === 'mid') {
        filtered = filtered.filter(p => p.price_npr >= 50000 && p.price_npr < 150000)
      } else if (priceFilter === 'luxury') {
        filtered = filtered.filter(p => p.price_npr >= 150000)
      }
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(p => p.package_type === typeFilter)
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        return filtered.sort((a, b) => a.price_npr - b.price_npr)
      case 'price-high':
        return filtered.sort((a, b) => b.price_npr - a.price_npr)
      case 'duration':
        return filtered.sort((a, b) => a.duration_days - b.duration_days)
      default:
        return filtered
    }
  }

  function handlePackageClick(pkg) {
    navigate(`/package/${pkg.id}`)
  }

  const getPriceCategory = (price) => {
    if (price < 50000) return { label: ' Budget', color: 'green' }
    if (price < 150000) return { label: ' Mid-Range', color: 'gold' }
    return { label: ' Luxury', color: 'purple' }
  }

  const getPackageTypeLabel = (type) => {
    return type === 'deluxe' ? ' Deluxe' : ' Standard'
  }

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <button className="btn-back" onClick={() => navigate(-1)}> Back to Destinations</button>

        <div className="dashboard-header">
          <h1> Browse Packages</h1>
          <p>Select an agent first, then compare the packages they created.</p>
        </div>

        <div className="card" style={{ marginBottom: '18px' }}>
          <div className="filter-group" style={{ marginBottom: 0 }}>
            <label>Choose Agent</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">Select an agent</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>{agency.username}</option>
              ))}
            </select>
          </div>
          {!agentFilter && <p className="empty-state" style={{ marginTop: '12px' }}>Choose an agent to load their packages.</p>}
        </div>

        {/* Filters Section */}
        <div className="packages-filters-section">
          <div className="filters-row">
            <div className="filter-group">
              <label>Price Range</label>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Prices</option>
                <option value="budget"> Budget (Under 50K)</option>
                <option value="mid"> Mid-Range (50K - 150K)</option>
                <option value="luxury"> Luxury (150K+)</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Package Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="standard"> Standard</option>
                <option value="deluxe"> Deluxe</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="duration">Duration: Short to Long</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p className="alert alert-error">{error}</p>}
        {loading && <p className="loading-text">Loading packages...</p>}

        {!loading && packages.length === 0 && (
          <p className="no-results">No packages found. Try adjusting your filters.</p>
        )}

        {/* Packages Grid */}
        {!loading && getSortedAndFilteredPackages().length > 0 && (
          <div className="packages-grid">
            {getSortedAndFilteredPackages().map((pkg) => {
              const priceCategory = getPriceCategory(pkg.price_npr)
              const destinationName = pkg.destination?.name || pkg.destination_name || 'Destination'
              const agencyName = pkg.created_by?.username || pkg.created_by_username || 'Travel agency'
              const packageDescription = pkg.description || 'Explore this package and check full details on the next page.'
              const includesPreview = pkg.includes
                ? pkg.includes.split('').filter(Boolean).slice(0, 2).join(', ').substring(0, 80) + '...'
                : 'See details'
              return (
                <div key={pkg.id} className={`package-card ${pkg.package_type === 'deluxe' ? 'premium' : 'standard'}`} onClick={() => handlePackageClick(pkg)}>
                  {/* Type Badge */}
                  <div className="package-type-badge">
                    {getPackageTypeLabel(pkg.package_type)}
                  </div>

                  {/* Price Category */}
                  <div className={`price-category-badge category-${priceCategory.color}`}>
                    {priceCategory.label}
                  </div>

                  <div className="package-card-content">
                    {/* Destination & Location */}
                    <div className="package-header">
                      <h3>{pkg.title}</h3>
                      <p className="destination-name"> {destinationName}</p>
                    </div>

                    <p className="package-description" style={{ marginTop: '-2px', marginBottom: '10px' }}>
                      Offered by {agencyName}
                    </p>

                    {/* Description */}
                    <p className="package-description">
                      {packageDescription.substring(0, 120)}...
                    </p>

                    {/* Package Info */}
                    <div className="package-info-badges">
                      <span className="info-badge"> {pkg.duration_days} days</span>
                      <span className="info-badge"> Max {pkg.max_group_size} people</span>
                    </div>

                    {/* Includes Preview */}
                    <div className="package-includes-preview">
                      <p className="includes-label"> Includes:</p>
                      <p className="includes-text">
                        {includesPreview}
                      </p>
                    </div>

                    {/* Price Section */}
                    <div className="package-price-section">
                      <div className="package-price">
                        <span className="currency">NPR</span>
                        <span className="price-amount">{(pkg.price_npr / 1000).toFixed(0)}K</span>
                      </div>
                      <p className="price-label">per person</p>
                    </div>

                    {/* CTA Button */}
                    <button className="btn-view-package">
                      View & Book
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

