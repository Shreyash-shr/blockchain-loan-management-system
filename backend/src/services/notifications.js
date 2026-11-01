import { query } from '../config/database.js';

/**
 * Create a new notification for a user
 */
export async function createNotification(userId, { title, message, type = 'info', link = null }) {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, title, message, type, link]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Notify all users with a specific role (e.g. all admins or all lenders)
 */
export async function notifyRole(role, { title, message, type = 'info', link = null }) {
  try {
    const users = await query(`SELECT id FROM users WHERE role = $1 AND is_active = TRUE`, [role]);
    const promises = users.rows.map((u) =>
      createNotification(u.id, { title, message, type, link })
    );
    return await Promise.all(promises);
  } catch (err) {
    console.error(`Failed to notify role ${role}:`, err.message);
    return [];
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(userId, { limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT * FROM notifications 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) AS unread_count 
     FROM notifications 
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return {
    notifications: result.rows,
    unread_count: parseInt(countResult.rows[0]?.unread_count || 0, 10),
  };
}

/**
 * Mark a specific notification as read
 */
export async function markNotificationAsRead(notificationId, userId) {
  const result = await query(
    `UPDATE notifications 
     SET is_read = TRUE 
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId) {
  const result = await query(
    `UPDATE notifications 
     SET is_read = TRUE 
     WHERE user_id = $1 AND is_read = FALSE
     RETURNING id`,
    [userId]
  );
  return result.rows.length;
}
