import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { fetchPublicAgencies } from '../services/auth'

export default function AgenciesPage() {
  const navigate = useNavigate()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAgencies()
  }, [])

  async function loadAgencies() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPublicAgencies()
      setAgencies(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load agencies.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard">
      <Navbar />
      <main className="dashboard-main" style={{ maxWidth: '1180px', margin: '0 auto', width: '100%' }}>
        <div className="dashboard-header">
          <button className="btn-secondary" onClick={() => navigate('/tourist')}>Back</button>
          <h1 style={{ marginTop: '14px' }}>Agencies & Packages</h1>
          <p>Browse active agencies and directly explore their available packages.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <p className="loading-text">Loading agencies...</p>
        ) : agencies.length === 0 ? (
          <div className="card">
            <p className="empty-state">No active agencies found right now.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {agencies.map((agency) => (
              <section className="card" key={agency.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ marginBottom: '4px' }}>{agency.username}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>{agency.email || 'No email provided'}</p>
                  </div>
                  <span className="badge badge-info">{agency.package_count} Package(s)</span>
                </div>

                <div style={{ marginTop: '14px' }}>
                  {agency.packages?.length ? (
                    <div className="modern-table-wrapper">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Package</th>
                            <th>Destination</th>
                            <th>Agency</th>
                            <th>Type</th>
                            <th>Duration</th>
                            <th>Price</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agency.packages.map((pkg) => (
                            <tr key={pkg.id}>
                              <td><strong>{pkg.title}</strong></td>
                              <td>{pkg.destination_name}</td>
                              <td>{pkg.created_by_username || agency.username}</td>
                              <td>{pkg.package_type}</td>
                              <td>{pkg.duration_days} days</td>
                              <td>NPR {Number(pkg.price_npr || 0).toLocaleString()}</td>
                              <td>
                                <button className="btn-secondary" onClick={() => navigate('/packages', { state: { agentId: agency.id } })}>
                                  Choose Agent
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-state" style={{ marginTop: '12px' }}>This agency has no active packages yet.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
