/**
 * showcase.js
 * Logic for fetching and rendering public portfolio projects.
 */

import { supabase } from './supabase.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?q=80&w=600&auto=format&fit=crop';
let allProjects = [];

document.addEventListener('DOMContentLoaded', () => {
  // If we are on the dedicated showcase page
  if (document.getElementById('showcase-container')) {
    fetchAllProjects();
  }
});

// Used by both showcase.html and index.html
export async function fetchAllProjects(limit = null, featuredOnly = false) {
  try {
    let query = supabase.from('client_showcase').select('*');
    
    if (featuredOnly) {
      query = query.eq('featured', true);
    }
    
    // Order by featured first, then newest
    query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    allProjects = data || [];
    renderProjects(allProjects);

    return allProjects;
  } catch (err) {
    console.error('Error fetching showcase projects:', err);
    const container = document.getElementById('showcase-container') || document.getElementById('featured-projects-container');
    if (container) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:#ef4444;">Failed to load projects. Please try again later.</div>`;
    }
    return [];
  }
}

function renderProjects(projectsList) {
  // Check if we are rendering into showcase-container (showcase.html) or featured-projects-container (index.html)
  const container = document.getElementById('showcase-container') || document.getElementById('featured-projects-container');
  if (!container) return;

  if (projectsList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" style="margin-bottom:1rem;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        <h3 style="margin:0 0 0.5rem 0; color:var(--text-main);">No projects uploaded yet.</h3>
        <p style="margin:0; color:var(--text-muted);">Check back soon for our latest installations!</p>
      </div>`;
    return;
  }

  const isHomepage = container.id === 'featured-projects-container';

  if (isHomepage) {
    container.className = 'marquee-track';
    // Duplicate for infinite scroll
    const displayProjects = [...projectsList, ...projectsList, ...projectsList];
    
    container.innerHTML = displayProjects.map((p, index) => {
      const imgUrl = p.image_url || FALLBACK_IMAGE;
      const actualIndex = index % projectsList.length;
      return `
      <div class="marquee-item-lg">
        <div class="overlay-card" onclick="window.openShowcaseModal(${actualIndex})">
          <img src="${imgUrl}" alt="${p.project_name}" loading="lazy">
          <div class="overlay-card-content">
            <h3>${p.project_name}</h3>
            <p style="margin-bottom: 0.5rem; color: var(--accent-color);">${p.client_name}</p>
            <p style="display:flex; align-items:center; gap:0.25rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${p.location}
            </p>
          </div>
        </div>
      </div>
      `;
    }).join('');
  } else {
    container.className = 'bento-grid';
    container.innerHTML = projectsList.map((p, index) => {
      const imgUrl = p.image_url || FALLBACK_IMAGE;
      return `
      <div class="overlay-card" onclick="window.openShowcaseModal(${index})">
        <img src="${imgUrl}" alt="${p.project_name}" loading="lazy">
        <div class="overlay-card-content">
          <h3>${p.project_name}</h3>
          <p style="margin-bottom: 0.5rem; color: var(--accent-color);">${p.client_name}</p>
          <p style="display:flex; align-items:center; gap:0.25rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${p.location}
          </p>
        </div>
      </div>
      `;
    }).join('');
  }
}

window.currentShowcaseIndex = 0;

window.openShowcaseModal = function(index) {
  window.currentShowcaseIndex = index;
  const p = allProjects[index];
  if (!p) return;

  const modalImg = document.getElementById('modal-img');
  const modalClient = document.getElementById('modal-client');
  const modalProject = document.getElementById('modal-project');
  const modalLoc = document.getElementById('modal-loc').querySelector('span');
  const modalDetails = document.getElementById('modal-details');
  const badgeContainer = document.getElementById('modal-badge-container');

  if (modalImg && modalClient && modalProject && modalLoc && modalDetails) {
    modalImg.src = p.image_url || FALLBACK_IMAGE;
    modalClient.textContent = p.client_name;
    modalProject.textContent = p.project_name;
    modalLoc.textContent = p.location;
    
    modalDetails.textContent = p.project_details || p.short_description || 'No additional details provided.';
    
    badgeContainer.innerHTML = p.featured ? `<span class="badge-featured" style="position:static; display:inline-block; box-shadow:none;">FEATURED</span>` : '';
    
    // Fallback simple modal open if the standard window.openModal doesn't exist (like on index.html if unlinked)
    if (typeof window.openModal === 'function') {
      const modal = document.getElementById('showcase-modal');
      if (modal && !modal.classList.contains('active')) {
        window.openModal('showcase-modal');
      }
    } else {
      const modal = document.getElementById('showcase-modal');
      if (modal && modal.style.display !== 'flex') {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
      }
    }
  }
};

window.navigateProject = function(direction) {
  if (!allProjects || allProjects.length === 0) return;
  let newIndex = window.currentShowcaseIndex + direction;
  
  if (newIndex < 0) {
    newIndex = allProjects.length - 1;
  } else if (newIndex >= allProjects.length) {
    newIndex = 0;
  }
  
  window.openShowcaseModal(newIndex);
};
