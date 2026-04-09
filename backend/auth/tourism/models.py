from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		abstract = True


class Destination(TimeStampedModel):
	SEASON_SPRING = 'spring'
	SEASON_SUMMER = 'summer'
	SEASON_AUTUMN = 'autumn'
	SEASON_WINTER = 'winter'
	SEASON_ALL = 'all'

	TOUR_TREKKING = 'trekking'
	TOUR_TRAVELING = 'traveling'
	TOUR_BOTH = 'both'

	DIFFICULTY_EASY = 'easy'
	DIFFICULTY_MODERATE = 'moderate'
	DIFFICULTY_HARD = 'hard'

	BEST_SEASON_CHOICES = [
		(SEASON_SPRING, 'Spring'),
		(SEASON_SUMMER, 'Summer'),
		(SEASON_AUTUMN, 'Autumn'),
		(SEASON_WINTER, 'Winter'),
		(SEASON_ALL, 'All Season'),
	]

	TOUR_TYPE_CHOICES = [
		(TOUR_TREKKING, 'Trekking'),
		(TOUR_TRAVELING, 'Traveling'),
		(TOUR_BOTH, 'Both'),
	]

	DIFFICULTY_CHOICES = [
		(DIFFICULTY_EASY, 'Easy'),
		(DIFFICULTY_MODERATE, 'Moderate'),
		(DIFFICULTY_HARD, 'Hard'),
	]

	name = models.CharField(max_length=160, unique=True)
	slug = models.SlugField(max_length=180, unique=True)
	description = models.TextField()
	province = models.CharField(max_length=80)
	district = models.CharField(max_length=80)
	nearest_city = models.CharField(max_length=120, blank=True)
	altitude_m = models.PositiveIntegerField(default=0)
	best_season = models.CharField(max_length=20, choices=BEST_SEASON_CHOICES, default=SEASON_ALL)
	tour_type = models.CharField(max_length=20, choices=TOUR_TYPE_CHOICES, default=TOUR_TRAVELING)
	difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default=DIFFICULTY_EASY)
	suggested_duration_days = models.PositiveIntegerField(default=1)
	image_url = models.URLField(blank=True)
	is_active = models.BooleanField(default=True)
	created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='created_destinations')

	class Meta:
		ordering = ['name']
		indexes = [
			models.Index(fields=['name']),
			models.Index(fields=['province', 'district']),
			models.Index(fields=['best_season', 'tour_type']),
		]

	def __str__(self):
		return self.name


class OfflineMap(TimeStampedModel):
	destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name='offline_maps')
	title = models.CharField(max_length=120)
	file_url = models.URLField()
	version = models.CharField(max_length=20, default='v1')
	file_size_mb = models.DecimalField(max_digits=8, decimal_places=2, default=0)
	is_active = models.BooleanField(default=True)

	class Meta:
		ordering = ['destination__name', 'title']
		unique_together = [('destination', 'title', 'version')]

	def __str__(self):
		return f'{self.destination.name} - {self.title}'


class Package(TimeStampedModel):
	PACKAGE_NORMAL = 'normal'
	PACKAGE_STANDARD = 'standard'
	PACKAGE_DELUXE = 'deluxe'

	TOUR_TREKKING = 'trekking'
	TOUR_TRAVELING = 'traveling'

	PACKAGE_TYPE_CHOICES = [
		(PACKAGE_NORMAL, 'Normal'),
		(PACKAGE_STANDARD, 'Standard'),
		(PACKAGE_DELUXE, 'Deluxe'),
	]

	TOUR_TYPE_CHOICES = [
		(TOUR_TREKKING, 'Trekking'),
		(TOUR_TRAVELING, 'Traveling'),
	]

	destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name='packages')
	title = models.CharField(max_length=180)
	slug = models.SlugField(max_length=200, unique=True)
	description = models.TextField()
	package_type = models.CharField(max_length=20, choices=PACKAGE_TYPE_CHOICES, default=PACKAGE_STANDARD)
	tour_type = models.CharField(max_length=20, choices=TOUR_TYPE_CHOICES, default=TOUR_TRAVELING)
	duration_days = models.PositiveIntegerField(default=1)
	max_group_size = models.PositiveIntegerField(default=1)
	price_npr = models.DecimalField(max_digits=12, decimal_places=2)
	includes = models.TextField(blank=True)
	excludes = models.TextField(blank=True)
	itinerary_overview = models.TextField(blank=True)
	is_active = models.BooleanField(default=True)
	created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='created_packages')

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['package_type', 'tour_type']),
			models.Index(fields=['price_npr']),
			models.Index(fields=['is_active']),
		]

	def __str__(self):
		return self.title


