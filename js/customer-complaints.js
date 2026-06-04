/**
 * customer-complaints.js
 * Logic for Customer Complaints Dashboard
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isLoggedIn } from './user-context.js';
import { showToast } from './toast.js';

let currentUser = null;
let myComplaints = [];
let myProducts = [];

const BUCKET = 'complaints';

// DOM Elements
const tbody = document.getElementById('complaints-tbody');
const productSelect = document.getElementById('complaint_product');
const btnSubmit = document.getElementById('btn-submit-complaint');
const raiseForm = document.getElementById('raise-form');

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await loadCurrentUser();
  if (!isLoggedIn()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    setTimeout(() => window.location.href = '/login.html', 1500);
    return;
  }
  currentUser = user;

  fetchMyProducts();
  fetchComplaints();

  btnSubmit.addEventListener('click', handleRaiseComplaint);
});

// ==========================================
// UTILITIES
// ==========================================

/**
 * Isolated ticket number generator.
 * Format: VE-YYYY-000001
 */
async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const prefix = `VE-${year}-`;

  // Fetch the latest complaint for this year to find the max number
  const { data, error } = await supabase
    .from('complaints')
    .select('ticket_number')
    .like('ticket_number', `${prefix}%`)
    .order('ticket_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error generating ticket number:', error);
    throw new Error('Could not generate ticket number');
  }

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastTicket = data[0].ticket_number;
    const parts = lastTicket.split('-');
    if (parts.length === 3) {
      nextNum = parseInt(parts[2], 10) + 1;
    }
  }

  const paddedNum = nextNum.toString().padStart(6, '0');
  return `${prefix}${paddedNum}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getBadgeClass(status) {
  status = status?.toLowerCase() || '';
  if (status === 'open') return 'status-open';
  if (status === 'assigned') return 'status-assigned';
  if (status === 'in progress') return 'status-progress';
  if (status === 'resolved') return 'status-resolved';
  if (status === 'closed') return 'status-closed';
  return '';
}

// ==========================================
// FETCH LOGIC
// ==========================================

async function fetchMyProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_name, model_number')
      .eq('customer_id', currentUser.id);

    if (error) throw error;
    myProducts = data;

    productSelect.innerHTML = '<option value="" disabled selected>-- Select Product --</option>' +
      data.map(p => `<option value="${p.id}">${p.product_name} (${p.model_number || 'N/A'})</option>`).join('');
  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

async function fetchComplaints() {
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading complaints...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        products (product_name, warranty_expiry, amc_status),
        technicians (technician_name, mobile, specialization)
      `)
      .eq('customer_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    myComplaints = data;
    renderComplaints();
  } catch (err) {
    console.error('Fetch error:', err);
    showToast('Failed to load complaints.', 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">Failed to load data.</td></tr>';
  }
}

