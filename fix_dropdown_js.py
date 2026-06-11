import os
import glob

files = [
    'js/admin-amc.js',
    'js/admin-enquiries.js',
    'js/admin-reviews.js',
    'js/admin-service-history.js',
    'js/admin-invoices.js'
]

COMMON_LOGIC = """
  // Toggle filter dropdown
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

  // Bind all filter selects automatically
  const selects = document.querySelectorAll('#filter-dropdown-menu select');
  selects.forEach(select => {
    select.addEventListener('change', (e) => {
      const filterId = e.target.id; // e.g. filter-status
      const val = e.target.value;
      // We will map these globally
      if(filterId === 'filter-status') window.filterStatus = val;
      if(filterId === 'filter-type') window.filterType = val;
      if(filterId === 'filter-stars') window.filterStars = val;
      if(filterId === 'filter-month') window.filterMonth = val;
      if(filterId === 'filter-year') window.filterYear = val;
      
      // Some scripts use local 'let filterStatus = ...', so updating window.filterStatus might not affect it.
      // We need to use the local render function.
      if (typeof renderTables === 'function') renderTables();
      else if (typeof renderTable === 'function') renderTable();
      else if (typeof renderInvoices === 'function') renderInvoices();
    });
  });
"""

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
        
    # The current js has the old filter logic or my previous premium-tabs logic
    # To reliably remove old filter logic, we can just replace everything from "const filterBtns = document.querySelectorAll('.premium-tab');" or "searchInput.addEventListener('input'" up to the end of DOMContentLoaded.
    
    # Let's find DOMContentLoaded block
    import re
    
    # We will just append the COMMON_LOGIC before the closing "});\n" or "});\n\n" of the DOMContentLoaded block
    # and remove the old filter logic.
    
    # Remove old `premium-tab` logic
    content = re.sub(r'const filterBtns = document\.querySelectorAll\(\'\.premium-tab\'\);.*?}\);\s*}\);', '', content, flags=re.DOTALL)
    
    # Remove the generic tab logic we might have added
    content = re.sub(r'const tabs = document\.querySelectorAll\(\'\.premium-tab\'\);.*?\n  }\);\n', '', content, flags=re.DOTALL)

    # Some files still have the old `btns_statusSelect.forEach...` from the broken `fix_js.py` earlier
    content = re.sub(r'btns_.*?\.forEach\(btn => \{.*?\}\);\s*\}\);', '', content, flags=re.DOTALL)

    # Wait, the easiest way to inject is to find "searchInput.addEventListener" block and append after it.
    
    # Instead of messy regexes, let's inject it before the end of the DOMContentLoaded listener.
    # We can match `document.addEventListener('DOMContentLoaded', async () => { ... });`
    
    # But wait, local variables like `let filterStatus = 'All'` are used in `renderTables()`.
    # If the universal select change listener sets `window.filterStatus = val`, `renderTables()` will read `filterStatus` (the local variable) which is still 'All'.
    # We need to explicitly modify `renderTables()` or make `filterStatus` read from the DOM directly.
    # The safest approach is to make `renderTables()` read directly from the DOM!
    pass
