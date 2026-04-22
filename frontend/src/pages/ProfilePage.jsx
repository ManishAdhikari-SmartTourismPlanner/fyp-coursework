import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { fetchMe, updateProfile } from '../services/auth'

const ALLOWED_ROLES = ['tourist', 'agent', 'admin']

const ROLE_META = {
  tourist: { label: 'Tourist', subtitle: 'Traveler account profile', badgeClass: 'tourist' },
  agent: { label: 'Agent', subtitle: 'Agency account profile', badgeClass: 'agent' },
  admin: { label: 'Admin', subtitle: 'Platform administrator profile', badgeClass: 'admin' },
}

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const canEdit = ALLOWED_ROLES.includes(user?.role)

  const activeRoleMeta = ROLE_META[user?.role] || {
    label: 'User',
    subtitle: 'Account profile',
    badgeClass: 'tourist',
  }

  const initials = `${form.first_name?.[0] || ''}${form.last_name?.[0] || ''}${form.username?.[0] || ''}`
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      setError('Profile editing is available for user, agent, and admin roles only.')
      setLoading(false)
      return
    }

    fetchMe()
      .then((data) => {
        setForm({
          username: data.username || '',
          email: data.email || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
        })
      })
      .catch((err) => setError(err.message || 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [user, navigate])

  function updateField(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      }

      const updated = await updateProfile(payload)
      setUser((prev) => ({ ...prev, ...updated }))
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard profile-dashboard">
      <Navbar />
      <main className="dashboard-main">
        <section className="profile-shell">
          <div className="profile-hero">
            <div className="profile-avatar" aria-hidden="true">{initials || 'U'}</div>
            <div className="profile-hero-text">
              <h1>My Profile</h1>
              <p>{activeRoleMeta.subtitle}</p>
            </div>
            <span className={`profile-role-badge ${activeRoleMeta.badgeClass}`}>{activeRoleMeta.label}</span>
          </div>

          <div className="profile-grid">
            <div className="card profile-summary-card">
              <h3>Account Summary</h3>
              <div className="profile-summary-list">
                <div className="profile-summary-row">
                  <span>Username</span>
                  <strong>{form.username || '-'}</strong>
                </div>
                <div className="profile-summary-row">
                  <span>Email</span>
                  <strong>{form.email || '-'}</strong>
                </div>
                <div className="profile-summary-row">
                  <span>Role</span>
                  <strong>{activeRoleMeta.label}</strong>
                </div>
              </div>
            </div>

            <div className="card profile-form-card">
              <h3>Edit Details</h3>
              <p className="auth-note">Update your name, username, and email.</p>

              {loading && <p className="loading-text">Loading profile...</p>}
              {error && <p className="alert alert-error">{error}</p>}
              {message && <p className="alert alert-success">{message}</p>}

              {!loading && canEdit && (
                <form className="modern-form" onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input name="first_name" value={form.first_name} onChange={updateField} placeholder="First name" />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input name="last_name" value={form.last_name} onChange={updateField} placeholder="Last name" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Username</label>
                      <input name="username" value={form.username} onChange={updateField} required />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input name="email" type="email" value={form.email} onChange={updateField} required />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button className="btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button className="btn-secondary" type="button" disabled={saving} onClick={() => navigate(-1)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {!loading && !canEdit && <p className="alert alert-error">You do not have access to edit this profile.</p>}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
