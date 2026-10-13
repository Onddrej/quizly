/**
 * Two tiny answer sounds, synthesized with the Web Audio API (no audio files, so they work offline and cost nothing to
 * precache): two soft rising notes for a right answer, one short low note for a wrong one. The only module that touches
 * `AudioContext`. Everything here is best effort: a browser without Web Audio, or one that refuses to start it, stays silent.
 */

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** One enveloped note: a quick fade in and out, so there is no click. */
function note(ctx: AudioContext, frequency: number, offset: number, duration: number, type: OscillatorType, volume: number): void {
  const start = ctx.currentTime + offset;
  const stop = start + duration;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(stop);
}

function play(notes: (ctx: AudioContext) => void): void {
  try {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    notes(ctx);
  } catch {
    context = null; // a broken context is dropped, so the next sound can try again
  }
}

/** Right answer: a soft two-note rise (E5 then A5). */
export function playCorrect(): void {
  play((ctx) => {
    note(ctx, 659, 0, 0.11, 'sine', 0.12);
    note(ctx, 880, 0.1, 0.16, 'sine', 0.12);
  });
}

/** Wrong answer: one short, low, soft note (A3). */
export function playWrong(): void {
  play((ctx) => {
    note(ctx, 220, 0, 0.22, 'triangle', 0.14);
  });
}

/** Test hook: forget the shared audio context. */
export function resetSoundsForTests(): void {
  context = null;
}
