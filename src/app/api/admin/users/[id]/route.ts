import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, role, is_active, password } = body;

    // Check if user exists
    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT email, name, is_active FROM Users WHERE id = ?',
      [userId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userBefore = existing[0];

    // Build update dynamic query
    const fieldsToUpdate: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      fieldsToUpdate.push('name = ?');
      values.push(name || null);
    }
    if (email !== undefined) {
      fieldsToUpdate.push('email = ?');
      values.push(email);
    }
    if (role !== undefined) {
      fieldsToUpdate.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      fieldsToUpdate.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      fieldsToUpdate.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(userId);

    await db.query(
      `UPDATE Users SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
      values
    );

    // Logging details
    if (is_active !== undefined && is_active !== userBefore.is_active) {
      const actionStr = is_active ? 'Enabled' : 'Disabled';
      await logActivity(adminUser.id, `Admin ${actionStr} User: ${userBefore.email}`);
    } else if (password) {
      await logActivity(adminUser.id, `Admin Reset Password for User: ${userBefore.email}`);
    } else {
      await logActivity(adminUser.id, `Admin Updated User Details for: ${userBefore.email}`);
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Admin PUT User Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

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
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    // Do not let admin delete themselves
    if (userId === adminUser.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT email FROM Users WHERE id = ?',
      [userId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetEmail = existing[0].email;

    await db.query('DELETE FROM Users WHERE id = ?', [userId]);

    await logActivity(adminUser.id, `Admin Deleted User: ${targetEmail}`);

    return NextResponse.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Admin DELETE User Error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
