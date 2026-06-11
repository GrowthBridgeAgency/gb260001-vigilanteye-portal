import os
import glob
import re

def process_html_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find all select elements with id="filter-..."
    # e.g., <select id="filter-status" class="form-control" ...> ... </select>
    pattern = re.compile(r'<select\s+id="(filter-[^"]+)"[^>]*>(.*?)</select>', re.DOTALL)
    
    def replacer(match):
        select_id = match.group(1)
        options_html = match.group(2)
        
        # Parse options
        opt_pattern = re.compile(r'<option\s+value="([^"]+)">([^<]+)</option>')
        options = opt_pattern.findall(options_html)
        
        tabs_html = f'<div class="premium-tabs" id="premium-{select_id}">'
        for i, (val, text) in enumerate(options):
            active_class = ' active-filter' if i == 0 else ''
            tabs_html += f'\n  <button class="premium-tab{active_class}" data-filter="{val}">{text}</button>'
        tabs_html += '\n</div>'
        
        return tabs_html

    new_content = pattern.sub(replacer, content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated HTML: {filepath}")

html_files = glob.glob('dashboard/*.html') + glob.glob('admin/*.html')
for file in html_files:
    process_html_file(file)

print("Done HTML processing.")
