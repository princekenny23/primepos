from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django import forms
from .models import User


class UserAdminForm(forms.ModelForm):
    class Meta:
        model = User
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get("is_saas_admin"):
            cleaned_data["tenant"] = None
            cleaned_data["role"] = "saas_admin"
        return cleaned_data


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserAdminForm
    list_display = ('email', 'username', 'tenant', 'role', 'is_saas_admin', 'is_active', 'date_joined')
    list_filter = ('role', 'is_saas_admin', 'is_active', 'tenant')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('PrimePOS Info', {'fields': ('tenant', 'role', 'phone', 'is_saas_admin')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('PrimePOS Info', {'fields': ('email', 'tenant', 'role', 'phone', 'is_saas_admin')}),
    )

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if obj and obj.is_saas_admin:
            updated = []
            for title, opts in fieldsets:
                fields = opts.get('fields', ())
                if title == 'PrimePOS Info' and 'tenant' in fields:
                    fields = tuple(field for field in fields if field != 'tenant')
                    opts = {**opts, 'fields': fields}
                updated.append((title, opts))
            return updated
        return fieldsets

    def save_model(self, request, obj, form, change):
        if obj.is_saas_admin:
            obj.tenant = None
            obj.role = 'saas_admin'
        super().save_model(request, obj, form, change)

