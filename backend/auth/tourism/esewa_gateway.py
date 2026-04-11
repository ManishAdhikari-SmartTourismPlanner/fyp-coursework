"""
eSewa Payment Gateway Integration
Official eSewa API Documentation: https://developer.esewa.com.np/
"""

import base64
import json
import hashlib
import hmac
import requests
import time
from decimal import Decimal
from urllib.parse import urlencode
from django.conf import settings

# eSewa Configuration
ESEWA_MERCHANT_CODE = getattr(settings, 'ESEWA_MERCHANT_CODE', 'EPAYTEST')  # Test merchant code
ESEWA_MERCHANT_SECRET = getattr(settings, 'ESEWA_MERCHANT_SECRET', '8gBm/:&EnhH.1/q')  # Test secret
ESEWA_SANDBOX_FORM_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
ESEWA_PRODUCTION_FORM_URL = 'https://epay.esewa.com.np/api/epay/main/v2/form'
ESEWA_SANDBOX_STATUS_URL = 'https://rc.esewa.com.np/api/epay/transaction/status/'
ESEWA_PRODUCTION_STATUS_URL = 'https://esewa.com.np/api/epay/transaction/status/'

# Use sandbox for development, production for live
IS_PRODUCTION = getattr(settings, 'ESEWA_PRODUCTION_MODE', False)
ESEWA_USE_MOCK = getattr(settings, 'ESEWA_USE_MOCK', False)
ESEWA_FORM_URL = ESEWA_PRODUCTION_FORM_URL if IS_PRODUCTION else ESEWA_SANDBOX_FORM_URL
ESEWA_STATUS_URL = ESEWA_PRODUCTION_STATUS_URL if IS_PRODUCTION else ESEWA_SANDBOX_STATUS_URL


