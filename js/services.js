/**
 * services.js
 * Logic for dynamic data on the public Services page.
 */

import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  fetchServicesData();
});

async function fetchServicesData() {
  try {
    const { data: products } = await supabase.from('products').select('product_name');

    // Calculate dynamic counts based on installation data
    let cctvCount = 0;
    let biometricCount = 0;
    let vdpCount = 0;

    if (products) {
      products.forEach(p => {
        const name = (p.product_name || '').toLowerCase();
        if (name.includes('camera') || name.includes('cctv')) cctvCount++;
        else if (name.includes('biometric') || name.includes('attendance')) biometricCount++;
        else if (name.includes('vdp') || name.includes('video door') || name.includes('intercom')) vdpCount++;
      });
    }

    updateCount('count-cctv', cctvCount, ' Active Installations');
    updateCount('count-biometric', biometricCount, ' Active Installations');
    updateCount('count-vdp', vdpCount, ' Active Installations');

  } catch (error) {
    console.error("Error fetching services data:", error);
  }
}

function updateCount(id, count, suffix) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = count > 0 ? `${count}+${suffix}` : `New${suffix}`;
  }
}
