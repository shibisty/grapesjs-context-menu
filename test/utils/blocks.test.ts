import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from 'grapesjs';
import {
  appendBlock,
  blockCategory,
  blockText,
  getAvailableBlocks,
  groupBlocks,
} from '../../src/utils/blocks';
import { createEditor, destroyEditor, type Setup } from '../helpers/editor';

describe('block helpers', () => {
  let s: Setup;
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  async function setup(): Promise<void> {
    s = await createEditor();
    editor = s.editor;
    const bm = editor.Blocks;
    bm.add('b-text', { label: '<svg><path d="M0"/></svg><div>  Text\n block </div>', category: 'Basic', content: '<p class="from-block">Hi</p>' });
    bm.add('b-img', { label: 'Image', category: 'Media', content: { type: 'image' } });
    bm.add('b-link', { label: 'Link', category: 'Basic', content: '<a>link</a>' });
    bm.add('b-nocat', { label: '', content: '<span>x</span>' });
    bm.add('b-fn', {
      label: 'Fn',
      category: 'Extra',
      content: ((ed: Editor) => `<div class="fn-${ed === editor ? 'ok' : 'bad'}">f</div>`) as unknown as string,
    });
  }

  it('blockText strips markup and svg, falls back to id', async () => {
    await setup();
    expect(blockText(editor.Blocks.get('b-text')!)).toBe('Text block');
    expect(blockText(editor.Blocks.get('b-nocat')!)).toBe('b-nocat');
  });

  it('blockCategory handles string, Category model and missing category', async () => {
    await setup();
    // GrapesJS turns string categories into Category models on add
    expect(blockCategory(editor.Blocks.get('b-text')!)).toBe('Basic');
    expect(blockCategory(editor.Blocks.get('b-nocat')!)).toBe('');
    const b = editor.Blocks.get('b-link')!;
    b.set('category', 'Plain', { silent: true });
    expect(blockCategory(b)).toBe('Plain');
    b.set('category', { id: 'obj', label: 'Obj label' } as never, { silent: true });
    expect(blockCategory(b)).toBe('Obj label');
  });

  it('getAvailableBlocks returns all blocks or only the listed ids', async () => {
    await setup();
    expect(getAvailableBlocks(editor, null).map((b) => b.getId())).toEqual(
      expect.arrayContaining(['b-text', 'b-img', 'b-link', 'b-nocat', 'b-fn'])
    );
    expect(getAvailableBlocks(editor, ['b-img', 'b-link', 'nope']).map((b) => b.getId())).toEqual(['b-img', 'b-link']);
  });

  it('groupBlocks keeps the first-seen category order', async () => {
    await setup();
    const groups = groupBlocks(getAvailableBlocks(editor, ['b-text', 'b-img', 'b-link', 'b-nocat']));
    expect(groups.map((g) => g.category)).toEqual(['Basic', 'Media', '']);
    expect(groups[0].blocks.map((b) => b.getId())).toEqual(['b-text', 'b-link']);
  });

  it('appendBlock appends INTO the target and returns the new component', async () => {
    await setup();
    const box = s.get('box');
    const before = box.components().length;
    const added = appendBlock(editor, editor.Blocks.get('b-text')!, box);
    expect(box.components().length).toBe(before + 1);
    expect(added?.getClasses()).toContain('from-block');
    expect(added?.parent()).toBe(box);
  });

  it('appendBlock supports content defined as a function of the editor', async () => {
    await setup();
    const added = appendBlock(editor, editor.Blocks.get('b-fn')!, s.get('sec'));
    expect(added?.getClasses()).toContain('fn-ok');
  });

  it('appendBlock returns undefined for an empty block', async () => {
    await setup();
    editor.Blocks.add('b-empty', { label: 'Empty', content: '' });
    expect(appendBlock(editor, editor.Blocks.get('b-empty')!, s.get('box'))).toBeUndefined();
  });
});
