import os
import sys

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings.production')

# Get Render database password
render_password = input('Enter Render database password: ')

# Override database settings
os.environ['DB_NAME'] = 'primepos'
os.environ['DB_USER'] = 'primepos'
os.environ['DB_PASSWORD'] = render_password
os.environ['DB_HOST'] = 'dpg-d5uu72qqcgvc7395prkg-a.postgres.render.com'
os.environ['DB_PORT'] = '5432'

import django
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

print('\nConnecting to Render database...')

try:
    user = User.objects.get(email="kwitondakenny@gmail.com")
    print(f'Found user: {user.email}')
    
    user.set_password("kwitonda")
    user.save()
    
    print('\n✓ SUCCESS!')
    print('='*50)
    print('Password updated in Render database')
    print(f'Email: kwitondakenny@gmail.com')
    print(f'Password: kwitonda')
    print('='*50)
    print('\nYou can now login at: https://primepos-beta.vercel.app/')
    
except User.DoesNotExist:
    print('\n✗ ERROR: User not found in database')
except Exception as e:
    print(f'\n✗ ERROR: {e}')
    import traceback
    traceback.print_exc()
