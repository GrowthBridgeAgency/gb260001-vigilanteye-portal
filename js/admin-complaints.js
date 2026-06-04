/**
 * admin-complaints.js
 * Core logic for Admin Complaint Management
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let complaints = [];
let technicians = [];
let searchTerm = '';
let statusFilter = 'all';
let priorityFilter = 'all';
let technicianFilter = 'all';
let searchTimeout = null;

// DOM
const tbody = document.getElementById('complaints-tbody');
const searchInput = document.getElementById('search-input');
const statusSelect = document.getElementById('filter-status');
const prioritySelect = document.getElementById('filter-priority');
const techSelect = document.getElementById('filter-technician');

const manageForm = document.getElementById('manage-form');
const btnSaveManage = document.getElementById('btn-save-management');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : ''); setTimeout(() => window.location.href = basePath + '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchData();

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderTable, 300);
  });

  statusSelect.addEventListener('change', (e) => { statusFilter = e.target.value; renderTable(); });
  prioritySelect.addEventListener('change', (e) => { priorityFilter = e.target.value; renderTable(); });
  techSelect.addEventListener('change', (e) => { technicianFilter = e.target.value; renderTable(); });

  btnSaveManage.addEventListener('click', handleSaveManagement);
});

// ==========================================
// FETCH LOGIC
// ==========================================

async function fetchData() {
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading complaints...</td></tr>';
  
  try {
    // 1. Fetch Techs
    const { data: techs, error: tErr } = await supabase
      .from('technicians')
      .select('id, technician_name, mobile, specialization')
      .eq('is_active', true)
      .order('technician_name');
      
    if (tErr) throw tErr;
    technicians = techs;
    
    // Populate tech dropdowns
    const techOptions = techs.map(t => `<option value="${t.id}">${t.technician_name} (${t.specialization})</option>`).join('');
    techSelect.innerHTML = '<option value="all">All Technicians</option>' + techOptions;
    document.getElementById('manage_technician').innerHTML = '<option value="">-- Unassigned --</option>' + techOptions;

    // 2. Fetch Complaints
    const { data: comps, error: cErr } = await supabase
      .from('complaints')
      .select(`
        *,
        profiles (name, phone),
        products (product_name, model_number),
        technicians (technician_name)
      `)
      .order('created_at', { ascending: false });

    if (cErr) throw cErr;
    complaints = comps;
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load data.</td></tr>';
  }
}

// ==========================================
// RENDER TABLE
// ==========================================

function getBadgeClass(status) {
  status = status?.toLowerCase() || '';
  if (status === 'open') return 'status-open';
  if (status === 'assigned') return 'status-assigned';
  if (status === 'in progress') return 'status-progress';
  if (status === 'resolved') return 'status-resolved';
  if (status === 'closed') return 'status-closed';
  return '';
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTable() {
  let filtered = complaints.filter(c => {
    // Search
    if (searchTerm) {
      const matchTicket = c.ticket_number?.toLowerCase().includes(searchTerm);
      const matchCust = c.profiles?.name?.toLowerCase().includes(searchTerm);
      const matchProd = c.products?.product_name?.toLowerCase().includes(searchTerm);
      if (!matchTicket && !matchCust && !matchProd) return false;
    }
    // Filters
    if (statusFilter === 'all' && c.status === 'Resolved') return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
    if (technicianFilter !== 'all' && String(c.technician_id) !== technicianFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">No complaints found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td style="font-weight:600; color:var(--primary-color);">${c.ticket_number}</td>
      <td>${c.profiles?.name || 'Unknown'}</td>
      <td>${c.products?.product_name || '-'}</td>
      <td>${c.issue_type}</td>
      <td class="priority-${c.priority?.toLowerCase()}">${c.priority}</td>
      <td><span class="status-badge ${getBadgeClass(c.status)}">${c.status}</span></td>
      <td style="color:var(--text-muted);">${c.technicians?.technician_name || 'Unassigned'}</td>
      <td style="color:var(--text-muted);">${formatDate(c.created_at)}</td>
      <td>
        <div class="actions-cell" style="justify-content:center;">
          <button class="action-btn" title="View" onclick="window.viewComplaint(${c.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="action-btn" title="Manage" onclick="window.manageComplaint(${c.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==========================================
// MANAGE MODAL
// ==========================================

window.manageComplaint = function(id) {
  const c = complaints.find(x => x.id === id);
  if (!c) return;

  manageForm.reset();
  document.getElementById('manage-ticket-title').textContent = `Manage Ticket: ${c.ticket_number}`;
  
  document.getElementById('manage_id').value = c.id;
  document.getElementById('manage_status').value = c.status || 'Open';
  document.getElementById('manage_technician').value = c.technician_id || '';
  document.getElementById('manage_admin_notes').value = c.admin_notes || '';
  document.getElementById('manage_resolution_notes').value = c.resolution_notes || '';

  window.openModal('manage-modal');
};

async function handleSaveManagement(e) {
  e.preventDefault();
  
  const id = document.getElementById('manage_id').value;
  const newStatus = document.getElementById('manage_status').value;
  const newTechId = document.getElementById('manage_technician').value || null;
  const adminNotes = document.getElementById('manage_admin_notes').value.trim() || null;
  const resNotes = document.getElementById('manage_resolution_notes').value.trim() || null;

  const originalComplaint = complaints.find(x => x.id == id);
  if (!originalComplaint) return;

  btnSaveManage.disabled = true;
  btnSaveManage.textContent = 'Saving...';

  try {
    let assignedName = null;
    if (newTechId) {
      const techObj = technicians.find(t => t.id == newTechId);
      if (techObj) assignedName = techObj.technician_name;
    }

    const payload = {
      status: newStatus,
      technician_id: newTechId,
      assigned_to: assignedName,
      admin_notes: adminNotes,
      resolution_notes: resNotes,
      updated_at: new Date().toISOString()
    };

    const { error: updErr } = await supabase
      .from('complaints')
      .update(payload)
      .eq('id', id);

    if (updErr) throw updErr;

    // Detect Changes for Timeline
    let timelineNote = '';
    
    // If technician changed
    if (originalComplaint.technician_id != newTechId && newTechId) {
      timelineNote += `Assigned to ${assignedName}. `;
      // Auto-update status to Assigned if it was Open
      if (originalComplaint.status === 'Open' && newStatus === 'Open') {
        payload.status = 'Assigned';
        await supabase.from('complaints').update({ status: 'Assigned' }).eq('id', id);
      }
    }
    
    // If status changed, create specific note or generic
    if (originalComplaint.status !== newStatus) {
      if (newStatus === 'In Progress') timelineNote += 'Technician started work. ';
      else if (newStatus === 'Resolved') timelineNote += 'Issue resolved successfully. ';
      else if (newStatus === 'Closed') timelineNote += 'Ticket closed. ';
      else timelineNote += `Status updated to ${newStatus}. `;
    }

    // Only insert to timeline if there's a status or technician change
    if (timelineNote || originalComplaint.status !== newStatus || originalComplaint.technician_id != newTechId) {
      if (!timelineNote) timelineNote = `Status changed to ${payload.status || newStatus}`;
      
      await supabase.from('complaint_updates').insert([{
        complaint_id: id,
        status: payload.status || newStatus,
        note: timelineNote.trim()
      }]);
    }

    showToast('Complaint updated successfully.', 'success');
    window.closeModal('manage-modal');
    fetchData(); // Refresh

    // AUTO-INSERT SERVICE RECORD
    if (originalComplaint.status !== 'Resolved' && newStatus === 'Resolved') {
      try {
        const servicePayload = {
          customer_id: originalComplaint.customer_id,
          product_id: parseInt(originalComplaint.product_id, 10),
          complaint_id: parseInt(id, 10),
          service_date: new Date().toISOString().split('T')[0],
          service_type: 'Complaint Resolution',
          technician_name: assignedName || '',
          service_details: `[OUTCOME: Completed] ${resNotes || adminNotes || 'Complaint marked as resolved automatically.'}`
        };
        await supabase.from('service_history').insert([servicePayload]);
      } catch (err) {
        console.error('Auto-service record error:', err);
      }
    }

  } catch (error) {
    console.error('Update error:', error);
    showToast(`Failed to update complaint: ${error.message}`, 'error');
  } finally {
    btnSaveManage.disabled = false;
    btnSaveManage.textContent = 'Save Updates';
  }
}

// ==========================================
// VIEW MODAL & WHATSAPP
// ==========================================

window.viewComplaint = async function(id) {
  const c = complaints.find(x => x.id === id);
  if (!c) return;

  document.getElementById('view-ticket-no').textContent = `Ticket: ${c.ticket_number}`;
  const body = document.getElementById('view-modal-body');
  
  // Setup WhatsApp Button
  const waBtn = document.getElementById('whatsapp-btn');
  if (c.profiles?.phone) {
    // Format: 91XXXXXXXXXX
    let phone = c.profiles.phone.replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;
    
    const msg = `Hello ${c.profiles.name},\n\nThis is regarding your VigilantEye Ticket ${c.ticket_number}.\nIssue: ${c.issue_type}\nStatus: ${c.status}\n\n`;
    waBtn.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    waBtn.style.display = 'inline-flex';
  } else {
    waBtn.style.display = 'none';
  }

  body.innerHTML = '<div style="text-align:center; padding:2rem;">Loading timeline...</div>';
  window.openModal('view-modal');

  // Fetch timeline
  const { data: updates, error: upErr } = await supabase
    .from('complaint_updates')
    .select('*')
    .eq('complaint_id', id)
    .order('created_at', { ascending: true });

  const tech = c.technicians;
  const techBlock = tech 
    ? `<div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:4px; margin-bottom:1.5rem; border:1px solid rgba(255,255,255,0.05);">
         <h4 style="margin:0 0 0.5rem 0; color:var(--text-main);">Assigned Technician</h4>
         <p style="margin:0; font-size:0.9rem;"><strong>Name:</strong> ${tech.technician_name}</p>
       </div>`
    : `<div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:4px; margin-bottom:1.5rem; border:1px solid rgba(255,255,255,0.05); color:var(--text-muted); font-size:0.9rem;">
         No technician assigned yet.
       </div>`;

  let mediaHtml = '';
  if (c.image_url || c.video_url) {
    mediaHtml = `<h4 style="margin:1.5rem 0 0.5rem 0; color:var(--text-main);">Attached Media</h4><div class="media-preview-container">`;
    if (c.image_url) mediaHtml += `<a href="${c.image_url}" target="_blank" class="media-preview"><img src="${c.image_url}" alt="Attachment"></a>`;
    if (c.video_url) mediaHtml += `<div class="media-preview"><video src="${c.video_url}" controls></video></div>`;
    mediaHtml += `</div>`;
  }

  const timelineHtml = (updates || []).map(u => `
    <div class="timeline-item">
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <span class="timeline-date">${formatDate(u.created_at)}</span>
        <div class="timeline-status" style="color:var(--text-main);">${u.status}</div>
        <p class="timeline-note">${u.note || '-'}</p>
      </div>
    </div>
  `).join('');

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
      <div>
        <h3 style="margin:0 0 0.25rem 0; color:var(--text-main);">${c.profiles?.name || 'Unknown Customer'}</h3>
        <p style="margin:0; color:var(--primary-color);">${c.products?.product_name || 'Unknown Product'}</p>
        <p style="margin:0.25rem 0 0 0; font-size:0.9rem; color:var(--text-muted);">${c.issue_type} • <span class="priority-${c.priority?.toLowerCase()}">${c.priority} Priority</span></p>
      </div>
      <span class="status-badge ${getBadgeClass(c.status)}">${c.status}</span>
    </div>

    ${techBlock}
    
    ${c.admin_notes ? `<div style="background:rgba(245, 158, 11, 0.1); border-left:3px solid #f59e0b; padding:1rem; margin-bottom:1.5rem; color:#fcd34d; border-radius:4px;"><h4 style="margin:0 0 0.5rem 0; color:#fff;">Admin Notes</h4><p style="margin:0; font-size:0.9rem;">${c.admin_notes}</p></div>` : ''}

    <h4 style="margin:0 0 0.5rem 0; color:var(--text-main);">Customer Description</h4>
    <p style="margin:0 0 1.5rem 0; white-space:pre-wrap;">${c.description}</p>
    
    ${mediaHtml}

    <h4 style="margin:2rem 0 1rem 0; color:var(--text-main); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">Ticket Timeline</h4>
    <div class="timeline">
      ${timelineHtml || '<p>No timeline events recorded.</p>'}
    </div>
  `;
};
