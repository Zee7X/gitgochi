# Steering: Retro Aesthetic & Display Guidelines

## Palette: 4-Shade Monochromatic Green Dot-Matrix
The virtual pet's LCD screen area uses these 4 hex colors:
- **`#0f380f`** (Darkest Green): pixel outlines, eye details, hard shadows.
- **`#306230`** (Medium Green): character shading, secondary accent textures.
- **`#8bac0f`** (Light Green): highlights, light ornament patterns, body accents.
- **`#9bbc0f`** (LCD Background): base color of the dot-matrix background.

## Typography
- **Primary Font:** `"Press Start 2P"`, cursive / monospace pixel font.
- Scaled text must use blur-free pixel rendering (`image-rendering: pixelated`).

## Hardware Shell
- The outer casing uses translucent purple plastic (translucent purple / atomic shell), typical of late-90s handheld consoles.
- 3 physical buttons below the screen:
  - **Button A (Left):** Select / Menu Navigation.
  - **Button B (Middle):** Execute / Confirm Action.
  - **Button C (Right):** Cancel / Check Stats.

## Pixel Grid & Scanning Lines
- The screen pixel ratio is 1:1 or an integer multiple (`transform: scale(2)` or `scale(3)`).
- A subtle dot-matrix grid overlay replicates the feel of a physical monochrome screen.
