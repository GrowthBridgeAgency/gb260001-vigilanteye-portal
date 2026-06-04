/**
 * admin-reviews.js
 * Logic for Admin Reviews Management
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let allReviews = [];
let searchTerm = '';
let filterStatus = 'All';
let filterStars = 'All';

// Metrics Elements
const elTotal = document.getElementById('metric-total');
const elPending = document.getElementById('metric-pending');
const elApproved = document.getElementById('metric-approved');
const elRating = document.getElementById('metric-rating');

// Table Elements
const tbody = document.getElementById('reviews-tbody');
const searchInput = document.getElementById('search-input');
const filterStatusSelect = document.getElementById('filter-status');
const filterStarsSelect = document.getElementById('filter-stars');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access. Redirecting...', 'error');
    setTimeout(() => window.location.href = '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchReviews();

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTable();
  });
  
  filterStatusSelect.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderTable();
  });

  filterStarsSelect.addEventListener('change', (e) => {
    filterStars = e.target.value;
    renderTable();
  });
});

async function fetchReviews() {
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading reviews...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:customer_id(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allReviews = data || [];
    
    updateMetrics();
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:#fca5a5;">Failed to load data.</td></tr>';
  }
}

function updateMetrics() {
  let pending = 0;
  let approved = 0;
  let ratingSum = 0;

  allReviews.forEach(r => {
    if (r.approved) {
      approved++;
      ratingSum += r.rating;
    } else {
      pending++;
    }
  });

  const avgRating = approved > 0 ? (ratingSum / approved).toFixed(1) : '0.0';

  elTotal.textContent = allReviews.length;
  elPending.textContent = pending;
  elApproved.textContent = approved;
  elRating.textContent = avgRating;
}

function renderTable() {
  let filtered = allReviews.filter(r => {
    const customerName = r.profiles?.name || '';
    
    const matchSearch = !searchTerm || 
      customerName.toLowerCase().includes(searchTerm) || 
      r.review?.toLowerCase().includes(searchTerm);
      
    let matchStatus = true;
    if (filterStatus === 'Approved') matchStatus = r.approved === true;
    if (filterStatus === 'Pending') matchStatus = r.approved === false;

    let matchStars = true;
    if (filterStars !== 'All') matchStars = r.rating.toString() === filterStars;
    
    return matchSearch && matchStatus && matchStars;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No reviews found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const customerName = r.profiles?.name || 'Unknown User';
    const starString = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const date = new Date(r.created_at).toLocaleDateString('en-IN');
    
    // Safety quote ID
    const safeId = r.id.toString();

    return `
    <tr>
      <td style="font-weight:600;">${customerName}</td>
      <td style="color:#f59e0b; font-size:1.1rem; white-space:nowrap;">${starString}</td>
      <td style="max-width:300px; font-size:0.9rem;">${r.review}</td>
      <td>${date}</td>
      <td>
        <label class="switch" title="Toggle Approval">
          <input type="checkbox" onchange="window.toggleApproval('${safeId}', this.checked)" ${r.approved ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </td>
      <td style="text-align:center;">
        <button class="action-btn delete" title="Delete Review" onclick="window.deleteReview('${safeId}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    </tr>
  `}).join('');
}

window.toggleApproval = async function(id, isApproved) {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ approved: isApproved })
      .eq('id', id);

    if (error) throw error;
    
    showToast(isApproved ? 'Review approved & live!' : 'Review hidden from website.', 'success');
    
    // Update local state without fetching again to prevent jumping
    const review = allReviews.find(r => String(r.id) === String(id));
    if (review) review.approved = isApproved;
    
    updateMetrics();
  } catch (error) {
    console.error('Toggle error:', error);
    showToast(`Failed to update status: ${error.message}`, 'error');
    // Revert toggle visually
    renderTable(); 
  }
};

window.deleteReview = async function(id) {
  if (!confirm("Are you sure you want to permanently delete this review?")) return;
  
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    showToast('Review deleted successfully', 'success');
    fetchReviews();
  } catch (err) {
    console.error('Delete error:', err);
    showToast(`Error deleting review: ${err.message}`, 'error');
  }
};
