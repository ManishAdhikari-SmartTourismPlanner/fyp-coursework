from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, BasePermission
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.urls import reverse
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models.deletion import ProtectedError
from datetime import timedelta
from uuid import uuid4

from .models import (
    Destination, Package, PackageDeparture,
    Booking, Payment
)
from .serializers import (
    DestinationListSerializer, DestinationDetailSerializer,
    PackageListSerializer, PackageDetailSerializer,
    PackageDepartureSerializer, BookingListSerializer, BookingDetailSerializer,
    PaymentSerializer
)
from .khalti_gateway import KhaltiPaymentGateway
from users.models import UserProfile


def _notify_package_cancelled(booking, package):
    if not booking.tourist.email:
        return

    payment = getattr(booking, 'payment', None)
    refund_note = ''
    if payment and payment.method == Payment.METHOD_KHALTI and payment.status == Payment.STATUS_SUCCESS:
        refund_note = '\nA refund has been queued for your Khalti payment. Admin will process it shortly.'

    message = (
        f'Hello {booking.tourist.username},\n\n'
        f'Your booking {booking.booking_code} has been cancelled because the agency cancelled package "{package.title}".'
        f'{refund_note}\n\n'
        'Please contact support if you need assistance.'
    )
    send_mail(
        'Smart Tourism: Package Cancelled',
        message,
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@smarttourism.local'),
        [booking.tourist.email],
        fail_silently=True,
    )


def _release_booking_seats(booking):
    if not booking.departure_id:
        return

    dep = PackageDeparture.objects.select_for_update().get(id=booking.departure_id)
    dep.available_seats = min(dep.total_seats, dep.available_seats + booking.travelers_count)
    dep.save(update_fields=['available_seats'])


def _expire_pending_booking_if_needed(booking):
    if booking.status != Booking.STATUS_PENDING:
        return False

    if not booking.payment_due_at:
        booking.payment_due_at = booking.booking_date + timedelta(minutes=Booking.PAYMENT_WINDOW_MINUTES)
        booking.save(update_fields=['payment_due_at'])

    if booking.payment_due_at and timezone.now() > booking.payment_due_at:
        with transaction.atomic():
            booking_locked = Booking.objects.select_for_update().get(id=booking.id)
            if booking_locked.status != Booking.STATUS_PENDING:
                return False
            _release_booking_seats(booking_locked)
            booking_locked.status = Booking.STATUS_CANCELLED
            booking_locked.cancellation_reason = Booking.CANCEL_REASON_TIMEOUT
            booking_locked.save(update_fields=['status', 'cancellation_reason'])
        return True

    return False


def _expire_pending_bookings_for_queryset(queryset):
    now = timezone.now()
    expired_ids = list(
        queryset.filter(status=Booking.STATUS_PENDING, payment_due_at__lt=now).values_list('id', flat=True)
    )

    if not expired_ids:
        return

    for booking_id in expired_ids:
        try:
            booking = Booking.objects.get(id=booking_id)
            _expire_pending_booking_if_needed(booking)
        except Booking.DoesNotExist:
            continue


def _close_past_departures(scope=None):
    today = timezone.now().date()
    queryset = scope if scope is not None else PackageDeparture.objects.all()
    queryset.filter(
        status=PackageDeparture.STATUS_OPEN,
        departure_date__lt=today,
    ).update(status=PackageDeparture.STATUS_CLOSED)


class IsAgentOrAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'profile')
            and request.user.profile.role in ['agent', 'admin']
        )

    def has_object_permission(self, request, view, obj):
        # Read permissions allowed to any request
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        # Write permissions - any authenticated agent or admin can edit/delete
        if hasattr(request.user, 'profile') and request.user.profile.role in ['agent', 'admin']:
            return True

        return False


class DestinationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Destination management.
    - GET /api/tourism/destinations/         (list all)
    - POST /api/tourism/destinations/        (create)
    - GET /api/tourism/destinations/{id}/    (detail)
    - PUT /api/tourism/destinations/{id}/    (update)
    - DELETE /api/tourism/destinations/{id}/ (delete)
    """
    queryset = Destination.objects.all()
    permission_classes = [IsAgentOrAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['province', 'district', 'tour_type', 'difficulty', 'best_season', 'is_active']
    search_fields = ['name', 'description', 'province', 'district']
    ordering_fields = ['name', 'altitude_m', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return Destination.objects.filter(is_active=True).order_by('name')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return DestinationDetailSerializer
        return DestinationListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _ensure_upper_mustang_manage_permission(self, instance):
        is_upper_mustang = (instance.name or '').strip().lower() == 'upper mustang'
        if not is_upper_mustang:
            return

        user_role = getattr(self.request.user.profile, 'role', '')
        if user_role == UserProfile.ROLE_ADMIN:
            return

        if instance.created_by_id != self.request.user.id:
            raise PermissionDenied('Only the creator can edit or delete Upper Mustang.')

    def perform_update(self, serializer):
        instance = self.get_object()
        self._ensure_upper_mustang_manage_permission(instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_upper_mustang_manage_permission(instance)
        try:
            instance.delete()
        except ProtectedError:
            # Keep booking/payment history intact by archiving instead of hard-deleting.
            with transaction.atomic():
                instance.is_active = False
                instance.save(update_fields=['is_active'])

                packages_qs = Package.objects.filter(destination=instance)
                packages_qs.update(is_active=False)
                PackageDeparture.objects.filter(
                    package__in=packages_qs,
                    status=PackageDeparture.STATUS_OPEN,
                ).update(status=PackageDeparture.STATUS_CANCELLED)

    @action(detail=True, methods=['get'])
    def packages(self, request, pk=None):
        """Get all packages for a destination"""
        destination = self.get_object()
        packages = destination.packages.all()
        serializer = PackageListSerializer(packages, many=True)
        return Response(serializer.data)


class PackageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Package management.
    Filter by destination, package_type, tour_type, price range
    """
    queryset = Package.objects.all()
    permission_classes = [IsAgentOrAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['destination', 'package_type', 'tour_type', 'created_by']
    search_fields = ['title', 'description', 'destination__name']
    ordering_fields = ['price_npr', 'duration_days', 'created_at']
    ordering = ['price_npr']

    def get_queryset(self):
        user = self.request.user
        # All users see only active packages under active destinations
        # Agents can still create/edit/delete, but manage only active ones
        return Package.objects.filter(is_active=True, destination__is_active=True)

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return PackageDetailSerializer
        return PackageListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _ensure_package_manage_permission(self, package):
        user_role = getattr(self.request.user.profile, 'role', '')
        if user_role == UserProfile.ROLE_ADMIN:
            return
        if user_role == UserProfile.ROLE_AGENT and package.created_by_id == self.request.user.id:
            return
        raise PermissionDenied('You can manage only packages created by your account.')

    def perform_update(self, serializer):
        self._ensure_package_manage_permission(self.get_object())
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_package_manage_permission(instance)
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError({'detail': 'This package cannot be deleted because related bookings exist. Cancel the package instead.'}) from exc

    @action(detail=True, methods=['post'])
    def cancel_package(self, request, pk=None):
        package = self.get_object()
        user_role = getattr(request.user.profile, 'role', '')
        if user_role not in ['agent', 'admin']:
            return Response({'error': 'Only agents/admin can cancel packages.'}, status=status.HTTP_403_FORBIDDEN)

        if user_role == 'agent' and package.created_by_id != request.user.id:
            return Response({'error': 'You can cancel only your own packages.'}, status=status.HTTP_403_FORBIDDEN)

        if not package.is_active:
            return Response({'message': 'Package is already cancelled.', 'package_id': package.id})

        with transaction.atomic():
            package.is_active = False
            package.save(update_fields=['is_active'])

            package.departures.filter(status=PackageDeparture.STATUS_OPEN).update(status=PackageDeparture.STATUS_CANCELLED)

            affected_bookings = list(
                Booking.objects.select_related('tourist', 'payment').filter(
                    package=package,
                    status__in=[Booking.STATUS_PENDING, Booking.STATUS_CONFIRMED, Booking.STATUS_RESCHEDULED],
                )
            )

            cancelled_count = 0
            refund_candidates = 0
            for booking in affected_bookings:
                if booking.departure_id:
                    _release_booking_seats(booking)
                booking.status = Booking.STATUS_CANCELLED
                booking.cancellation_reason = Booking.CANCEL_REASON_USER
                booking.save(update_fields=['status', 'cancellation_reason'])
                cancelled_count += 1

                payment = getattr(booking, 'payment', None)
                if payment and payment.method == Payment.METHOD_KHALTI and payment.status == Payment.STATUS_SUCCESS:
                    refund_candidates += 1

                _notify_package_cancelled(booking, package)

        return Response(
            {
                'message': 'Package cancelled successfully.',
                'package_id': package.id,
                'affected_bookings': cancelled_count,
                'refund_candidates': refund_candidates,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'])
    def departures(self, request, pk=None):
        """Get all departures for a package with available seats"""
        package = self.get_object()
        today = timezone.now().date()
        _close_past_departures(package.departures.all())
        departures = package.departures.filter(
            status=PackageDeparture.STATUS_OPEN,
            departure_date__gte=today,
        ).order_by('departure_date')
        serializer = PackageDepartureSerializer(departures, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def price_filter(self, request):
        """Filter packages by price range: ?min_price=X&max_price=Y"""
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        
        queryset = self.queryset
        if min_price:
            queryset = queryset.filter(price_npr__gte=float(min_price))
        if max_price:
            queryset = queryset.filter(price_npr__lte=float(max_price))
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class PackageDepartureViewSet(viewsets.ModelViewSet):
    """ViewSet for package departure management"""
    queryset = PackageDeparture.objects.all()
    serializer_class = PackageDepartureSerializer
    permission_classes = [IsAgentOrAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['package', 'status']
    ordering_fields = ['departure_date']
    ordering = ['departure_date']

    def get_queryset(self):
        queryset = super().get_queryset()
        _close_past_departures(queryset)
        return queryset

    def perform_create(self, serializer):
        departure_date = serializer.validated_data.get('departure_date')
        status_value = serializer.validated_data.get('status', PackageDeparture.STATUS_OPEN)

        if departure_date and departure_date < timezone.now().date() and status_value == PackageDeparture.STATUS_OPEN:
            serializer.save(status=PackageDeparture.STATUS_CLOSED)
            return

        serializer.save()

    @action(detail=True, methods=['post'])
    def book_seats(self, request, pk=None):
        """Book seats in a departure"""
        departure = self.get_object()
        if departure.departure_date < timezone.now().date():
            if departure.status == PackageDeparture.STATUS_OPEN:
                departure.status = PackageDeparture.STATUS_CLOSED
                departure.save(update_fields=['status'])
            return Response(
                {'error': 'Cannot book past departures.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        seats_needed = request.data.get('seats_needed', 1)
        
        if departure.available_seats < seats_needed:
            return Response(
                {'error': f'Only {departure.available_seats} seats available'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update available seats
        departure.available_seats -= seats_needed
        departure.save()
        
        return Response({
            'message': f'{seats_needed} seats booked successfully',
            'available_seats': departure.available_seats
        })


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Booking management.
    Tourists can only see/manage their own bookings.
    Admins can see all bookings.
    Agents can only see bookings for their own packages.
    """
    serializer_class = BookingListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'package']
    ordering_fields = ['booking_date', 'total_amount_npr']
    ordering = ['-booking_date']

    def get_queryset(self):
        user = self.request.user
        if user.profile.role == 'admin':
            queryset = Booking.objects.all()
            _expire_pending_bookings_for_queryset(queryset)
            return queryset

        if user.profile.role == 'agent':
            queryset = Booking.objects.filter(package__created_by=user)
            _expire_pending_bookings_for_queryset(queryset)
            return queryset

        # Tourists only see their own bookings
        queryset = Booking.objects.filter(tourist=user)
        _expire_pending_bookings_for_queryset(queryset)
        return queryset

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BookingDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return BookingDetailSerializer
        return BookingListSerializer

    def perform_create(self, serializer):
        departure = serializer.validated_data.get('departure')
        travelers_count = serializer.validated_data.get('travelers_count', 1)

        with transaction.atomic():
            if departure:
                locked_departure = PackageDeparture.objects.select_for_update().get(id=departure.id)
                if locked_departure.departure_date < timezone.now().date():
                    if locked_departure.status == PackageDeparture.STATUS_OPEN:
                        locked_departure.status = PackageDeparture.STATUS_CLOSED
                        locked_departure.save(update_fields=['status'])
                    raise ValidationError({'departure_id': 'Selected departure date has already passed.'})
                if locked_departure.status != 'open':
                    raise ValidationError({'departure_id': 'Selected departure is not open for booking.'})
                if locked_departure.available_seats < travelers_count:
                    raise ValidationError({'travelers_count': f'Only {locked_departure.available_seats} seats are available for this departure.'})

                locked_departure.available_seats -= travelers_count
                locked_departure.save(update_fields=['available_seats'])
                serializer.save(
                    tourist=self.request.user,
                    departure=locked_departure,
                    status=Booking.STATUS_PENDING,
                    payment_due_at=timezone.now() + timedelta(minutes=Booking.PAYMENT_WINDOW_MINUTES),
                )
                return

            serializer.save(
                tourist=self.request.user,
                status=Booking.STATUS_PENDING,
                payment_due_at=timezone.now() + timedelta(minutes=Booking.PAYMENT_WINDOW_MINUTES),
            )

    @action(detail=True, methods=['get'])
    def payment_status(self, request, pk=None):
        """Get payment status for a booking"""
        booking = self.get_object()
        _expire_pending_booking_if_needed(booking)
        if hasattr(booking, 'payment'):
            serializer = PaymentSerializer(booking.payment)
            return Response(serializer.data)
        return Response(
            {'detail': 'No payment found for this booking'},
            status=status.HTTP_404_NOT_FOUND
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a booking"""
        booking = self.get_object()
        if request.user.profile.role == 'agent':
            return Response(
                {'error': 'Agents cannot cancel bookings directly. Cancel the package instead.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.tourist != request.user and request.user.profile.role != 'admin':
            return Response(
                {'error': 'You do not have permission to cancel this booking'},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status == 'cancelled':
            return Response({'message': 'Booking is already cancelled.'})

        if booking.status == Booking.STATUS_PENDING:
            if _expire_pending_booking_if_needed(booking):
                return Response({'message': 'Booking cancelled due to payment timeout.'})

            if booking.payment_due_at and timezone.now() <= booking.payment_due_at:
                with transaction.atomic():
                    booking_locked = Booking.objects.select_for_update().get(id=booking.id)
                    if booking_locked.status == Booking.STATUS_PENDING:
                        _release_booking_seats(booking_locked)
                        booking_locked.status = Booking.STATUS_CANCELLED
                        booking_locked.cancellation_reason = Booking.CANCEL_REASON_USER
                        booking_locked.save(update_fields=['status', 'cancellation_reason'])
                        return Response({'message': 'Booking cancelled successfully within payment window.'})

        if booking.status == 'completed':
            return Response(
                {'error': 'Completed booking cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if booking.departure and booking.departure.departure_date <= timezone.now().date() + timedelta(days=2):
            return Response(
                {'error': 'Cancellation is allowed only up to 2 days before departure.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            if booking.departure:
                _release_booking_seats(booking)

            booking.status = 'cancelled'
            booking.cancellation_reason = Booking.CANCEL_REASON_USER
            booking.save(update_fields=['status', 'cancellation_reason'])
        return Response({'message': 'Booking cancelled successfully'})

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        """Reschedule a booking to another departure of the same package."""
        booking = self.get_object()
        new_departure_id = request.data.get('new_departure_id')

        if booking.tourist != request.user and request.user.profile.role not in ['admin', 'agent']:
            return Response(
                {'error': 'You do not have permission to reschedule this booking'},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status in ['cancelled', 'completed']:
            return Response(
                {'error': f'Cannot reschedule a {booking.status} booking.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not new_departure_id:
            return Response({'error': 'new_departure_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        if _expire_pending_booking_if_needed(booking):
            return Response({'error': 'Booking payment window has expired and booking was cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_departure = PackageDeparture.objects.get(id=new_departure_id)
        except PackageDeparture.DoesNotExist:
            return Response({'error': 'New departure not found'}, status=status.HTTP_404_NOT_FOUND)

        if new_departure.package_id != booking.package_id:
            return Response({'error': 'New departure must belong to the same package'}, status=status.HTTP_400_BAD_REQUEST)

        if new_departure.status != 'open':
            return Response({'error': 'New departure is not open'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            current_dep = None
            if booking.departure_id:
                current_dep = PackageDeparture.objects.select_for_update().get(id=booking.departure_id)

            new_dep_locked = PackageDeparture.objects.select_for_update().get(id=new_departure_id)

            if new_dep_locked.available_seats < booking.travelers_count:
                return Response(
                    {'error': f'Only {new_dep_locked.available_seats} seats are available on selected departure'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if current_dep:
                current_dep.available_seats = min(current_dep.total_seats, current_dep.available_seats + booking.travelers_count)
                current_dep.save(update_fields=['available_seats'])

            new_dep_locked.available_seats -= booking.travelers_count
            new_dep_locked.save(update_fields=['available_seats'])

            booking.departure = new_dep_locked
            booking.status = 'rescheduled'
            booking.save(update_fields=['departure', 'status'])

        return Response({'message': 'Booking rescheduled successfully', 'booking': BookingDetailSerializer(booking).data})

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a booking (agent/admin)"""
        booking = self.get_object()
        if request.user.profile.role not in ['admin', 'agent']:
            return Response(
                {'error': 'You do not have permission to confirm this booking'},
                status=status.HTTP_403_FORBIDDEN
            )

        booking.status = 'confirmed'
        booking.save(update_fields=['status'])
        return Response({'message': 'Booking confirmed successfully'})


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for payment tracking and management"""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['method', 'status', 'booking']
    ordering_fields = ['created_at', 'amount_npr']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if user.profile.role in ['agent', 'admin']:
            return Payment.objects.all()
        return Payment.objects.filter(booking__tourist=user)

    def perform_create(self, serializer):
        booking = serializer.validated_data.get('booking')
        if booking is None:
            raise ValidationError({'booking_id': 'Booking is required.'})

        if request_user := getattr(self.request, 'user', None):
            if request_user.profile.role not in ['agent', 'admin'] and booking.tourist_id != request_user.id:
                raise ValidationError({'booking_id': 'You do not have permission for this booking.'})

        if _expire_pending_booking_if_needed(booking):
            raise ValidationError({'booking_id': 'Booking has expired and was automatically cancelled.'})

        if booking.status != Booking.STATUS_PENDING:
            raise ValidationError({'booking_id': 'Only pending bookings can be paid.'})

        serializer.save()

    @action(detail=False, methods=['get'])
    def cancelled_package_refunds(self, request):
        if request.user.profile.role != 'admin':
            return Response({'error': 'Only admins can access refund queue.'}, status=status.HTTP_403_FORBIDDEN)

        rows = []
        refundable = Payment.objects.select_related('booking__tourist', 'booking__package').filter(
            method=Payment.METHOD_KHALTI,
            booking__package__is_active=False,
            booking__status=Booking.STATUS_CANCELLED,
            status__in=[Payment.STATUS_SUCCESS, Payment.STATUS_REFUNDED],
        ).order_by('-created_at')

        for payment in refundable:
            rows.append({
                'payment_id': payment.id,
                'booking_id': payment.booking_id,
                'booking_code': payment.booking.booking_code,
                'package_id': payment.booking.package_id,
                'package_title': payment.booking.package.title,
                'tourist_id': payment.booking.tourist_id,
                'tourist_username': payment.booking.tourist.username,
                'tourist_email': payment.booking.tourist.email,
                'amount_npr': float(payment.amount_npr),
                'method': payment.method,
                'status': payment.status,
                'transaction_id': payment.transaction_id,
                'can_refund': payment.status == Payment.STATUS_SUCCESS,
                'created_at': payment.created_at,
            })

        return Response(rows, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def refund_cancelled_package(self, request, pk=None):
        if request.user.profile.role != 'admin':
            return Response({'error': 'Only admins can refund cancelled packages.'}, status=status.HTTP_403_FORBIDDEN)

        payment = self.get_object()
        booking = payment.booking

        if payment.method != Payment.METHOD_KHALTI:
            return Response({'error': 'Only Khalti payments can be refunded from this action.'}, status=status.HTTP_400_BAD_REQUEST)

        if payment.status == Payment.STATUS_REFUNDED:
            return Response({'message': 'Payment is already refunded.'}, status=status.HTTP_200_OK)

        if payment.status != Payment.STATUS_SUCCESS:
            return Response({'error': 'Only successful payments can be refunded.'}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status != Booking.STATUS_CANCELLED or booking.package.is_active:
            return Response({'error': 'Refund is allowed only for cancelled bookings of cancelled packages.'}, status=status.HTTP_400_BAD_REQUEST)

        if not payment.transaction_id:
            return Response({'error': 'Missing transaction ID for Khalti refund.'}, status=status.HTTP_400_BAD_REQUEST)

        refund = KhaltiPaymentGateway.refund_payment(payment.transaction_id)
        if not refund.get('success'):
            return Response({'error': refund.get('error', 'Refund failed.')}, status=status.HTTP_400_BAD_REQUEST)

        payment.status = Payment.STATUS_REFUNDED
        payment.save(update_fields=['status'])

        if booking.tourist.email:
            message = (
                f'Hello {booking.tourist.username},\n\n'
                f'Your payment for booking {booking.booking_code} has been refunded via Khalti.\n'
                f'Amount: NPR {payment.amount_npr}\n\n'
                'Thank you for your patience.'
            )
            send_mail(
                'Smart Tourism: Refund Processed',
                message,
                getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@smarttourism.local'),
                [booking.tourist.email],
                fail_silently=True,
            )

        return Response(
            {
                'success': True,
                'payment_id': payment.id,
                'booking_code': booking.booking_code,
                'refund_reference': refund.get('refund_reference', ''),
                'status': payment.status,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'])
    def initiate_khalti(self, request):
        """
        Initiate Khalti hosted checkout.
        Request: { booking_id, amount_npr, frontend_url? }
        """
        booking_id = request.data.get('booking_id')
        amount_npr = request.data.get('amount_npr')
        frontend_url = request.data.get('frontend_url')

        if not booking_id or not amount_npr:
            return Response({'error': 'Missing booking_id or amount_npr'}, status=status.HTTP_400_BAD_REQUEST)

        if not settings.KHALTI_SECRET_KEY:
            return Response({'error': 'KHALTI_SECRET_KEY is not configured on server.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            booking = Booking.objects.get(id=booking_id, tourist=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if _expire_pending_booking_if_needed(booking):
            return Response({'error': 'Booking expired after 5 minutes and was cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status != Booking.STATUS_PENDING:
            return Response({'error': 'Only pending bookings can be paid.'}, status=status.HTTP_400_BAD_REQUEST)

        if not frontend_url:
            protocol = 'https' if request.is_secure() else 'http'
            frontend_url = request.META.get('HTTP_ORIGIN') or f"{protocol}://{request.get_host()}"

        use_khalti_mock = getattr(settings, 'KHALTI_USE_MOCK', False) and not getattr(settings, 'KHALTI_PRODUCTION_MODE', False)
        if use_khalti_mock:
            mock_pidx = f"MOCK_{booking.booking_code}_{uuid4().hex[:8]}"
            result = {
                'success': True,
                'payment_url': f"{frontend_url}/payment/khalti-success/?pidx={mock_pidx}",
                'pidx': mock_pidx,
            }
        else:
            result = KhaltiPaymentGateway.initiate_payment(booking, amount_npr, frontend_url)

        if not result.get('success'):
            return Response({'error': result.get('error', 'Failed to initiate Khalti payment')}, status=status.HTTP_400_BAD_REQUEST)

        Payment.objects.update_or_create(
            booking=booking,
            defaults={
                'method': Payment.METHOD_KHALTI,
                'amount_npr': amount_npr,
                'status': Payment.STATUS_PENDING,
                'transaction_id': result.get('pidx'),
            },
        )

        return Response({
            'success': True,
            'payment_url': result.get('payment_url'),
            'pidx': result.get('pidx'),
            'booking_code': booking.booking_code,
        })

    @action(detail=False, methods=['post'])
    def khalti_verify(self, request):
        """Verify Khalti payment using pidx after redirect callback."""
        pidx = request.data.get('pidx')
        if not pidx:
            return Response({'error': 'pidx is required'}, status=status.HTTP_400_BAD_REQUEST)

        verify = KhaltiPaymentGateway.lookup_payment(pidx)
        if not verify.get('success'):
            return Response({'error': verify.get('error', 'Failed to verify Khalti payment')}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.select_related('booking').get(transaction_id=pidx)
        except Payment.DoesNotExist:
            booking_code = verify.get('purchase_order_id')
            if not booking_code:
                return Response({'error': 'Payment record not found'}, status=status.HTTP_404_NOT_FOUND)
            try:
                booking = Booking.objects.get(booking_code=booking_code)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)
            payment = Payment.objects.filter(booking=booking).first()
            if payment is None:
                return Response({'error': 'Payment record not found'}, status=status.HTTP_404_NOT_FOUND)

        booking = payment.booking
        if booking.tourist_id != request.user.id and request.user.profile.role not in ['admin', 'agent']:
            return Response({'error': 'You do not have permission for this payment.'}, status=status.HTTP_403_FORBIDDEN)

        if _expire_pending_booking_if_needed(booking):
            return Response({'error': 'Payment arrived after expiry. Booking already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        if verify.get('status') != 'Completed':
            return Response({
                'success': False,
                'status': verify.get('status'),
                'message': 'Khalti payment not completed yet.'
            }, status=status.HTTP_400_BAD_REQUEST)

        payment.status = Payment.STATUS_SUCCESS
        payment.paid_at = timezone.now()
        payment.transaction_id = verify.get('transaction_id') or pidx
        payment.save(update_fields=['status', 'paid_at', 'transaction_id'])

        booking.status = Booking.STATUS_CONFIRMED
        booking.save(update_fields=['status'])

        return Response({
            'success': True,
            'booking_code': booking.booking_code,
            'booking_status': booking.status,
            'payment_status': payment.status,
        })

    @action(detail=True, methods=['post'])
    def confirm_payment(self, request, pk=None):
        """Confirm payment (for manual cash/bank transfers)"""
        payment = self.get_object()
        if request.user.profile.role != 'admin':
            return Response(
                {'error': 'Only admins can confirm payments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        payment.status = 'success'
        payment.save()
        return Response({'message': 'Payment confirmed', 'payment': PaymentSerializer(payment).data})


