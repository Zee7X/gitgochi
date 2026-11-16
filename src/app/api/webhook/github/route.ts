import { NextRequest, NextResponse } from 'next/server';
import {
  INITIAL_PET_STATE,
  applyCommitPush,
  applyCiResult,
  applyPrMerge,
} from '@/lib/state-machine';

// In-memory global state cache for demo & testing
let globalPetState = { ...INITIAL_PET_STATE };

export async function GET() {
  return NextResponse.json({
    petState: globalPetState,
  });
}

export async function POST(req: NextRequest) {
  try {
    const event = req.headers.get('x-github-event') || 'push';
    const body = await req.json().catch(() => ({}));

    switch (event) {
      case 'push': {
        const count = body.commits?.length || 1;
        globalPetState = applyCommitPush(globalPetState, count);
        break;
      }
      case 'check_run':
      case 'workflow_run': {
        const conclusion =
          body.check_run?.conclusion || body.workflow_run?.conclusion || 'success';
        globalPetState = applyCiResult(globalPetState, conclusion === 'success');
        break;
      }
      case 'pull_request': {
        if (body.action === 'closed' && body.pull_request?.merged) {
          globalPetState = applyPrMerge(globalPetState);
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({
      success: true,
      event,
      petState: globalPetState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
