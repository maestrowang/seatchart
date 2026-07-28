const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
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
  const canvasEl = doc.getElementById('chart');

  console.log('=== Set up: a seat with BOTH a roster name (chip) and an instrument label below ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; s.label='Vc'; });
    chart.rosters['Cello'] = ['First Person'];
    chart.showLabels = true; chart.showRosterNames = true;
  `);
  await wait(20);

  const seatId = window.eval(`
    const ranks = computeAllSeatRanks();
    chart.seats.find(s=>ranks.get(s.id)===1).id
  `);
  const sr = window.eval('seatRadius()');

  console.log('=== Test 1: double-click on the CHIP position targets the NAME ===');
  const chipLogicalY = window.eval(`getSeat('${seatId}').y + 1`); // roughly the chip's center
  const chipScreen = window.eval(`flipPoint(getSeat('${seatId}').x, ${chipLogicalY})`);
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: chipScreen.x, clientY: chipScreen.y }));
  await wait(20);
  const editorChip = doc.querySelector('.inline-seat-editor');
  console.log('Editor value (should be the roster name):', editorChip.value);
  const targetedName = editorChip.value === 'First Person';
  console.log('Correctly targeted the NAME:', targetedName);
  editorChip.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);

  console.log('=== Test 2: double-click BELOW (where the demoted label sits) targets the LABEL ===');
  const belowLogicalY = window.eval(`getSeat('${seatId}').y + seatRadius()*0.62 + 5`);
  const belowScreen = window.eval(`flipPoint(getSeat('${seatId}').x, ${belowLogicalY})`);
  canvasEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles:true, clientX: belowScreen.x, clientY: belowScreen.y }));
  await wait(20);
  const editorBelow = doc.querySelector('.inline-seat-editor');
  console.log('Editor value (should be the instrument label):', editorBelow.value);
  const targetedLabel = editorBelow.value === 'Vc';
  console.log('Correctly targeted the LABEL:', targetedLabel);
  editorBelow.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);

  console.log('=== Test 3: jump-ahead name edit (seat 4, no existing roster entries for it) pads correctly ===');
  const seat4Id = window.eval(`
    const ranks = computeAllSeatRanks();
    chart.seats.find(s=>ranks.get(s.id)===4).id
  `);
  window.eval(`selectSeat(getSeat('${seat4Id}'))`); // not required but harmless
  // seat4 currently has NO roster name (only 1 name exists for 4 seats) -- determineTextEditTarget
  // would return 'label' for it since there's no chip showing. Let's directly test applyRosterNameEdit
  // for the padding behavior, simulating a "power user" scenario via direct call.
  window.eval(`applyRosterNameEdit(getSeat('${seat4Id}'), 'Fourth Person')`);
  await wait(10);
  const rosterArr = window.eval("JSON.stringify(chart.rosters['Cello'])");
  console.log('Roster array after jump-ahead edit:', rosterArr);
  const padded = JSON.parse(rosterArr);
  const paddingCorrect = padded.length === 4 && padded[0]==='First Person' && padded[1]==='' && padded[2]==='' && padded[3]==='Fourth Person';
  console.log('Padding correct (empty placeholders for skipped ranks):', paddingCorrect);

  console.log('=== Test 4: empty placeholders are treated as "no name" in assignments ===');
  const assignmentsCheck = window.eval(`
    const a = getRosterAssignments();
    const ranks = computeAllSeatRanks();
    const seats = chart.seats.slice().sort((x,y)=>ranks.get(x.id)-ranks.get(y.id));
    JSON.stringify(seats.map(s=>a.get(s.id) || null))
  `);
  console.log('Assignments in rank order (1,2,3,4):', assignmentsCheck);
  const emptyTreatedAsNoName = assignmentsCheck === '["First Person",null,null,"Fourth Person"]';
  console.log('Empty placeholders correctly show as unassigned:', emptyTreatedAsNoName);

  const pass = targetedName && targetedLabel && paddingCorrect && emptyTreatedAsNoName;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
