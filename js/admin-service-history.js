/**
 * admin-service-history.js
 * Logic for Admin Service History CRM
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let allRecords = [];
let allCustomers = [];
let allTechnicians = [];
let searchTerm = '';
let filterType = 'All';
let filterDate = '';

// Metrics
const elTotal = document.getElementById('metric-total');
const elMonth = document.getElementById('metric-month');
const elWeek = document.getElementById('metric-week');
const elAmc = document.getElementById('metric-amc');
const elComplaints = document.getElementById('metric-complaints');
const elTech = document.getElementById('metric-tech');
const elType = document.getElementById('metric-type');

const tbody = document.getElementById('services-tbody');
const form = document.getElementById('create-form');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : ''); setTimeout(() => window.location.href = basePath + '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchDependencies(); // Customers & Techs for the dropdowns
  fetchRecords();

  document.getElementById('search-input').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTable();
  });
  
  document.getElementById('filter-type').addEventListener('change', (e) => {
    filterType = e.target.value;
    renderTable();
  });

  document.getElementById('filter-date').addEventListener('change', (e) => {
    filterDate = e.target.value;
    renderTable();
  });

  form.addEventListener('submit', handleSaveRecord);
});

async function fetchDependencies() {
  try {
    const { data: cData } = await supabase.from('profiles').select('id, name').eq('role', 'customer');
    if (cData) {
      allCustomers = cData;
      const select = document.getElementById('sr-customer');
      cData.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
      });
    }

    const { data: tData } = await supabase.from('technicians').select('id, technician_name, is_active');
    if (tData) {
      allTechnicians = tData;
      const select = document.getElementById('sr-tech');
      tData.forEach(t => {
        select.innerHTML += `<option value="${t.technician_name}">${t.technician_name}</option>`;
      });
    }

    // Auto-fill logic from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('create') === 'true') {
      const cId = urlParams.get('customer_id');
      if (cId) {
        document.getElementById('sr-customer').value = cId;
        await window.loadCustomerProductsAndComplaints(cId);
        
        const pId = urlParams.get('product_id');
        const compId = urlParams.get('complaint_id');
        const tech = urlParams.get('tech');

        if (pId) document.getElementById('sr-product').value = pId;
        if (compId) document.getElementById('sr-complaint').value = compId;
        if (tech) document.getElementById('sr-tech').value = tech;
        
        document.getElementById('sr-type').value = 'Complaint Resolution';
      }
      window.openCreateModal();
    }
  } catch (err) {
    console.error('Error fetching dependencies:', err);
  }
}

window.loadCustomerProductsAndComplaints = async function(customerId) {
  const pSelect = document.getElementById('sr-product');
  const cSelect = document.getElementById('sr-complaint');
  
  pSelect.innerHTML = '<option value="" disabled selected>-- Select Product --</option>';
  cSelect.innerHTML = '<option value="">-- No Complaint Linked --</option>';
  
  if (!customerId) return;

  try {
    const { data: pData } = await supabase.from('products').select('*').eq('customer_id', customerId);
    if (pData) {
      pData.forEach(p => {
        pSelect.innerHTML += `<option value="${p.id}">${p.product_name} (${p.model_number || 'N/A'})</option>`;
      });
    }

    const { data: cData } = await supabase.from('complaints').select('*').eq('customer_id', customerId);
    if (cData) {
      cData.forEach(c => {
        cSelect.innerHTML += `<option value="${c.id}">${c.complaint_number} - ${c.status}</option>`;
      });
    }
  } catch (err) {
    console.error('Error fetching customer assets:', err);
  }
};

window.openCreateModal = function() {
  form.reset();
  document.getElementById('sr-date').value = new Date().toISOString().split('T')[0];
  window.openModal('create-modal');
};

// --- DATA PARSING (Outcome Extractor) ---
// Since we don't have an outcome column natively, we safely store it embedded in service_details 
// as [OUTCOME: xyz] 
function parseServiceDetails(rawString) {
  if (!rawString) return { outcome: 'Completed', notes: '' };
  const match = rawString.match(/^\\[OUTCOME:\s*(.+?)\\]\s*(.*)$/is);
  if (match) {
    return { outcome: match[1].trim(), notes: match[2].trim() };
  }
  return { outcome: 'Completed', notes: rawString }; // Legacy fallback
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

async function fetchRecords() {
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading records...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('service_history')
      .select('*, profiles:customer_id(name), products:product_id(product_name), complaints:complaint_id(ticket_number)')
      .order('service_date', { ascending: false });

    if (error) throw error;
    allRecords = data || [];
    
    updateMetrics();
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:3rem; color:#fca5a5;">Failed to load data.</td></tr>';
  }
}

function updateMetrics() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  oneWeekAgo.setHours(0,0,0,0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let mMonth = 0;
  let mWeek = 0;
  let mAmc = 0;
  let mComplaints = 0;

  const techCounts = {};
  const typeCounts = {};

  allRecords.forEach(r => {
    const sDate = new Date(r.service_date);
    sDate.setHours(0,0,0,0);

    if (sDate >= startOfMonth) mMonth++;
    if (sDate >= oneWeekAgo) mWeek++;
    if (r.service_type === 'AMC Visit') mAmc++;
    if (r.service_type === 'Complaint Resolution') mComplaints++;

    // Tech count
    if (r.technician_name) {
      techCounts[r.technician_name] = (techCounts[r.technician_name] || 0) + 1;
    }
    // Type count
    if (r.service_type) {
      typeCounts[r.service_type] = (typeCounts[r.service_type] || 0) + 1;
    }
  });

  // Calculate Most Active Tech
  let topTech = '-';
  let topTechCount = 0;
  for (const [t, c] of Object.entries(techCounts)) {
    if (c > topTechCount) { topTech = t; topTechCount = c; }
  }

  // Calculate Most Common Type
  let topType = '-';
  let topTypeCount = 0;
  for (const [t, c] of Object.entries(typeCounts)) {
    if (c > topTypeCount) { topType = t; topTypeCount = c; }
  }

  elTotal.textContent = allRecords.length;
  elMonth.textContent = mMonth;
  elWeek.textContent = mWeek;
  elAmc.textContent = mAmc;
  elComplaints.textContent = mComplaints;
  elTech.textContent = topTech;
  elType.textContent = topType;
}

function renderTable() {
  let filtered = allRecords.filter(r => {
    const customerName = r.profiles?.name || '';
    const parsed = parseServiceDetails(r.service_details);
    
    const matchSearch = !searchTerm || 
      customerName.toLowerCase().includes(searchTerm) || 
      (r.technician_name && r.technician_name.toLowerCase().includes(searchTerm)) ||
      parsed.notes.toLowerCase().includes(searchTerm);
      
    let matchType = true;
    if (filterType !== 'All') matchType = r.service_type === filterType;

    let matchDate = true;
    if (filterDate) {
      // simple match YYYY-MM-DD
      matchDate = r.service_date.startsWith(filterDate);
    }
    
    return matchSearch && matchType && matchDate;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);">No service records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const parsed = parseServiceDetails(r.service_details);
    const badgeClass = getOutcomeClass(parsed.outcome);
    const date = new Date(r.service_date).toLocaleDateString('en-IN');
    
    const safeId = r.id.toString();

    return `
    <tr>
      <td style="white-space:nowrap;">${date}</td>
      <td style="font-weight:600;">${r.profiles?.name || '-'}</td>
      <td>${r.products?.product_name || '-'}</td>
      <td>${r.service_type}</td>
      <td><span class="outcome-badge ${badgeClass}">${parsed.outcome}</span></td>
      <td>${r.technician_name || '-'}</td>
      <td>${r.complaints?.ticket_number || '-'}</td>
      <td style="text-align:center;">
        <button class="action-btn" title="View Details" onclick="window.viewRecord('${safeId}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
      </td>
    </tr>
  `}).join('');
}

window.viewRecord = function(id) {
  const r = allRecords.find(x => String(x.id) === String(id));
  if (!r) return;

  const parsed = parseServiceDetails(r.service_details);
  const badgeClass = getOutcomeClass(parsed.outcome);
  const date = new Date(r.service_date).toLocaleDateString('en-IN');

  document.getElementById('view-modal-body').innerHTML = `
    <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Customer</h4>
        <div style="font-weight:600; font-size:1.1rem; color:#fff;">${r.profiles?.name || '-'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Date</h4>
        <div>${date}</div>
      </div>
    </div>

    <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem; background:rgba(255,255,255,0.02); padding:1rem; border-radius:8px;">
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Service Type & Outcome</h4>
        <div style="margin-bottom:0.25rem;">${r.service_type}</div>
        <span class="outcome-badge ${badgeClass}">${parsed.outcome}</span>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Technician</h4>
        <div>${r.technician_name}</div>
      </div>
    </div>

    <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Linked Product</h4>
        <div>${r.products?.product_name || 'N/A'}</div>
      </div>
      <div>
        <h4 style="margin:0 0 0.25rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Linked Complaint</h4>
        <div>${r.complaints?.ticket_number || 'N/A'}</div>
      </div>
    </div>

    <div>
      <h4 style="margin:0 0 0.5rem 0; color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Service Notes</h4>
      <div style="background:var(--bg-main); padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); min-height:80px; white-space:pre-wrap;">${parsed.notes}</div>
    </div>
  `;

  window.openModal('view-modal');
};

async function handleSaveRecord(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-record');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const customer_id = document.getElementById('sr-customer').value;
    const product_id = document.getElementById('sr-product').value;
    const complaint_id = document.getElementById('sr-complaint').value || null;
    const service_date = document.getElementById('sr-date').value;
    const service_type = document.getElementById('sr-type').value;
    const outcome = document.getElementById('sr-outcome').value;
    const technician_name = document.getElementById('sr-tech').value;
    const rawNotes = document.getElementById('sr-details').value.trim();

    // Embed outcome
    const service_details = `[OUTCOME: ${outcome}] ${rawNotes}`;

    const payload = {
      customer_id,
      product_id: parseInt(product_id, 10),
      complaint_id: complaint_id ? parseInt(complaint_id, 10) : null,
      service_date,
      service_type,
      technician_name,
      service_details
    };

    const { error } = await supabase.from('service_history').insert([payload]);
    if (error) throw error;

    showToast('Service record saved successfully', 'success');
    window.closeModal('create-modal');
    fetchRecords();

  } catch (err) {
    console.error('Save error:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Record';
  }
}
