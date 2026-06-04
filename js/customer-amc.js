/**
 * customer-amc.js
 * Logic for Customer AMC Tracking
 */

import { supabase } from './supabase.js';
import { loadCurrentUser } from './user-context.js';
import { showToast } from './toast.js';
import { calculateDaysRemaining, getAMCStatus } from './amc-utils.js';

let amcRecords = [];
let currentUser = null;
const tbody = document.getElementById('amc-tbody');

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await loadCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;
  fetchAMCRecords();
});

async function fetchAMCRecords() {
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading your AMC records...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('customer_id', currentUser.id)
      .not('amc_status', 'is', null)
      .neq('amc_status', 'None')
      .order('amc_expiry', { ascending: true });

    if (error) throw error;
    
    amcRecords = data.map(record => {
      const daysLeft = calculateDaysRemaining(record.amc_expiry);
      const computedStatus = getAMCStatus(record.amc_status, daysLeft);
      return { ...record, daysLeft, computedStatus };
    });

    renderTable();
  } catch (err) {
    console.error('Error fetching AMC records:', err);
    showToast('Failed to load AMC tracking.', 'error');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">Error loading data.</td></tr>';
  }
}

function renderTable() {
  if (amcRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">You currently have no products under an active or trackable AMC.</td></tr>';
    return;
  }

  tbody.innerHTML = amcRecords.map(r => {
    const start = r.amc_start ? new Date(r.amc_start).toLocaleDateString('en-IN') : '-';
    const expiry = r.amc_expiry ? new Date(r.amc_expiry).toLocaleDateString('en-IN') : '-';
    
    let badgeStyle = r.computedStatus.isWarning 
      ? (r.daysLeft < 0 ? 'rgba(239,68,68,0.1); color:#fca5a5;' : 'rgba(252,211,77,0.1); color:#fcd34d;')
      : 'rgba(34,197,94,0.1); color:#86efac;';
      
    const badge = `<span style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background: ${badgeStyle}">${r.computedStatus.label}</span>`;
    
    let daysDisplay = `<span style="font-weight:bold; color:${r.daysLeft < 0 ? '#fca5a5' : '#fff'};">${r.daysLeft} days</span>`;

    return `
    <tr>
      <td style="font-weight:600; color:var(--primary-color);">${r.product_name}</td>
      <td>${start}</td>
      <td>${expiry}</td>
      <td>${daysDisplay}</td>
      <td>${badge}</td>
    </tr>
  `}).join('');
}
