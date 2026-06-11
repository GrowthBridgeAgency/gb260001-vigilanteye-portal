/**
 * products.js
 * Logic for dynamic data on the public Products page.
 */

import { supabase } from './supabase.js';

let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  fetchProductsData();
});

async function fetchProductsData() {
  try {
    const { data: products, error } = await supabase
      .from('product_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allProducts = products || [];
    renderProductsGrid(allProducts);
    setupFilters();
    
  } catch (error) {
    console.error("Error fetching products data:", error);
    const container = document.getElementById('products-grid-container');
    if (container) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger-color); padding: 4rem;">Failed to load products. Please try again later.</div>`;
    }
  }
}

function setupFilters() {
  const filterButtons = document.querySelectorAll('.filter-list button');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remove active class from all buttons
      filterButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      
      const category = btn.getAttribute('data-filter');
      if (category === 'all') {
        renderProductsGrid(allProducts);
      } else {
        const filtered = allProducts.filter(p => {
          return p.category && p.category.toLowerCase().includes(category.toLowerCase());
        });
        renderProductsGrid(filtered);
      }
    });
  });
}

function renderProductsGrid(products) {
  const container = document.getElementById('products-grid-container');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No Products Found</h3>
        <p style="color: var(--text-muted); margin: 0;">We couldn't find any products in this category.</p>
      </div>
    `;
    return;
  }

  // Update global array for modal navigation
  window.productsData = products;

  container.innerHTML = products.map((p, index) => {
    let displayPrice = 'Contact for price';
    if (p.price) {
      const num = parseFloat(p.price.toString().replace(/[^0-9.]/g, ''));
      displayPrice = !isNaN(num) ? '₹' + num.toLocaleString('en-IN') : p.price;
    }

    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.product_name}" loading="lazy" style="object-fit:cover; width:100%; height:100%; position:absolute;">`
      : `<div style="background:rgba(255,255,255,0.05);width:100%;height:100%;position:absolute;display:flex;align-items:center;justify-content:center;color:var(--text-muted);">No Image</div>`;

    return `
      <div class="product-card scroll-animate scroll-fade-up hover-tilt" onclick="window.openProductModal(${index})" style="cursor: pointer; transition-delay: ${(index % 6) * 100}ms;">
        <div class="product-image-container">
          ${imgHtml}
        </div>
        <div class="product-info">
          <span class="product-brand">${p.brand || p.category || 'Security Device'}</span>
          <h3 class="product-title">${p.product_name}</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${p.short_description || p.description || 'Professional security infrastructure.'}
          </p>
          <div class="product-price">${displayPrice}</div>
          <button class="btn btn-outline" style="width: 100%; padding: 0.75rem;">View Details</button>
        </div>
      </div>
    `;
  }).join('');
}

// Modal Logic
window.currentProductIndex = 0;

window.openProductModal = function(index) {
  window.currentProductIndex = index;
  const p = window.productsData[index];
  if (!p) return;

  const modalImg = document.getElementById('modal-prod-img');
  const modalTitle = document.getElementById('modal-prod-title');
  const modalBrand = document.getElementById('modal-prod-brand');
  const modalModel = document.getElementById('modal-prod-model');
  const modalPrice = document.getElementById('modal-prod-price');
  const modalDesc = document.getElementById('modal-prod-desc');
  const modalSpecs = document.getElementById('modal-prod-specs');
  const modalSpecsContainer = document.getElementById('modal-prod-specs-container');
  const badgeContainer = document.getElementById('modal-prod-badge-container');

  if (modalImg && modalTitle) {
    modalImg.src = p.image_url || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?q=80&w=600&auto=format&fit=crop';
    
    // Add white background for product images to match cards
    // Styling is handled by CSS class .prod-modal-img-style
    
    modalTitle.textContent = p.product_name;
    modalBrand.textContent = p.brand || p.category || 'Security Device';
    if (modalModel) modalModel.textContent = p.model_number || '-';
    
    let displayPrice = 'Contact for price';
    if (p.price) {
      const num = parseFloat(p.price.toString().replace(/[^0-9.]/g, ''));
      displayPrice = !isNaN(num) ? '₹' + num.toLocaleString('en-IN') : p.price;
    }
    modalPrice.textContent = displayPrice;
    
    const descriptionText = p.full_description || p.short_description || p.description || 'No description available.';
    modalDesc.innerHTML = descriptionText.replace(/\n/g, '<br>');
    
    if (p.specifications && modalSpecs && modalSpecsContainer) {
      modalSpecs.innerHTML = p.specifications.replace(/\n/g, '<br>');
      modalSpecsContainer.style.display = 'block';
    } else if (modalSpecsContainer) {
      modalSpecsContainer.style.display = 'none';
    }
    
    badgeContainer.innerHTML = '';
    
    if (typeof window.openModal === 'function') {
      window.openModal('product-modal');
    } else {
      const modal = document.getElementById('product-modal');
      if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
      }
    }
  }
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300); // match transition duration
  }
};

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    window.closeModal(e.target.id);
  }
});
