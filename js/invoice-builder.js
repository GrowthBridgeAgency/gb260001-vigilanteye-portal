import { supabase } from './supabase.js';
import { loadCurrentUser, isAdmin } from './user-context.js';
import { showToast } from './toast.js';

let customers = [];
let itemIndex = 0;
let generatedInvNumber = '';

const formEls = {
  customer: document.getElementById('f_customer'),
  date: document.getElementById('f_date'),
  dueDate: document.getElementById('f_due_date'),
  status: document.getElementById('f_status'),
  tax: document.getElementById('f_tax'),
  discount: document.getElementById('f_discount'),
  notes: document.getElementById('f_notes')
};

const prevEls = {
  invNum: document.getElementById('p_inv_num'),
  date: document.getElementById('p_date'),
  dueDate: document.getElementById('p_due_date'),
  status: document.getElementById('p_status'),
  cName: document.getElementById('p_cust_name'),
  cPhone: document.getElementById('p_cust_phone'),
  cEmail: document.getElementById('p_cust_email'),
  cAddr: document.getElementById('p_cust_address'),
  items: document.getElementById('p_items'),
  notes: document.getElementById('p_notes'),
  subtotal: document.getElementById('p_subtotal'),
  discount: document.getElementById('p_discount'),
  taxAmt: document.getElementById('p_tax_amount'),
  grandTotal: document.getElementById('p_grand_total')
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  if (!isAdmin()) {
    showToast('Unauthorized access.', 'error');
    setTimeout(() => window.location.href = '../dashboard/dashboard.html', 1500);
    return;
  }

  // Set default dates
  const today = new Date();
  formEls.date.value = today.toISOString().split('T')[0];
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  formEls.dueDate.value = nextWeek.toISOString().split('T')[0];

  generatedInvNumber = await generateInvoiceNumber();
  prevEls.invNum.textContent = generatedInvNumber;

  await fetchCustomers();

  // Add initial item
  addItemRow();

  // Attach listeners
  Object.values(formEls).forEach(el => {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });

  document.getElementById('btn-add-item').addEventListener('click', addItemRow);
  document.getElementById('btn-save').addEventListener('click', saveInvoice);

  updatePreview();
});

async function fetchCustomers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone')
    .eq('role', 'customer')
    .order('name');
  
  if (!error && data) {
    customers = data;
    renderCustomSelect(customers);
  }
}

// Custom Select Logic
const selectBtn = document.getElementById('custom_select_btn');
const selectText = document.getElementById('custom_select_text');
const selectDropdown = document.getElementById('custom_select_dropdown');
const searchInput = document.getElementById('custom_select_search');
const listEl = document.getElementById('custom_select_list');

selectBtn.addEventListener('click', () => {
  selectDropdown.style.display = selectDropdown.style.display === 'none' ? 'block' : 'none';
  if(selectDropdown.style.display === 'block') {
    searchInput.value = '';
    renderCustomSelect(customers);
    searchInput.focus();
  }
});

document.addEventListener('click', (e) => {
  if(!e.target.closest('#custom_select_btn') && !e.target.closest('#custom_select_dropdown')) {
    selectDropdown.style.display = 'none';
  }
});

searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(term) || 
    (c.email && c.email.toLowerCase().includes(term)) ||
    (c.phone && c.phone.toLowerCase().includes(term))
  );
  renderCustomSelect(filtered);
});

function renderCustomSelect(items) {
  listEl.innerHTML = items.length ? items.map(c => `
    <li onclick="window.selectCustomer('${c.id}', '${c.name.replace(/'/g, "\\'")}')">
      <div style="font-weight:600; color:#fff;">${c.name}</div>
      <div style="font-size:0.8rem; color:var(--text-muted);">${c.email || c.phone || 'No contact info'}</div>
    </li>
  `).join('') : '<li style="padding:1rem; text-align:center; color:var(--text-muted);">No customers found</li>';
}

window.selectCustomer = (id, name) => {
  formEls.customer.value = id;
  selectText.textContent = name;
  selectDropdown.style.display = 'none';
  // Manually trigger the preview update
  updatePreview();
};

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    const lastNum = data[0].invoice_number.split('-').pop();
    const nextNum = parseInt(lastNum, 10) + 1;
    return `${prefix}${nextNum.toString().padStart(6, '0')}`;
  }
  return `${prefix}000001`;
}

function addItemRow() {
  const idx = itemIndex++;
  const html = `
    <div class="item-row" id="item_${idx}">
      <button type="button" class="btn-remove-item" onclick="document.getElementById('item_${idx}').remove(); window.updatePreview();">&times;</button>
      <div class="form-group" style="margin-bottom:0.5rem;">
        <input type="text" class="form-control i-name" placeholder="Item description..." required>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <input type="number" class="form-control i-qty" value="1" min="1" placeholder="Qty" required style="width:80px;">
        <input type="number" class="form-control i-price" value="0" min="0" placeholder="Unit Price" required>
      </div>
    </div>
  `;
  document.getElementById('items-container').insertAdjacentHTML('beforeend', html);
  
  // Attach listeners to new inputs
  const row = document.getElementById(`item_${idx}`);
  row.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updatePreview);
  });
  updatePreview();
}

