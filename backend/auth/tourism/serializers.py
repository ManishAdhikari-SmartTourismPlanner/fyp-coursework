from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Destination, Package, PackageDeparture,
    Booking, Payment
)


class DestinationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing destinations"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    packages_count = serializers.SerializerMethodField()

    class Meta:
        model = Destination
        fields = [
            'id', 'name', 'slug', 'province', 'district', 'altitude_m',
            'best_season', 'tour_type', 'difficulty', 'suggested_duration_days',
            'image_url', 'is_active', 'created_by_username', 'packages_count'
        ]

    def get_packages_count(self, obj):
        return obj.packages.count()


class DestinationDetailSerializer(serializers.ModelSerializer):
    """Full serializer for destination details"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Destination
        fields = [
            'id', 'name', 'slug', 'description', 'province', 'district',
            'nearest_city', 'altitude_m', 'best_season', 'tour_type', 'difficulty',
            'suggested_duration_days', 'image_url', 'is_active', 'created_by_username',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'id']


class PackageListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing packages"""
    destination_name = serializers.CharField(source='destination.name', read_only=True)
    destination_id = serializers.IntegerField(source='destination.id', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    available_departures = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            'id', 'destination_id', 'destination_name', 'created_by_username', 'title', 'slug', 'package_type',
            'tour_type', 'duration_days', 'max_group_size', 'price_npr', 'is_active',
            'available_departures'
        ]

    def get_available_departures(self, obj):
        departures = obj.departures.filter(status__in=['open', 'active'])
        return PackageDepartureSerializer(departures, many=True).data


