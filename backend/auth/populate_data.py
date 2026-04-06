#!/usr/bin/env python
"""
Sample Data Generator for Smart Tourism Planner
Run this in Django shell: python manage.py shell < populate_data.py
"""

from django.contrib.auth.models import User
from tourism.models import Destination, Package, PackageDeparture
from datetime import datetime, timedelta

# Sample destinations data (curated top 7)
destinations_data = [
    {
        "name": "Mount Everest Base Camp",
        "slug": "mount-everest-base-camp",
        "description": "Classic high-altitude Himalayan trek to Everest Base Camp at 5,364m. The route passes Sherpa villages, suspension bridges, and glacial valleys with unmatched views of Everest, Lhotse, and Nuptse. Best for fit trekkers seeking a bucket-list adventure.",
        "province": "Bagmati",
        "district": "Solukhumbu",
        "nearest_city": "Lukla",
        "altitude_m": 5364,
        "best_season": "autumn",
        "tour_type": "trekking",
        "difficulty": "hard",
        "suggested_duration_days": 15,
        "image_url": "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=1400&q=80"
    },
    {
        "name": "Annapurna Base Camp",
        "slug": "annapurna-base-camp",
        "description": "Scenic trek to Annapurna Base Camp at 4,130m through terraced fields, rhododendron forests, and mountain lodges. Ideal for travelers who want dramatic Himalayan scenery with rich local Gurung culture.",
        "province": "Gandaki",
        "district": "Kaski",
        "nearest_city": "Pokhara",
        "altitude_m": 4130,
        "best_season": "autumn",
        "tour_type": "trekking",
        "difficulty": "moderate",
        "suggested_duration_days": 10,
        "image_url": "https://images.unsplash.com/photo-1518002054494-3a6f94352e9d?auto=format&fit=crop&w=1400&q=80"
    },
    {
        "name": "Kathmandu Valley",
        "slug": "kathmandu-valley",
        "description": "Culture-rich city experience covering Kathmandu, Patan, and Bhaktapur. Explore UNESCO heritage squares, temples, traditional courtyards, and local cuisine. Perfect for history, architecture, and short city breaks.",
        "province": "Bagmati",
        "district": "Kathmandu",
        "nearest_city": "Kathmandu",
        "altitude_m": 1400,
        "best_season": "all",
        "tour_type": "traveling",
        "difficulty": "easy",
        "suggested_duration_days": 4,
        "image_url": "https://images.unsplash.com/photo-1585938389612-a552a28d6914?auto=format&fit=crop&w=1400&q=80"
    },
    {
        "name": "Pokhara & Phewa Lake",
        "slug": "pokhara-phewa-lake",
        "description": "Relaxed lakeside destination with mountain views, sunrise at Sarangkot, boating on Phewa Lake, cave visits, and optional adventure sports like paragliding. Great for family trips and leisure travel.",
        "province": "Gandaki",
        "district": "Kaski",
        "nearest_city": "Pokhara",
        "altitude_m": 884,
        "best_season": "all",
        "tour_type": "traveling",
        "difficulty": "easy",
        "suggested_duration_days": 4,
        "image_url": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1400&q=80"
    },
    {
        "name": "Chitwan National Park",
        "slug": "chitwan-national-park",
        "description": "Lowland jungle safari experience with jeep safaris, canoe rides, birdwatching, and Tharu cultural programs. Known for one-horned rhinoceros sightings and diverse wildlife in Nepal's first national park.",
        "province": "Bagmati",
        "district": "Chitwan",
        "nearest_city": "Bharatpur",
        "altitude_m": 100,
        "best_season": "winter",
        "tour_type": "traveling",
        "difficulty": "easy",
        "suggested_duration_days": 3,
        "image_url": "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1400&q=80"
    },
    {
        "name": "Lumbini Heritage Tour",
        "slug": "lumbini-heritage-tour",
        "description": "Spiritual and heritage destination, recognized as the birthplace of Buddha. Visit Maya Devi Temple, sacred gardens, monasteries from different countries, and archaeological sites in a peaceful setting.",
        "province": "Lumbini",
        "district": "Rupandehi",
        "nearest_city": "Bhairahawa",
        "altitude_m": 150,
        "best_season": "winter",
        "tour_type": "traveling",
        "difficulty": "easy",
        "suggested_duration_days": 2,
        "image_url": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1400&q=80"
    },
    {
        "name": "Rara Lake Trek",
        "slug": "rara-lake-trek",
        "description": "Remote alpine journey to Nepal's largest lake, surrounded by pine forests and clear blue water. Best for travelers seeking offbeat nature, peaceful trails, and pristine mountain landscapes.",
        "province": "Karnali",
        "district": "Mugu",
        "nearest_city": "Talcha",
        "altitude_m": 2990,
        "best_season": "summer",
        "tour_type": "trekking",
        "difficulty": "moderate",
        "suggested_duration_days": 9,
        "image_url": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80"
    }
]

