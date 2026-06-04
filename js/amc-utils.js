/**
 * amc-utils.js
 * Centralized AMC mathematical and status calculations.
 */

/**
 * Calculates days remaining from today until the expiry date.
 * @param {string|Date} expiryDate - The expiry date
 * @returns {number} Negative means expired, positive means active/upcoming
 */
export function calculateDaysRemaining(expiryDate) {
  if (!expiryDate) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to midnight
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Derives the dynamic AMC status based on hard DB status and days remaining.
 * @param {string} dbStatus - Active/Inactive text from DB
 * @param {number} daysLeft - output from calculateDaysRemaining
 * @returns {Object} { label: string, color: string, isWarning: boolean }
 */
export function getAMCStatus(dbStatus, daysLeft) {
  // If the DB explicitly says it's inactive or cancelled, honor it first.
  if (dbStatus && dbStatus.toLowerCase() === 'inactive') {
    return { label: 'Inactive', class: 'status-danger', isWarning: true };
  }

  if (daysLeft < 0) {
    return { label: 'Expired', class: 'status-danger', isWarning: true };
  } else if (daysLeft <= 7) {
    return { label: `Expiring in ${daysLeft} days`, class: 'status-warning', isWarning: true };
  } else if (daysLeft <= 15) {
    return { label: `Expiring in ${daysLeft} days`, class: 'status-warning', isWarning: true };
  } else if (daysLeft <= 30) {
    return { label: `Expiring in ${daysLeft} days`, class: 'status-warning', isWarning: true };
  } else {
    return { label: 'Active', class: 'status-success', isWarning: false };
  }
}

/**
 * Calculates a new expiry date exactly 1 year from the current expiry date.
 * @param {string} currentExpiry 
 * @returns {string} YYYY-MM-DD
 */
export function calculateOneYearRenewal(currentExpiry) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(currentExpiry);

  // If no valid expiry OR if it's already expired, renew from TODAY
  if (isNaN(expiryDate.getTime()) || expiryDate < today) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  
  // If it is active (future expiry), append 1 year to the existing expiry
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  return expiryDate.toISOString().split('T')[0];
}
