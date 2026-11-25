# Desktop Editor Blueprint

Windows-first local desktop NLE. Preserve web MVP on main.

## UX
Beginner-friendly dark workspace with Media Bin, Preview, multitrack Timeline, Inspector, Audio meters and Export. Resizable panels, Simple/Editing/Audio/Color workspaces, tooltips, shortcuts, undo/redo, autosave and crash recovery. Non-destructive edits. Arabic UI and RTL are first-class requirements.

## Engine
Evaluate Shotcut/MLT as the editing engine and build a product-owned UX/AI layer. Shotcut is Qt 6 + MLT and GPLv3. Use its official Windows SDK route. Review GPLv3 obligations before distributing a derivative build.

## Gate 0 — Windows build proof
Pin upstream release/commit. Set up official SDK. Build unmodified source. Verify MP4 import, preview/seek/audio sync, 2 video + 2 audio tracks, split/trim/ripple, filters, undo/redo, save/reopen/relink and MP4 export. Record toolchain, logs and reproducible steps. Stop if this gate fails.

## Gate 1 — Product UX
Branded layout, onboarding, project settings, autosave/recovery, relinking, export presets and keyboard map. Test a complete beginner workflow.

## Gate 2 — AI timeline assistant
Timestamped suggestions for silence, repetitions, filler words, transcript cuts, scene changes, audio cleanup and captions. Preview/approve before applying. Accepted edits become ordinary timeline edits, undoable and persistent. Local Arabic Whisper first; benchmark on target hardware.

## Gate 3 — Professional capabilities
Proxies; multitrack and nested sequences; keyframes; masks/compositing; transitions; speed ramps; stabilization; color scopes/LUTs; audio mixing/EQ/compression/noise reduction/ducking; captions; B-roll library; title/motion templates; export presets and batch queue.

## Gate 4 — Release
Reproducible installer/portable build, runtime/model setup, clean-machine testing, license notices and GPLv3 compliance materials.

Definition of done: every feature is tested on real media, errors are handled, undo/redo works where applicable, and save/reopen is verified. Never claim Premiere/CapCut parity until each capability is implemented and tested. No silent destructive AI edits.