// Make globally available for inline onclick
window.updatePreview = updatePreview;

function updatePreview() {
  // Update Header info
  prevEls.date.textContent = formEls.date.value ? new Date(formEls.date.value).toLocaleDateString('en-IN') : '-';
  prevEls.dueDate.textContent = formEls.dueDate.value ? new Date(formEls.dueDate.value).toLocaleDateString('en-IN') : '-';
  
  const st = formEls.status.value;
  prevEls.status.textContent = st;
  prevEls.status.style.color = st === 'Paid' ? '#22c55e' : (st === 'Cancelled' ? '#ef4444' : '#f59e0b');

  // Customer info
  const selectedCid = formEls.customer.value;
  const c = customers.find(x => String(x.id) === selectedCid);
  if (c) {
    prevEls.cName.textContent = c.name;
    prevEls.cPhone.textContent = c.phone || '';
    prevEls.cEmail.textContent = c.email || '';
    prevEls.cAddr.textContent = c.address || '';
  } else {
    prevEls.cName.textContent = 'Select a Customer';
    prevEls.cPhone.textContent = '';
    prevEls.cEmail.textContent = '';
    prevEls.cAddr.textContent = '';
  }

  // Items & Totals
  let subtotal = 0;
  prevEls.items.innerHTML = '';
  const rows = document.querySelectorAll('.item-row');
  
  rows.forEach(row => {
    const name = row.querySelector('.i-name').value || 'Item Description';
    const qty = parseFloat(row.querySelector('.i-qty').value) || 0;
    const price = parseFloat(row.querySelector('.i-price').value) || 0;
    const total = qty * price;
    subtotal += total;

    prevEls.items.innerHTML += `
      <tr>
        <td>${name}</td>
        <td>${qty}</td>
        <td>₹${price.toLocaleString('en-IN')}</td>
        <td>₹${total.toLocaleString('en-IN')}</td>
      </tr>
    `;
  });

  const discount = parseFloat(formEls.discount.value) || 0;
  const taxPct = parseFloat(formEls.tax.value) || 0;
  
  const subAfterDiscount = Math.max(0, subtotal - discount);
  const taxAmt = subAfterDiscount * (taxPct / 100);
  const grandTotal = subAfterDiscount + taxAmt;

  prevEls.subtotal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  prevEls.discount.textContent = `₹${discount.toLocaleString('en-IN')}`;
  prevEls.taxAmt.textContent = `₹${taxAmt.toLocaleString('en-IN')}`;
  prevEls.grandTotal.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  prevEls.notes.textContent = formEls.notes.value || '';
}

async function saveInvoice() {
  const btn = document.getElementById('btn-save');
  
  if (!formEls.customer.value) return showToast('Please select a customer.', 'error');
  
  const rows = document.querySelectorAll('.item-row');
  if (rows.length === 0) return showToast('Please add at least one item.', 'error');

  const itemsPayload = [];
  let subtotal = 0;
  
  for (let row of rows) {
    const name = row.querySelector('.i-name').value.trim();
    const qty = parseFloat(row.querySelector('.i-qty').value) || 0;
    const price = parseFloat(row.querySelector('.i-price').value) || 0;
    if (!name) return showToast('All items must have a description.', 'error');
    
    const total = qty * price;
    subtotal += total;
    itemsPayload.push({
      item_name: name,
      quantity: qty,
      unit_price: price,
      total_price: total
    });
  }

  const discount = parseFloat(formEls.discount.value) || 0;
  const taxPct = parseFloat(formEls.tax.value) || 0;
  const subAfterDiscount = Math.max(0, subtotal - discount);
  const taxAmt = subAfterDiscount * (taxPct / 100);
  const grandTotal = subAfterDiscount + taxAmt;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const payload = {
      invoice_number: generatedInvNumber,
      customer_id: formEls.customer.value,
      invoice_date: formEls.date.value,
      due_date: formEls.dueDate.value,
      subtotal: subtotal,
      tax_amount: taxAmt,
      discount_amount: discount,
      amount: grandTotal,
      status: formEls.status.value,
      notes: formEls.notes.value.trim()
    };

    const { data: invData, error: invError } = await supabase
      .from('invoices')
      .insert([payload])
      .select('id')
      .single();

    if (invError) throw invError;

    // Insert items
    const finalItems = itemsPayload.map(i => ({ ...i, invoice_id: invData.id }));
    const { error: itemsError } = await supabase.from('invoice_items').insert(finalItems);
    if (itemsError) throw itemsError;

    showToast('Invoice generated successfully!', 'success');
    
    // Redirect to the View page
    setTimeout(() => {
      window.location.href = `../invoice-view.html?id=${invData.id}`;
    }, 1000);

  } catch (err) {
    console.error(err);
    showToast(`Error saving invoice: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}
