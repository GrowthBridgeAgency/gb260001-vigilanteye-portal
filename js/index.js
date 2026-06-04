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
    if (uniqueProducts.length >= 6) break;
  }

  window.featuredProductsData = uniqueProducts;

  container.innerHTML = uniqueProducts.map((p, index) => {
    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.product_name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`
      : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-muted);">No Image</div>`;

    let displayPrice = 'Contact for price';
    if (p.price) {
      const num = parseFloat(p.price.toString().replace(/[^0-9.]/g, ''));
      displayPrice = !isNaN(num) ? '₹' + num.toLocaleString('en-IN') : p.price;
    }

    return `
    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.3s ease;" onclick="window.openProductModal(${index})" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
      <div style="height: 250px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
        ${imgHtml}
      </div>
      <div style="padding: 2rem; flex: 1; display: flex; flex-direction: column;">
        <div><span style="display: inline-block; padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.1); color: var(--text-main); border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 1rem;">Featured</span></div>
        <h3 style="margin: 0.5rem 0;">${p.product_name}</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 0.25rem;">Model: ${p.model_number || 'N/A'}</p>
        <p style="color: var(--primary-color); font-weight: bold; font-size: 1.1rem; margin-bottom: 1rem;">${displayPrice}</p>
      </div>
    </div>
  `}).join('');
}

window.openProductModal = function(index) {
  const p = window.featuredProductsData[index];
  if (!p) return;

  const modalImg = document.getElementById('prod-modal-img');
  const modalTitle = document.getElementById('prod-modal-title');
  const modalBrand = document.getElementById('prod-modal-brand');
  const modalModel = document.getElementById('prod-modal-model');
  const modalPrice = document.getElementById('prod-modal-price');
  const modalCategory = document.getElementById('prod-modal-category');
  const modalShortDesc = document.getElementById('prod-modal-short-desc');
  const modalFullDesc = document.getElementById('prod-modal-full-desc');
  const modalSpecs = document.getElementById('prod-modal-specs');

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
    
    modalShortDesc.textContent = p.short_description || '';
    modalShortDesc.style.display = p.short_description ? 'block' : 'none';

    modalFullDesc.innerHTML = p.full_description ? p.full_description.replace(/\\n/g, '<br>') : 'No detailed description available.';
    
    if (p.specifications) {
      modalSpecs.innerHTML = p.specifications.replace(/\\n/g, '<br>');
      document.getElementById('prod-modal-specs-container').style.display = 'block';
    } else {
      document.getElementById('prod-modal-specs-container').style.display = 'none';
    }

    if (typeof window.openModal === 'function') {
      window.openModal('product-modal');
    }
  }
};
