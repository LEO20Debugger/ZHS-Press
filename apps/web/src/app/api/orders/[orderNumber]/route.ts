import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Read-only order lookup for the confirmation page's polling. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/orders/${encodeURIComponent(orderNumber)}`,
      { cache: 'no-store' },
    );

    if (response.status === 404) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!response.ok) {
      return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
  }
}
