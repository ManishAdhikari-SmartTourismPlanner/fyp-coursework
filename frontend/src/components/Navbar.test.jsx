import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const navigateMock = vi.fn()
const authState = vi.hoisted(() => ({
  user: { username: 'manish', role: 'tourist' },
  setUser: vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../services/auth', () => ({
  logoutSession: vi.fn(() => Promise.resolve()),
}))

import Navbar from './Navbar'
import { logoutSession } from '../services/auth'

describe('Navbar', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    authState.setUser.mockReset()
  })

  it('renders the current user and logs out', async () => {
    render(<Navbar />)

    expect(screen.getByText('manish')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(logoutSession).toHaveBeenCalledTimes(1)
      expect(authState.setUser).toHaveBeenCalledWith(null)
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})