import { NextRequest, NextResponse } from 'next/server';
import { mcpClient } from '@/lib/mcp-client';

export async function POST(req: NextRequest) {
  try {
    const { repo = 'octocat/gitgotchi' } = await req.json().catch(() => ({}));
    const result = await mcpClient.triggerAutoHeal(repo);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
