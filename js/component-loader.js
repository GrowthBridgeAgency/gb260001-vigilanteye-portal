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
});

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
  } catch (error) {
    console.error(`Error loading component ${componentPath}:`, error);
    element.innerHTML = `<p>Error loading component.</p>`;
  }
}

// Dynamically load core modules sequentially:
// 1. auth.js (Route protection)
// 2. user-context.js (Populate globals like window.currentUser)
import(basePath + '/js/auth.js')
  .then(() => import(basePath + '/js/user-context.js'))
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

