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

    const isNew = data.some(n => !n.is_read && (!window.lastNotificationTime || new Date(n.created_at) > window.lastNotificationTime));
    if (isNew && window.lastNotificationTime) {
      playNotificationSound();
    }
    
    if (data.length > 0) {
      window.lastNotificationTime = new Date(data[0].created_at);
    }

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
      .eq('role', 'admin');
      
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

export async function markTypeAsRead(type) {
  if (!window.currentUser) return;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', window.currentUser.id)
      .eq('is_read', false)
      .eq('type', type);

    if (error) throw error;
    loadNotifications(); // Refresh all badges and lists
  } catch (error) {
    console.error(`Error marking type ${type} as read:`, error);
  }
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
  
  updateSidebarBadges(notifications);
}

function updateSidebarBadges(notifications) {
  // Count unread by type
  const unreadByType = {};
  notifications.forEach(n => {
    if (!n.is_read) {
      unreadByType[n.type] = (unreadByType[n.type] || 0) + 1;
    }
  });

  // Allowed sidebar types matching element IDs nav-{type}
  const types = ['complaint', 'invoice', 'product', 'review', 'amc', 'enquiry', 'service'];
  
  types.forEach(type => {
    const navLink = document.getElementById(`nav-${type}`);
    if (navLink) {
      let badge = navLink.querySelector('.sidebar-badge');
      const count = unreadByType[type] || 0;
      
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'sidebar-badge';
          badge.style.cssText = 'background: #ef4444; color: white; font-size: 0.75rem; padding: 2px 6px; border-radius: 12px; margin-left: auto; font-weight: 600; line-height: 1; display: flex; align-items: center; justify-content: center;';
          navLink.style.display = 'flex';
          navLink.style.alignItems = 'center';
          navLink.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else {
        if (badge) badge.style.display = 'none';
      }
    }
  });
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

  let html = notifications.map(n => {
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
  container.innerHTML = html;
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

let notificationAudio = null;

function playNotificationSound() {
  try {
    if (!notificationAudio) {
      const audioPath = window.basePath ? window.basePath + '/Sound/notisound.mp3' : '/Sound/notisound.mp3';
      notificationAudio = new Audio(audioPath);
    }
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(e => console.log('Audio play blocked (user must interact first):', e));
  } catch (err) {
    console.error('Error playing sound:', err);
  }
}

// Initialize realtime subscriptions
let isPollingInitialized = false;
export function initNotificationPolling() {
  if (isPollingInitialized) return;
  isPollingInitialized = true;
  const checkUser = setInterval(() => {
    if (window.currentUser) {
      clearInterval(checkUser);
      loadNotifications();
      injectSeeAllModal();
      
      // Auto-clear notifications based on page URL
      const path = window.location.pathname;
      const pathTypes = {
        'complaints': 'complaint',
        'invoices': 'invoice',
        'products': 'product',
        'reviews': 'review',
        'amc': 'amc',
        'enquiries': 'enquiry',
        'service-history': 'service'
      };
      for (const [key, type] of Object.entries(pathTypes)) {
        if (path.includes(key)) {
          markTypeAsRead(type);
          break;
        }
      }
      
      // Subscribe to real-time changes
      supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${window.currentUser.id}`
          },
          (payload) => {
            loadNotifications();
            if (document.getElementById('all-notifications-modal')?.classList.contains('active')) {
                loadAllNotifications();
            }
          }
        )
        .subscribe();
    }
  }, 500);
}

// "See All" functionality
export async function loadAllNotifications() {
  if (!window.currentUser) return;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    renderAllNotificationsList(data);
  } catch (err) {
    console.error(err);
  }
}

function renderAllNotificationsList(notifications) {
  const container = document.getElementById('all-notifications-modal-list');
  if (!container) return;
  if (notifications.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 3rem;">No notifications found.</p>';
    return;
  }
  container.innerHTML = notifications.map(n => {
    const timeStr = new Date(n.created_at).toLocaleString('en-IN');
    const isUnread = !n.is_read;
    const bgClass = isUnread ? 'notification-item unread' : 'notification-item';
    const linkAction = n.link ? `onclick="window.notificationService.markAsRead('${n.id}', '${n.link}')"` : `onclick="window.notificationService.markAsRead('${n.id}')"`;
    
    return `
      <div class="${bgClass}" ${linkAction} style="cursor:pointer; display:flex; gap:1.5rem; padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s;">
        <div style="flex:1;">
          <div style="font-weight:600; color:#fff; font-size:1.05rem; margin-bottom:0.25rem;">${n.title}</div>
          <div style="color:rgba(255,255,255,0.7); font-size:0.95rem; margin-bottom:0.75rem;">${n.message}</div>
          <div style="color:var(--text-muted); font-size:0.8rem;">${timeStr}</div>
        </div>
        ${isUnread ? '<div style="width:10px; height:10px; background:var(--primary-color); border-radius:50%; margin-top:0.5rem; flex-shrink:0;"></div>' : ''}
      </div>
    `;
  }).join('');
}

export function openSeeAll() {
  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) dropdown.classList.remove('show');
  
  if (typeof window.openModal === 'function') {
    window.openModal('all-notifications-modal');
  } else {
    document.getElementById('all-notifications-modal').classList.add('active');
  }
  loadAllNotifications();
}

function injectSeeAllModal() {
  if (document.getElementById('all-notifications-modal')) return;
  const modalHtml = `
    <div id="all-notifications-modal" class="modal-overlay">
      <div class="modal-content glass-card" style="max-width: 650px; padding: 0; display: flex; flex-direction: column; max-height: 85vh;">
        <div style="padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 1.5rem;">All Notifications</h2>
          <span class="close-modal" style="position: static; font-size: 2rem;" onclick="document.getElementById('all-notifications-modal').classList.remove('active')">&times;</span>
        </div>
        <div id="all-notifications-modal-list" style="overflow-y: auto; padding: 0; flex: 1; background: rgba(0,0,0,0.2);">
          <div style="padding: 3rem; text-align: center; color: var(--text-muted);">Loading...</div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Attach to window so HTML onClick events can reach it
window.notificationService = {
  createNotification,
  notifyAdmins,
  markAsRead,
  markAllAsRead,
  markTypeAsRead,
  loadNotifications,
  initNotificationPolling,
  loadAllNotifications,
  openSeeAll
};

// Global click-outside listener to close the dropdown
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('notification-dropdown');
  const bell = document.getElementById('notification-bell');
  if (dropdown && dropdown.classList.contains('show') && bell && !dropdown.contains(e.target) && !bell.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});
