import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { RowDataPacket } from 'mysql2/promise';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/jpg'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_ATTACHMENTS = 5;

interface AttachmentSizeRow extends RowDataPacket {
  total_size: string | number | null;
  count: number;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const campaignIdVal = formData.get('campaignId') as string | null;
    const file = formData.get('file') as File | null;

    if (!campaignIdVal || !file) {
      return NextResponse.json({ error: 'campaignId and file are required.' }, { status: 400 });
    }

    const campaignId = parseInt(campaignIdVal, 10);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 });
    }

    // 1. Verify Campaign ownership
    interface CampaignOwnerRow extends RowDataPacket {
      user_id: number;
    }
    const [campaignRows] = await db.query<CampaignOwnerRow[]>(
      'SELECT user_id FROM Campaigns WHERE id = ?',
      [campaignId]
    );

    if (campaignRows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaignRows[0].user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized campaign access' }, { status: 403 });
    }

    // 2. Validate MIME Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: `File type not supported. Allowed formats: PDF, DOC, DOCX, JPG, JPEG, PNG.` 
      }, { status: 400 });
    }

    // 3. Validate Single File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File size exceeds the 10 MB limit.` 
      }, { status: 400 });
    }

    // 4. Validate Attachment Limits (Count & Total Size)
    const [sizeRows] = await db.query<AttachmentSizeRow[]>(
      'SELECT COUNT(id) as count, COALESCE(SUM(file_size), 0) as total_size FROM campaign_attachments WHERE campaign_id = ?',
      [campaignId]
    );

    const currentCount = sizeRows[0]?.count || 0;
    const currentTotalSize = Number(sizeRows[0]?.total_size || 0);

    if (currentCount >= MAX_ATTACHMENTS) {
      return NextResponse.json({ 
        error: `Maximum limit of ${MAX_ATTACHMENTS} attachments per campaign reached.` 
      }, { status: 400 });
    }

    if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
      return NextResponse.json({ 
        error: `Adding this file would exceed the 25 MB total attachments limit for this campaign.` 
      }, { status: 400 });
    }

    // 5. Save physical file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const relativeUploadDir = path.join('uploads', `campaign_${campaignId}`);
    const absoluteUploadDir = path.join(process.cwd(), relativeUploadDir);

    if (!fs.existsSync(absoluteUploadDir)) {
      fs.mkdirSync(absoluteUploadDir, { recursive: true });
    }

    const uniqueFilename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const absoluteFilePath = path.join(absoluteUploadDir, uniqueFilename);
    const relativeFilePath = path.join(relativeUploadDir, uniqueFilename);

    fs.writeFileSync(absoluteFilePath, buffer);

    // 6. Save metadata to database
    const [insertResult] = await db.query(
      'INSERT INTO campaign_attachments (campaign_id, file_name, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?)',
      [campaignId, file.name, relativeFilePath, file.size, file.type]
    );

    const insertId = (insertResult as any).insertId;

    return NextResponse.json({
      success: true,
      attachment: {
        id: insertId,
        campaign_id: campaignId,
        file_name: file.name,
        file_path: relativeFilePath,
        file_size: file.size,
        mime_type: file.type
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during file upload.' }, { status: 500 });
  }
}
