/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
const DEFAULT_ITEM_HEIGHT = 64;
const OVERSCAN = 8;

// Content and viewport are separate. Measured row heights (including gaps)
// replace estimates progressively, so wrapping/expanded rows remain reachable.
export function createVirtualScroller({ container, viewport = container, items, renderItem, itemHeight = DEFAULT_ITEM_HEIGHT, rowHeights = new Map() }) {
  let rows = items || [];
  let destroyed = false;
  let raf = 0;
  let observer;
  let gap = 0;
  let originalGap = '';
  let offsets = [];
  let retainBottom = false;
  const heights = rowHeights;
  const pool = new Map();
  const top = document.createElement('div');
  const bottom = document.createElement('div');
  top.className = 'vs-spacer vs-spacer-top'; bottom.className = 'vs-spacer vs-spacer-bottom';
  top.setAttribute('aria-hidden','true'); bottom.setAttribute('aria-hidden','true');
  function rebuildOffsets() {
    offsets = [0];
    for (const row of rows) offsets.push(offsets.at(-1) + (heights.get(row.id) || itemHeight + gap));
  }
  function indexAt(position) {
    let low = 0, high = rows.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (offsets[mid + 1] <= position) low = mid + 1; else high = mid;
    }
    return Math.min(Math.max(0,rows.length - 1),low);
  }
  function scheduleMeasure() {
    if (raf || destroyed) return;
    raf = requestAnimationFrame(() => { raf = 0; measure(); });
  }
  function render() {
    if (destroyed) return;
    // Rendering newly visible rows can increase scrollHeight before their
    // measured offsets are available. Capture the bottom anchor first.
    if (viewport.clientHeight > 0 && viewport.scrollTop > 0 && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 2) retainBottom = true;
    const start = rows.length ? Math.max(0,indexAt(viewport.scrollTop) - OVERSCAN) : 0;
    const end = rows.length ? Math.min(rows.length,indexAt(viewport.scrollTop + (viewport.clientHeight || 600)) + OVERSCAN + 1) : 0;
    top.style.height = (offsets[start] || 0) + 'px';
    bottom.style.height = ((offsets.at(-1) || 0) - (offsets[end] || 0)) + 'px';
    const wanted = new Set(rows.slice(start,end).map(row => row.id));
    for (const [id,node] of pool) if (!wanted.has(id)) { observer?.unobserve(node); node.remove(); pool.delete(id); }
    let previous = top;
    for (let i = start; i < end; i++) {
      const row = rows[i];
      let node = pool.get(row.id);
      if (!node) {
        node = renderItem(row);
        node.style.marginBottom = gap + 'px';
        pool.set(row.id,node);
        observer?.observe(node);
      }
      if (previous.nextSibling !== node) previous.after(node);
      previous = node;
    }
    if (previous.nextSibling !== bottom) previous.after(bottom);
    scheduleMeasure();
  }
  function measure() {
    if (destroyed) return;
    const atBottom = retainBottom || viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 2;
    retainBottom = false;
    const anchor = indexAt(viewport.scrollTop);
    const within = viewport.scrollTop - (offsets[anchor] || 0);
    let changed = false;
    for (const [id,node] of pool) {
      const measured = node.getBoundingClientRect().height + gap;
      if (measured > gap && Math.abs(measured - (heights.get(id) || itemHeight + gap)) > 0.5) {
        heights.set(id,measured); changed = true;
      }
    }
    if (changed) {
      rebuildOffsets();
      render();
      viewport.scrollTop = atBottom ? viewport.scrollHeight : Math.max(0,(offsets[anchor] || 0) + within);
      render();
    }
  }
  function onScroll() { render(); }
  function mount() {
    originalGap = container.style.rowGap;
    gap = parseFloat(getComputedStyle(container).rowGap) || 0;
    container.style.rowGap = '0px';
    container.append(top,bottom);
    rebuildOffsets();
    observer = new ResizeObserver(() => { measure(); render(); });
    observer.observe(viewport);
    viewport.addEventListener('scroll',onScroll,{passive:true});
    render();
  }
  function update(newItems) {
    const anchor = indexAt(viewport.scrollTop);
    const anchorId = rows[anchor]?.id;
    const within = viewport.scrollTop - (offsets[anchor] || 0);
    rows = newItems || [];
    for (const node of pool.values()) { observer?.unobserve(node); node.remove(); }
    pool.clear();
    const survivingIds = new Set(rows.map(row => row.id));
    for (const id of heights.keys()) if (!survivingIds.has(id)) heights.delete(id);
    rebuildOffsets();
    const nextAnchor = rows.findIndex(row => row.id === anchorId);
    // Restore the content's full height before assigning scrollTop; assigning
    // while only the old spacers remain lets the browser clamp the position.
    render();
    if (nextAnchor >= 0) viewport.scrollTop = Math.max(0, offsets[nextAnchor] + within);
    render();
  }
  function scrollToItem(id) {
    const index = rows.findIndex(row => row.id === id);
    if (index < 0) return;
    const rowTop = offsets[index];
    const rowBottom = offsets[index+1];
    if (rowTop < viewport.scrollTop || rowBottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = Math.max(0,rowTop - viewport.clientHeight / 2);
    render();
  }
  function destroy() {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    observer?.disconnect();
    viewport.removeEventListener('scroll',onScroll);
    for (const node of pool.values()) node.remove();
    pool.clear(); top.remove(); bottom.remove(); container.style.rowGap = originalGap;
  }
  return { mount, update, destroy, scrollToItem, getNode: id => pool.get(id) || null };
}
