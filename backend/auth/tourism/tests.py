from decimal import Decimal
from datetime import timedelta
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.test import APITestCase

from tourism.khalti_gateway import KhaltiPaymentGateway
from tourism.models import Booking, Destination, Package, PackageDeparture, Payment
from tourism.serializers import BookingDetailSerializer, PackageDetailSerializer, PaymentSerializer
from users.models import UserProfile


@override_settings(KHALTI_USE_MOCK=True, KHALTI_PRODUCTION_MODE=False)
class PackageCancellationRefundTests(APITestCase):
	def setUp(self):
		self.admin = User.objects.create_user(username='admin_refund', email='admin_refund@example.com', password='Pass12345!')
		self.admin.profile.role = UserProfile.ROLE_ADMIN
		self.admin.profile.save(update_fields=['role'])

		self.agent = User.objects.create_user(username='agent_refund', email='agent_refund@example.com', password='Pass12345!')
		self.agent.profile.role = UserProfile.ROLE_AGENT
		self.agent.profile.save(update_fields=['role'])

		self.tourist = User.objects.create_user(username='tourist_refund', email='tourist_refund@example.com', password='Pass12345!')
		self.tourist.profile.role = UserProfile.ROLE_TOURIST
		self.tourist.profile.save(update_fields=['role'])

		self.destination = Destination.objects.create(
			name='Refund Valley',
			slug='refund-valley',
			description='Refund test destination',
			province='Bagmati',
			district='Kathmandu',
			created_by=self.agent,
			is_active=True,
		)

		self.package = Package.objects.create(
			destination=self.destination,
			title='Refund Test Package',
			slug='refund-test-package',
			description='Refundable package',
			package_type=Package.PACKAGE_STANDARD,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=4,
			max_group_size=12,
			price_npr=Decimal('15000.00'),
			created_by=self.agent,
			is_active=True,
		)

		self.departure = PackageDeparture.objects.create(
			package=self.package,
			departure_date='2099-01-01',
			total_seats=20,
			available_seats=19,
			status=PackageDeparture.STATUS_OPEN,
		)

		self.booking = Booking.objects.create(
			booking_code='BKREFUND001',
			tourist=self.tourist,
			package=self.package,
			departure=self.departure,
			travelers_count=1,
			status=Booking.STATUS_CONFIRMED,
			total_amount_npr=Decimal('15000.00'),
		)

		self.payment = Payment.objects.create(
			booking=self.booking,
			method=Payment.METHOD_KHALTI,
			transaction_id='MOCK_REFUND_TXN_001',
			amount_npr=Decimal('15000.00'),
			status=Payment.STATUS_SUCCESS,
		)

	def _login(self, username, password='Pass12345!'):
		res = self.client.post('/api/auth/login/', {'username': username, 'password': password}, format='json')
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

	def test_agent_cancel_package_adds_payment_to_admin_refund_queue(self):
		self._login('agent_refund')
		cancel_response = self.client.post(f'/api/tourism/packages/{self.package.id}/cancel_package/', format='json')

		self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
		self.assertEqual(cancel_response.data['refund_candidates'], 1)

		self.package.refresh_from_db()
		self.booking.refresh_from_db()
		self.assertFalse(self.package.is_active)
		self.assertEqual(self.booking.status, Booking.STATUS_CANCELLED)

		self._login('admin_refund')
		queue_response = self.client.get('/api/tourism/payments/cancelled_package_refunds/', format='json')
		self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(queue_response.data), 1)
		self.assertEqual(queue_response.data[0]['payment_id'], self.payment.id)
		self.assertTrue(queue_response.data[0]['can_refund'])

	def test_agent_cannot_access_refund_queue(self):
		self._login('agent_refund')
		queue_response = self.client.get('/api/tourism/payments/cancelled_package_refunds/', format='json')

		self.assertEqual(queue_response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(queue_response.data['error'], 'Only admins can access refund queue.')

	def test_admin_can_refund_cancelled_package_payment(self):
		self._login('agent_refund')
		self.client.post(f'/api/tourism/packages/{self.package.id}/cancel_package/', format='json')

		self._login('admin_refund')
		refund_response = self.client.post(f'/api/tourism/payments/{self.payment.id}/refund_cancelled_package/', format='json')

		self.assertEqual(refund_response.status_code, status.HTTP_200_OK)
		self.payment.refresh_from_db()
		self.assertEqual(self.payment.status, Payment.STATUS_REFUNDED)

	def test_agent_cannot_refund_cancelled_package_payment(self):
		self._login('agent_refund')
		self.client.post(f'/api/tourism/packages/{self.package.id}/cancel_package/', format='json')

		refund_response = self.client.post(f'/api/tourism/payments/{self.payment.id}/refund_cancelled_package/', format='json')

		self.assertEqual(refund_response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(refund_response.data['error'], 'Only admins can refund cancelled packages.')


class PackageAgentTests(APITestCase):
	def setUp(self):
		self.agent_one = User.objects.create_user(username='agent_one', email='agent1@example.com', password='Pass12345!')
		self.agent_one.profile.role = UserProfile.ROLE_AGENT
		self.agent_one.profile.save(update_fields=['role'])

		self.agent_two = User.objects.create_user(username='agent_two', email='agent2@example.com', password='Pass12345!')
		self.agent_two.profile.role = UserProfile.ROLE_AGENT
		self.agent_two.profile.save(update_fields=['role'])

		self.tourist = User.objects.create_user(username='review_tourist', email='review@example.com', password='Pass12345!')
		self.tourist.profile.role = UserProfile.ROLE_TOURIST
		self.tourist.profile.save(update_fields=['role'])

		self.destination = Destination.objects.create(
			name='Agent Review Valley',
			slug='agent-review-valley',
			description='Destination for agent filtering',
			province='Gandaki',
			district='Kaski',
			created_by=self.agent_one,
			is_active=True,
		)

		self.package_one = Package.objects.create(
			destination=self.destination,
			title='Agent One Package',
			slug='agent-one-package',
			description='Package by agent one',
			package_type=Package.PACKAGE_STANDARD,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=3,
			max_group_size=10,
			price_npr=Decimal('12000.00'),
			created_by=self.agent_one,
			is_active=True,
		)

		self.package_two = Package.objects.create(
			destination=self.destination,
			title='Agent Two Package',
			slug='agent-two-package',
			description='Package by agent two',
			package_type=Package.PACKAGE_DELUXE,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=5,
			max_group_size=8,
			price_npr=Decimal('24000.00'),
			created_by=self.agent_two,
			is_active=True,
		)

		self.departure = PackageDeparture.objects.create(
			package=self.package_one,
			departure_date='2099-02-01',
			total_seats=10,
			available_seats=10,
			status=PackageDeparture.STATUS_OPEN,
		)

		self.booking = Booking.objects.create(
			booking_code='BKREVIEW001',
			tourist=self.tourist,
			package=self.package_one,
			departure=self.departure,
			travelers_count=1,
			status=Booking.STATUS_CONFIRMED,
			total_amount_npr=Decimal('12000.00'),
		)

		self.departure_two = PackageDeparture.objects.create(
			package=self.package_two,
			departure_date='2099-03-01',
			total_seats=8,
			available_seats=8,
			status=PackageDeparture.STATUS_OPEN,
		)

		self.booking_two = Booking.objects.create(
			booking_code='BKREVIEW002',
			tourist=self.tourist,
			package=self.package_two,
			departure=self.departure_two,
			travelers_count=1,
			status=Booking.STATUS_CONFIRMED,
			total_amount_npr=Decimal('24000.00'),
		)

	def _login(self, user):
		response = self.client.post('/api/auth/login/', {'username': user.username, 'password': 'Pass12345!'}, format='json')
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

	def test_packages_can_be_filtered_by_agent(self):
		self._login(self.tourist)
		response = self.client.get(f'/api/tourism/packages/?created_by={self.agent_one.id}', format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(all(row['created_by_username'] == 'agent_one' for row in response.data['results']))

	def test_agent_sees_only_own_package_bookings(self):
		self._login(self.agent_one)
		response = self.client.get('/api/tourism/bookings/', format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		rows = response.data.get('results', response.data)
		self.assertEqual(len(rows), 1)
		self.assertEqual(rows[0]['booking_code'], 'BKREVIEW001')

	def test_agent_cannot_cancel_booking_directly(self):
		self._login(self.agent_one)
		response = self.client.post(f'/api/tourism/bookings/{self.booking.id}/cancel/', format='json')

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertIn('Agents cannot cancel bookings directly', response.data['error'])
		self.booking.refresh_from_db()
		self.assertEqual(self.booking.status, Booking.STATUS_CONFIRMED)

	def test_agent_can_delete_own_package(self):
		own_package = Package.objects.create(
			destination=self.destination,
			title='Own Delete Package',
			slug='own-delete-package',
			description='Agent can delete own package',
			package_type=Package.PACKAGE_NORMAL,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=2,
			max_group_size=6,
			price_npr=Decimal('8000.00'),
			created_by=self.agent_one,
			is_active=True,
		)

		self._login(self.agent_one)
		response = self.client.delete(f'/api/tourism/packages/{own_package.id}/', format='json')

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Package.objects.filter(id=own_package.id).exists())

	def test_agent_cannot_delete_other_agents_package(self):
		other_package = Package.objects.create(
			destination=self.destination,
			title='Other Delete Package',
			slug='other-delete-package',
			description='Agent cannot delete this package',
			package_type=Package.PACKAGE_NORMAL,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=2,
			max_group_size=6,
			price_npr=Decimal('8500.00'),
			created_by=self.agent_two,
			is_active=True,
		)

		self._login(self.agent_one)
		response = self.client.delete(f'/api/tourism/packages/{other_package.id}/', format='json')

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertTrue(Package.objects.filter(id=other_package.id).exists())

	def test_manish_booking_under_agent_three_visible_only_to_agent_three(self):
		agent_three = User.objects.create_user(username='agent_three', email='agent3@example.com', password='Pass12345!')
		agent_three.profile.role = UserProfile.ROLE_AGENT
		agent_three.profile.save(update_fields=['role'])

		manish = User.objects.create_user(username='manish', email='manish@example.com', password='Pass12345!')
		manish.profile.role = UserProfile.ROLE_TOURIST
		manish.profile.save(update_fields=['role'])

		package_three = Package.objects.create(
			destination=self.destination,
			title='Agent Three Package',
			slug='agent-three-package',
			description='Package by agent three',
			package_type=Package.PACKAGE_NORMAL,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=2,
			max_group_size=6,
			price_npr=Decimal('9000.00'),
			created_by=agent_three,
			is_active=True,
		)

		departure_three = PackageDeparture.objects.create(
			package=package_three,
			departure_date='2099-04-01',
			total_seats=6,
			available_seats=6,
			status=PackageDeparture.STATUS_OPEN,
		)

		Booking.objects.create(
			booking_code='BKMANISH003',
			tourist=manish,
			package=package_three,
			departure=departure_three,
			travelers_count=1,
			status=Booking.STATUS_CONFIRMED,
			total_amount_npr=Decimal('9000.00'),
		)

		self._login(agent_three)
		agent_three_response = self.client.get('/api/tourism/bookings/', format='json')
		self.assertEqual(agent_three_response.status_code, status.HTTP_200_OK)
		agent_three_rows = agent_three_response.data.get('results', agent_three_response.data)
		self.assertEqual(len(agent_three_rows), 1)
		self.assertEqual(agent_three_rows[0]['booking_code'], 'BKMANISH003')

		self._login(self.agent_one)
		agent_one_response = self.client.get('/api/tourism/bookings/', format='json')
		self.assertEqual(agent_one_response.status_code, status.HTTP_200_OK)
		agent_one_rows = agent_one_response.data.get('results', agent_one_response.data)
		self.assertEqual(len(agent_one_rows), 1)
		self.assertEqual(agent_one_rows[0]['booking_code'], 'BKREVIEW001')

	def test_agent_can_delete_own_destination(self):
		owned_destination = Destination.objects.create(
			name='Owned Destination Delete',
			slug='owned-destination-delete',
			description='Delete owned destination',
			province='Bagmati',
			district='Kathmandu',
			created_by=self.agent_one,
			is_active=True,
		)

		self._login(self.agent_one)
		response = self.client.delete(f'/api/tourism/destinations/{owned_destination.id}/', format='json')

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Destination.objects.filter(id=owned_destination.id).exists())

	def test_agent_can_delete_destination_created_by_other_agent(self):
		other_destination = Destination.objects.create(
			name='Other Agent Destination Delete',
			slug='other-agent-destination-delete',
			description='Cannot delete by another agent',
			province='Bagmati',
			district='Kathmandu',
			created_by=self.agent_two,
			is_active=True,
		)

		self._login(self.agent_one)
		response = self.client.delete(f'/api/tourism/destinations/{other_destination.id}/', format='json')

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Destination.objects.filter(id=other_destination.id).exists())

	def test_agent_can_create_more_than_seven_active_destinations(self):
		self._login(self.agent_one)
		Destination.objects.all().update(is_active=False)

		for idx in range(1, 8):
			response = self.client.post(
				'/api/tourism/destinations/',
				{
					'name': f'Cap Destination {idx}',
					'slug': f'cap-destination-{idx}',
					'description': 'Destination cap check',
					'province': 'Bagmati',
					'district': 'Kathmandu',
					'best_season': 'all',
					'tour_type': 'traveling',
					'difficulty': 'easy',
					'suggested_duration_days': 2,
					'is_active': True,
				},
				format='json',
			)
			self.assertEqual(response.status_code, status.HTTP_201_CREATED)

		eighth_response = self.client.post(
			'/api/tourism/destinations/',
			{
				'name': 'Cap Destination 8',
				'slug': 'cap-destination-8',
				'description': 'Destination cap check',
				'province': 'Bagmati',
				'district': 'Kathmandu',
				'best_season': 'all',
				'tour_type': 'traveling',
				'difficulty': 'easy',
				'suggested_duration_days': 2,
				'is_active': True,
			},
			format='json',
		)

		self.assertEqual(eighth_response.status_code, status.HTTP_201_CREATED)


@override_settings(KHALTI_USE_MOCK=True, KHALTI_PRODUCTION_MODE=False, KHALTI_SECRET_KEY='test-secret')
class TourismCoverageTests(APITestCase):
	def setUp(self):
		self.admin = User.objects.create_user(username='admin_cover', email='admin_cover@example.com', password='Pass12345!')
		self.admin.profile.role = UserProfile.ROLE_ADMIN
		self.admin.profile.save(update_fields=['role'])

		self.agent = User.objects.create_user(username='agent_cover', email='agent_cover@example.com', password='Pass12345!')
		self.agent.profile.role = UserProfile.ROLE_AGENT
		self.agent.profile.save(update_fields=['role'])

		self.tourist = User.objects.create_user(username='tourist_cover', email='tourist_cover@example.com', password='Pass12345!')
		self.tourist.profile.role = UserProfile.ROLE_TOURIST
		self.tourist.profile.save(update_fields=['role'])

		self.destination = Destination.objects.create(
			name='Coverage Destination',
			slug='coverage-destination',
			description='Coverage test destination',
			province='Bagmati',
			district='Kathmandu',
			created_by=self.agent,
			is_active=True,
		)

		self.package = Package.objects.create(
			destination=self.destination,
			title='Coverage Package',
			slug='coverage-package',
			description='Coverage test package',
			package_type=Package.PACKAGE_STANDARD,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=4,
			max_group_size=12,
			price_npr=Decimal('12000.00'),
			created_by=self.agent,
			is_active=True,
		)

		self.departure = PackageDeparture.objects.create(
			package=self.package,
			departure_date=timezone.now().date() + timedelta(days=10),
			total_seats=10,
			available_seats=10,
			status=PackageDeparture.STATUS_OPEN,
		)

		self.pending_booking = Booking.objects.create(
			booking_code='BKCOVER001',
			tourist=self.tourist,
			package=self.package,
			departure=self.departure,
			travelers_count=1,
			status=Booking.STATUS_PENDING,
			total_amount_npr=Decimal('12000.00'),
		)

	def _login(self, user):
		response = self.client.post('/api/auth/login/', {'username': user.username, 'password': 'Pass12345!'}, format='json')
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

	def test_price_filter_and_departure_booking_actions(self):
		self._login(self.agent)

		price_response = self.client.get('/api/tourism/packages/price_filter/?min_price=10000&max_price=13000', format='json')
		self.assertEqual(price_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(price_response.data), 1)
		self.assertEqual(price_response.data[0]['title'], 'Coverage Package')
		self.assertEqual(len(price_response.data[0]['available_departures']), 1)
		self.assertTrue(price_response.data[0]['available_departures'][0]['seats_available'])

		insufficient_response = self.client.post(
			f'/api/tourism/departures/{self.departure.id}/book_seats/',
			{'seats_needed': 11},
			format='json',
		)
		self.assertEqual(insufficient_response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Only 10 seats available', insufficient_response.data['error'])

		success_response = self.client.post(
			f'/api/tourism/departures/{self.departure.id}/book_seats/',
			{'seats_needed': 3},
			format='json',
		)
		self.assertEqual(success_response.status_code, status.HTTP_200_OK)
		self.assertEqual(success_response.data['available_seats'], 7)

		past_departure = PackageDeparture.objects.create(
			package=self.package,
			departure_date=timezone.now().date() - timedelta(days=1),
			total_seats=5,
			available_seats=5,
			status=PackageDeparture.STATUS_OPEN,
		)
		past_response = self.client.post(
			f'/api/tourism/departures/{past_departure.id}/book_seats/',
			{'seats_needed': 1},
			format='json',
		)
		self.assertEqual(past_response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(past_response.data['error'], 'Cannot book past departures.')

	def test_mock_khalti_payment_flow_confirms_pending_booking(self):
		self._login(self.tourist)

		initiate_response = self.client.post(
			'/api/tourism/payments/initiate_khalti/',
			{
				'booking_id': self.pending_booking.id,
				'amount_npr': str(self.pending_booking.total_amount_npr),
				'frontend_url': 'http://frontend.local',
			},
			format='json',
		)

		self.assertEqual(initiate_response.status_code, status.HTTP_200_OK)
		self.assertTrue(initiate_response.data['success'])
		self.assertIn('pidx', initiate_response.data)
		self.assertTrue(initiate_response.data['payment_url'].startswith('http://frontend.local'))

		payment = Payment.objects.get(booking=self.pending_booking)
		self.assertEqual(payment.status, Payment.STATUS_PENDING)

		verify_response = self.client.post(
			'/api/tourism/payments/khalti_verify/',
			{'pidx': initiate_response.data['pidx']},
			format='json',
		)

		self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
		self.assertTrue(verify_response.data['success'])
		self.assertEqual(verify_response.data['booking_status'], Booking.STATUS_CONFIRMED)
		self.assertEqual(verify_response.data['payment_status'], Payment.STATUS_SUCCESS)

		self.pending_booking.refresh_from_db()
		payment.refresh_from_db()
		self.assertEqual(self.pending_booking.status, Booking.STATUS_CONFIRMED)
		self.assertEqual(payment.status, Payment.STATUS_SUCCESS)

	def test_tourism_serializers_cover_validation_failures(self):
		Package.objects.create(
			destination=self.destination,
			title='Coverage Package Deluxe',
			slug='coverage-package-deluxe',
			description='Coverage deluxe package',
			package_type=Package.PACKAGE_DELUXE,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=5,
			max_group_size=10,
			price_npr=Decimal('18000.00'),
			created_by=self.agent,
			is_active=True,
		)
		Package.objects.create(
			destination=self.destination,
			title='Coverage Package Normal',
			slug='coverage-package-normal',
			description='Coverage normal package',
			package_type=Package.PACKAGE_NORMAL,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=3,
			max_group_size=8,
			price_npr=Decimal('9000.00'),
			created_by=self.agent,
			is_active=True,
		)

		with self.assertRaises(serializers.ValidationError) as duplicate_error:
			PackageDetailSerializer().validate({'destination_id': self.destination.id, 'package_type': Package.PACKAGE_STANDARD})
		self.assertIn('package_type', duplicate_error.exception.detail)

		with self.assertRaises(serializers.ValidationError) as limit_error:
			PackageDetailSerializer().validate({'destination_id': self.destination.id, 'package_type': None})
		self.assertIn('destination_id', limit_error.exception.detail)

		other_destination = Destination.objects.create(
			name='Other Coverage Destination',
			slug='other-coverage-destination',
			description='Other coverage destination',
			province='Bagmati',
			district='Lalitpur',
			created_by=self.agent,
			is_active=True,
		)
		other_package = Package.objects.create(
			destination=other_destination,
			title='Other Coverage Package',
			slug='other-coverage-package',
			description='Other package',
			package_type=Package.PACKAGE_STANDARD,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=2,
			max_group_size=6,
			price_npr=Decimal('7000.00'),
			created_by=self.agent,
			is_active=True,
		)
		other_departure = PackageDeparture.objects.create(
			package=other_package,
			departure_date=timezone.now().date() + timedelta(days=14),
			total_seats=2,
			available_seats=2,
			status=PackageDeparture.STATUS_OPEN,
		)
		closed_departure = PackageDeparture.objects.create(
			package=self.package,
			departure_date=timezone.now().date() + timedelta(days=20),
			total_seats=4,
			available_seats=4,
			status=PackageDeparture.STATUS_CLOSED,
		)
		few_seats_departure = PackageDeparture.objects.create(
			package=self.package,
			departure_date=timezone.now().date() + timedelta(days=21),
			total_seats=1,
			available_seats=1,
			status=PackageDeparture.STATUS_OPEN,
		)

		with self.assertRaises(serializers.ValidationError) as missing_package_error:
			BookingDetailSerializer().validate({'package_id': 999999})
		self.assertIn('package_id', missing_package_error.exception.detail)

		inactive_package = Package.objects.create(
			destination=self.destination,
			title='Inactive Coverage Package',
			slug='inactive-coverage-package',
			description='Inactive package',
			package_type=Package.PACKAGE_STANDARD,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=2,
			max_group_size=4,
			price_npr=Decimal('6000.00'),
			created_by=self.agent,
			is_active=False,
		)
		with self.assertRaises(serializers.ValidationError) as inactive_error:
			BookingDetailSerializer().validate({'package_id': inactive_package.id})
		self.assertIn('package_id', inactive_error.exception.detail)

		with self.assertRaises(serializers.ValidationError) as mismatch_error:
			BookingDetailSerializer().validate({'package_id': self.package.id, 'departure_id': other_departure.id})
		self.assertIn('departure_id', mismatch_error.exception.detail)

		with self.assertRaises(serializers.ValidationError) as closed_error:
			BookingDetailSerializer().validate({'package_id': self.package.id, 'departure_id': closed_departure.id})
		self.assertIn('departure_id', closed_error.exception.detail)

		with self.assertRaises(serializers.ValidationError) as seats_error:
			BookingDetailSerializer().validate({'package_id': self.package.id, 'departure_id': few_seats_departure.id, 'travelers_count': 2})
		self.assertIn('travelers_count', seats_error.exception.detail)

	def test_payment_serializer_and_khalti_gateway_helpers(self):
		with self.assertRaises(serializers.ValidationError) as missing_booking_error:
			PaymentSerializer().validate({})
		self.assertIn('booking_id', missing_booking_error.exception.detail)

		with self.assertRaises(serializers.ValidationError) as missing_id_error:
			PaymentSerializer().validate({'booking_id': 999999, 'method': Payment.METHOD_KHALTI, 'amount_npr': Decimal('12000.00')})
		self.assertIn('booking_id', missing_id_error.exception.detail)

		with self.assertRaises(serializers.ValidationError) as missing_code_error:
			PaymentSerializer().validate({'booking_code_input': 'NO-SUCH-CODE', 'method': Payment.METHOD_KHALTI, 'amount_npr': Decimal('12000.00')})
		self.assertIn('booking_code_input', missing_code_error.exception.detail)

		validated = PaymentSerializer().validate({'booking_id': self.pending_booking.id, 'method': Payment.METHOD_KHALTI, 'amount_npr': Decimal('12000.00')})
		self.assertEqual(validated['booking'].id, self.pending_booking.id)

		self.assertEqual(KhaltiPaymentGateway._to_paisa('12.345'), 1235)

		fake_initiate_response = Mock()
		fake_initiate_response.status_code = 200
		fake_initiate_response.text = '{"payment_url": "https://pay.example/init", "pidx": "PIDX123", "expires_at": null, "expires_in": 60}'
		fake_initiate_response.json.return_value = {
			'payment_url': 'https://pay.example/init',
			'pidx': 'PIDX123',
			'expires_at': None,
			'expires_in': 60,
		}

		fake_lookup_response = Mock()
		fake_lookup_response.status_code = 200
		fake_lookup_response.text = '{"status": "Completed", "transaction_id": "TXN123", "purchase_order_id": "BKCOVER001", "total_amount": 120000}'
		fake_lookup_response.json.return_value = {
			'status': 'Completed',
			'transaction_id': 'TXN123',
			'purchase_order_id': 'BKCOVER001',
			'total_amount': 120000,
		}

		fake_refund_response = Mock()
		fake_refund_response.status_code = 200
		fake_refund_response.text = '{"refund_id": "REF123"}'
		fake_refund_response.json.return_value = {'refund_id': 'REF123'}

		with override_settings(KHALTI_USE_MOCK=False):
			with patch('tourism.khalti_gateway.requests.post', side_effect=[fake_initiate_response, fake_lookup_response, fake_refund_response]):
				initiate_result = KhaltiPaymentGateway.initiate_payment(self.pending_booking, '12000.00', 'http://frontend.local')
				self.assertTrue(initiate_result['success'])
				self.assertEqual(initiate_result['pidx'], 'PIDX123')

				lookup_result = KhaltiPaymentGateway.lookup_payment('PIDX123')
				self.assertTrue(lookup_result['success'])
				self.assertEqual(lookup_result['status'], 'Completed')

				refund_result = KhaltiPaymentGateway.refund_payment('PIDX123')
				self.assertTrue(refund_result['success'])
				self.assertEqual(refund_result['refund_reference'], 'REF123')
