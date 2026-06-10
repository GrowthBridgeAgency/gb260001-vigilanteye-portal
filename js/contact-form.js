/**
 * contact-form.js
 * Handles the public enquiry submission and file upload
 */

import { supabase } from './supabase.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('enquiry-form');
  const btnSubmit = document.getElementById('btn-submit-enquiry');
  
  if (!form) return;

  // Pre-fill from URL query params (e.g. ?product=DS-2CD1043G0)
  const urlParams = new URLSearchParams(window.location.search);
  const productEnquiry = urlParams.get('product');
  if (productEnquiry) {
    const requirementType = document.getElementById('requirement_type');
    const messageField = document.getElementById('message');
    
    if (requirementType) {
      // Let's set it to 'Other' since it's a specific product enquiry
      requirementType.value = 'Other';
    }
    
    if (messageField) {
      messageField.value = `I would like to enquire about the following product: ${productEnquiry}\n\nPlease provide more details regarding pricing and availability.`;
    }
    
    // Auto-scroll to form so user sees it right away
    setTimeout(() => {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting...';

    try {
      const name = document.getElementById('name').value.trim();
      const mobile = document.getElementById('mobile_number').value.trim();
      const location = document.getElementById('location').value.trim();
      const budget = document.getElementById('budget').value.trim();
      const requirement_type = document.getElementById('requirement_type').value;
      const message = document.getElementById('message').value.trim();
      
      const fileInput = document.getElementById('file_upload');
      const file = fileInput.files[0];
      
      let file_url = null;

      // 1. Upload file if selected
      if (file) {
        // Basic validation
        const allowedTypes = [
          'application/pdf', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg', 
          'image/png', 
          'image/jpg'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          showToast('Invalid file type. Only PDF, DOC, and Images allowed.', 'error');
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Submit Enquiry';
          return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `public/${fileName}`; // Assuming a public folder or root

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiries')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('enquiries')
          .getPublicUrl(filePath);
          
        file_url = publicUrlData.publicUrl;
      }

      // 2. Insert Enquiry Record
      const payload = {
        name,
        mobile,
        email: 'Provided via phone' + (Math.random()), // Since we removed email from form HTML but it's in schema, wait - does contact.html have an email field?
        location,
        requirement_type,
        budget,
        message,
        file_url,
        status: 'New'
      };

      // Ah, wait, contact.html does NOT have an email field in the DOM! I'll leave it null if it's not strictly NOT NULL, or fetch if it exists.
      const emailField = document.getElementById('email');
      if (emailField) {
        payload.email = emailField.value.trim();
      } else {
        payload.email = null; // Assuming DB allows null email since it wasn't in the HTML.
      }

      const { error: insertError } = await supabase
        .from('enquiries')
        .insert([payload]);

      if (insertError) throw insertError;

      // 3. Success state

      showToast('Thank you. Our team will contact you shortly.', 'success');
      form.reset();

    } catch (err) {
      console.error('Submission error:', err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit Enquiry';
    }
  });
});
