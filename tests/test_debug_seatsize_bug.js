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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/Symphony_Orchestra_test__seatchart.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'Symphony Orchestra')`);
  await wait(50);

  console.log('=== Select ALL seats, then bump seat size ===');
  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  const beforePositions = window.eval(`
    JSON.stringify(chart.seats.slice(0,5).map(s=>({x:Math.round(s.x), y:Math.round(s.y)})))
  `);
  console.log('First 5 seat positions BEFORE:', beforePositions);
  const rowSpacingBefore = window.eval('chart.rowSpacing');
  const seatSpacingBefore = window.eval('chart.seatSpacing');
  console.log('rowSpacing before:', rowSpacingBefore, '| seatSpacing before:', seatSpacingBefore);

  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  doc.getElementById('seatSize').value = 120;
  doc.getElementById('seatSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const afterPositions = window.eval(`
    JSON.stringify(chart.seats.slice(0,5).map(s=>({x:Math.round(s.x), y:Math.round(s.y)})))
  `);
  console.log('First 5 seat positions AFTER seat-size 120%:', afterPositions);
  const rowSpacingAfter = window.eval('chart.rowSpacing');
  const seatSpacingAfter = window.eval('chart.seatSpacing');
  console.log('rowSpacing after:', rowSpacingAfter, '| seatSpacing after:', seatSpacingAfter);

  console.log('Positions changed (formation moved):', beforePositions !== afterPositions);
  console.log('Global rowSpacing changed:', rowSpacingBefore !== rowSpacingAfter);
  console.log('Global seatSpacing changed:', seatSpacingBefore !== seatSpacingAfter);
})().catch(e=>console.error('ERROR:', e));
