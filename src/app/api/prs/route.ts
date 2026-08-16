import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function GET() {
  try {
    const result = await db.query('SELECT * FROM prs ORDER BY created_at DESC');
    return NextResponse.json({ success: true, prs: result.rows });
  } catch (error: any) {
    console.error('[API Get PRs Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
