/**
 * admin-customers.js
 * Logic for Admin Customer CRM Dashboard
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let allCustomers = [];
let allProducts = [];
let allComplaints = [];
let allInvoices = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    window.location.href = basePath + '/login.html';
    return;
  }
  
  document.getElementById('search-input').addEventListener('input', handleSearch);
  
  loadCustomers();
});

async function loadCustomers() {
  try {
    // Avoid N+1 by fetching everything we need for the table/summary upfront in parallel
    const [
      { data: profiles },
      { data: products },
      { data: complaints },
      { data: invoices }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
      supabase.from('products').select('customer_id, amc_expiry'),
      supabase.from('complaints').select('customer_id, status'),
      supabase.from('invoices').select('customer_id, status, amount')
    ]);

    allCustomers = profiles || [];
    allProducts = products || [];
    allComplaints = complaints || [];
    allInvoices = invoices || [];

    renderSummaryCards();
    renderTable(allCustomers);
  } catch (error) {
    console.error("Error loading customers:", error);
    document.getElementById('customers-tbody').innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">Failed to load data.</td></tr>`;
  }
}

function renderSummaryCards() {
  const container = document.getElementById('summary-cards');
  if (!container) return;

  const total = allCustomers.length;
  
  // Calculate Active Customers (has at least one product)
  const activeCustomerIds = new Set(allProducts.map(p => p.customer_id));
  const activeCount = activeCustomerIds.size;
  
  // Calculate Customers with AMC
  const now = new Date();
  const amcCustomerIds = new Set(allProducts.filter(p => p.amc_expiry && new Date(p.amc_expiry) > now).map(p => p.customer_id));
  
  // Calculate Customers with Open Complaints
  const openComplaintIds = new Set(allComplaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').map(c => c.customer_id));

  container.innerHTML = `
    <div class="metric-card"><div class="metric-title">Total Customers</div><div class="metric-value">${total}</div></div>
    <div class="metric-card"><div class="metric-title">Active Customers</div><div class="metric-value" style="color:#4ade80;">${activeCount}</div></div>
    <div class="metric-card"><div class="metric-title">Customers With AMC</div><div class="metric-value" style="color:#3b82f6;">${amcCustomerIds.size}</div></div>
    <div class="metric-card"><div class="metric-title">With Open Complaints</div><div class="metric-value" style="color:#f87171;">${openComplaintIds.size}</div></div>
  `;
}

function calculateHealth(customerId) {
  const cProducts = allProducts.filter(p => p.customer_id === customerId);
  const cComplaints = allComplaints.filter(c => c.customer_id === customerId);
  const cInvoices = allInvoices.filter(i => i.customer_id === customerId);
  
  const now = new Date();
  let score = 100;
  
  const openComplaints = cComplaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const pendingInvoices = cInvoices.filter(i => i.status !== 'Paid').length;
  const expiredAmc = cProducts.filter(p => p.amc_expiry && new Date(p.amc_expiry) < now).length;
  
  score -= (openComplaints * 15);
  score -= (expiredAmc * 10);
  score -= (pendingInvoices * 5);

  if (score >= 90) return { label: 'Healthy', class: 'health-healthy' };
  if (score >= 50) return { label: 'Attention Needed', class: 'health-attention' };
  return { label: 'Critical', class: 'health-critical' };
}

function renderTable(data) {
  const tbody = document.getElementById('customers-tbody');
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:3rem;">No customers found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => {
    const health = calculateHealth(c.id);
    const date = new Date(c.created_at).toLocaleDateString('en-GB');
    
    return `
      <tr>
        <td style="font-weight:600;">${c.name || 'Unnamed'}</td>
        <td>
          <div style="font-size:0.9rem;">${c.email}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">${c.phone || 'No Phone'}</div>
        </td>
        <td><span class="health-badge ${health.class}">${health.label}</span></td>
        <td>${date}</td>
        <td style="text-align:center;">
          <button class="btn btn-outline" style="padding:0.25rem 0.75rem; font-size:0.8rem;" onclick="viewCustomerDetails('${c.id}')">View Details</button>
        </td>
      </tr>
    `;
  }).join('');
}

function handleSearch(e) {
  const term = e.target.value.toLowerCase();
  const filtered = allCustomers.filter(c => 
    (c.name && c.name.toLowerCase().includes(term)) ||
    (c.email && c.email.toLowerCase().includes(term)) ||
    (c.phone && c.phone.toLowerCase().includes(term))
  );
  renderTable(filtered);
}

// ==========================================
// CRM DETAILS MODAL LOGIC
// ==========================================

window.viewCustomerDetails = async function(customerId) {
  // 1. Show Modal & Loading State
  window.openModal('crm-modal');
  document.getElementById('crm-loading-state').style.display = 'block';
  document.getElementById('crm-content').style.display = 'none';
  
  // Basic Profile Info (already in memory)
  const profile = allCustomers.find(c => c.id === customerId);
  if (!profile) return;
  
  document.getElementById('crm-name').textContent = profile.name || 'Unnamed Customer';
  document.getElementById('crm-email').textContent = profile.email;
  document.getElementById('crm-phone').textContent = profile.phone || 'N/A';
  
  const createdDate = new Date(profile.created_at);
  const diffDays = Math.ceil(Math.abs(new Date() - createdDate) / (1000 * 60 * 60 * 24));
  document.getElementById('crm-since').textContent = `Member since ${createdDate.toLocaleDateString('en-GB')} (${diffDays} days)`;
  
  const health = calculateHealth(customerId);
  document.getElementById('crm-health-badge').innerHTML = `<span class="health-badge ${health.class}">${health.label}</span>`;

  try {
    // 2. Fire concurrent deep fetch for this specific customer
    const [
      { data: products },
      { data: complaints },
      { data: services },
      { data: invoices },
      { data: reviews }
    ] = await Promise.all([
      supabase.from('products').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
      supabase.from('complaints').select('*').eq('customer_id', customerId),
      supabase.from('service_history').select('*').eq('customer_id', customerId),
      supabase.from('invoices').select('*').eq('customer_id', customerId),
      supabase.from('reviews').select('*').eq('customer_id', customerId)
    ]);

    // 3. Render CRM Components
    renderCRMRevenue(invoices || []);
    renderCRMSnapshot(products || [], complaints || [], services || [], invoices || [], reviews || []);
    renderCRMAmcOverview(products || []);
    renderCRMProducts(products || []);
    renderCRMTimeline(complaints || [], services || [], invoices || [], reviews || []);
    renderCRMQuickActions(customerId);
    
    // 4. Hide Loading State
    document.getElementById('crm-loading-state').style.display = 'none';
    document.getElementById('crm-content').style.display = 'block';
    
  } catch (error) {
    console.error("Error loading CRM details:", error);
    showToast('error', 'Failed to load customer details.');
  }
}

function renderCRMRevenue(invoices) {
  let total = 0, paid = 0, pending = 0;
  
  invoices.forEach(i => {
    total += Number(i.amount) || 0;
    if (i.status === 'Paid') paid += Number(i.amount) || 0;
    else pending += Number(i.amount) || 0;
  });

  document.getElementById('crm-revenue').innerHTML = `
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase;">Total Billed</div>
      <div style="font-size:1.5rem; font-weight:bold; color:#fff;">₹${total.toFixed(2)}</div>
    </div>
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase;">Revenue Collected</div>
      <div style="font-size:1.5rem; font-weight:bold; color:#4ade80;">₹${paid.toFixed(2)}</div>
    </div>
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase;">Pending Revenue</div>
      <div style="font-size:1.5rem; font-weight:bold; color:#f87171;">₹${pending.toFixed(2)}</div>
    </div>
  `;
}

function renderCRMSnapshot(products, complaints, services, invoices, reviews) {
  const now = new Date();
  const openComplaints = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const pendingInvoices = invoices.filter(i => i.status !== 'Paid').length;
  const activeAmc = products.filter(p => p.amc_expiry && new Date(p.amc_expiry) > now).length;

  document.getElementById('crm-snapshot').innerHTML = `
    <div style="text-align:center; padding:0.5rem; border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#fff;">${products.length}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Products</div>
    </div>
    <div style="text-align:center; padding:0.5rem; border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#fff;">${complaints.length}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Complaints</div>
    </div>
    <div style="text-align:center; padding:0.5rem; border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#fff;">${services.length}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Services</div>
    </div>
    <div style="text-align:center; padding:0.5rem; border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#fff;">${invoices.length}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Invoices</div>
    </div>
    <div style="text-align:center; padding:0.5rem; border-right:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#f87171;">${pendingInvoices}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Pending Inv</div>
    </div>
    <div style="text-align:center; padding:0.5rem; border-right:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#4ade80;">${activeAmc}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Active AMC</div>
    </div>
    <div style="text-align:center; padding:0.5rem; border-right:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:1.25rem; font-weight:bold; color:#f59e0b;">${openComplaints}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Open Tickets</div>
    </div>
    <div style="text-align:center; padding:0.5rem;">
      <div style="font-size:1.25rem; font-weight:bold; color:#fff;">${reviews.length}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">Reviews</div>
    </div>
  `;
}

function renderCRMAmcOverview(products) {
  const now = new Date();
  let active = 0, expiring = 0, expired = 0;

  products.forEach(p => {
    if (p.amc_expiry) {
      const exp = new Date(p.amc_expiry);
      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      
      if (diff < 0) expired++;
      else if (diff <= 30) expiring++;
      else active++;
    }
  });

  document.getElementById('crm-amc').innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
      <span style="color:var(--text-muted);">Active Contracts</span>
      <span style="font-weight:bold; color:#4ade80;">${active}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
      <span style="color:var(--text-muted);">Expiring (30 days)</span>
      <span style="font-weight:bold; color:#f59e0b;">${expiring}</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <span style="color:var(--text-muted);">Expired Contracts</span>
      <span style="font-weight:bold; color:#ef4444;">${expired}</span>
    </div>
  `;
}

function renderCRMProducts(products) {
  if (products.length === 0) {
    document.getElementById('crm-products').innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:1rem; border:1px dashed rgba(255,255,255,0.1); border-radius:4px;">No products assigned.</div>`;
    return;
  }
  
  const top5 = products.slice(0, 5);
  document.getElementById('crm-products').innerHTML = top5.map(p => {
    const wExp = p.warranty_expiry ? new Date(p.warranty_expiry).toLocaleDateString('en-GB') : 'N/A';
    const aExp = p.amc_expiry ? new Date(p.amc_expiry).toLocaleDateString('en-GB') : 'N/A';
    return `
      <div style="background:rgba(0,0,0,0.2); padding:0.5rem 0.75rem; border-radius:4px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; font-size:0.9rem;">${p.product_name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Model: ${p.model_number || 'N/A'}</div>
        </div>
        <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
          <div>War: ${wExp}</div>
          <div>AMC: ${aExp}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCRMTimeline(complaints, services, invoices, reviews) {
  const events = [];

  complaints.forEach(c => {
    events.push({
      title: `Complaint Raised: ${c.ticket_number}`,
      desc: `Status: ${c.status}`,
      date: new Date(c.created_at)
    });
  });

  services.forEach(s => {
    events.push({
      title: `Service Visit: ${s.service_type}`,
      desc: `Tech: ${s.technician_name}`,
      date: new Date(s.created_at)
    });
  });

  invoices.forEach(i => {
    events.push({
      title: `Invoice Generated: ${i.invoice_number}`,
      desc: `Status: ${i.status} - ₹${i.amount}`,
      date: new Date(i.created_at)
    });
  });
  
  reviews.forEach(r => {
    events.push({
      title: `Review Left`,
      desc: `Rating: ${r.rating} / 5`,
      date: new Date(r.created_at)
    });
  });

  events.sort((a, b) => b.date - a.date);
  const recentEvents = events.slice(0, 10);

  if (recentEvents.length === 0) {
    document.getElementById('crm-timeline').innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:1rem; border:1px dashed rgba(255,255,255,0.1); border-radius:4px;">No account activity found.</div>`;
    return;
  }

  document.getElementById('crm-timeline').innerHTML = recentEvents.map(e => `
    <div class="activity-item" style="padding: 0.5rem 0;">
      <div style="width:10px; height:10px; border-radius:50%; background:var(--primary-color); margin-top:0.3rem;"></div>
      <div>
        <div style="font-weight:600; font-size:0.9rem;">${e.title}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${e.desc}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${e.date.toLocaleDateString('en-GB')}</div>
      </div>
    </div>
  `).join('');
}

function renderCRMQuickActions(customerId) {
  // Pass customer ID as URL param so other modules could theoretically filter by it if implemented.
  const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
  document.getElementById('crm-quick-actions').innerHTML = `
    <a href="${basePath}/admin/products.html?customer=${customerId}" class="btn btn-outline" style="text-align:left; font-size:0.85rem;">Hardware Inventory</a>
    <a href="${basePath}/admin/complaints.html?customer=${customerId}" class="btn btn-outline" style="text-align:left; font-size:0.85rem;">Support Tickets</a>
    <a href="${basePath}/admin/invoices.html?customer=${customerId}" class="btn btn-outline" style="text-align:left; font-size:0.85rem;">Billing History</a>
    <a href="${basePath}/admin/service-history.html?customer=${customerId}" class="btn btn-outline" style="text-align:left; font-size:0.85rem;">Service Records</a>
  `;
}