function renderComplaints() {
  if (myComplaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:4rem 1rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--text-muted); margin-bottom:1rem; opacity:0.5;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <p style="color:var(--text-muted); margin:0;">No complaints raised yet.</p>
        </td>
      </tr>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  tbody.innerHTML = myComplaints.map(c => {
    const p = c.products || {};
    
    // Warranty / AMC String
    let wStatus = 'Warranty Expired';
    if (p.warranty_expiry && p.warranty_expiry >= today) wStatus = 'Warranty Active';
    
    let aStatus = p.amc_status === 'Active' ? 'AMC Active' : 'AMC Inactive';

    return `
      <tr style="cursor:pointer;" onclick="window.viewComplaint(${c.id})">
        <td style="font-weight:600; color:var(--primary-color);">${c.ticket_number}</td>
        <td>${p.product_name || '-'}</td>
        <td>${c.issue_type}</td>
        <td class="priority-${c.priority?.toLowerCase()}">${c.priority}</td>
        <td><span class="status-badge ${getBadgeClass(c.status)}">${c.status}</span></td>
        <td style="font-size:0.8rem; color:var(--text-muted);">
          <div style="margin-bottom:0.2rem;">${wStatus}</div>
          <div>${aStatus}</div>
        </td>
        <td style="color:var(--text-muted);">${formatDate(c.created_at)}</td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// RAISE COMPLAINT LOGIC
// ==========================================

async function uploadFile(file, folder) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const path = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) {
    showToast(`Upload failed for ${file.name}`, 'error');
    throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function handleRaiseComplaint(e) {
  e.preventDefault();
  
  if (!raiseForm.checkValidity()) {
    raiseForm.reportValidity();
    return;
  }

  const prodId = document.getElementById('complaint_product').value;
  const issue = document.getElementById('complaint_issue_type').value;
  const priority = document.getElementById('complaint_priority').value;
  const desc = document.getElementById('complaint_desc').value;
  
  const imgFile = document.getElementById('complaint_image').files[0];
  const vidFile = document.getElementById('complaint_video').files[0];

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Generating Ticket...';

  try {
    console.log("[Complaint Submit] Starting submission...");
    const ticketNumber = await generateTicketNumber();
    console.log("[Complaint Submit] Generated ticket number:", ticketNumber);
    
    btnSubmit.textContent = 'Uploading Media...';

    let imageUrl = null;
    let videoUrl = null;
    
    if (imgFile) {
      console.log("[Complaint Submit] Uploading image:", imgFile.name);
      imageUrl = await uploadFile(imgFile, 'images');
    }
    
    if (vidFile) {
      console.log("[Complaint Submit] Uploading video:", vidFile.name);
      videoUrl = await uploadFile(vidFile, 'videos');
    }

    btnSubmit.textContent = 'Saving Complaint...';

    const payload = {
      customer_id: currentUser.id,
      product_id: parseInt(prodId, 10),
      ticket_number: ticketNumber,
      issue_type: issue,
      description: desc,
      priority: priority,
      status: 'Open',
      image_url: imageUrl,
      video_url: videoUrl
    };

    console.log("[Complaint Submit] Insert Payload to complaints:", payload);

    // Insert Complaint
    const { data: newComplaint, error: compErr } = await supabase
      .from('complaints')
      .insert([payload])
      .select('id')
      .single();

    if (compErr) {
      console.error("[Complaint Submit] Exact Supabase error from complaints insert:", compErr);
      if (compErr.message && compErr.message.includes('unique constraint')) {
        throw new Error('Ticket generation collision. Please try again.');
      }
      throw new Error(`DB Insert Error: ${compErr.message || JSON.stringify(compErr)}`);
    }

    console.log("[Complaint Submit] Successfully inserted complaint. Returned data:", newComplaint);

    // Insert Timeline Update
    const timelinePayload = {
      complaint_id: newComplaint.id,
      status: 'Open',
      note: 'Complaint Created'
    };
    
    console.log("[Complaint Submit] Insert Payload to complaint_updates:", timelinePayload);
    
    const { error: timelineErr } = await supabase
      .from('complaint_updates')
      .insert([timelinePayload]);
      
    if (timelineErr) {
      console.error("[Complaint Submit] Exact Supabase error from complaint_updates insert:", timelineErr);
      // We don't throw here because the main complaint was already created successfully
      showToast('Complaint saved, but failed to log timeline.', 'error');
    } else {
      console.log("[Complaint Submit] Successfully inserted timeline update.");
    }

    showToast(`Ticket ${ticketNumber} raised successfully!`, 'success');
    window.closeModal('raise-modal');
    raiseForm.reset();
    fetchComplaints();

  } catch (err) {
    console.error('[Complaint Submit] Catch block reached. Error:', err);
    showToast(err.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Submit Complaint';
  }
}

// ==========================================
// VIEW MODAL LOGIC
// ==========================================

window.viewComplaint = async function(id) {
  const c = myComplaints.find(x => x.id === id);
  if (!c) return;

  document.getElementById('view-ticket-no').textContent = `Ticket: ${c.ticket_number}`;
  const body = document.getElementById('view-modal-body');
  
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
         <p style="margin:0; font-size:0.9rem;"><strong>Mobile:</strong> ${tech.mobile}</p>
         <p style="margin:0; font-size:0.9rem;"><strong>Specialization:</strong> ${tech.specialization}</p>
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

  const resolutionBlock = c.resolution_notes 
    ? `<div style="background:rgba(34,197,94,0.1); border-left:3px solid #22c55e; padding:1rem; margin-bottom:1.5rem; color:#86efac; border-radius:4px;">
         <h4 style="margin:0 0 0.5rem 0; color:#fff;">Resolution Notes</h4>
         <p style="margin:0; font-size:0.9rem;">${c.resolution_notes}</p>
       </div>` 
    : '';

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
      <div>
        <h3 style="margin:0 0 0.5rem 0; color:var(--text-main);">${c.products?.product_name || 'Hardware'}</h3>
        <p style="margin:0; color:var(--primary-color);">${c.issue_type} • <span class="priority-${c.priority?.toLowerCase()}">${c.priority} Priority</span></p>
      </div>
      <span class="status-badge ${getBadgeClass(c.status)}">${c.status}</span>
    </div>

    ${resolutionBlock}
    ${techBlock}

    <h4 style="margin:0 0 0.5rem 0; color:var(--text-main);">Description</h4>
    <p style="margin:0 0 1.5rem 0; white-space:pre-wrap;">${c.description}</p>
    
    ${mediaHtml}

    <h4 style="margin:2rem 0 1rem 0; color:var(--text-main); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">Ticket Timeline</h4>
    <div class="timeline">
      ${timelineHtml || '<p>No timeline events recorded.</p>'}
    </div>
  `;
};
