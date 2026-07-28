// Regression: pasting a replacement roster must drop that section's shuffle.
//
// A shuffle is stored as a permutation of indices into the section's roster array
// (chart.rosterShuffle[key]). Replacing the array without clearing the permutation
// leaves stale indices pointing at data that no longer exists:
//
//   - same-length list -> the pasted order is silently scrambled onto seats
//   - shorter list     -> indices run past the end, getRosterAssignments skips
//                         those seats, and they render BLANK
//
// Drag-reorder is disabled while a section is shuffled (row.draggable = !isShuffled),
// so there was no in-panel way to correct it short of finding the Revert button.
//
// No pre-existing test combined shuffle with paste, which is why this survived.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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
        get(target, prop){
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='font'||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        }, set(){ return true; }
      });
    };
    window.HTMLCanvasElement.prototype.getBoundingClientRect = function(){
      return { left: 0, top: 0, width: this.width, height: this.height };
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

// Drives the real paste UI rather than assigning chart.rosters directly, so the
// button's onclick handler is what's under test.
function pasteViaUI(doc, window, section, lines){
  doc.getElementById('rosterSectionSelect').value = section;
  doc.getElementById('rosterPasteArea').value = lines.join('\n');
  doc.getElementById('rosterPasteApplyBtn').dispatchEvent(new window.Event('click'));
}

function assignmentsInRankOrder(window, section){
  return JSON.parse(window.eval(`
    (()=>{
      const ranks = computeAllSeatRanks();
      const a = getRosterAssignments();
      const seats = chart.seats.filter(s=>s.preset===${JSON.stringify(section)} && !s.hidden);
      seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id));
      return JSON.stringify(seats.map(s=>a.get(s.id) === undefined ? null : a.get(s.id)));
    })()
  `));
}

(async()=>{
  await wait(300);
  const doc = window.document;
  const SECTION = 'Violin 1';

  console.log('=== Set up: 8-seat section, roster P1..P8, then shuffle it ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(8, 'straight');
    chart.seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
    chart.rosters['Violin 1'] = ['P1','P2','P3','P4','P5','P6','P7','P8'];
  `);
  await wait(20);
  refreshSelect(doc, window);
  window.eval("shuffleRosterSection('Violin 1', false)");
  await wait(10);

  const shuffledBefore = window.eval("JSON.stringify(chart.rosterShuffle['Violin 1'] || null)");
  console.log('Shuffle permutation present before paste:', shuffledBefore);
  const wasShuffled = shuffledBefore !== 'null';

  console.log('=== Test 1: pasting a SHORTER list (4 names) must not blank out seats ===');
  pasteViaUI(doc, window, SECTION, ['N1','N2','N3','N4']);
  await wait(20);

  const permAfterShort = window.eval("JSON.stringify(chart.rosterShuffle['Violin 1'] || null)");
  const permClearedShort = permAfterShort === 'null';
  console.log('Shuffle permutation after paste:', permAfterShort);
  console.log('Permutation cleared:', permClearedShort);

  const shortAssign = assignmentsInRankOrder(window, SECTION);
  console.log('Assignments (rank order):', JSON.stringify(shortAssign));
  // First four ranks get the pasted names in the order typed; the remaining four
  // seats legitimately have no name (roster shorter than the section).
  const firstFourInOrder = JSON.stringify(shortAssign.slice(0,4)) === JSON.stringify(['N1','N2','N3','N4']);
  const restUnassigned = shortAssign.slice(4).every(v => v === null);
  // The pre-fix symptom: a stale index >= names.length silently skipped the seat,
  // so a name the user just typed appeared nowhere on the chart.
  const noPastedNameLost = ['N1','N2','N3','N4'].every(n => shortAssign.includes(n));
  console.log('First four seats show pasted names in typed order:', firstFourInOrder);
  console.log('Remaining seats correctly unassigned:', restUnassigned);
  console.log('No pasted name silently dropped:', noPastedNameLost);

  console.log('=== Test 2: rows are drag-reorderable again after paste ===');
  window.eval('renderRosterNameList()');
  await wait(20);
  const rows = [...doc.querySelectorAll('#rosterNameList .roster-name-row')];
  const allDraggable = rows.length > 0 && rows.every(r => r.draggable === true);
  console.log('Roster rows rendered:', rows.length, '| all draggable:', allDraggable);

  console.log('=== Test 3: shuffle again, then paste a SAME-LENGTH list -> typed order preserved ===');
  window.eval(`chart.rosters['Violin 1'] = ['P1','P2','P3','P4','P5','P6','P7','P8'];`);
  window.eval("shuffleRosterSection('Violin 1', false)");
  await wait(10);
  const reshuffled = window.eval("JSON.stringify(chart.rosterShuffle['Violin 1'] || null)") !== 'null';
  console.log('Re-shuffled before second paste:', reshuffled);

  pasteViaUI(doc, window, SECTION, ['A','B','C','D','E','F','G','H']);
  await wait(20);
  const sameLenAssign = assignmentsInRankOrder(window, SECTION);
  console.log('Assignments (rank order):', JSON.stringify(sameLenAssign));
  // The whole point: what you typed is what lands on the seats, top rank first.
  const typedOrderPreserved = JSON.stringify(sameLenAssign) === JSON.stringify(['A','B','C','D','E','F','G','H']);
  console.log('Pasted order preserved exactly (not scrambled):', typedOrderPreserved);

  console.log('=== Test 4: the paste remains undoable (pushHistory still fires) ===');
  const beforeUndo = window.eval("JSON.stringify(chart.rosters['Violin 1'])");
  window.eval('undo()');
  await wait(20);
  const afterUndo = window.eval("JSON.stringify(chart.rosters['Violin 1'])");
  const undoRestored = afterUndo !== beforeUndo;
  console.log('Roster before undo:', beforeUndo);
  console.log('Roster after undo: ', afterUndo);
  console.log('Undo restored the previous roster state:', undoRestored);

  const pass = wasShuffled && permClearedShort && firstFourInOrder && restUnassigned &&
               noPastedNameLost && allDraggable && reshuffled && typedOrderPreserved && undoRestored;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });

// The section dropdown must be populated before its .value can be set.
function refreshSelect(doc, window){
  try { window.eval('refreshRosterSectionSelect()'); } catch(e){ /* panel may not be open; harmless */ }
}
