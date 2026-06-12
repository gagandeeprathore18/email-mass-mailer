import { NextResponse } from 'next/server';
import { verifySmtpConnection } from '@/lib/smtp';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { ResultSetHeader } from 'mysql2/promise';
import { encryptPassword } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    const { email, password, smtp_host, smtp_email, smtp_pass, smtp_port } = await request.json();

    if (!email || !password || !smtp_host || !smtp_email || !smtp_pass || !smtp_port) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      );
    }

    const portInt = parseInt(smtp_port, 10);
    if (isNaN(portInt)) {
      return NextResponse.json(
        { error: 'SMTP Port must be a valid number.' },
        { status: 400 }
      );
    }

    // Verify SMTP config using our robust helper with TLS fallback
    try {
      await verifySmtpConnection({
        host: smtp_host,
        port: portInt,
        user: smtp_email,
        pass: smtp_pass,
      });
    } catch (smtpError: unknown) {
      console.error('SMTP Connection Verification Failed:', smtpError);
      const errorMessage = smtpError instanceof Error ? smtpError.message : String(smtpError);
      return NextResponse.json(
        { error: `SMTP verification failed: ${errorMessage}` },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const [result] = await db.query<ResultSetHeader>(
        `INSERT INTO Users (email, password_hash, smtp_host, smtp_email, smtp_pass, smtp_port, role) 
         VALUES (?, ?, ?, ?, ?, ?, 'admin')`,
        [email, passwordHash, smtp_host, smtp_email, smtp_pass, portInt]
      );

      const userId = result.insertId;

      // Automatically create an entry in the central smtp_accounts table
      const encryptedPassword = encryptPassword(smtp_pass);
      await db.query(
        `INSERT INTO smtp_accounts (user_id, label, host, port, username, encrypted_password, from_email, is_active, is_verified, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [userId, `Admin SMTP (${smtp_host})`, smtp_host, portInt, smtp_email, encryptedPassword, smtp_email, userId]
      );

      const token = await signToken({ id: userId, email, role: 'admin', name: null });
      const cookieStore = await cookies();
      cookieStore.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return NextResponse.json({
        success: true,
        user: { id: userId, email, role: 'admin' },
      });
    } catch (dbError: unknown) {
      console.error('Database Error during registration:', dbError);
      const err = dbError as { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        return NextResponse.json(
          { error: 'A user with this email address already exists.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal database error. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Registration Route Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration.' },
      { status: 500 }
    );
  }
}
