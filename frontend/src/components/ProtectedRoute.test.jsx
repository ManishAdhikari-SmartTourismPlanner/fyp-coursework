import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  user: null,
  loading: false,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
  }
})

import ProtectedRoute from './ProtectedRoute'

describe('ProtectedRoute', () => {
  it('shows the loading shell while auth is resolving', () => {
    authState.user = null
    authState.loading = true

    render(<ProtectedRoute><div>Secret</div></ProtectedRoute>)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects unauthenticated users and role mismatches', () => {
    authState.loading = false
    authState.user = null

    const { rerender } = render(<ProtectedRoute><div>Secret</div></ProtectedRoute>)
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login')

    authState.user = { role: 'tourist' }
    rerender(<ProtectedRoute role="agent"><div>Secret</div></ProtectedRoute>)
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/tourist')
  })

  it('renders children for allowed users', () => {
    authState.loading = false
    authState.user = { role: 'agent' }

    render(<ProtectedRoute role="agent"><div>Secret</div></ProtectedRoute>)

    expect(screen.getByText('Secret')).toBeInTheDocument()
  })
})
