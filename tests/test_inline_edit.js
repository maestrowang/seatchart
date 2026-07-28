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
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up: a plain seat (no name, no preset) and a named seat ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(3, 'straight');
    const seats = chart.seats.filter(s=>s.row===0);
    seats[1].preset='Violin 1'; seats[1].color='#3EA6CC'; seats[1].label='Vln1';
    seats[2].preset='Violin 1'; seats[2].color='#3EA6CC'; seats[2].label='Vln1';
    chart.rosters['Violin 1'] = ['Alice Chen'];
    chart.showLabels = true; chart.showRosterNames = true;
  `);
  await wait(20);

  console.log('=== Test 1: double-click a plain-label seat (no name) opens a label editor ===');
  const plainSeatId = window.eval("chart.seats.filter(s=>s.row===0).sort((a,b)=>a.x-b.x)[0].id");
  const plainSeat = window.eval(`getSeat('${plainSeatId}')`);
  const canvasEl = doc.getElementById('chart');
  const flippedPos = window.eval(`flipPoint(getSeat('${plainSeatId}').x, getSeat('${plainSeatId}').y)`);
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: flippedPos.x, clientY: flippedPos.y }));
  await wait(20);
  const editor1 = doc.querySelector('.inline-seat-editor');
  console.log('Editor appeared:', !!editor1);
  console.log('Editor pre-filled with current label:', editor1 && editor1.value === window.eval(`getSeat('${plainSeatId}').label`));

  console.log('=== Test 2: typing + Enter commits the label edit ===');
  editor1.value = 'MyCustomLabel';
  editor1.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(20);
  const newLabel = window.eval(`getSeat('${plainSeatId}').label`);
  console.log('Label committed:', newLabel === 'MyCustomLabel');
  console.log('Editor removed after commit:', !doc.querySelector('.inline-seat-editor'));

  console.log('=== Test 3: double-click the NAMED seat (with a chip) edits the roster NAME ===');
  const namedSeatId = window.eval("chart.seats.filter(s=>s.preset==='Violin 1').sort((a,b)=>a.x-b.x)[0].id");
  const namedFlipped = window.eval(`flipPoint(getSeat('${namedSeatId}').x, getSeat('${namedSeatId}').y)`);
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: namedFlipped.x, clientY: namedFlipped.y }));
  await wait(20);
  const editor2 = doc.querySelector('.inline-seat-editor');
  console.log('Editor appeared for named seat:', !!editor2);
  const prefilledCorrectly = editor2 && editor2.value === 'Alice Chen';
  console.log('Pre-filled with current roster name:', prefilledCorrectly);

  console.log('=== Test 4: editing the name commits back to chart.rosters and updates the panel ===');
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  editor2.value = 'Alicia Chenault';
  editor2.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(20);
  const rosterAfterEdit = window.eval("chart.rosters['Violin 1'][0]");
  console.log('Roster array updated:', rosterAfterEdit === 'Alicia Chenault');
  const panelText = Array.from(doc.querySelectorAll('.roster-name-text')).map(e=>e.textContent);
  console.log('Roster panel list reflects the edit:', panelText.includes('Alicia Chenault'));

  console.log('=== Test 5: Escape cancels without saving ===');
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: namedFlipped.x, clientY: namedFlipped.y }));
  await wait(20);
  const editor3 = doc.querySelector('.inline-seat-editor');
  editor3.value = 'Should Not Save';
  editor3.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(20);
  const rosterAfterCancel = window.eval("chart.rosters['Violin 1'][0]");
  console.log('Roster unchanged after Escape:', rosterAfterCancel === 'Alicia Chenault');
  console.log('Editor removed after Escape:', !doc.querySelector('.inline-seat-editor'));

  console.log('=== Test 6: sidebar Label input reflects an edit if that seat is selected ===');
  window.eval(`selectSeat(getSeat('${plainSeatId}'))`);
  await wait(10);
  const flippedPos2 = window.eval(`flipPoint(getSeat('${plainSeatId}').x, getSeat('${plainSeatId}').y)`);
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: flippedPos2.x, clientY: flippedPos2.y }));
  await wait(20);
  const editor4 = doc.querySelector('.inline-seat-editor');
  editor4.value = 'SidebarSyncTest';
  editor4.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(20);
  console.log('Sidebar label input updated:', doc.getElementById('labelInput').value === 'SidebarSyncTest');

  const pass = !!editor1 && newLabel==='MyCustomLabel' && !!editor2 && prefilledCorrectly &&
               rosterAfterEdit==='Alicia Chenault' && panelText.includes('Alicia Chenault') &&
               rosterAfterCancel==='Alicia Chenault' && doc.getElementById('labelInput').value==='SidebarSyncTest';
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
