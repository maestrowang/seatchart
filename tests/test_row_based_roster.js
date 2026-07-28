const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 8 }),
  clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
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
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up: a chart with NO instruments assigned at all, 2 rows ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    addRow(3, 'straight');
  `);
  await wait(20);

  console.log('=== Test 1: seats without instruments still get natural ranks within their row ===');
  const row0Ranks = JSON.parse(window.eval(`
    const ranks = computeAllSeatRanks();
    const seats = chart.seats.filter(s=>s.row===0).sort((a,b)=>a.x-b.x);
    JSON.stringify(seats.map(s=>ranks.get(s.id)))
  `));
  console.log('Row 0 ranks (should be 1,2,3,4 in left-to-right order):', row0Ranks);
  const row0Correct = JSON.stringify(row0Ranks) === JSON.stringify([1,2,3,4]);
  console.log('Row 0 naturally ranked left-to-right:', row0Correct);

  console.log('=== Test 2: row 1 (different row) has its OWN independent rank sequence ===');
  const row1Ranks = JSON.parse(window.eval(`
    const ranks = computeAllSeatRanks();
    const seats = chart.seats.filter(s=>s.row===1).sort((a,b)=>a.x-b.x);
    JSON.stringify(seats.map(s=>ranks.get(s.id)))
  `));
  console.log('Row 1 ranks:', row1Ranks);
  const row1Correct = JSON.stringify(row1Ranks) === JSON.stringify([1,2,3]);
  console.log('Row 1 independently ranked 1-3:', row1Correct);

  console.log('=== Test 3: roster panel lists row-based sections with friendly names ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const options = Array.from(doc.getElementById('rosterSectionSelect').options).map(o=>({value:o.value, text:o.textContent}));
  console.log('Section options:', JSON.stringify(options));
  const hasRow1Option = options.some(o=>o.text === 'Row 1 (no instrument)');
  const hasRow2Option = options.some(o=>o.text === 'Row 2 (no instrument)');
  console.log('Row 1 option present with friendly name:', hasRow1Option);
  console.log('Row 2 option present with friendly name:', hasRow2Option);

  console.log('=== Test 4: pasting names into a row-based section assigns them correctly ===');
  const row0Key = options.find(o=>o.text==='Row 1 (no instrument)').value;
  doc.getElementById('rosterSectionSelect').value = row0Key;
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(10);
  doc.getElementById('rosterEditListBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(10);
  doc.getElementById('rosterPasteArea').value = 'Alice\nBob\nCarol\nDave';
  doc.getElementById('rosterPasteApplyBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const assignments = JSON.parse(window.eval(`
    const a = getRosterAssignments();
    const seats = chart.seats.filter(s=>s.row===0).sort((a,b)=>a.x-b.x);
    JSON.stringify(seats.map(s=>a.get(s.id)))
  `));
  console.log('Names assigned to row 0 (left to right):', assignments);
  const namesCorrect = JSON.stringify(assignments) === JSON.stringify(['Alice','Bob','Carol','Dave']);
  console.log('Names correctly assigned in natural left-to-right order:', namesCorrect);

  console.log('=== Test 5: instrument-based sections still work normally alongside row-based ones ===');
  window.eval(`
    chart.seats.filter(s=>s.row===1).forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; });
  `);
  await wait(10);
  window.eval('refreshRosterSectionSelect()');
  await wait(10);
  const optionsAfter = Array.from(doc.getElementById('rosterSectionSelect').options).map(o=>o.textContent);
  console.log('Options after assigning Cello to row 1:', optionsAfter);
  const hasCello = optionsAfter.includes('Cello');
  const row1GoneAsUnassigned = !optionsAfter.includes('Row 2 (no instrument)');
  console.log('Cello now listed as a real section:', hasCello);
  console.log('Row 2 (no longer unassigned) removed from row-based list:', row1GoneAsUnassigned);
  const row0StillThere = optionsAfter.includes('Row 1 (no instrument)');
  console.log('Row 1 (still unassigned) still listed:', row0StillThere);

  console.log('=== Test 6: chip renders for unassigned seats with the default neutral color ===');
  const rendered = window.eval(`
    const a = getRosterAssignments();
    const seats = chart.seats.filter(s=>s.row===0);
    seats.some(s=>a.has(s.id))
  `);
  console.log('Unassigned seats have roster assignments to render:', rendered);

  const pass = row0Correct && row1Correct && hasRow1Option && hasRow2Option && namesCorrect &&
               hasCello && row1GoneAsUnassigned && row0StillThere && rendered;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
