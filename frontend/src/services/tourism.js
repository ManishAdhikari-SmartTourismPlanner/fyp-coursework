import { tokenStore } from './auth.js';

const API_BASE_URL = 'http://127.0.0.1:8000';

async function authRequest(endpoint, options = {}) {
  const access = tokenStore.getAccess();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    let errorMessage = 'Request failed';

    if (data?.detail) {
      errorMessage = data.detail;
    } else if (data && typeof data === 'object') {
      const messages = Object.entries(data).map(([field, value]) => {
        if (Array.isArray(value)) {
          return `${field}: ${value.join(', ')}`;
        }
        if (typeof value === 'string') {
          return `${field}: ${value}`;
        }
        return `${field}: ${JSON.stringify(value)}`;
      });
      if (messages.length > 0) {
        errorMessage = messages.join(' | ');
      }
    } else if (data) {
      errorMessage = JSON.stringify(data);
    }

    throw new Error(errorMessage);
  }

  return data;
}

// ===== DESTINATIONS =====
export async function fetchDestinations(params = {}) {
  const query = new URLSearchParams(params);
  return authRequest(`/api/tourism/destinations/?${query.toString()}`);
}

export async function fetchDestinationDetail(id) {
  return authRequest(`/api/tourism/destinations/${id}/`);
}

export async function createDestination(payload) {
  return authRequest('/api/tourism/destinations/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDestination(id, payload) {
  return authRequest(`/api/tourism/destinations/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteDestination(id) {
  return authRequest(`/api/tourism/destinations/${id}/`, {
    method: 'DELETE',
  });
}

// ===== PACKAGES =====
export async function fetchPackages(params = {}) {
  const query = new URLSearchParams(params);
  return authRequest(`/api/tourism/packages/?${query.toString()}`);
}

export async function fetchPackageDetail(id) {
  return authRequest(`/api/tourism/packages/${id}/`);
}

export async function createPackage(payload) {
  return authRequest('/api/tourism/packages/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePackage(id, payload) {
  return authRequest(`/api/tourism/packages/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePackage(id) {
  return authRequest(`/api/tourism/packages/${id}/`, {
    method: 'DELETE',
  });
}

export async function fetchPackageDepartures(packageId) {
  return authRequest(`/api/tourism/packages/${packageId}/departures/`);
}

export async function createPackageDeparture(payload) {
  return authRequest('/api/tourism/departures/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function filterPackagesByPrice(minPrice, maxPrice) {
  return authRequest(`/api/tourism/packages/price_filter/?min_price=${minPrice}&max_price=${maxPrice}`);
}

// ===== BOOKINGS =====
export async function fetchMyBookings(params = {}) {
  const query = new URLSearchParams(params);
  return authRequest(`/api/tourism/bookings/?${query.toString()}`);
}

export async function fetchAllBookings(params = {}) {
  const query = new URLSearchParams(params);
  return authRequest(`/api/tourism/bookings/?${query.toString()}`);
}

export async function createBooking(payload) {
  return authRequest('/api/tourism/bookings/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBookingDetail(id) {
  return authRequest(`/api/tourism/bookings/${id}/`);
}

export async function cancelBooking(id) {
  return authRequest(`/api/tourism/bookings/${id}/cancel/`, {
    method: 'POST',
  });
}

export async function confirmBooking(id) {
  return authRequest(`/api/tourism/bookings/${id}/confirm/`, {
    method: 'POST',
  });
}

export async function fetchBookingPaymentStatus(id) {
  return authRequest(`/api/tourism/bookings/${id}/payment_status/`);
}

export async function rescheduleBooking(id, newDepartureId) {
  return authRequest(`/api/tourism/bookings/${id}/reschedule/`, {
    method: 'POST',
    body: JSON.stringify({ new_departure_id: newDepartureId }),
  });
}

// ===== PAYMENTS =====
export async function createPayment(payload) {
  return authRequest('/api/tourism/payments/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchPaymentDetail(id) {
  return authRequest(`/api/tourism/payments/${id}/`);
}

export async function fetchAllPayments(params = {}) {
  const query = new URLSearchParams(params);
  return authRequest(`/api/tourism/payments/?${query.toString()}`);
}

// ===== OFFLINE MAPS =====
export async function fetchOfflineMaps(params = {}) {
  const query = new URLSearchParams(params);
  return authRequest(`/api/tourism/offline-maps/?${query.toString()}`);
}

export async function createOfflineMap(payload) {
  return authRequest('/api/tourism/offline-maps/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOfflineMap(id, payload) {
  return authRequest(`/api/tourism/offline-maps/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOfflineMap(id) {
  return authRequest(`/api/tourism/offline-maps/${id}/`, {
    method: 'DELETE',
  });
}

export async function fetchLatestOfflineMaps(destinationId) {
  return authRequest(`/api/tourism/offline-maps/latest/?destination=${destinationId}`);
}

// ===== eSEWA PAYMENT GATEWAY =====
export async function initiateESewaPayment(bookingId, amount) {
  return authRequest('/api/tourism/payments/initiate_esewa/', {
    method: 'POST',
    body: JSON.stringify({
      booking_id: bookingId,
      amount_npr: amount,
      frontend_url: window.location.origin, // Send frontend domain
    }),
  });
}

export async function initiateKhaltiPayment(bookingId, amount) {
  return authRequest('/api/tourism/payments/initiate_khalti/', {
    method: 'POST',
    body: JSON.stringify({
      booking_id: bookingId,
      amount_npr: amount,
      frontend_url: window.location.origin,
    }),
  });
}

export async function verifyKhaltiPayment(pidx) {
  return authRequest('/api/tourism/payments/khalti_verify/', {
    method: 'POST',
    body: JSON.stringify({ pidx }),
  });
}

export async function handleESewaCallback(queryParams) {
  const query = new URLSearchParams(queryParams);
  return authRequest(`/api/tourism/payments/esewa_callback/?${query.toString()}`);
}

// ===== REVIEWS =====
export async function createReview(payload) {
  return authRequest('/api/tourism/reviews/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDestinationReviews(destinationId) {
  return authRequest(`/api/tourism/destinations/${destinationId}/reviews/`);
}

export async function fetchAllReviews() {
  return authRequest('/api/tourism/reviews/');
}
