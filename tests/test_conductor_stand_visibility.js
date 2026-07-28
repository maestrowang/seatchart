const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const drawCalls = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath(){ drawCalls.push('beginPath'); }, moveTo: noop, lineTo: noop, closePath: noop,
  fill: noop, stroke: noop,
  arc(x,y,r){ drawCalls.push({op:'arc', x, y, r}); },
  rect(x,y,w,h){ drawCalls.push({op:'rect', x, y, w, h}); },
  fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
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

  console.log('=== Set up: enable podium with a conductor stand ===');
  window.eval(`
    chart.podium.enabled = true;
    chart.podium.standType = 'conductor';
  `);
  await wait(20);

  function countStandDraws(){
    return window.eval(`
      let __standDrawCount = 0;
      const _origDrawStandIcon = drawStandIcon;
      drawStandIcon = function(...args){ __standDrawCount++; return _origDrawStandIcon.apply(this, args); };
      render();
      drawStandIcon = _origDrawStandIcon;
      __standDrawCount;
    `);
  }

  console.log('=== Test 1: conductor stand draws by default (showMusicStand true) ===');
  const arcsShown = countStandDraws();
  console.log('drawStandIcon call count (stand present):', arcsShown);
  console.log('chart.showMusicStand is true:', window.eval('chart.showMusicStand') === true);

  console.log('=== Test 2: hiding music stands also hides the conductor stand ===');
  window.eval('chart.showMusicStand = false;');
  const arcsHidden = countStandDraws();
  console.log('drawStandIcon call count (stand hidden):', arcsHidden);
  console.log('Fewer stand draws when hidden:', arcsHidden < arcsShown);

  console.log('=== Test 3: podium.standType data itself is untouched ===');
  console.log('chart.podium.standType still "conductor":', window.eval('chart.podium.standType') === 'conductor');

  console.log('=== Test 4: showing again restores the conductor stand ===');
  window.eval('chart.showMusicStand = true;');
  const arcsRestored = countStandDraws();
  console.log('Stand draws restored to original count:', arcsRestored === arcsShown);

  const pass = arcsHidden < arcsShown && window.eval('chart.podium.standType')==='conductor' && arcsRestored===arcsShown;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
