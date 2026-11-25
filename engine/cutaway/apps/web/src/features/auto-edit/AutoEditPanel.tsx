"use client";

import { useCallback, useMemo, useState } from "react";
import { AudioWaveform, Check, Loader2, ScanSearch, X } from "lucide-react";
import { Button } from "@cutaway/ui";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import { useMediaImportContext } from "@/features/media/MediaImportProvider";

interface Pause {
  startSeconds: number;
  endSeconds: number;
  peak: number;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${rest.padStart(4, "0")}`;
}

/** Find sustained low-energy regions in decoded audio; this is deterministic DSP, not speech AI. */
function findPauses(buffer: AudioBuffer, threshold: number, minDuration: number): Pause[] {
  const sampleRate = buffer.sampleRate;
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.2));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const pauses: Pause[] = [];
  let silenceStart = -1;
  let peak = 0;

  for (let start = 0; start < buffer.length; start += windowSize) {
    const end = Math.min(buffer.length, start + windowSize);
    let energy = 0;
    let count = 0;
    for (const channel of channels) {
      for (let i = start; i < end; i += 1) {
        energy += channel[i]! * channel[i]!;
        count += 1;
      }
    }
    const rms = Math.sqrt(energy / Math.max(1, count));
    if (rms < threshold) {
      if (silenceStart < 0) silenceStart = start;
      peak = Math.max(peak, rms);
    } else if (silenceStart >= 0) {
      const duration = (start - silenceStart) / sampleRate;
      if (duration >= minDuration) {
        pauses.push({ startSeconds: silenceStart / sampleRate, endSeconds: start / sampleRate, peak });
      }
      silenceStart = -1;
      peak = 0;
    }
  }

  if (silenceStart >= 0) {
    const duration = (buffer.length - silenceStart) / sampleRate;
    if (duration >= minDuration) {
      pauses.push({ startSeconds: silenceStart / sampleRate, endSeconds: buffer.duration, peak });
    }
  }
  return pauses;
}

export function AutoEditPanel() {
  const media = useEditorStore(useShallow((state) => Object.values(state.project.entities.media)));
  const clips = useEditorStore(useShallow((state) => Object.values(state.project.entities.clips)));
  const fps = useEditorStore((state) => state.project.settings.frameRate);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const selectClips = useEditorStore((state) => state.selectClips);
  const applyTimelineCuts = useEditorStore((state) => state.applyTimelineCuts);
  const { store } = useMediaImportContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pauses, setPauses] = useState<Pause[]>([]);
  const [decisions, setDecisions] = useState<Record<number, "cut" | "keep">>({});
  const [threshold, setThreshold] = useState(0.012);
  const [minDuration, setMinDuration] = useState(0.7);

  const source = useMemo(
    () => media.find((asset) => asset.metadata.hasAudio && asset.source.type === "indexeddb"),
    [media],
  );

  const analyze = useCallback(async () => {
    if (!source || source.source.type !== "indexeddb") return;
    setBusy(true);
    setError(null);
    setPauses([]);
    setDecisions({});
    let context: AudioContext | null = null;
    try {
      const blob = await store().get(source.source.key);
      if (!blob) throw new Error("Original media bytes were not found in local storage.");
      const AudioContextCtor = window.AudioContext;
      context = new AudioContextCtor();
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      setPauses(findPauses(decoded, threshold, minDuration));
      setDecisions({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audio analysis failed.");
    } finally {
      if (context) await context.close();
      setBusy(false);
    }
  }, [source, store, threshold, minDuration]);

  const sourceClips = useMemo(
    () => clips.filter((clip) =>
      (clip.content.kind === "video" || clip.content.kind === "audio") &&
      clip.content.mediaId === source?.id,
    ),
    [clips, source],
  );

  const applySelectedCuts = () => {
    if (!source || sourceClips.length !== 1) return;
    const clip = sourceClips[0]!;
    if (clip.content.kind !== "video" && clip.content.kind !== "audio") return;
    const speed = clip.content.speed || 1;
    const selectedRanges = pauses.flatMap((pause, index) => {
      if (decisions[index] !== "cut") return [];
      const sourceStart = Math.round(pause.startSeconds * fps);
      const sourceEnd = Math.round(pause.endSeconds * fps);
      const clipSourceStart = clip.content.sourceInFrame;
      const clipSourceEnd = clipSourceStart + Math.ceil(clip.durationFrames * speed);
      const start = Math.max(sourceStart, clipSourceStart);
      const end = Math.min(sourceEnd, clipSourceEnd);
      if (end <= start) return [];
      return [{
        startFrame: clip.startFrame + Math.floor((start - clipSourceStart) / speed),
        endFrame: clip.startFrame + Math.ceil((end - clipSourceStart) / speed),
      }];
    });
    if (selectedRanges.length === 0) return;
    const applied = applyTimelineCuts(selectedRanges);
    if (!applied) {
      setError("Cuts were not applied. A locked clip or track would be affected, or the selected ranges no longer overlap the timeline.");
      return;
    }
    setPauses([]);
    setDecisions({});
    setError(null);
  };

  const jumpTo = (seconds: number) => {
    if (!source) return;
    const sourceFrame = Math.round(seconds * fps);
    const clip = clips.find((item) => {
      if (
        (item.content.kind !== "video" && item.content.kind !== "audio") ||
        item.content.mediaId !== source.id
      ) return false;
      const speed = item.content.speed || 1;
      const sourceStart = item.content.sourceInFrame;
      const sourceEnd = sourceStart + Math.ceil(item.durationFrames * speed);
      return sourceFrame >= sourceStart && sourceFrame < sourceEnd;
    });

    // A source-media timestamp is not a timeline timestamp: clips may be
    // trimmed, retimed, or placed later in the sequence.
    if (!clip || (clip.content.kind !== "video" && clip.content.kind !== "audio")) return;
    const timelineOffset = (sourceFrame - clip.content.sourceInFrame) / (clip.content.speed || 1);
    selectClips([clip.id]);
    setPlayhead(clip.startFrame + Math.round(timelineOffset));
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <AudioWaveform size={18} className="text-accent" />
        <p className="text-xs text-text-primary font-medium">Pause detection</p>
      </div>
      <p className="text-2xs text-text-tertiary">
        Scans the imported audio locally and finds sustained low-volume sections. Results are edit suggestions; your original media is not changed.
      </p>
      {!source ? (
        <p className="text-xs text-text-secondary">Import a video or audio file with an audio track first.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-2xs text-text-tertiary">Silence sensitivity (RMS)</label>
            <select
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="bg-surface-input text-text-primary rounded-xs px-2 py-1.5 text-xs"
            >
              <option value={0.006}>Low — quiet room</option>
              <option value={0.012}>Medium — recommended</option>
              <option value={0.025}>High — noisy recordings</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-2xs text-text-tertiary">Minimum pause duration</label>
            <select
              value={minDuration}
              onChange={(event) => setMinDuration(Number(event.target.value))}
              className="bg-surface-input text-text-primary rounded-xs px-2 py-1.5 text-xs"
            >
              <option value={0.5}>0.5 seconds</option>
              <option value={0.7}>0.7 seconds</option>
              <option value={1}>1 second</option>
              <option value={1.5}>1.5 seconds</option>
            </select>
          </div>
          <Button size="sm" variant="secondary" className="w-full" disabled={busy} onClick={() => void analyze()}>
            {busy ? <><Loader2 size={13} className="animate-spin" /> Analyzing audio…</> : <><ScanSearch size={13} /> Analyze pauses</>}
          </Button>
        </>
      )}
      {error && <p className="text-2xs text-danger">{error}</p>}
      {pauses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-2xs text-text-secondary">{pauses.length} pause suggestions</p>
            <p className="text-2xs text-text-tertiary">
              {Object.values(decisions).filter((decision) => decision === "cut").length} marked to cut
            </p>
          </div>
          <p className="text-2xs text-text-tertiary">
            Review each result. Mark only genuine pauses for cutting; keep anything that contains speech or useful sound.
          </p>
          {pauses.map((pause, index) => {
            const decision = decisions[index];
            return (
              <div
                key={`${pause.startSeconds}-${pause.endSeconds}`}
                className="border-border-subtle bg-surface-raised flex flex-col gap-2 rounded-sm border p-2"
              >
                <button
                  onClick={() => jumpTo(pause.startSeconds)}
                  className="flex items-center justify-between text-left"
                  title="Jump to this source timestamp"
                >
                  <span className="text-2xs text-text-primary">Pause {index + 1}</span>
                  <span className="text-2xs tabular text-text-tertiary">
                    {formatTime(pause.startSeconds)}–{formatTime(pause.endSeconds)}
                  </span>
                </button>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setDecisions((current) => ({ ...current, [index]: "cut" }))}
                    aria-pressed={decision === "cut"}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xs border px-2 py-1 text-2xs ${decision === "cut" ? "border-accent bg-accent-muted text-accent" : "border-border-subtle text-text-secondary hover:bg-surface-overlay"}`}
                  >
                    <Check size={12} /> Mark to cut
                  </button>
                  <button
                    onClick={() => setDecisions((current) => ({ ...current, [index]: "keep" }))}
                    aria-pressed={decision === "keep"}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xs border px-2 py-1 text-2xs ${decision === "keep" ? "border-border-strong bg-surface-overlay text-text-primary" : "border-border-subtle text-text-secondary hover:bg-surface-overlay"}`}
                  >
                    <X size={12} /> Keep
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pauses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sourceClips.length === 1 ? (
            <Button
              size="sm"
              className="w-full"
              disabled={!Object.values(decisions).some((decision) => decision === "cut")}
              onClick={applySelectedCuts}
            >
              Apply selected cuts to timeline
            </Button>
          ) : (
            <p className="text-2xs text-text-tertiary">
              To apply cuts safely, this source must appear in exactly one timeline clip. Found {sourceClips.length}.
            </p>
          )}
          <p className="text-2xs text-text-tertiary">
            All tracks ripple together. The operation is one undo step; locked material that would move or split prevents the edit.
          </p>
        </div>
      )}
      {pauses.length === 0 && !busy && !error && (
        <p className="text-2xs text-text-tertiary">Run analysis to see suggested pause cuts here.</p>
      )}
    </div>
  );
}
