import { afterEach } from 'vitest';

/*
 * jsdom quirk: GrapesJS renders the canvas from the iframe's `onload`
 * handler, and that render pushes new items into jsdom's resource queue,
 * which makes jsdom re-dispatch `load` on the same iframe again and again —
 * an endless synchronous loop that hangs the test run. A real browser fires
 * it once, so we make `iframe.onload` handlers run only once.
 */
Object.defineProperty(HTMLIFrameElement.prototype, 'onload', {
  configurable: true,
  get(this: HTMLIFrameElement & { __gjsOnload?: EventListener | null }) {
    return this.__gjsOnload || null;
  },
  set(this: HTMLIFrameElement & { __gjsOnload?: EventListener | null; __gjsOnloadBound?: boolean }, fn: EventListener | null) {
    this.__gjsOnload = fn;
    if (this.__gjsOnloadBound) return;
    this.__gjsOnloadBound = true;
    let done = false;
    this.addEventListener('load', (e) => {
      if (done || !this.__gjsOnload) return;
      done = true;
      this.__gjsOnload.call(this, e);
    });
  },
});

// jsdom has no layout: GrapesJS scrolls the Layer Manager to the selected row.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

// Every test builds its own editor; make sure nothing leaks between tests.
afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('gjs-cm-styles')?.remove();
});
