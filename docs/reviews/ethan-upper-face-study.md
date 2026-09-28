# Ethan: upper-face and camera study

The deployed v15 head is the baseline for this study.
Its SHA256 is `1cc80a0b1040a409ad90a88837ba49bfbc8b614e084b3969c96958f77234ab72`.

## Preserve the measured head

A full native rebuild previously restored the earlier Blender sculpt.
The rebuilt base matches the v14 head positions and normals byte-for-byte.
The export now reapplies the reviewed geometry revision before installing the rebuilt character.

The local Blender rebuild plus revision reproduces the published head geometry exactly.
It passes the five photographic-feature, rig, and expression checks.
Three additional regression checks cover the published geometry, newer animation payloads, and invalid or duplicate application.

## Distinguish eye opening from hooded skin

A fresh Claude Opus 5.5 High review identified missing supra-palpebral hooding as a possible likeness difference.
Independent aperture measurements did not establish an excessively large physical opening.
The glasses obscure the tilted photo's upper margins. The seated photograph has a different expression.

Two initial candidates rotated the upper margin over the preserved eyeball.
Opus rejected both as a likeness solution: the smaller change was ineffective, and the larger change looked tired.
Neither candidate entered the game.

The next candidate moves skin between the outer crease and brow, while preserving the lid margin.
Its first coarse version produced a straight ridge.
Only two vertices per eye received more than half the displacement.
Existing fold edges span approximately 11–16 mm, much larger than the 2.5 mm hood displacement.
The correction therefore needs local surface refinement before visual acceptance.

The candidate author transports normals with the deformation's inverse-transpose Jacobian.
This avoids confusing a coarse normal approximation with the actual surface change.
Passing expression and eye-clearance checks does not establish an attractive or accurate likeness.

The first local refinement introduced tiny reversed triangles during facial expressions.
Those triangles lay below the moving fold, where extra vertices served no sculpting purpose.
The second refinement preserves all lower-crease source triangles and their shared edges.
It uses a conforming transition band beside those fixed edges.

The corrected base has 2,547 head vertices and 4,750 triangles.
Its original vertex attributes remain exact, and the new vertices preserve the original bind surface.
Independent checks found no new cracks, T-junctions, or nonmanifold edges.
All four angry-gaze limits pass the existing orientation, clearance, aperture, and stretch thresholds.
Twenty native poses and 36 facial poses also passed the interpolation audit.
The maximum added interpolation error was 0.164 mm.

The current rounded-hood candidate lowers the outer skin by up to 2 mm and advances it by up to 0.8 mm.
It passes the nasal, oral, eyeball, and angry-gaze checks.
Claude Opus 5.5 High reviewed the neutral and production-musou captures.
The verified model was `claude-opus-5-5`; the local result is `/tmp/ninja-ethan-lid-review/rounded-hood-opus-result.json`.
It found no useful likeness improvement at portrait scale and recommended retaining the baseline.
At close range, the only clear change was a faint outer edge, rather than rounded skin.
The candidate has not entered the game.
The old topology-hash test does not apply to the refined mesh.
The independent append-only, conformity, and animation checks replace that test for this experiment.

## Ear geometry and camera ambiguity

The first narrow camera bracket suggested an undersized near ear.
It only varied orientation by two degrees around a camera derived from earlier, flawed facial correspondences.
The far ear already matched much more closely, which weakened the case for symmetric enlargement.

A broader exploratory camera-only fit includes both visible ear rims, the uncertain jaw outline, and checked central facial features.
It changes no model geometry.

| View | Near-ear RMS before | Near-ear RMS after | Far-ear RMS after | Jaw RMS after |
|---|---:|---:|---:|---:|
| Front | 14.11 px | 7.37 px | 4.47 px | 11.11 px |
| Tilt | 25.43 px | 6.68 px | Not visible | 2.51 px |

The tilted correction uses approximately four degrees of pitch, 3.6 degrees of roll, and 4.5 percent greater magnification.
Central nose and neutral mouth residuals remain within their manual uncertainty.
Some individual ear points still exceed their uncertainty.
The exploratory fit used 15 px and 9 px jaw weights, rather than the original per-axis measurement uncertainties.
Under the original front uncertainties, one contour point reaches 2.15 times its coordinate uncertainty.
The largest front jaw error is 21.64 px.
The tilted jaw remains within 1.41 times its coordinate uncertainty.

This result invalidates a definite ear-flare conclusion from the narrower bracket.
It does not prove a complete camera calibration: the upper face still needs independent comparison.
The changed camera exposes a remaining vertical disagreement around the eyes.
Lens refraction, pose, feature placement, and anatomy can all contribute.
Do not enlarge the ears or move the eyes from these residuals alone.

A follow-up restores the exact recorded jaw uncertainties: front [8,10] px and tilt [5,5] px.
It also compares the tilted camera with and without four annotated physical eye-corner candidates.
Those points use their recorded 4–5 px uncertainties; the glasses still limit confidence.
The original eyeball landmarks do not participate.

| Tilted fit | Near-ear RMS | Jaw RMS | Eye-corner distances |
|---|---:|---:|---:|
| Without eye constraints | 7.23 px | 2.41 px | 16.59–31.47 px |
| With eye constraints | 8.71 px | 1.96 px | 6.67–8.58 px |

The eye-aware solution changes focal length substantially and leaves a 12.06 px vertical nose residual.
Neither fit identifies a unique camera or proves an anatomical displacement.
Further comparisons must retain the eye constraints.

## Remaining visible expression fault

Both the baseline and candidate have a flat inner upper-lid edge in the musou expression.
The direct before/after review confirmed this fault predates the candidate.
A larger outer-hood displacement would not correct it.
It needs a separate expression and skinning correction, with the same physical checks and visual review.

The private photographs and detailed review captures remain local.
The camera experiment is at `/tmp/ninja-ethan-photo-anchors/both-ear-camera-refit.json`.
Its exact rendering cameras are at `/tmp/ninja-ethan-photo-anchors/both-ear-cameras.json`.
