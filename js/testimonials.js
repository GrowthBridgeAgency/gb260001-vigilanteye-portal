/**
 * testimonials.js
 * Logic to fetch and display approved customer reviews on the homepage
 */

import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('reviews-container');
  const avgContainer = document.getElementById('average-rating-container');
  
  if (!container || !avgContainer) return;

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:customer_id(name)')
      .eq('approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const reviews = data || [];

    if (reviews.length === 0) {
      avgContainer.innerHTML = '';
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--text-muted);">
          No customer testimonials available yet.
        </div>
      `;
      return;
    }

    // Calculate Average Rating
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / reviews.length).toFixed(1);

    // Display Average Rating
    avgContainer.innerHTML = `
      <div style="font-size: 1.5rem; letter-spacing: 2px;">★★★★★</div>
      <div style="font-size: 1.1rem; color: #fff;">${avg} / 5 Average Rating</div>
    `;

    // Limit to 6 for display
    const displayReviews = reviews.slice(0, 6);

    container.innerHTML = displayReviews.map(r => {
      const customerName = r.profiles?.name || 'Valued Customer';
      const starString = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      
      // We don't have avatar URLs in this DB schema yet, using initials as fallback
      const initial = customerName.charAt(0).toUpperCase();

      return `
        <div class="card">
          <div style="color: #f59e0b; font-size: 1.5rem; margin-bottom: 1rem; letter-spacing: 2px;">${starString}</div>
          <p style="font-style: italic; color: #fff; font-size: 1.05rem; line-height: 1.7;">"${r.review}"</p>
          <div style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 1rem;">
            <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-muted); font-size: 1.2rem;">
              ${initial}
            </div>
            <div style="text-align: left;">
              <h4 style="margin: 0; font-size: 1rem; color: #fff;">${customerName}</h4>
              <span style="color: var(--text-muted); font-size: 0.85rem;">Verified Customer</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading testimonials:', err);
    avgContainer.innerHTML = '';
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: #fca5a5;">
        Failed to load testimonials.
      </div>
    `;
  }
});
