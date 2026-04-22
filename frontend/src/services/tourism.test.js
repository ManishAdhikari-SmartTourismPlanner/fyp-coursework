import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelBooking,
  cancelPackage,
  confirmBooking,
  createBooking,
  createDestination,
  createPackage,
  createPackageDeparture,
  createPayment,
  deleteDestination,
  deletePackage,
  fetchAllBookings,
  fetchAllPayments,
  fetchBookingDetail,
  fetchBookingPaymentStatus,
  fetchCancelledPackageRefunds,
  fetchDestinationDetail,
  fetchDestinations,
  fetchPackageDetail,
  fetchPackageDepartures,
  fetchPackages,
  fetchPaymentDetail,
  filterPackagesByPrice,
  initiateKhaltiPayment,
  rescheduleBooking,
  refundCancelledPackagePayment,
  updateDestination,
  updatePackage,
  verifyKhaltiPayment,
} from './tourism'
import { tokenStore } from './auth'

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

describe('tourism service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    tokenStore.setSession({ access: 'access-token', refresh: 'refresh-token', user: { username: 'tourist' } })
  })

  it('calls the tourism wrappers with expected endpoints', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await fetchDestinations({ province: 'Bagmati' })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 1 }))
    await fetchDestinationDetail(1)

    fetch.mockResolvedValueOnce(jsonResponse({ id: 2 }))
    await createDestination({ name: 'P', slug: 'p' })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 2 }))
    await updateDestination(2, { name: 'P2' })

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deleteDestination(2)

    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await fetchPackages({ created_by: 3 })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 4 }))
    await fetchPackageDetail(4)

    fetch.mockResolvedValueOnce(jsonResponse({ id: 5 }))
    await createPackage({ title: 'PK' })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 5 }))
    await updatePackage(5, { title: 'PK2' })

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await deletePackage(5)

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await cancelPackage(5)

    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await fetchPackageDepartures(5)

    fetch.mockResolvedValueOnce(jsonResponse({ id: 6 }))
    await createPackageDeparture({ package_id: 5 })

    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await filterPackagesByPrice(1000, 2000)

    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await fetchAllBookings({ status: 'confirmed' })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 7 }))
    await createBooking({ package_id: 5 })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 7 }))
    await fetchBookingDetail(7)

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await cancelBooking(7)

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await confirmBooking(7)

    fetch.mockResolvedValueOnce(jsonResponse({ id: 7 }))
    await fetchBookingPaymentStatus(7)

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await rescheduleBooking(7, 8)

    fetch.mockResolvedValueOnce(jsonResponse({ id: 9 }))
    await createPayment({ booking_id: 7 })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 9 }))
    await fetchPaymentDetail(9)

    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await fetchAllPayments({ status: 'pending' })

    fetch.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await fetchCancelledPackageRefunds()

    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await refundCancelledPackagePayment(9, 'agency cancelled')

    fetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await initiateKhaltiPayment(7, 1200)

    fetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await verifyKhaltiPayment('PIDX123')

    const calledUrls = fetch.mock.calls.map(([url]) => url)
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/destinations/?province=Bagmati')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/destinations/1/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/destinations/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/packages/?created_by=3')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/packages/price_filter/?min_price=1000&max_price=2000')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/bookings/?status=confirmed')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/payments/cancelled_package_refunds/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/payments/initiate_khalti/')
    expect(calledUrls).toContain('http://127.0.0.1:8000/api/tourism/payments/khalti_verify/')
  })

  it('surfaces readable errors from failed requests', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'No active user found with this email.' }, false, 404))
    await expect(fetchDestinations()).rejects.toThrow('No active user found with this email.')
  })
})
