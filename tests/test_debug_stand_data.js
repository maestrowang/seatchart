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
  window.eval(`
    const seats = chart.seats.filter(s=>s.row===0);
    seats[0].stand = true;
    seats[1].standPartner = seats[2].id;
    seats[2].standPartner = seats[1].id;
  `);
  await wait(20);
  console.log('standPositions BEFORE any toggle:', window.eval('JSON.stringify(chart.standPositions)'));
  doc.getElementById('showMusicStand').checked = false;
  doc.getElementById('showMusicStand').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(20);
  console.log('standPositions after HIDING:', window.eval('JSON.stringify(chart.standPositions)'));
  doc.getElementById('showMusicStand').checked = true;
  doc.getElementById('showMusicStand').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(20);
  console.log('standPositions after SHOWING again:', window.eval('JSON.stringify(chart.standPositions)'));
})().catch(e=>console.error('ERROR:', e));
