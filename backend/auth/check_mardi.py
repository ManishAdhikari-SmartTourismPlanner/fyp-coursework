import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

from tourism.models import Destination

mardi = Destination.objects.filter(name__icontains='Mardi').first()

if mardi:
    print(f"Found: {mardi.name}")
    print(f"Active: {mardi.is_active}")
    print(f"ID: {mardi.id}")
    print(f"Will show in agent list: {mardi.is_active}")
    if not mardi.is_active:
        print("\nActivating destination...")
        mardi.is_active = True
        mardi.save()
        print("Done! Mardi Himal Trek is now active.")
else:
    print("Mardi Himal Trek not found in database")
