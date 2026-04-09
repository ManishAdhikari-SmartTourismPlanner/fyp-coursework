import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

from tourism.models import Destination, Package
from decimal import Decimal

mardi = Destination.objects.get(name='Mardi Himal Trek')

packages_to_create = [
    {
        'title': 'Mardi Himal Trek - Normal Package',
        'slug': 'mardi-himal-trek-normal',
        'package_type': 'normal',
        'tour_type': 'trekking',
        'duration_days': 6,
        'max_group_size': 16,
        'price_npr': Decimal('35000'),
        'includes': 'Basic guide, permits (ACAP and TIMS), tea-house accommodation, breakfast and dinner, shared bus transport',
        'excludes': 'Porter, tips, insurance, lunch, personal expenses',
    },
    {
        'title': 'Mardi Himal Trek - Standard Package',
        'slug': 'mardi-himal-trek-standard',
        'package_type': 'standard',
        'tour_type': 'trekking',
        'duration_days': 6,
        'max_group_size': 12,
        'price_npr': Decimal('62000'),
        'includes': 'Licensed guide, permits, tea-house accommodation, all meals, private transport Pokhara round-trip, first-aid',
        'excludes': 'Porter, tips, insurance, lunch, personal expenses',
    },
    {
        'title': 'Mardi Himal Trek - Deluxe Package',
        'slug': 'mardi-himal-trek-deluxe',
        'package_type': 'deluxe',
        'tour_type': 'trekking',
        'duration_days': 6,
        'max_group_size': 8,
        'price_npr': Decimal('118000'),
        'includes': 'Senior guide, porter (1 per 2 trekkers), upgraded lodges, all meals, private transport, permits, emergency support',
        'excludes': 'Helicopter evacuation, tips, insurance, personal expenses',
    },
]

created = 0
for pkg_data in packages_to_create:
    pkg, created_flag = Package.objects.get_or_create(
        destination=mardi,
        slug=pkg_data['slug'],
        defaults={
            'title': pkg_data['title'],
            'package_type': pkg_data['package_type'],
            'tour_type': pkg_data['tour_type'],
            'duration_days': pkg_data['duration_days'],
            'max_group_size': pkg_data['max_group_size'],
            'price_npr': pkg_data['price_npr'],
            'includes': pkg_data['includes'],
            'excludes': pkg_data['excludes'],
            'is_active': True,
            'created_by_id': 1,  # First user (admin/agent)
        }
    )
    if created_flag:
        print(f"Created: {pkg.title}")
        created += 1
    else:
        print(f"Already exists: {pkg.title}")

print(f"\nTotal created: {created}")
print(f"Mardi Himal Trek now has {Package.objects.filter(destination=mardi, is_active=True).count()} packages")
