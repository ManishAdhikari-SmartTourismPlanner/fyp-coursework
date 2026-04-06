from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from tourism.models import Destination, Package, PackageDeparture
from datetime import datetime, timedelta


class Command(BaseCommand):
    help = 'Populate database with sample tourism data (20 destinations, multiple packages)'

    def handle(self, *args, **options):
        # Sample destinations data
        destinations_data = [
            # Existing 6 + 14 new = 20 total
            {
                "name": "Mount Everest Base Camp",
                "slug": "mount-everest-base-camp",
                "description": "Trek to the base camp of the world's highest mountain. Experience the majesty of Mount Everest from 5,364m. This challenging trek rewards you with unparalleled mountain views and the chance to acclimatize at Everest Base Camp.",
                "province": "Bagmati",
                "district": "Solukhumbu",
                "nearest_city": "Lukla",
                "altitude_m": 5364,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "hard",
                "suggested_duration_days": 14,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Annapurna Base Camp",
                "slug": "annapurna-base-camp",
                "description": "One of the most rewarding treks in the world. The Annapurna Circuit offers diverse landscapes from subtropical forests to alpine meadows. Visit Annapurna Base Camp at 4,130m surrounded by eight 8000m peaks.",
                "province": "Gandaki",
                "district": "Kaski",
                "nearest_city": "Pokhara",
                "altitude_m": 4130,
                "best_season": "autumn",
                "tour_type": "trekking",
                "difficulty": "moderate",
                "suggested_duration_days": 7,
                "image_url": "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=500"
            },
            {
                "name": "Kathmandu Valley",
                "slug": "kathmandu-valley",
                "description": "Explore the cultural heart of Nepal. Visit ancient temples, vibrant markets, and UNESCO World Heritage sites. Experience the rich history and traditions of Kathmandu with expert local guides.",
                "province": "Bagmati",
                "district": "Kathmandu",
                "nearest_city": "Kathmandu",
                "altitude_m": 1400,
                "best_season": "spring",
                "tour_type": "traveling",
                "difficulty": "easy",
                "suggested_duration_days": 3,
                "image_url": "https://images.unsplash.com/photo-1548013146-72479768bada?w=500"
            },
            {
                "name": "Pokhara & Phewa Lake",
                "slug": "pokhara-phewa-lake",
                "description": "Nepal's lakeside paradise. Enjoy serene Phewa Lake with stunning mountain backdrops, paragliding, boating, and water sports. Relax in this picturesque destination known for adventure and tranquility.",
                "province": "Gandaki",
                "district": "Kaski",
                "nearest_city": "Pokhara",
                "altitude_m": 884,
                "best_season": "autumn",
                "tour_type": "traveling",
                "difficulty": "easy",
                "suggested_duration_days": 3,
                "image_url": "https://images.unsplash.com/photo-1552546882-5fffe8c9ef14?w=500"
            },
            {
                "name": "Chitwan National Park",
                "slug": "chitwan-national-park",
                "description": "Wildlife adventure in Nepal's jungle. Encounter Bengal tigers, one-horned rhinos, and diverse bird species. Experience jungle safaris, elephant rides, and immersive nature experiences.",
                "province": "Bagmati",
                "district": "Chitwan",
                "nearest_city": "Bharatpur",
                "altitude_m": 100,
                "best_season": "winter",
                "tour_type": "traveling",
                "difficulty": "easy",
                "suggested_duration_days": 3,
                "image_url": "https://images.unsplash.com/photo-1608848461950-0fed8126665d?w=500"
            },
            {
                "name": "Langtang Valley Trek",
                "slug": "langtang-valley-trek",
                "description": "Trek through pristine alpine valleys and dense rhododendron forests. Langtang offers stunning views of Langtang Lirung and opportunities to meet Tamang communities.",
                "province": "Bagmati",
                "district": "Nuwakot",
                "nearest_city": "Syabrubesi",
                "altitude_m": 3500,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "moderate",
                "suggested_duration_days": 7,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            # New 14 destinations
            {
                "name": "Manakamana Temple & Cable Car",
                "slug": "manakamana-temple-cable-car",
                "description": "Experience the sky-high temple with a spectacular cable car ride offering panoramic views of the Himalayas and valleys below.",
                "province": "Gandaki",
                "district": "Gorkha",
                "nearest_city": "Chikasthan",
                "altitude_m": 1302,
                "best_season": "all",
                "tour_type": "traveling",
                "difficulty": "easy",
                "suggested_duration_days": 1,
                "image_url": "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=500"
            },
            {
                "name": "Muktinath Pilgrimage Trek",
                "slug": "muktinath-pilgrimage-trek",
                "description": "Sacred pilgrimage site for Hindus and Buddhists. Trek through beautiful Mustang valleys to reach this holy temple at 3,798m.",
                "province": "Gandaki",
                "district": "Mustang",
                "nearest_city": "Jomsom",
                "altitude_m": 3798,
                "best_season": "autumn",
                "tour_type": "trekking",
                "difficulty": "moderate",
                "suggested_duration_days": 8,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Dhaulagiri Base Camp",
                "slug": "dhaulagiri-base-camp",
                "description": "Trek to the base of the scenic Dhaulagiri mountain. Experience high altitude challenges and stunning panoramic views.",
                "province": "Gandaki",
                "district": "Baglung",
                "nearest_city": "Tatopani",
                "altitude_m": 4700,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "hard",
                "suggested_duration_days": 16,
                "image_url": "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=500"
            },
            {
                "name": "Ilam Tea Gardens",
                "slug": "ilam-tea-gardens",
                "description": "Visit Nepal's tea country with rolling green hills and tea plantations. Experience authentic village life and fresh tea.",
                "province": "Koshi",
                "district": "Ilam",
                "nearest_city": "Ilam",
                "altitude_m": 1580,
                "best_season": "autumn",
                "tour_type": "traveling",
                "difficulty": "easy",
                "suggested_duration_days": 4,
                "image_url": "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=500"
            },
            {
                "name": "Rara Lake Trek",
                "slug": "rara-lake-trek",
                "description": "Nepal's largest and deepest lake surrounded by virgin forests. Remote and pristine alpine lake experience in Mugu district.",
                "province": "Karnali",
                "district": "Mugu",
                "nearest_city": "Talcha",
                "altitude_m": 2990,
                "best_season": "summer",
                "tour_type": "trekking",
                "difficulty": "moderate",
                "suggested_duration_days": 10,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Kanyam Scenic Trek",
                "slug": "kanyam-scenic-trek",
                "description": "Scenic trek through diverse terrain with views of Kathmandu Valley and Himalayan peaks. Perfect for weekend trekking.",
                "province": "Bagmati",
                "district": "Kavre",
                "nearest_city": "Dhulikhel",
                "altitude_m": 2520,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "easy",
                "suggested_duration_days": 2,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Janakpur Religious Tour",
                "slug": "janakpur-religious-tour",
                "description": "Birthplace of Goddess Sita and significant religious site. Explore ancient temples, holy ponds, and cultural significance.",
                "province": "Maithili",
                "district": "Janakpur",
                "nearest_city": "Janakpur",
                "altitude_m": 52,
                "best_season": "winter",
                "tour_type": "traveling",
                "difficulty": "easy",
                "suggested_duration_days": 2,
                "image_url": "https://images.unsplash.com/photo-1543269865-cbdf26effbad?w=500"
            },
            {
                "name": "Narayan Garh & Paragliding",
                "slug": "narayan-garh-paragliding",
                "description": "Thrill activities with scenic mountain backdrop. Experience paragliding, trekking, and adventure sports.",
                "province": "Gandaki",
                "district": "Kaski",
                "nearest_city": "Pokhara",
                "altitude_m": 1500,
                "best_season": "autumn",
                "tour_type": "traveling",
                "difficulty": "moderate",
                "suggested_duration_days": 2,
                "image_url": "https://images.unsplash.com/photo-1540315217407-a13283e976f0?w=500"
            },
            {
                "name": "Trekking the Great Himalayan Trail",
                "slug": "great-himalayan-trail",
                "description": "Ultimate trek across Nepal's Himalayan range. Multi-week adventure for experienced trekkers.",
                "province": "Bagmati",
                "district": "Solukhumbu",
                "nearest_city": "Lukla",
                "altitude_m": 5500,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "hard",
                "suggested_duration_days": 25,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Gajuri Pass Trek",
                "slug": "gajuri-pass-trek",
                "description": "Off-beaten path trek with pristine forests and scenic mountain passes. Less crowded than main routes.",
                "province": "Gandaki",
                "district": "Lamjung",
                "nearest_city": "Besisahar",
                "altitude_m": 2350,
                "best_season": "autumn",
                "tour_type": "trekking",
                "difficulty": "moderate",
                "suggested_duration_days": 6,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Everest View Trek",
                "slug": "everest-view-trek",
                "description": "Shorter alternative to EBC, featuring stunning Everest views without extreme altitudes. Perfect for acclimatization.",
                "province": "Bagmati",
                "district": "Solukhumbu",
                "nearest_city": "Namche",
                "altitude_m": 3880,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "moderate",
                "suggested_duration_days": 5,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
            {
                "name": "Makalu Base Camp Trek",
                "slug": "makalu-base-camp",
                "description": "Remote trek to Makalu, Nepal's 5th highest peak. Pristine wilderness and few tourists.",
                "province": "Koshi",
                "district": "Sankhu",
                "nearest_city": "Tumlingtar",
                "altitude_m": 4800,
                "best_season": "spring",
                "tour_type": "trekking",
                "difficulty": "hard",
                "suggested_duration_days": 18,
                "image_url": "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=500"
            },
            {
                "name": "Kailash Mansarovar Pilgrimage",
                "slug": "kailash-mansarovar",
                "description": "Sacred pilgrimage to Mount Kailash and Lake Mansarovar. Spiritual journey combining trekking and spirituality.",
                "province": "Sudurpaschim",
                "district": "Humla",
                "nearest_city": "Simikot",
                "altitude_m": 4590,
                "best_season": "summer",
                "tour_type": "trekking",
                "difficulty": "hard",
                "suggested_duration_days": 20,
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500"
            },
        ]

        # Get or create admin user
        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={'is_staff': True, 'is_superuser': True}
        )

        self.stdout.write("Starting data population...")

        # Create destinations
        created_count = 0
        for dest_data in destinations_data:
            dest, created = Destination.objects.get_or_create(
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
                    'created_by': admin_user,
                }
            )
            if created:
                created_count += 1
                self.stdout.write("[+] Created: {}".format(dest.name))

        self.stdout.write(self.style.SUCCESS("\n[OK] {} destinations created successfully!".format(created_count)))

        # Create packages for each destination
        pkg_count = 0
        for dest in Destination.objects.all():
            # Standard package
            standard, created = Package.objects.get_or_create(
                title="{} - Standard Package".format(dest.name),
                destination=dest,
                package_type='standard',
                defaults={
                    'slug': "{}-standard".format(dest.slug),
                    'description': "Experience {} with comfortable accommodation and reliable service. Perfect for budget-conscious travelers.".format(dest.name),
                    'tour_type': dest.tour_type,
                    'duration_days': dest.suggested_duration_days,
                    'max_group_size': 15,
                    'price_npr': 45000 + (dest.altitude_m // 100) * 100,
                    'includes': " Professional guide  All meals  Basic accommodation  Park fees  Transport  Trip insurance",
                    'excludes': " International flights  Visa fees  Personal expenses  Tips  Optional activities",
                    'itinerary_overview': "Explore {} with guides, meals, and accommodation daily.".format(dest.name),
                    'created_by': admin_user,
                }
            )
            if created:
                pkg_count += 1
                self.stdout.write("[+] Created: {}".format(standard.title))

            # Deluxe package
            deluxe, created = Package.objects.get_or_create(
                title="{} - Deluxe Package".format(dest.name),
                destination=dest,
                package_type='deluxe',
                defaults={
                    'slug': "{}-deluxe".format(dest.slug),
                    'description': "Premium {} experience with luxury accommodation and personalized service.".format(dest.name),
                    'tour_type': dest.tour_type,
                    'duration_days': dest.suggested_duration_days,
                    'max_group_size': 8,
                    'price_npr': 120000 + (dest.altitude_m // 50) * 300,
                    'includes': " Expert guides  4-star resorts  Gourmet meals  Park entry  Private transport  Helicopter insurance  Spa  Cultural programs  Premium beverages",
                    'excludes': " International flights  Visa fees  Personal shopping  Travel insurance",
                    'itinerary_overview': "Luxury journey through {} with premium comfort and expert guides.".format(dest.name),
                    'created_by': admin_user,
                }
            )
            if created:
                pkg_count += 1
                self.stdout.write("[+] Created: {}".format(deluxe.title))

        self.stdout.write(self.style.SUCCESS("\n[OK] {} packages created successfully!".format(pkg_count)))

        # Create departures for each package
        dep_count = 0
        today = datetime.now().date()
        for pkg in Package.objects.all():
            for i in range(9):  # 9 departures per package
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

        self.stdout.write(self.style.SUCCESS("[OK] {} package departures created successfully!".format(dep_count)))
        self.stdout.write(self.style.SUCCESS("\n[DONE] Database population complete!"))
        self.stdout.write("   Destinations: {}".format(Destination.objects.count()))
        self.stdout.write("   Packages: {}".format(Package.objects.count()))
        self.stdout.write("   Departures: {}".format(PackageDeparture.objects.count()))

