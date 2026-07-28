const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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

  console.log('=== Test 1a: with seats but NO instruments, row-based sections show (not empty state) ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const rowSectionsShowing = doc.getElementById('rosterSectionContent').style.display === 'block';
  const emptyHiddenWithSeats = doc.getElementById('rosterNoSections').style.display === 'none';
  console.log('Row-based sections shown for unassigned seats:', rowSectionsShowing && emptyHiddenWithSeats);

  console.log('=== Test 1b: with genuinely ZERO seats, empty state correctly shows ===');
  window.eval(`chart.seats = [];`);
  window.eval('refreshRosterSectionSelect()');
  await wait(10);
  const noSectionsVisible = doc.getElementById('rosterNoSections').style.display === 'block';
  const contentHidden = doc.getElementById('rosterSectionContent').style.display === 'none';
  console.log('Empty state shown when there are truly no seats at all:', noSectionsVisible && contentHidden);

  console.log('=== Set up two independent sections ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(3, 'straight');
    addRow(3, 'straight');
    chart.seats.filter(s=>s.row===0).forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
    chart.seats.filter(s=>s.row===1).forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; });
    chart.rosters['Violin 1'] = ['V1','V2','V3'];
    chart.rosters['Cello'] = ['C1','C2','C3'];
  `);
  window.eval('refreshRosterSectionSelect()');
  await wait(20);

  console.log('=== Test 2: sections have independent name lists (no bleed) ===');
  doc.getElementById('rosterSectionSelect').value = 'Violin 1';
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(10);
  const violinNames = Array.from(doc.querySelectorAll('.roster-name-text')).map(e=>e.textContent);
  console.log('Violin 1 shows its own names:', JSON.stringify(violinNames));

  doc.getElementById('rosterSectionSelect').value = 'Cello';
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(10);
  const celloNames = Array.from(doc.querySelectorAll('.roster-name-text')).map(e=>e.textContent);
  console.log('Cello shows its own (different) names:', JSON.stringify(celloNames));
  const noBleed = JSON.stringify(violinNames)===JSON.stringify(['V1','V2','V3']) && JSON.stringify(celloNames)===JSON.stringify(['C1','C2','C3']);
  console.log('No cross-contamination between sections:', noBleed);

  console.log('=== Test 3: actual DOM drag events (dragstart/dragover/drop) reorder correctly ===');
  doc.getElementById('rosterSectionSelect').value = 'Violin 1';
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(10);
  const rowEls = Array.from(doc.querySelectorAll('.roster-name-row'));
  console.log('Row count for drag test:', rowEls.length);
  // Drag row 0 (V1) onto row 2 (V3)
  rowEls[0].dispatchEvent(new window.Event('dragstart', {bubbles:true}));
  rowEls[2].dispatchEvent(new window.Event('dragover', {bubbles:true, cancelable:true}));
  rowEls[2].dispatchEvent(new window.Event('drop', {bubbles:true, cancelable:true}));
  await wait(20);
  const orderAfterDrag = window.eval("chart.rosters['Violin 1'].join(',')");
  console.log('Violin 1 order after real drag events:', orderAfterDrag);
  const dragWorked = orderAfterDrag === 'V2,V3,V1';
  console.log('Drag correctly moved V1 to the end:', dragWorked);

  console.log('=== Test 4: save/load round-trip preserves rosters ===');
  const savedJson = window.eval('JSON.stringify(chart)');
  const reloaded = JSON.parse(savedJson);
  window.eval(`applyLoadedChartData(${JSON.stringify(reloaded)}, 'test')`);
  await wait(20);
  const rostersAfterLoad = window.eval("JSON.stringify(chart.rosters)");
  console.log('Rosters after save/load round-trip:', rostersAfterLoad);
  const rosterPersisted = JSON.parse(rostersAfterLoad)['Cello'].length === 3;
  console.log('Rosters correctly persisted:', rosterPersisted);

  console.log('=== Test 5: old file without rosters field migrates safely ===');
  const oldFile = { title:'Old', seats:[], rowIndex:0 };
  window.eval(`applyLoadedChartData(${JSON.stringify(oldFile)}, 'old')`);
  await wait(20);
  const migratedOk = window.eval("typeof chart.rosters === 'object' && !Array.isArray(chart.rosters)");
  console.log('Old file migrates rosters to {}:', migratedOk);

  const pass = rowSectionsShowing && emptyHiddenWithSeats && noSectionsVisible && contentHidden && noBleed && dragWorked && rosterPersisted && migratedOk;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
