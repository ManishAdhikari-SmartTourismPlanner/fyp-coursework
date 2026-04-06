import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

from tourism.models import Destination, Package

print("Package count by destination:")
print("=" * 60)

destinations = Destination.objects.filter(is_active=True).order_by('name')
for dest in destinations:
    count = Package.objects.filter(destination=dest, is_active=True).count()
    packages = Package.objects.filter(destination=dest, is_active=True)
    pkg_types = [p.package_type for p in packages]
    print(f"{dest.name}: {count} packages - {pkg_types}")

print("=" * 60)
print(f"Total active packages: {Package.objects.filter(is_active=True).count()}")
print(f"Expected: {destinations.count()} destinations * 3 packages = {destinations.count() * 3}")
