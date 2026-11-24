import * as notificationService from '../services/notification.service.js';
import { sendResponse } from '../utils/apiResponse.js';

/**
 * GET /api/notifications
 * Retrieve paginated notifications for current tenant/user
 */
export const getNotifications = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user._id;

    const result = await notificationService.getNotifications(
      tenantId,
      userId,
      req.query
    );

    return sendResponse(
      res,
      200,
      true,
      'Notifications retrieved successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user._id;

    const result = await notificationService.getUnreadCount(tenantId, userId);

    return sendResponse(
      res,
      200,
      true,
      'Unread notification count retrieved successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(
      tenantId,
      userId,
      id
    );

    return sendResponse(
      res,
      200,
      true,
      'Notification marked as read',
      notification
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all unread notifications as read
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user._id;

    const result = await notificationService.markAllAsRead(tenantId, userId);

    return sendResponse(
      res,
      200,
      true,
      'All notifications marked as read',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/:id
 * Retrieve a specific notification by ID
 */
export const getNotificationById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.getNotificationById(
      tenantId,
      userId,
      id
    );

    return sendResponse(
      res,
      200,
      true,
      'Notification retrieved successfully',
      notification
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationById,
};
