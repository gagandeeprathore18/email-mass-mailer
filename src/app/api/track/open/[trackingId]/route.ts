import db from '@/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await context.params;
    if (!trackingId) {
      return new Response('Tracking ID is required', { status: 400 });
    }

    // Atomically update opened_at if it's currently null to prevent multiple increments/overwrites
    await db.query(
      "UPDATE Clients SET opened_at = UTC_TIMESTAMP() WHERE tracking_id = ? AND opened_at IS NULL",
      [trackingId]
    );
  } catch (error) {
    console.error('Error updating tracking status:', error);
  }

  // 1x1 transparent GIF pixel
  const pixelBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const buffer = Buffer.from(pixelBase64, 'base64');

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
