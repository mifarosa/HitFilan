// Timestamp-based sequence timer. Stays accurate even when the browser
// throttles timers (screen off, tab in background): elapsed time is always
// derived from Date.now(), and missed step boundaries are caught up on the next tick.
//
// Steps with `open: true` (rep-based sets) have no time limit: they wait until
// the user moves on, and their `dur` is only an estimate for totals.

export class SequenceTimer {
  constructor(steps, handlers = {}) {
    this.steps = steps;
    this.h = handlers; // { onTick, onStep, onCue, onFinish }
    this.index = 0;
    this.stepElapsedMs = 0; // elapsed in current step, excluding the running segment
    this.segmentStart = null; // Date.now() when current running segment began
    this.running = false;
    this.finished = false;
    this.lastCueSecond = null;
    this.interval = null;
    this.actualMs = []; // time actually spent on finished open steps
  }

  get current() {
    return this.steps[this.index];
  }

  stepElapsed() {
    const live = this.running ? Date.now() - this.segmentStart : 0;
    return this.stepElapsedMs + live;
  }

  stepRemaining() {
    return Math.max(0, this.current.dur * 1000 - this.stepElapsed()) / 1000;
  }

  totalElapsed() {
    const cur = this.current;
    let ms = cur.open ? this.stepElapsed() : Math.min(this.stepElapsed(), cur.dur * 1000);
    for (let i = 0; i < this.index; i++) {
      const s = this.steps[i];
      ms += s.open && this.actualMs[i] != null ? this.actualMs[i] : s.dur * 1000;
    }
    return ms / 1000;
  }

  start() {
    if (this.running || this.finished) return;
    this.running = true;
    this.segmentStart = Date.now();
    this.h.onStep?.(this.current, this.index, { fresh: this.stepElapsedMs === 0 });
    this.interval = setInterval(() => this.tick(), 200);
    this.tick();
  }

  pause() {
    if (!this.running) return;
    this.stepElapsedMs = this.stepElapsed();
    this.running = false;
    clearInterval(this.interval);
    this.h.onTick?.(this);
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  goTo(index) {
    if (index < 0 || index >= this.steps.length) return;
    this.index = index;
    this.stepElapsedMs = 0;
    this.segmentStart = Date.now();
    this.lastCueSecond = null;
    this.h.onStep?.(this.current, this.index, { fresh: true, manual: true });
    this.h.onTick?.(this);
  }

  // Jump to a saved position (used to resume an interrupted workout).
  seek(index, elapsedMs) {
    this.index = Math.min(Math.max(index, 0), this.steps.length - 1);
    this.stepElapsedMs = this.current.open ? elapsedMs : Math.min(elapsedMs, this.current.dur * 1000 - 1000);
    this.lastCueSecond = null;
  }

  next() {
    if (this.current.open) this.actualMs[this.index] = this.stepElapsed();
    if (this.index >= this.steps.length - 1) this.finish();
    else this.goTo(this.index + 1);
  }

  prev() {
    // Restart the current step if we are more than 3s in, otherwise go back one.
    if (this.stepElapsed() > 3000 || this.index === 0) this.goTo(this.index);
    else this.goTo(this.index - 1);
  }

  tick() {
    if (!this.running) return;
    if (this.current.open) {
      // Waits for the user; no countdown cues.
      this.h.onTick?.(this);
      return;
    }
    let overflow = this.stepElapsed() - this.current.dur * 1000;
    // Catch up on any step boundaries crossed while throttled.
    while (overflow >= 0) {
      if (this.index >= this.steps.length - 1) {
        this.finish();
        return;
      }
      this.index++;
      this.stepElapsedMs = overflow;
      this.segmentStart = Date.now();
      this.lastCueSecond = null;
      this.h.onStep?.(this.current, this.index, { fresh: true });
      // A rep-based step stops the catch-up: it waits for the user.
      if (this.current.open) {
        this.h.onTick?.(this);
        return;
      }
      overflow = this.stepElapsed() - this.current.dur * 1000;
    }

    const secLeft = Math.ceil(this.stepRemaining());
    if (secLeft !== this.lastCueSecond) {
      this.lastCueSecond = secLeft;
      this.h.onCue?.(secLeft, this.current, this.steps[this.index + 1]);
    }
    this.h.onTick?.(this);
  }

  finish() {
    // Totals read as fully done
    this.stepElapsedMs = this.current.open ? this.stepElapsed() : this.current.dur * 1000;
    this.running = false;
    this.finished = true;
    clearInterval(this.interval);
    this.h.onFinish?.(this);
  }

  stop() {
    this.running = false;
    clearInterval(this.interval);
  }
}
