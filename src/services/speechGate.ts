/** A click/brief room noise must not arm the end-of-answer timer. */
export function createSpeechGate() {
  let candidate: number | null = null;
  let last = 0;
  let confirmed = false;
  return {
    sample(speaking: boolean, now: number) {
      if (speaking) {
        if (candidate === null || now - last > 160) candidate = now;
        // Two consecutive 80ms samples preserve short one-word replies.
        if (now - candidate >= 80) confirmed = true;
        last = now;
      } else if (!confirmed) candidate = null;
      return { confirmed, ended: confirmed && !speaking && now - last > 2300 };
    },
  };
}
