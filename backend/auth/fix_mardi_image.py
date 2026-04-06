import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

from tourism.models import Destination

# Find Mardi Himal Trek
mardi = Destination.objects.filter(name='Mardi Himal Trek').first()

if mardi:
    print(f"Found: {mardi.name}")
    print(f"Current image URL: {mardi.image_url}")
    
    # Update with a working image URL
    new_url = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=80"
    mardi.image_url = new_url
    mardi.save()
    print(f"Updated to: {mardi.image_url}")
else:
    print("Mardi Himal Trek not found in database")
