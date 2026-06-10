import { supabase } from './supabase.js';
import { showToast } from './toast.js';

window.openProductEnquiryModal = function(productName) {
  const modal = document.getElementById('enquiry-modal');
  if (!modal) return;
  
  // Safely get the product name from either index.html or products.html
  let finalName = productName;
  if (!finalName) {
    const el1 = document.getElementById('prod-modal-title');
    const el2 = document.getElementById('modal-prod-title');
    if (el1 && el1.textContent) finalName = el1.textContent;
    else if (el2 && el2.textContent) finalName = el2.textContent;
    else finalName = 'Selected Product';
  }
  
  document.getElementById('enq_product_name').value = finalName;
  document.getElementById('enquiry-product-subtitle').textContent = `Product: ${finalName}`;
  
  // Close the product modal first so they don't overlap awkwardly
  if (typeof window.closeModal === 'function') {
    window.closeModal('product-modal');
  } else {
    const pm = document.getElementById('product-modal');
    if (pm) pm.classList.remove('active');
  }
  
  // Open the enquiry modal
  if (typeof window.openModal === 'function') {
    window.openModal('enquiry-modal');
  } else {
    modal.classList.add('active');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('product-enquiry-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-prod-enquiry');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      const name = document.getElementById('enq_name').value.trim();
      const mobile = document.getElementById('enq_mobile').value.trim();
      const location = document.getElementById('enq_location').value.trim();
      const messageText = document.getElementById('enq_message').value.trim();
      const productName = document.getElementById('enq_product_name').value.trim();

      const fullMessage = `Product Enquiry: ${productName}\n\n${messageText}`;

      const payload = {
        name,
        mobile,
        email: null,
        location,
        requirement_type: 'Other',
        budget: '',
        message: fullMessage,
        file_url: null,
        status: 'New'
      };

      const { error } = await supabase.from('enquiries').insert([payload]);
      if (error) throw error;

      showToast('Enquiry submitted successfully!', 'success');
      
      form.reset();
      if (typeof window.closeModal === 'function') {
        window.closeModal('enquiry-modal');
      } else {
        document.getElementById('enquiry-modal').classList.remove('active');
      }

    } catch (err) {
      console.error(err);
      showToast('Failed to submit enquiry: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Enquiry';
    }
  });
});
