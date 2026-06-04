/**
 * admin-enquiries.js
 * Logic for CRM Lead Management Dashboard
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let allLeads = [];
let searchTerm = '';
let filterStatus = 'All';
let filterType = 'All';

// Metrics
const elTotal = document.getElementById('metric-total');
const elNew = document.getElementById('metric-new');
const elContacted = document.getElementById('metric-contacted');
const elConverted = document.getElementById('metric-converted');
const elToday = document.getElementById('metric-today');
const elWeek = document.getElementById('metric-week');
const elBudget = document.getElementById('metric-budget');
const elConversion = document.getElementById('metric-conversion');

const tbody = document.getElementById('leads-tbody');
const searchInput = document.getElementById('search-input');
const filterStatusSelect = document.getElementById('filter-status');
const filterTypeSelect = document.getElementById('filter-type');
const modalBody = document.getElementById('lead-modal-body');
const quickActionsContainer = document.getElementById('quick-actions-container');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    setTimeout(() => window.location.href = '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchLeads();

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTable();
  });
  
  filterStatusSelect.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderTable();
  });

  filterTypeSelect.addEventListener('change', (e) => {
    filterType = e.target.value;
    renderTable();
  });
});

async function fetchLeads() {
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading enquiries...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allLeads = data || [];
    
    updateMetrics();
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:#fca5a5;">Failed to load leads.</td></tr>';
  }
}

// Utility to parse numbers out of sloppy budget strings
function parseBudgetStr(str) {
  if (!str) return 0;
  // remove commas, ruppe symbols, etc.
  const numStr = str.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const val = parseFloat(numStr);
  if (isNaN(val)) return 0;
  
  // Quick heuristic for "k" notation if someone typed 50k
  if (str.toLowerCase().includes('k')) return val * 1000;
  if (str.toLowerCase().includes('lakh')) return val * 100000;
  
  return val;
}

function calculatePriority(budgetVal) {
  if (budgetVal >= 100000) return { label: 'High', class: 'priority-high' };
  if (budgetVal >= 20000) return { label: 'Medium', class: 'priority-medium' };
  return { label: 'Low', class: 'priority-low' };
}

function calculateDaysOpen(createdAtStr, status) {
  // If it's closed or converted, we could freeze the days open, but for now we just show current age
  const createdDate = new Date(createdAtStr);
  createdDate.setHours(0,0,0,0);
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const diffTime = Math.abs(today - createdDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
}

function updateMetrics() {
  let newL = 0;
  let contacted = 0;
  let converted = 0;
  let todayCount = 0;
  let weekCount = 0;
  let validBudgetSum = 0;
  let validBudgetCount = 0;

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  oneWeekAgo.setHours(0,0,0,0);

  allLeads.forEach(r => {
    if (r.status === 'New') newL++;
    if (r.status === 'Contacted') contacted++;
    if (r.status === 'Converted') converted++;

    const createdDate = new Date(r.created_at);
    createdDate.setHours(0,0,0,0);
    
    if (createdDate.getTime() === today.getTime()) todayCount++;
    if (createdDate >= oneWeekAgo) weekCount++;

    const budgetVal = parseBudgetStr(r.budget);
    if (budgetVal > 0) {
      validBudgetSum += budgetVal;
      validBudgetCount++;
    }
  });

  const avgBudget = validBudgetCount > 0 ? (validBudgetSum / validBudgetCount) : 0;
  const convRate = allLeads.length > 0 ? ((converted / allLeads.length) * 100) : 0;

  elTotal.textContent = allLeads.length;
  elNew.textContent = newL;
  elContacted.textContent = contacted;
  elConverted.textContent = converted;
  elToday.textContent = todayCount;
  elWeek.textContent = weekCount;
  elBudget.textContent = '₹' + avgBudget.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  elConversion.textContent = convRate.toFixed(1) + '%';
}

function renderTable() {
  let filtered = allLeads.filter(r => {
    const matchSearch = !searchTerm || 
      (r.name && r.name.toLowerCase().includes(searchTerm)) || 
      (r.mobile && r.mobile.toLowerCase().includes(searchTerm)) || 
      (r.email && r.email.toLowerCase().includes(searchTerm)) || 
      (r.location && r.location.toLowerCase().includes(searchTerm));
      
    let matchStatus = true;
    if (filterStatus !== 'All') matchStatus = r.status === filterStatus;

    let matchType = true;
    if (filterType !== 'All') matchType = r.requirement_type === filterType;
    
    return matchSearch && matchStatus && matchType;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">No enquiries received yet.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('en-IN');
    const budgetVal = parseBudgetStr(r.budget);
    const priority = calculatePriority(budgetVal);
    const daysOpen = calculateDaysOpen(r.created_at, r.status);
    
    const safeId = r.id.toString();

    // Status Select HTML
    const statuses = ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Converted', 'Closed'];
    let statusOptions = statuses.map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('');

    return `
    <tr>
      <td style="font-weight:600;">${r.name || '-'}</td>
      <td>${r.mobile || '-'}</td>
      <td>${r.requirement_type || '-'}</td>
      <td>${r.budget || 'Not specified'}</td>
      <td><span class="priority-badge ${priority.class}">${priority.label}</span></td>
      <td>
        <select class="form-control" style="padding:0.25rem 0.5rem; font-size:0.85rem;" onchange="window.updateLeadStatus('${safeId}', this.value)">
          ${statusOptions}
        </select>
      </td>
      <td style="text-align:center; font-weight:bold; color: ${daysOpen > 7 ? '#fca5a5' : 'inherit'};">${daysOpen}</td>
      <td>${date}</td>
      <td style="text-align:center;">
        <button class="action-btn" title="View Details" onclick="window.viewLead('${safeId}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
      </td>
    </tr>
  `}).join('');
}

window.updateLeadStatus = async function(id, newStatus) {
  try {
    const { error } = await supabase
      .from('enquiries')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) throw error;
    
    showToast('Lead status updated', 'success');
    
    const lead = allLeads.find(r => String(r.id) === String(id));
    if (lead) lead.status = newStatus;
    
    updateMetrics();
    // Intentionally not fully re-rendering table to prevent UI jumping when changing select
  } catch (err) {
    console.error('Update error:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
};

window.viewLead = function(id) {
  const r = allLeads.find(x => String(x.id) === String(id));
  if (!r) return;

  const date = new Date(r.created_at).toLocaleString('en-IN');
  const budgetVal = parseBudgetStr(r.budget);
  const priority = calculatePriority(budgetVal);

  let attachmentHtml = '<span style="color:var(--text-muted); font-size:0.9rem;">No attachment provided.</span>';
  if (r.file_url) {
    const isImage = r.file_url.match(/\.(jpeg|jpg|gif|png|webp)/i) != null;
    attachmentHtml = `
      <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <a href="${r.file_url}" target="_blank" class="btn btn-outline" style="padding:0.5rem 1rem; font-size:0.85rem;">View Attachment</a>
        <a href="${r.file_url}" download class="btn btn-primary" style="padding:0.5rem 1rem; font-size:0.85rem; background:rgba(255,255,255,0.1); border:none;">Download</a>
      </div>
      ${isImage ? `<div style="margin-top: 1rem;"><img src="${r.file_url}" style="max-width: 100%; max-height: 250px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" alt="Attachment Preview"/></div>` : ''}
    `;
  }

  modalBody.innerHTML = `
    <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Customer</h4>
        <div style="font-weight:600; font-size:1.1rem; color:#fff;">${r.name || '-'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Location</h4>
        <div>${r.location || '-'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Mobile</h4>
        <div>${r.mobile || '-'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Email</h4>
        <div>${r.email || '-'}</div>
      </div>
    </div>

    <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem; background:rgba(255,255,255,0.02); padding:1rem; border-radius:8px;">
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Requirement</h4>
        <div style="color:var(--primary-color); font-weight:500;">${r.requirement_type || '-'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Budget & Priority</h4>
        <div>${r.budget || 'Not specified'} <span class="priority-badge ${priority.class}" style="margin-left:0.5rem; padding:0.15rem 0.4rem; font-size:0.65rem;">${priority.label}</span></div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h4 style="margin:0 0 0.5rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Message</h4>
      <div style="background:var(--bg-main); padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); min-height:80px; white-space:pre-wrap;">${r.message || 'No additional message provided.'}</div>
    </div>

    <div>
      <h4 style="margin:0 0 0.5rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Attachment</h4>
      ${attachmentHtml}
    </div>
  `;

  // Quick Actions
  let waMessage = encodeURIComponent(`Hello ${r.name},\n\nThank you for contacting VigilantEye Surveillance.\nWe received your enquiry regarding ${r.requirement_type}.\n\nOur team will contact you shortly.`);
  
  // Clean mobile for wa.me
  let cleanMobile = r.mobile ? r.mobile.replace(/[^0-9]/g, '') : '';
  if (cleanMobile && cleanMobile.length === 10) cleanMobile = '91' + cleanMobile; // Assume India if exactly 10 digits without code

  quickActionsContainer.innerHTML = `
    <a href="tel:${r.mobile}" class="btn btn-primary" style="padding:0.5rem 1rem; font-size:0.85rem; background:#3b82f6;">Call Customer</a>
    <a href="https://wa.me/${cleanMobile}?text=${waMessage}" target="_blank" class="btn btn-primary" style="padding:0.5rem 1rem; font-size:0.85rem; background:#25d366;">WhatsApp</a>
    ${r.email ? `<a href="mailto:${r.email}" class="btn btn-primary" style="padding:0.5rem 1rem; font-size:0.85rem; background:#6366f1;">Email</a>` : ''}
  `;

  window.openModal('lead-modal');
};
