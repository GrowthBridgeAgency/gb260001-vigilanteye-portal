import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');

  if (!invoiceId) {
    document.getElementById('loading-overlay').innerHTML = 'Invoice ID not provided. <button onclick="window.history.back()" style="margin-left:1rem; padding:0.5rem 1rem;">Go Back</button>';
    return;
  }

  await fetchAndRenderInvoice(invoiceId);

  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-download').addEventListener('click', downloadPDF);
});

async function fetchAndRenderInvoice(id) {
  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        profiles:customer_id (name, email, phone),
        invoice_items (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!invoice) throw new Error("Invoice not found.");

    // Fill Header Info
    document.getElementById('inv-number').textContent = invoice.invoice_number || '-';
    document.getElementById('inv-date').textContent = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN') : '-';
    document.getElementById('inv-due-date').textContent = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : '-';
    document.getElementById('inv-status').textContent = invoice.status || 'Pending';

    // Status styling logic
    const statusEl = document.getElementById('inv-status');
    if (invoice.status === 'Paid') {
      statusEl.style.color = '#22c55e';
    } else if (invoice.status === 'Cancelled') {
      statusEl.style.color = '#ef4444';
    } else {
      statusEl.style.color = '#f59e0b';
    }

    // Fill Customer Info
    const cust = invoice.profiles || {};
    document.getElementById('cust-name').textContent = cust.name || 'Unknown Customer';
    document.getElementById('cust-phone').textContent = cust.phone || '';
    document.getElementById('cust-email').textContent = cust.email || '';
    document.getElementById('cust-address').textContent = cust.address || '';

    // Render Items
    const itemsTbody = document.getElementById('inv-items-tbody');
    itemsTbody.innerHTML = '';
    const items = invoice.invoice_items || [];
    
    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.item_name}</td>
        <td>${item.quantity}</td>
        <td>₹${parseFloat(item.unit_price).toLocaleString('en-IN')}</td>
        <td>₹${parseFloat(item.total_price).toLocaleString('en-IN')}</td>
      `;
      itemsTbody.appendChild(row);
    });

    // Fill Summary
    document.getElementById('inv-subtotal').textContent = `₹${parseFloat(invoice.subtotal || 0).toLocaleString('en-IN')}`;
    document.getElementById('inv-discount').textContent = `₹${parseFloat(invoice.discount_amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('inv-tax').textContent = `₹${parseFloat(invoice.tax_amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('inv-grand-total').textContent = `₹${parseFloat(invoice.amount || 0).toLocaleString('en-IN')}`;

    // Notes
    const notesEl = document.getElementById('inv-notes-content');
    if (invoice.notes) {
      notesEl.textContent = invoice.notes;
    } else {
      notesEl.textContent = 'Thank you for your business!';
    }

    // Hide overlay
    document.getElementById('loading-overlay').style.display = 'none';

  } catch (error) {
    console.error("Error loading invoice:", error);
    document.getElementById('loading-overlay').innerHTML = `Error loading invoice. <br><br>${error.message} <button onclick="window.history.back()" style="margin-left:1rem; padding:0.5rem 1rem;">Go Back</button>`;
  }
}

function downloadPDF() {
  const element = document.getElementById('invoice-capture-area');
  const invNumber = document.getElementById('inv-number').textContent || 'Invoice';
  const opt = {
    margin:       [0, 0, 0, 0], // Margin handled by CSS padding inside wrapper
    filename:     `${invNumber}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  // Temporarily remove shadow and border radius for clean PDF
  const originalShadow = element.style.boxShadow;
  const originalRadius = element.style.borderRadius;
  const originalMargin = element.style.margin;
  
  element.style.boxShadow = 'none';
  element.style.borderRadius = '0';
  element.style.margin = '0';

  html2pdf().set(opt).from(element).save().then(() => {
    // Restore
    element.style.boxShadow = originalShadow;
    element.style.borderRadius = originalRadius;
    element.style.margin = originalMargin;
  });
}
