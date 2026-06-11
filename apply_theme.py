import os
import glob

replacements = {
    '#38bdf8': '#FF6B00',
    '#38BDF8': '#FF6B00',
    '56, 189, 248': '255, 107, 0',
    '#030407': '#0B1B32',
    '3, 4, 7': '11, 27, 50',
    '#0b0f19': '#132442',
    '#0B0F19': '#132442'
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if content != new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# Process CSS files
for filepath in glob.glob('/Users/deadlinehub/Documents/GitHub/gb260001-vigilanteye-portal/**/*.css', recursive=True):
    process_file(filepath)

# Process HTML files
for filepath in glob.glob('/Users/deadlinehub/Documents/GitHub/gb260001-vigilanteye-portal/**/*.html', recursive=True):
    process_file(filepath)
    
# Process JS files
for filepath in glob.glob('/Users/deadlinehub/Documents/GitHub/gb260001-vigilanteye-portal/**/*.js', recursive=True):
    process_file(filepath)

print("Done")
