import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import * as XLSX from 'xlsx';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

interface CampaignRow extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'executed';
  created_at: Date;
  client_count: number;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [campaigns] = await db.query<CampaignRow[]>(
      `SELECT c.id, c.subject, c.body, c.status, c.created_at, COUNT(cl.id) as client_count 
       FROM Campaigns c 
       LEFT JOIN Clients cl ON c.id = cl.campaign_id 
       WHERE c.user_id = ? 
       GROUP BY c.id, c.subject, c.body, c.status, c.created_at 
       ORDER BY c.created_at DESC`,
      [user.id]
    );

    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;
    const file = formData.get('file') as File | null;
    const manualEmails = formData.get('manualEmails') as string | null;

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 });
    }

    if (!file && (!manualEmails || !manualEmails.trim())) {
      return NextResponse.json({ error: 'Either an Excel client list file or manually typed emails are required.' }, { status: 400 });
    }

    let emails: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 1. Parse manual emails if provided
    if (manualEmails && manualEmails.trim()) {
      // Split by commas, newlines, semicolons, or whitespace
      const rawCandidates = manualEmails.split(/[\n,;\s]+/);
      for (const candidate of rawCandidates) {
        const trimmed = candidate.trim();
        if (trimmed && emailRegex.test(trimmed)) {
          emails.push(trimmed);
        }
      }
    }

    // 2. Read & Parse Excel file if provided
    if (file && file.size > 0) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        // Extract emails intelligently
        for (const row of rows) {
          let foundEmail = '';
          for (const key of Object.keys(row)) {
            const val = String(row[key]).trim();
            if (key.toLowerCase().includes('email') || emailRegex.test(val)) {
              if (emailRegex.test(val)) {
                foundEmail = val;
                break;
              }
            }
          }
          if (foundEmail) {
            emails.push(foundEmail);
          }
        }
      } catch (parseError) {
        console.error('Excel Parsing Error:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.' },
          { status: 400 }
        );
      }
    }

    // Filter duplicate emails in this batch
    emails = Array.from(new Set(emails));

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'No valid email addresses found in the provided Excel sheet or manual input.' },
        { status: 400 }
      );
    }

    // 2. Insert into database using Transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Insert Campaign
      const [campResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO Campaigns (user_id, subject, body, status) VALUES (?, ?, ?, ?)',
        [user.id, subject, body, 'draft']
      );
      const campaignId = campResult.insertId;

      // Bulk Insert Clients
      const clientValues = emails.map((email) => [campaignId, email, 'pending']);
      await connection.query(
        'INSERT INTO Clients (campaign_id, email, status) VALUES ?',
        [clientValues]
      );

      await connection.commit();
      return NextResponse.json({
        success: true,
        campaignId,
        clientCount: emails.length,
      });
    } catch (dbError) {
      await connection.rollback();
      console.error('Database transaction error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create campaign in database.' },
        { status: 500 }
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Campaigns API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
