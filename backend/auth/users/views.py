from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import UserProfile
from .serializers import (
	CreateAgentSerializer,
	CustomTokenObtainPairSerializer,
	LogoutSerializer,
	RegisterSerializer,
	UserProfileSerializer,
)


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


class LoginView(TokenObtainPairView):
	serializer_class = CustomTokenObtainPairSerializer
	permission_classes = [permissions.AllowAny]


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
