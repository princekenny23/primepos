import os

# Find all Python files with ItemVariation references
for root, dirs, files in os.walk('apps'):
    # Skip migrations and __pycache__
    dirs[:] = [d for d in dirs if d not in ['migrations', '__pycache__']]
    
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'ItemVariation' in content:
                        # Count occurrences
                        count = content.count('ItemVariation')
                        print(f"{filepath}: {count} references")
            except Exception as e:
                pass
