#!/usr/bin/env python
"""
Django management command to set password - place in:
backend/apps/accounts/management/commands/set_user_password.py
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from apps.accounts.models import User

class Command(BaseCommand):
    help = 'Set password for a user'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='User email')
        parser.add_argument('password', type=str, help='Password to set')

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        
        try:
            user = User.objects.get(email=email)
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Password updated for {email}'
                )
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'❌ User {email} not found')
            )
