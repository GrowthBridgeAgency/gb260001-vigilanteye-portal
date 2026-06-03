/**
 * component-loader.js
 * Utility to fetch and inject HTML partials into designated placeholders.
 */

document.addEventListener("DOMContentLoaded", () => {
  loadComponent("navbar-placeholder", "/components/navbar.html");
  loadComponent("footer-placeholder", "/components/footer.html");
  loadComponent("customer-sidebar-placeholder", "/components/customer-sidebar.html");
  loadComponent("customer-header-placeholder", "/components/customer-header.html");
  loadComponent("admin-sidebar-placeholder", "/components/admin-sidebar.html");
  loadComponent("admin-header-placeholder", "/components/admin-header.html");
});

async function loadComponent(elementId, componentPath) {
  const element = document.getElementById(elementId);
  if (!element) return; // Not all pages have all placeholders

  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    element.innerHTML = html;
  } catch (error) {
    console.error(`Error loading component ${componentPath}:`, error);
    element.innerHTML = `<p>Error loading component.</p>`;
  }
}

// Dynamically load auth module to enforce route protection across all pages
import('/js/auth.js').catch(err => console.error("Failed to load auth module:", err));
