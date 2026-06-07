/**
 * customer-service-history.js
 * Logic for Customer Service History Portal
 */

import { supabase } from './supabase.js';
import { loadCurrentUser } from './user-context.js';
import { showToast } from './toast.js';

let currentUser = null;
let services = [];

const tbody = document.getElementById('services-tbody');

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await loadCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;

  fetchServiceHistory();
});

// Extractor helper
function parseServiceDetails(rawString) {
  if (!rawString) return { outcome: 'Completed', notes: '' };
  const match = rawString.match(/^\\[OUTCOME:\s*(.+?)\\]\s*(.*)$/is);
  if (match) {
    return { outcome: match[1].trim(), notes: match[2].trim() };
  }
  return { outcome: 'Completed', notes: rawString };
}

function getOutcomeClass(outcome) {
  const map = {
    'Completed': 'outcome-completed',
    'Partially Resolved': 'outcome-partial',
    'Follow-up Required': 'outcome-followup',
    'Parts Replacement Needed': 'outcome-parts',
    'AMC Maintenance Completed': 'outcome-amc'
  };
  return map[outcome] || 'outcome-completed';
}

async function fetchServiceHistory() {
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Fetching your service logs...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('service_history')
      .select('*, products(product_name)')
      .eq('customer_id', currentUser.id)
      .order('service_date', { ascending: false });

    if (error) throw error;
    
    services = data;
    renderTable();
  } catch (err) {
    console.error('Error fetching service history:', err);
    showToast('Failed to load service history.', 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:#fca5a5;">Error loading service data.</td></tr>';
  }
}

function renderTable() {
  if (services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:4rem; color:var(--text-muted);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1rem; opacity:0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <div>You have no service history on record.</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = services.map(r => {
    const parsed = parseServiceDetails(r.service_details);
    const badgeClass = getOutcomeClass(parsed.outcome);
    const date = new Date(r.service_date).toLocaleDateString('en-IN');
    const safeId = r.id.toString();

    return `
    <tr>
      <td style="white-space:nowrap; font-weight:600;">${date}</td>
      <td>${r.service_type}</td>
      <td><span class="outcome-badge ${badgeClass}">${parsed.outcome}</span></td>
      <td>${r.technician_name || '-'}</td>
      <td>${r.products?.product_name || '-'}</td>
      <td style="text-align:center;">
        <button class="action-btn" title="View Report" onclick="window.viewReport('${safeId}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
      </td>
    </tr>
    `;
  }).join('');
}

window.viewReport = function(id) {
  const r = services.find(x => String(x.id) === String(id));
  if (!r) return;

  const parsed = parseServiceDetails(r.service_details);
  const badgeClass = getOutcomeClass(parsed.outcome);
  const date = new Date(r.service_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  document.getElementById('view-modal-body').innerHTML = `
    <div style="margin-bottom: 1.5rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem;">
      <h3 style="margin:0 0 0.5rem 0; color:var(--primary-color);">${r.service_type}</h3>
      <div style="color:var(--text-muted); font-size:0.95rem;">${date}</div>
    </div>

    <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Technician</h4>
        <div style="font-weight:600; font-size:1.05rem; color:#fff;">${r.technician_name || '-'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Serviced Product</h4>
        <div style="font-weight:600; font-size:1.05rem; color:#fff;">${r.products?.product_name || 'N/A'}</div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h4 style="margin:0 0 0.5rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Outcome</h4>
      <span class="outcome-badge ${badgeClass}" style="font-size:0.85rem;">${parsed.outcome}</span>
    </div>

    <div>
      <h4 style="margin:0 0 0.5rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Technician Notes</h4>
      <div style="background:var(--bg-main); padding:1.5rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); min-height:80px; white-space:pre-wrap; line-height:1.6;">${parsed.notes}</div>
    </div>
  `;

  window.openModal('view-modal');
};
