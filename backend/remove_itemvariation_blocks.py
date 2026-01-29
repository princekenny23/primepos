#!/usr/bin/env python3
"""Remove ItemVariation code blocks from views and other production files"""
import re
import os

def remove_itemvariation_block(content, pattern, replacement=""):
    """Remove blocks of ItemVariation code"""
    return re.sub(pattern, replacement, content, flags=re.DOTALL)

def fix_views_file(filepath):
    """Fix views.py file by removing ItemVariation usage"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: Remove "Get or create default variation" block (lines ~750-783)
    pattern1 = r'(\s+# Get or create default variation.*?\n).*?(?=\s+# Also update legacy Product\.stock|\s+# Update cost if|\s+# Record movement)'
    content = re.sub(pattern1, '', content, flags=re.DOTALL)
    
    # Pattern 2: Remove ItemVariation imports
    content = re.sub(
        r'from apps\.products\.models import ItemVariation\n',
        '',
        content
    )
    
    # Pattern 3: Remove variation-based LocationStock creation
    pattern3 = r'(\s+# Update LocationStock.*?\n).*?(?=\s+# Also update legacy|\s+# Update cost|$)'
    content = re.sub(pattern3, '', content, flags=re.DOTALL)
    
    # Pattern 4: Fix references to "variation" that are checked
    # Replace: if not variation:  with: if False:  (to disable the whole block)
    content = re.sub(
        r'if not variation:',
        'if False:  # DISABLED: ItemVariation removed',
        content
    )
    
    # Pattern 5: Remove ItemVariation.DoesNotExist exception handlers
    pattern5 = r'except ItemVariation\.DoesNotExist:.*?(?=\n\s{12}[a-z]|\n\s{8}[a-z]|\n[a-z])'
    content = re.sub(pattern5, 'except Exception:  # ItemVariation removed', content, flags=re.DOTALL)
    
    # Pattern 6: Remove ItemVariation.objects.get calls
    content = re.sub(
        r'variation = ItemVariation\.objects\.get\([^)]*\)',
        'variation = None  # ItemVariation removed',
        content
    )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

# Process files
files_to_fix = [
    'apps/inventory/views.py',
    'apps/sales/views.py',
    'apps/products/views.py',
]

for filepath in files_to_fix:
    if os.path.exists(filepath):
        if fix_views_file(filepath):
            print(f"✓ Fixed {filepath}")
        else:
            print(f"- No changes in {filepath}")
    else:
        print(f"✗ File not found: {filepath}")
