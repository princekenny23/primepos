#!/usr/bin/env python3
"""Show ItemVariation references that need manual fixing"""
import os
import re

files_to_check = [
    'apps/inventory/serializers.py',
    'apps/inventory/stock_helpers.py',
    'apps/inventory/views.py',
    'apps/notifications/services.py',
    'apps/products/admin.py',
    'apps/products/views.py',
    'apps/sales/views.py',
]

for filepath in files_to_check:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        print(f"\n{'='*60}")
        print(f"FILE: {filepath}")
        print('='*60)
        
        for i, line in enumerate(lines, 1):
            if 'ItemVariation' in line:
                # Show context: 1 line before and after
                start = max(0, i-2)
                end = min(len(lines), i+1)
                for j in range(start, end):
                    prefix = ">>> " if j == i-1 else "    "
                    print(f"{prefix}{j+1:4d}: {lines[j]}", end='')
