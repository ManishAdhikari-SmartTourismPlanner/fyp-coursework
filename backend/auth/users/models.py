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


class RegistrationOTPChallenge(models.Model):
	CHANNEL_EMAIL = 'email'
	CHANNEL_CHOICES = [
		(CHANNEL_EMAIL, 'Email'),
	]

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	pending_username = models.CharField(max_length=150)
	pending_email = models.EmailField()
	pending_password_hash = models.CharField(max_length=255)
	code_hash = models.CharField(max_length=255)
	channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_EMAIL)
	attempts = models.PositiveSmallIntegerField(default=0)
	is_used = models.BooleanField(default=False)
	expires_at = models.DateTimeField()
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['pending_email', 'created_at']),
			models.Index(fields=['pending_username', 'created_at']),
			models.Index(fields=['expires_at', 'is_used']),
		]

	def is_expired(self):
		return timezone.now() >= self.expires_at


class PasswordResetOTPChallenge(models.Model):
	CHANNEL_EMAIL = 'email'
	CHANNEL_CHOICES = [
		(CHANNEL_EMAIL, 'Email'),
	]

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_challenges')
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


class AdminAuditLog(models.Model):
	action = models.CharField(max_length=80)
	actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='admin_audit_logs')
	target_type = models.CharField(max_length=40, blank=True)
	target_id = models.CharField(max_length=80, blank=True)
	target_display = models.CharField(max_length=255, blank=True)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['action', 'created_at']),
			models.Index(fields=['target_type', 'target_id']),
		]

	def __str__(self):
		return f'{self.action} by {self.actor_id or "system"}'


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
	if created:
		UserProfile.objects.create(user=instance)


@receiver(post_save, sender=UserProfile)
def ensure_default_packages_for_agents(sender, instance, created, update_fields=None, **kwargs):
	should_run = False
	if created:
		should_run = instance.role == UserProfile.ROLE_AGENT
	else:
		if update_fields is not None and 'role' in update_fields and instance.role == UserProfile.ROLE_AGENT:
			should_run = True

	if not should_run:
		return

	from users.default_packages import provision_default_packages_for_agent
	provision_default_packages_for_agent(instance.user)
