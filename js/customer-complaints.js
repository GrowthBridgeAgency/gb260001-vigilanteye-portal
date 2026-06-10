/**
 * customer-complaints.js
 * Logic for Customer Complaints Dashboard
 */

import { supabase } from './supabase.js';
import { loadCurrentUser } from './user-context.js';
import { showToast } from './toast.js';

let currentUser = null;
let currentProfile = null;

let myProducts = [];
let myComplaints = [];

// DOM Elements
const tbody = document.getElementById('complaints-tbody');
const productSelect = document.getElementById('complaint_product');
const btnSubmit = document.getElementById('btn-submit-complaint');
const formEl = document.getElementById('raise-form');

const fName = document.getElementById('complaint_contact_name');
const fMobile = document.getElementById('complaint_contact_mobile');
const fAddress = document.getElementById('complaint_site_address');
const fDevice = document.getElementById('complaint_device_type');
const fCategory = document.getElementById('complaint_category');
const fIssue = document.getElementById('complaint_issue_type');

const issueCategories = {
  "IP Camera Problem": [
    "Camera Offline / Not Connected", "Live View Not Showing", "Network Connectivity Issue", "IP Address Conflict", "Camera Not Recording", "Poor Video Quality", "Camera Frequently Disconnecting", "Remote Viewing Not Working", "PoE Power Issue", "Camera Password/Login Issue"
  ],
  "HD Camera Problem": [
    "No Video Signal", "Black Screen", "Blurred Image", "Night Vision Not Working", "Color Issue in Camera", "Camera Flickering", "Power Supply Failure", "DVR Channel Not Showing Camera", "Cable Damage Issue", "Water Damage in Camera"
  ],
  "NVR/DVR Issue": [
    "NVR/DVR Not Starting", "Hard Disk Not Detected", "Recording Not Working", "Password Reset Required", "Remote Access Issue", "System Hanging", "Storage Full Warning"
  ],
  "Hard Disk & Recording": [
    "No Recording Available", "HDD Failure", "HDD Not Detected", "Recording Playback Not Working", "Storage Capacity Issue"
  ],
  "Mobile App & Remote": [
    "Mobile App Login Problem", "Device Offline", "Live View Not Opening", "Playback Not Working", "Notification Not Received"
  ],
  "Network & Internet": [
    "Internet Not Available", "Router Configuration Issue", "Port Forwarding Issue", "Static IP Issue", "Wi-Fi Connectivity Problem"
  ],
  "Installation & Service": [
    "New Camera Installation", "Camera Relocation", "Additional Camera Requirement", "Site Visit Request", "Annual Maintenance Service"
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  const context = await loadCurrentUser();
  currentUser = context.user;
  currentProfile = context.profile;
  
  if (!currentUser) {
    window.location.href = '../login.html';
    return;
  }

  // Pre-fill profile data for the raise complaint form
  if (currentProfile) {
    fName.value = currentProfile.name || '';
    fMobile.value = currentProfile.phone || '';
    fAddress.value = currentProfile.address || '';
  }

  fCategory.addEventListener('change', (e) => {
    const cat = e.target.value;
    fIssue.innerHTML = '<option value="" disabled selected>-- Select Specific Issue --</option>';
    if (issueCategories[cat]) {
      fIssue.disabled = false;
      issueCategories[cat].forEach(iss => {
        fIssue.innerHTML += `<option value="${iss}">${iss}</option>`;
      });
    } else {
      fIssue.disabled = true;
    }
  });

  await fetchMyProducts();
  await fetchComplaints();

  btnSubmit.addEventListener('click', submitComplaint);
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:4rem; color:var(--text-muted);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1rem; opacity:0.5;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <div>No support requests found. You're all caught up!</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = myComplaints.map(c => {
    let pName = c.products ? c.products.product_name : 'Unknown';
    let amcStatus = 'N/A';
    
    if (c.products && c.products.amc_expiry) {
      const now = new Date();
      amcStatus = new Date(c.products.amc_expiry) > now ? '<span style="color:#4ade80;">Covered</span>' : '<span style="color:#f87171;">Expired</span>';
    }

    const priorityClass = `priority-${c.priority?.toLowerCase()}`;
    const statusClass = `status-${c.status?.toLowerCase().replace(' ', '-')}`;

    return `
      <tr onclick="window.viewComplaint(${c.id})" style="cursor:pointer;">
        <td style="font-family: monospace; color:var(--accent-color); font-weight:600;">${c.ticket_number}</td>
        <td style="font-weight: 500;">${pName}</td>
        <td>${c.issue_type}</td>
        <td class="${priorityClass}">${c.priority || 'Normal'}</td>
        <td><span class="status-badge ${statusClass}">${c.status}</span></td>
        <td>${amcStatus}</td>
        <td style="color:var(--text-muted);">${formatDate(c.created_at)}</td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// RAISE COMPLAINT LOGIC
// ==========================================

const BUCKET = 'complaints';

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


async function submitComplaint(e) {
  e.preventDefault();
  
  if (!formEl.checkValidity()) {
    formEl.reportValidity();
    return;
  }

  const prodId = productSelect.value;
  const issue = fIssue.value;
  const priority = document.getElementById('complaint_priority').value;
  const desc = document.getElementById('complaint_desc').value;
  
  const imgFile = document.getElementById('complaint_image').files[0];
  const vidFile = document.getElementById('complaint_video').files[0];

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Generating Ticket...';

  try {
    const ticketNumber = await generateTicketNumber();
    btnSubmit.textContent = 'Uploading Media...';

    let imageUrl = null;
    let videoUrl = null;
    
    if (imgFile) imageUrl = await uploadFile(imgFile, 'images');
    if (vidFile) videoUrl = await uploadFile(vidFile, 'videos');

    btnSubmit.textContent = 'Saving Complaint...';

    const payload = {
      customer_id: currentUser.id,
      product_id: prodId ? parseInt(prodId, 10) : null,
      ticket_number: ticketNumber,
      device_type: fDevice.value,
      category: fCategory.value,
      issue_type: issue,
      contact_name: fName.value.trim(),
      contact_mobile: fMobile.value.trim(),
      site_address: fAddress.value.trim(),
      preferred_visit_date: document.getElementById('complaint_visit_date').value || null,
      preferred_visit_time: document.getElementById('complaint_visit_time').value || null,
      description: desc,
      priority: priority,
      status: 'Open',
      image_url: imageUrl,
      video_url: videoUrl
    };

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

    // Notification
    if (window.notificationService) {
      window.notificationService.notifyAdmins(
        'New Complaint',
        `A new complaint (${ticketNumber}) has been submitted by a customer.`,
        'complaint',
        `/admin/complaints.html`
      );
    }

    showToast(`Ticket ${ticketNumber} raised successfully!`, 'success');
    window.closeModal('raise-modal');
    formEl.reset();
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
  
  // Populate Fields
  document.getElementById('view-device-type').textContent = c.device_type || 'N/A';
  document.getElementById('view-category').textContent = c.category || 'N/A';
  document.getElementById('view-issue-type').textContent = c.issue_type || 'N/A';
  document.getElementById('view-priority').innerHTML = `<span class="priority-${c.priority?.toLowerCase()}">${c.priority || 'Normal'} Priority</span>`;
  document.getElementById('view-description').textContent = c.description || 'N/A';
  
  document.getElementById('view-product-details').textContent = c.products?.product_name || 'Hardware';
  document.getElementById('view-contact-name').textContent = c.contact_name || 'N/A';
  document.getElementById('view-contact-mobile').textContent = c.contact_mobile || 'N/A';
  document.getElementById('view-site-address').textContent = c.site_address || 'N/A';
  
  let pTime = [];
  if (c.preferred_visit_date) pTime.push(new Date(c.preferred_visit_date).toLocaleDateString('en-IN'));
  if (c.preferred_visit_time) pTime.push(c.preferred_visit_time);
  document.getElementById('view-visit-time').textContent = pTime.length ? pTime.join(' at ') : 'Anytime';

  // Technician
  const tech = c.technicians;
  if (tech) {
    document.getElementById('view-technician').innerHTML = `${tech.technician_name} (${tech.mobile})`;
  } else {
    document.getElementById('view-technician').textContent = 'Unassigned';
  }

  // Resolution
  if (c.resolution_notes) {
    document.getElementById('resolution-group').style.display = 'block';
    document.getElementById('view-resolution-notes').textContent = c.resolution_notes;
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
