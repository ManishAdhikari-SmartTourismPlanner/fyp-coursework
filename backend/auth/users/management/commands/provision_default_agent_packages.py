from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from users.default_packages import provision_default_packages_for_agent
from users.models import UserProfile


class Command(BaseCommand):
    help = 'Create default 21 packages (7 destinations x 3 types, excluding Mardi) for all agents.'

    def handle(self, *args, **options):
        agents = User.objects.filter(profile__role=UserProfile.ROLE_AGENT, is_active=True).order_by('id')

        if not agents.exists():
            self.stdout.write(self.style.WARNING('No active agents found. Nothing to provision.'))
            return

        total_created = 0
        total_skipped = 0
        total_departures_created = 0
        total_departures_skipped = 0
        for agent in agents:
            result = provision_default_packages_for_agent(agent)
            total_created += result['created_packages']
            total_skipped += result['skipped_packages']
            total_departures_created += result.get('created_departures', 0)
            total_departures_skipped += result.get('skipped_departures', 0)
            self.stdout.write(
                f"{agent.username}: created={result['created_packages']}, skipped={result['skipped_packages']}, "
                f"departures_created={result.get('created_departures', 0)}, departures_skipped={result.get('skipped_departures', 0)}, "
                f"destinations={result['selected_destinations']}, target={result['target_total']}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Total created packages={total_created}, total skipped existing={total_skipped}, "
                f"total created departures={total_departures_created}, total skipped departures={total_departures_skipped}."
            )
        )
