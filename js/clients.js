/**
 * clients.js
 * Logic for dynamic data on the public Clients page.
 */

import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  fetchClientsData();
});

async function fetchClientsData() {
  try {
    const { data: showcase } = await supabase.from('client_showcase').select('*').eq('featured', true).limit(6);
    renderFeaturedClients(showcase);

  } catch (error) {
    console.error("Error fetching clients data:", error);
  }
}

function renderFeaturedClients(projects) {
  const container = document.getElementById('featured-clients-container');
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted); margin-bottom: 1rem;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No Featured Clients</h3>
        <p style="color: var(--text-muted); margin: 0;">Check back later as we update our showcase.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = projects.map(p => {
    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.client_name}" loading="lazy" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 1.5rem;">`
      : `<div style="margin-bottom: 1.5rem; color: var(--primary-color);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
      </div>`;

    return `
    <div class="card" style="text-align: left; display: flex; flex-direction: column;">
      ${imgHtml}
      <h3 style="margin-bottom: 0.25rem;">${p.client_name}</h3>
      <p style="color: var(--text-main); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; opacity: 0.7;">${p.project_name} ${p.location ? '• ' + p.location : ''}</p>
      <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin: 0; flex: 1;">${p.description || 'Completed installation.'}</p>
    </div>
  `}).join('');
}

