/**
 * auth.js
 * Handles authentication, signup, login, logout, and route protection.
 */

// Import the centralized Supabase client
import { supabase } from './supabase.js';

// ==========================================
// UI HELPERS
// ==========================================

/**
 * Displays a styled message in a specific container.
 * @param {string} type - 'error', 'success', or 'info'
 * @param {string} message - The message text
 * @param {string} context - The prefix for the HTML element ID (e.g., 'login', 'signup')
 */
function showMessage(type, message, context = 'login') {
  const msgContainer = document.getElementById(`${context}-message`);
  if (!msgContainer) return;
  
  msgContainer.style.display = 'block';
  msgContainer.textContent = message;
  
  if (type === 'error') {
    msgContainer.className = 'message-box message-error';
  } else if (type === 'success') {
    msgContainer.className = 'message-box message-success';
  } else {
    msgContainer.className = 'message-box';
    msgContainer.textContent = 'Loading...';
  }
}

function hideMessage(context = 'login') {
  const msgContainer = document.getElementById(`${context}-message`);
  if (msgContainer) msgContainer.style.display = 'none';
}

function setLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Please wait...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Submit';
  }
}

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================

async function handleSignup(event) {
  event.preventDefault();
  
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;
  
  // Validation
  if (password !== confirmPassword) {
    return showMessage('error', 'Passwords do not match.', 'signup');
  }
  
  if (password.length < 8) {
    return showMessage('error', 'Password must be at least 8 characters.', 'signup');
  }
  
  hideMessage('signup');
  setLoading('signup-btn', true);
  
  try {
    // Step 1: Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (authError) throw authError;
    if (!authData.user) throw new Error("Signup failed. Please try again.");
    
    // Step 2: Insert profile record matching the auth user id
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          name: name,
          email: email,
          phone: phone,
          role: 'customer' // Default role for new signups
        }
      ]);
      
    if (profileError) {
      console.error("Profile creation error:", profileError);
      throw new Error(`Profile setup failed: ${profileError.message || profileError.details || 'Unknown database error'}`);
    }
    
    // Step 3: Show success message
    showMessage('success', 'Signup successful! Redirecting to login...', 'signup');
    
    // Step 4: Redirect to login page
    setTimeout(() => {
      const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
      window.location.href = basePath + '/login.html';
    }, 2000);
    
  } catch (error) {
    showMessage('error', error.message, 'signup');
    setLoading('signup-btn', false);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  hideMessage('login');
  setLoading('login-btn', true);
  
  try {
    // Authenticate user via Supabase session
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) throw authError;
    
    // Fetch profile to determine role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();
      
    if (profileError || !profile) {
      throw new Error("Failed to load user profile role.");
    }
    
    showMessage('success', 'Login successful! Redirecting...', 'login');
    
    // Role-based redirection
    setTimeout(() => {
      const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
      if (profile.role === 'admin') {
        window.location.href = basePath + '/admin/dashboard.html';
      } else {
        window.location.href = basePath + '/dashboard/dashboard.html';
      }
    }, 1000);
    
  } catch (error) {
    showMessage('error', error.message, 'login');
    setLoading('login-btn', false);
  }
}

async function logout() {
  if (!confirm("Are you sure you want to log out?")) {
    return;
  }
  try {
    // End Supabase session & clear local state
    await supabase.auth.signOut();
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    window.location.href = basePath + '/login.html';
  } catch (error) {
    console.error("Logout error:", error);
    // Fallback redirect
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    window.location.href = basePath + '/login.html';
  }
}

// Expose logout globally so it can be called from header buttons via onclick="logout()"
window.logout = logout;

// ==========================================
// ROUTE PROTECTION & SESSION MANAGEMENT
// ==========================================

async function enforceRouteProtection() {
  const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
  const path = window.location.pathname;
  const isCustomerRoute = path.startsWith(basePath + '/dashboard/');
  const isAdminRoute = path.startsWith(basePath + '/admin/');
  const isAuthRoute = path === basePath + '/login.html' || path === basePath + '/signup.html';
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('mock')) {
    console.log("[Auth] Bypassing route protection via mock mode.");
    return;
  }
  
  // Get current persistent session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // Redirect unauthenticated users trying to access protected routes
    if (isCustomerRoute || isAdminRoute) {
      window.location.replace(basePath + '/login.html');
    }
    return;
  }
  
  // User is logged in, verify their role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
    
  if (error || !profile) {
    console.error("Route protection error: Could not determine user role.");
    return;
  }
  
  const role = profile.role;
  
  // Prevent customers from accessing admin routes
  if (isAdminRoute && role !== 'admin') {
    window.location.replace(basePath + '/dashboard/dashboard.html');
  }
  // Prevent admins from accessing customer routes
  else if (isCustomerRoute && role !== 'customer') {
    window.location.replace(basePath + '/admin/dashboard.html');
  }
  // If logged in and on auth pages, redirect to the appropriate dashboard
  else if (isAuthRoute) {
    if (role === 'admin') {
      window.location.replace(basePath + '/admin/dashboard.html');
    } else {
      window.location.replace(basePath + '/dashboard/dashboard.html');
    }
  }
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupForm');
  if (signupForm) signupForm.addEventListener('submit', handleSignup);
  
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  
  // Run route protection check automatically
  enforceRouteProtection();
});

// Listen for cross-tab auth state changes (e.g. logging out in another tab)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    const basePath = window.basePath || (window.location.pathname.includes('/gb260001-vigilanteye-portal') ? '/gb260001-vigilanteye-portal' : '');
    const path = window.location.pathname;
    if (path.startsWith(basePath + '/dashboard/') || path.startsWith(basePath + '/admin/')) {
      window.location.href = basePath + '/login.html';
    }
  }
});
