/**
 * admin-invoices.js
 * Logic for Invoice Management Module
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let invoices = [];
let customers = [];
let searchTerm = '';
let filterStatus = 'All';

// DOM Elements
const tbody = document.getElementById('invoices-tbody');
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-status');

// Metrics
const elTotal = document.getElementById('metric-total');
const elRevenue = document.getElementById('metric-revenue');
const elPaid = document.getElementById('metric-paid');
const elUnpaid = document.getElementById('metric-unpaid');

// Modal Elements
const createForm = document.getElementById('create-form');
const btnSave = document.getElementById('btn-save-invoice');
const customerSelect = document.getElementById('invoice_customer');
const itemsContainer = document.getElementById('invoice-items-container');
const grandTotalEl = document.getElementById('invoice_grand_total');
const detailsBody = document.getElementById('details-body');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    setTimeout(() => window.location.href = basePath + '/dashboard/dashboard.html', 1500);
    return;
  }

  // Set default date to today
  document.getElementById('invoice_date').value = new Date().toISOString().split('T')[0];

  fetchCustomers();
  fetchInvoices();

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTable();
  });
  
  filterSelect.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderTable();
  });

  btnSave.addEventListener('click', handleSave);
});

// ==========================================
// DATA FETCHING & PROCESSING
// ==========================================

async function fetchCustomers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'customer')
      .order('name');
    if (error) throw error;
    
    customers = data;
    customerSelect.innerHTML = '<option value="">Select Customer...</option>' + 
      customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (error) {
    console.error('Error fetching customers:', error);
  }
}

async function fetchInvoices() {
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading invoices...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        profiles:customer_id (name, email, phone),
        invoice_items (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    invoices = data;
    updateMetrics();
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load data.</td></tr>';
  }
}

function updateMetrics() {
  let paid = 0;
  let unpaid = 0;
  let revenue = 0;

  invoices.forEach(inv => {
    const amt = parseFloat(inv.amount || 0);
    if (inv.status === 'Paid') {
      paid++;
      revenue += amt;
    } else {
      unpaid++;
    }
  });

  elTotal.textContent = invoices.length;
  elPaid.textContent = paid;
  elUnpaid.textContent = unpaid;
  elRevenue.textContent = `₹${revenue.toLocaleString('en-IN')}`;
}

function renderTable() {
  let filtered = invoices.filter(inv => {
    const matchSearch = !searchTerm || 
      inv.invoice_number?.toLowerCase().includes(searchTerm) || 
      inv.profiles?.name?.toLowerCase().includes(searchTerm);
      
    const matchStatus = filterStatus === 'All' || inv.status === filterStatus;
    
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No invoices found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const customerName = inv.profiles ? inv.profiles.name : 'Unknown';
    const amount = parseFloat(inv.amount || 0).toLocaleString('en-IN');
    const date = new Date(inv.invoice_date).toLocaleDateString('en-IN');
    const isPaid = inv.status === 'Paid';
    
    const badge = `<span style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background: ${isPaid ? 'rgba(34,197,94,0.1); color:#86efac;' : 'rgba(239,68,68,0.1); color:#fca5a5;'}">${inv.status}</span>`;
    
    let pdfBtn = inv.pdf_url 
      ? `<a href="${inv.pdf_url}" target="_blank" class="action-btn" title="View PDF" style="display:inline-flex; align-items:center; justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
         </a>`
      : '';

    return `
    <tr>
      <td style="font-weight:600; color:var(--primary-color);">${inv.invoice_number}</td>
      <td>${customerName}</td>
      <td>${date}</td>
      <td style="font-weight:bold;">₹${amount}</td>
      <td>${badge}</td>
      <td>
        <div class="actions-cell" style="justify-content:center;">
          ${pdfBtn}
          <button class="action-btn" title="Details" onclick="window.openDetailsModal('${inv.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </button>
          <button class="action-btn delete" title="Delete" onclick="window.deleteInvoice('${inv.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

// ==========================================
// DYNAMIC INVOICE ITEMS LOGIC
// ==========================================

let itemIndex = 0;

window.addInvoiceItem = function() {
  const rowId = `item_row_${itemIndex++}`;
  const html = `
    <div class="invoice-item-row" id="${rowId}">
      <div>
        <label style="font-size:0.75rem;">Item Name *</label>
        <input type="text" class="form-control item-name" required placeholder="e.g. Hikvision 2MP Camera">
      </div>
      <div>
        <label style="font-size:0.75rem;">Quantity *</label>
        <input type="number" class="form-control item-qty" required min="1" value="1" oninput="window.calcTotal()">
      </div>
      <div>
        <label style="font-size:0.75rem;">Unit Price (₹) *</label>
        <input type="number" class="form-control item-price" required min="0" value="0" oninput="window.calcTotal()">
      </div>
      <div>
        <label style="font-size:0.75rem;">Total</label>
        <input type="text" class="form-control item-total" readonly value="₹0" style="background:rgba(255,255,255,0.02);">
      </div>
      <div style="padding-bottom:0.25rem;">
        <button type="button" class="action-btn delete" onclick="document.getElementById('${rowId}').remove(); window.calcTotal();">
          &times;
        </button>
      </div>
    </div>
  `;
  itemsContainer.insertAdjacentHTML('beforeend', html);
};

window.calcTotal = function() {
  let grandTotal = 0;
  const rows = itemsContainer.querySelectorAll('.invoice-item-row');
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const total = qty * price;
    row.querySelector('.item-total').value = `₹${total.toFixed(2)}`;
    grandTotal += total;
  });
  grandTotalEl.textContent = grandTotal.toFixed(2);
};

// ==========================================
// MODALS & ACTIONS
// ==========================================

window.openCreateModal = function() {
  createForm.reset();
  document.getElementById('invoice_date').value = new Date().toISOString().split('T')[0];
  itemsContainer.innerHTML = '';
  itemIndex = 0;
  window.addInvoiceItem(); // Add one default row
  window.calcTotal();
  window.openModal('create-modal');
};

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) {
    const lastNum = data[0].invoice_number.split('-').pop();
    const nextNum = parseInt(lastNum, 10) + 1;
    return `${prefix}${nextNum.toString().padStart(6, '0')}`;
  } else {
    return `${prefix}000001`;
  }
}

async function uploadPDF(file) {
  if (!file) return null;
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
  
  // We use the 'invoices' bucket
  const { error } = await supabase.storage.from('invoices').upload(fileName, file);
  if (error) {
    // If bucket doesn't exist or RLS blocks, throw error
    throw new Error(`PDF Upload Failed: ${error.message}`);
  }
  const { data } = supabase.storage.from('invoices').getPublicUrl(fileName);
  return data.publicUrl;
}

async function handleSave(e) {
  e.preventDefault();
  
  if (!createForm.checkValidity()) {
    createForm.reportValidity();
    return;
  }

  // Gather items
  const rows = itemsContainer.querySelectorAll('.invoice-item-row');
  if (rows.length === 0) {
    showToast('Please add at least one invoice item.', 'error');
    return;
  }

  const items = [];
  let amount = 0;
  
  for (let row of rows) {
    const name = row.querySelector('.item-name').value.trim();
    const qty = parseInt(row.querySelector('.item-qty').value, 10);
    const price = parseFloat(row.querySelector('.item-price').value);
    const total = qty * price;
    amount += total;
    
    items.push({
      item_name: name,
      quantity: qty,
      unit_price: price,
      total_price: total
    });
  }

  btnSave.disabled = true;
  btnSave.textContent = 'Generating...';

  try {
    const invNumber = await generateInvoiceNumber();
    const pdfFile = document.getElementById('invoice_pdf').files[0];
    let pdfUrl = null;
    
    if (pdfFile) {
      btnSave.textContent = 'Uploading PDF...';
      pdfUrl = await uploadPDF(pdfFile);
    }

    btnSave.textContent = 'Saving Record...';
    
    const invoicePayload = {
      invoice_number: invNumber,
      customer_id: customerSelect.value,
      invoice_date: document.getElementById('invoice_date').value,
      amount: amount,
      status: document.getElementById('invoice_status').value,
      notes: document.getElementById('invoice_notes').value.trim() || null,
      pdf_url: pdfUrl
    };

    // 1. Insert Invoice
    const { data: invData, error: invError } = await supabase
      .from('invoices')
      .insert([invoicePayload])
      .select('id')
      .single();

    if (invError) throw invError;
    
    // 2. Insert Items
    const itemsPayload = items.map(item => ({
      ...item,
      invoice_id: invData.id
    }));
    
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsPayload);
      
    if (itemsError) {
      console.error("Items insertion failed:", itemsError);
      showToast('Invoice created, but failed to save items.', 'error');
    } else {
      showToast(`Invoice ${invNumber} generated successfully.`, 'success');
    }

    window.closeModal('create-modal');
    fetchInvoices();

  } catch (error) {
    console.error('Save error:', error);
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Generate Invoice';
  }
}

// DETAILS
window.openDetailsModal = function(id) {
  const inv = invoices.find(x => String(x.id) === String(id));
  if (!inv) return;

  const customer = inv.profiles || {};
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
    
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:8px; margin-bottom:1.5rem;">
      <h4 style="margin:0 0 0.5rem 0; font-size:0.9rem;">Billed To</h4>
      <div style="font-weight:bold;">${customer.name || 'N/A'}</div>
      <div style="font-size:0.85rem; color:var(--text-muted);">${customer.phone || 'No Phone'}</div>
      <div style="font-size:0.85rem; color:var(--text-muted);">${customer.email || 'No Email'}</div>
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

// DELETE
window.deleteInvoice = async function(id) {
  if (!confirm("Are you sure you want to delete this invoice? Related items will also be deleted.")) return;
  
  try {
    // Note: If ON DELETE CASCADE is set on invoice_items, we only need to delete the invoice.
    // If not, we should delete items first. Supabase usually cascades if configured properly.
    // Let's explicitly delete items first just to be safe.
    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    
    if (error) throw error;
    showToast('Invoice deleted successfully', 'success');
    fetchInvoices();
  } catch (err) {
    showToast(`Error deleting invoice: ${err.message}`, 'error');
  }
};