"""
When RESET_DATA is True, the script removes previously seeded tourism records
and creates a clean dataset with exactly 7 destinations.
"""
RESET_DATA = True

# Sample packages data (multiple per destination)
packages_templates = [
    # Standard & Deluxe for each destination
]

# Get or create admin user
admin_user, _ = User.objects.get_or_create(username='admin', defaults={'is_staff': True, 'is_superuser': True})

print("Starting data population...")

if RESET_DATA:
    # Keep historical booking/payment integrity and hide old records instead of hard-deleting protected rows.
    PackageDeparture.objects.all().delete()
    Package.objects.update(is_active=False)
    Destination.objects.update(is_active=False)
    print(" Existing records archived (inactive), departures reset.")

# Create destinations
created_count = 0
seeded_destinations = []
for dest_data in destinations_data:
    dest, created = Destination.objects.update_or_create(
        name=dest_data['name'],
        defaults={
            'slug': dest_data['slug'],
            'description': dest_data['description'],
            'province': dest_data['province'],
            'district': dest_data['district'],
            'nearest_city': dest_data['nearest_city'],
            'altitude_m': dest_data['altitude_m'],
            'best_season': dest_data['best_season'],
            'tour_type': dest_data['tour_type'],
            'difficulty': dest_data['difficulty'],
            'suggested_duration_days': dest_data['suggested_duration_days'],
            'image_url': dest_data['image_url'],
            'is_active': True,
            'created_by': admin_user,
        }
    )
    seeded_destinations.append(dest)
    if created:
        created_count += 1
        print(f" Created: {dest.name}")

print(f"\n Seeded {len(seeded_destinations)} destinations successfully ({created_count} newly created).")

