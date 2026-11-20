import { afterEach, describe, expect, it } from 'vitest';
import grapesjs from 'grapesjs';
import plugin, { META, VERSION, getContextMenu } from '../src/index';
import { CONTROLS, definePlugin, type PluginControl } from '../src/contract';
import { createEditor } from './helpers/editor';
import pkg from '../package.json';

const control = (ed: object): PluginControl => (ed as Record<symbol, Map<string, PluginControl>>)[CONTROLS].get(META.id)!;

describe('plugin contract', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('meta: id = npm name, version = package.json, registered by id', () => {
    expect(META.id).toBe(pkg.name);
    expect(VERSION).toBe(pkg.version);
    expect((plugin as unknown as { meta: unknown }).meta).toBe(META);
    // A UMD bundle runs after grapesjs: it registers itself by id.
    (globalThis as { grapesjs?: unknown }).grapesjs = grapesjs;
    definePlugin(plugin, META);
    expect(grapesjs.plugins.get(META.id)).toBe(plugin);
  });

  it('reports its options and applies live ones', async () => {
    const { editor } = await createEditor({ labels: { delete: 'Kill' } });
    const c = control(editor);
    expect(c.getOptions()).toMatchObject({ canvasMenu: true, labels: { delete: 'Kill' } });
    expect(c.setOptions({ canvasMenu: false, labels: { delete: 'Drop' }, hierarchyBadge: false })).toEqual({
      applied: ['canvasMenu', 'labels'],
      reload: ['hierarchyBadge'],
    });
    expect(c.getOptions()).toMatchObject({ canvasMenu: false, labels: { delete: 'Drop' }, hierarchyBadge: true });
    getContextMenu(editor)!.destroy();
    expect((editor as unknown as Record<symbol, Map<string, unknown>>)[CONTROLS].has(META.id)).toBe(false);
  });
});
