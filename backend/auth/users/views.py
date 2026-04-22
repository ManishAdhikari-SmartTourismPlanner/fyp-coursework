from datetime import timedelta
from random import randint

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AdminAuditLog, PasswordResetOTPChallenge, RegistrationOTPChallenge, UserProfile
from .serializers import (
    AdminUserUpdateSerializer,
	AdminAuditLogSerializer,
	CreateAgentSerializer,
	ForgotPasswordSerializer,
	LoginSerializer,
	LogoutSerializer,
	ProfileUpdateSerializer,
	PublicAgencySerializer,
	RegisterSerializer,
	ResetPasswordSerializer,
	UserProfileSerializer,
	VerifyOTPSerializer,
)

from tourism.models import Booking, Package, Payment


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


def _send_registration_otp(username, email, code):
	subject = 'Verify Your Smart Tourism Registration'
	message = (
		f'Hello {username},\n\n'
		f'Your one-time password (OTP) is: {code}\n'
		f'It expires in {OTP_EXPIRY_MINUTES} minutes.\n\n'
		'Use this OTP to verify your account registration.\n'
		'If you did not create this account, please ignore this email.'
	)
	from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@smarttourism.local')
	send_mail(subject, message, from_email, [email], fail_silently=False)


def _send_password_reset_otp(username, email, code):
	subject = 'Smart Tourism Password Reset OTP'
	message = (
		f'Hello {username},\n\n'
		f'Your password reset OTP is: {code}\n'
		f'It expires in {OTP_EXPIRY_MINUTES} minutes.\n\n'
		'If you did not request a password reset, please ignore this email.'
	)
	from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@smarttourism.local')
	send_mail(subject, message, from_email, [email], fail_silently=False)


def _user_payload(user):
	return {
		'id': user.id,
		'username': user.username,
		'email': user.email,
		'role': getattr(user.profile, 'role', UserProfile.ROLE_TOURIST),
		'is_active': user.is_active,
		'date_joined': user.date_joined,
		'last_login': user.last_login,
	}


def _log_admin_action(request, action, target_type='', target_id='', target_display='', metadata=None):
	if not request.user.is_authenticated:
		return
	AdminAuditLog.objects.create(
		action=action,
		actor=request.user,
		target_type=target_type,
		target_id=str(target_id or ''),
		target_display=target_display or '',
		metadata=metadata or {},
	)


class IsAdminRole(permissions.BasePermission):
	def has_permission(self, request, view):
		return bool(
			request.user.is_authenticated
			and hasattr(request.user, 'profile')
			and request.user.profile.role == UserProfile.ROLE_ADMIN
		)


