import type { ContextMenuLabels } from '../../types';

/**
 * `se` — Swedish. The ISO 639-1 code is `sv`, but GrapesJS core ships its
 * Swedish locale as `grapesjs/locale/se.js`; we use the same code so the
 * plugin follows the core's locale.
 */
const messages: ContextMenuLabels = {
  add: 'Lägg till element',
  noBlocks: 'Inga block tillgängliga',
  selectParent: 'Välj överordnat',
  selectChild: 'Välj underordnat',
  moveUp: 'Flytta upp',
  moveDown: 'Flytta ned',
  move: 'Flytta (dra)',
  clone: 'Duplicera',
  viewStyles: 'Visa stilar',
  delete: 'Ta bort',
  hierarchyTitle: 'Hierarki: välj vilket element du vill arbeta med',
};

export default messages;
