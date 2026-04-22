from decimal import Decimal

from django.contrib.auth.models import User
from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase
import re

from tourism.models import Booking, Destination, Package, PackageDeparture
from users.models import AdminAuditLog, PasswordResetOTPChallenge, RegistrationOTPChallenge, UserProfile


class AuthApiTests(APITestCase):
	def test_register_sends_otp_without_creating_user_until_verified(self):
		payload = {
			'username': 'new_tourist',
			'email': 'tourist@example.com',
			'password': 'Pass12345!',
			'confirm_password': 'Pass12345!',
		}

		response = self.client.post('/api/auth/register/', payload, format='json')

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertTrue(response.data.get('otp_required'))
		self.assertIn('challenge_id', response.data)
		self.assertEqual(len(mail.outbox), 1)
		self.assertFalse(User.objects.filter(username='new_tourist').exists())
		self.assertTrue(RegistrationOTPChallenge.objects.filter(id=response.data['challenge_id']).exists())

	def test_verify_registration_otp_activates_user_and_returns_tokens(self):
		register_payload = {
			'username': 'verify_user',
			'email': 'verify@example.com',
			'password': 'Pass12345!',
			'confirm_password': 'Pass12345!',
		}
		register_response = self.client.post('/api/auth/register/', register_payload, format='json')
		challenge_id = register_response.data['challenge_id']

		match = re.search(r'OTP\) is: (\d{6})', mail.outbox[0].body)
		self.assertIsNotNone(match)
		otp_code = match.group(1)

		verify_response = self.client.post(
			'/api/auth/verify-otp/',
			{'challenge_id': challenge_id, 'code': otp_code},
			format='json',
		)

		self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
		self.assertIn('access', verify_response.data)
		self.assertIn('refresh', verify_response.data)
		self.assertEqual(verify_response.data['user']['username'], 'verify_user')

		user = User.objects.get(username='verify_user')
		self.assertTrue(user.is_active)
		self.assertTrue(UserProfile.objects.filter(user=user).exists())
		self.assertEqual(user.profile.role, UserProfile.ROLE_TOURIST)

	def test_login_returns_tokens_and_user_payload(self):
		user = User.objects.create_user(
			username='login_user',
			email='login@example.com',
			password='Pass12345!',
			is_active=True,
		)
		user.profile.role = UserProfile.ROLE_TOURIST
		user.profile.save(update_fields=['role'])

		payload = {
			'username': 'login_user',
			'password': 'Pass12345!',
		}

		response = self.client.post('/api/auth/login/', payload, format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)
		self.assertIn('user', response.data)
		self.assertEqual(response.data['user']['username'], 'login_user')
		self.assertEqual(response.data['user']['role'], UserProfile.ROLE_TOURIST)

	def test_agent_login_still_returns_tokens_without_otp(self):
		user = User.objects.create_user(
			username='agent_user',
			email='agent@example.com',
			password='Pass12345!',
			is_active=True,
		)
		user.profile.role = UserProfile.ROLE_AGENT
		user.profile.save(update_fields=['role'])

		response = self.client.post(
			'/api/auth/login/',
			{'username': 'agent_user', 'password': 'Pass12345!'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)
		self.assertEqual(response.data['user']['role'], UserProfile.ROLE_AGENT)

	def test_login_rejects_disabled_user(self):
		User.objects.create_user(
			username='disabled_tourist',
			email='disabled@example.com',
			password='Pass12345!',
			is_active=False,
		)

		response = self.client.post(
			'/api/auth/login/',
			{'username': 'disabled_tourist', 'password': 'Pass12345!'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertIn('disabled', response.data['detail'])

	def test_registration_otp_allows_only_five_attempts(self):
		register_response = self.client.post(
			'/api/auth/register/',
			{
				'username': 'otp_user',
				'email': 'otp@example.com',
				'password': 'Pass12345!',
				'confirm_password': 'Pass12345!',
			},
			format='json',
		)
		challenge_id = register_response.data['challenge_id']

		for _ in range(5):
			bad_response = self.client.post(
				'/api/auth/verify-otp/',
				{'challenge_id': challenge_id, 'code': '000000'},
				format='json',
			)
			self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

		locked_response = self.client.post(
			'/api/auth/verify-otp/',
			{'challenge_id': challenge_id, 'code': '000000'},
			format='json',
		)
		self.assertEqual(locked_response.status_code, status.HTTP_400_BAD_REQUEST)
		challenge = RegistrationOTPChallenge.objects.get(id=challenge_id)
		self.assertTrue(challenge.is_used)

	def test_me_requires_auth_and_returns_current_user(self):
		user = User.objects.create_user(
			username='me_user',
			email='me@example.com',
			password='Pass12345!',
			is_active=True,
		)
		user.profile.role = UserProfile.ROLE_AGENT
		user.profile.save(update_fields=['role'])

		unauth_response = self.client.get('/api/auth/me/')
		self.assertEqual(unauth_response.status_code, status.HTTP_401_UNAUTHORIZED)

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'me_user', 'password': 'Pass12345!'},
			format='json',
		)
		token = login_response.data['access']
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

		response = self.client.get('/api/auth/me/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['username'], 'me_user')
		self.assertEqual(response.data['role'], UserProfile.ROLE_AGENT)

	def test_logout_with_valid_refresh_token_succeeds(self):
		user = User.objects.create_user(
			username='logout_user',
			email='logout@example.com',
			password='Pass12345!',
			is_active=True,
		)
		user.profile.role = UserProfile.ROLE_AGENT
		user.profile.save(update_fields=['role'])

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'logout_user', 'password': 'Pass12345!'},
			format='json',
		)
		access = login_response.data['access']
		refresh = login_response.data['refresh']

		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
		response = self.client.post('/api/auth/logout/', {'refresh': refresh}, format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data.get('detail'), 'Logged out successfully.')

	def test_admin_can_manage_users_agencies_and_view_audit_analytics(self):
		admin = User.objects.create_user(
			username='admin_user',
			email='admin@example.com',
			password='Pass12345!',
			is_active=True,
		)
		admin.profile.role = UserProfile.ROLE_ADMIN
		admin.profile.save(update_fields=['role'])

		target_user = User.objects.create_user(
			username='target_tourist',
			email='target@example.com',
			password='Pass12345!',
			is_active=True,
		)
		target_user.profile.role = UserProfile.ROLE_TOURIST
		target_user.profile.save(update_fields=['role'])

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'admin_user', 'password': 'Pass12345!'},
			format='json',
		)
		access = login_response.data['access']
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

		create_agency_response = self.client.post(
			'/api/auth/agents/create/',
			{
				'username': 'agency_1',
				'email': 'agency1@example.com',
				'password': 'Pass12345!',
			},
			format='json',
		)
		self.assertEqual(create_agency_response.status_code, status.HTTP_201_CREATED)
		agency_id = create_agency_response.data['id']

		deactivate_response = self.client.post(f'/api/auth/users/{target_user.id}/deactivate/', format='json')
		self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)

		activate_response = self.client.post(f'/api/auth/users/{target_user.id}/activate/', format='json')
		self.assertEqual(activate_response.status_code, status.HTTP_200_OK)

		delete_user_response = self.client.delete(f'/api/auth/users/{target_user.id}/', format='json')
		self.assertEqual(delete_user_response.status_code, status.HTTP_200_OK)

		delete_agency_response = self.client.delete(f'/api/auth/agencies/{agency_id}/', format='json')
		self.assertEqual(delete_agency_response.status_code, status.HTTP_200_OK)

		agency_list_response = self.client.get('/api/auth/agencies/', format='json')
		self.assertEqual(agency_list_response.status_code, status.HTTP_200_OK)

		analytics_response = self.client.get('/api/auth/admin/analytics/', format='json')
		self.assertEqual(analytics_response.status_code, status.HTTP_200_OK)
		self.assertIn('users', analytics_response.data)
		self.assertIn('bookings', analytics_response.data)
		self.assertIn('payments', analytics_response.data)

		audit_response = self.client.get('/api/auth/admin/audit-logs/', format='json')
		self.assertEqual(audit_response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(len(audit_response.data), 4)
		self.assertTrue(AdminAuditLog.objects.exists())

	def test_admin_cannot_delete_user_with_bookings(self):
		admin = User.objects.create_user(
			username='admin_delete_block',
			email='admin_delete_block@example.com',
			password='Pass12345!',
			is_active=True,
		)
		admin.profile.role = UserProfile.ROLE_ADMIN
		admin.profile.save(update_fields=['role'])

		tourist = User.objects.create_user(
			username='deepika_like_user',
			email='deepika@example.com',
			password='Pass12345!',
			is_active=True,
		)
		tourist.profile.role = UserProfile.ROLE_TOURIST
		tourist.profile.save(update_fields=['role'])

		owner = User.objects.create_user(
			username='package_owner_delete_test',
			email='package_owner_delete_test@example.com',
			password='Pass12345!',
			is_active=True,
		)
		owner.profile.role = UserProfile.ROLE_AGENT
		owner.profile.save(update_fields=['role'])

		destination = Destination.objects.create(
			name='Delete Block Destination',
			slug='delete-block-destination',
			description='Delete block destination',
			province='Bagmati',
			district='Kathmandu',
			created_by=owner,
			is_active=True,
		)

		package = Package.objects.create(
			destination=destination,
			title='Delete Block Package',
			slug='delete-block-package',
			description='Delete block package',
			package_type=Package.PACKAGE_STANDARD,
			tour_type=Package.TOUR_TRAVELING,
			duration_days=3,
			max_group_size=10,
			price_npr=Decimal('10000.00'),
			created_by=owner,
			is_active=True,
		)

		departure = PackageDeparture.objects.create(
			package=package,
			departure_date='2099-05-01',
			total_seats=10,
			available_seats=10,
			status=PackageDeparture.STATUS_OPEN,
		)

		Booking.objects.create(
			booking_code='BKDELETE001',
			tourist=tourist,
			package=package,
			departure=departure,
			travelers_count=1,
			status=Booking.STATUS_CONFIRMED,
			total_amount_npr=Decimal('10000.00'),
		)

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'admin_delete_block', 'password': 'Pass12345!'},
			format='json',
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

		response = self.client.delete(f'/api/auth/users/{tourist.id}/', format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('bookings', response.data['detail'])

	def test_admin_can_deactivate_and_activate_agency_via_agency_endpoints(self):
		admin = User.objects.create_user(
			username='admin_agency_status',
			email='admin_agency_status@example.com',
			password='Pass12345!',
			is_active=True,
		)
		admin.profile.role = UserProfile.ROLE_ADMIN
		admin.profile.save(update_fields=['role'])

		agent = User.objects.create_user(
			username='agent_status_target',
			email='agent_status_target@example.com',
			password='Pass12345!',
			is_active=True,
		)
		agent.profile.role = UserProfile.ROLE_AGENT
		agent.profile.save(update_fields=['role'])

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'admin_agency_status', 'password': 'Pass12345!'},
			format='json',
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

		deactivate_response = self.client.post(f'/api/auth/agencies/{agent.id}/deactivate/', format='json')
		self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
		agent.refresh_from_db()
		self.assertFalse(agent.is_active)

		activate_response = self.client.post(f'/api/auth/agencies/{agent.id}/activate/', format='json')
		self.assertEqual(activate_response.status_code, status.HTTP_200_OK)
		agent.refresh_from_db()
		self.assertTrue(agent.is_active)

	def test_forgot_password_and_reset_password_with_valid_otp(self):
		user = User.objects.create_user(
			username='forgot_user',
			email='forgot@example.com',
			password='OldPass123!',
			is_active=True,
		)
		user.profile.role = UserProfile.ROLE_TOURIST
		user.profile.save(update_fields=['role'])

		forgot_response = self.client.post(
			'/api/auth/forgot-password/',
			{'email': 'forgot@example.com'},
			format='json',
		)
		self.assertEqual(forgot_response.status_code, status.HTTP_200_OK)
		self.assertIn('challenge_id', forgot_response.data)

		match = re.search(r'OTP is: (\d{6})', mail.outbox[-1].body)
		self.assertIsNotNone(match)
		otp_code = match.group(1)

		reset_response = self.client.post(
			'/api/auth/reset-password/',
			{
				'challenge_id': forgot_response.data['challenge_id'],
				'code': otp_code,
				'new_password': 'NewPass123!',
				'confirm_password': 'NewPass123!',
			},
			format='json',
		)
		self.assertEqual(reset_response.status_code, status.HTTP_200_OK)

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'forgot_user', 'password': 'NewPass123!'},
			format='json',
		)
		self.assertEqual(login_response.status_code, status.HTTP_200_OK)

	def test_password_reset_otp_locks_after_five_attempts(self):
		user = User.objects.create_user(
			username='lock_user',
			email='lock@example.com',
			password='Start123!',
			is_active=True,
		)
		user.profile.role = UserProfile.ROLE_TOURIST
		user.profile.save(update_fields=['role'])

		forgot_response = self.client.post(
			'/api/auth/forgot-password/',
			{'email': 'lock@example.com'},
			format='json',
		)
		challenge_id = forgot_response.data['challenge_id']

		for _ in range(5):
			bad_response = self.client.post(
				'/api/auth/reset-password/',
				{
					'challenge_id': challenge_id,
					'code': '000000',
					'new_password': 'NewPass123!',
					'confirm_password': 'NewPass123!',
				},
				format='json',
			)
			self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

		locked_response = self.client.post(
			'/api/auth/reset-password/',
			{
				'challenge_id': challenge_id,
				'code': '000000',
				'new_password': 'NewPass123!',
				'confirm_password': 'NewPass123!',
			},
			format='json',
		)
		self.assertEqual(locked_response.status_code, status.HTTP_400_BAD_REQUEST)
		challenge = PasswordResetOTPChallenge.objects.get(id=challenge_id)
		self.assertTrue(challenge.is_used)

	def test_tourist_and_agency_can_patch_profile(self):
		agency = User.objects.create_user(
			username='agency_profile',
			email='agency-profile@example.com',
			password='Agency123!',
			is_active=True,
		)
		agency.profile.role = UserProfile.ROLE_AGENT
		agency.profile.save(update_fields=['role'])

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'agency_profile', 'password': 'Agency123!'},
			format='json',
		)
		access = login_response.data['access']
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

		patch_response = self.client.patch(
			'/api/auth/me/',
			{
				'username': 'agency_profile_new',
				'email': 'agency-new@example.com',
				'first_name': 'Agency',
				'last_name': 'Owner',
			},
			format='json',
		)
		self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
		self.assertEqual(patch_response.data['username'], 'agency_profile_new')
		self.assertEqual(patch_response.data['email'], 'agency-new@example.com')

	def test_authenticated_user_can_view_public_agencies_with_active_packages_only(self):
		tourist = User.objects.create_user(
			username='tourist_browser',
			email='tourist_browser@example.com',
			password='Pass12345!',
			is_active=True,
		)
		tourist.profile.role = UserProfile.ROLE_TOURIST
		tourist.profile.save(update_fields=['role'])

		agency_active = User.objects.create_user(
			username='agency_active',
			email='agency_active@example.com',
			password='Pass12345!',
			is_active=True,
		)
		agency_active.profile.role = UserProfile.ROLE_AGENT
		agency_active.profile.save(update_fields=['role'])

		agency_inactive = User.objects.create_user(
			username='agency_inactive',
			email='agency_inactive@example.com',
			password='Pass12345!',
			is_active=False,
		)
		agency_inactive.profile.role = UserProfile.ROLE_AGENT
		agency_inactive.profile.save(update_fields=['role'])

		destination = Destination.objects.create(
			name='Pokhara Lake',
			slug='pokhara-lake',
			description='Beautiful destination',
			province='Gandaki',
			district='Kaski',
			created_by=agency_active,
			is_active=True,
		)

		Package.objects.create(
			destination=destination,
			title='Active Agency Package',
			slug='active-agency-package',
			description='Valid package',
			package_type='standard',
			tour_type='traveling',
			duration_days=3,
			max_group_size=10,
			price_npr=50000,
			created_by=agency_active,
			is_active=True,
		)

		Package.objects.create(
			destination=destination,
			title='Inactive Package',
			slug='inactive-package',
			description='Should not appear',
			package_type='standard',
			tour_type='traveling',
			duration_days=2,
			max_group_size=8,
			price_npr=30000,
			created_by=agency_active,
			is_active=False,
		)

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'tourist_browser', 'password': 'Pass12345!'},
			format='json',
		)
		token = login_response.data['access']
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

		response = self.client.get('/api/auth/agencies/public/', format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['username'], 'agency_active')
		self.assertEqual(response.data[0]['package_count'], 1)
		self.assertEqual(len(response.data[0]['packages']), 1)
		self.assertEqual(response.data[0]['packages'][0]['title'], 'Active Agency Package')

	def test_new_agent_gets_default_21_packages_excluding_mardi(self):
		owner = User.objects.create_user(
			username='seed_owner',
			email='seed_owner@example.com',
			password='Pass12345!',
			is_active=True,
		)
		owner.profile.role = UserProfile.ROLE_ADMIN
		owner.profile.save(update_fields=['role'])

		for idx in range(1, 8):
			Destination.objects.create(
				name=f'Default Destination {idx}',
				slug=f'default-destination-{idx}',
				description='Default destination seed',
				province='Bagmati',
				district='Kathmandu',
				created_by=owner,
				is_active=True,
			)

		Destination.objects.create(
			name='Mardi Trek',
			slug='mardi-trek',
			description='Must be excluded',
			province='Gandaki',
			district='Kaski',
			created_by=owner,
			is_active=True,
		)

		agent = User.objects.create_user(
			username='future_agent',
			email='future_agent@example.com',
			password='Pass12345!',
			is_active=True,
		)
		agent.profile.role = UserProfile.ROLE_AGENT
		agent.profile.save(update_fields=['role'])

		agent_packages = Package.objects.filter(created_by=agent)
		self.assertEqual(agent_packages.count(), 21)
		self.assertFalse(agent_packages.filter(destination__name__icontains='mardi').exists())
		self.assertEqual(PackageDeparture.objects.filter(package__created_by=agent).count(), 63)
