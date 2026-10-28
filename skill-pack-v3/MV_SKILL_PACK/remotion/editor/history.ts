// Snapshot undo/redo for the whole editor state. Continuous edits (drags, sliders, typing) within `gap` ms
// or while a pointer is held become ONE step.
export class History {
  undoStack: string[] = []; redoStack: string[] = []; committed = ""; private last = -1e9; private fresh = true;
  constructor(public limit = 100, public gap = 700) {}
  reset(snap: string) { this.undoStack = []; this.redoStack = []; this.committed = snap; this.cut(); }
  /** call after every edit with the new snapshot. */
  record(snap: string, now: number, holding = false) {
    if (snap === this.committed) return false;
    const burst = !this.fresh && (holding || now - this.last < this.gap); this.last = now; this.fresh = false;
    if (!burst || !this.undoStack.length || this.redoStack.length) { this.undoStack.push(this.committed); if (this.undoStack.length > this.limit) this.undoStack.shift(); }
    this.redoStack = []; this.committed = snap; return true;
  }
  /** end the current burst so the next edit is a new step (e.g. on pointerup). */
  cut() { this.last = -1e9; this.fresh = true; }
  undo(current: string): string | null { if (current !== this.committed) this.record(current, -1e9); const s = this.undoStack.pop(); if (s === undefined) return null; this.redoStack.push(this.committed); this.committed = s; this.cut(); return s; }
  redo(): string | null { const s = this.redoStack.pop(); if (s === undefined) return null; this.undoStack.push(this.committed); this.committed = s; this.cut(); return s; }
  get canUndo() { return this.undoStack.length > 0; } get canRedo() { return this.redoStack.length > 0; }
}
/** keep Ctrl+Z native inside text fields. */
export const isTextField = (el: any) => !!el && (el.tagName === "TEXTAREA" || el.isContentEditable || (el.tagName === "INPUT" && !["range", "checkbox", "radio", "button", "color", "file"].includes(el.type)));
