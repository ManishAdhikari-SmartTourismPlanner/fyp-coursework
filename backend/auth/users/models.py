from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
	ROLE_TOURIST = 'tourist'
	ROLE_AGENT = 'agent'
	ROLE_ADMIN = 'admin'

	ROLE_CHOICES = [
		(ROLE_TOURIST, 'Tourist'),
		(ROLE_AGENT, 'Agent'),
		(ROLE_ADMIN, 'Admin'),
	]

	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
	role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_TOURIST)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f'{self.user.username} ({self.role})'


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
	if created:
		UserProfile.objects.create(user=instance)
