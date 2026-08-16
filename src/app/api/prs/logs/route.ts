import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prId = searchParams.get('prId');
    
    if (!prId) {
      return NextResponse.json({ error: 'Missing prId parameter.' }, { status: 400 });
    }
    
    const result = await db.query(
      'SELECT * FROM audit_logs WHERE pr_id = $1 ORDER BY created_at ASC',
      [prId]
    );
    return NextResponse.json({ success: true, logs: result.rows });
  } catch (error: any) {
    console.error('[API Get PR Logs Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
