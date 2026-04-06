import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

from tourism.models import Package

# Activate all inactive packages
inactive_count = Package.objects.filter(is_active=False).count()
Package.objects.filter(is_active=False).update(is_active=True)
active_count = Package.objects.filter(is_active=True).count()

print(f"Activated {inactive_count} packages")
print(f"Total active packages now: {active_count}")
print(f"Total packages in database: {Package.objects.count()}")

# List all packages by destination
from tourism.models import Destination
for dest in Destination.objects.filter(is_active=True):
    count = dest.packages.filter(is_active=True).count()
    print(f"  {dest.name}: {count} active packages")
