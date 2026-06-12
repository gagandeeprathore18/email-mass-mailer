import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { encryptPassword } from '@/lib/encryption';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket } from 'mysql2/promise';

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
    const smtpId = parseInt(id, 10);
    if (isNaN(smtpId)) {
      return NextResponse.json({ error: 'Invalid SMTP ID' }, { status: 400 });
    }

    const body = await request.json();
    const { label, host, port, username, password, fromEmail, is_active } = body;

    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT label, is_active FROM smtp_accounts WHERE id = ?',
      [smtpId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'SMTP account not found' }, { status: 404 });
    }

    const smtpBefore = existing[0];

    const fieldsToUpdate: string[] = [];
    const values: any[] = [];

    if (label !== undefined) {
      fieldsToUpdate.push('label = ?');
      values.push(label);
    }
    if (host !== undefined) {
      fieldsToUpdate.push('host = ?');
      values.push(host);
    }
    if (port !== undefined) {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum)) {
        return NextResponse.json({ error: 'Invalid port' }, { status: 400 });
      }
      fieldsToUpdate.push('port = ?');
      values.push(portNum);
    }
    if (username !== undefined) {
      fieldsToUpdate.push('username = ?');
      values.push(username);
    }
    if (fromEmail !== undefined) {
      fieldsToUpdate.push('from_email = ?');
      values.push(fromEmail);
    }
    if (is_active !== undefined) {
      fieldsToUpdate.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (password) {
      const encryptedPassword = encryptPassword(password);
      fieldsToUpdate.push('encrypted_password = ?');
      values.push(encryptedPassword);
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(smtpId);

    await db.query(
      `UPDATE smtp_accounts SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
      values
    );

    if (is_active !== undefined && is_active !== smtpBefore.is_active) {
      const stateStr = is_active ? 'Enabled' : 'Disabled';
      await logActivity(adminUser.id, `Admin ${stateStr} SMTP Account: ${smtpBefore.label}`);
    } else {
      await logActivity(adminUser.id, `Admin Updated SMTP Account: ${smtpBefore.label}`);
    }

    return NextResponse.json({ success: true, message: 'SMTP account updated successfully.' });
  } catch (error) {
    console.error('Admin PUT SMTP Error:', error);
    return NextResponse.json({ error: 'Failed to update SMTP account' }, { status: 500 });
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
    const smtpId = parseInt(id, 10);
    if (isNaN(smtpId)) {
      return NextResponse.json({ error: 'Invalid SMTP ID' }, { status: 400 });
    }

    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT label FROM smtp_accounts WHERE id = ?',
      [smtpId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'SMTP account not found' }, { status: 404 });
    }

    const label = existing[0].label;

    await db.query('DELETE FROM smtp_accounts WHERE id = ?', [smtpId]);

    await logActivity(adminUser.id, `Admin Deleted SMTP Account: ${label}`);

    return NextResponse.json({ success: true, message: 'SMTP account deleted successfully.' });
  } catch (error) {
    console.error('Admin DELETE SMTP Error:', error);
    return NextResponse.json({ error: 'Failed to delete SMTP account' }, { status: 500 });
  }
}
