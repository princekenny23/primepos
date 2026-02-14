from apps.shifts.models import Shift
from django.utils import timezone

total = Shift.objects.count()
closed = Shift.objects.filter(status='CLOSED').count()
print(f'Total shifts: {total}')
print(f'Closed shifts: {closed}')
if closed > 0:
    recent = Shift.objects.filter(status='CLOSED').order_by('-end_time').first()
    print(f'Most recent closed shift: {recent.id} on {recent.operating_date}')
