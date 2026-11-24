import mongoose from 'mongoose';
import Notification from './notification.model.js';

/**
 * Create a new notification with built-in deduplication / idempotency
 */
export const createNotification = async ({
  tenantId,
  userId = null,
  title,
  message,
  notificationType,
  referenceType = null,
  referenceId = null,
  session = null,
}) => {
  try {
    if (!tenantId) {
      return null;
    }

    const refIdStr = referenceId ? String(referenceId) : null;

    // Idempotency check: prevent duplicate notifications for the exact same event/document
    if (referenceType && refIdStr) {
      const existingQuery = {
        tenantId,
        notificationType,
        referenceType,
        referenceId: refIdStr,
      };

      const existing = session
        ? await Notification.findOne(existingQuery).session(session)
        : await Notification.findOne(existingQuery);

      if (existing) {
        return existing;
      }
    }

    const notification = new Notification({
      tenantId,
      userId: userId || null,
      title,
      message,
      notificationType,
      referenceType: referenceType || null,
      referenceId: refIdStr,
      isRead: false,
      readAt: null,
    });

    if (session) {
      await notification.save({ session });
    } else {
      await notification.save();
    }

    return notification;
  } catch (err) {
    // Non-blocking error handling for background notifications
    console.error('Notification creation failed:', err.message);
    return null;
  }
};

/**
 * Retrieve paginated notifications for a tenant and optional user
 */
export const getNotifications = async (tenantId, userId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    isRead,
    notificationType,
    startDate,
    endDate,
  } = options;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  // Filter: tenant matches, and notification is either tenant-wide (userId: null) or targeted to this user
  const filter = {
    tenantId,
    $or: [{ userId: null }, { userId }],
  };

  if (isRead !== undefined && isRead !== '') {
    filter.isRead = isRead === 'true' || isRead === true;
  }

  if (notificationType && notificationType.trim()) {
    filter.notificationType = notificationType.trim();
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Get count of unread notifications for tenant/user
 */
export const getUnreadCount = async (tenantId, userId) => {
  const count = await Notification.countDocuments({
    tenantId,
    $or: [{ userId: null }, { userId }],
    isRead: false,
  });

  return { unreadCount: count };
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (tenantId, userId, notificationId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    const error = new Error('Invalid notification ID format');
    error.statusCode = 400;
    throw error;
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    tenantId,
    $or: [{ userId: null }, { userId }],
  });

  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

/**
 * Mark all unread notifications as read for the tenant/user
 */
export const markAllAsRead = async (tenantId, userId) => {
  const result = await Notification.updateMany(
    {
      tenantId,
      $or: [{ userId: null }, { userId }],
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );

  return {
    markedCount: result.modifiedCount || 0,
    message: 'All notifications marked as read',
  };
};

/**
 * Get a single notification by ID
 */
export const getNotificationById = async (tenantId, userId, notificationId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    const error = new Error('Invalid notification ID format');
    error.statusCode = 400;
    throw error;
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    tenantId,
    $or: [{ userId: null }, { userId }],
  }).lean();

  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  return notification;
};

export default {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationById,
};
