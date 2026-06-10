/**
 * index.js
 * Logic for dynamic data on the public homepage.
 */

import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  fetchHomepageStats();
});

async function fetchHomepageStats() {
  try {
    const [
      { data: catalogData }
    ] = await Promise.all([
      supabase.from('product_catalog').select('*').eq('featured', true).limit(6)
    ]);

    // Render Featured Products
    renderFeaturedProducts(catalogData);

  } catch (error) {
    console.error("Error fetching homepage stats:", error);
  }
}

function animateCounter(id, target, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  
  if (target === 0) {
    el.textContent = '0' + suffix;
    return;
  }

  const duration = 1500;
  const stepTime = Math.abs(Math.floor(duration / target));
  let current = 0;
  
  const timer = setInterval(() => {
    current += Math.ceil(target / 20); // increment in 20 chunks
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current + suffix;
  }, 50);
}

function renderFeaturedProducts(products) {
  const container = document.getElementById('featured-products-container');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 2rem;">No products currently featured.</div>';
    return;
  }

  const uniqueProducts = [];
  const names = new Set();
  for (let p of products) {
    if (!names.has(p.product_name)) {
      names.add(p.product_name);
      uniqueProducts.push(p);
    }
    // Limit to 8 for horizontal scroll
    if (uniqueProducts.length >= 8) break;
  }

  window.featuredProductsData = uniqueProducts;

  container.innerHTML = uniqueProducts.map((p, index) => {
    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.product_name}" loading="lazy">`
      : `<div class="no-image">No Image</div>`;

    let displayPrice = 'Contact for price';
    if (p.price) {
      const num = parseFloat(p.price.toString().replace(/[^0-9.]/g, ''));
      displayPrice = !isNaN(num) ? '₹' + num.toLocaleString('en-IN') : p.price;
    }

    return `
    <div class="horizontal-scroll-item">
      <div class="overlay-card" onclick="window.openProductModal(${index})">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}" loading="lazy" style="object-fit:cover; width:100%; height:100%; position:absolute;">` : `<div style="background:var(--bg-alt);width:100%;height:100%;position:absolute;"></div>`}
        <div class="overlay-card-content">
          <h3>${p.product_name}</h3>
          <p style="color:rgba(255,255,255,0.7); font-size:0.85rem;">Model: ${p.model_number || 'N/A'}</p>
          <p style="color:var(--accent-color); font-weight:700; font-size:1.25rem; margin-top:0.5rem; text-shadow:0 1px 5px rgba(0,0,0,0.8);">${displayPrice}</p>
        </div>
      </div>
    </div>
  `}).join('');
}

window.currentProductIndex = 0;

window.openProductModal = function(index) {
  window.currentProductIndex = index;
  const p = window.featuredProductsData[index];
  if (!p) return;

  const modalImg = document.getElementById('prod-modal-img');
  const modalTitle = document.getElementById('prod-modal-title');
  const modalBrand = document.getElementById('prod-modal-brand');
  const modalModel = document.getElementById('prod-modal-model');
  const modalPrice = document.getElementById('prod-modal-price');
  const modalCategory = document.getElementById('prod-modal-category');
  const modalDesc = document.getElementById('prod-modal-desc');
  const modalSpecs = document.getElementById('prod-modal-specs');
  const modalSpecsContainer = document.getElementById('prod-modal-specs-container');

  if (modalImg && modalTitle) {
    if (p.image_url) {
      modalImg.src = p.image_url;
      modalImg.style.display = 'block';
    } else {
      modalImg.style.display = 'none';
    }

    modalTitle.textContent = p.product_name;
    modalBrand.textContent = p.brand || '-';
    modalModel.textContent = p.model_number || '-';
    
    let modalDisplayPrice = 'Contact for price';
    if (p.price) {
      const num = parseFloat(p.price.toString().replace(/[^0-9.]/g, ''));
      modalDisplayPrice = !isNaN(num) ? '₹' + num.toLocaleString('en-IN') : p.price;
    }
    modalPrice.textContent = modalDisplayPrice;
    modalCategory.textContent = p.category || '-';
    
    const descriptionText = p.full_description || p.short_description || p.description || 'No description available.';
    modalDesc.innerHTML = descriptionText.replace(/\n/g, '<br>');
    
    if (p.specifications) {
      modalSpecs.innerHTML = p.specifications.replace(/\n/g, '<br>');
      modalSpecsContainer.style.display = 'block';
    } else {
      modalSpecsContainer.style.display = 'none';
    }

    if (typeof window.openModal === 'function') {
      const modal = document.getElementById('product-modal');
      if (modal && !modal.classList.contains('active')) {
        window.openModal('product-modal');
      }
    }
  }
};

window.navigateProduct = function(direction) {
  if (!window.featuredProductsData || window.featuredProductsData.length === 0) return;
  let newIndex = window.currentProductIndex + direction;
  
  if (newIndex < 0) {
    newIndex = window.featuredProductsData.length - 1;
  } else if (newIndex >= window.featuredProductsData.length) {
    newIndex = 0;
  }
  
  window.openProductModal(newIndex);
};

// Dragging & Auto-scroll for featured products container
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('featured-products-container');
  if (!container) return;

  let isDown = false;
  let startX;
  let scrollLeft;
  let isAutoScrolling = true;
  let scrollSpeed = 1;

  container.addEventListener('mousedown', (e) => {
    isDown = true;
    isAutoScrolling = false;
    container.style.cursor = 'grabbing';
    container.style.scrollBehavior = 'auto'; // Disable smooth scroll while dragging
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  container.addEventListener('mouseleave', () => {
    isDown = false;
    container.style.cursor = 'grab';
    isAutoScrolling = true;
    container.style.scrollBehavior = 'smooth';
  });

  container.addEventListener('mouseup', () => {
    isDown = false;
    container.style.cursor = 'grab';
    container.style.scrollBehavior = 'smooth';
    setTimeout(() => isAutoScrolling = true, 2000); // Resume auto scroll after 2s
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 2; // Scroll fast
    container.scrollLeft = scrollLeft - walk;
  });

  // Auto-scroll loop
  function autoScroll() {
    if (isAutoScrolling && container && window.featuredProductsData && window.featuredProductsData.length > 0) {
      container.style.scrollBehavior = 'auto';
      container.scrollLeft += scrollSpeed;
      if (container.scrollLeft >= container.scrollWidth - container.clientWidth - 1) {
        scrollSpeed = -1; // Reverse
      } else if (container.scrollLeft <= 0) {
        scrollSpeed = 1;
      }
    }
    requestAnimationFrame(autoScroll);
  }
  
  // Start auto scroll
  requestAnimationFrame(autoScroll);
});
