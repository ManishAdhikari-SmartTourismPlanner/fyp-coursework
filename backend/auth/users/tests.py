from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import UserProfile


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
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)
		self.assertIn('user', response.data)
		self.assertEqual(response.data['user']['username'], 'login_user')
		self.assertEqual(response.data['user']['role'], UserProfile.ROLE_TOURIST)

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
