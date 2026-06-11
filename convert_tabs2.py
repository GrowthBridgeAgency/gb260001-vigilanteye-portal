import os
import glob
import re

def process_html_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We need to replace the pill containers with premium-tabs.
    # The containers look like: <div style="..." id="pills-filter-..." class="filter-pills hide-scrollbar">
    # We want them to be <div class="premium-tabs" id="...">
    
    # Let's find all pill containers.
    # Actually, we can use a simpler regex for the buttons.
    # We want to replace `<button class="btn btn-outline active-filter" data-filter="All" style="...">Text</button>`
    # with `<button class="premium-tab active-filter" data-filter="All">Text</button>`
    
    # 1. Replace button classes and strip style
    btn_pattern = re.compile(r'<button\s+class="btn\s+btn-outline\s*(active-filter)?"\s+data-filter="([^"]+)"[^>]*>(.*?)</button>')
    def btn_replacer(match):
        active_class = match.group(1) if match.group(1) else ''
        val = match.group(2)
        text = match.group(3)
        return f'<button class="premium-tab {active_class}".strip() data-filter="{val}">{text}</button>'
    
    new_content = btn_pattern.sub(btn_replacer, content)
    
    # Fix the strip() bug
    new_content = new_content.replace('".strip() data-filter', '" data-filter')
    new_content = new_content.replace('"" data-filter', '" data-filter')
    new_content = new_content.replace('class="premium-tab "', 'class="premium-tab"')
    
    # 2. Replace container
    # <div style="..." id="pills-filter-status" class="filter-pills hide-scrollbar">
    # Replace with <div class="premium-tabs" id="premium-filter-status">
    container_pattern = re.compile(r'<div[^>]*class="filter-pills\s+hide-scrollbar"[^>]*id="pills-(filter-[^"]+)"[^>]*>')
    def container_replacer(match):
        return f'<div class="premium-tabs" id="premium-{match.group(1)}">'
    
    new_content = container_pattern.sub(container_replacer, new_content)
    
    # Also handle the one in amc.html
    # <div style="..." id="filter-pills" class="hide-scrollbar">
    container_pattern2 = re.compile(r'<div[^>]*id="filter-pills"[^>]*>')
    new_content = container_pattern2.sub(r'<div class="premium-tabs" id="premium-filter-status">', new_content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated HTML: {filepath}")

html_files = glob.glob('dashboard/*.html') + glob.glob('admin/*.html')
for file in html_files:
    process_html_file(file)

print("Done HTML processing.")
