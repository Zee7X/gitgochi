import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}));
    const reason = data.hasConsoleLog
      ? 'console.log detected'
      : data.hasTodo
      ? 'TODO comment found'
      : 'lint issue';

    return NextResponse.json({
      success: true,
      message: `Local hook triggered poop spawn: ${reason}`,
      filePath: data.filePath,
      spawnPoop: true,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
