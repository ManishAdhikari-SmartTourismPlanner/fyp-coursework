from django.urls import path
from .views import CreateAgentView, LoginView, LogoutView, MeView, RegisterView, UserListView, VerifyOTPView

urlpatterns = [
	path('register/', RegisterView.as_view(), name='register'),
	path('login/', LoginView.as_view(), name='login'),
	path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
	path('logout/', LogoutView.as_view(), name='logout'),
	path('me/', MeView.as_view(), name='me'),
	path('agents/create/', CreateAgentView.as_view(), name='create_agent'),
	path('users/', UserListView.as_view(), name='user_list'),
]
 