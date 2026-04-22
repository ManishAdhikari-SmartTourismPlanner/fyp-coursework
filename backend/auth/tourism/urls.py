from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DestinationViewSet, PackageViewSet,
    PackageDepartureViewSet, BookingViewSet, PaymentViewSet
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r'destinations', DestinationViewSet, basename='destination')
router.register(r'packages', PackageViewSet, basename='package')
router.register(r'departures', PackageDepartureViewSet, basename='departure')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'payments', PaymentViewSet, basename='payment')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
