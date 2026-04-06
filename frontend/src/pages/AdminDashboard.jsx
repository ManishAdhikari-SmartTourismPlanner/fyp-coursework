import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { createAgent, fetchUsers, tokenStore } from '../services/auth'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [agentForm, setAgentForm] = useState({ username: '', email: '', password: '' })
  const [agentError, setAgentError] = useState('')
  const [agentSuccess, setAgentSuccess] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)

  useEffect(() => {
    fetchUsers(tokenStore.getAccess())
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false))
  }, [])

  function updateAgentField(e) {
    setAgentForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCreateAgent(e) {
    e.preventDefault()
    setAgentLoading(true)
    setAgentError('')
    setAgentSuccess('')
    try {
      await createAgent(agentForm, tokenStore.getAccess())
      setAgentSuccess(`Agent "${agentForm.username}" created successfully.`)
      setAgentForm({ username: '', email: '', password: '' })
      const updated = await fetchUsers(tokenStore.getAccess())
      setUsers(updated)
    } catch (err) {
      setAgentError(err.message || 'Failed to create agent.')
    } finally {
      setAgentLoading(false)
    }
  }

  const stats = {
    total: users.length,
    tourists: users.filter(u => u.role === 'tourist').length,
    agents: users.filter(u => u.role === 'agent').length,
    admins: users.filter(u => u.role === 'admin').length,
  }

  return (
    <div className="dashboard">
      <Navbar />
      <main className="dashboard-main">
        <div className="dashboard-header admin-header">
          <h1>Admin Dashboard </h1>
          <p>Welcome, {user?.username}. Manage agents, users and monitor the system.</p>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-card tourist">
            <span className="stat-number">{stats.tourists}</span>
            <span className="stat-label">Tourists</span>
          </div>
          <div className="stat-card agent">
            <span className="stat-number">{stats.agents}</span>
            <span className="stat-label">Agents</span>
          </div>
          <div className="stat-card admin-stat">
            <span className="stat-number">{stats.admins}</span>
            <span className="stat-label">Admins</span>
          </div>
        </div>

        {/* Create Agent + User List */}
        <div className="admin-top-grid">
          <div className="card">
            <h3>| Create New Agent</h3>
            {agentError && <p className="alert alert-error">{agentError}</p>}
            {agentSuccess && <p className="alert alert-success">{agentSuccess}</p>}
            <form className="auth-form" onSubmit={handleCreateAgent}>
              <div className="form-group">
                <label>Username</label>
                <input
                  name="username"
                  value={agentForm.username}
                  onChange={updateAgentField}
                  placeholder="Agent username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={agentForm.email}
                  onChange={updateAgentField}
                  placeholder="agent@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  name="password"
                  type="password"
                  value={agentForm.password}
                  onChange={updateAgentField}
                  placeholder="Min. 8 characters"
                  required
                />
              </div>
              <button className="btn-primary" type="submit" disabled={agentLoading}>
                {agentLoading ? 'Creating...' : 'Create Agent'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3> All Users ({users.length})</h3>
            {usersLoading ? (
              <p className="loading-text">Loading users...</p>
            ) : (
              <div className="user-table-wrapper">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id}>
                        <td>{i + 1}</td>
                        <td>{u.username}</td>
                        <td>{u.email || ''}</td>
                        <td>
                          <span className={`role-badge role-${u.role}`}>{u.role}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* System modules */}
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-icon"></div>
            <h3>Payment Gateway</h3>
            <p>Monitor Khalti/eSewa transactions and reconcile payments.</p>
            <button
              className="btn-secondary"
              onClick={() => alert('Payment monitoring dashboard coming soon!\n\nYou can view payment details in each booking.')}
            >
              View Payments
            </button>
          </div>
          <div className="card">
            <div className="card-icon"></div>
            <h3>Analytics & Reports</h3>
            <p>Bookings, revenue and peak season insights.</p>
            <button
              className="btn-secondary"
              onClick={() => alert('Analytics dashboard coming soon!\n\nYou can see:\n- Total bookings\n- Revenue statistics\n- Peak seasons\n- Popular destinations')}
            >
              View Analytics
            </button>
          </div>
          <div className="card">
            <div className="card-icon"></div>
            <h3>Audit Logs</h3>
            <p>Track agent operations and system events.</p>
            <button
              className="btn-secondary"
              onClick={() => alert('Audit logs coming soon!\n\nYou can track:\n- User login history\n- Booking changes\n- Payment transactions\n- System events')}
            >
              View Logs
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

