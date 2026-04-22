import ssl

from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend
from django.utils.functional import cached_property


class CertifiSMTPEmailBackend(SMTPEmailBackend):
	@cached_property
	def ssl_context(self):
		context = ssl._create_unverified_context()
		context.check_hostname = False
		context.verify_mode = ssl.CERT_NONE
		return context