/**
 * admin-products.js
 * Core logic for the Admin Product Catalog module.
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let products = [];
let currentSearchTerm = '';
let currentFilter = 'all';
let searchTimeout = null;
const STORAGE_BUCKET = 'products';
const STORAGE_PATH = 'catalog';

// ==========================================
// DOM ELEMENTS
// ==========================================
const tbody = document.getElementById('products-tbody');
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('featured-filter');
const btnAddProduct = document.getElementById('btn-add-product');
const btnSaveProduct = document.getElementById('btn-save-product');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const productForm = document.getElementById('product-form');
const imageInput = document.getElementById('product_image');
const imagePreviewImg = document.getElementById('image-preview-img');
const imagePreviewText = document.getElementById('image-preview-text');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  const { user, profile } = await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard/dashboard.html';
    }, 1500);
    return;
  }

  // 2. Initial Fetch
  fetchProducts();

  // 3. Event Listeners
  searchInput.addEventListener('input', handleSearchDebounce);
  filterSelect.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    fetchProducts();
  });

  btnAddProduct.addEventListener('click', openAddModal);
  btnSaveProduct.addEventListener('click', handleSaveProduct);
  btnConfirmDelete.addEventListener('click', executeDelete);
  
  // Image Preview Logic
  imageInput.addEventListener('change', handleImagePreview);
});

// ==========================================
// FETCH & RENDER LOGIC
// ==========================================

function handleSearchDebounce(e) {
  currentSearchTerm = e.target.value.trim();
  if (searchTimeout) clearTimeout(searchTimeout);
  
  // 300ms Debounce
  searchTimeout = setTimeout(() => {
    fetchProducts();
  }, 300);
}

async function fetchProducts() {
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading products...</td></tr>';
  
  try {
    let query = supabase
      .from('product_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (currentSearchTerm) {
      query = query.or(`product_name.ilike.%${currentSearchTerm}%,brand.ilike.%${currentSearchTerm}%,category.ilike.%${currentSearchTerm}%`);
    }

    if (currentFilter === 'featured') {
      query = query.eq('featured', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    products = data;
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error loading products: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load products.</td></tr>';
  }
}

function renderTable() {
  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 4rem 1rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--text-muted); margin-bottom:1rem; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <p style="color: var(--text-muted); font-size: 1.1rem; margin:0;">No products found.</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        ${p.image_url 
          ? `<img src="${p.image_url}" class="table-img" alt="${p.product_name}">` 
          : `<div class="table-img" style="display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.7rem;">No Img</div>`}
      </td>
      <td style="font-weight: 500;">${p.product_name}</td>
      <td style="color: var(--text-muted);">${p.category || '-'}</td>
      <td style="color: var(--text-muted);">${p.brand || '-'}</td>
      <td style="color: var(--text-muted);">${p.model_number || '-'}</td>
      <td>
        <span class="status-badge ${p.featured ? 'status-resolved' : ''}" style="${!p.featured ? 'background:rgba(255,255,255,0.05); color:var(--text-muted); border-color:transparent;' : ''}">
          ${p.featured ? 'Featured' : 'Standard'}
        </span>
      </td>
      <td>
        <div class="actions-cell">
          <button class="action-btn" title="View" onclick="window.viewProduct(${p.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="action-btn" title="Edit" onclick="window.openEditModal(${p.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="action-btn delete" title="Delete" onclick="window.openDeleteModal(${p.id}, '${p.image_url || ''}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==========================================
// MODAL & FORM LOGIC
// ==========================================

function handleImagePreview(e) {
  const file = e.target.files[0];
  if (file) {
    imagePreviewImg.src = URL.createObjectURL(file);
    imagePreviewImg.style.display = 'block';
    imagePreviewText.style.display = 'none';
  } else {
    resetImagePreview();
  }
}

function resetImagePreview(url = null) {
  if (url) {
    imagePreviewImg.src = url;
    imagePreviewImg.style.display = 'block';
    imagePreviewText.style.display = 'none';
  } else {
    imagePreviewImg.src = '';
    imagePreviewImg.style.display = 'none';
    imagePreviewText.style.display = 'block';
  }
}

function openAddModal() {
  productForm.reset();
  document.getElementById('product_id').value = '';
  document.getElementById('existing_image_url').value = '';
  document.getElementById('modal-title').textContent = 'Add New Product';
  resetImagePreview();
  window.openModal('product-modal');
}

// Expose to global scope for inline onclick handlers in the table
window.openEditModal = function(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  productForm.reset();
  document.getElementById('modal-title').textContent = 'Edit Product';
  
  // Populate fields
  document.getElementById('product_id').value = product.id;
  document.getElementById('product_name').value = product.product_name || '';
  document.getElementById('category').value = product.category || '';
  document.getElementById('brand').value = product.brand || '';
  document.getElementById('model_number').value = product.model_number || '';
  document.getElementById('price').value = product.price || '';
  document.getElementById('short_description').value = product.short_description || '';
  document.getElementById('full_description').value = product.full_description || '';
  document.getElementById('specifications').value = product.specifications || '';
  document.getElementById('featured').checked = !!product.featured;
  document.getElementById('existing_image_url').value = product.image_url || '';
  
  resetImagePreview(product.image_url);
  window.openModal('product-modal');
};

window.viewProduct = function(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;

  const body = document.getElementById('view-modal-body');
  body.innerHTML = `
    <div style="display:flex; gap:2rem; flex-wrap:wrap;">
      ${p.image_url ? `<img src="${p.image_url}" style="width: 200px; height: 200px; object-fit: contain; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); border-radius: 4px;">` : `<div style="width: 200px; height: 200px; display:flex; align-items:center; justify-content:center; border: 1px dashed rgba(255,255,255,0.2);">No Image</div>`}
      <div style="flex:1; min-width: 250px;">
        <h3 style="color:var(--text-main); margin-top:0;">${p.product_name}</h3>
        <p><strong>Brand:</strong> ${p.brand || 'N/A'}</p>
        <p><strong>Model:</strong> ${p.model_number || 'N/A'}</p>
        <p><strong>Category:</strong> ${p.category || 'N/A'}</p>
        <p><strong>Price:</strong> ${p.price || 'N/A'}</p>
        <p><strong>Status:</strong> ${p.featured ? 'Featured' : 'Standard'}</p>
      </div>
    </div>
    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
      <h4 style="color:var(--text-main); margin-bottom:0.5rem;">Short Description</h4>
      <p>${p.short_description || 'N/A'}</p>
      <h4 style="color:var(--text-main); margin-top:1.5rem; margin-bottom:0.5rem;">Full Description</h4>
      <p style="white-space: pre-wrap;">${p.full_description || 'N/A'}</p>
      <h4 style="color:var(--text-main); margin-top:1.5rem; margin-bottom:0.5rem;">Specifications</h4>
      <p style="white-space: pre-wrap;">${p.specifications || 'N/A'}</p>
    </div>
  `;
  window.openModal('view-modal');
};

// ==========================================
// CRUD OPERATIONS
// ==========================================

async function uploadImage(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${STORAGE_PATH}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file);

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return publicUrl;
}

async function handleSaveProduct(e) {
  e.preventDefault();
  
  const id = document.getElementById('product_id').value;
  const productName = document.getElementById('product_name').value.trim();
  
  if (!productName) {
    showToast('Product Name is required.', 'error');
    return;
  }

  btnSaveProduct.disabled = true;
  btnSaveProduct.textContent = 'Saving...';

  try {
    const file = imageInput.files[0];
    let imageUrl = document.getElementById('existing_image_url').value;

    if (file) {
      imageUrl = await uploadImage(file);
    }

    const payload = {
      product_name: productName,
      category: document.getElementById('category').value.trim() || null,
      brand: document.getElementById('brand').value.trim() || null,
      model_number: document.getElementById('model_number').value.trim() || null,
      price: document.getElementById('price').value.trim() || null,
      short_description: document.getElementById('short_description').value.trim() || null,
      full_description: document.getElementById('full_description').value.trim() || null,
      specifications: document.getElementById('specifications').value.trim() || null,
      featured: document.getElementById('featured').checked,
      image_url: imageUrl || null
    };

    if (id) {
      // Update
      const { error } = await supabase
        .from('product_catalog')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      showToast('Product updated successfully!', 'success');
    } else {
      // Insert
      const { error } = await supabase
        .from('product_catalog')
        .insert([payload]);
      if (error) throw error;
      showToast('Product added successfully!', 'success');
    }

    window.closeModal('product-modal');
    fetchProducts(); // Refresh list

  } catch (error) {
    console.error('Save error:', error);
    showToast(`Error saving product: ${error.message}`, 'error');
  } finally {
    btnSaveProduct.disabled = false;
    btnSaveProduct.textContent = 'Save Product';
  }
}

// ==========================================
// DELETE LOGIC
// ==========================================

window.openDeleteModal = function(id, imageUrl) {
  document.getElementById('delete_product_id').value = id;
  document.getElementById('delete_image_url').value = imageUrl;
  window.openModal('delete-modal');
};

async function executeDelete() {
  const id = document.getElementById('delete_product_id').value;
  const imageUrl = document.getElementById('delete_image_url').value;
  
  btnConfirmDelete.disabled = true;
  btnConfirmDelete.textContent = 'Deleting...';

  try {
    // 1. Delete from table
    const { error: dbError } = await supabase
      .from('product_catalog')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    // 2. Attempt to delete image from bucket if it exists
    if (imageUrl && imageUrl.includes(`${STORAGE_BUCKET}/${STORAGE_PATH}`)) {
      // Extract the filename from the URL
      const pathSegments = imageUrl.split('/');
      const fileName = pathSegments[pathSegments.length - 1];
      
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([`${STORAGE_PATH}/${fileName}`]);
        
      if (storageError) {
        console.warn('Could not delete image from bucket:', storageError);
        // We don't throw here to avoid preventing the UI success state since the DB row is gone
      }
    }

    showToast('Product deleted successfully.', 'success');
    window.closeModal('delete-modal');
    fetchProducts(); // Refresh list

  } catch (error) {
    console.error('Delete error:', error);
    showToast(`Error deleting product: ${error.message}`, 'error');
  } finally {
    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = 'Delete Product';
  }
}
