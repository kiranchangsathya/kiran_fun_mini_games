const W = 856, H = 336;
const CENTER_W = 90, MARGIN = 8, COLS = 9, ROWS = 4;
const gridW = (W - CENTER_W - 2 * MARGIN) / 2;
const tw = Math.floor((gridW - (COLS - 1) * 3) / COLS);
const th = Math.floor((H - 2 * MARGIN - 22) / ROWS);
const gap = 3, labelH = 22;
const p1x = MARGIN;
const p2x = MARGIN + gridW + CENTER_W;
const mx = MARGIN + gridW + CENTER_W / 2;
const gy = MARGIN + labelH;
const my = gy + (ROWS * (th + gap)) / 2;
const hw = tw * 1.6, hh = th * 1.6;

console.log('Canvas:', W, 'x', H);
console.log('gridW:', gridW, 'tw:', tw, 'th:', th);
console.log('P1 grid x:', p1x, 'to', (p1x + gridW).toFixed(1));
console.log('P2 grid x:', p2x.toFixed(1), 'to', (p2x + gridW).toFixed(1));
console.log('Centre strip x:', (p1x + gridW).toFixed(1), 'to', p2x.toFixed(1));
console.log('Grid tile area y:', gy, 'to', gy + ROWS * (th + gap));
console.log('Dragon/centre tile hit: x', (mx - hw / 2).toFixed(1), 'to', (mx + hw / 2).toFixed(1), ' y', (my - hh / 2).toFixed(1), 'to', (my + hh / 2).toFixed(1));
for (let c = 0; c < COLS; c++) {
  const x = p1x + c * (tw + gap);
  console.log(`P1 col ${c+1}: x ${x} to ${x + tw}`);
}
