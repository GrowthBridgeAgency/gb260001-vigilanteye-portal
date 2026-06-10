/**
 * component-loader.js
 * Utility to fetch and inject HTML partials into designated placeholders.
 */

// Determine base path dynamically for GitHub Pages support
const basePath = window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '';
window.basePath = basePath; // Expose globally for other scripts

document.addEventListener("DOMContentLoaded", () => {
  loadComponent("navbar-placeholder", basePath + "/components/navbar.html");
  loadComponent("footer-placeholder", basePath + "/components/footer.html");
  loadComponent("customer-sidebar-placeholder", basePath + "/components/customer-sidebar.html");
  loadComponent("admin-sidebar-placeholder", basePath + "/components/admin-sidebar.html");
  loadComponent("customer-header-placeholder", basePath + "/components/customer-header.html");
  loadComponent("admin-header-placeholder", basePath + "/components/admin-header.html");
  injectFloatingIcons();
});

function injectFloatingIcons() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/admin/') || path.includes('/customer/') || path.includes('/login.html')) {
    return;
  }
  
  if (document.getElementById('global-floating-icons')) return;
  const div = document.createElement('div');
  div.id = 'global-floating-icons';
  div.style.cssText = 'position: fixed !important; bottom: 30px !important; right: 20px !important; display: flex !important; flex-direction: column !important; gap: 12px !important; z-index: 2147483647 !important;';
  
  div.innerHTML = `
    <!-- Call Icon -->
    <a href="tel:+919649645559" style="width: 55px; height: 55px; background-color: #1a1a1a; color: white; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.3s, background-color 0.3s; text-decoration: none;" onmouseover="this.style.backgroundColor='#333'; this.style.transform='scale(1.05)';" onmouseout="this.style.backgroundColor='#1a1a1a'; this.style.transform='scale(1)';">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
      </svg>
    </a>
    <!-- WhatsApp Icon -->
    <a href="https://wa.me/919649645559?text=Hello%20Shree%20Sawariya%20CCTV%20Security%20Services,%20I%20have%20an%20enquiry." target="_blank" style="width: 55px; height: 55px; background-color: #25D366; color: white; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.3s, background-color 0.3s; text-decoration: none;" onmouseover="this.style.backgroundColor='#20b858'; this.style.transform='scale(1.05)';" onmouseout="this.style.backgroundColor='#25D366'; this.style.transform='scale(1)';">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    </a>
  `;
  document.body.appendChild(div);
}

async function loadComponent(elementId, componentPath) {
  const element = document.getElementById(elementId);
  if (!element) return; // Not all pages have all placeholders

  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    let html = await response.text();
    
    // Rewrite root-relative URLs in components to include the base path
    if (basePath) {
      html = html.replace(/(href|src)=["']\/([^"']*)["']/g, (match, attr, path) => {
        return `${attr}="${basePath}/${path}"`;
      });
    }
    
    element.innerHTML = html;
    
    if (elementId === 'navbar-placeholder' && window.updateNavigationUI) {
      window.updateNavigationUI();
    }
    
    highlightActiveLinks(element);
  } catch (error) {
    console.error(`Error loading component ${componentPath}:`, error);
    element.innerHTML = `<p>Error loading component.</p>`;
  }
}

