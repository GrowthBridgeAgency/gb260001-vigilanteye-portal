/**
 * admin-profile.js
 * Logic for Admin Profile & Account Settings
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { user, profile } = await loadCurrentUser();
  currentUser = user;
  currentProfile = profile;
  
  if (!isAdmin()) {
    window.location.href = '/login.html';
    return;
  }
  
  // Attach Event Listeners
  document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
  document.getElementById('password-form').addEventListener('submit', handlePasswordUpdate);
  
  fetchProfileData();
});

async function fetchProfileData() {
  try {
    // Concurrent fetch for platform summary & timeline
    const [
      { data: customers },
      { data: products },
      { data: complaints },
      { data: services },
      { data: invoices },
      { data: reviews },
      { data: enquiries }
    ] = await Promise.all([
      supabase.from('profiles').select('id').eq('role', 'customer'),
      supabase.from('products').select('id'),
      supabase.from('complaints').select('ticket_number, issue_type, created_at'),
      supabase.from('service_history').select('service_type, created_at'),
      supabase.from('invoices').select('invoice_number, amount, status, created_at'),
      supabase.from('reviews').select('rating, created_at'),
      supabase.from('enquiries').select('name, subject, created_at')
    ]);
    
    // Render Basic Info
    renderBasicInfo();
    
    // Render Widgets
    renderCompletionWidget();
    renderPlatformSummary(customers || [], products || [], complaints || [], services || [], invoices || []);
    renderActivityTimeline(complaints || [], services || [], invoices || [], reviews || [], enquiries || []);
    
  } catch (error) {
    console.error("Error loading admin profile data:", error);
    showToast('error', 'Failed to load platform data.');
  }
}

function renderBasicInfo() {
  // Populate Edit Form
  document.getElementById('prof_name').value = currentProfile.name || '';
  document.getElementById('prof_phone').value = currentProfile.phone || '';
  
  // Populate Read-Only Fields
  document.getElementById('read_email').textContent = currentProfile.email || 'N/A';
  document.getElementById('read_role').textContent = currentProfile.role || 'admin';
  
  const createdDate = new Date(currentProfile.created_at);
  const now = new Date();
  const diffTime = Math.abs(now - createdDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  document.getElementById('read_since').innerHTML = `
    <div style="font-weight:600; color:#fff;">${createdDate.toLocaleDateString('en-GB')}</div>
    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Member for ${diffDays} days</div>
  `;
}

function renderCompletionWidget() {
  let score = 0;
  if (currentProfile.name && currentProfile.name.trim() !== '') score += 50;
  if (currentProfile.phone && currentProfile.phone.trim() !== '') score += 50;
  
  const bar = document.getElementById('completion-bar');
  const text = document.getElementById('completion-text');
  
  if (bar && text) {
    bar.style.width = `${score}%`;
    text.textContent = `${score}%`;
    
    if (score === 100) {
      bar.style.background = '#4ade80'; // green
    } else if (score === 50) {
      bar.style.background = '#fbbf24'; // yellow
    } else {
      bar.style.background = '#ef4444'; // red
    }
  }
}

function renderPlatformSummary(customers, products, complaints, services, invoices) {
  const container = document.getElementById('summary-grid');
  if (!container) return;
  
  let totalRevenue = 0;
  invoices.forEach(i => totalRevenue += (Number(i.amount) || 0));

  container.innerHTML = `
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:1.5rem; font-weight:bold; color:#fff;">${customers.length}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Total Customers</div>
    </div>
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:1.5rem; font-weight:bold; color:#fff;">${products.length}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Total Products</div>
    </div>
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:1.5rem; font-weight:bold; color:#fff;">${complaints.length}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Total Complaints</div>
    </div>
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
      <div style="font-size:1.5rem; font-weight:bold; color:#fff;">${services.length}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Service Visits</div>
    </div>
    <div style="background:rgba(255,255,255,0.02); padding:1rem; border:1px solid rgba(255,255,255,0.05); border-radius:8px; text-align:center; grid-column: 1 / -1;">
      <div style="font-size:1.5rem; font-weight:bold; color:#4ade80;">₹${totalRevenue.toFixed(2)}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Total Platform Revenue</div>
    </div>
  `;
}

function renderActivityTimeline(complaints, services, invoices, reviews, enquiries) {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  const events = [];

  complaints.forEach(c => {
    events.push({
      title: `Complaint Logged: ${c.ticket_number}`,
      desc: c.issue_type,
      date: new Date(c.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    });
  });

  services.forEach(s => {
    events.push({
      title: `Service Visit Logged`,
      desc: s.service_type,
      date: new Date(s.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    });
  });

  invoices.forEach(i => {
    events.push({
      title: `Invoice Generated: ${i.invoice_number}`,
      desc: `Amount: ₹${i.amount} - ${i.status}`,
      date: new Date(i.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
    });
  });
  
  reviews.forEach(r => {
    events.push({
      title: `Review Left`,
      desc: `Rating: ${r.rating} stars`,
      date: new Date(r.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
    });
  });

  enquiries.forEach(e => {
    events.push({
      title: `New Enquiry from ${e.name}`,
      desc: e.subject,
      date: new Date(e.created_at),
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>'
    });
  });

  events.sort((a, b) => b.date - a.date);
  const recentEvents = events.slice(0, 10);

  if (recentEvents.length === 0) {
    container.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); border: 1px dashed rgba(255,255,255,0.1); border-radius:8px;">No platform activity yet.</div>`;
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

// ==========================================
// ACTIONS
// ==========================================

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-profile');
  const originalText = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;
  
  const name = document.getElementById('prof_name').value.trim();
  const phone = document.getElementById('prof_phone').value.trim();
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ name, phone })
      .eq('id', currentUser.id);
      
    if (error) throw error;
    
    // Update local context
    currentProfile.name = name;
    currentProfile.phone = phone;
    
    // Rerender completion widget
    renderCompletionWidget();
    
    showToast('success', 'Admin profile updated successfully!');
  } catch (error) {
    console.error("Profile update error:", error);
    showToast('error', error.message || 'Failed to update profile.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handlePasswordUpdate(e) {
  e.preventDefault();
  
  const newPass = document.getElementById('sec_password').value;
  const confirmPass = document.getElementById('sec_confirm').value;
  
  if (newPass !== confirmPass) {
    showToast('error', 'Passwords do not match.');
    return;
  }
  if (newPass.length < 8) {
    showToast('error', 'Password must be at least 8 characters.');
    return;
  }
  
  const btn = document.getElementById('btn-save-password');
  const originalText = btn.textContent;
  btn.textContent = 'Updating...';
  btn.disabled = true;
  
  try {
    // Update password securely via Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: newPass
    });
    
    if (error) throw error;
    
    showToast('success', 'Admin password updated successfully!');
    document.getElementById('password-form').reset();
    
  } catch (error) {
    console.error("Password update error:", error);
    showToast('error', error.message || 'Failed to update password.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
