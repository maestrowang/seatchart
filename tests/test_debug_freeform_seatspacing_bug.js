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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/latest_upload.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);

  console.log('chart.seatSpacing:', window.eval('chart.seatSpacing'));
  const freeformIds = window.eval("chart.seats.filter(s=>s.row===-1).map(s=>s.id)");
  console.log('Freeform chair count:', freeformIds.length);
  console.log('Freeform positions before:', window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>({x:Math.round(getSeat(id).x),y:Math.round(getSeat(id).y)})))`));
  console.log('podiumPoint():', window.eval('JSON.stringify(podiumPoint())'));

  window.eval(`setSelection(${JSON.stringify(freeformIds)})`);
  await wait(10);

  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  console.log('seatSpacingFreeformSnapshot:', window.eval('JSON.stringify(seatSpacingFreeformSnapshot)'));

  slider.value = 110;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  console.log('Freeform positions after 110%:', window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>({x:Math.round(getSeat(id).x),y:Math.round(getSeat(id).y)})))`));

  slider.value = 130;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  console.log('Freeform positions after 130%:', window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>({x:Math.round(getSeat(id).x),y:Math.round(getSeat(id).y)})))`));
})().catch(e=>console.error('ERROR:', e));
