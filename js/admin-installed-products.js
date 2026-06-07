/**
 * admin-installed-products.js
 * Logic for managing customer assigned products.
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

// ==========================================
// STATE
// ==========================================
let installedProducts = [];
let customersList = [];
let catalogList = [];
let installedSearchTerm = '';
let installedFilter = 'all';
let installedSearchTimeout = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const tbody = document.getElementById('installed-tbody');
const searchInput = document.getElementById('installed-search');
const filterSelect = document.getElementById('installed-filter');
const btnAssignProduct = document.getElementById('btn-assign-product');
const btnSaveAssignment = document.getElementById('btn-save-assignment');
const assignForm = document.getElementById('assign-form');

// Dropdowns
const customerSelect = document.getElementById('assign_customer_id');
const catalogSelect = document.getElementById('assign_catalog_id');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) return; // Abort if not admin

  fetchInstalledProducts();
  loadDropdownData();

  searchInput.addEventListener('input', handleInstalledSearch);
  filterSelect.addEventListener('change', (e) => {
    installedFilter = e.target.value;
    renderInstalledTable(); // Local filter
  });

  btnAssignProduct.addEventListener('click', openAssignModal);
  btnSaveAssignment.addEventListener('click', handleSaveAssignment);
  catalogSelect.addEventListener('change', handleCatalogSelect);
});

// ==========================================
// DATA FETCHING
// ==========================================

async function loadDropdownData() {
  try {
    // Customers
    const { data: cData, error: cErr } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'customer')
      .order('name');
    if (!cErr) customersList = cData;

    // Catalog
    const { data: pData, error: pErr } = await supabase
      .from('product_catalog')
      .select('*')
      .order('product_name');
    if (!pErr) catalogList = pData;
  } catch (error) {
    console.error("Failed to load dropdown data", error);
  }
}

function handleInstalledSearch(e) {
  installedSearchTerm = e.target.value.toLowerCase().trim();
  if (installedSearchTimeout) clearTimeout(installedSearchTimeout);
  installedSearchTimeout = setTimeout(() => {
    renderInstalledTable();
  }, 300);
}

async function fetchInstalledProducts() {
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading installed products...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`*, profiles(name)`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    installedProducts = data;
    renderInstalledTable();
  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error loading installed products: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load data.</td></tr>';
  }
}

// ==========================================
// RENDERING
// ==========================================

function renderInstalledTable() {
  const today = new Date().toISOString().split('T')[0];

  let filtered = installedProducts.filter(p => {
    // 1. Search term
    if (installedSearchTerm) {
      const matchName = p.product_name?.toLowerCase().includes(installedSearchTerm);
      const matchBrand = p.brand?.toLowerCase().includes(installedSearchTerm);
      const matchCustomer = p.profiles?.name?.toLowerCase().includes(installedSearchTerm);
      if (!matchName && !matchBrand && !matchCustomer) return false;
    }

    // 2. Filter Status
    if (installedFilter === 'amc_active' && p.amc_status !== 'Active') return false;
    if (installedFilter === 'amc_inactive' && p.amc_status === 'Active') return false;
    
    if (installedFilter === 'warranty_active') {
      if (!p.warranty_expiry || p.warranty_expiry < today) return false;
    }
    if (installedFilter === 'warranty_expired') {
      if (!p.warranty_expiry || p.warranty_expiry >= today) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">No assigned products found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isWarrantyActive = p.warranty_expiry && p.warranty_expiry >= today;
    
    return `
    <tr>
      <td style="font-weight: 500;">${p.profiles?.name || 'Unknown'}</td>
      <td style="color: var(--primary-color);">${p.product_name}</td>
      <td style="color: var(--text-muted);">${p.brand || '-'}</td>
      <td style="color: var(--text-muted);">${p.model_number || '-'}</td>
      <td style="text-align: center;">${p.quantity}</td>
      <td style="color: var(--text-muted);">${p.installation_date || '-'}</td>
      <td>
        <span class="status-badge" style="${isWarrantyActive ? 'background:rgba(34,197,94,0.1); color:#86efac;' : 'background:rgba(239,68,68,0.1); color:#fca5a5;'} border:none;">
          ${p.warranty_expiry || 'N/A'}
        </span>
      </td>
      <td>
        <span class="status-badge ${p.amc_status === 'Active' ? 'status-resolved' : 'status-pending'}">
          ${p.amc_status || 'Inactive'}
        </span>
      </td>
      <td>
        <div class="actions-cell" style="justify-content:center;">
          <button class="action-btn" title="Edit" onclick="window.openAssignEditModal(${p.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="action-btn delete" title="Delete" onclick="window.openAssignDeleteModal(${p.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

// ==========================================
// MODAL LOGIC
// ==========================================

function populateDropdowns() {
  customerSelect.innerHTML = `<option value="" disabled selected>-- Select Customer --</option>` + 
    customersList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
  catalogSelect.innerHTML = `<option value="">-- Custom Manual Entry --</option>` + 
    catalogList.map(c => `<option value="${c.id}">${c.product_name}</option>`).join('');
}

function handleCatalogSelect(e) {
  const catId = e.target.value;
  if (!catId) return; // Custom
  
  const item = catalogList.find(c => c.id == catId);
  if (item) {
    document.getElementById('assign_product_name').value = item.product_name || '';
    document.getElementById('assign_brand').value = item.brand || '';
    document.getElementById('assign_model_number').value = item.model_number || '';
    document.getElementById('assign_image_url').value = item.image_url || '';
  }
}

function openAssignModal() {
  assignForm.reset();
  document.getElementById('assign_id').value = '';
  document.getElementById('assign_image_url').value = '';
  document.getElementById('assign-modal-title').textContent = 'Assign Product to Customer';
  populateDropdowns();
  
  // Set defaults
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('assign_install_date').value = today;
  document.getElementById('assign_warranty_start').value = today;
  
  // 1 year default
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  document.getElementById('assign_warranty_expiry').value = nextYear.toISOString().split('T')[0];

  window.openModal('assign-modal');
}

window.openAssignEditModal = function(id) {
  const p = installedProducts.find(x => x.id === id);
  if (!p) return;

  assignForm.reset();
  populateDropdowns();
  document.getElementById('assign-modal-title').textContent = 'Edit Assigned Product';
  
  document.getElementById('assign_id').value = p.id;
  document.getElementById('assign_customer_id').value = p.customer_id;
  document.getElementById('assign_catalog_id').value = ''; // Don't bind back explicitly unless we added a catalog_id column (Future proofing requested)
  
  document.getElementById('assign_product_name').value = p.product_name || '';
  document.getElementById('assign_brand').value = p.brand || '';
  document.getElementById('assign_model_number').value = p.model_number || '';
  document.getElementById('assign_quantity').value = p.quantity || 1;
  document.getElementById('assign_image_url').value = p.product_image_url || '';
  
  document.getElementById('assign_install_date').value = p.installation_date || '';
  document.getElementById('assign_warranty_start').value = p.warranty_start || '';
  document.getElementById('assign_warranty_expiry').value = p.warranty_expiry || '';
  document.getElementById('assign_amc_status').value = p.amc_status || 'Inactive';
  document.getElementById('assign_amc_start').value = p.amc_start || '';
  document.getElementById('assign_amc_expiry').value = p.amc_expiry || '';
  document.getElementById('assign_notes').value = p.notes || '';

  window.openModal('assign-modal');
};

async function handleSaveAssignment(e) {
  e.preventDefault();
  
  const id = document.getElementById('assign_id').value;
  const customerId = document.getElementById('assign_customer_id').value;
  const productName = document.getElementById('assign_product_name').value.trim();
  
  if (!customerId || !productName) {
    showToast('Customer and Product Name are required.', 'error');
    return;
  }

  btnSaveAssignment.disabled = true;
  btnSaveAssignment.textContent = 'Saving...';

  try {
    const payload = {
      customer_id: customerId,
      product_name: productName,
      brand: document.getElementById('assign_brand').value.trim() || null,
      model_number: document.getElementById('assign_model_number').value.trim() || null,
      quantity: parseInt(document.getElementById('assign_quantity').value) || 1,
      product_image_url: document.getElementById('assign_image_url').value || null,
      installation_date: document.getElementById('assign_install_date').value || null,
      warranty_start: document.getElementById('assign_warranty_start').value || null,
      warranty_expiry: document.getElementById('assign_warranty_expiry').value || null,
      amc_status: document.getElementById('assign_amc_status').value,
      amc_start: document.getElementById('assign_amc_start').value || null,
      amc_expiry: document.getElementById('assign_amc_expiry').value || null,
      notes: document.getElementById('assign_notes').value.trim() || null,
      /* Future catalog_id support: if schema supported it, we would add: catalog_id: document.getElementById('assign_catalog_id').value || null */
    };

    if (id) {
      const { error } = await supabase.from('products').update(payload).eq('id', id);
      if (error) throw error;
      showToast('Assignment updated successfully.', 'success');
      
      // Notification
      if (window.notificationService) {
        window.notificationService.createNotification(
          customerId,
          'AMC Contract Updated',
          'Your product AMC details have been updated.',
          'amc',
          '/dashboard/products.html'
        );
      }
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) throw error;
      showToast('Product assigned successfully.', 'success');
      
      // Notification
      if (window.notificationService) {
        window.notificationService.createNotification(
          customerId,
          'New Product Assigned',
          `A new product (${productName}) has been added to your account.`,
          'product',
          '/dashboard/products.html'
        );
      }
    }

    window.closeModal('assign-modal');
    fetchInstalledProducts(); // Refresh list

  } catch (error) {
    console.error('Assign error:', error);
    showToast(`Error saving assignment: ${error.message}`, 'error');
  } finally {
    btnSaveAssignment.disabled = false;
    btnSaveAssignment.textContent = 'Save Assignment';
  }
}

// ==========================================
// DELETE ASSIGNMENT
// ==========================================

window.openAssignDeleteModal = function(id) {
  // Reuse the delete modal from admin-products by changing targets
  document.getElementById('delete_target_id').value = id;
  document.getElementById('delete_target_type').value = 'assigned'; 
  window.openModal('delete-modal');
};

// Hook into existing confirm delete button if it's shared, or we can just override it here safely
document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
  const targetType = document.getElementById('delete_target_type').value;
  if (targetType !== 'assigned') return; // Let admin-products handle catalog deletion

  const id = document.getElementById('delete_target_id').value;
  const btn = document.getElementById('btn-confirm-delete');
  
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    
    showToast('Assignment removed successfully.', 'success');
    window.closeModal('delete-modal');
    fetchInstalledProducts();

  } catch (error) {
    showToast(`Error deleting assignment: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete Record';
  }
});
