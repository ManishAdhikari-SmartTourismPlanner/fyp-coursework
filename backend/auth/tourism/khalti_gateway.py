"""
Khalti ePayment Gateway Integration
Docs: https://docs.khalti.com/
"""

from decimal import Decimal, ROUND_HALF_UP
import requests
from django.conf import settings
from uuid import uuid4


class KhaltiPaymentGateway:
    @staticmethod
    def _headers():
        return {
            'Authorization': f"Key {settings.KHALTI_SECRET_KEY}",
            'Content-Type': 'application/json',
        }

    @staticmethod
    def _to_paisa(amount_npr):
        amount = Decimal(str(amount_npr)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return int(amount * 100)

    @staticmethod
    def initiate_payment(booking, amount_npr, frontend_url):
        use_mock = getattr(settings, 'KHALTI_USE_MOCK', False) and not getattr(settings, 'KHALTI_PRODUCTION_MODE', False)
        if use_mock and frontend_url:
            mock_pidx = f"MOCK_{booking.booking_code}_{uuid4().hex[:8]}"
            return {
                'success': True,
                'payment_url': f"{frontend_url}/payment/khalti-success/?pidx={mock_pidx}",
                'pidx': mock_pidx,
                'expires_at': None,
                'expires_in': None,
                'raw': {'source': 'mock'},
            }

        payload = {
            'return_url': f'{frontend_url}/payment/khalti-success/',
            'website_url': frontend_url,
            'amount': KhaltiPaymentGateway._to_paisa(amount_npr),
            'purchase_order_id': booking.booking_code,
            'purchase_order_name': f'Booking {booking.booking_code}',
            'customer_info': {
                'name': booking.tourist.get_full_name() or booking.tourist.username,
                'email': booking.tourist.email or 'tourist@example.com',
                'phone': '9800000000',
            },
        }

        response = requests.post(
            f"{settings.KHALTI_BASE_URL}/api/v2/epayment/initiate/",
            headers=KhaltiPaymentGateway._headers(),
            json=payload,
            timeout=20,
        )
        data = response.json() if response.text else {}
        if response.status_code >= 400:
            return {
                'success': False,
                'error': data.get('detail') or data.get('message') or str(data) or 'Failed to initiate Khalti payment.',
            }

        return {
            'success': True,
            'payment_url': data.get('payment_url'),
            'pidx': data.get('pidx'),
            'expires_at': data.get('expires_at'),
            'expires_in': data.get('expires_in'),
            'raw': data,
        }

    @staticmethod
    def lookup_payment(pidx):
        if str(pidx).startswith('MOCK_'):
            booking_code = str(pidx).split('_')[1] if '_' in str(pidx) else ''
            return {
                'success': True,
                'status': 'Completed',
                'transaction_id': pidx,
                'purchase_order_id': booking_code,
                'amount_paisa': None,
                'raw': {'source': 'mock', 'pidx': pidx},
            }

        response = requests.post(
            f"{settings.KHALTI_BASE_URL}/api/v2/epayment/lookup/",
            headers=KhaltiPaymentGateway._headers(),
            json={'pidx': pidx},
            timeout=20,
        )
        data = response.json() if response.text else {}
        if response.status_code >= 400:
            return {
                'success': False,
                'error': data.get('detail') or data.get('message') or str(data) or 'Failed to verify Khalti payment.',
            }

        return {
            'success': True,
            'status': data.get('status'),
            'transaction_id': data.get('transaction_id'),
            'purchase_order_id': data.get('purchase_order_id'),
            'amount_paisa': data.get('total_amount') or data.get('amount'),
            'raw': data,
        }
