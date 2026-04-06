import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
django.setup()

with open('populate_data.py', 'r', encoding='utf-8-sig') as f:
    exec(f.read())
