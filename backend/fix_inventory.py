#!/usr/bin/env python3
"""Fix inventory models by removing ItemVariation references"""

import re

# Read the file
with open('apps/inventory/models.py', 'r') as f:
    lines = f.readlines()

# Process line by line
output = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Skip the lazy loader function entirely
    if 'def get_item_variation_model():' in line:
        # Skip this function and the next 2 lines
        i += 4
        continue
    
    # Remove ItemVariation import
    if "from apps.products.models import ItemVariation" in line:
        i += 1
        continue
    
    # Remove variation ForeignKey from Batch
    if "variation = models.ForeignKey('products.ItemVariation'" in line and i > 0 and 'Batch' in ''.join(lines[max(0,i-10):i]):
        i += 1
        continue
    
    # Remove variation ForeignKey from StockMovement
    if "variation = models.ForeignKey('products.ItemVariation'" in line and i > 0 and 'StockMovement' in ''.join(lines[max(0,i-20):i]):
        i += 1
        continue
    
    # Remove variation ForeignKey from LocationStock
    if "variation = models.ForeignKey('products.ItemVariation'" in line and i > 0 and 'LocationStock' in ''.join(lines[max(0,i-20):i]):
        i += 1
        continue
    
    # Remove variation ForeignKey from StockTakeItem
    if "variation = models.ForeignKey('products.ItemVariation'" in line and i > 0 and 'StockTakeItem' in ''.join(lines[max(0,i-20):i]):
        i += 1
        continue
    
    # Fix Batch Meta unique_together and indexes
    if "unique_together = [['variation', 'outlet', 'batch_number']]" in line:
        # Skip this line
        i += 1
        # Skip the indexes section too
        while i < len(lines) and 'ordering = ' not in lines[i]:
            i += 1
        # Add new indexes
        output.append("        indexes = [\n")
        output.append("            models.Index(fields=['tenant']),\n")
        output.append("            models.Index(fields=['outlet']),\n")
        output.append("            models.Index(fields=['expiry_date']),\n")
        output.append("        ]\n")
        continue
    
    # Fix Batch __str__
    if 'return f"{self.variation.product.name} - {self.variation.name} - Batch' in line:
        output.append('        return f"Batch {self.batch_number} @ {self.outlet.name}"\n')
        i += 1
        continue
    
    # Fix StockMovement Meta
    if "models.Index(fields=['variation', 'outlet'])" in line and i > 0 and 'StockMovement' in ''.join(lines[max(0,i-30):i]):
        # Skip this line
        i += 1
        continue
    
    if "models.Index(fields=['variation'])" in line and i > 0 and 'StockMovement' in ''.join(lines[max(0,i-30):i]):
        # Skip this line
        i += 1
        continue
    
    # Fix StockMovement __str__
    if 'product_name = self.variation.product.name if self.variation else' in line:
        output.append('        product_name = self.product.name if self.product else "Unknown"\n')
        i += 1
        continue
    
    # Fix StockMovement clean method - simplify it
    if 'def clean(self):' in line and i > 0 and 'StockMovement' in ''.join(lines[max(0,i-50):i]):
        output.append('    def clean(self):\n')
        output.append('        """Ensure product is set"""\n')
        output.append('        from django.core.exceptions import ValidationError\n')
        output.append('        \n')
        output.append('        if not self.product:\n')
        output.append('            raise ValidationError("Product must be set")\n')
        output.append('        \n')
        output.append('        # Validate batch belongs to same outlet if provided\n')
        output.append('        if self.batch and self.batch.outlet != self.outlet:\n')
        output.append('            raise ValidationError("Batch must belong to the same outlet")\n')
        # Skip old clean method
        i += 1
        while i < len(lines) and 'def save(self' not in lines[i]:
            i += 1
        continue
    
    # Fix StockMovement save method - simplify it
    if 'def save(self, *args, **kwargs):' in line and i > 0 and 'StockMovement' in ''.join(lines[max(0,i-70):i]):
        output.append('    def save(self, *args, **kwargs):\n')
        output.append('        """Validate before saving"""\n')
        output.append('        self.clean()\n')
        output.append('        super().save(*args, **kwargs)\n')
        # Skip old save method
        i += 1
        while i < len(lines) and 'class StockTake' not in lines[i]:
            i += 1
        continue
    
    # Fix LocationStock class - add product FK
    if 'class LocationStock(models.Model):' in line:
        output.append(line)
        i += 1
        # Add docstring
        while i < len(lines) and '"""' in lines[i]:
            output.append(lines[i])
            i += 1
            if lines[i-1].strip().endswith('"""'):
                break
        # Add tenant FK
        output.append(lines[i])  # tenant line
        i += 1
        # Skip variation line, add product instead
        if 'variation = models.ForeignKey' in lines[i]:
            output.append('    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name=\'location_stocks\')\n')
            i += 1
        continue
    
    # Fix LocationStock Meta unique_together
    if "unique_together = [['variation', 'outlet']]" in line:
        output.append("        unique_together = [['product', 'outlet']]\n")
        i += 1
        continue
    
    # Fix LocationStock indexes
    if "models.Index(fields=['variation', 'outlet'])" in line and i > 0 and 'LocationStock' in ''.join(lines[max(0,i-30):i]):
        output.append("            models.Index(fields=['product', 'outlet']),\n")
        i += 1
        continue
    
    if "models.Index(fields=['variation'])" in line and i > 0 and 'LocationStock' in ''.join(lines[max(0,i-30):i]):
        output.append("            models.Index(fields=['product']),\n")
        i += 1
        continue
    
    # Fix LocationStock __str__
    if 'return f"{self.variation.product.name} - {self.variation.name} @ {self.outlet.name}' in line:
        output.append('        return f"{self.product.name} @ {self.outlet.name}: {self.quantity}"\n')
        i += 1
        continue
    
    # Fix LocationStock methods that use variation
    if 'variation=self.variation,' in line and 'LocationStock' in ''.join(lines[max(0,i-50):i]):
        # Skip or replace these
        if 'Batch.objects.filter(' in lines[i-1]:
            output.append('            outlet=self.outlet,\n')
            i += 1
        continue
    
    # Fix StockTakeItem Meta
    if "unique_together = [['stock_take', 'variation']" in line or "unique_together = [['stock_take', 'product']" in line:
        i += 1
        continue
    
    if 'models.UniqueConstraint(fields=[\'' in line and 'stock_take' in line:
        i += 1
        continue
    
    # Add unique_together for StockTakeItem properly
    if "db_table = 'inventory_stocktakeitem'" in line:
        output.append(line)
        i += 1
        output.append("        verbose_name = 'Stock Take Item'\n")
        output.append("        verbose_name_plural = 'Stock Take Items'\n")
        output.append("        unique_together = [['stock_take', 'product']]\n")
        # Skip old verbose_name lines and constraints
        while i < len(lines) and 'indexes = [' not in lines[i]:
            i += 1
        continue
    
    # Fix StockTakeItem indexes
    if "models.Index(fields=['variation'])" in line and i > 0 and 'StockTakeItem' in ''.join(lines[max(0,i-30):i]):
        i += 1
        continue
    
    # Fix StockTakeItem __str__
    if 'product_name = self.variation.product.name if self.variation else' in line and i > 0 and 'StockTakeItem' in ''.join(lines[max(0,i-50):i]):
        output.append('        product_name = self.product.name if self.product else "Unknown"\n')
        i += 1
        continue
    
    # Default: keep the line
    output.append(line)
    i += 1

# Write back
with open('apps/inventory/models.py', 'w') as f:
    f.writelines(output)

print("Fixed inventory/models.py successfully")
