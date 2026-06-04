/**
 * admin-client-showcase.js
 * Logic for Admin Client Showcase Management
 */

import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let projects = [];
let searchTerm = '';
let searchTimeout = null;

const tbody = document.getElementById('projects-tbody');
const form = document.getElementById('project-form');
const btnSave = document.getElementById('btn-save');
const imageInput = document.getElementById('proj_image');
const imagePreview = document.getElementById('proj_image_preview');

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access.', 'error');
    setTimeout(() => window.location.href = '/dashboard/dashboard.html', 1500);
    return;
  }

  fetchProjects();

  document.getElementById('search-input').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderTable, 300);
  });

  form.addEventListener('submit', handleSaveProject);

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        imagePreview.style.display = 'block';
        imagePreview.querySelector('img').src = e.target.result;
      }
      reader.readAsDataURL(file);
    } else {
      imagePreview.style.display = 'none';
      imagePreview.querySelector('img').src = '';
    }
  });
});

async function fetchProjects() {
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading projects...</td></tr>';
  
  try {
    const { data, error } = await supabase
      .from('client_showcase')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    projects = data || [];
    
    updateMetrics();
    renderTable();

  } catch (error) {
    console.error('Fetch error:', error);
    showToast(`Error: ${error.message}`, 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:#fca5a5;">Failed to load data.</td></tr>';
  }
}

function updateMetrics() {
  const total = projects.length;
  const featured = projects.filter(p => p.featured).length;
  const cities = new Set(projects.map(p => p.location.trim().toLowerCase())).size;

  document.getElementById('metric-total').textContent = total;
  document.getElementById('metric-featured').textContent = featured;
  document.getElementById('metric-cities').textContent = cities;
}

function renderTable() {
  let filtered = projects;
  if (searchTerm) {
    filtered = projects.filter(p => 
      p.client_name?.toLowerCase().includes(searchTerm) ||
      p.project_name?.toLowerCase().includes(searchTerm) ||
      p.location?.toLowerCase().includes(searchTerm)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No projects found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const date = new Date(p.created_at).toLocaleDateString('en-GB');
    const featuredClass = p.featured ? 'status-resolved' : 'status-closed';
    const featuredText = p.featured ? 'Featured' : 'Standard';

    return `
    <tr>
      <td style="font-weight:600; color:#fff;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          ${p.image_url ? `<img src="${p.image_url}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">` : '<div style="width:40px;height:40px;background:rgba(255,255,255,0.1);border-radius:4px;"></div>'}
          ${p.client_name}
        </div>
      </td>
      <td>${p.project_name}</td>
      <td>${p.location}</td>
      <td><span class="status-badge ${featuredClass}">${featuredText}</span></td>
      <td>${date}</td>
      <td style="text-align:center;">
        <div class="actions-cell" style="justify-content:center;">
          <button class="action-btn" title="Toggle Featured" onclick="window.toggleFeatured('${p.id}', ${!p.featured})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${p.featured ? '#fcd34d' : 'none'}" stroke="${p.featured ? '#fcd34d' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </button>
          <button class="action-btn" title="Delete" onclick="window.deleteProject('${p.id}')" style="color:#ef4444;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

window.openCreateModal = function() {
  form.reset();
  document.getElementById('proj_id').value = '';
  imagePreview.style.display = 'none';
  imagePreview.querySelector('img').src = '';
  document.getElementById('modal-title').textContent = 'Add Project';
  window.openModal('project-modal');
};

async function handleSaveProject(e) {
  e.preventDefault();
  btnSave.disabled = true;
  btnSave.textContent = 'Saving...';

  try {
    const client_name = document.getElementById('proj_client').value.trim();
    const project_name = document.getElementById('proj_name').value.trim();
    const location = document.getElementById('proj_location').value.trim();
    const short_description = document.getElementById('proj_short').value.trim();
    const project_details = document.getElementById('proj_details').value.trim() || null;
    const featured = document.getElementById('proj_featured').checked;
    const file = imageInput.files[0];

    let image_url = null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `projects/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-showcase')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('client-showcase')
        .getPublicUrl(filePath);

      image_url = publicUrlData.publicUrl;
    }

    const payload = {
      client_name,
      project_name,
      location,
      short_description,
      project_details,
      featured,
      image_url
    };

    // Since we only support create for now
    const { error: insertError } = await supabase.from('client_showcase').insert([payload]);
    if (insertError) throw insertError;

    showToast('Project saved successfully', 'success');
    window.closeModal('project-modal');
    fetchProjects();

  } catch (err) {
    console.error('Save error:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Save Project';
  }
}

window.toggleFeatured = async function(id, newState) {
  try {
    const { error } = await supabase
      .from('client_showcase')
      .update({ featured: newState })
      .eq('id', id);

    if (error) throw error;
    showToast(`Project ${newState ? 'featured' : 'un-featured'}.`, 'success');
    fetchProjects();
  } catch (err) {
    console.error('Toggle error:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
};

window.deleteProject = async function(id) {
  if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
  
  try {
    const { error } = await supabase
      .from('client_showcase')
      .delete()
      .eq('id', id);

    if (error) throw error;
    showToast('Project deleted.', 'success');
    fetchProjects();
  } catch (err) {
    console.error('Delete error:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
};
