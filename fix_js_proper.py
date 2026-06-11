import os
import re

files = {
    'js/admin-amc.js': {
        'vars': ['filterStatus'],
        'render': 'renderTables'
    },
    'js/admin-enquiries.js': {
        'vars': ['filterStatus', 'filterType'],
        'render': 'renderTables'
    },
    'js/admin-reviews.js': {
        'vars': ['filterStatus', 'filterStars'],
        'render': 'renderTables'
    },
    'js/admin-service-history.js': {
        'vars': ['filterMonth', 'filterYear'],
        'render': 'renderTable'
    },
    'js/admin-invoices.js': {
        'vars': ['filterStatus'],
        'render': 'renderInvoices'
    }
}

for filepath, config in files.items():
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r') as f:
        content = f.read()
        
    # Build the logic
    logic = """
  // Dropdown Popover Filter Logic
  const filterToggleBtn = document.getElementById('filter-toggle-btn');
  const filterDropdownMenu = document.getElementById('filter-dropdown-menu');
  if (filterToggleBtn && filterDropdownMenu) {
    filterToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = filterDropdownMenu.style.display === 'flex';
      filterDropdownMenu.style.display = isVisible ? 'none' : 'flex';
    });
    document.addEventListener('click', (e) => {
      if (!filterToggleBtn.contains(e.target) && !filterDropdownMenu.contains(e.target)) {
        filterDropdownMenu.style.display = 'none';
      }
    });
    filterDropdownMenu.addEventListener('click', (e) => e.stopPropagation());
  }
"""

    for var in config['vars']:
        el_id = var.replace('filter', 'filter-').lower()
        if el_id == 'filter-type':
            pass # already handled by replace
            
        logic += f"""
  const {var}Select = document.getElementById('{el_id}');
  if ({var}Select) {{
    {var}Select.addEventListener('change', (e) => {{
      {var} = e.target.value;
      {config['render']}();
    }});
  }}
"""

    # We need to replace the old filter logic.
    # The old logic is usually below `searchInput.addEventListener`.
    # Let's just find the closing of `searchInput.addEventListener` and append it there, while deleting any `filterBtns.forEach` or `btns_statusSelect.forEach`.
    
    # 1. Clean old code
    content = re.sub(r'const filterBtns = document\.querySelectorAll\(\'\.premium-tab\'\);.*?}\);\s*}\);', '', content, flags=re.DOTALL)
    content = re.sub(r'const tabs = document\.querySelectorAll\(\'\.premium-tab\'\);.*?\n  }\);\n', '', content, flags=re.DOTALL)
    content = re.sub(r'btns_[a-zA-Z0-9_]+\.forEach\(btn => \{.*?\n\s*\}\);\s*\}\);', '', content, flags=re.DOTALL)
    content = re.sub(r'// Remove active from all.*?renderTables\(\);\n\s*\}\);\n\s*\}\);', '', content, flags=re.DOTALL)
    
    # In amc.js, I manually added filterBtns.forEach. Let's make sure it's gone
    content = re.sub(r'const filterBtns = document\.querySelectorAll\(\'\.premium-tab\'\);\s*filterBtns\.forEach\(btn => \{.*?renderTables\(\);\n\s*\}\);\n\s*\}\);', '', content, flags=re.DOTALL)

    # 2. Inject new code
    # Find searchInput block
    search_block = re.search(r'(searchInput\.addEventListener\(\'input\',.*?\}\);(\s*}\))?)', content, flags=re.DOTALL)
    if search_block:
        original = search_block.group(1)
        # Avoid duplicate injection
        if 'filterToggleBtn' not in content:
            new_code = original + "\n" + logic
            content = content.replace(original, new_code)
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Updated JS in {filepath}")
        else:
            print(f"Already injected in {filepath}")
    else:
        print(f"Could not find search block in {filepath}")
