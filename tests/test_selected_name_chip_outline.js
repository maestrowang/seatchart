const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const drawCalls = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath(){ drawCalls.push({op:'beginPath'}); }, moveTo: noop, lineTo: noop, closePath: noop,
  fill: noop,
  stroke(){ drawCalls.push({op:'stroke', color: this._strokeStyle, dash: this._dash}); },
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop,
  setLineDash(d){ this._dash = d; },
  measureText: (t) => ({ width: (t||'').length * 8 }),
  clearRect: noop, drawImage: noop, ellipse: noop,
  roundRect(x,y,w,h){ drawCalls.push({op:'roundRect', x, y, w, h, strokeColor: this._strokeStyle}); },
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
          if(prop === 'strokeStyle') return target._strokeStyle;
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='font'||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        },
        set(target, prop, val){ if(prop==='strokeStyle') target._strokeStyle = val; return true; }
      });
      return proxy;
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);

  console.log('=== Set up: a seat with a roster name ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(2, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; s.label='Vc'; });
    chart.rosters['Cello'] = ['Alice Chen', 'Bob Smith'];
    chart.showRosterNames = true; chart.showLabels = true;
  `);
  await wait(20);

  console.log('=== Test 1: unselected seat -- name chip has NO selection outline ===');
  drawCalls.length = 0;
  window.eval('render()');
  const roundRectsUnselected = drawCalls.filter(c=>c.op==='roundRect');
  console.log('roundRect calls (unselected):', roundRectsUnselected.length);
  // Only the fill roundRect for the chip background should exist, no brass-colored outline roundRect
  const hasOutlineUnselected = roundRectsUnselected.some(c=>c.strokeColor === '#B8842A');
  console.log('No brass outline drawn when unselected:', !hasOutlineUnselected);

  console.log('=== Test 2: selecting the seat draws a brass selection outline around the name chip ===');
  const seatId = window.eval('chart.seats[0].id');
  window.eval(`selectSeat(getSeat('${seatId}'))`);
  await wait(10);
  drawCalls.length = 0;
  window.eval('render()');
  const roundRectsSelected = drawCalls.filter(c=>c.op==='roundRect');
  console.log('roundRect calls (selected):', roundRectsSelected.length);
  const hasOutlineSelected = roundRectsSelected.some(c=>c.strokeColor === '#B8842A');
  console.log('Brass selection outline now drawn:', hasOutlineSelected);

  console.log('=== Test 3: only the SELECTED seat gets the outline, not the other seat ===');
  const otherSeatId = window.eval('chart.seats[1].id');
  const otherIsSelected = window.eval(`selection.has('${otherSeatId}')`);
  console.log('Other seat is not selected:', !otherIsSelected);

  console.log('=== Test 4: deselecting removes the outline ===');
  window.eval('selectSeat(null)');
  await wait(10);
  drawCalls.length = 0;
  window.eval('render()');
  const roundRectsAfterDeselect = drawCalls.filter(c=>c.op==='roundRect');
  const hasOutlineAfterDeselect = roundRectsAfterDeselect.some(c=>c.strokeColor === '#B8842A');
  console.log('Outline removed after deselecting:', !hasOutlineAfterDeselect);

  const pass = !hasOutlineUnselected && hasOutlineSelected && !otherIsSelected && !hasOutlineAfterDeselect;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
