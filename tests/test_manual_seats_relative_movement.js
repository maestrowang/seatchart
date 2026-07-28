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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/row6_bug2.json', 'utf8'));

  async function reload(){
    window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
    await wait(50);
  }

  await reload();
  const timpaniId = window.eval("chart.seats.find(s=>s.preset==='Timpani').id");
  const nonTimpaniId = window.eval("chart.seats.find(s=>s.row===5 && s.preset!=='Timpani').id");
  const straightIds = window.eval("chart.seats.filter(s=>s.row===4||s.row===5).map(s=>s.id)");

  async function relativeOffsetCheck(sliderId, targetValue, label){
    await reload();
    window.eval(`setSelection(${JSON.stringify(straightIds)})`);
    await wait(10);
    const yBefore = window.eval(`getSeat('${timpaniId}').y`);
    const otherBefore = window.eval(`getSeat('${nonTimpaniId}').y`);
    const offsetBefore = yBefore - otherBefore;
    const slider = doc.getElementById(sliderId);
    slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
    await wait(10);
    slider.value = targetValue;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(20);
    const yAfter = window.eval(`getSeat('${timpaniId}').y`);
    const otherAfter = window.eval(`getSeat('${nonTimpaniId}').y`);
    const offsetAfter = yAfter - otherAfter;
    const preserved = Math.abs(offsetBefore - offsetAfter) < 8; // allows for the safety clamp's minor adjustment near a boundary, while still catching genuine bugs
    console.log(`${label}: offset before=${offsetBefore.toFixed(2)}, after=${offsetAfter.toFixed(2)}, preserved=${preserved}`);
    return preserved;
  }

  console.log("=== Test 1: SEAT SPACING preserves the manually-moved seat's relative offset ===");
  const pass1 = await relativeOffsetCheck('seatSpacing', 85, 'Seat spacing 76->85%');

  console.log("=== Test 2: ROW SPACING preserves the manually-moved seat's relative offset ===");
  const pass2 = await relativeOffsetCheck('rowSpacingSlider', 110, 'Row spacing 100->110%');

  console.log("=== Test 3: STAGE SPACING preserves the manually-moved seat's relative offset ===");
  const pass3 = await relativeOffsetCheck('stageSpacingSlider', 105, 'Stage spacing 100->105%');

  console.log('=== Test 4: with NO manual-offset seats selected, normal formula-based reshaping still works fully ===');
  await reload();
  const allRowIds = window.eval("chart.seats.filter(s=>s.row===0||s.row===1).map(s=>s.id)"); // arc rows, no manual offsets involved in THIS specific check
  window.eval(`setSelection(${JSON.stringify(allRowIds)})`);
  await wait(10);
  const beforeArc = window.eval("chart.seats.filter(s=>s.row===0).map(s=>({x:Math.round(s.x),y:Math.round(s.y)}))");
  const sliderD = doc.getElementById('seatSpacing');
  sliderD.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  sliderD.value = 130;
  sliderD.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterArc = window.eval("JSON.stringify(chart.seats.filter(s=>s.row===0).map(s=>({x:Math.round(s.x),y:Math.round(s.y)})))");
  const arcChanged = JSON.stringify(beforeArc) !== afterArc;
  console.log('Arc row still reshapes normally when selected:', arcChanged);

  const pass = pass1 && pass2 && pass3 && arcChanged;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