# Create packages for seeded destinations only
pkg_count = 0
for dest in seeded_destinations:
    # Base price calculation
    base_price = 45000 + (dest.altitude_m // 100) * 100
    
    # Budget package - 60% of standard
    budget, created = Package.objects.get_or_create(
        title=f"{dest.name} - Budget Package",
        destination=dest,
        package_type='budget',
        defaults={
            'slug': f"{dest.slug}-budget",
            'description': f"Economical {dest.name} experience for budget-conscious travelers. Basic comfort with essential services and experienced guides.",
            'tour_type': dest.tour_type,
            'duration_days': dest.suggested_duration_days,
            'max_group_size': 20,
            'price_npr': int(base_price * 0.6),
            'includes': " Local English-speaking guide  Basic meals (breakfast & dinner)  Budget lodges & guesthouses  Park entry fees  Shared transport  Basic first-aid",
            'excludes': " International flights  Visa fees  Lunch  Alcohol & premium drinks  Tips  Personal equipment  Travel insurance  Optional activities",
            'itinerary_overview': f"Budget-friendly journey through {dest.name}. Experience the destination authentically with basic but reliable facilities and local guides.",
            'is_active': True,
            'created_by': admin_user,
        }
    )
    if not budget.is_active:
        budget.is_active = True
        budget.save(update_fields=['is_active'])
    if created:
        pkg_count += 1
        print(f" Created: {budget.title}")

    # Standard package
    standard, created = Package.objects.get_or_create(
        title=f"{dest.name} - Standard Package",
        destination=dest,
        package_type='standard',
        defaults={
            'slug': f"{dest.slug}-standard",
            'description': f"Experience {dest.name} with comfortable accommodation and reliable service. Perfect for travelers seeking value and quality balance.",
            'tour_type': dest.tour_type,
            'duration_days': dest.suggested_duration_days,
            'max_group_size': 15,
            'price_npr': base_price,
            'includes': " Professional English-speaking guide  All meals during journey (breakfast, lunch, dinner)  Good 2-3 star accommodation  Park entry fees  Local transport  Trip insurance  Hot water & basic toiletries  Evening orientation briefing",
            'excludes': " International flights  Visa fees  Personal expenses  Tips  Premium amenities  Helicopter services  Special dietary requests",
            'itinerary_overview': f"Well-balanced exploration of {dest.name}. Quality guides, comfortable lodging, all meals, and good transport. Ideal for most travelers.",
            'is_active': True,
            'created_by': admin_user,
        }
    )
    if not standard.is_active:
        standard.is_active = True
        standard.save(update_fields=['is_active'])
    if created:
        pkg_count += 1
        print(f" Created: {standard.title}")

    # Deluxe package - 1.8x of standard
    deluxe, created = Package.objects.get_or_create(
        title=f"{dest.name} - Deluxe Package",
        destination=dest,
        package_type='deluxe',
        defaults={
            'slug': f"{dest.slug}-deluxe",
            'description': f"Premium {dest.name} experience with luxury accommodation and personalized service. Includes exclusive activities and gourmet meals.",
            'tour_type': dest.tour_type,
            'duration_days': dest.suggested_duration_days,
            'max_group_size': 8,
            'price_npr': int(base_price * 1.8),
            'includes': " Expert professional guides with extensive local knowledge  4-5 star luxury lodges & resorts  Gourmet meals (all meals + snacks)  All park entry & special permits  Private vehicle transport  Helicopter rescue insurance  Spa & massage services  Evening cultural programs  Premium local & international drinks  Flight upgrades (coach to business)  Personal porter service",
            'excludes': " International flights (economy)  Visa fees  Personal shopping  Activity upgrades  Alcohol above premium tier  Travel insurance premium  Extreme adventure activities",
            'itinerary_overview': f"Luxury journey through {dest.name}. Experience premium comfort, expert guides, exclusive cultural activities, and world-class hospitality at every step.",
            'is_active': True,
            'created_by': admin_user,
        }
    )
    if not deluxe.is_active:
        deluxe.is_active = True
        deluxe.save(update_fields=['is_active'])
    if created:
        pkg_count += 1
        print(f" Created: {deluxe.title}")

print(f"\n {pkg_count} packages created successfully!")

# Create departures for each package
dep_count = 0
today = datetime.now().date()
for pkg in Package.objects.filter(destination__in=seeded_destinations):
    for i in range(9):
        departure_date = today + timedelta(days=15 + (i * 10))
        dep, created = PackageDeparture.objects.get_or_create(
            package=pkg,
            departure_date=departure_date,
            defaults={
                'total_seats': pkg.max_group_size,
                'available_seats': pkg.max_group_size,
                'status': 'open',
            }
        )
        if created:
            dep_count += 1

print(f" {dep_count} package departures created successfully!")
print("\n Database population complete!")
print(f"   Destinations: {Destination.objects.count()}")
print(f"   Packages: {Package.objects.count()}")
print(f"   Departures: {PackageDeparture.objects.count()}")

