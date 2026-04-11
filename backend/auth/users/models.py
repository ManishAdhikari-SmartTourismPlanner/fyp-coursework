import uuid

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


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


class LoginOTPChallenge(models.Model):
	CHANNEL_EMAIL = 'email'
	CHANNEL_CHOICES = [
		(CHANNEL_EMAIL, 'Email'),
	]

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_challenges')
	code_hash = models.CharField(max_length=255)
	channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_EMAIL)
	attempts = models.PositiveSmallIntegerField(default=0)
	is_used = models.BooleanField(default=False)
	expires_at = models.DateTimeField()
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['user', 'created_at']),
			models.Index(fields=['expires_at', 'is_used']),
		]

	def is_expired(self):
		return timezone.now() >= self.expires_at


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
	if created:
		UserProfile.objects.create(user=instance)
