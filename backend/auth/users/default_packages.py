from decimal import Decimal
from datetime import timedelta

from django.utils import timezone
from django.utils.text import slugify

from tourism.models import Destination, Package, PackageDeparture

DEFAULT_DESTINATIONS_LIMIT = 7
DEFAULT_PACKAGE_TYPES = [
    {
        'package_type': Package.PACKAGE_NORMAL,
        'label': 'Normal',
        'duration_days': 3,
        'max_group_size': 12,
        'price_multiplier': Decimal('1.00'),
    },
    {
        'package_type': Package.PACKAGE_STANDARD,
        'label': 'Standard',
        'duration_days': 4,
        'max_group_size': 10,
        'price_multiplier': Decimal('1.35'),
    },
    {
        'package_type': Package.PACKAGE_DELUXE,
        'label': 'Deluxe',
        'duration_days': 5,
        'max_group_size': 8,
        'price_multiplier': Decimal('1.80'),
    },
]

DEFAULT_DEPARTURE_OFFSETS_DAYS = [14, 45, 75]


def _base_price_for_destination(index):
    # Keeps a deterministic spread while staying simple for defaults.
    return Decimal('10000') + (Decimal(index) * Decimal('1500'))


def _tour_type_for_destination(destination):
    if destination.tour_type in [Package.TOUR_TREKKING, Package.TOUR_TRAVELING]:
        return destination.tour_type
    return Package.TOUR_TRAVELING


def _build_unique_slug(destination, package_type, user):
    slug = slugify(f"{destination.slug}-{package_type}-{user.username}-{user.id}")
    return slug[:200]


def provision_default_packages_for_agent(user):
    selected_destinations = list(
        Destination.objects.filter(is_active=True)
        .exclude(name__icontains='mardi')
        .order_by('name')[:DEFAULT_DESTINATIONS_LIMIT]
    )

    created = 0
    skipped = 0

    for index, destination in enumerate(selected_destinations, start=1):
        base_price = _base_price_for_destination(index)
        tour_type = _tour_type_for_destination(destination)

        for template in DEFAULT_PACKAGE_TYPES:
            exists = Package.objects.filter(
                created_by=user,
                destination=destination,
                package_type=template['package_type'],
            ).exists()
            if exists:
                skipped += 1
                continue

            price_npr = (base_price * template['price_multiplier']).quantize(Decimal('1.00'))

            Package.objects.create(
                destination=destination,
                title=f"{destination.name} {template['label']} Package",
                slug=_build_unique_slug(destination, template['package_type'], user),
                description=(
                    f"Default {template['label'].lower()} package for {destination.name}. "
                    "Includes guided planning and local support."
                ),
                package_type=template['package_type'],
                tour_type=tour_type,
                duration_days=template['duration_days'],
                max_group_size=template['max_group_size'],
                price_npr=price_npr,
                includes='Accommodation\nTransport\nLocal guide',
                excludes='Personal expenses\nTravel insurance',
                itinerary_overview='Day-wise plan is available upon booking.',
                is_active=True,
                created_by=user,
            )
            created += 1

    created_departures = 0
    skipped_departures = 0

    agent_packages = Package.objects.filter(created_by=user, destination__in=selected_destinations)
    for package in agent_packages:
        for offset_days in DEFAULT_DEPARTURE_OFFSETS_DAYS:
            departure_date = timezone.now().date() + timedelta(days=offset_days)
            exists = PackageDeparture.objects.filter(package=package, departure_date=departure_date).exists()
            if exists:
                skipped_departures += 1
                continue

            PackageDeparture.objects.create(
                package=package,
                departure_date=departure_date,
                total_seats=20,
                available_seats=20,
                status=PackageDeparture.STATUS_OPEN,
            )
            created_departures += 1

    return {
        'selected_destinations': len(selected_destinations),
        'created_packages': created,
        'skipped_packages': skipped,
        'created_departures': created_departures,
        'skipped_departures': skipped_departures,
        'target_total': len(selected_destinations) * len(DEFAULT_PACKAGE_TYPES),
    }
