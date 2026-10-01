import type { Block, Component, Editor } from 'grapesjs';
import { htmlToText } from './dom';

/** The part of the Block Manager API the plugin uses (the class itself isn't exported by grapesjs). */
export interface BlockSource {
  get(id: string): Block | null | undefined;
  getAll(): unknown;
}

export function getBlockManager(editor: Editor): BlockSource | undefined {
  return (editor.Blocks || editor.BlockManager) as unknown as BlockSource | undefined;
}

export function blockId(block: Block): string {
  return String(block.get('id') || block.id || '');
}

/** Plain-text label of a block (labels often contain inline SVG icons). */
export function blockText(block: Block): string {
  const label = block.get('label');
  const text = typeof label === 'string' ? htmlToText(label) : '';
  return text || blockId(block);
}

/** Category label; categories may be a string, a Category model or a plain object. */
export function blockCategory(block: Block): string {
  const c = block.get('category') as unknown;
  if (!c) return '';
  if (typeof c === 'string') return c;
  const model = c as { get?: (k: string) => unknown; label?: string; id?: string };
  const value = model.get ? model.get('label') || model.get('id') : model.label || model.id;
  return value ? String(value) : '';
}

/** Blocks available in the "Add element" submenu. */
export function getAvailableBlocks(editor: Editor, only: string[] | null): Block[] {
  const bm = getBlockManager(editor);
  if (!bm) return [];
  const all = bm.getAll() as { models?: Block[] } | Block[];
  const models: Block[] = Array.isArray(all) ? all : all && all.models ? all.models : [];
  return only ? models.filter((b) => only.indexOf(blockId(b)) !== -1) : models;
}

/** Groups blocks by category, keeping the order in which categories first appear. */
export function groupBlocks(blocks: Block[]): { category: string; blocks: Block[] }[] {
  const groups: { category: string; blocks: Block[] }[] = [];
  const byName: Record<string, { category: string; blocks: Block[] }> = {};
  blocks.forEach((b) => {
    const cat = blockCategory(b);
    if (!byName[cat]) {
      byName[cat] = { category: cat, blocks: [] };
      groups.push(byName[cat]);
    }
    byName[cat].blocks.push(b);
  });
  return groups;
}

/**
 * Appends the block content INTO `target` and returns the first added
 * component. Some plugins (countdown, tabs, ...) define `content` as a
 * function of the editor.
 */
export function appendBlock(editor: Editor, block: Block, target: Component): Component | undefined {
  let content = block.get('content') as unknown;
  if (typeof content === 'function') content = (content as (e: Editor) => unknown)(editor);
  if (content == null || content === '') return undefined;
  const added = target.append(content as Parameters<Component['append']>[0]);
  return Array.isArray(added) ? added[0] : (added as Component | undefined);
}
