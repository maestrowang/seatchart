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
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'straight');
    chart.seats.forEach(s=>{ s.preset='Cello'; s.color='#79CC3E'; s.label='Vc'; });
    chart.rosters['Cello'] = ['First Person'];
  `);
  await wait(20);
  const seatId = window.eval("chart.seats.sort((a,b)=>a.x-b.x)[0].id");
  const sr = window.eval('seatRadius()');
  const off = window.eval(`(INSTRUMENT_LABEL_OFFSET['Cello'] || {dx:0,dy:0})`);
  console.log('sr:', sr, 'off:', JSON.stringify(off));
  const seatY = window.eval(`getSeat('${seatId}').y`);
  console.log('seat.y:', seatY);
  const chipY = window.eval(`getSeat('${seatId}').y + (INSTRUMENT_LABEL_OFFSET['Cello']||{dy:0}).dy*seatRadius() + 1`);
  const labelY = window.eval(`getSeat('${seatId}').y + seatRadius()*0.62`);
  console.log('computed chipY:', chipY, 'labelY:', labelY);
  console.log('my test used chipLogicalY = seat.y+1 =', seatY+1);
  console.log('distance from test-chipY to actual chipY:', Math.abs((seatY+1)-chipY));
  console.log('distance from test-chipY to actual labelY:', Math.abs((seatY+1)-labelY));
})().catch(e=>console.error('ERROR:', e));
