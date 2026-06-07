/**
 * notification-service.js
 * Centralized service for loading, rendering, and creating notifications.
 */

import { supabase } from './supabase.js';

let notificationInterval = null;

export async function loadNotifications() {
  if (!window.currentUser || !window.currentUser.id) return;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Filter to last 90 days client-side just in case, though ideally done via DB.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentNotifications = data.filter(n => new Date(n.created_at) > ninetyDaysAgo);

    renderNotificationDropdown(recentNotifications);
    updateUnreadBadge(recentNotifications);
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

export async function createNotification(userId, title, message, type, link = null, relatedId = null) {
  try {
    // Only standardized types allowed per spec
    const validTypes = ['complaint', 'invoice', 'product', 'review', 'amc', 'enquiry', 'service', 'account', 'system'];
    const safeType = validTypes.includes(type) ? type : 'system';

    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title,
        message,
        type: safeType,
        is_read: false,
        link,
        related_id: relatedId
      }]);

    if (error) throw error;

    // If notifying the current user (e.g. self-action, though rare), reload instantly
    if (userId === window.currentUser?.id) {
      loadNotifications();
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function notifyAdmins(title, message, type, link = null, relatedId = null) {
  try {
    // Find all admins
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'Admin');
      
    if (adminError) throw adminError;
    if (!admins || admins.length === 0) return;

    // Create a notification for each admin
    const validTypes = ['complaint', 'invoice', 'product', 'review', 'amc', 'enquiry', 'service', 'account', 'system'];
    const safeType = validTypes.includes(type) ? type : 'system';

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message,
      type: safeType,
      is_read: false,
      link,
      related_id: relatedId
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}

export async function markAsRead(notificationId, link = null) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', window.currentUser.id);

    if (error) throw error;
    
    // Refresh UI without waiting
    loadNotifications();

    if (link) {
      window.location.href = window.basePath ? window.basePath + link : link;
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    if (link) {
      // Degrade gracefully if DB fails
      window.location.href = window.basePath ? window.basePath + link : link;
    }
  }
}

export async function markAllAsRead() {
  if (!window.currentUser) return;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', window.currentUser.id)
      .eq('is_read', false);

    if (error) throw error;
    loadNotifications();
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
}

export function getUnreadCount(notifications) {
  return notifications.filter(n => !n.is_read).length;
}

function updateUnreadBadge(notifications) {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;

  const count = getUnreadCount(notifications);
  if (count > 0) {
    badge.style.display = 'flex';
    badge.textContent = count > 99 ? '99+' : count;
  } else {
    badge.style.display = 'none';
  }
}

function renderNotificationDropdown(notifications) {
  const container = document.getElementById('notification-list');
  if (!container) return;

  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="notification-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom: 1rem;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <h4>No notifications yet</h4>
        <p>You're all caught up.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(n => {
    const timeAgo = getTimeAgo(new Date(n.created_at));
    const isUnread = !n.is_read;
    const bgClass = isUnread ? 'notification-item unread' : 'notification-item';
    const linkAction = n.link ? `onclick="window.notificationService.markAsRead('${n.id}', '${n.link}')"` : `onclick="window.notificationService.markAsRead('${n.id}')"`;

    return `
      <div class="${bgClass}" ${linkAction}>
        <div class="notification-content">
          <div class="notification-title">${n.title}</div>
          <div class="notification-message">${n.message}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        ${isUnread ? '<div class="unread-dot"></div>' : ''}
      </div>
    `;
  }).join('');
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "Just now";
}

// 90 Day cleanup (Not implemented for V1 per user instruction)
export function deleteOldNotifications() {
  console.log("Cleanup deferred from V1.");
}

// Initialize polling
export function initNotificationPolling() {
  // Wait for currentUser to be set
  const checkUser = setInterval(() => {
    if (window.currentUser) {
      clearInterval(checkUser);
      loadNotifications();
      
      // Clear existing interval if any
      if (notificationInterval) clearInterval(notificationInterval);
      
      // Poll every 30 seconds
      notificationInterval = setInterval(loadNotifications, 30000);
    }
  }, 500);
}

// Attach to window so HTML onClick events can reach it
window.notificationService = {
  createNotification,
  notifyAdmins,
  markAsRead,
  markAllAsRead,
  loadNotifications,
  initNotificationPolling
};

// Global click-outside listener to close the dropdown
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('notification-dropdown');
  const bell = document.getElementById('notification-bell');
  if (dropdown && dropdown.classList.contains('show') && bell && !dropdown.contains(e.target) && !bell.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});
