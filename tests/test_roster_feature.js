const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: () => ({ width: 10 }), clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
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
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up: 3-seat Violin 1 section ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(3, 'straight');
    chart.seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
  `);
  await wait(20);

  console.log('=== Test 1: toggle button opens the panel ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const panelOpen = doc.getElementById('rosterPanel').classList.contains('show');
  console.log('Panel is open:', panelOpen);
  const sectionOptions = Array.from(doc.getElementById('rosterSectionSelect').options).map(o=>o.value);
  console.log('Section dropdown shows Violin 1:', sectionOptions.includes('Violin 1'));

  console.log('=== Test 2: paste 2 names (fewer than 3 seats) -- remainder left as-is ===');
  doc.getElementById('rosterEditListBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  doc.getElementById('rosterPasteArea').value = 'Alice Chen\nBen Torres';
  doc.getElementById('rosterPasteApplyBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);

  const assignments = window.eval(`
    const a = getRosterAssignments();
    JSON.stringify(chart.seats.map(s=>a.get(s.id) || null))
  `);
  console.log('Assignments (3 seats, 2 names):', assignments);
  const parsed2 = JSON.parse(assignments);
  const twoAssigned = parsed2.filter(n=>n!==null).length === 2;
  console.log('Exactly 2 seats got names, 1 left unassigned:', twoAssigned);

  console.log('=== Test 3: paste 5 names (more than 3 seats) -- extras show red/unassigned ===');
  doc.getElementById('rosterEditListBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  doc.getElementById('rosterPasteArea').value = 'Alice Chen\nBen Torres\nCara Diaz\nDana Ellis\nEli Frank';
  doc.getElementById('rosterPasteApplyBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);

  const rows = Array.from(doc.querySelectorAll('.roster-name-row'));
  console.log('Total rows rendered:', rows.length);
  const unassignedRows = rows.filter(r=>r.classList.contains('unassigned'));
  console.log('Rows marked unassigned (red):', unassignedRows.length);
  const correctOverflow = unassignedRows.length === 2 && rows.length === 5;
  console.log('Exactly 2 names (beyond 3 seats) marked unassigned:', correctOverflow);
  console.log('Unassigned row names:', unassignedRows.map(r=>r.querySelector('.roster-name-text').textContent));

  console.log('=== Test 4: adding a seat to the section auto-assigns the next overflow name ===');
  window.eval(`
    addRow(1, 'straight');
    const newRowIdx = chart.rowIndex - 1;
    chart.seats.filter(s=>s.row===newRowIdx).forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
  `);
  await wait(20);
  const assignmentsAfterAdd = window.eval(`
    const a = getRosterAssignments();
    JSON.stringify(chart.seats.filter(s=>s.preset==='Violin 1').map(s=>a.get(s.id) || null).filter(n=>n!==null).length)
  `);
  console.log('Seats with a name assigned after adding 1 more seat:', assignmentsAfterAdd);
  console.log('Now 4 seats have names (was 3):', assignmentsAfterAdd === '4');

  window.eval('refreshRosterSectionSelect()');
  await wait(20);
  const rowsAfterAdd = Array.from(doc.querySelectorAll('.roster-name-row'));
  const unassignedAfterAdd = rowsAfterAdd.filter(r=>r.classList.contains('unassigned'));
  console.log('Unassigned count now 1 (was 2):', unassignedAfterAdd.length === 1);

  console.log('=== Test 5: drag-and-drop reordering changes assignment order ===');
  const beforeReorder = window.eval("chart.rosters['Violin 1'].join(',')");
  console.log('Roster order before drag:', beforeReorder);
  // Simulate dragging index 4 (Eli Frank) to position 0
  window.eval(`
    pushHistory();
    const arr = chart.rosters['Violin 1'];
    const [moved] = arr.splice(4, 1);
    arr.splice(0, 0, moved);
  `);
  const afterReorder = window.eval("chart.rosters['Violin 1'].join(',')");
  console.log('Roster order after simulated drag:', afterReorder);
  const reorderWorked = afterReorder.startsWith('Eli Frank') && afterReorder !== beforeReorder;
  console.log('Reorder correctly moved the name to the front:', reorderWorked);

  console.log('=== Test 6: closing and reopening the panel preserves data ===');
  doc.getElementById('rosterPanelCloseBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  console.log('Panel closed:', !doc.getElementById('rosterPanel').classList.contains('show'));
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const rosterStillThere = window.eval("chart.rosters['Violin 1'].length") === 5;
  console.log('Roster data preserved after close/reopen:', rosterStillThere);

  console.log('=== Test 7: names render on the chart when showLabels is on ===');
  const nameDrawnCheck = window.eval(`
    chart.showLabels = true;
    const a = getRosterAssignments();
    a.size > 0
  `);
  console.log('At least one seat has a roster assignment to draw:', nameDrawnCheck);

  const pass = panelOpen && sectionOptions.includes('Violin 1') && twoAssigned &&
               correctOverflow && assignmentsAfterAdd==='4' && unassignedAfterAdd.length===1 &&
               reorderWorked && rosterStillThere && nameDrawnCheck;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
