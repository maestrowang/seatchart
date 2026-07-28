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

async function setupCustomStraightSeats(){
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(10, 'arc');
  `);
  await wait(20);
  const someIds = window.eval("chart.seats.filter(s=>s.row===0).sort((a,b)=>a.rowT-b.rowT).slice(3,6).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(someIds)})`);
  await wait(10);
  window.eval(`
    document.getElementById('batchStraightCheck').checked = true;
    document.getElementById('batchStraightCheck').dispatchEvent(new Event('change', {bubbles:true}));
  `);
  await wait(20);
  return someIds;
}

(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Test 1: SEAT SPACING now moves selected custom-straight seats ===');
  const someIds1 = await setupCustomStraightSeats();
  const before1 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds1)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  const allIds1 = window.eval("chart.seats.map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds1)})`);
  await wait(10);
  const slider1 = doc.getElementById('seatSpacing');
  slider1.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider1.value = 140;
  slider1.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after1 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds1)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  console.log('Before:', before1);
  console.log('After: ', after1);
  const moved1 = JSON.stringify(before1) !== JSON.stringify(after1);
  console.log('Custom-straight seats moved with seat spacing:', moved1);
  const stillCustom1 = window.eval(`${JSON.stringify(someIds1)}.every(id=>getSeat(id).layoutMode==='custom')`);
  console.log('Still marked custom (did not revert):', stillCustom1);
  // Confirm they're still collinear-ish (roughly a straight line), not back on the arc
  const stillStraightShape = window.eval(`${JSON.stringify(someIds1)}.every(id=>rowShapeOf(getSeat(id))==='straight')`);
  console.log('rowShapeOf still reports straight:', stillStraightShape);

  console.log('=== Test 2: ROW SPACING now shifts selected custom-straight seats ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(8, 'arc');
    addRow(10, 'arc');
  `);
  await wait(20);
  const someIds2 = window.eval("chart.seats.filter(s=>s.row===1).sort((a,b)=>a.rowT-b.rowT).slice(3,6).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(someIds2)})`);
  await wait(10);
  window.eval(`
    document.getElementById('batchStraightCheck').checked = true;
    document.getElementById('batchStraightCheck').dispatchEvent(new Event('change', {bubbles:true}));
  `);
  await wait(20);
  const before2 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds2)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  const allIds2 = window.eval("chart.seats.map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds2)})`);
  await wait(10);
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider2.value = 140;
  slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after2 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds2)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  console.log('Before:', before2);
  console.log('After: ', after2);
  const moved2 = JSON.stringify(before2) !== JSON.stringify(after2);
  console.log('Custom-straight seats moved with row spacing:', moved2);
  const stillCustom2 = window.eval(`${JSON.stringify(someIds2)}.every(id=>getSeat(id).layoutMode==='custom')`);
  console.log('Still marked custom (did not revert):', stillCustom2);

  console.log('=== Test 3: STAGE SPACING still shifts selected custom-straight seats (re-verify after refactor) ===');
  const someIds3 = await setupCustomStraightSeats();
  const before3 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds3)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  const allIds3 = window.eval("chart.seats.map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds3)})`);
  await wait(10);
  const slider3 = doc.getElementById('stageSpacingSlider');
  slider3.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider3.value = 140;
  slider3.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const after3 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds3)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  const moved3 = JSON.stringify(before3) !== JSON.stringify(after3);
  console.log('Custom-straight seats moved with stage spacing:', moved3);
  const stillCustom3 = window.eval(`${JSON.stringify(someIds3)}.every(id=>getSeat(id).layoutMode==='custom')`);
  console.log('Still marked custom (did not revert):', stillCustom3);

  const pass = moved1 && stillCustom1 && stillStraightShape && moved2 && stillCustom2 && moved3 && stillCustom3;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
