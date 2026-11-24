import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

// Protect all notification routes with tenant authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * List notifications with pagination and filters
 */
router.get('/', notificationController.getNotifications);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/mark-all-read', notificationController.markAllAsRead);

/**
 * GET /api/notifications/:id
 * Get single notification details
 */
router.get('/:id', notificationController.getNotificationById);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', notificationController.markAsRead);

export default router;
