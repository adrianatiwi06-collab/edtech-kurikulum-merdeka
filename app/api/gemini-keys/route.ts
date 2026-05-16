import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyStatus } from '@/lib/gemini';

export async function GET(request: NextRequest) {
  try {
    const status = await getApiKeyStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (err: any) {
    console.error('gemini-keys status error:', err);
    return NextResponse.json({ success: false, error: 'Gagal mengambil status API keys' }, { status: 500 });
  }
}
