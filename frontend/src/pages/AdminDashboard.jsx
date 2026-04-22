import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  activateUser,
  createAgency,
  deactivateUser,
  deleteUser,
  fetchAdminAnalytics,
  fetchAgencies,
  fetchAuditLogs,
  fetchUsers,
  tokenStore,
  updateAgency,
  updateUser,
} from '../services/auth'
import { fetchAllPayments, fetchCancelledPackageRefunds, refundCancelledPackagePayment } from '../services/tourism'
import { buildMonthlySeries } from '../utils/analytics'

const AnalyticsCharts = lazy(() => import('../components/AnalyticsCharts'))

const SIDEBAR_SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'agencies', label: 'Agencies' },
  { key: 'payments', label: 'Payments' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'audit', label: 'Audit Logs' },
]

function asList(data) {
  if (Array.isArray(data)) {
    return data
  }
  if (Array.isArray(data?.results)) {
    return data.results
  }
  return []
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const accessToken = tokenStore.getAccess()

  const [activeSection, setActiveSection] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [users, setUsers] = useState([])
  const [agencies, setAgencies] = useState([])
  const [payments, setPayments] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [refundQueue, setRefundQueue] = useState([])

  const [agencyForm, setAgencyForm] = useState({ username: '', email: '', password: '' })
  const [agencyLoading, setAgencyLoading] = useState(false)
  const [agencyMessage, setAgencyMessage] = useState('')

  const [userActionLoadingId, setUserActionLoadingId] = useState(null)
  const [agencyActionLoadingId, setAgencyActionLoadingId] = useState(null)
  const [refundActionLoadingId, setRefundActionLoadingId] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm, setEditForm] = useState({ username: '', email: '', first_name: '', last_name: '' })

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    setError('')
    try {
      const [usersRes, agenciesRes, paymentsRes, analyticsRes, auditRes] = await Promise.all([
        fetchUsers(accessToken),
        fetchAgencies(accessToken),
        fetchAllPayments(),
        fetchAdminAnalytics(accessToken),
        fetchAuditLogs(accessToken),
      ])

      const refundRes = await fetchCancelledPackageRefunds()

      setUsers(asList(usersRes))
      setAgencies(asList(agenciesRes))
      setPayments(asList(paymentsRes))
      setAnalytics(analyticsRes || null)
      setAuditLogs(asList(auditRes))
      setRefundQueue(asList(refundRes))
    } catch (err) {
      setError(err.message || 'Failed to load admin dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  async function reloadUsersAndAudit() {
    const [usersRes, auditRes] = await Promise.all([
      fetchUsers(accessToken),
      fetchAuditLogs(accessToken),
    ])
    setUsers(asList(usersRes))
    setAuditLogs(asList(auditRes))
  }

  async function reloadAgenciesAndAudit() {
    const [agenciesRes, usersRes, auditRes] = await Promise.all([
      fetchAgencies(accessToken),
      fetchUsers(accessToken),
      fetchAuditLogs(accessToken),
    ])
    setAgencies(asList(agenciesRes))
    setUsers(asList(usersRes))
    setAuditLogs(asList(auditRes))
  }

  async function handleDeactivateUser(targetUser) {
    const ok = window.confirm(`Deactivate user ${targetUser.username}?`)
    if (!ok) {
      return
    }

    setUserActionLoadingId(targetUser.id)
    setError('')
    try {
      await deactivateUser(targetUser.id, accessToken)
      await reloadUsersAndAudit()
    } catch (err) {
      setError(err.message || 'Failed to deactivate user.')
    } finally {
      setUserActionLoadingId(null)
    }
  }

  async function handleActivateUser(targetUser) {
    setUserActionLoadingId(targetUser.id)
    setError('')
    try {
      await activateUser(targetUser.id, accessToken)
      await reloadUsersAndAudit()
    } catch (err) {
      setError(err.message || 'Failed to activate user.')
    } finally {
      setUserActionLoadingId(null)
    }
  }

  async function handleDeleteUser(targetUser) {
    const ok = window.confirm(`Delete user ${targetUser.username}? This cannot be undone.`)
    if (!ok) {
      return
    }

    setUserActionLoadingId(targetUser.id)
    setError('')
    try {
      await deleteUser(targetUser.id, accessToken)
      await reloadUsersAndAudit()
    } catch (err) {
      setError(err.message || 'Failed to delete user.')
    } finally {
      setUserActionLoadingId(null)
    }
  }

  function updateAgencyField(e) {
    const { name, value } = e.target
    setAgencyForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleCreateAgency(e) {
    e.preventDefault()
    setAgencyLoading(true)
    setAgencyMessage('')
    setError('')

    try {
      await createAgency(agencyForm, accessToken)
      setAgencyForm({ username: '', email: '', password: '' })
      setAgencyMessage('Agency created successfully.')
      await reloadAgenciesAndAudit()
    } catch (err) {
      setError(err.message || 'Failed to create agency.')
    } finally {
      setAgencyLoading(false)
    }
  }

  async function handleDeactivateAgency(agency) {
    const ok = window.confirm(`Deactivate agency ${agency.username}?`)
    if (!ok) {
      return
    }

    setAgencyActionLoadingId(agency.id)
    setError('')
    try {
      await deactivateUser(agency.id, accessToken)
      await reloadAgenciesAndAudit()
    } catch (err) {
      setError(err.message || 'Failed to deactivate agency.')
    } finally {
      setAgencyActionLoadingId(null)
    }
  }

  async function handleActivateAgency(agency) {
    setAgencyActionLoadingId(agency.id)
    setError('')
    try {
      await activateUser(agency.id, accessToken)
      await reloadAgenciesAndAudit()
    } catch (err) {
      setError(err.message || 'Failed to activate agency.')
    } finally {
      setAgencyActionLoadingId(null)
    }
  }

  async function handleRefundPayment(row) {
    const ok = window.confirm(`Refund NPR ${Number(row.amount_npr || 0).toLocaleString()} to ${row.tourist_username} for booking ${row.booking_code}?`)
    if (!ok) {
      return
    }

    setRefundActionLoadingId(row.payment_id)
    setError('')
    try {
      await refundCancelledPackagePayment(row.payment_id)
      await loadDashboardData()
    } catch (err) {
      setError(err.message || 'Failed to refund payment.')
    } finally {
      setRefundActionLoadingId(null)
    }
  }

  function handleStartEditUser(targetUser) {
    setEditModal({ type: 'user', id: targetUser.id, role: targetUser.role })
    setEditForm({
      username: targetUser.username || '',
      email: targetUser.email || '',
      first_name: targetUser.first_name || '',
      last_name: targetUser.last_name || '',
    })
  }

  function handleStartEditAgency(agency) {
    setEditModal({ type: 'agency', id: agency.id, role: 'agent' })
    setEditForm({
      username: agency.username || '',
      email: agency.email || '',
      first_name: agency.first_name || '',
      last_name: agency.last_name || '',
    })
  }

  function closeEditModal() {
    if (editLoading) return
    setEditModal(null)
  }

  function updateEditField(e) {
    const { name, value } = e.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmitEdit(e) {
    e.preventDefault()
    if (!editModal) return

    setEditLoading(true)
    setError('')
    try {
      const payload = {
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
      }

      if (editModal.type === 'user') {
        await updateUser(editModal.id, payload, accessToken)
        await reloadUsersAndAudit()
      } else {
        await updateAgency(editModal.id, payload, accessToken)
        await reloadAgenciesAndAudit()
      }
      setEditModal(null)
    } catch (err) {
      setError(err.message || 'Failed to update record.')
    } finally {
      setEditLoading(false)
    }
  }

  const userStats = useMemo(() => ({
    total: users.length,
    tourists: users.filter((u) => u.role === 'tourist').length,
    agencies: users.filter((u) => u.role === 'agent').length,
    admins: users.filter((u) => u.role === 'admin').length,
    inactive: users.filter((u) => !u.is_active).length,
  }), [users])

  const paymentStats = useMemo(() => {
    const totalRevenue = payments
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + Number(p.amount_npr || 0), 0)

    return {
      total: payments.length,
      success: payments.filter((p) => p.status === 'success').length,
      pending: payments.filter((p) => p.status === 'pending').length,
      failed: payments.filter((p) => p.status === 'failed').length,
      totalRevenue,
    }
  }, [payments])

  const userPieData = useMemo(() => ([
    { name: 'Tourists', value: userStats.tourists, color: '#2563eb' },
    { name: 'Agencies', value: userStats.agencies, color: '#0f766e' },
    { name: 'Admins', value: userStats.admins, color: '#7c3aed' },
  ]), [userStats])

  const revenueTrendData = useMemo(() => buildMonthlySeries(
    payments.filter((payment) => payment.status === 'success'),
    'created_at',
    (payment) => Number(payment.amount_npr || 0)
  ), [payments])

  const bookingStatusData = useMemo(() => ([
    { label: 'Confirmed', value: analytics?.bookings?.confirmed || 0 },
    { label: 'Pending', value: analytics?.bookings?.pending || 0 },
    { label: 'Cancelled', value: analytics?.bookings?.cancelled || 0 },
  ]), [analytics])

  const bookingTotal = bookingStatusData.reduce((sum, item) => sum + Number(item.value || 0), 0)

  if (loading) {
    return (
      <div className="dashboard">
        <Navbar />
        <main className="dashboard-main">
          <p className="loading-text">Loading admin dashboard...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard admin-dashboard-modern">
      <Navbar />
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <h2>Admin Portal</h2>
            <p>Signed in as <strong>{user?.username}</strong></p>
          </div>

          <nav className="admin-sidebar-nav">
            {SIDEBAR_SECTIONS.map((item) => (
              <button
                key={item.key}
                className={`admin-nav-item ${activeSection === item.key ? 'active' : ''}`}
                onClick={() => setActiveSection(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <button className="btn-secondary btn-block" onClick={loadDashboardData}>Refresh Data</button>
          </div>
        </aside>

        <main className="admin-content">
          {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

          {activeSection === 'overview' && (
            <section className="admin-section">
              <div className="content-header">
                <h1>Admin Overview</h1>
                <p>Control users, agencies, transactions, analytics and audit logs.</p>
              </div>

              <div className="metrics-grid">
                <div className="metric-card primary">
                  <div className="metric-info">
                    <p className="metric-value">{userStats.total}</p>
                    <p className="metric-label">Total Users</p>
                  </div>
                </div>
                <div className="metric-card accent">
                  <div className="metric-info">
                    <p className="metric-value">{userStats.agencies}</p>
                    <p className="metric-label">Agencies</p>
                  </div>
                </div>
                <div className="metric-card success">
                  <div className="metric-info">
                    <p className="metric-value">{paymentStats.success}</p>
                    <p className="metric-label">Successful Payments</p>
                  </div>
                </div>
                <div className="metric-card special">
                  <div className="metric-info">
                    <p className="metric-value">NPR {Math.round(paymentStats.totalRevenue).toLocaleString()}</p>
                    <p className="metric-label">Revenue</p>
                  </div>
                </div>
              </div>

              <div className="admin-overview-grid">
                <div className="card">
                  <h3>User Summary</h3>
                  <p>Tourists: <strong>{userStats.tourists}</strong></p>
                  <p>Agencies: <strong>{userStats.agencies}</strong></p>
                  <p>Admins: <strong>{userStats.admins}</strong></p>
                  <p>Inactive users: <strong>{userStats.inactive}</strong></p>
                </div>
                <div className="card">
                  <h3>Payment Summary</h3>
                  <p>Total payments: <strong>{paymentStats.total}</strong></p>
                  <p>Pending payments: <strong>{paymentStats.pending}</strong></p>
                  <p>Failed payments: <strong>{paymentStats.failed}</strong></p>
                </div>
                <div className="card">
                  <h3>Audit Activity</h3>
                  <p>Total log entries: <strong>{auditLogs.length}</strong></p>
                  <p>Latest action: <strong>{auditLogs[0]?.action || 'N/A'}</strong></p>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'users' && (
            <section className="admin-section">
              <div className="content-header">
                <h1>User Management</h1>
                <p>Deactivate, activate, or delete users from the platform.</p>
              </div>

              <div className="card">
                <div className="modern-table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.username}</td>
                          <td>{u.email || '-'}</td>
                          <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                          <td>
                            <span className={`badge badge-${u.is_active ? 'success' : 'muted'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="admin-action-buttons">
                              {u.is_active ? (
                                <button
                                  className="admin-action-btn warning"
                                  disabled={userActionLoadingId === u.id || u.role === 'admin'}
                                  onClick={() => handleDeactivateUser(u)}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  className="admin-action-btn activate"
                                  disabled={userActionLoadingId === u.id}
                                  onClick={() => handleActivateUser(u)}
                                >
                                  Activate
                                </button>
                              )}
                              <button
                                className="admin-action-btn info"
                                disabled={userActionLoadingId === u.id}
                                onClick={() => handleStartEditUser(u)}
                              >
                                Edit
                              </button>
                              <button
                                className="admin-action-btn danger"
                                disabled={userActionLoadingId === u.id || u.role === 'admin'}
                                onClick={() => handleDeleteUser(u)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'agencies' && (
            <section className="admin-section">
              <div className="content-header">
                <h1>Agency Management</h1>
                <p>Add and manage agency status from a dedicated section.</p>
              </div>

              <div className="content-grid">
                <div className="card form-card">
                  <h3>Add Agency</h3>
                  {agencyMessage && <div className="alert alert-success">{agencyMessage}</div>}
                  <form className="modern-form" onSubmit={handleCreateAgency}>
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        name="username"
                        value={agencyForm.username}
                        onChange={updateAgencyField}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        name="email"
                        type="email"
                        value={agencyForm.email}
                        onChange={updateAgencyField}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        name="password"
                        type="password"
                        value={agencyForm.password}
                        onChange={updateAgencyField}
                        required
                      />
                    </div>
                    <button className="btn-primary" type="submit" disabled={agencyLoading}>
                      {agencyLoading ? 'Adding...' : 'Add Agency'}
                    </button>
                  </form>
                </div>

                <div className="card list-card">
                  <h3>All Agencies ({agencies.length})</h3>
                  <div className="modern-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agencies.map((agency) => (
                          <tr key={agency.id}>
                            <td>{agency.username}</td>
                            <td>{agency.email || '-'}</td>
                            <td>
                              <span className={`badge badge-${agency.is_active ? 'success' : 'muted'}`}>
                                {agency.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              {agency.is_active ? (
                                <button
                                  className="admin-action-btn warning"
                                  disabled={agencyActionLoadingId === agency.id}
                                  onClick={() => handleDeactivateAgency(agency)}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  className="admin-action-btn activate"
                                  disabled={agencyActionLoadingId === agency.id}
                                  onClick={() => handleActivateAgency(agency)}
                                >
                                  Activate
                                </button>
                              )}
                              <button
                                className="admin-action-btn info"
                                disabled={agencyActionLoadingId === agency.id}
                                onClick={() => handleStartEditAgency(agency)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'payments' && (
            <section className="admin-section">
              <div className="content-header">
                <h1>Payment Monitoring</h1>
                <p>Review all payments in one place.</p>
              </div>

              <div className="card">
                <div className="modern-table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.booking_code || '-'}</td>
                          <td>NPR {Number(p.amount_npr || 0).toLocaleString()}</td>
                          <td>{p.method}</td>
                          <td>
                            <span className={`badge badge-${p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ marginTop: '20px' }}>
                <h3>Cancelled Package Refund Queue</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Users who paid via Khalti for packages cancelled by agencies.
                </p>
                <div className="modern-table-wrapper" style={{ marginTop: '12px' }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Package</th>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Payment Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundQueue.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-state">No cancelled-package refunds pending.</td>
                        </tr>
                      ) : refundQueue.map((row) => (
                        <tr key={row.payment_id}>
                          <td>{row.booking_code}</td>
                          <td>{row.package_title}</td>
                          <td>{row.tourist_username}</td>
                          <td>NPR {Number(row.amount_npr || 0).toLocaleString()}</td>
                          <td>
                            <span className={`badge badge-${row.status === 'refunded' ? 'success' : 'warning'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            {row.can_refund ? (
                              <button
                                className="admin-action-btn activate"
                                disabled={refundActionLoadingId === row.payment_id}
                                onClick={() => handleRefundPayment(row)}
                              >
                                Refund via Khalti
                              </button>
                            ) : (
                              <span className="badge badge-success">Refunded</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'analytics' && (
            <section className="admin-section">
              <div className="content-header">
                <h1>Analytics Report</h1>
                <p>Platform metrics from users, bookings and payments.</p>
              </div>

              <Suspense fallback={<div className="dashboard-chart-loading">Loading analytics charts...</div>}>
                <AnalyticsCharts
                  pieTitle="User Mix"
                  pieDescription="How your platform users are distributed by role."
                  pieData={userPieData}
                  pieTotalLabel="Total users"
                  pieTotalValue={userStats.total}
                  pieLegendItems={userPieData}
                  lineTitle="Monthly Revenue"
                  lineDescription="Successful payment revenue over time."
                  lineData={revenueTrendData}
                  lineValueSuffix=" NPR"
                  lineStroke="#2563eb"
                  lineTotalLabel="Revenue"
                  lineTotalValue={paymentStats.totalRevenue}
                  lineTotalSuffix=" NPR"
                  lineLegendItems={[{ label: 'Revenue trend', color: '#2563eb' }]}
                  barTitle="Booking Status"
                  barDescription="Current booking health across the platform."
                  barData={bookingStatusData}
                  barColor="#0f766e"
                  barTotalLabel="Bookings"
                  barTotalValue={bookingTotal}
                  barLegendItems={[{ label: 'Status breakdown', color: '#0f766e' }]}
                />
              </Suspense>

              <div className="analytics-grid">
                <div className="card analytics-card">
                  <h3>Users</h3>
                  <div className="analytics-item"><span>Total</span><strong>{analytics?.users?.total || 0}</strong></div>
                  <div className="analytics-item"><span>Tourists</span><strong>{analytics?.users?.tourists || 0}</strong></div>
                  <div className="analytics-item"><span>Agencies</span><strong>{analytics?.users?.agencies || 0}</strong></div>
                  <div className="analytics-item"><span>Active</span><strong>{analytics?.users?.active || 0}</strong></div>
                </div>

                <div className="card analytics-card">
                  <h3>Bookings</h3>
                  <div className="analytics-item"><span>Total</span><strong>{analytics?.bookings?.total || 0}</strong></div>
                  <div className="analytics-item"><span>Confirmed</span><strong>{analytics?.bookings?.confirmed || 0}</strong></div>
                  <div className="analytics-item"><span>Pending</span><strong>{analytics?.bookings?.pending || 0}</strong></div>
                  <div className="analytics-item"><span>Cancelled</span><strong>{analytics?.bookings?.cancelled || 0}</strong></div>
                </div>

                <div className="card analytics-card">
                  <h3>Payments</h3>
                  <div className="analytics-item"><span>Total</span><strong>{analytics?.payments?.total || 0}</strong></div>
                  <div className="analytics-item"><span>Success</span><strong>{analytics?.payments?.success || 0}</strong></div>
                  <div className="analytics-item"><span>Pending</span><strong>{analytics?.payments?.pending || 0}</strong></div>
                  <div className="analytics-item"><span>Revenue</span><strong>NPR {Number(analytics?.payments?.total_revenue_npr || 0).toLocaleString()}</strong></div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'audit' && (
            <section className="admin-section">
              <div className="content-header">
                <h1>Audit Logs</h1>
                <p>Track admin actions for accountability.</p>
              </div>

              <div className="card">
                <div className="modern-table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.created_at).toLocaleString()}</td>
                          <td>{log.action}</td>
                          <td>{log.actor_username || 'system'}</td>
                          <td>{log.target_display || `${log.target_type}:${log.target_id}`}</td>
                          <td>{Object.keys(log.metadata || {}).length ? JSON.stringify(log.metadata) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {editModal && (
            <div className="admin-edit-overlay" onClick={closeEditModal}>
              <div className="card admin-edit-modal" onClick={(e) => e.stopPropagation()}>
                <h3>{editModal.type === 'user' ? 'Edit User' : 'Edit Agency'}</h3>
                <p className="auth-note" style={{ marginTop: 0 }}>
                  Update account details for this {editModal.type === 'user' ? (editModal.role || 'user') : 'agency'}.
                </p>

                <form className="modern-form" onSubmit={handleSubmitEdit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Username</label>
                      <input name="username" value={editForm.username} onChange={updateEditField} required />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input name="email" type="email" value={editForm.email} onChange={updateEditField} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input name="first_name" value={editForm.first_name} onChange={updateEditField} />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input name="last_name" value={editForm.last_name} onChange={updateEditField} />
                    </div>
                  </div>

                  <div className="admin-edit-actions">
                    <button className="btn-primary" type="submit" disabled={editLoading}>
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button className="btn-secondary" type="button" disabled={editLoading} onClick={closeEditModal}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
