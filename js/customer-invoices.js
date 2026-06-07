/**
 * customer-invoices.js
 * Logic for Customer Invoice Portal
 */

import { supabase } from './supabase.js';
import { loadCurrentUser } from './user-context.js';
import { showToast } from './toast.js';

let invoices = [];
let currentUser = null;

const tbody = document.getElementById('invoices-tbody');
const detailsBody = document.getElementById('details-body');

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await loadCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;
  fetchInvoices();
});

async function fetchInvoices() {
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">Fetching your financial history...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('customer_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    invoices = data;
    renderTable();
  } catch (err) {
    console.error('Error fetching invoices (Exact Error):', err);
    showToast(`Failed to load invoices: ${err.message}`, 'error');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:3rem; color:#fca5a5;">Error: We could not load your data at this time.</td></tr>`;
  }
}

function renderTable() {
  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:4rem; color:var(--text-muted);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1rem; opacity:0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      <div>You have no invoices. Your account is clear!</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const amount = parseFloat(inv.amount || 0).toLocaleString('en-IN');
    const date = new Date(inv.invoice_date).toLocaleDateString('en-IN');
    const isPaid = inv.status === 'Paid';
    
    const badge = `<span style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background: ${isPaid ? 'rgba(34,197,94,0.1); color:#86efac;' : 'rgba(239,68,68,0.1); color:#fca5a5;'}">${inv.status}</span>`;
    
    let pdfBtn = inv.pdf_url 
      ? `<a href="${inv.pdf_url}" target="_blank" class="action-btn" title="Download PDF" style="display:inline-flex; align-items:center; justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
         </a>`
      : '';

    return `
    <tr>
      <td style="font-weight:600; color:var(--primary-color);">${inv.invoice_number}</td>
      <td>${date}</td>
      <td style="font-weight:bold;">₹${amount}</td>
      <td>${badge}</td>
      <td>
        <div class="actions-cell" style="justify-content:center;">
          ${pdfBtn}
          <button class="action-btn" title="View Details" onclick="window.openDetailsModal('${inv.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

window.openDetailsModal = function(id) {
  const inv = invoices.find(x => String(x.id) === String(id));
  if (!inv) return;

  const items = inv.invoice_items || [];
  
  let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem;">
      <div>
        <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Invoice Number</div>
        <div style="font-size:1.2rem; font-weight:bold; color:var(--primary-color);">${inv.invoice_number}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Date</div>
        <div style="font-weight:500;">${new Date(inv.invoice_date).toLocaleDateString('en-IN')}</div>
      </div>
    </div>
    
    <table class="data-table" style="margin-bottom:1.5rem;">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  items.forEach(item => {
    html += `
      <tr>
        <td>${item.item_name}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">₹${parseFloat(item.unit_price).toLocaleString('en-IN')}</td>
        <td style="text-align:right;">₹${parseFloat(item.total_price).toLocaleString('en-IN')}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
    
    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
      <div>
        <span style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background: ${inv.status === 'Paid' ? 'rgba(34,197,94,0.1); color:#86efac;' : 'rgba(239,68,68,0.1); color:#fca5a5;'}">${inv.status}</span>
      </div>
      <div style="font-size:1.25rem; font-weight:bold;">Total: ₹${parseFloat(inv.amount).toLocaleString('en-IN')}</div>
    </div>
  `;
  
  if (inv.notes) {
    html += `
      <div style="margin-top:1.5rem; font-size:0.85rem;">
        <strong>Notes:</strong>
        <p style="color:var(--text-muted); margin:0.25rem 0 0 0; white-space:pre-wrap;">${inv.notes}</p>
      </div>
    `;
  }

  detailsBody.innerHTML = html;
  window.openModal('details-modal');
};
