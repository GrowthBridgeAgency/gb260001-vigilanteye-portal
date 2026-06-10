/**
 * supabase.js
 * Centralized Supabase client configuration for SafeVision Surveillance Portal.
 */

// Use the official Supabase CDN via ES Modules
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ==========================================
// CONFIGURATION
// ==========================================

const SUPABASE_CONFIG = {
  // Replace 'YOUR_SUPABASE_URL' with your actual Supabase Project URL
  url: 'https://wtbwngzkxjlpysrngofp.supabase.co',
  // Replace 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase Anon Key
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0YnduZ3preGpscHlzcm5nb2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzc4OTcsImV4cCI6MjA5NjA1Mzg5N30.dyW70-_YcLv2K4_Qto3bJi8RevRPibOaeUPVE72FBBw'
};

// ==========================================
// INITIALIZATION
// ==========================================

let supabase;

try {
  console.log("[Supabase] Initializing client...");

  // Basic validation for missing or default configuration
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey ||
    SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' ||
    SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
    throw new Error("Invalid or missing Supabase URL/Anon Key in configuration.");
  }

  // Create the single reusable Supabase client
  supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  // Expose the client globally for older non-module scripts
  window.supabase = supabase;

  console.log("[Supabase] Client initialized successfully.");
} catch (error) {
  console.error("[Supabase] Failed to initialize client:", error.message || error);
}

// ==========================================
// CONNECTION VERIFICATION
// ==========================================

/**
 * Verifies the connection to Supabase and database access.
 * Queries the 'profiles' table to ensure database connectivity, 
 * API key validity, and proper access configuration.
 * 
 * @returns {Promise<boolean>} True if connected successfully, false otherwise.
 */
async function checkSupabaseConnection() {
  if (!supabase) {
    console.error("[Supabase] Cannot check connection: Client is not initialized.");
    return false;
  }

  try {
    console.log("[Supabase] Testing database connection...");

    // Attempt a lightweight query to the 'profiles' table
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.error("[Supabase] Connection failed. Database error:", error.message);
      return false;
    }

    console.log("[Supabase] Connection successful.");
    return true;
  } catch (err) {
    console.error("[Supabase] Connection failed due to an unexpected network or execution error:", err.message || err);
    return false;
  }
}

// Expose the connection checker globally
window.checkSupabaseConnection = checkSupabaseConnection;

// Export the client and functions for future ES module usage
export { supabase, checkSupabaseConnection };
