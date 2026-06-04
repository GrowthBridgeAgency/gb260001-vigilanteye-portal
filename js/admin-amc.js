/**
 * admin-amc.js
 * Logic for AMC Management Module
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';
import { calculateDaysRemaining, getAMCStatus, calculateOneYearRenewal } from './amc-utils.js';

let amcRecords = [];
let searchTerm = '';
let filterStatus = 'All';

const tbody = document.getElementById('amc-tbody');
const renewalsTbody = document.getElementById('renewals-tbody');
const renewalsPanel = document.getElementById('upcoming-renewals-panel');
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-status');

// Metrics
const elActive = document.getElementById('metric-active');
const elExpiring = document.getElementById('metric-expiring');
const elExpired = document.getElementById('metric-expired');
const elRenewals = document.getElementById('metric-renewals');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : ''); setTimeout(() => window.location.href = basePath + '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchAMCRecords();

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTables();
  });
  
  filterSelect.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderTables();
  });
});

async function fetchAMCRecords() {
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading AMC records...</td></tr>';
  
  try {
    // Only fetch products that have an AMC
    const { data, error } = await supabase
      .from('products')
      .select('*, profiles:customer_id(name)')
      .not('amc_status', 'is', null)
      .neq('amc_status', 'None')
      .order('amc_expiry', { ascending: true });

    if (error) throw error;
    
    // Process Data
    amcRecords = data.map(record => {
      const daysLeft = calculateDaysRemaining(record.amc_expiry);
      const computedStatus = getAMCStatus(record.amc_status, daysLeft);
      return { ...record, daysLeft, computedStatus };
    });

    updateMetrics();
    renderTables();
    renderUpcomingRenewals();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load data.</td></tr>';
  }
}

function updateMetrics() {
  let active = 0;
  let expiring = 0;
  let expired = 0;
  let potentialsThisMonth = 0;

  amcRecords.forEach(r => {
    if (r.computedStatus.label === 'Active') active++;
    else if (r.computedStatus.label === 'Expired' || r.computedStatus.label === 'Inactive') expired++;
    else expiring++; // Includes all "Expiring in X days"

    if (r.daysLeft <= 30 && r.daysLeft > -30) {
      potentialsThisMonth++;
    }
  });

  elActive.textContent = active;
  elExpiring.textContent = expiring;
  elExpired.textContent = expired;
  elRenewals.textContent = potentialsThisMonth;
}

function renderUpcomingRenewals() {
  const upcoming = amcRecords.filter(r => r.daysLeft <= 30 && r.daysLeft >= -30);
  
  if (upcoming.length === 0) {
    renewalsPanel.style.display = 'none';
    return;
  }
  
  renewalsPanel.style.display = 'block';
  renewalsTbody.innerHTML = upcoming.map(r => {
    const customer = r.profiles ? r.profiles.name : 'Unknown';
    const expiryDate = r.amc_expiry ? new Date(r.amc_expiry).toLocaleDateString('en-IN') : 'N/A';
    
    return `
    <tr>
      <td style="font-weight:600;">${customer}</td>
      <td>${r.product_name}</td>
      <td>${expiryDate}</td>
      <td><span style="color:${r.daysLeft < 0 ? '#fca5a5' : '#fcd34d'}; font-weight:bold;">${r.daysLeft} days</span></td>
      <td style="text-align:center;">
        <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.75rem; border-color:var(--primary-color); color:var(--primary-color);" onclick="window.renewAMC('${r.id}')">
          Renew +1 Year
        </button>
      </td>
    </tr>
  `}).join('');
}

function renderTables() {
  let filtered = amcRecords.filter(r => {
    const customer = r.profiles ? r.profiles.name : '';
    const matchSearch = !searchTerm || 
      customer.toLowerCase().includes(searchTerm) || 
      r.product_name?.toLowerCase().includes(searchTerm);
      
    let matchStatus = true;
    if (filterStatus === 'Active') matchStatus = r.computedStatus.label === 'Active';
    if (filterStatus === 'Expired') matchStatus = r.computedStatus.label === 'Expired' || r.computedStatus.label === 'Inactive';
    if (filterStatus === 'Expiring Soon') matchStatus = r.computedStatus.label.includes('Expiring');
    
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No AMC records match criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const customer = r.profiles ? r.profiles.name : 'Unknown';
    const start = r.amc_start ? new Date(r.amc_start).toLocaleDateString('en-IN') : '-';
    const expiry = r.amc_expiry ? new Date(r.amc_expiry).toLocaleDateString('en-IN') : '-';
    
    let badgeStyle = r.computedStatus.isWarning 
      ? (r.daysLeft < 0 ? 'rgba(239,68,68,0.1); color:#fca5a5;' : 'rgba(252,211,77,0.1); color:#fcd34d;')
      : 'rgba(34,197,94,0.1); color:#86efac;';
      
    const badge = `<span style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background: ${badgeStyle}">${r.computedStatus.label}</span>`;

    return `
    <tr>
      <td>${customer}</td>
      <td style="font-weight:500;">${r.product_name}</td>
      <td>${start}</td>
      <td>${expiry}</td>
      <td>${badge}</td>
      <td style="text-align:center;">
        <button class="action-btn" title="Renew AMC (+1 Year)" onclick="window.renewAMC('${r.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2"><path d="M2 12a10 10 0 1 0 10-10 1 1 0 0 1 0 2 8 8 0 1 1-8 8 1 1 0 0 1-2 0z"></path></svg>
        </button>
      </td>
    </tr>
  `}).join('');
}

window.renewAMC = async function(id) {
  const record = amcRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const newExpiry = calculateOneYearRenewal(record.amc_expiry);
  
  if (!confirm(`Are you sure you want to renew AMC for ${record.product_name}? New expiry will be ${newExpiry}.`)) return;

  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const currentExpiry = new Date(record.amc_expiry);
    
    let updatePayload = {
      amc_status: 'Active',
      amc_expiry: newExpiry
    };
    
    // If it was completely expired or invalid, reset the start date to today too
    if (isNaN(currentExpiry.getTime()) || currentExpiry < today) {
      updatePayload.amc_start = new Date().toISOString().split('T')[0];
    }

    const { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
    
    showToast('AMC Renewed Successfully!', 'success');
    fetchAMCRecords();
  } catch (error) {
    showToast(`Error renewing AMC: ${error.message}`, 'error');
  }
};
