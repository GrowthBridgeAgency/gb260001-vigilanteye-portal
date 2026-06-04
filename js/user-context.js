/**
 * user-context.js
 * Centralized User Session and User Context System.
 * Automatically loads and exposes the active user and their profile data.
 */

import { supabase } from './supabase.js';

// ==========================================
// GLOBAL STATE
// ==========================================

// Expose these globally for easy access by legacy or inline scripts
window.currentUser = null;
window.currentProfile = null;

window.updateNavigationUI = function() {
  const loginBtn = document.getElementById('nav-login-btn');
  if (loginBtn && window.currentUser) {
    const role = window.currentProfile?.role || 'customer';
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    loginBtn.href = role === 'admin' ? basePath + '/admin/dashboard.html' : basePath + '/dashboard/dashboard.html';
    loginBtn.textContent = 'Dashboard';
  }
};

// ==========================================
// INTERNAL HELPERS
// ==========================================

/**
 * Resets the global state safely.
 */
function clearState() {
  window.currentUser = null;
  window.currentProfile = null;
  return { user: null, profile: null };
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

/**
 * Loads the current session from Supabase, then fetches the user's profile.
 * Populates window.currentUser and window.currentProfile.
 * 
 * @returns {Promise<{user: object|null, profile: object|null}>}
 */
export async function loadCurrentUser() {
  try {
    console.log("[UserContext] Loading session...");
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mock')) {
      const mockRole = urlParams.get('mock') || 'admin';
      window.currentUser = { id: 'mock-id', email: 'mock@example.com' };
      window.currentProfile = { id: 'mock-id', name: 'Mock User', email: 'mock@example.com', phone: '1234567890', role: mockRole, created_at: '2026-01-01T00:00:00Z' };
      if (window.updateNavigationUI) window.updateNavigationUI();
      return { user: window.currentUser, profile: window.currentProfile };
    }
    
    // 1. Fetch active session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("[UserContext] Error reading session:", sessionError.message);
      return clearState();
    }
    
    if (!session || !session.user) {
      console.log("[UserContext] No active session.");
      return clearState();
    }
    
    // 2. Set current user
    window.currentUser = {
      id: session.user.id,
      email: session.user.email
    };
    
    console.log("[UserContext] Loading profile...");
    
    // 3. Fetch associated profile using the authenticated user id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, created_at')
      .eq('id', window.currentUser.id)
      .single();
      
    if (profileError) {
      console.error("[UserContext] Error fetching profile data:", profileError.message);
      window.currentProfile = null;
      return { user: window.currentUser, profile: null };
    }
    
    if (profile) {
      window.currentProfile = profile;
      console.log("[UserContext] Profile loaded.");
    } else {
      window.currentProfile = null;
      console.log("[UserContext] Missing profile data for this user.");
    }
    
    // Update navigation immediately if it's already in the DOM
    if (window.updateNavigationUI) window.updateNavigationUI();
    
    return { user: window.currentUser, profile: window.currentProfile };
    
  } catch (err) {
    console.error("[UserContext] Unexpected error during initialization:", err);
    return clearState();
  }
}

// ==========================================
// EXPORTED HELPER FUNCTIONS
// ==========================================

export function getCurrentUser() {
  return window.currentUser;
}

export function getCurrentProfile() {
  return window.currentProfile;
}

export function isLoggedIn() {
  return window.currentUser !== null;
}

export function isAdmin() {
  return isLoggedIn() && window.currentProfile !== null && window.currentProfile.role === 'admin';
}

export function isCustomer() {
  return isLoggedIn() && window.currentProfile !== null && window.currentProfile.role === 'customer';
}

export function updateNavigationUI() {
  const loginBtn = document.getElementById('nav-login-btn');
  if (loginBtn && window.currentUser) {
    const role = window.currentProfile?.role || 'customer';
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    loginBtn.href = role === 'admin' ? basePath + '/admin/dashboard.html' : basePath + '/dashboard/dashboard.html';
    loginBtn.textContent = 'Dashboard';
  }
}

// ==========================================
// AUTO INITIALIZATION
// ==========================================

// Automatically check session and load profile when this script executes
loadCurrentUser().catch(err => {
  console.error("[UserContext] Failed to auto-initialize user context:", err);
});

// Optionally listen for auth state changes to keep the state synchronized across tabs/logins
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    loadCurrentUser();
  } else if (event === 'SIGNED_OUT') {
    clearState();
    console.log("[UserContext] Session cleared on logout.");
  }
});
