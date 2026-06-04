/**
 * customer-reviews.js
 * Logic for Customer Reviews Portal
 */

import { supabase } from './supabase.js';
import { loadCurrentUser } from './user-context.js';
import { showToast } from './toast.js';

let currentUser = null;
let myReviews = [];

const form = document.getElementById('review-form');
const btnSubmit = document.getElementById('btn-submit');
const tbody = document.getElementById('reviews-tbody');
const stars = document.querySelectorAll('.rating-stars span');
const ratingInput = document.getElementById('review_rating');
const reviewText = document.getElementById('review_text');
const charCount = document.getElementById('char-count');

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await loadCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;

  setupStarRating();
  setupCharCount();
  fetchMyReviews();

  form.addEventListener('submit', handleReviewSubmit);
});

// ==========================================
// UI LOGIC
// ==========================================

function setupStarRating() {
  stars.forEach(star => {
    star.addEventListener('click', (e) => {
      const val = e.target.getAttribute('data-val');
      ratingInput.value = val;
      
      // Clear active class
      stars.forEach(s => s.classList.remove('active'));
      
      // Set active on clicked and all previous (handled by RTL CSS + DOM order)
      // Since it's RTL, the DOM order is 5,4,3,2,1. 
      // We just need to mark the clicked one as active, CSS handles the rest or we do it via JS.
      // Actually, since CSS hover handles visual fill, click should permanently color them.
      // Because RTL hover logic is tricky with click persistence, let's just color them via JS:
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= parseInt(val)) {
          s.style.color = '#f59e0b';
        } else {
          s.style.color = 'var(--text-muted)';
        }
      });
    });
  });
}

function setupCharCount() {
  reviewText.addEventListener('input', () => {
    charCount.textContent = reviewText.value.length;
  });
}

// ==========================================
// DATA LOGIC
// ==========================================

async function fetchMyReviews() {
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading reviews...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('customer_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    myReviews = data || [];
    renderTable();
  } catch (err) {
    console.error('Error fetching reviews:', err);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:3rem; color:#fca5a5;">Failed to load reviews.</td></tr>';
  }
}

function renderTable() {
  if (myReviews.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:3rem; color:var(--text-muted);">No reviews submitted yet.</td></tr>';
    return;
  }

  tbody.innerHTML = myReviews.map(r => {
    const starString = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const badgeClass = r.approved ? 'badge-approved' : 'badge-pending';
    const statusText = r.approved ? 'Approved' : 'Pending Approval';
    const date = new Date(r.created_at).toLocaleDateString('en-IN');
    
    return `
    <tr>
      <td style="color:#f59e0b; font-size:1.2rem; white-space:nowrap;">${starString}</td>
      <td style="max-width:300px;">
        <div style="font-size:0.9rem; line-height:1.4;">${r.review}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem;">${date}</div>
      </td>
      <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
    </tr>
    `;
  }).join('');
}

async function handleReviewSubmit(e) {
  e.preventDefault();

  if (!ratingInput.value) {
    showToast('Please select a star rating first.', 'error');
    return;
  }

  const text = reviewText.value.trim();
  if (text.length < 20 || text.length > 500) {
    showToast('Review must be between 20 and 500 characters.', 'error');
    return;
  }

  // Check 7-day rate limit
  if (myReviews.length > 0) {
    const lastReviewDate = new Date(myReviews[0].created_at);
    const today = new Date();
    const diffTime = Math.abs(today - lastReviewDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays <= 7) {
      showToast('You can only submit one review every 7 days.', 'error');
      return;
    }
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Submitting...';

  try {
    const payload = {
      customer_id: currentUser.id,
      rating: parseInt(ratingInput.value, 10),
      review: text,
      approved: false // defaults to false in DB, but explicit here
    };

    const { error } = await supabase
      .from('reviews')
      .insert([payload]);

    if (error) throw error;

    showToast('Review submitted successfully! Pending admin approval.', 'success');
    
    // Reset form
    form.reset();
    ratingInput.value = '';
    stars.forEach(s => s.style.color = 'var(--text-muted)');
    charCount.textContent = '0';
    
    fetchMyReviews();

  } catch (err) {
    console.error('Error submitting review:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Submit Review';
  }
}
