from django.contrib.auth.models import User
from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase
import re

from users.models import LoginOTPChallenge, UserProfile


class AuthApiTests(APITestCase):
	def test_register_creates_user_and_tourist_profile(self):
		payload = {
			'username': 'new_tourist',
			'email': 'tourist@example.com',
			'password': 'Pass12345!',
			'confirm_password': 'Pass12345!',
		}

		response = self.client.post('/api/auth/register/', payload, format='json')

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		user = User.objects.get(username='new_tourist')
		self.assertTrue(UserProfile.objects.filter(user=user).exists())
		self.assertEqual(user.profile.role, UserProfile.ROLE_TOURIST)

	def test_login_returns_tokens_and_user_payload(self):
		user = User.objects.create_user(
			username='login_user',
			email='login@example.com',
			password='Pass12345!',
		)
		user.profile.role = UserProfile.ROLE_TOURIST
		user.profile.save(update_fields=['role'])

		payload = {
			'username': 'login_user',
			'password': 'Pass12345!',
		}

		response = self.client.post('/api/auth/login/', payload, format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(response.data.get('otp_required'))
		self.assertIn('challenge_id', response.data)

		challenge_id = response.data['challenge_id']
		self.assertEqual(len(mail.outbox), 1)
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
		self.assertIn('user', verify_response.data)
		self.assertEqual(verify_response.data['user']['username'], 'login_user')
		self.assertEqual(verify_response.data['user']['role'], UserProfile.ROLE_TOURIST)

	def test_agent_login_still_returns_tokens_without_otp(self):
		user = User.objects.create_user(
			username='agent_user',
			email='agent@example.com',
			password='Pass12345!',
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

	def test_tourist_otp_allows_only_five_attempts(self):
		user = User.objects.create_user(
			username='otp_user',
			email='otp@example.com',
			password='Pass12345!',
		)
		user.profile.role = UserProfile.ROLE_TOURIST
		user.profile.save(update_fields=['role'])

		login_response = self.client.post(
			'/api/auth/login/',
			{'username': 'otp_user', 'password': 'Pass12345!'},
			format='json',
		)
		challenge_id = login_response.data['challenge_id']

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
		challenge = LoginOTPChallenge.objects.get(id=challenge_id)
		self.assertTrue(challenge.is_used)

	def test_me_requires_auth_and_returns_current_user(self):
		user = User.objects.create_user(
			username='me_user',
			email='me@example.com',
			password='Pass12345!',
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
