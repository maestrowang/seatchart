const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/string_orch.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'String Orchestra')`);
  await wait(50);

  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  console.log('rowRadii before:', window.eval('JSON.stringify(chart.rowRadii)'));
  console.log('smeh575r y before:', window.eval("getSeat('smeh575r').y"));

  doc.getElementById('rowSpacingSlider').value = 120;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  console.log('rowRadii after:', window.eval('JSON.stringify(chart.rowRadii)'));
  console.log('smeh575r y after:', window.eval("getSeat('smeh575r').y"));
  console.log('rowSpacingCustomSnapshot still set?', window.eval('!!rowSpacingCustomSnapshot'));
  console.log('rowSpacingCustomSnapshot[3]:', window.eval('JSON.stringify(rowSpacingCustomSnapshot && rowSpacingCustomSnapshot[3])'));
})().catch(e=>console.error('ERROR:', e));
