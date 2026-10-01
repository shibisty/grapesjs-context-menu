import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, resolveOptions } from '../src/options';

describe('resolveOptions', () => {
  it('returns defaults for empty / missing options', () => {
    expect(resolveOptions()).toEqual(DEFAULT_OPTIONS);
    expect(resolveOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(resolveOptions({})).toEqual(DEFAULT_OPTIONS);
  });

  it('overrides only the given keys', () => {
    const o = resolveOptions({ canvasMenu: false, blocks: ['text'] });
    expect(o.canvasMenu).toBe(false);
    expect(o.blocks).toEqual(['text']);
    expect(o.layersMenu).toBe(true);
    expect(o.viewStylesCommand).toBe('layers-sidebar:show-styles');
  });

  it('ignores undefined values instead of erasing defaults', () => {
    const o = resolveOptions({ injectCss: undefined, viewStylesCommand: undefined });
    expect(o.injectCss).toBe(true);
    expect(o.viewStylesCommand).toBe('layers-sidebar:show-styles');
  });

  it('keeps null for viewStylesCommand (explicitly disabled)', () => {
    expect(resolveOptions({ viewStylesCommand: null }).viewStylesCommand).toBeNull();
  });

  it('copies labels instead of sharing the default object', () => {
    const labels = { delete: 'Remove' };
    const o = resolveOptions({ labels });
    expect(o.labels).toEqual({ delete: 'Remove' });
    expect(o.labels).not.toBe(labels);
    expect(DEFAULT_OPTIONS.labels).toEqual({});
  });
});
