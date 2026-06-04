/**
 * dashboard.js
 * Logic for Customer Dashboard Analytics
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isCustomer } from './user-context.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  currentUser = window.currentUser;
  
  if (!isCustomer()) {
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    window.location.href = basePath + '/login.html';
    return;
  }
  
  fetchDashboardData();
});

async function fetchDashboardData() {
  try {
    const id = currentUser.id;
    
    // Fire all queries concurrently
    const [
      { data: profileData },
      { data: productsData },
      { data: complaintsData },
      { data: servicesData },
      { data: invoicesData },
      { data: reviewsData }
    ] = await Promise.all([
      supabase.from('profiles').select('created_at').eq('id', id).single(),
      supabase.from('products').select('*').eq('customer_id', id),
      supabase.from('complaints').select('*').eq('customer_id', id),
      supabase.from('service_history').select('*').eq('customer_id', id),
      supabase.from('invoices').select('*').eq('customer_id', id),
      supabase.from('reviews').select('*').eq('customer_id', id).eq('status', 'Approved')
    ]);

    const products = productsData || [];
    const complaints = complaintsData || [];
    const services = servicesData || [];
    const invoices = invoicesData || [];
    const reviews = reviewsData || [];
    
    renderCustomerSnapshot(profileData, products, services, complaints, invoices);
    renderKPIs(products, complaints, services, invoices);
    renderHealthScore(products, complaints, invoices);
    renderReviewReminder(reviews);
    renderAlerts(products);
    renderProductsPreview(products);
    renderActivityFeed(complaints, services, invoices, products);
    
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    showErrorState();
  }
}

function renderCustomerSnapshot(profile, products, services, complaints, invoices) {
  const snapshotGrid = document.getElementById('snapshot-grid');
  if (!snapshotGrid) return;
  
  const sinceDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'N/A';
  
  snapshotGrid.innerHTML = `
    <div>
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Products Installed</div>
      <div style="font-size:1.5rem; color:#fff; font-weight:600;">${products.length}</div>
    </div>
    <div>
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Service Visits</div>
      <div style="font-size:1.5rem; color:#fff; font-weight:600;">${services.length}</div>
    </div>
    <div>
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Total Invoices</div>
      <div style="font-size:1.5rem; color:#fff; font-weight:600;">${invoices.length}</div>
    </div>
    <div>
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Customer Since</div>
      <div style="font-size:1.25rem; color:var(--primary-color); font-weight:600;">${sinceDate}</div>
    </div>
  `;
}

function renderKPIs(products, complaints, services, invoices) {
  const container = document.getElementById('kpi-container');
  if (!container) return;

  const now = new Date();
  
  let activeAmc = 0;
  let expiringAmc = 0;
  
  products.forEach(p => {
    if (p.amc_expiry) {
      const expiry = new Date(p.amc_expiry);
      if (expiry > now) activeAmc++;
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 30) expiringAmc++;
    }
  });

  const openComplaints = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  
  const pendingInvoices = invoices.filter(i => i.status !== 'Paid').length;

  container.innerHTML = `
    <div class="metric-card"><div class="metric-title">Installed Products</div><div class="metric-value">${products.length}</div></div>
    <div class="metric-card"><div class="metric-title">Active AMC Contracts</div><div class="metric-value" style="color:#4ade80;">${activeAmc}</div></div>
    <div class="metric-card"><div class="metric-title">AMC Expiring Soon</div><div class="metric-value" style="color:#fbbf24;">${expiringAmc}</div></div>
    <div class="metric-card"><div class="metric-title">Open Complaints</div><div class="metric-value" style="color:#ef4444;">${openComplaints}</div></div>
    <div class="metric-card"><div class="metric-title">Resolved Complaints</div><div class="metric-value">${resolvedComplaints}</div></div>
    <div class="metric-card"><div class="metric-title">Total Service Visits</div><div class="metric-value">${services.length}</div></div>
    <div class="metric-card"><div class="metric-title">Total Invoices</div><div class="metric-value">${invoices.length}</div></div>
    <div class="metric-card"><div class="metric-title">Pending Invoices</div><div class="metric-value" style="color:#f87171;">${pendingInvoices}</div></div>
  `;
}

function renderHealthScore(products, complaints, invoices) {
  const container = document.getElementById('health-score-container');
  if (!container) return;

  const now = new Date();
  let score = 100;
  
  const openComplaints = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const pendingInvoices = invoices.filter(i => i.status !== 'Paid').length;
  
  let expiredAmc = 0;
  products.forEach(p => {
    if (p.amc_expiry) {
      if (new Date(p.amc_expiry) < now) expiredAmc++;
    }
  });

  score -= (openComplaints * 15);
  score -= (expiredAmc * 10);
  score -= (pendingInvoices * 5);

  let label, cssClass;
  if (score >= 90) { label = 'Excellent'; cssClass = 'health-excellent'; }
  else if (score >= 70) { label = 'Good'; cssClass = 'health-good'; }
  else if (score >= 50) { label = 'Attention Needed'; cssClass = 'health-attention'; }
  else { label = 'Critical'; cssClass = 'health-critical'; }

  container.innerHTML = `<div class="health-score-badge ${cssClass}">System Health: ${label}</div>`;
}

function renderReviewReminder(reviews) {
  const reminder = document.getElementById('review-reminder');
  if (reminder && reviews.length === 0) {
    reminder.style.display = 'block';
  }
}

function renderAlerts(products) {
  const container = document.getElementById('alerts-container');
  if (!container) return;

  let alertsHtml = '';
  const now = new Date();

  products.forEach(p => {
    // Check AMC
    if (p.amc_expiry) {
      const expiry = new Date(p.amc_expiry);
      const diffTime = expiry - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        alertsHtml += `<div class="alert-card alert-danger"><div><strong>AMC Expired:</strong> ${p.product_name}</div><a href="${window.basePath || ''}/dashboard/amc.html" class="btn btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem;">Renew</a></div>`;
      } else if (diffDays <= 30) {
        alertsHtml += `<div class="alert-card alert-warning"><div><strong>AMC Expiring in ${diffDays} days:</strong> ${p.product_name}</div><a href="${window.basePath || ''}/dashboard/amc.html" class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;">View</a></div>`;
      }
    }
    
    // Check Warranty
    if (p.warranty_expiry) {
      const expiry = new Date(p.warranty_expiry);
      const diffTime = expiry - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        alertsHtml += `<div class="alert-card alert-danger"><div><strong>Warranty Expired:</strong> ${p.product_name}</div></div>`;
      } else if (diffDays <= 30) {
        alertsHtml += `<div class="alert-card alert-warning"><div><strong>Warranty Expiring in ${diffDays} days:</strong> ${p.product_name}</div></div>`;
      }
    }
  });

  if (!alertsHtml) {
    alertsHtml = `<div style="padding:1rem; text-align:center; color:var(--text-muted); border: 1px dashed rgba(255,255,255,0.1); border-radius:8px;">No critical alerts or expirations.</div>`;
  }
  
  container.innerHTML = alertsHtml;
}

function renderProductsPreview(products) {
  const container = document.getElementById('products-preview-container');
  if (!container) return;
  
  if (products.length === 0) {
    container.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); border: 1px dashed rgba(255,255,255,0.1); border-radius:8px;">No products installed yet.</div>`;
    return;
  }

  // Show only top 3
  const topProducts = products.slice(0, 3);
  const now = new Date();

  container.innerHTML = topProducts.map(p => {
    let amcStatus = '<span style="color:#ef4444;">No AMC</span>';
    if (p.amc_expiry) {
       amcStatus = new Date(p.amc_expiry) > now ? '<span style="color:#4ade80;">Active</span>' : '<span style="color:#f87171;">Expired</span>';
    }
    
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; margin-bottom:0.5rem;">
        <div>
          <div style="font-weight:600; color:#fff; margin-bottom:0.25rem;">${p.product_name}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Model: ${p.model_number || 'N/A'}</div>
        </div>
        <div style="text-align:right; font-size:0.85rem;">
          <div>AMC: ${amcStatus}</div>
          <div><a href="${window.basePath || ''}/dashboard/products.html" style="color:var(--primary-color);">Details</a></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderActivityFeed(complaints, services, invoices, products) {
  const container = document.getElementById('activity-container');
  if (!container) return;

  const events = [];

  // Parse complaints
  complaints.forEach(c => {
    events.push({
      type: 'Complaint',
      title: `Complaint Logged: ${c.ticket_number}`,
      desc: c.issue_type,
      date: new Date(c.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    });
    if (c.status === 'Resolved' && c.resolved_at) {
      events.push({
        type: 'Resolution',
        title: `Complaint Resolved: ${c.ticket_number}`,
        desc: 'Issue has been successfully resolved.',
        date: new Date(c.resolved_at),
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
      });
    }
  });

  // Parse services
  services.forEach(s => {
    events.push({
      type: 'Service',
      title: `Service Visit: ${s.service_type}`,
      desc: s.service_details || 'Routine checkup.',
      date: new Date(s.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    });
  });

  // Parse invoices
  invoices.forEach(i => {
    events.push({
      type: 'Invoice',
      title: `Invoice Generated: ${i.invoice_number}`,
      desc: `Amount: $${i.amount} - ${i.status}`,
      date: new Date(i.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
    });
  });

  // Sort by date DESC
  events.sort((a, b) => b.date - a.date);
  const recentEvents = events.slice(0, 10);

  if (recentEvents.length === 0) {
    container.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); border: 1px dashed rgba(255,255,255,0.1); border-radius:8px;">No recent activity.</div>`;
    return;
  }

  container.innerHTML = recentEvents.map(e => `
    <div class="activity-item">
      <div style="flex-shrink:0; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">
        ${e.icon}
      </div>
      <div style="flex-grow:1;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
          <h4 style="margin:0; color:#fff; font-size:0.95rem;">${e.title}</h4>
          <span style="font-size:0.75rem; color:var(--text-muted);">${e.date.toLocaleDateString('en-GB')}</span>
        </div>
        <p style="margin:0; color:var(--text-muted); font-size:0.85rem;">${e.desc}</p>
      </div>
    </div>
  `).join('');
}

function showErrorState() {
  document.querySelectorAll('.skeleton').forEach(el => {
    el.style.animation = 'none';
    el.style.background = 'rgba(239, 68, 68, 0.1)';
  });
  console.error("Dashboard failed to render completely.");
}
