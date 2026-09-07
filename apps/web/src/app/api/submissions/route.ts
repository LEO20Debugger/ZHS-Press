import type { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/api-proxy';

export async function POST(request: NextRequest) {
  return forwardToApi('/submissions', await request.json());
}