class RegisterView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = RegisterSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		validated = serializer.validated_data
		RegistrationOTPChallenge.objects.filter(
			pending_username=validated['username'],
			is_used=False,
		).update(is_used=True)
		RegistrationOTPChallenge.objects.filter(
			pending_email=validated['email'],
			is_used=False,
		).update(is_used=True)

		otp_code = f"{randint(0, 999999):06d}"
		challenge = RegistrationOTPChallenge.objects.create(
			pending_username=validated['username'],
			pending_email=validated['email'],
			pending_password_hash=make_password(validated['password']),
			code_hash=make_password(otp_code),
			expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
		)

		try:
			_send_registration_otp(validated['username'], validated['email'], otp_code)
		except Exception:
			challenge.delete()
			return Response({'detail': 'Failed to send OTP email. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		return Response({
			'otp_required': True,
			'challenge_id': str(challenge.id),
			'expires_in_seconds': OTP_EXPIRY_MINUTES * 60,
			'message': 'Registration OTP sent to your email.',
		}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = LoginSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		username = serializer.validated_data['username']
		password = serializer.validated_data['password']
		candidate = User.objects.filter(username=username).first()
		if candidate and not candidate.is_active and candidate.check_password(password):
			return Response({'detail': 'User account is disabled.'}, status=status.HTTP_401_UNAUTHORIZED)
		user = authenticate(request=request, username=username, password=password)

		if not user:
			return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

		return Response(_issue_auth_tokens(user), status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = VerifyOTPSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		challenge_id = serializer.validated_data['challenge_id']
		code = serializer.validated_data['code']

		try:
			challenge = RegistrationOTPChallenge.objects.get(id=challenge_id)
		except RegistrationOTPChallenge.DoesNotExist:
			return Response({'detail': 'Invalid OTP challenge.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.is_used:
			return Response({'detail': 'This OTP has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.is_expired():
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'OTP expired. Please register again.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.attempts >= OTP_MAX_ATTEMPTS:
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'Maximum OTP attempts exceeded. Please register again.'}, status=status.HTTP_400_BAD_REQUEST)

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

		if User.objects.filter(username=challenge.pending_username).exists():
			return Response({'detail': 'Username already exists. Please register again.'}, status=status.HTTP_400_BAD_REQUEST)

		if User.objects.filter(email__iexact=challenge.pending_email).exists():
			return Response({'detail': 'Email already exists. Please register again.'}, status=status.HTTP_400_BAD_REQUEST)

		with transaction.atomic():
			user = User.objects.create(
				username=challenge.pending_username,
				email=challenge.pending_email,
				password=challenge.pending_password_hash,
				is_active=True,
			)

		return Response(_issue_auth_tokens(user), status=status.HTTP_200_OK)


class MeView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		payload = {
			'id': request.user.id,
			'username': request.user.username,
			'email': request.user.email,
			'role': getattr(request.user.profile, 'role', UserProfile.ROLE_TOURIST),
			'first_name': request.user.first_name,
			'last_name': request.user.last_name,
		}
		serializer = UserProfileSerializer(payload)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def patch(self, request):
		if request.user.profile.role not in [UserProfile.ROLE_TOURIST, UserProfile.ROLE_AGENT, UserProfile.ROLE_ADMIN]:
			return Response({'detail': 'Profile editing is allowed for tourists, agencies, and admins only.'}, status=status.HTTP_403_FORBIDDEN)

		serializer = ProfileUpdateSerializer(data=request.data, context={'user': request.user})
		serializer.is_valid(raise_exception=True)
		validated = serializer.validated_data

		request.user.username = validated['username']
		request.user.email = validated['email']
		request.user.first_name = validated.get('first_name', request.user.first_name)
		request.user.last_name = validated.get('last_name', request.user.last_name)
		request.user.save(update_fields=['username', 'email', 'first_name', 'last_name'])

		payload = {
			'id': request.user.id,
			'username': request.user.username,
			'email': request.user.email,
			'role': getattr(request.user.profile, 'role', UserProfile.ROLE_TOURIST),
		}
		return Response(payload, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = ForgotPasswordSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		email = serializer.validated_data['email']
		user = User.objects.filter(email__iexact=email, is_active=True).first()
		if not user:
			return Response({'detail': 'No active user found with this email.'}, status=status.HTTP_404_NOT_FOUND)

		PasswordResetOTPChallenge.objects.filter(user=user, is_used=False).update(is_used=True)

		otp_code = f"{randint(0, 999999):06d}"
		challenge = PasswordResetOTPChallenge.objects.create(
			user=user,
			code_hash=make_password(otp_code),
			expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
		)

		try:
			_send_password_reset_otp(user.username, user.email, otp_code)
		except Exception:
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'Failed to send reset OTP email. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		return Response(
			{
				'otp_required': True,
				'challenge_id': str(challenge.id),
				'expires_in_seconds': OTP_EXPIRY_MINUTES * 60,
				'message': 'Password reset OTP sent to your email.',
			},
			status=status.HTTP_200_OK,
		)


class ResetPasswordView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = ResetPasswordSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		challenge_id = serializer.validated_data['challenge_id']
		code = serializer.validated_data['code']
		new_password = serializer.validated_data['new_password']

		try:
			challenge = PasswordResetOTPChallenge.objects.select_related('user').get(id=challenge_id)
		except PasswordResetOTPChallenge.DoesNotExist:
			return Response({'detail': 'Invalid password reset challenge.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.is_used:
			return Response({'detail': 'This reset OTP has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.is_expired():
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'Reset OTP expired. Please request again.'}, status=status.HTTP_400_BAD_REQUEST)

		if challenge.attempts >= OTP_MAX_ATTEMPTS:
			challenge.is_used = True
			challenge.save(update_fields=['is_used'])
			return Response({'detail': 'Maximum OTP attempts exceeded. Please request a new OTP.'}, status=status.HTTP_400_BAD_REQUEST)

		if not check_password(code, challenge.code_hash):
			challenge.attempts += 1
			update_fields = ['attempts']
			if challenge.attempts >= OTP_MAX_ATTEMPTS:
				challenge.is_used = True
				update_fields.append('is_used')
			challenge.save(update_fields=update_fields)
			return Response({'detail': 'Invalid reset OTP code.'}, status=status.HTTP_400_BAD_REQUEST)

		user = challenge.user
		user.set_password(new_password)
		user.save(update_fields=['password'])

		challenge.is_used = True
		challenge.save(update_fields=['is_used'])

		return Response({'detail': 'Password reset successful. Please login with your new password.'}, status=status.HTTP_200_OK)


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

	def create(self, request, *args, **kwargs):
		response = super().create(request, *args, **kwargs)
		created_username = response.data.get('username', '')
		created_id = response.data.get('id', '')
		_log_admin_action(
			request,
			action='create_agency',
			target_type='user',
			target_id=created_id,
			target_display=created_username,
		)
		return response


class UserListView(generics.ListAPIView):
	permission_classes = [IsAdminRole]

	def get(self, request):
		users = User.objects.select_related('profile').all().order_by('-id')
		data = [_user_payload(user) for user in users]
		return Response(data, status=status.HTTP_200_OK)


class UserDeactivateView(APIView):
	permission_classes = [IsAdminRole]

	def post(self, request, user_id):
		target = User.objects.select_related('profile').filter(id=user_id).first()
		if not target:
			return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
		if target.id == request.user.id:
			return Response({'detail': 'You cannot deactivate your own account.'}, status=status.HTTP_400_BAD_REQUEST)

		target.is_active = False
		target.save(update_fields=['is_active'])

		_log_admin_action(
			request,
			action='deactivate_user',
			target_type='user',
			target_id=target.id,
			target_display=target.username,
			metadata={'role': getattr(target.profile, 'role', UserProfile.ROLE_TOURIST)},
		)
		return Response({'detail': 'User deactivated successfully.'}, status=status.HTTP_200_OK)


class UserActivateView(APIView):
	permission_classes = [IsAdminRole]

	def post(self, request, user_id):
		target = User.objects.select_related('profile').filter(id=user_id).first()
		if not target:
			return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

		target.is_active = True
		target.save(update_fields=['is_active'])

		_log_admin_action(
			request,
			action='activate_user',
			target_type='user',
			target_id=target.id,
			target_display=target.username,
			metadata={'role': getattr(target.profile, 'role', UserProfile.ROLE_TOURIST)},
		)
		return Response({'detail': 'User activated successfully.'}, status=status.HTTP_200_OK)


class UserDeleteView(APIView):
	permission_classes = [IsAdminRole]

	def patch(self, request, user_id):
		target = User.objects.select_related('profile').filter(id=user_id).first()
		if not target:
			return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

		serializer = AdminUserUpdateSerializer(data=request.data, context={'user': target})
		serializer.is_valid(raise_exception=True)
		validated = serializer.validated_data

		target.username = validated['username']
		target.email = validated['email']
		target.first_name = validated.get('first_name', target.first_name)
		target.last_name = validated.get('last_name', target.last_name)
		target.save(update_fields=['username', 'email', 'first_name', 'last_name'])

		_log_admin_action(
			request,
			action='edit_user',
			target_type='user',
			target_id=target.id,
			target_display=target.username,
			metadata={'role': getattr(target.profile, 'role', UserProfile.ROLE_TOURIST)},
		)
		return Response(_user_payload(target), status=status.HTTP_200_OK)

	def delete(self, request, user_id):
		target = User.objects.select_related('profile').filter(id=user_id).first()
		if not target:
			return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
		if target.id == request.user.id:
			return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

		target_role = getattr(target.profile, 'role', UserProfile.ROLE_TOURIST)
		if target_role == UserProfile.ROLE_ADMIN:
			return Response({'detail': 'Admin users cannot be deleted from dashboard.'}, status=status.HTTP_400_BAD_REQUEST)

		if target.bookings.exists():
			return Response(
				{'detail': 'This user cannot be deleted because they have bookings. Deactivate the user instead.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if target.created_packages.exists():
			return Response(
				{'detail': 'This user cannot be deleted because they own packages. Remove or reassign the packages first.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if target.created_destinations.exists():
			return Response(
				{'detail': 'This user cannot be deleted because they created destinations. Remove or reassign those destinations first.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		target_username = target.username
		target_id = target.id
		try:
			target.delete()
		except ProtectedError:
			return Response(
				{'detail': 'This user cannot be deleted because related records still exist. Remove or reassign them first.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		_log_admin_action(
			request,
			action='delete_user',
			target_type='user',
			target_id=target_id,
			target_display=target_username,
			metadata={'role': target_role},
		)
		return Response({'detail': 'User deleted successfully.'}, status=status.HTTP_200_OK)


class AgencyListView(APIView):
	permission_classes = [IsAdminRole]

	def get(self, request):
		agencies = User.objects.select_related('profile').filter(profile__role=UserProfile.ROLE_AGENT).order_by('-id')
		return Response([_user_payload(agent) for agent in agencies], status=status.HTTP_200_OK)


class PublicAgencyListView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		active_packages_qs = Package.objects.filter(
			is_active=True,
			destination__is_active=True,
		).select_related('destination').order_by('-created_at')

		agencies = User.objects.select_related('profile').filter(
			profile__role=UserProfile.ROLE_AGENT,
			is_active=True,
		).prefetch_related(
			Prefetch('created_packages', queryset=active_packages_qs, to_attr='active_packages')
		).order_by('username')

		rows = []
		for agency in agencies:
			packages = getattr(agency, 'active_packages', [])
			rows.append({
				'id': agency.id,
				'username': agency.username,
				'email': agency.email,
				'package_count': len(packages),
				'packages': packages,
			})

		serializer = PublicAgencySerializer(rows, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)


class AgencyDeleteView(APIView):
	permission_classes = [IsAdminRole]

	def patch(self, request, agency_id):
		agency = User.objects.select_related('profile').filter(id=agency_id, profile__role=UserProfile.ROLE_AGENT).first()
		if not agency:
			return Response({'detail': 'Agency not found.'}, status=status.HTTP_404_NOT_FOUND)

		serializer = AdminUserUpdateSerializer(data=request.data, context={'user': agency})
		serializer.is_valid(raise_exception=True)
		validated = serializer.validated_data

		agency.username = validated['username']
		agency.email = validated['email']
		agency.first_name = validated.get('first_name', agency.first_name)
		agency.last_name = validated.get('last_name', agency.last_name)
		agency.save(update_fields=['username', 'email', 'first_name', 'last_name'])

		_log_admin_action(
			request,
			action='edit_agency',
			target_type='user',
			target_id=agency.id,
			target_display=agency.username,
		)
		return Response(_user_payload(agency), status=status.HTTP_200_OK)

	def delete(self, request, agency_id):
		agency = User.objects.select_related('profile').filter(id=agency_id, profile__role=UserProfile.ROLE_AGENT).first()
		if not agency:
			return Response({'detail': 'Agency not found.'}, status=status.HTTP_404_NOT_FOUND)

		agency_username = agency.username
		agency_id_value = agency.id
		agency.delete()

		_log_admin_action(
			request,
			action='delete_agency',
			target_type='user',
			target_id=agency_id_value,
			target_display=agency_username,
		)
		return Response({'detail': 'Agency deleted successfully.'}, status=status.HTTP_200_OK)


class AgencyDeactivateView(APIView):
	permission_classes = [IsAdminRole]

	def post(self, request, agency_id):
		agency = User.objects.select_related('profile').filter(id=agency_id, profile__role=UserProfile.ROLE_AGENT).first()
		if not agency:
			return Response({'detail': 'Agency not found.'}, status=status.HTTP_404_NOT_FOUND)

		agency.is_active = False
		agency.save(update_fields=['is_active'])

		_log_admin_action(
			request,
			action='deactivate_agency',
			target_type='user',
			target_id=agency.id,
			target_display=agency.username,
		)
		return Response({'detail': 'Agency deactivated successfully.'}, status=status.HTTP_200_OK)


class AgencyActivateView(APIView):
	permission_classes = [IsAdminRole]

	def post(self, request, agency_id):
		agency = User.objects.select_related('profile').filter(id=agency_id, profile__role=UserProfile.ROLE_AGENT).first()
		if not agency:
			return Response({'detail': 'Agency not found.'}, status=status.HTTP_404_NOT_FOUND)

		agency.is_active = True
		agency.save(update_fields=['is_active'])

		_log_admin_action(
			request,
			action='activate_agency',
			target_type='user',
			target_id=agency.id,
			target_display=agency.username,
		)
		return Response({'detail': 'Agency activated successfully.'}, status=status.HTTP_200_OK)


class AdminAnalyticsView(APIView):
	permission_classes = [IsAdminRole]

	def get(self, request):
		total_users = User.objects.count()
		total_tourists = User.objects.filter(profile__role=UserProfile.ROLE_TOURIST).count()
		total_agents = User.objects.filter(profile__role=UserProfile.ROLE_AGENT).count()
		active_users = User.objects.filter(is_active=True).count()

		total_bookings = Booking.objects.count()
		confirmed_bookings = Booking.objects.filter(status=Booking.STATUS_CONFIRMED).count()
		pending_bookings = Booking.objects.filter(status=Booking.STATUS_PENDING).count()
		cancelled_bookings = Booking.objects.filter(status=Booking.STATUS_CANCELLED).count()

		total_payments = Payment.objects.count()
		success_payments = Payment.objects.filter(status=Payment.STATUS_SUCCESS).count()
		pending_payments = Payment.objects.filter(status=Payment.STATUS_PENDING).count()
		failed_payments = Payment.objects.filter(status=Payment.STATUS_FAILED).count()
		total_revenue = sum([float(item.amount_npr) for item in Payment.objects.filter(status=Payment.STATUS_SUCCESS)])

		recent_payments = Payment.objects.select_related('booking').order_by('-created_at')[:10]
		recent_payment_rows = [
			{
				'id': p.id,
				'booking_code': p.booking.booking_code,
				'amount_npr': float(p.amount_npr),
				'method': p.method,
				'status': p.status,
				'created_at': p.created_at,
			}
			for p in recent_payments
		]

		return Response(
			{
				'users': {
					'total': total_users,
					'tourists': total_tourists,
					'agencies': total_agents,
					'active': active_users,
				},
				'bookings': {
					'total': total_bookings,
					'confirmed': confirmed_bookings,
					'pending': pending_bookings,
					'cancelled': cancelled_bookings,
				},
				'payments': {
					'total': total_payments,
					'success': success_payments,
					'pending': pending_payments,
					'failed': failed_payments,
					'total_revenue_npr': round(total_revenue, 2),
				},
				'recent_payments': recent_payment_rows,
			},
			status=status.HTTP_200_OK,
		)


class AdminAuditLogListView(APIView):
	permission_classes = [IsAdminRole]

	def get(self, request):
		logs = AdminAuditLog.objects.select_related('actor').all()[:100]
		serializer = AdminAuditLogSerializer(logs, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)
