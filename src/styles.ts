/**
 * Every element of the plugin is rendered into document.body (position:
 * fixed, viewport coordinates), outside the editor container, so nothing
 * can be inherited from the GrapesJS theme: colors and font are explicit.
 */

/** CSS class prefix of every element the plugin renders. */
export const PFX = 'gjs-cm';

export const STYLE_ID = 'gjs-cm-styles';

const panel =
  'position:fixed;background:#333;color:#ddd;border:1px solid rgba(255,255,255,.12);' +
  'border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.35);padding:4px 0;font-size:13px;' +
  'font-family:var(--gjs-main-font,Helvetica,Arial,sans-serif);box-sizing:border-box;';

export const CSS = [
  `.${PFX}-menu,.${PFX}-submenu{${panel}z-index:99999;min-width:190px;}`,
  `.${PFX}-submenu{max-height:min(70vh,520px);overflow-y:auto;}`,
  `.${PFX}-crumbmenu{${panel}z-index:99998;min-width:220px;max-height:60vh;overflow-y:auto;}`,
  `.${PFX}-item{padding:7px 14px;cursor:pointer;white-space:nowrap;display:flex;justify-content:space-between;align-items:center;gap:10px;outline:none;}`,
  `.${PFX}-item:hover,.${PFX}-item:focus-visible,.${PFX}-item--open{background:#3b97e3;color:#fff;}`,
  `.${PFX}-item--danger{color:#ff7a7a;}`,
  `.${PFX}-item--danger:hover,.${PFX}-item--danger:focus-visible{background:#c33;color:#fff;}`,
  `.${PFX}-item--disabled,.${PFX}-item--empty{opacity:.45;cursor:default;}`,
  `.${PFX}-item--disabled:hover,.${PFX}-item--empty:hover{background:transparent;color:inherit;}`,
  `.${PFX}-item--current{font-weight:600;cursor:default;}`,
  `.${PFX}-item--current:hover{background:transparent;color:inherit;}`,
  `.${PFX}-item small{opacity:.6;margin-left:10px;font-size:11px;}`,
  `.${PFX}-ico{display:inline-block;width:16px;margin-right:8px;text-align:center;opacity:.8;font-style:normal;}`,
  `.${PFX}-group{padding:6px 14px 3px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.55;}`,
  `.${PFX}-sep{height:1px;margin:4px 0;background:rgba(255,255,255,.1);}`,
  `.${PFX}-crumb{position:fixed;z-index:100;display:none;align-items:center;gap:5px;padding:0 8px;height:20px;font-size:12px;line-height:20px;background:#3b97e3;color:#fff;border-radius:3px 3px 0 0;cursor:pointer;user-select:none;white-space:nowrap;font-family:var(--gjs-main-font,Helvetica,Arial,sans-serif);}`,
  `.${PFX}-crumb:hover{background:#2f86d0;}`,
].join('\n');

export function injectCss(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
