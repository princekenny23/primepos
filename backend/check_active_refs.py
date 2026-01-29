#!/usr/bin/env python3
"""Show ItemVariation references in non-test files"""
import os

files_to_check = [
    ('apps/inventory/models.py', 'Model definition'),
    ('apps/inventory/serializers.py', 'Serializers'),
    ('apps/inventory/views.py', 'Views'),
    ('apps/inventory/stock_helpers.py', 'Helpers'),
    ('apps/sales/views.py', 'Sales Views'),
    ('apps/products/views.py', 'Products Views'),
    ('apps/bar/views.py', 'Bar Views'),
    ('apps/products/admin.py', 'Admin'),
    ('apps/notifications/services.py', 'Services'),
]

for filepath, desc in files_to_check:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        refs = []
        for i, line in enumerate(lines, 1):
            if 'ItemVariation' in line and not line.strip().startswith('#'):
                refs.append((i, line.strip()))
        
        if refs:
            print(f"\n{desc} ({filepath}):")
            for line_num, line in refs[:3]:  # Show first 3
                print(f"  Line {line_num}: {line[:80]}")
            if len(refs) > 3:
                print(f"  ... and {len(refs)-3} more")
