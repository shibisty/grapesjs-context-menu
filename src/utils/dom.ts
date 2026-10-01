/**
 * Places a fixed-position element at (x, y) and pulls it back inside the
 * viewport if it would overflow. Must be called AFTER the element is in the
 * document, so its size is real.
 */
export function placeInViewport(el: HTMLElement, x: number, y: number): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = x;
  let top = y;
  if (left + w > vw) left = Math.max(0, vw - w - 4);
  if (top + h > vh) top = Math.max(0, vh - h - 4);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

/** Strips markup (incl. inline <svg>/<style>/<script>) and collapses whitespace. */
export function htmlToText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('svg,style,script').forEach((n) => n.remove());
  return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Canvas frame geometry: its viewport rect plus the zoom factor. */
export interface FrameGeometry {
  rect: DOMRect;
  scale: number;
}

export function getFrameGeometry(frameEl: HTMLIFrameElement): FrameGeometry {
  const rect = frameEl.getBoundingClientRect();
  const scale = frameEl.offsetWidth ? rect.width / frameEl.offsetWidth : 1;
  return { rect, scale };
}

/** Converts a point in the canvas iframe viewport to a point in the host page viewport. */
export function framePointToPage(
  frameEl: HTMLIFrameElement,
  x: number,
  y: number
): { x: number; y: number } {
  const { rect, scale } = getFrameGeometry(frameEl);
  return { x: rect.left + x * scale, y: rect.top + y * scale };
}
