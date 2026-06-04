/**
 * gallery.js
 * Logic for dynamic data on the public Gallery page.
 */

import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  fetchGalleryData();
});

async function fetchGalleryData() {
  try {
    const { data: projects, error } = await supabase
      .from('client_showcase')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderFeaturedProjects(projects);
    renderGalleryGrid(projects);
    
  } catch (error) {
    console.error("Error fetching gallery data:", error);
  }
}

function renderFeaturedProjects(projects) {
  const container = document.getElementById('client-showcase-container');
  if (!container) return;

  const featured = projects ? projects.filter(p => p.featured) : [];
  // Fallback to top 6 if no featured
  const topProjects = featured.length > 0 ? featured : (projects || []).slice(0, 6);

  if (topProjects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted); margin-bottom: 1rem;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No Featured Projects</h3>
        <p style="color: var(--text-muted); margin: 0;">Check back later as we update our portfolio.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = topProjects.map(p => {
    const isFeaturedBadge = p.featured ? `<span style="display: inline-block; padding: 0.25rem 0.75rem; background: var(--primary-color); color: var(--bg-main); border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 1rem;">Featured Project</span>` : '';
    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.project_name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`
      : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-muted);">No Image Available</div>`;

    return `
    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; cursor: pointer;">
      <div style="height: 250px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
        ${imgHtml}
      </div>
      <div style="padding: 2rem; flex: 1; display: flex; flex-direction: column;">
        <div>${isFeaturedBadge}</div>
        <h3 style="margin: 0.5rem 0;">${p.project_name}</h3>
        <p style="color: var(--accent-color); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Client: ${p.client_name} ${p.location ? '| Location: ' + p.location : ''}</p>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 0;">${p.description || p.short_description || 'Security infrastructure deployment.'}</p>
      </div>
    </div>
  `}).join('');
}

function renderGalleryGrid(projects) {
  const container = document.getElementById('gallery-grid-container');
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No Gallery Items</h3>
        <p style="color: var(--text-muted); margin: 0;">Check back later as we update our photo gallery.</p>
      </div>
    `;
    return;
  }

  // Generate random heights for masonry effect
  const heights = [250, 300, 350, 400, 450];
  
  container.innerHTML = projects.map(p => {
    const h = heights[Math.floor(Math.random() * heights.length)];
    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.project_name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`
      : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-muted);">No Image</div>`;

    return `
      <div class="masonry-item">
        <div style="height: ${h}px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2);">
          ${imgHtml}
        </div>
        <div class="masonry-overlay">
          <h4 style="color: #fff; margin: 0 0 0.5rem 0; font-size: 1.3rem;">${p.project_name}</h4>
          <p style="color: var(--accent-color); font-size: 0.9rem; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">${p.client_name}</p>
        </div>
      </div>
    `;
  }).join('');
}
