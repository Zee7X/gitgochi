import { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const fullName = `${owner}/${repo}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="90" viewBox="0 0 340 90">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&amp;display=swap');
      .font-retro { font-family: 'Press Start 2P', monospace, monospace; }
      @keyframes floatAnim {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .pet-float { animation: floatAnim 2s ease-in-out infinite; }
    </style>
  </defs>

  <!-- Outer LCD Frame -->
  <rect x="2" y="2" width="336" height="86" rx="8" fill="#9bbc0f" stroke="#0f380f" stroke-width="3"/>
  <rect x="8" y="8" width="324" height="74" fill="#8bac0f" opacity="0.25"/>

  <!-- Pixel Sprite (Baby Ghost) -->
  <g class="pet-float" transform="translate(18, 14)">
    <path d="M12 18 C12 10 32 10 32 18 L32 36 L28 33 L24 37 L20 33 L16 37 L12 34 Z" fill="#9bbc0f" stroke="#0f380f" stroke-width="2"/>
    <path d="M4 18 L40 18 L34 15 L26 4 L22 4 L18 15 Z" fill="#0f380f"/>
    <circle cx="18" cy="22" r="1.5" fill="#0f380f"/>
    <circle cx="26" cy="22" r="1.5" fill="#0f380f"/>
    <path d="M20 26 Q22 28 24 26" stroke="#0f380f" stroke-width="1.5" fill="none"/>
  </g>

  <!-- Info Text -->
  <text x="75" y="30" class="font-retro" font-size="9" fill="#0f380f" font-weight="bold">${fullName.toUpperCase()}</text>
  <text x="75" y="48" class="font-retro" font-size="8" fill="#306230">STAGE: CODE_EVOLVED</text>
  <text x="75" y="66" class="font-retro" font-size="8" fill="#0f380f">HP: 100% [■■■■■■■■]</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
