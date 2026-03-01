// Shared UI utilities

/**
 * Adds long-press tooltip support for touch devices.
 * After 500ms of holding a touch on `el`, adds the "touch-active" class so that
 * CSS hover-tooltip rules (paired with `.touch-active`) become visible.
 * The class is removed when the touch ends, is cancelled, or the finger moves.
 */
export function addLongPressTooltip(el) {
  let timer = null;
  el.addEventListener("touchstart", () => {
    timer = setTimeout(() => el.classList.add("touch-active"), 500);
  }, { passive: true });
  const cancel = () => { clearTimeout(timer); timer = null; };
  const remove = () => { cancel(); el.classList.remove("touch-active"); };
  el.addEventListener("touchmove", cancel, { passive: true });
  el.addEventListener("touchend", remove);
  el.addEventListener("touchcancel", remove);
}
