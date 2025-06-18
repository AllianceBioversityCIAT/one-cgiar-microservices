import { Router, Request, Response } from 'express';
import Server from '../classes/server';
import { userList } from '../sockets/socket';

const router = Router();

/**
 * Endpoint to send global alerts to all users of a specific platform
 * POST /socket/alert
 *
 * Functionality:
 * - Receives an object with alert information in the body
 * - Emits the alert to all connected users of the specified platform
 * - Uses Socket.IO to send the alert in real-time
 *
 * Expected parameters in body:
 * - platform: string - Platform identifier (e.g., 'web', 'mobile', etc.)
 * - Any other field will be sent as part of the alert
 *
 * Use cases:
 * - System maintenance notifications
 * - Security alerts
 * - Important notices for all users
 */
router.post('/alert', (req: Request, res: Response) => {
  const { platform } = req.body;

  const server = Server.instance;
  // Emit the alert to all users of the specified platform
  server.io.emit(`alert-${platform}`, req.body);

  res.json({
    ok: true,
    body: req.body
  });
});

/**
 * Endpoint to send targeted notifications to specific users
 * POST /socket/notification
 *
 * Functionality:
 * - Receives a list of user IDs and the notification content
 * - Searches for active sockets of those users on the specified platform
 * - Sends the notification only to connected target users
 *
 * Expected parameters in body:
 * - userIds: string[] - Array with target user IDs
 * - notification: object - Notification content (flexible structure)
 * - platform: string - Platform from which the notification is sent
 *
 * Use cases:
 * - Personalized notifications
 * - Process result messages
 * - Specific alerts for certain users
 */
router.post('/notification', (req: Request, res: Response) => {
  const { userIds, notification, platform } = req.body;

  const server = Server.instance;
  // Get socketIds and users corresponding to the provided userIds
  const { socketIds, users } = userList.getSocketIdsByUserIds(userIds, platform);

  if (socketIds?.length) {
    // Send notification only to target users' sockets
    server.io.in(socketIds).emit('notifications', notification);
    res.json({
      ok: true,
      notification,
      senders: users
    });
  } else {
    // Respond with error if no active users are found
    res.status(404).json({
      ok: false,
      message: 'No active sockets found for the given user IDs'
    });
  }
});

/**
 * Endpoint to get the list of all connected users
 * GET /socket/users
 *
 * Functionality:
 * - Returns information of all currently connected users
 * - Includes data such as socketId, name, userId and platform
 * - No parameters required
 *
 * Use cases:
 * - Monitoring active users
 * - Checking connections before sending notifications
 * - Real-time usage statistics
 */
router.get('/users', (req: Request, res: Response) => {
  res.json({
    ok: true,
    clients: userList.getAllUsers()
  });
});

/**
 * Endpoint to get connected users from a specific platform
 * GET /socket/users/:platform
 *
 * Functionality:
 * - Filters and returns only users from the specified platform
 * - Useful for getting platform-specific statistics
 *
 * Parameters:
 * - platform: string - Platform identifier in the URL
 *
 * Use cases:
 * - Platform-specific monitoring (web, mobile, admin, etc.)
 * - Checking active users before sending platform alerts
 * - Platform-segmented usage analysis
 */
router.get('/users/:platform', (req: Request, res: Response) => {
  const platform = req.params.platform;
  res.json({
    ok: true,
    clients: userList.getListByPlatform(platform)
  });
});

export default router;
