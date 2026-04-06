from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('api/auth/', include('users.urls')),
    path('api/tourism/', include('tourism.urls')),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
