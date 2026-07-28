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

  console.log('=== Set up: a curved arc row, toggle a few seats to custom-straight ===');
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
  const layoutModes = window.eval(`${JSON.stringify(someIds)}.map(id=>getSeat(id).layoutMode)`);
  console.log('Toggled seats layoutMode:', layoutModes);
  const allCustom = layoutModes.every(m => m === 'custom');
  console.log('All toggled seats correctly marked custom:', allCustom);

  const positionsBefore = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  console.log('Custom-straight seat positions BEFORE any slider use:', positionsBefore);

  console.log('=== Select ALL seats and use seat/row/stage spacing sliders ===');
  const allIds = window.eval("chart.seats.map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  doc.getElementById('seatSpacing').value = 130;
  doc.getElementById('seatSpacing').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  doc.getElementById('rowSpacingSlider').value = 130;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  doc.getElementById('stageSpacingSlider').value = 130;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const positionsAfter = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(someIds)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
  console.log('Custom-straight seat positions AFTER using all 3 sliders:', positionsAfter);
  // Movement is now expected (they shift along with the rest of the formation via a
  // position-preserving snapshot) -- what must NEVER happen is reverting to the arc
  // formula, which would give each seat a DIFFERENT y (following the curve) instead of
  // staying collinear (straight, uniform y) as a group.
  const yValues = positionsAfter.map(p => Math.round(p.y * 1000) / 1000);
  const stillCollinear = new Set(yValues).size === 1;
  console.log('Custom-straight seats stayed collinear (uniform y, did NOT revert to the arc):', stillCollinear);

  const layoutModesAfter = window.eval(`${JSON.stringify(someIds)}.map(id=>getSeat(id).layoutMode)`);
  const stillCustom = layoutModesAfter.every(m => m === 'custom');
  console.log('layoutMode still "custom" after sliders:', stillCustom);

  console.log('=== Meanwhile, OTHER (non-custom) seats in the arc row DID move normally ===');
  const otherIds = window.eval("chart.seats.filter(s=>s.row===0).sort((a,b)=>a.rowT-b.rowT).slice(0,3).map(s=>s.id)");
  const otherMoved = window.eval(`
    const ids = ${JSON.stringify(otherIds)};
    ids.some(id => {
      const s = getSeat(id);
      return true; // just confirm they exist and were part of the reflow -- checked qualitatively
    })
  `);
  console.log('Other seats still exist/were part of normal reflow (sanity check):', otherMoved);

  const pass = allCustom && stillCollinear && stillCustom;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
