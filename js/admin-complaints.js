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
const manageForm = document.getElementById('manage-form');
const btnSaveManage = document.getElementById('btn-save-management');

let currentManageId = null;

// Filter UI
const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filterDropdownMenu = document.getElementById('filter-dropdown-menu');
const filterStatusSelect = document.getElementById('filter-status');
const filterPrioritySelect = document.getElementById('filter-priority');
const filterTechSelect = document.getElementById('filter-technician');
const techSelect = document.getElementById('filter-technician'); // alias for below logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : ''); setTimeout(() => window.location.href = basePath + '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchData();

  if(searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderTable, 300);
    });
  }

  // Toggle filter dropdown
  if (filterToggleBtn && filterDropdownMenu) {
    filterToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = filterDropdownMenu.style.display === 'flex';
      filterDropdownMenu.style.display = isVisible ? 'none' : 'flex';
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!filterToggleBtn.contains(e.target) && !filterDropdownMenu.contains(e.target)) {
        filterDropdownMenu.style.display = 'none';
      }
    });
    // Prevent closing when clicking inside
    filterDropdownMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  // Filter selects change
  const applyFilters = () => {
    statusFilter = filterStatusSelect.value;
    priorityFilter = filterPrioritySelect.value;
    technicianFilter = filterTechSelect.value;
    renderTable();
  };

  if(filterStatusSelect) filterStatusSelect.addEventListener('change', applyFilters);
  if(filterPrioritySelect) filterPrioritySelect.addEventListener('change', applyFilters);
  if(filterTechSelect) filterTechSelect.addEventListener('change', applyFilters);

  if(btnSaveManage) {
    btnSaveManage.addEventListener('click', handleSaveManagement);
  }
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
        technicians (technician_name, mobile)
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
      <td>
        <div style="font-weight:500;">${c.contact_name || c.profiles?.name || 'Unknown'}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${c.contact_mobile || c.profiles?.phone || ''}</div>
      </td>
      <td>
        <div style="font-weight:500;">${c.device_type || 'Unknown'}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${c.products?.product_name || 'No Specific Product'}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; color:var(--text-muted);">${c.category || ''}</div>
        <div>${c.issue_type}</div>
      </td>
      <td class="priority-${c.priority?.toLowerCase()}">${c.priority}</td>
      <td><span class="status-badge ${getBadgeClass(c.status)}">${c.status}</span></td>
      <td style="color:var(--text-muted);">${c.technicians?.technician_name || 'Unassigned'}</td>
      <td style="color:var(--text-muted);">${formatDate(c.created_at)}</td>
      <td>
        <div class="actions-cell" style="justify-content:center;">
          <button class="action-btn" title="View Details" onclick="window.viewComplaint(${c.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="action-btn" title="Manage Ticket" onclick="window.manageComplaint(${c.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="action-btn" title="Message Center (WhatsApp)" onclick="window.openWaModal(${c.id})" style="color: #25D366; background: rgba(37,211,102,0.1);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
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
  currentManageId = id;
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
  
  const id = currentManageId;
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

    // Notifications
    if (window.notificationService && originalComplaint.customer_id) {
      if (originalComplaint.technician_id != newTechId && newTechId) {
        window.notificationService.createNotification(
          originalComplaint.customer_id,
          'Technician Assigned',
          'A technician has been assigned to your complaint and will assist you shortly.',
          'complaint',
          `/dashboard/complaints.html?id=${id}`
        );
      } else if (originalComplaint.status !== 'Resolved' && newStatus === 'Resolved') {
        window.notificationService.createNotification(
          originalComplaint.customer_id,
          'Complaint Resolved',
          `Your complaint (Ref: ${originalComplaint.ticket_number}) has been resolved.`,
          'complaint',
          `/dashboard/complaints.html?id=${id}`
        );
      } else if (originalComplaint.status !== newStatus) {
        window.notificationService.createNotification(
          originalComplaint.customer_id,
          'Complaint Updated',
          `Your complaint (Ref: ${originalComplaint.ticket_number}) status was updated to ${newStatus}.`,
          'complaint',
          `/dashboard/complaints.html?id=${id}`
        );
      }
    }

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
  
  // Setup WhatsApp Button
  const waBtn = document.getElementById('whatsapp-btn');
  let phoneStr = c.contact_mobile || c.profiles?.phone;
  if (phoneStr) {
    let phone = phoneStr.replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;
    
    const msg = `Hello ${c.contact_name || c.profiles?.name || ''},\n\nThis is regarding your SafeVision Surveillance Ticket ${c.ticket_number}.\nIssue: ${c.issue_type}\nStatus: ${c.status}\n\n`;
    waBtn.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    waBtn.style.display = 'inline-flex';
  } else {
    waBtn.style.display = 'none';
  }

  // Populate Fields
  document.getElementById('view-device-type').textContent = c.device_type || 'N/A';
  document.getElementById('view-category').textContent = c.category || 'N/A';
  document.getElementById('view-issue-type').textContent = c.issue_type || 'N/A';
  document.getElementById('view-priority').innerHTML = `<span class="priority-${c.priority?.toLowerCase()}">${c.priority || 'Normal'} Priority</span>`;
  document.getElementById('view-description').textContent = c.description || 'N/A';
  
  document.getElementById('view-product-details').textContent = c.products?.product_name || 'Hardware';
  document.getElementById('view-contact-name').textContent = c.contact_name || c.profiles?.name || 'N/A';
  document.getElementById('view-contact-mobile').textContent = c.contact_mobile || c.profiles?.phone || 'N/A';
  document.getElementById('view-site-address').textContent = c.site_address || 'N/A';
  
  let pTime = [];
  if (c.preferred_visit_date) pTime.push(new Date(c.preferred_visit_date).toLocaleDateString('en-IN'));
  if (c.preferred_visit_time) pTime.push(c.preferred_visit_time);
  document.getElementById('view-visit-time').textContent = pTime.length ? pTime.join(' at ') : 'Anytime';

  // Technician
  const tech = c.technicians;
  if (tech) {
    document.getElementById('view-technician').innerHTML = `${tech.technician_name}`;
  } else {
    document.getElementById('view-technician').textContent = 'Unassigned';
  }

  // Resolution
  if (c.resolution_notes || c.admin_notes) {
    document.getElementById('resolution-group').style.display = 'block';
    let content = '';
    if (c.admin_notes) content += `<strong>Internal Admin Notes:</strong>\n${c.admin_notes}\n\n`;
    if (c.resolution_notes) content += `<strong>Resolution to Customer:</strong>\n${c.resolution_notes}`;
    document.getElementById('view-resolution-notes').innerHTML = content.trim();
  } else {
    document.getElementById('resolution-group').style.display = 'none';
  }

  // Media
  const mediaCont = document.getElementById('view-media');
  const imgCont = document.getElementById('view-image-container');
  const vidCont = document.getElementById('view-video-container');
  
  if (c.image_url || c.video_url) {
    mediaCont.style.display = 'block';
    if (c.image_url) {
      imgCont.style.display = 'block';
      imgCont.innerHTML = `<a href="${c.image_url}" target="_blank" class="media-preview"><img src="${c.image_url}" alt="Attachment"></a>`;
    } else {
      imgCont.style.display = 'none';
    }
    if (c.video_url) {
      vidCont.style.display = 'block';
      vidCont.innerHTML = `<div class="media-preview"><video src="${c.video_url}" controls></video></div>`;
    } else {
      vidCont.style.display = 'none';
    }
  } else {
    mediaCont.style.display = 'none';
  }

  window.openModal('view-modal');

  // Fetch timeline
  const tlContainer = document.getElementById('view-status-timeline');
  tlContainer.innerHTML = '<div style="text-align:center; padding:1rem;">Loading timeline...</div>';

  const { data: updates } = await supabase
    .from('complaint_updates')
    .select('*')
    .eq('complaint_id', id)
    .order('created_at', { ascending: true });

  if (updates && updates.length > 0) {
    tlContainer.innerHTML = '<div class="timeline">' + updates.map(u => `
      <div class="timeline-item">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <span class="timeline-date">${formatDate(u.created_at)}</span>
          <div class="timeline-status" style="color:var(--text-main); font-weight:600;">${u.status}</div>
          <p class="timeline-note">${u.note || '-'}</p>
        </div>
      </div>
    `).join('') + '</div>';
  } else {
    tlContainer.innerHTML = '<p>No timeline events recorded.</p>';
  }
};

// ==========================================
// UNIFIED WHATSAPP MODAL
// ==========================================

window.openWaModal = function(id) {
  const c = complaints.find(x => x.id === id);
  if (!c) return;
  
  document.getElementById('wa_complaint_id').value = id;
  const targetSelect = document.getElementById('wa_target');
  
  // Disable technician option if none assigned
  if (c.technician_id && c.technicians?.mobile) {
    targetSelect.querySelector('option[value="technician"]').disabled = false;
  } else {
    targetSelect.querySelector('option[value="technician"]').disabled = true;
    targetSelect.value = 'customer';
  }

  window.updateWaTarget();
  window.openModal('whatsapp-modal');
};

window.updateWaTarget = function() {
  const target = document.getElementById('wa_target').value;
  const templateSelect = document.getElementById('wa_template');
  
  if (target === 'customer') {
    templateSelect.innerHTML = `
      <option value="cust_received">Ticket Received</option>
      <option value="cust_assigned">Technician Assigned</option>
      <option value="cust_status">Status Update</option>
      <option value="cust_resolved">Resolved</option>
      <option value="custom">Custom Message</option>
    `;
  } else {
    templateSelect.innerHTML = `
      <option value="tech_dispatch">Dispatch Complaint details</option>
      <option value="tech_status">Request Status Update</option>
      <option value="custom">Custom Message</option>
    `;
  }
  window.updateWaTemplate();
};

window.updateWaTemplate = function() {
  const id = document.getElementById('wa_complaint_id').value;
  const c = complaints.find(x => x.id == id);
  if (!c) return;

  const target = document.getElementById('wa_target').value;
  const tpl = document.getElementById('wa_template').value;
  const msgField = document.getElementById('wa_message');

  const cName = c.contact_name || c.profiles?.name || 'Customer';

  if (target === 'customer') {
    if (tpl === 'cust_received') {
      msgField.value = `Hello ${cName},\n\nWe have received your complaint (Ticket #${c.ticket_number}) regarding your ${c.device_type || 'device'}. Our team is looking into it and will assist you shortly.`;
    } else if (tpl === 'cust_assigned') {
      msgField.value = `Hello ${cName},\n\nA technician has been assigned to your ticket (#${c.ticket_number}) and will contact you shortly regarding the visit.`;
    } else if (tpl === 'cust_status') {
      msgField.value = `Hello ${cName},\n\nThe status of your ticket (#${c.ticket_number}) has been updated to *${c.status}*.`;
    } else if (tpl === 'cust_resolved') {
      msgField.value = `Hello ${cName},\n\nYour complaint (Ticket #${c.ticket_number}) has been successfully resolved! Please let us know if you face any further issues.\n\nThank you,\nShree Sawariya CCTV`;
    } else {
      msgField.value = '';
    }
  } else {
    // Technician
    if (tpl === 'tech_dispatch') {
      let pTime = [];
      if (c.preferred_visit_date) pTime.push(new Date(c.preferred_visit_date).toLocaleDateString('en-IN'));
      if (c.preferred_visit_time) pTime.push(c.preferred_visit_time);
      const prefTime = pTime.length ? pTime.join(' at ') : 'Anytime';
      
      const compDate = new Date(c.created_at).toLocaleDateString('en-IN');

      msgField.value = `*NEW COMPLAINT ASSIGNMENT* 🛠️
*Ticket:* ${c.ticket_number}
*Date:* ${compDate}
*Priority:* ${c.priority || 'Normal'}

*Customer:* ${cName}
*Contact:* ${c.contact_mobile || c.profiles?.phone || 'Unknown'}
*Address:* ${c.site_address || 'Not Provided'}
*Preferred Time:* ${prefTime}

*Device:* ${c.products?.product_name || c.device_type || 'Unknown Device'}
*Issue Category:* ${c.category || 'General'}
*Specific Issue:* ${c.issue_type || 'Not Specified'}
*Details:* ${c.description || 'No description provided.'}

Please update the dashboard once resolved.`;

    } else if (tpl === 'tech_status') {
      msgField.value = `Hello, please provide a status update on ticket #${c.ticket_number} assigned to you.`;
    } else {
      msgField.value = '';
    }
  }
};

window.sendWaMessage = function() {
  const id = document.getElementById('wa_complaint_id').value;
  const c = complaints.find(x => x.id == id);
  if (!c) return;

  const target = document.getElementById('wa_target').value;
  const msg = document.getElementById('wa_message').value.trim();

  if (!msg) {
    showToast('Message content cannot be empty.', 'error');
    return;
  }

  let mobile = '';
  if (target === 'customer') {
    mobile = c.contact_mobile || c.profiles?.phone;
  } else {
    mobile = c.technicians?.mobile;
  }

  if (!mobile) {
    showToast(`No mobile number found for the selected ${target}.`, 'error');
    return;
  }

  let cleaned = mobile.replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;

  window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, '_blank');
  window.closeModal('whatsapp-modal');
};
