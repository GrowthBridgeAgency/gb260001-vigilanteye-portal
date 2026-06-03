/**
 * theme-switcher.js
 * Injects a global light theme and a creative floating toggle button.
 */
(function() {
  // Load saved preference or default to dark
  const currentTheme = localStorage.getItem('vigilanteye-theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  }

  // Inject Light Theme CSS file
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/light-theme.css';
  document.head.appendChild(link);

  function initThemeButton() {
    if (document.querySelector('.theme-toggle-fab')) return; // Prevent duplicates
    
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-fab';
    btn.setAttribute('aria-label', 'Toggle Theme');
    
    // Elegant SVG icons
    const sunIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const moonIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    btn.innerHTML = currentTheme === 'light' ? moonIcon : sunIcon;
    
    btn.onclick = () => {
      const isLight = document.body.getAttribute('data-theme') === 'light';
      
      // Add a quick pulse animation effect on the body for a smooth transition
      document.body.style.transition = 'background-color 0.4s ease, color 0.4s ease';
      
      if (isLight) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('vigilanteye-theme', 'dark');
        btn.innerHTML = sunIcon;
      } else {
        document.body.setAttribute('data-theme', 'light');
        localStorage.setItem('vigilanteye-theme', 'light');
        btn.innerHTML = moonIcon;
      }
      
      // Cleanup transition style to prevent lingering lag on flex elements
      setTimeout(() => { document.body.style.transition = ''; }, 400);
    };

    document.body.appendChild(btn);
  }

  // If DOM is already loaded (because this script was imported dynamically), run immediately
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initThemeButton);
  } else {
    initThemeButton();
  }
})();
