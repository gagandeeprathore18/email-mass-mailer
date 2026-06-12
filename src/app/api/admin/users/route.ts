import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function GET() {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id, email, name, role, is_active, created_at FROM Users WHERE role = 'user' ORDER BY created_at DESC"
    );

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Admin GET Users Error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required.' }, { status: 400 });
    }

    // Check if email already exists
    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT id FROM Users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email address already in use.' }, { status: 400 });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default SaaS fields in schema.sql: smtp_host, smtp_email, smtp_pass, smtp_port must not be null since they are NOT NULL in the table definition!
    // Ah, let's verify if they have default values or if they are NOT NULL.
    // In schema.sql: smtp_host VARCHAR(255) NOT NULL, etc.
    // So we should supply empty strings for these columns during creation so the query doesn't fail!
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO Users (name, email, password_hash, role, is_active, smtp_host, smtp_email, smtp_pass, smtp_port) 
       VALUES (?, ?, ?, ?, 1, '', '', '', 0)`,
      [name || null, email, passwordHash, role]
    );

    await logActivity(adminUser.id, `Admin Created User: ${email} (${name || 'No Name'}) as ${role}`);

    return NextResponse.json({
      success: true,
      userId: result.insertId,
      message: 'User created successfully.'
    });
  } catch (error) {
    console.error('Admin POST User Error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
