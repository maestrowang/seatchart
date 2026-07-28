// Regression: row spacing must move every row, including the last one.
//
// Banding groups seats by RADIUS, then merges groups that look like the same
// row. That merge used to fall back to comparing median DEPTH:
//
//   if(shares || Math.abs(medDepth(a) - medDepth(b)) < 16)
//
// Depth is the wrong frame for a curve, which is exactly why the banding above
// it is radius-based. Concentric arcs nest -- an outer row's end seats sit
// beside the row in front rather than behind it -- so a short back row can
// share a median depth with the front row while sitting hundreds of px further
// out in radius. The two then merged into one band.
//
// That was fatal when the absorbed partner was row 0, which is the anchor and
// never moves: the whole band inherited the anchor and froze. Measured on the
// shipped templates before the fix:
//
//   String_Orchestra   4 rows -> 2 bands, band 0 = rows 0+3, last row delta 0.0
//   Chamber_Orchestra  2 rows -> 1 band,  band 0 = rows 0+1, nothing moved
//
// Proximity merging now requires one side to have no chart row of its own (a
// freeform chair being adopted) and compares radius rather than depth.
//
// This test drives the real templates, since the bug only appeared on charts
// with that nesting geometry -- a synthetic evenly-spaced chart never hit it.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: () => ({ width: 20 }), clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
  bezierCurveTo: noop, quadraticCurveTo: noop,
  getImageData(x,y,w,h){ return { data: new Uint8ClampedArray(w*h*4).fill(128), width:w, height:h }; },
  putImageData: noop,
};
function makeDom(){
  return new JSDOM(html, {
    url: 'https://example.github.io/seating-chart/',
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window){
      window.HTMLCanvasElement.prototype.getContext = function(){
        return new Proxy(fakeCtxProto, {
          get(t,p){ if(p in t) return t[p];
            if(typeof p==='string' && (p.endsWith('Style')||p==='font'||p==='lineWidth'||p==='lineCap'||p==='globalAlpha'||p==='textAlign'||p==='textBaseline')) return '';
            return noop; }, set(){ return true; }
        });
      };
      window.HTMLCanvasElement.prototype.getBoundingClientRect = function(){
        return { left:0, top:0, width:this.width, height:this.height };
      };
    }
  });
}
const wait = ms => new Promise(r=>setTimeout(r,ms));

// Mean distance from the podium, per row. Radius is the coordinate row spacing
// actually scales, so it is what to assert on -- y-order is not meaningful for
// nested arcs.
const MEANS = `(()=>{
  const p = podiumPoint();
  const byRow = {};
  chart.seats.forEach(s=>{
    if(s.hidden || s.row === undefined || s.row === null || s.row < 0) return;
    (byRow[s.row] = byRow[s.row] || []).push(Math.hypot(s.x-p.x, s.y-p.y));
  });
  const out = {};
  Object.keys(byRow).forEach(r=>{ out[r] = byRow[r].reduce((a,b)=>a+b,0)/byRow[r].length; });
  return JSON.stringify(out);
})()`;

const BANDS = `(()=>{
  const anchorY = podiumAnchorY(); const centerX = canvas.width/2;
  const seats = [...effectiveSpacingSelection()].map(id=>getSeat(id)).filter(s=>s && !s.hidden);
  const points = seats.map(s=>({ id:s.id, depth: anchorY - s.y, lateral: s.x - centerX }));
  return JSON.stringify(groupIntoBands(points, seats).map(g=>{
    const rows = new Set();
    g.forEach(p=>{ const o=getSeat(p.id); if(o && o.row >= 0) rows.add(o.row); });
    return [...rows].sort((a,b)=>a-b);
  }));
})()`;

(async () => {
  let allOk = true;
  const results = [];

  // Every shipped template, so a future geometry change cannot quietly
  // reintroduce this on one of them.
  const templates = fs.readdirSync(path.join(REPO,'templates'))
    .filter(f=>f.endsWith('.seatchart.json')).sort();

  for (const file of templates) {
    const name = file.replace('.seatchart.json','');
    const data = JSON.parse(fs.readFileSync(path.join(REPO,'templates',file),'utf8'));
    const dom = makeDom(); const { window } = dom; const doc = window.document;
    await wait(300);
    window.eval(`applyLoadedChartData(${JSON.stringify(data)}, 'test')`);
    await wait(60);
    window.eval('clearSelection()');
    await wait(20);

    const before = JSON.parse(window.eval(MEANS));
    const bands = JSON.parse(window.eval(BANDS));
    const slider = doc.getElementById('rowSpacingSlider');
    slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
    await wait(10);
    slider.value = 140;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(40);
    slider.dispatchEvent(new window.Event('change', {bubbles:true}));
    await wait(20);
    const after = JSON.parse(window.eval(MEANS));

    const rows = Object.keys(before).map(Number).sort((a,b)=>a-b);
    const last = rows[rows.length-1];
    const lastDelta = after[last] - before[last];

    // No band may contain row 0 alongside a different row. Row 0 is the anchor,
    // so anything sharing its band is frozen with it.
    const anchorWelded = bands.find(b => b.includes(0) && b.length > 1);

    // The back row travels furthest, so if anything moves it must. A tiny
    // threshold keeps this honest without asserting an exact distance: the fit
    // legitimately backs the ratio off by different amounts per chart.
    const movedEnough = lastDelta > 1;
    const ok = movedEnough && !anchorWelded;
    if(!ok) allOk = false;

    results.push({ name, last, lastDelta, anchorWelded, ok });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(26)} last row ${last}: ` +
      `${before[last].toFixed(1)} -> ${after[last].toFixed(1)} (delta ${lastDelta.toFixed(1)})` +
      (anchorWelded ? `  <== row 0 welded to rows ${anchorWelded.filter(r=>r!==0).join(',')}` : ''));
    dom.window.close();
  }

  console.log('\n=== Every template moved its last row:', results.every(r=>r.movedEnough !== false && r.ok));

  // Named guards for the two templates that actually regressed, so a failure
  // report points at the reproduction rather than a generic sweep.
  const stringOrch = results.find(r=>r.name==='String_Orchestra');
  const chamber    = results.find(r=>r.name==='Chamber_Orchestra');
  console.log('String_Orchestra last row moves (was 0.0):', stringOrch && stringOrch.lastDelta.toFixed(1));
  console.log('Chamber_Orchestra last row moves (was 0.0):', chamber && chamber.lastDelta.toFixed(1));
  const namedOk = stringOrch && chamber && stringOrch.lastDelta > 1 && chamber.lastDelta > 1;

  console.log((allOk && namedOk) ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
