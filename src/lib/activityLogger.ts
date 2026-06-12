import db from './db';

/**
 * Logs a major system action performed by a user/admin.
 * @param userId - The ID of the user performing the action
 * @param action - Descriptive string of the action (e.g. "Admin Created User")
 */
export async function logActivity(userId: number, action: string): Promise<void> {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, created_at) VALUES (?, ?, ?)',
      [userId, action, new Date()]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