class ESewaPaymentGateway:
    """Handles all eSewa payment operations"""
    
    @staticmethod
    def _normalize_amount(amount_npr):
        return str(Decimal(str(amount_npr)).quantize(Decimal('0.00')))

    @staticmethod
    def _generate_transaction_uuid(booking_code):
        # eSewa supports alphanumeric and hyphen only.
        clean_booking = ''.join(ch for ch in str(booking_code) if ch.isalnum() or ch == '-')
        return f"{clean_booking}-{int(time.time())}"

    @staticmethod
    def generate_signature(total_amount, transaction_uuid, product_code):
        """
        Generate eSewa v2 signature.
        signed_field_names = total_amount,transaction_uuid,product_code
        signature = base64(HMAC_SHA256(secret, message))
        """
        message = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}"
        digest = hmac.new(
            ESEWA_MERCHANT_SECRET.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(digest).decode('utf-8')

    @staticmethod
    def verify_signature(payload):
        signed_field_names = payload.get('signed_field_names', '')
        if not signed_field_names:
            return False

        fields = [f.strip() for f in signed_field_names.split(',') if f.strip()]
        message = ','.join([f"{field}={payload.get(field, '')}" for field in fields])
        digest = hmac.new(
            ESEWA_MERCHANT_SECRET.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256,
        ).digest()
        expected = base64.b64encode(digest).decode('utf-8')
        provided = str(payload.get('signature', '')).strip()
        return hmac.compare_digest(expected, provided)

    @staticmethod
    def initiate_payment(booking_code, amount_npr, success_url, failure_url, product_code=None, frontend_url=None):
        """
        Generate eSewa payment URL for initiation
        
        Args:
            booking_code: Unique booking identifier
            amount_npr: Amount in NPR (must be integer, no decimals)
            success_url: URL to redirect after successful payment
            failure_url: URL to redirect after failed payment
            product_code: Product identifier
            frontend_url: Frontend base URL for mock payments in DEBUG mode
            
        Returns:
            dict: Contains payment URL and transaction UUID
        """
        try:
            product_code = product_code or ESEWA_MERCHANT_CODE
            total_amount = ESewaPaymentGateway._normalize_amount(amount_npr)
            transaction_uuid = ESewaPaymentGateway._generate_transaction_uuid(booking_code)
            signature = ESewaPaymentGateway.generate_signature(
                total_amount,
                transaction_uuid,
                product_code
            )

            payment_params = {
                'amount': total_amount,
                'tax_amount': '0',
                'product_service_charge': '0',
                'product_delivery_charge': '0',
                'total_amount': total_amount,
                'transaction_uuid': transaction_uuid,
                'product_code': product_code,
                'success_url': success_url,
                'failure_url': failure_url,
                'signed_field_names': 'total_amount,transaction_uuid,product_code',
                'signature': signature,
            }

            if ESEWA_USE_MOCK and frontend_url:
                payment_url = f"{frontend_url}/payment/mock-esewa/?{urlencode(payment_params)}"
            else:
                payment_url = f"{ESEWA_FORM_URL}?{urlencode(payment_params)}"

            return {
                'success': True,
                'payment_url': payment_url,
                'transaction_uuid': transaction_uuid,
                'amount': total_amount,
                'merchant_code': ESEWA_MERCHANT_CODE,
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to initiate eSewa payment',
            }

    @staticmethod
    def verify_payment_status(transaction_uuid, total_amount, product_code=None):
        """
        Verify payment with eSewa using transaction reference
        
        This step verifies the payment on eSewa servers
        
        Args:
            ref_id: Reference ID/Transaction UUID from eSewa
            amount_npr: Amount that was paid
            product_code: Product identifier
            
        Returns:
            dict: Verification result from eSewa
        """
        try:
            product_code = product_code or ESEWA_MERCHANT_CODE
            total_amount = ESewaPaymentGateway._normalize_amount(total_amount)

            if str(transaction_uuid).startswith('MOCK_'):
                return {
                    'success': True,
                    'verification_data': {
                        'status': 'COMPLETE',
                        'transaction_uuid': transaction_uuid,
                        'source': 'mock',
                    },
                    'reference_id': transaction_uuid,
                    'amount': total_amount,
                    'status_message': 'Mock payment verified successfully',
                }

            verify_url = (
                f"{ESEWA_STATUS_URL}?product_code={product_code}"
                f"&total_amount={total_amount}&transaction_uuid={transaction_uuid}"
            )

            response = requests.get(verify_url, timeout=10)
            response.raise_for_status()
            result = response.json() if response.text else {}

            is_success = result.get('status') == 'COMPLETE'

            return {
                'success': is_success,
                'verification_data': result,
                'reference_id': result.get('ref_id') or result.get('transaction_code') or transaction_uuid,
                'amount': total_amount,
                'status_message': 'Payment verified successfully' if is_success else 'Payment verification failed',
            }
            
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to verify payment with eSewa',
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Payment verification error',
            }

    @staticmethod
    def handle_payment_callback(query_params):
        """
        Process eSewa payment callback
        
        eSewa redirects to success/failure URL with these parameters:
        - oid: Order ID (booking code)
        - amt: Amount
        - refId: Transaction reference ID
        - rid: Request ID
        - pid: Product ID
        - scd: Source code (merchant code)
        
        Returns:
            dict: Payment processing result
        """
        try:
            if query_params.get('data'):
                raw_data = query_params.get('data')
                padded = raw_data + '=' * (-len(raw_data) % 4)
                decoded = base64.b64decode(padded).decode('utf-8')
                payload = json.loads(decoded)

                if not ESewaPaymentGateway.verify_signature(payload):
                    return {
                        'success': False,
                        'error': 'Invalid eSewa callback signature',
                        'message': 'Signature verification failed',
                    }

                transaction_uuid = payload.get('transaction_uuid')
                total_amount = payload.get('total_amount')
                product_code = payload.get('product_code') or ESEWA_MERCHANT_CODE
                status_value = payload.get('status')

                booking_code = str(transaction_uuid).split('-')[0] if transaction_uuid else None
                if not booking_code:
                    return {
                        'success': False,
                        'error': 'Missing transaction_uuid',
                        'message': 'Invalid payment callback data',
                    }

                verify_result = ESewaPaymentGateway.verify_payment_status(
                    transaction_uuid=transaction_uuid,
                    total_amount=total_amount,
                    product_code=product_code,
                )

                is_success = verify_result.get('success') and status_value == 'COMPLETE'
                return {
                    'success': is_success,
                    'booking_code': booking_code,
                    'transaction_id': verify_result.get('reference_id') or transaction_uuid,
                    'amount': total_amount,
                    'verification_data': verify_result.get('verification_data', {}),
                    'message': verify_result.get('status_message', 'Payment verification failed'),
                }

            ref_id = query_params.get('refId')
            oid = query_params.get('oid') or query_params.get('pid')
            amount = query_params.get('amt') or query_params.get('tAmt')

            if not ref_id or not oid:
                return {
                    'success': False,
                    'error': 'Missing payment callback fields',
                    'message': 'Invalid payment callback data',
                }

            verify_result = ESewaPaymentGateway.verify_payment_status(
                transaction_uuid=ref_id,
                total_amount=amount,
                product_code=ESEWA_MERCHANT_CODE,
            )

            status_message = verify_result.get('status_message') or verify_result.get('message', 'Payment verification failed')
            
            return {
                'success': verify_result['success'],
                'booking_code': oid,
                'transaction_id': verify_result.get('reference_id') or ref_id,
                'amount': amount,
                'verification_data': verify_result.get('verification_data', {}),
                'message': status_message,
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Callback processing error',
            }
