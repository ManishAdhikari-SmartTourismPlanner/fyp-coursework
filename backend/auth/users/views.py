from datetime import timedelta
from random import randint

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import LoginOTPChallenge, UserProfile
from .serializers import (
	CreateAgentSerializer,
	LoginSerializer,
	LogoutSerializer,
	RegisterSerializer,
	UserProfileSerializer,
	VerifyOTPSerializer,
)


OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 5


def _issue_auth_tokens(user):
	role = getattr(user.profile, 'role', UserProfile.ROLE_TOURIST)
	refresh = RefreshToken.for_user(user)
	refresh['username'] = user.username
	refresh['role'] = role
	access = refresh.access_token
	access['username'] = user.username
	access['role'] = role

	return {
		'access': str(access),
		'refresh': str(refresh),
		'user': {
			'id': user.id,
			'username': user.username,
			'email': user.email,
			'role': role,
		},
	}


def _send_login_otp(user, code):
	subject = 'Your Smart Tourism Login OTP'
	message = (
		f'Hello {user.username},\n\n'
		f'Your one-time password (OTP) is: {code}\n'
		f'It expires in {OTP_EXPIRY_MINUTES} minutes.\n\n'
		'If you did not request this login, please ignore this email.'
	)
	from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@smarttourism.local')
	send_mail(subject, message, from_email, [user.email], fail_silently=False)


class IsAdminRole(permissions.BasePermission):
	def has_permission(self, request, view):
		return bool(
			request.user.is_authenticated
			and hasattr(request.user, 'profile')
			and request.user.profile.role == UserProfile.ROLE_ADMIN
		)


class RegisterView(generics.CreateAPIView):
	serializer_class = RegisterSerializer
	permission_classes = [permissions.AllowAny]


class LoginView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = LoginSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		username = serializer.validated_data['username']
		password = serializer.validated_data['password']
		user = authenticate(request=request, username=username, password=password)

		if not user:
			return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

		if not user.is_active:
			return Response({'detail': 'User account is disabled.'}, status=status.HTTP_401_UNAUTHORIZED)

		role = getattr(user.profile, 'role', UserProfile.ROLE_TOURIST)
		if role != UserProfile.ROLE_TOURIST:
			return Response(_issue_auth_tokens(user), status=status.HTTP_200_OK)

		if not user.email:
			return Response({'detail': 'Tourist account must have an email for OTP login.'}, status=status.HTTP_400_BAD_REQUEST)

		LoginOTPChallenge.objects.filter(user=user, is_used=False).update(is_used=True)

		otp_code = f"{randint(0, 999999):06d}"
		challenge = LoginOTPChallenge.objects.create(
			user=user,
			code_hash=make_password(otp_code),
			expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
		)

		try:
			_send_login_otp(user, otp_code)
		except Exception:
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'Failed to send OTP email. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		return Response({
			'otp_required': True,
			'challenge_id': str(challenge.id),
			'expires_in_seconds': OTP_EXPIRY_MINUTES * 60,
			'message': 'OTP sent to your email.',
			**({'debug_otp': otp_code} if settings.DEBUG else {}),
		}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = VerifyOTPSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		challenge_id = serializer.validated_data['challenge_id']
		code = serializer.validated_data['code']

		try:
			challenge = LoginOTPChallenge.objects.select_related('user', 'user__profile').get(id=challenge_id)
		except LoginOTPChallenge.DoesNotExist:
			return Response({'detail': 'Invalid OTP challenge.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.is_used:
			return Response({'detail': 'This OTP has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.is_expired():
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'OTP expired. Please login again.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.attempts >= OTP_MAX_ATTEMPTS:
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'Maximum OTP attempts exceeded. Please login again.'}, status=status.HTTP_400_BAD_REQUEST)

		if not check_password(code, challenge.code_hash):
			challenge.attempts += 1
			update_fields = ['attempts']
			if challenge.attempts >= OTP_MAX_ATTEMPTS:
				challenge.is_used = True
				update_fields.append('is_used')
			challenge.save(update_fields=update_fields)
			return Response({'detail': 'Invalid OTP code.'}, status=status.HTTP_400_BAD_REQUEST)

		challenge.is_used = True
		challenge.save(update_fields=['is_used'])

		user = challenge.user
		if not user.is_active:
			return Response({'detail': 'User account is disabled.'}, status=status.HTTP_401_UNAUTHORIZED)

		return Response(_issue_auth_tokens(user), status=status.HTTP_200_OK)


class MeView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		payload = {
			'id': request.user.id,
			'username': request.user.username,
			'email': request.user.email,
			'role': getattr(request.user.profile, 'role', UserProfile.ROLE_TOURIST),
		}
		serializer = UserProfileSerializer(payload)
		return Response(serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = LogoutSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		refresh_token = serializer.validated_data['refresh']
		token = RefreshToken(refresh_token)
		token.blacklist()
		return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class CreateAgentView(generics.CreateAPIView):
	serializer_class = CreateAgentSerializer
	permission_classes = [IsAdminRole]


class UserListView(generics.ListAPIView):
	permission_classes = [IsAdminRole]

	def get(self, request):
		users = User.objects.select_related('profile').all().order_by('-id')
		data = [
			{
				'id': user.id,
				'username': user.username,
				'email': user.email,
				'role': getattr(user.profile, 'role', UserProfile.ROLE_TOURIST),
			}
			for user in users
		]
		return Response(data, status=status.HTTP_200_OK)
