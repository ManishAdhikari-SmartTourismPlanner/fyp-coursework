"""
eSewa Payment Gateway Integration
Official eSewa API Documentation: https://developer.esewa.com.np/
"""

import hashlib
import requests
from decimal import Decimal
from urllib.parse import urlencode
from django.conf import settings

# eSewa Configuration
ESEWA_MERCHANT_CODE = getattr(settings, 'ESEWA_MERCHANT_CODE', 'EPAYTEST')  # Test merchant code
ESEWA_MERCHANT_SECRET = getattr(settings, 'ESEWA_MERCHANT_SECRET', '8gBm/:&EnhH.1/q')  # Test secret
ESEWA_SANDBOX_URL = 'https://uat.esewa.com.np'  # Test environment
ESEWA_PRODUCTION_URL = 'https://esewa.com.np'  # Production

# Use sandbox for development, production for live
IS_PRODUCTION = getattr(settings, 'ESEWA_PRODUCTION_MODE', False)
ESEWA_USE_MOCK = getattr(settings, 'DEBUG', True)  # Use mock payment in DEBUG mode
ESEWA_BASE_URL = ESEWA_PRODUCTION_URL if IS_PRODUCTION else ESEWA_SANDBOX_URL


class ESewaPaymentGateway:
    """Handles all eSewa payment operations"""
    
    @staticmethod
    def generate_signature(payment_amount, transaction_uuid, product_code):
        """
        Generate HMAC SHA256 signature for eSewa
        
        Signature = SHA256(transaction_uuid + product_code + payment_amount + ESEWA_MERCHANT_SECRET)
        """
        message = f"{transaction_uuid}{product_code}{payment_amount}{ESEWA_MERCHANT_SECRET}"
        signature = hashlib.sha256(message.encode()).hexdigest()
        return signature

    @staticmethod
    def initiate_payment(booking_code, amount_npr, success_url, failure_url, product_code='SMART_TOURISM', frontend_url=None):
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
            # eSewa requires integer amount (no decimals)
            amount_integer = int(Decimal(str(amount_npr)))
            
            # Create unique transaction UUID (use booking code as base)
            transaction_uuid = f"{booking_code}_{int(amount_npr)}"
            
            # Generate signature
            signature = ESewaPaymentGateway.generate_signature(
                amount_integer,
                transaction_uuid,
                product_code
            )
            
            # Build payment parameters
            payment_params = {
                'amt': amount_integer,
                'psc': product_code,
                'pid': booking_code,
                'txAmt': 0,  # Tax amount
                'pamt': amount_integer,  # Product amount
                'tAmt': amount_integer,  # Total amount
                'dAmt': 0,  # Discount amount
                'scd': ESEWA_MERCHANT_CODE,
                'su': success_url,
                'fu': failure_url,
                'rid': transaction_uuid,  # Request ID (transaction UUID)
                'md5': signature,
            }
            
            # In DEBUG/MOCK mode, use local mock payment page instead of real eSewa
            if ESEWA_USE_MOCK and frontend_url:
                payment_url = f"{frontend_url}/payment/mock-esewa/?{urlencode(payment_params)}"
            else:
                # Generate full payment URL to real eSewa
                payment_url = f"{ESEWA_BASE_URL}/api/epay/main/?{urlencode(payment_params)}"
            
            return {
                'success': True,
                'payment_url': payment_url,
                'transaction_uuid': transaction_uuid,
                'amount': amount_integer,
                'merchant_code': ESEWA_MERCHANT_CODE,
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to initiate eSewa payment',
            }

    @staticmethod
    def verify_payment_signature(ref_id, amount_npr, product_code='SMART_TOURISM'):
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
            amount_integer = int(Decimal(str(amount_npr)))

            # In local mock flow, treat generated mock references as successful.
            if str(ref_id).startswith('MOCK_'):
                return {
                    'success': True,
                    'verification_data': {
                        'status': 'COMPLETE',
                        'rid': ref_id,
                        'source': 'mock',
                    },
                    'reference_id': ref_id,
                    'amount': amount_integer,
                    'status_message': 'Mock payment verified successfully',
                }
            
            # eSewa verification endpoint
            verify_url = f"{ESEWA_BASE_URL}/api/epay/transaction/status/?rid={ref_id}"
            
            # Make verification request
            response = requests.get(verify_url, timeout=10)
            response.raise_for_status()
            
            # Parse response
            result = response.json() if response.text else {}
            
            # Check if payment was successful
            is_success = result.get('status') == 'COMPLETE'
            
            return {
                'success': is_success,
                'verification_data': result,
                'reference_id': ref_id,
                'amount': amount_integer,
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
            ref_id = query_params.get('refId')
            oid = query_params.get('oid') or query_params.get('pid')  # booking_code
            amount = query_params.get('amt') or query_params.get('tAmt')
            
            if not ref_id:
                return {
                    'success': False,
                    'error': 'Missing reference ID',
                    'message': 'Invalid payment callback data',
                }
            
            # Verify payment with eSewa
            verify_result = ESewaPaymentGateway.verify_payment_signature(ref_id, amount)

            status_message = verify_result.get('status_message') or verify_result.get('message', 'Payment verification failed')
            
            return {
                'success': verify_result['success'],
                'booking_code': oid,
                'transaction_id': ref_id,
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
