// A roster shuffle stores indices into that section's names array, so the two
// only mean anything together. A saved chart can arrive with them disagreeing --
// hand-edited JSON, a file from an older build, or any future bug that mutates
// one without the other.
//
// getRosterAssignments skips an out-of-range index instead of throwing, so a
// mismatch never announces itself: the seat just renders blank, or a name lands
// on the wrong chair. applyLoadedChartData now drops any shuffle that does not
// match its roster, falling back to plain roster order.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
const dom = new JSDOM(html, {
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
const { window } = dom;
const wait = ms => new Promise(r=>setTimeout(r,ms));

// Builds a saved chart carrying a given roster + shuffle, loads it, and reports
// whether the shuffle survived and what the seats ended up showing.
async function loadWith(names, perm){
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.rosters={}; chart.rosterShuffle={};
    addRow(${Math.max(names.length, 1)}, 'straight');
    chart.seats.forEach(s=>{ s.preset='Violin 1'; });
  `);
  await wait(20);
  const saved = JSON.parse(window.eval('JSON.stringify(chart)'));
  saved.rosters = { 'Violin 1': names };
  saved.rosterShuffle = perm === null ? {} : { 'Violin 1': perm };
  window.eval(`applyLoadedChartData(${JSON.stringify(saved)}, 'test')`);
  await wait(30);
  const kept = window.eval("JSON.stringify(chart.rosterShuffle['Violin 1'] || null)");
  const shown = JSON.parse(window.eval(`
    (()=>{
      const ranks = computeAllSeatRanks();
      const a = getRosterAssignments();
      const seats = chart.seats.filter(s=>s.preset==='Violin 1' && !s.hidden);
      seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id));
      return JSON.stringify(seats.map(s=>a.get(s.id) === undefined ? null : a.get(s.id)));
    })()
  `));
  return { kept: kept === 'null' ? null : JSON.parse(kept), shown };
}

(async()=>{
  await wait(300);
  const NAMES4 = ['A','B','C','D'];
  const checks = [];

  console.log('=== Test 1: valid permutation is preserved untouched ===');
  const valid = await loadWith(NAMES4, [2,0,3,1]);
  console.log('  kept:', JSON.stringify(valid.kept), '| seats:', JSON.stringify(valid.shown));
  const t1 = JSON.stringify(valid.kept) === JSON.stringify([2,0,3,1])
    && JSON.stringify(valid.shown) === JSON.stringify(['C','A','D','B']);
  console.log('  valid shuffle survives and is applied:', t1);
  checks.push(t1);

  console.log('=== Test 2: permutation LONGER than the roster is dropped ===');
  // The pre-fix symptom: indices 4..7 point past the end, so those seats blank.
  const long = await loadWith(NAMES4, [5,0,6,1,7,2,4,3]);
  console.log('  kept:', JSON.stringify(long.kept), '| seats:', JSON.stringify(long.shown));
  const t2 = long.kept === null && JSON.stringify(long.shown) === JSON.stringify(NAMES4);
  console.log('  dropped, seats fall back to roster order:', t2);
  checks.push(t2);

  console.log('=== Test 3: permutation SHORTER than the roster is dropped ===');
  const short = await loadWith(NAMES4, [1,0]);
  console.log('  kept:', JSON.stringify(short.kept), '| seats:', JSON.stringify(short.shown));
  const t3 = short.kept === null && JSON.stringify(short.shown) === JSON.stringify(NAMES4);
  console.log('  dropped, seats fall back to roster order:', t3);
  checks.push(t3);

  console.log('=== Test 4: right length but a duplicated index is dropped ===');
  // Would otherwise show one player twice and silently lose another.
  const dup = await loadWith(NAMES4, [0,1,1,3]);
  console.log('  kept:', JSON.stringify(dup.kept), '| seats:', JSON.stringify(dup.shown));
  const t4 = dup.kept === null && JSON.stringify(dup.shown) === JSON.stringify(NAMES4);
  console.log('  dropped, no duplicate name on the chart:', t4);
  checks.push(t4);

  console.log('=== Test 5: out-of-range / non-integer entries are dropped ===');
  const junk = await loadWith(NAMES4, [0,1,-1,'x']);
  console.log('  kept:', JSON.stringify(junk.kept), '| seats:', JSON.stringify(junk.shown));
  const t5 = junk.kept === null && JSON.stringify(junk.shown) === JSON.stringify(NAMES4);
  console.log('  dropped:', t5);
  checks.push(t5);

  console.log('=== Test 6: shuffle for a section with no roster at all is dropped ===');
  const orphan = await loadWith([], [0,1,2]);
  console.log('  kept:', JSON.stringify(orphan.kept));
  const t6 = orphan.kept === null;
  console.log('  dropped:', t6);
  checks.push(t6);

  console.log('=== Test 7: empty permutation is dropped, so the panel is not stuck "shuffled" ===');
  // An empty array is truthy, so leaving it would disable drag-reordering and
  // show the shuffled note over a roster that was never shuffled.
  const empty = await loadWith(NAMES4, []);
  const noteHidden = window.eval(`
    (()=>{ refreshRosterSectionSelect();
      document.getElementById('rosterSectionSelect').value='Violin 1';
      renderRosterNameList();
      const rows=[...document.querySelectorAll('#rosterNameList .roster-name-row')];
      return JSON.stringify({ draggable: rows.length>0 && rows.every(r=>r.draggable===true) });
    })()
  `);
  console.log('  kept:', JSON.stringify(empty.kept), '| panel:', noteHidden);
  const t7 = empty.kept === null && JSON.parse(noteHidden).draggable === true;
  console.log('  dropped and rows remain drag-reorderable:', t7);
  checks.push(t7);

  const pass = checks.every(Boolean);
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