class PackageDetailSerializer(serializers.ModelSerializer):
    """Full serializer for package details"""
    destination = DestinationListSerializer(read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    destination_id = serializers.IntegerField(write_only=True)
    departures = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            'id', 'destination', 'created_by_username', 'destination_id', 'title', 'slug', 'description',
            'package_type', 'tour_type', 'duration_days', 'max_group_size',
            'price_npr', 'includes', 'excludes', 'itinerary_overview', 'is_active',
            'created_by', 'created_at', 'updated_at', 'departures'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_departures(self, obj):
        departures = obj.departures.all().order_by('departure_date')
        return PackageDepartureSerializer(departures, many=True).data

    def validate(self, attrs):
        destination_id = attrs.get('destination_id')
        package_type = attrs.get('package_type')
        if destination_id is None and self.instance is not None:
            destination_id = self.instance.destination_id
        if package_type is None and self.instance is not None:
            package_type = self.instance.package_type

        if destination_id is not None:
            existing = Package.objects.filter(destination_id=destination_id)
            if self.instance is not None:
                existing = existing.exclude(id=self.instance.id)

            if package_type and existing.filter(package_type=package_type).exists():
                raise serializers.ValidationError({'package_type': 'This destination already has this package type. Use one each of normal, standard, and deluxe.'})

            if existing.count() >= 3:
                raise serializers.ValidationError({'destination_id': 'A maximum of 3 packages is allowed per destination.'})

        return attrs

    def create(self, validated_data):
        destination_id = validated_data.pop('destination_id')
        return Package.objects.create(destination_id=destination_id, **validated_data)

    def update(self, instance, validated_data):
        destination_id = validated_data.pop('destination_id', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if destination_id is not None:
            instance.destination_id = destination_id
        instance.save()
        return instance


class PackageDepartureSerializer(serializers.ModelSerializer):
    package_title = serializers.CharField(source='package.title', read_only=True)
    package_id = serializers.IntegerField(write_only=True, required=False)
    seats_available = serializers.SerializerMethodField()

    class Meta:
        model = PackageDeparture
        fields = [
            'id', 'package_title', 'package_id', 'departure_date', 'total_seats',
            'available_seats', 'seats_available', 'status'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_seats_available(self, obj):
        return obj.available_seats > 0

    def create(self, validated_data):
        package_id = validated_data.pop('package_id', None)
        if package_id is not None:
            validated_data['package_id'] = package_id

        if 'available_seats' not in validated_data:
            validated_data['available_seats'] = validated_data.get('total_seats', 1)

        return PackageDeparture.objects.create(**validated_data)

    def update(self, instance, validated_data):
        package_id = validated_data.pop('package_id', None)
        if package_id is not None:
            instance.package_id = package_id

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class BookingListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listings"""
    tourist_username = serializers.CharField(source='tourist.username', read_only=True)
    package_title = serializers.CharField(source='package.title', read_only=True)
    destination_name = serializers.CharField(source='package.destination.name', read_only=True)
    agency_username = serializers.CharField(source='package.created_by.username', read_only=True)
    departure_date = serializers.SerializerMethodField()
    payment_due_at = serializers.DateTimeField(read_only=True)
    cancellation_reason = serializers.CharField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_code', 'tourist_username', 'agency_username', 'package_title',
            'destination_name', 'departure_date', 'travelers_count',
            'status', 'cancellation_reason', 'total_amount_npr', 'booking_date',
            'payment_due_at'
        ]
        read_only_fields = ['id', 'booking_code', 'booking_date']

    def get_departure_date(self, obj):
        if obj.departure:
            return obj.departure.departure_date
        return None


class BookingDetailSerializer(serializers.ModelSerializer):
    """Full serializer with related objects"""
    tourist_username = serializers.CharField(source='tourist.username', read_only=True)
    package = PackageListSerializer(read_only=True)
    package_id = serializers.IntegerField(write_only=True)
    departure = PackageDepartureSerializer(read_only=True)
    departure_id = serializers.IntegerField(write_only=True)
    payment = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_code', 'tourist', 'tourist_username', 'package',
            'package_id', 'departure', 'departure_id', 'travelers_count',
            'status', 'cancellation_reason', 'special_request', 'total_amount_npr',
            'booking_date', 'payment_due_at', 'created_at', 'updated_at', 'payment'
        ]
        read_only_fields = ['id', 'booking_code', 'tourist', 'booking_date', 'created_at', 'updated_at']

    def validate(self, attrs):
        package_id = attrs.get('package_id')
        departure_id = attrs.get('departure_id')

        if package_id is None and self.instance is not None:
            package_id = self.instance.package_id
        if departure_id is None and self.instance is not None:
            departure_id = self.instance.departure_id

        if package_id is not None:
            try:
                package = Package.objects.get(id=package_id)
            except Package.DoesNotExist:
                raise serializers.ValidationError({'package_id': 'Selected package does not exist.'})

            if not package.is_active or not package.destination.is_active:
                raise serializers.ValidationError({'package_id': 'Selected package is inactive and cannot be booked.'})

        if departure_id is not None:
            try:
                departure = PackageDeparture.objects.get(id=departure_id)
            except PackageDeparture.DoesNotExist:
                raise serializers.ValidationError({'departure_id': 'Selected departure does not exist.'})

            if package_id is not None and departure.package_id != package_id:
                raise serializers.ValidationError({'departure_id': 'Selected departure does not belong to the selected package.'})

            if departure.status not in ['open', 'active']:
                raise serializers.ValidationError({'departure_id': 'Selected departure is not open for booking.'})

            travelers_count = attrs.get('travelers_count')
            if travelers_count is None and self.instance is not None:
                travelers_count = self.instance.travelers_count
            if travelers_count and departure.available_seats < travelers_count:
                raise serializers.ValidationError({'travelers_count': f'Only {departure.available_seats} seats are available for this departure.'})

        return attrs

    def get_payment(self, obj):
        if hasattr(obj, 'payment'):
            return PaymentSerializer(obj.payment).data
        return None


class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(write_only=True, required=False)
    booking_code_input = serializers.CharField(write_only=True, required=False)
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'booking_id', 'booking_code_input', 'booking_code', 'method', 'transaction_id', 'amount_npr',
            'status', 'paid_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'paid_at']

    def validate(self, attrs):
        booking_id = attrs.pop('booking_id', None)
        booking_code = attrs.pop('booking_code_input', None)

        if booking_id is None and booking_code is None and self.instance is None:
            raise serializers.ValidationError({'booking_id': 'booking_id or booking_code_input is required.'})

        if booking_id is not None:
            try:
                attrs['booking'] = Booking.objects.get(id=booking_id)
            except Booking.DoesNotExist:
                raise serializers.ValidationError({'booking_id': 'Booking not found.'})
        elif booking_code is not None:
            try:
                attrs['booking'] = Booking.objects.get(booking_code=booking_code)
            except Booking.DoesNotExist:
                raise serializers.ValidationError({'booking_code_input': 'Booking not found.'})

        return attrs
