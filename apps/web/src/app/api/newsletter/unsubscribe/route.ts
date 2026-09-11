import type { NextRequest } from 'next/server';
import { runTokenAction } from '@/lib/newsletter-token';

export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({ token: '' }));
  return runTokenAction('unsubscribe', String(token ?? ''));
}
