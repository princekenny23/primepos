#!/usr/bin/env python3
"""Fix remaining ItemVariation references"""
import os
import re

files_to_fix = {
    'apps/bar/views.py': 'ItemVariation import in views',
    'apps/inventory/models.py': 'ItemVariation comment/reference',
    'apps/inventory/serializers.py': 'ItemVariation fields/references',
    'apps/inventory/stock_helpers.py': 'ItemVariation references',
    'apps/inventory/views.py': 'ItemVariation references',
    'apps/notifications/services.py': 'ItemVariation reference',
    'apps/products/admin.py': 'ItemVariation reference',
    'apps/products/views.py': 'ItemVariation import',
}

def remove_itemvariation_import(content):
    """Remove ItemVariationSerializer from imports"""
    # Pattern 1: from ... import ..., ItemVariationSerializer
    content = re.sub(
        r',\s*ItemVariationSerializer(?=\s*[\n\)])',
        '',
        content
    )
    # Pattern 2: ItemVariationSerializer, ... (at beginning)
    content = re.sub(
        r'ItemVariationSerializer,\s*',
        '',
        content
    )
    return content

# Process each file
for filepath, description in files_to_fix.items():
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original = content
            
            # Remove imports
            content = remove_itemvariation_import(content)
            
            # For views files, also remove ItemVariation class imports
            if 'views.py' in filepath:
                # Remove "from apps.products.models import ItemVariation"
                content = re.sub(
                    r'^from apps\.products\.models import.*ItemVariation.*$\n?',
                    '',
                    content,
                    flags=re.MULTILINE
                )
                # Clean up if that was the only import from products.models
                content = re.sub(
                    r'^from apps\.products\.models import\s*$\n?',
                    '',
                    content,
                    flags=re.MULTILINE
                )
            
            # Write back if changed
            if content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✓ Fixed {filepath}")
            else:
                print(f"- No changes needed in {filepath}")
                
        except Exception as e:
            print(f"✗ Error processing {filepath}: {e}")
    else:
        print(f"✗ File not found: {filepath}")
