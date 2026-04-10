from django.conf import settings
from django.db import migrations
from django.utils.text import slugify


def backfill_tenant_url_fields(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    base_domain = (getattr(settings, 'TENANT_BASE_DOMAIN', '') or '').strip().lower()

    used_subdomains = set(
        s for s in Tenant.objects.exclude(subdomain__isnull=True).exclude(subdomain='').values_list('subdomain', flat=True)
    )

    for tenant in Tenant.objects.all().order_by('id'):
        changed = False

        if not tenant.subdomain:
            base_slug = slugify(tenant.name or '')[:50] or 'tenant'
            candidate = base_slug
            counter = 1
            while candidate in used_subdomains:
                suffix = f"-{counter}"
                candidate = f"{base_slug[:max(1, 63 - len(suffix))]}{suffix}"
                counter += 1
            tenant.subdomain = candidate
            used_subdomains.add(candidate)
            changed = True

        if base_domain and not tenant.domain and tenant.subdomain:
            candidate_domain = f"{tenant.subdomain}.{base_domain}"
            exists = Tenant.objects.exclude(pk=tenant.pk).filter(domain__iexact=candidate_domain).exists()
            if not exists:
                tenant.domain = candidate_domain
                changed = True

        if changed:
            tenant.save(update_fields=['subdomain', 'domain'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0013_tenant_subdomain_domain'),
    ]

    operations = [
        migrations.RunPython(backfill_tenant_url_fields, noop_reverse),
    ]
