from django.contrib import admin

from .models import LoginOTPChallenge, UserProfile


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
