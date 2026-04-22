from django.contrib import admin

from .models import AdminAuditLog, LoginOTPChallenge, PasswordResetOTPChallenge, RegistrationOTPChallenge, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ('id', 'user', 'role', 'created_at')
	search_fields = ('user__username', 'user__email', 'role')
	list_filter = ('role',)


@admin.register(LoginOTPChallenge)
class LoginOTPChallengeAdmin(admin.ModelAdmin):
	list_display = ('id', 'user', 'channel', 'attempts', 'is_used', 'expires_at', 'created_at')
	search_fields = ('user__username', 'user__email')
	list_filter = ('channel', 'is_used')
	readonly_fields = ('id', 'created_at')


@admin.register(RegistrationOTPChallenge)
class RegistrationOTPChallengeAdmin(admin.ModelAdmin):
	list_display = ('id', 'pending_username', 'pending_email', 'channel', 'attempts', 'is_used', 'expires_at', 'created_at')
	search_fields = ('pending_username', 'pending_email')
	list_filter = ('channel', 'is_used')
	readonly_fields = ('id', 'created_at')


@admin.register(PasswordResetOTPChallenge)
class PasswordResetOTPChallengeAdmin(admin.ModelAdmin):
	list_display = ('id', 'user', 'channel', 'attempts', 'is_used', 'expires_at', 'created_at')
	search_fields = ('user__username', 'user__email')
	list_filter = ('channel', 'is_used')
	readonly_fields = ('id', 'created_at')


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
	list_display = ('id', 'action', 'actor', 'target_type', 'target_id', 'created_at')
	search_fields = ('action', 'actor__username', 'target_type', 'target_id', 'target_display')
	list_filter = ('action', 'target_type', 'created_at')
	readonly_fields = ('created_at',)
