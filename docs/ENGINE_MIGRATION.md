# FrameForge AI — Editing Engine Migration

## Decision

Use **Cutaway** (https://github.com/S07K/cutaway) as the primary upstream codebase to evaluate and migrate into FrameForge AI.

Why this base:
- MIT-licensed upstream (preserve its LICENSE and notices).
- React 19 / TypeScript / PixiJS / WebGL architecture, suitable for the existing browser-first product direction.
- Existing nonlinear editing loop: multi-track timeline, trim/split/drag, snapping, ripple delete, undo/redo.
- Existing renderer/export architecture designed so preview and export use the same resolved scene.
- Existing feature foundations: keyframes, masks, captions, color grading, effects registry, transitions, WebCodecs MP4/WebM export.
- On-device Whisper transcription and local-first media handling provide a better AI foundation than the current prototype.

Upstream references:
- Repository: https://github.com/S07K/cutaway
- License: https://github.com/S07K/cutaway/blob/main/LICENSE
- Architecture: https://github.com/S07K/cutaway/blob/main/docs/ARCHITECTURE.md
- Contributing/build instructions: https://github.com/S07K/cutaway/blob/main/CONTRIBUTING.md

## Important constraints

- This is an active-development project, not a certified Premiere Pro replacement. Verify each claimed feature in the actual browser build before adopting it.
- Keep upstream attribution and MIT license notices.
- Audit every dependency and third-party asset/license before shipping.
- Do not copy Adobe, CapCut, DaVinci, or other proprietary source code or trademarks.
- Do not replace the current production app until the new engine passes the acceptance tests below.
- The existing FrameForge prototype is retained as a reference for its AI workflow; it is not the editing engine.

## Target architecture

1. **Editing core:** normalized project document, multi-track timeline, clip model, drag/drop, split, trim, ripple/roll/slip/slide, snapping, linking, markers, keyboard shortcut registry, undo/redo.
2. **Compositor:** real-time WebGL/Pixi preview; preview and export share the same scene resolver.
3. **Effects:** effect registry with parameter schemas, per-clip and adjustment-layer effects, masks, blend/opacity, keyframe animation and easing.
4. **Color:** exposure, contrast, highlights/shadows, temperature/tint, saturation/vibrance, curves/LUT workflow where supported.
5. **Transitions:** real clip-to-clip transitions with duration and preview/export parity.
6. **Audio:** multiple tracks, waveform, gain, fades, EQ/dynamics, audio transitions, sync.
7. **Text/captions:** title editor, typography, templates, caption tracks and subtitle export.
8. **AI assistant:** transcript-aware rough cut, silence/filler detection, caption generation, scene analysis, edit suggestions and optional automatic application. AI edits must remain editable and undoable.
9. **Export:** resolution, aspect ratio, FPS, codec/container, bitrate/quality, audio options, progress and cancellation.

## Migration plan

### Phase 0 — upstream audit (required before integration)
- Pin a known upstream commit.
- Run install, typecheck, tests, lint and production build.
- Launch in Chromium and test with real footage.
- Confirm drag, trim, split, join/ripple, playback sync, transitions, color, keyframes and MP4/WebM export.
- Record unsupported codecs, browser limitations and open bugs.

### Phase 1 — engine baseline
- Import the verified editor source into this branch while preserving upstream notices.
- Brand the product as FrameForge AI without copying upstream branding.
- Keep the editor local-first; keep AI provider integrations optional.
- Remove the current fake/placeholder editing controls rather than presenting inactive features.

### Phase 2 — FrameForge integration
- Add AI assistant as a separate, undoable command layer over the project document.
- AI returns a proposed edit decision list; user can preview, apply, reject or undo it.
- Add Arabic-first UX, subtitle styles and creator presets.

### Phase 3 — release gates
- Every toolbar action has a working implementation and a test.
- Every keyboard shortcut is documented and tested; shortcuts are configurable.
- Preview and export render the same timeline/effects/transitions.
- No release based only on a successful compile; real browser editing and export tests are mandatory.

## Acceptance tests

- Import multiple video/audio/image files.
- Create at least 3 video tracks and 3 audio tracks.
- Drag clips across tracks and reorder them.
- Split at playhead; trim both edges; ripple delete; join adjacent clips.
- Link/unlink audio and video; mute/solo and adjust track volume.
- Undo/redo every edit and recover project after reload.
- Apply at least 5 transitions and 10 effects; animate parameters with keyframes.
- Adjust color controls and verify output in export.
- Generate and edit captions.
- Export H.264 MP4 and WebM at selected resolution/FPS with synchronized audio.
- Verify the keyboard map in a real browser session.

## Current status

- Migration branch created from `desktop-foundation`.
- Upstream selected for technical evaluation.
- No upstream source has been copied into this repository yet.
- No production deployment has been replaced.
