/** The e-ink blink plays when the key changes after the first render (never on the first one), and not within BLINK_GAP_MS of the last one: one blink is two inversions, so this keeps a fast scroll to three flashes a second at most. */
/** Key 0 means the panel is not on screen: it never blinks for going dark, only for becoming live (or changing while live). */
export const shouldBlink = (prev: string | number | undefined, next: string | number | undefined, sinceLastMs = Infinity): boolean =>
  prev !== undefined && next !== undefined && next !== 0 && prev !== next && sinceLastMs >= BLINK_GAP_MS;
export const BLINK_MS = 450;
export const BLINK_GAP_MS = 1000;
