import os
import glob
import re

html_files = [
    'admin/enquiries.html',
    'admin/reviews.html',
    'admin/service-history.html',
    'admin/invoices.html'
]

SVG_SEARCH = '<svg style="position: absolute; left: 14px; top: 12px; color: var(--text-muted);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
SVG_FILTER = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>'

for filepath in html_files:
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r') as f:
        content = f.read()

    search_placeholder = "Search..."
    s_match = re.search(r'<input type="text" id="search-input"[^>]*placeholder="([^"]+)"', content)
    if s_match:
        search_placeholder = s_match.group(1)
        
    # Match the old filter-pills wrapper
    tabs_pattern = re.compile(r'<div[^>]*id="pills-filter-([^"]+)"[^>]*>\s*(.*?)\s*</div>', re.DOTALL)
    
    dropdown_items = []
    
    for match in tabs_pattern.finditer(content):
        filter_id = match.group(1)
        buttons_html = match.group(2)
        
        label_text = filter_id.replace('-', ' ').title()
        
        # Parse buttons
        btn_pattern = re.compile(r'<button class="premium-tab[^"]*" data-filter="([^"]*)">([^<]*)</button>')
        options = []
        for bmatch in btn_pattern.finditer(buttons_html):
            val = bmatch.group(1)
            text = bmatch.group(2)
            options.append(f'<option value="{val}">{text}</option>')
        
        options_html = '\n                    '.join(options)
        
        dropdown_items.append(f"""
                <div>
                  <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block; text-transform: uppercase; letter-spacing: 0.05em;">{label_text}</label>
                  <select id="filter-{filter_id}" class="form-control" style="width: 100%; margin: 0; background: rgba(0,0,0,0.2);">
                    {options_html}
                  </select>
                </div>""")
                
    if not dropdown_items:
        print(f"No filters found for {filepath}")
        continue
        
    dropdown_content = '\n'.join(dropdown_items)
    
    new_header = f"""          <div style="padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 1rem; align-items: center; justify-content: space-between;">
            <div style="position: relative; flex: 1; max-width: 400px;">
              {SVG_SEARCH}
              <input type="text" id="search-input" class="form-control" placeholder="{search_placeholder}" style="width: 100%; margin: 0; padding-left: 40px; border-radius: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1);">
            </div>
            <div class="filter-dropdown-container" style="position: relative;">
              <button id="filter-toggle-btn" class="btn btn-outline" style="border-radius: 20px; padding: 0.5rem 1.25rem; display: flex; align-items: center; gap: 0.5rem; border: 1px solid rgba(255,255,255,0.2);">
                {SVG_FILTER}
                Filters
              </button>
              <div id="filter-dropdown-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 0.75rem; background: #0B1B32; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.5rem; width: 320px; box-shadow: 0 15px 50px rgba(0,0,0,0.6); z-index: 100; flex-direction: column; gap: 1.25rem;">
{dropdown_content}
              </div>
            </div>
          </div>"""
          
    start_tag = r'<div class="table-container" style="padding: 0; overflow: hidden;">'
    end_tag = r'<div style="overflow-x: auto;">'
    
    parts = re.split(re.escape(start_tag) + r'(.*?)' + re.escape(end_tag), content, flags=re.DOTALL)
    if len(parts) >= 3:
        new_content = parts[0] + start_tag + '\n' + new_header + '\n          ' + end_tag + parts[2]
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"Failed to find table header in {filepath}")
