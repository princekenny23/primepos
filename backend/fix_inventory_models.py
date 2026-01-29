import re

# Read the file
with open('apps/inventory/models.py', 'r') as f:
    content = f.read()

# Remove lazy loader function
content = re.sub(r'\n# Import ItemVariation with lazy loading.*?return ItemVariation\n\n', '\n', content, flags=re.DOTALL)

# Remove variation ForeignKey from Batch
content = re.sub(r'    variation = models\.ForeignKey\(\'products\.ItemVariation\', on_delete=models\.CASCADE, related_name=\'batches\'\)\n', '', content)

# Fix Batch Meta unique_together and indexes
content = re.sub(
    r'unique_together = \[\[\'variation\', \'outlet\', \'batch_number\'\]\]\n        indexes = \[\n            models\.Index\(fields=\[\'tenant\'\]\),\n            models\.Index\(fields=\[\'variation\', \'outlet\'\]\),\n            models\.Index\(fields=\[\'expiry_date\'\]\),\n            models\.Index\(fields=\[\'variation\', \'outlet\', \'expiry_date\'\]\),\n        \]',
    'indexes = [\n            models.Index(fields=[\'tenant\']),\n            models.Index(fields=[\'outlet\']),\n            models.Index(fields=[\'expiry_date\']),\n        ]',
    content
)

# Fix Batch __str__
content = re.sub(
    r'def __str__\(self\):\n        return f\"{self\.variation\.product\.name} - {self\.variation\.name} - Batch {self\.batch_number} @ {self\.outlet\.name}\"',
    'def __str__(self):\n        return f"Batch {self.batch_number} @ {self.outlet.name}"',
    content
)

# Remove variation from StockMovement
content = re.sub(r'    variation = models\.ForeignKey\(\'products\.ItemVariation\', on_delete=models\.CASCADE, related_name=\'stock_movements\', null=True, blank=True, help_text="Item variation for this movement \(preferred\)"\)\n', '', content)

# Update StockMovement product field help text
content = re.sub(
    r'product = models\.ForeignKey\(Product, on_delete=models\.CASCADE, related_name=\'stock_movements\', null=True, blank=True, help_text="Deprecated: Use variation instead\. Kept for backward compatibility\."\)',
    'product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name=\'stock_movements\', null=True, blank=True, help_text="Product for this movement")',
    content
)

# Fix StockMovement Meta indexes
content = re.sub(
    r'models\.Index\(fields=\[\'variation\'\]\),\n            models\.Index\(fields=\[\'outlet\'\]\),',
    'models.Index(fields=[\'outlet\']),',
    content
)

# Fix StockMovement __str__
content = re.sub(
    r'product_name = self\.variation\.product\.name if self\.variation else \(self\.product\.name if self\.product else "Unknown"\)',
    'product_name = self.product.name if self.product else "Unknown"',
    content
)

# Remove variation from LocationStock
content = re.sub(r'    variation = models\.ForeignKey\(\'products\.ItemVariation\', on_delete=models\.CASCADE, related_name=\'location_stocks\'\)\n', '', content)

# Update LocationStock Meta
content = re.sub(
    r'unique_together = \[\[\'variation\', \'outlet\'\]\]\n        indexes = \[\n            models\.Index\(fields=\[\'variation\', \'outlet\'\]\),\n            models\.Index\(fields=\[\'outlet\'\]\),\n            models\.Index\(fields=\[\'variation\'\]\),\n            models\.Index\(fields=\[\'tenant\'\]\),\n        \]',
    'unique_together = [[\'product\', \'outlet\']]\n        indexes = [\n            models.Index(fields=[\'product\', \'outlet\']),\n            models.Index(fields=[\'outlet\']),\n            models.Index(fields=[\'product\']),\n            models.Index(fields=[\'tenant\']),\n        ]',
    content
)

# Add product field to LocationStock before quantity
content = re.sub(
    r'(class LocationStock.*?outlet = models\.ForeignKey\(Outlet, on_delete=models\.CASCADE, related_name=\'location_stocks\'\)\n)',
    r'\1    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name=\'location_stocks\')\n',
    content,
    flags=re.DOTALL
)

# Fix LocationStock __str__
content = re.sub(
    r'return f"{self\.variation\.product\.name} - {self\.variation\.name} @ {self\.outlet\.name}: {self\.quantity}"',
    'return f"{self.product.name} @ {self.outlet.name}: {self.quantity}"',
    content
)

