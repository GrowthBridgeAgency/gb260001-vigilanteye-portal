/**
 * admin-technicians.js
 * Logic for Technician Management Module
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let technicians = [];
let searchTerm = '';
let searchTimeout = null;

// DOM Elements
const tbody = document.getElementById('technicians-tbody');
const searchInput = document.getElementById('search-input');

// Metrics
const elTotal = document.getElementById('metric-total');
const elActive = document.getElementById('metric-active');
const elInactive = document.getElementById('metric-inactive');
const elAssignments = document.getElementById('metric-assignments');

// Modals
const manageForm = document.getElementById('manage-form');
const btnSaveManage = document.getElementById('btn-save-manage');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

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

  btnSaveManage.addEventListener('click', handleSave);
  btnConfirmDelete.addEventListener('click', handleDelete);

  // WhatsApp send
  document.getElementById('btn-send-wa').addEventListener('click', sendWaMessage);
});

// ==========================================
// DATA FETCHING & PROCESSING
// ==========================================

async function fetchData() {
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading technicians...</td></tr>';

  try {
    // We join on complaints to calculate dynamic metrics.
    const { data, error } = await supabase
      .from('technicians')
      .select(`
        *,
        complaints (*)
      `)
      .order('technician_name');

    if (error) throw error;

    technicians = data;
    updateMetrics();
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load data.</td></tr>';
  }
}

function updateMetrics() {
  let activeCount = 0;
  let inactiveCount = 0;
  let activeAssignments = 0;

  technicians.forEach(t => {
    if (t.is_active) activeCount++;
    else inactiveCount++;

    const activeComplaints = (t.complaints || []).filter(c => c.status !== 'Closed' && c.status !== 'Resolved').length;
    activeAssignments += activeComplaints;
  });

  elTotal.textContent = technicians.length;
  elActive.textContent = activeCount;
  elInactive.textContent = inactiveCount;
  elAssignments.textContent = activeAssignments;
}

// ==========================================
// RENDERING
// ==========================================

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function renderTable() {
  let filtered = technicians.filter(t => {
    if (!searchTerm) return true;
    return (
      (t.technician_name?.toLowerCase().includes(searchTerm)) ||
      (t.mobile?.toLowerCase().includes(searchTerm)) ||
      (t.email?.toLowerCase().includes(searchTerm)) ||
      (t.specialization?.toLowerCase().includes(searchTerm))
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">No technicians found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    // Process Complaints
    const all = t.complaints || [];
    const total = all.length;
    const open = all.filter(c => c.status === 'Open' || c.status === 'Assigned').length;
    const inProgress = all.filter(c => c.status === 'In Progress').length;
    const resolved = all.filter(c => c.status === 'Resolved').length;

    // Avatar strictly uses initials
    const avatarHtml = `<div class="tech-avatar">${getInitials(t.technician_name)}</div>`;

    return `
    <tr>
      <td>
        <div class="tech-profile">
          ${avatarHtml}
          <div class="tech-info">
            <span class="tech-name">${t.technician_name}</span>
            <span class="tech-spec">${t.specialization}</span>
          </div>
        </div>
      </td>
      <td style="color:var(--text-muted); font-size:0.9rem;">
        <div style="margin-bottom:0.2rem;">${t.mobile}</div>
        <div>${t.email || '-'}</div>
      </td>
      <td>
        <span title="Click to toggle status" style="cursor:pointer; display:inline-block; padding:0.25rem 0.75rem; border-radius:50px; font-size:0.75rem; font-weight:600; ${t.is_active ? 'background:rgba(34,197,94,0.1); color:#86efac;' : 'background:rgba(239,68,68,0.1); color:#fca5a5;'}" onclick="window.toggleTechStatus(${t.id}, ${!t.is_active})">
          ${t.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <div class="tech-stats">
          <div class="stat-badge"><span class="num">${total}</span><span class="lbl">Total</span></div>
          <div class="stat-badge open"><span class="num">${open}</span><span class="lbl">Open</span></div>
          <div class="stat-badge progress"><span class="num">${inProgress}</span><span class="lbl">WIP</span></div>
          <div class="stat-badge" style="color:#86efac;"><span class="num">${resolved}</span><span class="lbl">Resolved</span></div>
        </div>
      </td>
      <td>
        <div class="actions-cell" style="justify-content:center;">
          <button class="action-btn" title="Message via WhatsApp" onclick="window.openWaModal(${t.id})" style="color: #25D366; background: rgba(37,211,102,0.1);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </button>
          <button class="action-btn" title="Edit" onclick="window.openEditModal(${t.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="action-btn delete" title="Delete" onclick="window.openDeleteModal(${t.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

// ==========================================
// MODAL LOGIC
// ==========================================

window.openManageModal = function () {
  manageForm.reset();
  document.getElementById('manage_id').value = '';
  document.getElementById('manage-modal-title').textContent = 'Add Technician';
  window.openModal('manage-modal');
};

window.openEditModal = function (id) {
  const t = technicians.find(x => x.id === id);
  if (!t) return;

  manageForm.reset();
  document.getElementById('manage-modal-title').textContent = 'Edit Technician';

  document.getElementById('manage_id').value = t.id;
  document.getElementById('manage_name').value = t.technician_name || '';
  document.getElementById('manage_mobile').value = t.mobile || '';
  document.getElementById('manage_email').value = t.email || '';
  document.getElementById('manage_specialization').value = t.specialization || '';
  document.getElementById('manage_active').checked = t.is_active;

  window.openModal('manage-modal');
};

async function handleSave(e) {
  e.preventDefault();

  if (!manageForm.checkValidity()) {
    manageForm.reportValidity();
    return;
  }

  const id = document.getElementById('manage_id').value;
  const payload = {
    technician_name: document.getElementById('manage_name').value.trim(),
    mobile: document.getElementById('manage_mobile').value.trim(),
    email: document.getElementById('manage_email').value.trim() || null,
    specialization: document.getElementById('manage_specialization').value.trim(),
    is_active: document.getElementById('manage_active').checked
  };

  btnSaveManage.disabled = true;
  btnSaveManage.textContent = 'Saving...';

  try {
    if (id) {
      const { error } = await supabase.from('technicians').update(payload).eq('id', id);
      if (error) throw error;
      showToast('Technician updated successfully.', 'success');
    } else {
      const { error } = await supabase.from('technicians').insert([payload]);
      if (error) throw error;
      showToast('Technician added successfully.', 'success');

      // WhatsApp auto-welcome
      const waNum = formatWaNumber(payload.mobile);
      const msgText = encodeURIComponent(`Welcome to the Shree Sawariya CCTV team, ${payload.technician_name}! Your technician profile has been created.`);
      window.open(`https://wa.me/${waNum}?text=${msgText}`, '_blank');
    }

    window.closeModal('manage-modal');
    fetchData(); // Refresh list
  } catch (error) {
    console.error('Save error:', error);
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    btnSaveManage.disabled = false;
    btnSaveManage.textContent = 'Save Technician';
  }
}

// ==========================================
// SAFE DELETE LOGIC
// ==========================================

window.toggleTechStatus = async function (id, newStatus) {
  try {
    const { error } = await supabase.from('technicians').update({ is_active: newStatus }).eq('id', id);
    if (error) throw error;
    showToast(`Technician marked as ${newStatus ? 'Active' : 'Inactive'}.`, 'success');
    fetchData();
  } catch (error) {
    console.error('Toggle status error:', error);
    showToast(`Failed to update status: ${error.message}`, 'error');
  }
};

window.openDeleteModal = function (id) {
  const t = technicians.find(x => x.id === id);
  if (!t) return;

  // Safe Delete Verification
  const activeComplaints = (t.complaints || []).filter(c => c.status !== 'Closed' && c.status !== 'Resolved').length;

  if (activeComplaints > 0) {
    showToast('Technician cannot be deleted while active complaints are assigned.', 'error');
    return; // Block modal opening
  }

  document.getElementById('delete_id').value = id;
  window.openModal('delete-modal');
};

async function handleDelete() {
  const id = document.getElementById('delete_id').value;
  if (!id) return;

  btnConfirmDelete.disabled = true;
  btnConfirmDelete.textContent = 'Deleting...';

  try {
    const { error } = await supabase.from('technicians').delete().eq('id', id);
    if (error) throw error;

    showToast('Technician removed successfully.', 'success');
    window.closeModal('delete-modal');
    fetchData();
  } catch (error) {
    console.error('Delete error:', error);
    showToast(`Failed to delete: ${error.message}`, 'error');
  } finally {
    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = 'Yes, Delete';
  }
}

// ==========================================
// WHATSAPP TEMPLATE LOGIC
// ==========================================

function formatWaNumber(num) {
  let cleaned = num.replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

window.openWaModal = function (id) {
  const t = technicians.find(x => x.id === id);
  if (!t) return;
  if (!t.mobile) {
    showToast('This technician does not have a registered mobile number.', 'error');
    return;
  }

  document.getElementById('wa_mobile').value = t.mobile;
  document.getElementById('wa_template').value = 'assignment';
  window.updateWaTemplate();
  window.openModal('whatsapp-modal');
};

window.updateWaTemplate = function () {
  const tpl = document.getElementById('wa_template').value;
  const msgField = document.getElementById('wa_message');

  if (tpl === 'assignment') {
    msgField.value = 'Hello, you have a new complaint assigned to you. Please check.';
  } else if (tpl === 'status') {
    msgField.value = 'Hello, please update the status of your assigned complaints.';
  } else {
    msgField.value = '';
  }
};

function sendWaMessage() {
  const mobile = document.getElementById('wa_mobile').value;
  const msg = document.getElementById('wa_message').value.trim();

  if (!msg) {
    showToast('Message content cannot be empty.', 'error');
    return;
  }

  const waNum = formatWaNumber(mobile);
  const encodedMsg = encodeURIComponent(msg);

  window.open(`https://wa.me/${waNum}?text=${encodedMsg}`, '_blank');
  window.closeModal('whatsapp-modal');
}
