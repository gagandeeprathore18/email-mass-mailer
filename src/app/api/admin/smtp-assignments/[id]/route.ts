import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket } from 'mysql2/promise';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) {
      return NextResponse.json({ error: 'Invalid Assignment ID' }, { status: 400 });
    }

    // Get information for logging
    const [existing] = await db.query<RowDataPacket[]>(
      `SELECT usa.user_id, usa.smtp_account_id, u.email as user_email, sa.label as smtp_label
       FROM user_smtp_access usa
       JOIN Users u ON usa.user_id = u.id
       JOIN smtp_accounts sa ON usa.smtp_account_id = sa.id
       WHERE usa.id = ?`,
      [assignmentId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const assignment = existing[0];

    await db.query('DELETE FROM user_smtp_access WHERE id = ?', [assignmentId]);

    await logActivity(
      adminUser.id,
      `Admin Removed SMTP Assignment: ${assignment.smtp_label} for User: ${assignment.user_email}`
    );

    return NextResponse.json({ success: true, message: 'SMTP Assignment removed successfully.' });
  } catch (error) {
    console.error('Admin DELETE SMTP Access Error:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
