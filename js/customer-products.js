/**
 * customer-products.js
 * Logic for the Customer Dashboard Products view.
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isLoggedIn } from './user-context.js';
import { showToast } from './toast.js';

let myProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await loadCurrentUser();
  
  if (!isLoggedIn()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1500);
    return;
  }

  fetchMyProducts(user.id);
});

async function fetchMyProducts(customerId) {
  const grid = document.getElementById('products-grid');
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    myProducts = data;
    renderProducts(grid);
    
  } catch (err) {
    console.error('Fetch error:', err);
    showToast(`Error loading products: ${err.message}`, 'error');
    grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 4rem; text-align: center; color: var(--text-muted);">Failed to load products. Please try again.</div>';
  }
}

function calculateDaysRemaining(expiryDateStr) {
  if (!expiryDateStr) return null;
  const today = new Date();
  today.setHours(0,0,0,0); // normalize
  const expiry = new Date(expiryDateStr);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function renderProducts(grid) {
  if (myProducts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 6rem 2rem; text-align: center; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--border-radius);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--text-muted); margin-bottom:1rem; opacity:0.5;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
        <h3 style="margin-top: 0; color: var(--text-main);">No Products Assigned</h3>
        <p style="color: var(--text-muted); margin-bottom: 0;">You currently have no security hardware registered to your account.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = myProducts.map(p => {
    // Warranty Logic
    const wDays = calculateDaysRemaining(p.warranty_expiry);
    let wBadge = '';
    if (wDays === null) {
      wBadge = `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Warranty: N/A</span>`;
    } else if (wDays >= 0) {
      wBadge = `<span class="badge badge-active">Warranty: ${wDays} Days Left</span>`;
    } else {
      wBadge = `<span class="badge badge-expired">Warranty: Expired</span>`;
    }

    // AMC Logic
    const aDays = calculateDaysRemaining(p.amc_expiry);
    let aBadge = '';
    if (p.amc_status === 'Active' && aDays !== null && aDays >= 0) {
      aBadge = `<span class="badge badge-active">AMC: ${aDays} Days Left</span>`;
    } else if (p.amc_status === 'Active') {
      aBadge = `<span class="badge badge-expired">AMC: Expired</span>`;
    } else {
      aBadge = `<span class="badge badge-expired">AMC: Inactive</span>`;
    }

    return `
      <div class="product-card" onclick="window.viewProductDetails(${p.id})">
        <div class="product-img-box">
          ${p.product_image_url 
            ? `<img src="${p.product_image_url}" alt="${p.product_name}">` 
            : `<span style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.1em;">No Image Available</span>`
          }
        </div>
        <div class="product-content">
          <h3 class="product-title">${p.product_name}</h3>
          <span class="product-brand">${p.brand || 'VigilantEye Solutions'} • ${p.model_number || 'Standard Model'}</span>
          <div style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1rem;">
            Quantity: <strong>${p.quantity}</strong><br>
            Installed: <strong>${p.installation_date || 'Pending'}</strong>
          </div>
          <div class="badge-row">
            ${wBadge}
            ${aBadge}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.viewProductDetails = async function(id) {
  const p = myProducts.find(x => x.id === id);
  if (!p) return;

  const wDays = calculateDaysRemaining(p.warranty_expiry);
  const isWActive = wDays !== null && wDays >= 0;
  
  const aDays = calculateDaysRemaining(p.amc_expiry);
  const isAActive = p.amc_status === 'Active' && aDays !== null && aDays >= 0;

  const body = document.getElementById('view-modal-body');
  body.innerHTML = `
    <div style="display:flex; gap:2rem; flex-wrap:wrap; margin-bottom: 2rem;">
      <div style="width: 150px; height: 150px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: var(--border-radius); display:flex; align-items:center; justify-content:center; overflow:hidden;">
        ${p.product_image_url ? `<img src="${p.product_image_url}" style="width:100%; height:100%; object-fit:contain;">` : 'No Image'}
      </div>
      <div style="flex:1; min-width: 200px;">
        <h3 style="color:var(--text-main); font-size:1.5rem; margin:0 0 0.5rem 0;">${p.product_name}</h3>
        <p style="color:var(--primary-color); margin:0 0 1rem 0; text-transform:uppercase; letter-spacing:0.05em; font-size:0.85rem;">${p.brand || '-'} • ${p.model_number || '-'}</p>
        <p style="margin: 0 0 0.25rem 0;"><strong>Quantity:</strong> ${p.quantity}</p>
        <p style="margin: 0;"><strong>Installed On:</strong> ${p.installation_date || 'Pending'}</p>
      </div>
    </div>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:1.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem;">
      <div>
        <h4 style="color:var(--text-main); margin:0 0 1rem 0;">Warranty Status</h4>
        <p style="margin:0 0 0.5rem 0; display:flex; justify-content:space-between;">
          <span>Start Date:</span> <strong style="color:var(--text-main);">${p.warranty_start || '-'}</strong>
        </p>
        <p style="margin:0 0 0.5rem 0; display:flex; justify-content:space-between;">
          <span>Expiry Date:</span> <strong style="color:var(--text-main);">${p.warranty_expiry || '-'}</strong>
        </p>
        <div style="margin-top:1rem; padding: 0.75rem; background: ${isWActive ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)'}; border-left: 3px solid ${isWActive ? '#22c55e' : '#ef4444'}; border-radius: 4px; color: ${isWActive ? '#86efac' : '#fca5a5'}; font-size: 0.9rem;">
          ${isWActive ? `Warranty is currently active. (${wDays} days remaining)` : 'Warranty has expired.'}
        </div>
      </div>
      
      <div>
        <h4 style="color:var(--text-main); margin:0 0 1rem 0;">Support Contract (AMC)</h4>
        <p style="margin:0 0 0.5rem 0; display:flex; justify-content:space-between;">
          <span>Start Date:</span> <strong style="color:var(--text-main);">${p.amc_start || '-'}</strong>
        </p>
        <p style="margin:0 0 0.5rem 0; display:flex; justify-content:space-between;">
          <span>Expiry Date:</span> <strong style="color:var(--text-main);">${p.amc_expiry || '-'}</strong>
        </p>
        <div style="margin-top:1rem; padding: 0.75rem; background: ${isAActive ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)'}; border-left: 3px solid ${isAActive ? '#22c55e' : '#ef4444'}; border-radius: 4px; color: ${isAActive ? '#86efac' : '#fca5a5'}; font-size: 0.9rem;">
          ${isAActive ? `AMC is currently active. (${aDays} days remaining)` : (p.amc_status === 'Active' ? 'AMC has expired.' : 'No active AMC registered.')}
        </div>
      </div>
    </div>
  `;
  document.getElementById('view-modal').classList.add('active');

  // Fetch Service History for this Product
  try {
    const { data: services, error } = await supabase
      .from('service_history')
      .select('*')
      .eq('product_id', p.id)
      .order('service_date', { ascending: false });

    if (error) throw error;

    let serviceHtml = '';
    if (!services || services.length === 0) {
      serviceHtml = '<div style="color:var(--text-muted); font-size:0.9rem;">No service history logged for this product.</div>';
    } else {
      const latestService = services[0];
      const lastDate = new Date(latestService.service_date).toLocaleDateString('en-IN');
      
      serviceHtml = `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:1rem; border-radius:8px;">
          <div class="grid-3" style="gap:1rem;">
            <div>
              <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Last Service Date</div>
              <div style="font-weight:600; font-size:1.05rem; color:#fff;">${lastDate}</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Most Recent Tech</div>
              <div style="font-weight:600; font-size:1.05rem; color:#fff;">${latestService.technician_name || 'Unknown'}</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Total Visits</div>
              <div style="font-weight:600; font-size:1.05rem; color:var(--primary-color);">${services.length}</div>
            </div>
          </div>
          <div style="margin-top:1rem; text-align:right;">
            <a href="/dashboard/service-history.html" class="btn btn-outline" style="padding:0.25rem 0.75rem; font-size:0.8rem;">View Full Logbook</a>
          </div>
        </div>
      `;
    }

    body.innerHTML += `
      <div style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem;">
        <h4 style="color:var(--text-main); margin:0 0 1rem 0;">Maintenance & Service History</h4>
        ${serviceHtml}
      </div>
    `;

  } catch (err) {
    console.error('Error loading service history for product:', err);
  }
};
