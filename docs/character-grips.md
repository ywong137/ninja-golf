# Character grip fitting

The original closed hand came from a jogging animation. Its finger rotations did
not account for a weapon handle. The old anchor averaged two middle-finger joints.
Both facts allowed the handle to intersect several fingers while the tests passed.

## Independent review

Claude Opus 5.5 reviewed the source and rendered characters at `xhigh` effort.
Further image reviews used the same explicit model at `high` effort. The reviewer
rejected the first fitted candidate: it reduced intersections by moving the handle
away from the palm and leaving the fingers too straight.

The revised Ronin candidate passed the next visual review. The reviewer could see
four fingers around the handle and an opposed thumb. The review covered palm,
back, finger-side, blade-end, and pommel-end views. It did not certify the full
animation set or hidden surfaces. The reviewer noted that ring and pinky flexion
could improve further. The native meshes also retain visibly coarse knuckles.

## Offline fit

`tools/solve-grip.mjs` deforms the exported native hand skin in Node. It fits finger
rotations and a handle frame in hand space. It checks finger and palm penetration,
surface contact, finger wrap, and thumb position. The left hand receives its own
fit. A measured curl direction establishes the palm-normal sign.

The weapon axis runs diagonally across the palm. Finger hinges retain their
anatomical axes. The thumb has separate metacarpal rotation and two hinge controls.
Sword profiles use a closed power grip. Golf profiles use a smaller diameter and
a thumb position farther along the shaft.

```sh
node tools/solve-grip.mjs --help
node tools/build-grip-profiles.mjs
```

The build writes 24 profiles into `src/grip-data.json`: six heroes, two hands,
and two handle types. Detailed measurements remain in `artifacts/grip-fit/`.
Runtime code reads only the fitted centers, axes, radii, and finger rotations.

## Runtime attachment

`HandGrip` applies the fitted finger rotations after the body animation. It
rotates the hand with the weapon direction, so the blade cannot turn independently
inside a stationary fist. The primary grip sits below the guard. The second hand
uses a two-bone arm solver to reach its handle station. Its engagement blends
during transitions. Dual weapons use independent hand attachments.

Golf changes only shaft length and head position. It never scales the grip or the
whole club. The new layer restores its bone changes before the next mixer update.
The runtime performs no mesh fitting or surface collision search.

## Verification and limits

`tests/browser-grips.mjs` checks 974 runtime hand samples. These include selection,
ready, light and heavy cuts, musou, guard, golf, running, and attack transitions.
Ronin’s heavy attack also receives 120 Hz sampling through both transitions.
The current maximum sampled skin penetration is 1.96 mm. The fitted handle stations
remain coincident with their hand anchors. Fitting tests also inspect the actual guard and end-ring triangles; the current
samples have no fitting penetration. This is a vertex-sampling check, not
an exact triangle-to-cylinder collision proof.

`tools/render-grip-review.mjs` creates full-roster and hand review sheets. Close
hand views clip distant weapon geometry for inspection. Some camera views also
clip sleeves or occlude the hand with the torso; those views cannot certify the
hidden surfaces. The full-roster render uses the complete characters.

The earlier joint-center checks could pass with fingers inside the handle.
Keep attachment checks as construction checks. Use skin measurements and visual
review together to assess the actual grasp. These changes do not resolve all
remaining combat choreography, wrist skinning, or character mesh limitations.

## Review authorization

On 2026-09-27 the user authorized all files shared with this task or produced in
this project for Opus work. This includes source, screenshots, measurements and
Ethan’s supplied likeness photos. Use the signed-in subscription with explicit
`claude-opus-5-5` and `--effort high` or `xhigh`. Verify the returned canonical
model name. Keep reviews read-only unless a concrete editing task requires more.

## Selection wrist correction

A correct finger fit does not prove a natural wrist or arm pose. The September27
follow-up review found that independent shaft targets could hyperextend the
wrist. Selection now derives the weapon direction from the posed forearm and
neutral hand. The upper arm and forearm establish the carry pose first. The weapon follows the fitted hand frame. Selection tests preserve the imported wrist rotation within 0.000002 degrees. The middle metacarpal remains within 4 degrees of the forearm on the men and 11 degrees on the women. The sword axis stays 75 degrees from the forearm. Whole-body combat and golf need separate visual review.

The selection forearm correction ranges from about 2 to 19 degrees across the roster. This stays below the reviewer's 45-degree inspection threshold. Shinobi carries his two short blades at different pitches.
