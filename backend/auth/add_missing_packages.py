#!/usr/bin/env python
import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

from tourism.models import Destination, Package

# The 7 original destinations
destinations = [
    'Annapurna Base Camp',
    'Chitwan National Park',
    'Kathmandu Valley',
    'Lumbini Heritage Tour',
    'Mount Everest Base Camp',
    'Pokhara & Phewa Lake',
    'Rara Lake Trek',
]

package_templates = {
    'normal': {
        'package_type': 'normal',
        'price_multiplier': 0.6,  # 60% of standard
        'description_suffix': '- Normal Package',
        'includes': 'Basic accommodations, guide service, permits, shared meals',
        'excludes': 'International flight, travel insurance, personal expenses, tips'
    },
    'standard': {
        'package_type': 'standard',
        'price_multiplier': 1.0,  # Base price
        'description_suffix': '- Standard Package',
        'includes': 'Comfortable accommodations, licensed guide, permits, breakfast and dinner, shared transport',
        'excludes': 'International flight, lunch, personal snacks, tips'
    },
    'deluxe': {
        'package_type': 'deluxe',
        'price_multiplier': 1.8,  # 180% of standard
        'description_suffix': '- Deluxe Package',
        'includes': 'Premium accommodations, experienced guide, porter service, all meals, private transport, permits',
        'excludes': 'International flight, personal expenses, helicopter evacuation'
    }
}

added_count = 0

for dest_name in destinations:
    try:
        dest = Destination.objects.get(name=dest_name, is_active=True)
        existing_packages = Package.objects.filter(destination=dest, is_active=True).count()
        
        print(f"\n{dest_name}: {existing_packages} packages currently")
        
        # Base price for the destination
        base_price = Decimal('50000')
        
        for pkg_type, config in package_templates.items():
            # Check if package already exists
            exists = Package.objects.filter(
                destination=dest,
                package_type=pkg_type,
                is_active=True
            ).exists()
            
            if exists:
                print(f"  - {pkg_type.title()} package already exists")
            else:
                # Create the package
                price = base_price * Decimal(str(config['price_multiplier']))
                
                pkg = Package.objects.create(
                    destination=dest,
                    title=f"{dest_name} {config['description_suffix']}",
                    slug=f"{dest.slug}-{pkg_type}",
                    package_type=pkg_type,
                    tour_type=dest.tour_type,
                    duration_days=dest.suggested_duration_days,
                    max_group_size=12 if pkg_type == 'normal' else (8 if pkg_type == 'deluxe' else 10),
                    price_npr=price,
                    description=f"{dest.description} - {config['description_suffix']}",
                    includes=config['includes'],
                    excludes=config['excludes'],
                    is_active=True
                )
                print(f"  + Created {pkg_type.title()} package (NPR {price})")
                added_count += 1
        
        final_count = Package.objects.filter(destination=dest, is_active=True).count()
        print(f"  Final count: {final_count} packages")
        
    except Destination.DoesNotExist:
        print(f"Destination not found: {dest_name}")

print(f"\n\nTotal packages added: {added_count}")
print(f"Total active packages in database: {Package.objects.filter(is_active=True).count()}")
