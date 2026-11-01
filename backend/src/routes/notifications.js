import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notifications.js';

const router = Router();

// GET /api/notifications - List current user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const data = await getUserNotifications(req.user.id, { limit, offset });
    res.json(data);
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const updated = await markNotificationAsRead(req.params.id, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ message: 'Marked as read', notification: updated });
  } catch (err) {
    console.error('Error marking notification as read:', err.message);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const updatedCount = await markAllNotificationsAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read', count: updatedCount });
  } catch (err) {
    console.error('Error marking all notifications as read:', err.message);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

export default router;