# Fix LocationStock get_available_quantity
content = re.sub(
    r'(get_available_quantity\(self\):.*?)(batches = Batch\.objects\.filter\(\n            variation=self\.variation,)',
    r'\1batches = Batch.objects.filter(\n            outlet=self.outlet,',
    content,
    flags=re.DOTALL
)

# Fix get_total_quantity_including_expired
content = re.sub(
    r'(get_total_quantity_including_expired\(self\):.*?)(batches = Batch\.objects\.filter\(\n            variation=self\.variation,)',
    r'\1batches = Batch.objects.filter(\n            outlet=self.outlet,',
    content,
    flags=re.DOTALL
)

# Fix get_expiring_soon
content = re.sub(
    r'(get_expiring_soon\(self, days=30\):.*?)(return Batch\.objects\.filter\(\n            variation=self\.variation,)',
    r'\1return Batch.objects.filter(\n            outlet=self.outlet,',
    content,
    flags=re.DOTALL
)

# Remove variation from StockTakeItem
content = re.sub(r'    variation = models\.ForeignKey\(\'products\.ItemVariation\', on_delete=models\.CASCADE, related_name=\'stock_take_items\', null=True, blank=True, help_text="Item variation for this stock take \(preferred\)"\)\n', '', content)

# Fix StockTakeItem product field
content = re.sub(
    r'product = models\.ForeignKey\(Product, on_delete=models\.CASCADE, related_name=\'stock_take_items\', null=True, blank=True, help_text="Deprecated: Use variation instead\. Kept for backward compatibility\."\)',
    'product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name=\'stock_take_items\')',
    content
)

# Fix StockTakeItem Meta
content = re.sub(
    r'constraints = \[\n            models\.UniqueConstraint\(fields=\[\'stock_take\', \'variation\'\], condition=models\.Q\(variation__isnull=False\), name=\'unique_stocktake_variation\'\),\n            models\.UniqueConstraint\(fields=\[\'stock_take\', \'product\'\], condition=models\.Q\(variation__isnull=True, product__isnull=False\), name=\'unique_stocktake_product\'\),\n        \]\n        indexes = \[\n            models\.Index\(fields=\[\'stock_take\'\]\),\n            models\.Index\(fields=\[\'product\'\]\),\n            models\.Index\(fields=\[\'variation\'\]\),\n        \]',
    'unique_together = [[\'stock_take\', \'product\']]\n        indexes = [\n            models.Index(fields=[\'stock_take\']),\n            models.Index(fields=[\'product\']),\n        ]',
    content
)

# Fix StockTakeItem clean
content = re.sub(
    r'def clean\(self\):\n        """Ensure either product or variation is set"""\n        from django\.core\.exceptions import ValidationError\n        if not self\.product and not self\.variation:\n            raise ValidationError\("Either product or variation must be set"\)',
    'def clean(self):\n        """Ensure product is set"""\n        from django.core.exceptions import ValidationError\n        if not self.product:\n            raise ValidationError("Product must be set")',
    content
)

# Fix StockTakeItem save
content = re.sub(
    r'def save\(self, \*args, \*\*kwargs\):\n        self\.difference = self\.counted_quantity - self\.expected_quantity\n        # Auto-set product from variation if needed\n        if self\.variation and not self\.product:\n            self\.product = self\.variation\.product\n        # Validate uniqueness for product \(backward compat\)\n        if self\.product and not self\.variation:.*?raise ValidationError\("Product already exists in this stock take"\)\n        self\.clean\(\)\n        super\(\)\.save\(\*args, \*\*kwargs\)',
    'def save(self, *args, **kwargs):\n        self.difference = self.counted_quantity - self.expected_quantity\n        self.clean()\n        super().save(*args, **kwargs)',
    content,
    flags=re.DOTALL
)

# Fix StockTakeItem __str__
content = re.sub(
    r'product_name = self\.variation\.product\.name if self\.variation else \(self\.product\.name if self\.product else "Unknown"\)',
    'product_name = self.product.name if self.product else "Unknown"',
    content
)

# Write back
with open('apps/inventory/models.py', 'w') as f:
    f.write(content)

print('Fixed inventory/models.py')