class PackageDeparture(TimeStampedModel):
	STATUS_OPEN = 'open'
	STATUS_CLOSED = 'closed'
	STATUS_CANCELLED = 'cancelled'

	STATUS_CHOICES = [
		(STATUS_OPEN, 'Open'),
		(STATUS_CLOSED, 'Closed'),
		(STATUS_CANCELLED, 'Cancelled'),
	]

	package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name='departures')
	departure_date = models.DateField()
	total_seats = models.PositiveIntegerField(default=1)
	available_seats = models.PositiveIntegerField(default=1)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)

	class Meta:
		ordering = ['departure_date']
		unique_together = [('package', 'departure_date')]
		indexes = [models.Index(fields=['departure_date', 'status'])]

	def __str__(self):
		return f'{self.package.title} - {self.departure_date}'


class Booking(TimeStampedModel):
	STATUS_PENDING = 'pending'
	STATUS_CONFIRMED = 'confirmed'
	STATUS_CANCELLED = 'cancelled'
	STATUS_COMPLETED = 'completed'
	STATUS_RESCHEDULED = 'rescheduled'

	STATUS_CHOICES = [
		(STATUS_PENDING, 'Pending'),
		(STATUS_CONFIRMED, 'Confirmed'),
		(STATUS_CANCELLED, 'Cancelled'),
		(STATUS_COMPLETED, 'Completed'),
		(STATUS_RESCHEDULED, 'Rescheduled'),
	]

	booking_code = models.CharField(max_length=20, unique=True, blank=True)
	tourist = models.ForeignKey(User, on_delete=models.PROTECT, related_name='bookings')
	package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name='bookings')
	departure = models.ForeignKey(
		PackageDeparture,
		on_delete=models.SET_NULL,
		related_name='bookings',
		null=True,
		blank=True,
	)
	travelers_count = models.PositiveIntegerField(default=1)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
	special_request = models.TextField(blank=True)
	total_amount_npr = models.DecimalField(max_digits=12, decimal_places=2)
	booking_date = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ['-booking_date']
		indexes = [
			models.Index(fields=['status']),
			models.Index(fields=['booking_date']),
		]

	def save(self, *args, **kwargs):
		if not self.booking_code:
			timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
			self.booking_code = f'BK{timestamp}'
		super().save(*args, **kwargs)

	def __str__(self):
		return f'{self.booking_code} - {self.tourist.username}'


class Payment(TimeStampedModel):
	METHOD_KHALTI = 'khalti'
	METHOD_ESEWA = 'esewa'
	METHOD_CASH = 'cash'

	STATUS_PENDING = 'pending'
	STATUS_SUCCESS = 'success'
	STATUS_FAILED = 'failed'
	STATUS_REFUNDED = 'refunded'

	METHOD_CHOICES = [
		(METHOD_KHALTI, 'Khalti'),
		(METHOD_ESEWA, 'eSewa'),
		(METHOD_CASH, 'Cash'),
	]

	STATUS_CHOICES = [
		(STATUS_PENDING, 'Pending'),
		(STATUS_SUCCESS, 'Success'),
		(STATUS_FAILED, 'Failed'),
		(STATUS_REFUNDED, 'Refunded'),
	]

	booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='payment')
	method = models.CharField(max_length=20, choices=METHOD_CHOICES)
	transaction_id = models.CharField(max_length=120, unique=True, blank=True, null=True)
	amount_npr = models.DecimalField(max_digits=12, decimal_places=2)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
	paid_at = models.DateTimeField(blank=True, null=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['method', 'status']),
			models.Index(fields=['transaction_id']),
		]

	def __str__(self):
		return f'{self.booking.booking_code} - {self.status}'


class Review(TimeStampedModel):
	booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')
	destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name='reviews')
	tourist = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
	rating = models.PositiveSmallIntegerField()
	comment = models.TextField(blank=True)

	class Meta:
		ordering = ['-created_at']
		constraints = [
			models.CheckConstraint(condition=models.Q(rating__gte=1) & models.Q(rating__lte=5), name='review_rating_1_to_5')
		]

	def __str__(self):
		return f'{self.destination.name} - {self.rating}/5'
