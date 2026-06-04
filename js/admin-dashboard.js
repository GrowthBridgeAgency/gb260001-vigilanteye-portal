/**
 * admin-dashboard.js
 * Master Analytics Engine
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

// Raw Datasets
let db = {
  profiles: [],
  products: [],
  complaints: [],
  technicians: [],
  invoices: [],
  reviews: [],
  enquiries: [],
  services: []
};

// Filtered Datasets
let fd = {};

// Chart Instances
let charts = { rev: null, comp: null, funnel: null, serv: null };
window.charts = charts;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access.', 'error');
    setTimeout(() => window.location.href = '/login.html', 1500);
    return;
  }

  document.getElementById('global-date-filter').addEventListener('change', processData);

  await fetchAllData();
});

async function fetchAllData() {
  const overlay = document.getElementById('loading-overlay');
  const content = document.getElementById('analytics-content');
  
  try {
    const queries = [
      supabase.from('profiles').select('id, name, created_at, role').eq('role', 'customer'),
      supabase.from('products').select('id, customer_id, product_name, amc_status, amc_expiry, created_at'),
      supabase.from('complaints').select('id, customer_id, ticket_number, status, created_at, updated_at'),
      supabase.from('technicians').select('id, technician_name, is_active'),
      supabase.from('invoices').select('id, invoice_number, amount, status, invoice_date, created_at'),
      supabase.from('reviews').select('id, rating, approved, created_at'),
      supabase.from('enquiries').select('id, status, created_at'),
      supabase.from('service_history').select('id, customer_id, service_date, service_type, technician_name')
    ];

    const results = await Promise.all(queries);

    // Gracefully handle errors per table
    results.forEach((res, i) => { 
      if (res.error) {
        console.error(`Dashboard Query ${i} Failed:`, res.error);
        res.data = []; // Fallback to empty array to prevent dashboard crash
      } 
    });

    db.profiles = results[0].data || [];
    db.products = results[1].data || [];
    db.complaints = results[2].data || [];
    db.technicians = results[3].data || [];
    db.invoices = results[4].data || [];
    db.reviews = results[5].data || [];
    db.enquiries = results[6].data || [];
    db.services = results[7].data || [];

    overlay.style.display = 'none';
    content.style.display = 'block';

    processData(); // Initial render

  } catch (err) {
    console.error('Master Fetch Error:', err);
    overlay.innerHTML = `<span style="color:#ef4444;">Failed to load analytics: ${err.message}</span>`;
  }
}

// --- FILTERING ---
function filterByDate(array, dateField, filterRange) {
  if (filterRange === 'all') return array;
  
  const now = new Date();
  const start = new Date(now);
  start.setHours(0,0,0,0);

  if (filterRange === 'today') {
    // start is already midnight today
  } else if (filterRange === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
    start.setDate(diff);
  } else if (filterRange === 'month') {
    start.setDate(1);
  } else if (filterRange === 'year') {
    start.setMonth(0, 1);
  }

  return array.filter(item => {
    if (!item[dateField]) return false;
    const d = new Date(item[dateField]);
    return d >= start;
  });
}

function processData() {
  const range = document.getElementById('global-date-filter').value;
  
  fd.profiles = filterByDate(db.profiles, 'created_at', range);
  fd.products = filterByDate(db.products, 'created_at', range);
  fd.complaints = filterByDate(db.complaints, 'created_at', range);
  // Techs generally all time, but lets filter by created_at if requested (though total usually static)
  fd.technicians = db.technicians; 
  fd.invoices = filterByDate(db.invoices, 'invoice_date', range);
  fd.reviews = filterByDate(db.reviews, 'created_at', range);
  fd.enquiries = filterByDate(db.enquiries, 'created_at', range);
  fd.services = filterByDate(db.services, 'service_date', range);

  renderFinancials();
  renderComplaints();
  renderLeads();
  renderHardware();
  renderSecondary();
  renderTables();
  buildActivityFeed();
  renderCharts();
}

// --- RENDERING KPIs ---

function renderFinancials() {
  let totalRev = 0;
  let outRev = 0;
  let paidCount = 0;

  fd.invoices.forEach(inv => {
    const amt = parseFloat(inv.amount) || 0;
    if (inv.status === 'Paid') {
      totalRev += amt;
      paidCount++;
    } else {
      outRev += amt;
    }
  });

  const avgRev = paidCount > 0 ? (totalRev / paidCount) : 0;

  // Monthly logic (always this month regardless of global filter for the explicit monthly card)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  let monthRev = 0;
  db.invoices.forEach(inv => {
    if (inv.status === 'Paid') {
      if (new Date(inv.invoice_date) >= startOfMonth) monthRev += parseFloat(inv.amount) || 0;
    }
  });

  document.getElementById('kpi-rev-total').textContent = `₹${totalRev.toLocaleString()}`;
  document.getElementById('kpi-rev-monthly').textContent = `₹${monthRev.toLocaleString()}`;
  document.getElementById('kpi-rev-avg').textContent = `₹${Math.round(avgRev).toLocaleString()}`;
  document.getElementById('kpi-rev-out').textContent = `₹${outRev.toLocaleString()}`;
}

function renderComplaints() {
  let open = 0, prog = 0, res = 0;
  let aging7 = 0;
  let totalResTime = 0, resCount = 0;

  const now = new Date();

  fd.complaints.forEach(c => {
    if (c.status === 'Open') open++;
    else if (c.status === 'In Progress') prog++;
    else if (c.status === 'Resolved' || c.status === 'Closed') res++;

    // Aging: Open for > 7 days
    if (c.status === 'Open' || c.status === 'Assigned') {
      const created = new Date(c.created_at);
      const diffDays = (now - created) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) aging7++;
    }

    // SLA: Avg resolution
    if (c.status === 'Resolved' || c.status === 'Closed') {
      if (c.updated_at) {
        const diffHrs = (new Date(c.updated_at) - new Date(c.created_at)) / (1000 * 60 * 60);
        totalResTime += diffHrs;
        resCount++;
      }
    }
  });

  const avgSla = resCount > 0 ? Math.round(totalResTime / resCount) : 0;

  document.getElementById('kpi-comp-open').textContent = open;
  document.getElementById('kpi-comp-prog').textContent = prog;
  document.getElementById('kpi-comp-res').textContent = res;
  document.getElementById('kpi-comp-aging').textContent = aging7;
  document.getElementById('kpi-comp-sla').textContent = avgSla > 0 ? `${avgSla} Hrs` : '-';
}

function renderLeads() {
  const total = fd.enquiries.length;
  let conv = 0;
  fd.enquiries.forEach(e => {
    if (e.status === 'Converted') conv++;
  });
  
  const rate = total > 0 ? Math.round((conv / total) * 100) : 0;

  document.getElementById('kpi-lead-total').textContent = total;
  document.getElementById('kpi-lead-conv').textContent = conv;
  document.getElementById('kpi-lead-rate').textContent = `${rate}%`;
}

function renderHardware() {
  const total = fd.products.length;
  let amcActive = 0, amcExpiring = 0, amcExpired = 0;

  const now = new Date();
  const next30 = new Date(now);
  next30.setDate(now.getDate() + 30);

  // We use db.products for AMC tracking to see global state usually, 
  // but we'll respect fd.products if they want to see AMC for products installed this month.
  fd.products.forEach(p => {
    if (p.amc_status === 'Active') {
      amcActive++;
      if (p.amc_expiry) {
        const exp = new Date(p.amc_expiry);
        if (exp < now) {
          amcExpired++; amcActive--;
        } else if (exp <= next30) {
          amcExpiring++;
        }
      }
    } else {
      amcExpired++; // Inactive is treated as expired here
    }
  });

  document.getElementById('kpi-prod-total').textContent = total;
  document.getElementById('kpi-amc-active').textContent = amcActive;
  document.getElementById('kpi-amc-expiring').textContent = amcExpiring;
  document.getElementById('kpi-amc-expired').textContent = amcExpired;
}

function renderSecondary() {
  document.getElementById('kpi-cust-total').textContent = db.profiles.length; // Global customer count
  
  let activeTechs = 0;
  db.technicians.forEach(t => { if(t.is_active) activeTechs++; });
  document.getElementById('kpi-tech-total').textContent = db.technicians.length;
  document.getElementById('kpi-tech-active').textContent = activeTechs;

  let score = 0, approvedCount = 0;
  fd.reviews.forEach(r => {
    if (r.approved) { score += r.rating; approvedCount++; }
  });
  const avgRev = approvedCount > 0 ? (score / approvedCount).toFixed(1) : '0.0';
  document.getElementById('kpi-rev-rating').textContent = `${avgRev} ★`;
}

function renderTables() {
  // Top Customers
  const custStats = {};
  db.profiles.forEach(c => custStats[c.id] = { name: c.name, prods: 0, comps: 0, srv: 0 });
  
  fd.products.forEach(p => { if(custStats[p.customer_id]) custStats[p.customer_id].prods++; });
  fd.complaints.forEach(c => { if(custStats[c.customer_id]) custStats[c.customer_id].comps++; });
  fd.services.forEach(s => { if(custStats[s.customer_id]) custStats[s.customer_id].srv++; });

  const topCusts = Object.values(custStats)
    .sort((a, b) => b.prods - a.prods || b.comps - a.comps)
    .slice(0, 5);

  document.getElementById('table-customers').innerHTML = topCusts.map(c => `
    <tr>
      <td>${c.name}</td>
      <td style="text-align:center;">${c.prods}</td>
      <td style="text-align:center; color:var(--text-muted);">${c.comps} / ${c.srv}</td>
    </tr>
  `).join('') || '<tr><td colspan="3">No data.</td></tr>';

  // Top Products
  const prodStats = {};
  fd.products.forEach(p => {
    prodStats[p.product_name] = (prodStats[p.product_name] || 0) + 1;
  });
  const topProds = Object.entries(prodStats).sort((a,b) => b[1]-a[1]).slice(0,5);
  document.getElementById('table-products').innerHTML = topProds.map(p => `
    <tr><td>${p[0]}</td><td style="text-align:center;">${p[1]}</td></tr>
  `).join('') || '<tr><td colspan="2">No data.</td></tr>';

  // Tech Performance
  const techStats = {};
  db.technicians.forEach(t => techStats[t.technician_name] = 0);
  fd.services.forEach(s => {
    if(s.technician_name) techStats[s.technician_name] = (techStats[s.technician_name] || 0) + 1;
  });
  const topTechs = Object.entries(techStats).sort((a,b) => b[1]-a[1]).slice(0,5);
  document.getElementById('table-techs').innerHTML = topTechs.map(t => `
    <tr><td>${t[0]}</td><td style="text-align:center;">${t[1]}</td></tr>
  `).join('') || '<tr><td colspan="2">No data.</td></tr>';
}

function buildActivityFeed() {
  const feed = [];
  
  fd.complaints.forEach(c => feed.push({
    type: 'Complaint',
    title: `Ticket ${c.ticket_number}`,
    meta: `Status: ${c.status}`,
    date: new Date(c.created_at),
    color: '#fca5a5'
  }));
  
  fd.invoices.forEach(i => feed.push({
    type: 'Invoice',
    title: `Inv ${i.invoice_number}`,
    meta: `₹${i.amount} - ${i.status}`,
    date: new Date(i.created_at),
    color: '#86efac'
  }));

  fd.reviews.forEach(r => { if(r.approved) feed.push({
    type: 'Review',
    title: `${r.rating} Star Review`,
    meta: `Approved`,
    date: new Date(r.created_at),
    color: '#fcd34d'
  })});

  fd.enquiries.forEach(e => feed.push({
    type: 'Lead',
    title: `New Enquiry`,
    meta: `Status: ${e.status}`,
    date: new Date(e.created_at),
    color: '#93c5fd'
  }));

  fd.services.forEach(s => feed.push({
    type: 'Service',
    title: `${s.service_type}`,
    meta: `Tech: ${s.technician_name}`,
    date: new Date(s.service_date),
    color: '#d8b4fe'
  }));

  feed.sort((a, b) => b.date - a.date);
  const topFeed = feed.slice(0, 10);

  const container = document.getElementById('activity-feed');
  if (topFeed.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); padding:1rem;">No recent activity found.</div>';
    return;
  }

  container.innerHTML = topFeed.map(f => `
    <div class="activity-item" style="border-left-color: ${f.color} !important;">
      <div>
        <div style="color:${f.color}; font-size:0.75rem; text-transform:uppercase; font-weight:600;">${f.type}</div>
        <div style="font-weight:600; color:#fff;">${f.title}</div>
        <div class="activity-meta">${f.meta}</div>
      </div>
      <div style="color:var(--text-muted); font-size:0.8rem;">
        ${f.date.toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}
      </div>
    </div>
  `).join('');
}

// --- CHARTING ---

Chart.defaults.color = '#9ca3af';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.04)';
Chart.defaults.font.family = "'Inter', 'system-ui', sans-serif";
Chart.defaults.font.size = 12;

function renderCharts() {
  renderRevChart();
  renderCompChart();
  renderFunnelChart();
  renderServChart();
}

function renderRevChart() {
  const canvas = document.getElementById('chart-revenue');
  if (charts.rev) charts.rev.destroy();

  // Group by month
  const months = {};
  for(let i=5; i>=0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0;
  }

  db.invoices.forEach(inv => {
    if (inv.status === 'Paid') {
      const d = new Date(inv.invoice_date);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (months[k] !== undefined) months[k] += parseFloat(inv.amount);
    }
  });

  let gradient = null;
  if(canvas && canvas.getContext) {
    const ctx2d = canvas.getContext('2d');
    gradient = ctx2d.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(74, 222, 128, 0.4)');
    gradient.addColorStop(1, 'rgba(74, 222, 128, 0.0)');
  }

  charts.rev = new Chart(canvas, {
    type: 'line',
    data: {
      labels: Object.keys(months).map(m => m.substring(5)),
      datasets: [{
        label: 'Revenue',
        data: Object.values(months),
        borderColor: '#4ade80',
        backgroundColor: gradient || 'rgba(74, 222, 128, 0.1)',
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#4ade80',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true
      }]
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      animation: { duration: 2000, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#4ade80',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: false
        }
      },
      scales: {
        y: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { border: { display: false }, grid: { display: false } }
      }
    }
  });
}

function renderCompChart() {
  const ctx = document.getElementById('chart-complaints');
  if (charts.comp) charts.comp.destroy();

  let o=0, p=0, r=0, a=0;
  fd.complaints.forEach(c => {
    if(c.status==='Open') o++;
    else if(c.status==='Assigned') a++;
    else if(c.status==='In Progress') p++;
    else if(c.status==='Resolved'||c.status==='Closed') r++;
  });

  charts.comp = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Open', 'Assigned', 'In Prog', 'Resolved'],
      datasets: [{
        data: [o, a, p, r],
        backgroundColor: ['#f87171', '#60a5fa', '#fcd34d', '#4ade80'],
        borderWidth: 2,
        borderColor: '#050505',
        hoverOffset: 8
      }]
    },
    options: { 
      responsive: true, maintainAspectRatio: false, cutout: '75%', 
      animation: { animateScale: true, animateRotate: true, duration: 1500, easing: 'easeOutCirc' },
      plugins: {
        legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)', padding: 15, font: { size: 11 } } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10 }
      }
    }
  });
}

function renderFunnelChart() {
  const ctx = document.getElementById('chart-funnel');
  if (charts.funnel) charts.funnel.destroy();

  let n=0, c=0, q=0, cv=0;
  fd.enquiries.forEach(e => {
    if(e.status==='New') n++;
    else if(e.status==='Contacted') c++;
    else if(e.status==='Qualified') q++;
    else if(e.status==='Converted') cv++;
  });

  charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['New', 'Contact', 'Qual.', 'Won'],
      datasets: [{
        label: 'Leads',
        data: [n, c, q, cv],
        backgroundColor: ['rgba(156,163,175,0.8)', 'rgba(96,165,250,0.8)', 'rgba(252,211,77,0.8)', 'rgba(74,222,128,0.8)'],
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      indexAxis: 'y',
      animation: { duration: 1500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10 }
      },
      scales: {
        x: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { border: { display: false }, grid: { display: false } }
      }
    }
  });
}

function renderServChart() {
  const canvas = document.getElementById('chart-services');
  if (charts.serv) charts.serv.destroy();

  const months = {};
  for(let i=5; i>=0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0;
  }

  db.services.forEach(s => {
    const d = new Date(s.service_date);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (months[k] !== undefined) months[k]++;
  });

  charts.serv = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Object.keys(months).map(m => m.substring(5)),
      datasets: [{
        label: 'Service Visits',
        data: Object.values(months),
        backgroundColor: 'rgba(168, 85, 247, 0.7)',
        borderColor: '#a855f7',
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(168, 85, 247, 1)'
      }]
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      animation: { duration: 1500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.85)',
          titleColor: '#fff',
          bodyColor: '#a855f7',
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: false
        }
      },
      scales: {
        y: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { precision: 0 } },
        x: { border: { display: false }, grid: { display: false } }
      }
    }
  });
}
