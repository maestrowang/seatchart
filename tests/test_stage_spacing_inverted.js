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

  console.log('=== Test 1: p=100 anchor unchanged from before (574 for default canvas) ===');
  const anchor100 = window.eval('anchorYForStageSpacing(100)');
  console.log('anchorYForStageSpacing(100):', anchor100);

  console.log('=== Test 2: direction is inverted -- increasing % decreases anchorY (moves up) ===');
  const anchor60 = window.eval('anchorYForStageSpacing(60)');
  const anchor160 = window.eval('anchorYForStageSpacing(160)');
  console.log('anchor(60):', anchor60, '| anchor(100):', anchor100, '| anchor(160):', anchor160);
  const monotonicDecreasing = anchor60 > anchor100 && anchor100 > anchor160;
  console.log('Monotonically decreasing as % increases (higher % = higher up):', monotonicDecreasing);

  console.log('=== Test 3: actual seat behavior via the slider -- higher % moves rows UP (smaller y) ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(6, 'arc');
    chart.stageSpacing = 100;
  `);
  await wait(20);
  const yAt100 = window.eval("chart.seats[0].y");
  doc.getElementById('stageSpacingSlider').value = 160;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const yAt160 = window.eval("chart.seats[0].y");
  console.log('Seat y at stageSpacing=100:', yAt100, '| at 160:', yAt160);
  const movedUp = yAt160 < yAt100;
  console.log('Sliding right (160%) moved seats UP the page (smaller y):', movedUp);

  const pass = anchor100===574 && monotonicDecreasing && movedUp;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
