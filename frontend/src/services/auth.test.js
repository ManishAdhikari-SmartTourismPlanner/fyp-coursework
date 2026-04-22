import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateUser,
  createAgent,
  deleteAgency,
  deleteUser,
  fetchAdminAnalytics,
  fetchAgencies,
  fetchAuditLogs,
  fetchMe,
  fetchPublicAgencies,
  fetchUsers,
  loginWithUsername,
  logoutSession,
  registerTourist,
  requestPasswordReset,
  resetPasswordWithOtp,
  tokenStore,
  updateProfile,
  verifyRegistrationOtp,
  deactivateUser,
} from './auth'

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: (name) => (name === 'content-type' ? 'application/json' : ''),
    },
    json: async () => body,
  }
}

describe('auth service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('stores and clears session tokens', () => {
    tokenStore.setSession({ access: 'a', refresh: 'r', user: { username: 'manish' } })
    expect(tokenStore.getAccess()).toBe('a')
    expect(tokenStore.getRefresh()).toBe('r')
    expect(tokenStore.getUser()).toEqual({ username: 'manish' })

    tokenStore.clear()
    expect(tokenStore.getAccess()).toBeNull()
  })

  it('logs in and fetches the current user', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      access: 'access-token',
      refresh: 'refresh-token',
      user: { id: 1, username: 'tourist', role: 'tourist' },
    }))

    const loginResult = await loginWithUsername('tourist', 'Pass12345!')
    expect(loginResult.user.username).toBe('tourist')
    expect(tokenStore.getAccess()).toBe('access-token')

    fetch.mockResolvedValueOnce(jsonResponse({ id: 1, username: 'tourist', role: 'tourist' }))
    const me = await fetchMe()
    expect(me.username).toBe('tourist')
  })

  it('raises readable errors and clears on logout', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'Invalid username or password.' }, false, 401))

    await expect(loginWithUsername('tourist', 'wrong')).rejects.toThrow('Invalid username or password.')

    tokenStore.setSession({ access: 'access-token', refresh: 'refresh-token', user: { username: 'tourist' } })
    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'Logged out successfully.' }))
    await logoutSession()
    expect(tokenStore.getAccess()).toBeNull()
  })

  it('calls the remaining auth endpoints with the right payloads', async () => {
    tokenStore.setSession({ access: 'access-token', refresh: 'refresh-token', user: { username: 'tourist' } })

    fetch.mockResolvedValueOnce(jsonResponse({ otp_required: true }))
    await registerTourist({ username: 'new_user', email: 'new@example.com', password: 'Pass12345!', confirm_password: 'Pass12345!' })

    fetch.mockResolvedValueOnce(jsonResponse({ otp_required: true }))
    await requestPasswordReset('reset@example.com')

    fetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await resetPasswordWithOtp('challenge', '123456', 'NewPass123!', 'NewPass123!')

    fetch.mockResolvedValueOnce(jsonResponse({ access: 'a', refresh: 'r', user: { id: 2, username: 'verified', role: 'tourist' } }))
    await verifyRegistrationOtp('challenge', '123456')

    fetch.mockResolvedValueOnce(jsonResponse({ id: 5, username: 'agent', email: 'agent@example.com' }))
    await createAgent({ username: 'agent', email: 'agent@example.com', password: 'Pass12345!' }, 'access-token')

    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
    await fetchUsers('access-token')

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deactivateUser(10, 'access-token')

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await activateUser(10, 'access-token')

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deleteUser(10, 'access-token')

    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
    await fetchAgencies('access-token')

    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
    await fetchPublicAgencies()

    fetch.mockResolvedValueOnce(jsonResponse({ users: 1 }))
    await fetchAdminAnalytics('access-token')

    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
    await fetchAuditLogs('access-token')

    fetch.mockResolvedValueOnce(jsonResponse({ id: 77, username: 'tourist2', email: 'tourist2@example.com' }))
    await updateProfile({ username: 'tourist2', email: 'tourist2@example.com' })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 9 }))
    await deleteAgency(9, 'access-token')

    const calledUrls = fetch.mock.calls.map(([url]) => url)
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/register/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/forgot-password/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/reset-password/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/verify-otp/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/agents/create/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/users/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/users/10/deactivate/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/users/10/activate/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/agencies/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/agencies/public/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/admin/analytics/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/admin/audit-logs/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/me/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/auth/agencies/9/')
  })
})
