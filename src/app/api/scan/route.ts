import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { executeAuditPipeline } from '@/lib/agents/orchestrator';

/**
 * Verifies GitHub webhook HMAC SHA-256 signature.
 * Returns true if valid (or if GITHUB_WEBHOOK_SECRET is not configured = dev mode).
 */
async function verifyWebhookSignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || secret === 'your-github-webhook-secret') {
    // No secret configured  allow all requests (local dev mode)
    return true;
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!signature) {
    console.warn('[WebhookVerify] Missing X-Hub-Signature-256 header. Rejecting request.');
    return false;
  }

  const hmac = createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // timingSafeEqual prevents timing attacks
  try {
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expBuffer);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 });
  }

  // Verify GitHub webhook signature
  const isValidSignature = await verifyWebhookSignature(request, rawBody);
  if (!isValidSignature) {
    console.error('[API Scan] Invalid webhook signature  request rejected.');
    return NextResponse.json(
      { error: 'Unauthorized: invalid webhook signature.' },
      { status: 401 }
    );
  }

  try {
    const body = JSON.parse(rawBody);
    let { prNumber, repoName, author, title, diff, prUrl } = body;

    // Handle Real GitHub PR Integration
    if (prUrl) {
      try {
        const urlObj = new URL(prUrl);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length >= 4 && parts[2] === 'pull') {
          repoName = parts[0] + '/' + parts[1];
          prNumber = parseInt(parts[3], 10);
          
          // Fetch diff from GitHub
          const diffRes = await fetch(prUrl + '.diff');
          if (!diffRes.ok) throw new Error('Failed to fetch PR diff from GitHub.');
          diff = await diffRes.text();
          
          // Optional: Fetch PR details (title/author) via GitHub API if we had a PAT, but we'll fallback for MVP
          title = title || `Audit for ${prUrl}`;
          author = author || 'github-user';
        } else {
          throw new Error('Invalid GitHub PR URL format.');
        }
      } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error processing PR URL' }, { status: 400 });
      }
    }

    if (!prNumber || !repoName || !diff) {
      return NextResponse.json(
        { error: 'Missing required parameters: prUrl OR (prNumber, repoName, diff).' },
        { status: 400 }
      );
    }

    const result = await executeAuditPipeline({
      prNumber: Number(prNumber),
      repoName,
      author: author || 'anonymous',
      title: title || 'Modified files',
      diff
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[API Scan Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