function highlightActiveLinks(container) {
  const currentPath = window.location.pathname;
  // Get all links in the loaded container
  const links = container.querySelectorAll('a');
  links.forEach(link => {
    // If the link href matches the current path (or we're at root and it points to index)
    const linkPath = new URL(link.href, window.location.origin).pathname;
    
    if (currentPath === linkPath || (currentPath.endsWith('/') && linkPath.endsWith('index.html'))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Dynamically load core modules sequentially:
// 1. auth.js (Route protection)
// 2. user-context.js (Populate globals like window.currentUser)
// 3. scroll-animations.js (Fallback for storytelling animations)
// 4. notification-service.js (Global notification polling)
import(basePath + '/js/auth.js')
  .then(() => import(basePath + '/js/user-context.js'))
  .then(() => import(basePath + '/js/scroll-animations.js'))
  .then(() => import(basePath + '/js/notification-service.js'))
  .then((module) => {
    if (module && module.initNotificationPolling) {
      module.initNotificationPolling();
    }
  })
  .catch(err => console.error("Failed to load core modules:", err));

// Global File Input Clear Utility
document.addEventListener('change', (e) => {
  if (e.target.matches('input[type="file"]')) {
    const input = e.target;
    let wrapper = input.parentElement;
    
    // Initialize wrapper and clear button if not already done
    if (!wrapper.classList.contains('file-input-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'file-input-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'block';
      wrapper.style.marginBottom = input.style.marginBottom || '0';
      input.style.marginBottom = '0'; // Move margin to wrapper
      
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.innerHTML = '×';
      clearBtn.className = 'file-clear-btn';
      clearBtn.title = 'Remove file';
      
      // Styling the clear button
      clearBtn.style.position = 'absolute';
      clearBtn.style.right = '12px';
      clearBtn.style.top = '50%';
      clearBtn.style.transform = 'translateY(-50%)';
      clearBtn.style.background = 'rgba(239, 68, 68, 0.15)';
      clearBtn.style.color = '#ef4444';
      clearBtn.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      clearBtn.style.borderRadius = '50%';
      clearBtn.style.width = '24px';
      clearBtn.style.height = '24px';
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.display = 'none';
      clearBtn.style.alignItems = 'center';
      clearBtn.style.justifyContent = 'center';
      clearBtn.style.fontSize = '1.2rem';
      clearBtn.style.lineHeight = '1';
      clearBtn.style.transition = 'all 0.2s ease';
      clearBtn.style.zIndex = '10';
      
      clearBtn.addEventListener('mouseover', () => {
        clearBtn.style.background = 'rgba(239, 68, 68, 0.9)';
        clearBtn.style.color = '#ffffff';
      });
      clearBtn.addEventListener('mouseout', () => {
        clearBtn.style.background = 'rgba(239, 68, 68, 0.15)';
        clearBtn.style.color = '#ef4444';
      });
      
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        input.dispatchEvent(new Event('change')); // Trigger any other listeners
      });
      
      wrapper.appendChild(clearBtn);
    }
    
    // Toggle visibility based on file selection
    const clearBtn = wrapper.querySelector('.file-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = input.files && input.files.length > 0 ? 'flex' : 'none';
    }
  }
});

// Mobile menu toggle logic
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('#mobile-menu-btn');
  if (toggleBtn) {
    const navbar = document.querySelector('.main-navbar');
    if (navbar) {
      navbar.classList.toggle('mobile-menu-active');
    }
    return;
  }
  
  const navLink = e.target.closest('.nav-link');
  if (navLink) {
    const navbar = document.querySelector('.main-navbar');
    if (navbar && navbar.classList.contains('mobile-menu-active')) {
      navbar.classList.remove('mobile-menu-active');
    }
  }
});

// Custom Select Initialization Logic
window.initCustomSelects = function(root = document) {
  const selects = root.querySelectorAll('select:not(.custom-select-initialized)');
  selects.forEach(select => {
    select.classList.add('custom-select-initialized');
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    // Insert wrapper before select, move select inside
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    
    // Create trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    
    const textNode = document.createElement('span');
    textNode.textContent = select.options[select.selectedIndex]?.text || 'Select an option';
    trigger.appendChild(textNode);
    
    // Add SVG arrow
    trigger.insertAdjacentHTML('beforeend', '<svg class="arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>');
    wrapper.appendChild(trigger);
    
    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';
    wrapper.appendChild(optionsContainer);
    
    // Function to render options
    const renderOptions = () => {
      optionsContainer.innerHTML = '';
      Array.from(select.options).forEach((option, index) => {
        const optDiv = document.createElement('div');
        optDiv.className = 'custom-select-option';
        if (select.selectedIndex === index) optDiv.classList.add('selected');
        optDiv.textContent = option.text;
        
        optDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          select.selectedIndex = index;
          textNode.textContent = option.text;
          
          // Trigger change event on original select
          select.dispatchEvent(new Event('change'));
          
          // Update selected classes
          optionsContainer.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
          optDiv.classList.add('selected');
          
          wrapper.classList.remove('open');
        });
        
        optionsContainer.appendChild(optDiv);
      });
    };
    
    renderOptions();
    
    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other selects
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });
    
    // Re-render if select options change dynamically (mutation observer)
    const observer = new MutationObserver(() => {
      renderOptions();
      textNode.textContent = select.options[select.selectedIndex]?.text || 'Select an option';
    });
    observer.observe(select, { childList: true, subtree: true });
    
    // Also listen to direct value changes on select via JS if it triggers 'change'
    select.addEventListener('change', () => {
      textNode.textContent = select.options[select.selectedIndex]?.text || 'Select an option';
      optionsContainer.querySelectorAll('.custom-select-option').forEach((el, index) => {
        el.classList.toggle('selected', select.selectedIndex === index);
      });
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  window.initCustomSelects();
  
  // Re-run init when content is dynamically loaded via component-loader
  const observer = new MutationObserver((mutations) => {
    let shouldInit = false;
    for (let mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldInit = true;
        break;
      }
    }
    if (shouldInit) window.initCustomSelects();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

// Close all custom selects when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
});
