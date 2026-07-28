const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const drawCalls = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop,
  fillText(text, x, y){ drawCalls.push({text, font: this._font}); },
  setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 6 }),
  clearRect: noop, drawImage: noop, ellipse: noop,
  roundRect(x,y,w,h){ drawCalls.push({op:'roundRect', w, h}); },
  bezierCurveTo: noop, quadraticCurveTo: noop,
  getImageData(x,y,w,h){ return { data: new Uint8ClampedArray(w*h*4).fill(128), width:w, height:h }; },
  putImageData: noop,
};
const dom = new JSDOM(html, {
  url: 'https://example.github.io/seating-chart/',
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(window){
    window.HTMLCanvasElement.prototype.getContext = function(){
      const proxy = new Proxy(fakeCtxProto, {
        get(target, prop){
          if(prop === 'font') return target._font;
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        },
        set(target, prop, val){ if(prop==='font') target._font = val; return true; }
      });
      return proxy;
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up a seat with roster name + label, dark seat color ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(2, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#1A1A1A'; s.label='Vc'; });
    chart.rosters['Cello'] = ['Someone Person'];
    chart.showLabels = true; chart.showRosterNames = true;
  `);
  await wait(20);

  console.log('=== Test 1: demoted label gets a chip background (roundRect drawn twice: name + label) ===');
  drawCalls.length = 0;
  window.eval('render()');
  const roundRectCount = drawCalls.filter(c=>c.op==='roundRect').length;
  console.log('roundRect calls (should be >=2: name chip + label chip):', roundRectCount);
  const chipBg = roundRectCount >= 2;
  console.log('Both name and label get chip backgrounds:', chipBg);

  console.log('=== Test 2: roster text size slider -- global scope ===');
  window.eval('setSelection([])');
  doc.getElementById('rosterTextSize').value = 150;
  doc.getElementById('rosterTextSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  console.log('chart.rosterTextScale set globally:', window.eval('chart.rosterTextScale') === 150);

  console.log('=== Test 3: roster text size slider -- selection scope ===');
  window.eval('chart.rosterTextScale = 100;'); // reset global
  const seatIds = window.eval("chart.seats.map(s=>s.id)");
  window.eval(`setSelection([${JSON.stringify(seatIds[0])}])`);
  await wait(10);
  doc.getElementById('rosterTextSize').value = 130;
  doc.getElementById('rosterTextSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  const seat0Scale = window.eval(`getSeat('${seatIds[0]}').rosterTextScale`);
  const seat1Scale = window.eval(`getSeat('${seatIds[1]}').rosterTextScale`);
  const globalUnchanged = window.eval('chart.rosterTextScale') === 100;
  console.log('Selected seat got its own scale:', seat0Scale === 130);
  console.log('Unselected seat untouched:', seat1Scale === undefined);
  console.log('Global scale unaffected by scoped change:', globalUnchanged);

  const pass = chipBg && window.eval('chart.rosterTextScale')===100 && seat0Scale===130 &&
               seat1Scale===undefined && globalUnchanged;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
