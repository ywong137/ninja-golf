# Clear musou portraits

Nearby tree branches and scenery could cross the hero during the musou camera move.
The ordinary camera collision check does not run during this close-up.
A reachable tree-side comparison reproduces the obstruction with the real world and camera updates.

The portrait now clips foreground scenery during its render. The hero and weapon remain visible.
The course behind the hero remains visible. Scenery shadows remain unchanged.
Each render restores the original material clipping planes and renderer settings, including when rendering throws.
Ending or interrupting the cinematic clears the portrait state.

The portrait uses its dedicated lighting without the screen-space contact pass.
That pass uses an override shader which cannot reproduce each scenery material's clipping plane.
Ordinary gameplay retains its existing contact shading.

## First-use performance

The first portrait also compiled new lighting and clipping shaders during combat.
The game now submits those variants during course setup and after the first enemy wave spawns.
Preparation restores lighting and the render target before another frame can draw.
It does not hold temporary render settings while waiting for asynchronous compilation.

On this M1 Max, the first prepared portrait render measured 24.1 ms, compared with 385.2 ms without preparation.
Subsequent samples were approximately 1.5–2.4 ms in this scene.
These are local render timings with GPU completion, not whole-game FPS or a cross-device guarantee.
The earlier untreated portrait also incurred a 399.3 ms first render.

## Validation

- Nine browser cases cover all six heroes and all four course themes.
- Twenty-seven image comparisons cover High, Balanced, and Low modes.
- A solid witness object blocks the eyes without the fix. Corrected portraits match the unobstructed face pixels within one channel level.
- Each case verifies a determined expression and recovery into the real musou attack.
- Interrupted cinematics clear the portrait state.
- Unit checks verify camera direction and state restoration after a render error.
- Nineteen affected asset, preview, wardrobe, and clipping checks pass.
- The production build passes with the existing bundle-size warning.

Evidence resides in `artifacts/reviews/musou-cutaway` in the primary checkout.
The rejected Hustler four-cut candidate remains unpublished. This change does not alter attack animation assets.
