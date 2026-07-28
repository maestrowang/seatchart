const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const drawCalls = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
  fill: noop, stroke: noop,
  arc(x,y,r){ drawCalls.push({op:'arc', x, y, r}); },
  rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
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

  console.log('=== Set up: a solo stand and a shared/paired stand ===');
  window.eval(`
    const seats = chart.seats.filter(s=>s.row===0);
    seats[0].stand = true;
    seats[1].standPartner = seats[2].id;
    seats[2].standPartner = seats[1].id;
    render(); // ensure lazy-initialized stand offsets exist before we snapshot them
  `);
  await wait(20);

  console.log('=== Test 1: default is shown (checkbox checked, chart.showMusicStand true) ===');
  console.log('Checkbox default checked:', doc.getElementById('showMusicStand').checked);
  console.log('chart.showMusicStand default true:', window.eval('chart.showMusicStand') === true);

  console.log('=== Test 2: hiding stands does not touch underlying data ===');
  const standDataBefore = window.eval(`
    JSON.stringify({
      s0stand: chart.seats.filter(s=>s.row===0)[0].stand,
      s1partner: chart.seats.filter(s=>s.row===0)[1].standPartner,
      s2partner: chart.seats.filter(s=>s.row===0)[2].standPartner,
      standPositions: chart.standPositions
    })
  `);
  doc.getElementById('showMusicStand').checked = false;
  doc.getElementById('showMusicStand').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(20);
  const standDataAfter = window.eval(`
    JSON.stringify({
      s0stand: chart.seats.filter(s=>s.row===0)[0].stand,
      s1partner: chart.seats.filter(s=>s.row===0)[1].standPartner,
      s2partner: chart.seats.filter(s=>s.row===0)[2].standPartner,
      standPositions: chart.standPositions
    })
  `);
  console.log('Underlying stand data unchanged after hiding:', standDataBefore === standDataAfter);
  console.log('chart.showMusicStand is now false:', window.eval('chart.showMusicStand') === false);

  console.log('=== Test 3: toggling back on restores visibility, data intact ===');
  doc.getElementById('showMusicStand').checked = true;
  doc.getElementById('showMusicStand').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(20);
  const standDataRestored = window.eval(`
    JSON.stringify({
      s0stand: chart.seats.filter(s=>s.row===0)[0].stand,
      s1partner: chart.seats.filter(s=>s.row===0)[1].standPartner,
      s2partner: chart.seats.filter(s=>s.row===0)[2].standPartner,
      standPositions: chart.standPositions
    })
  `);
  console.log('Data still intact after toggling back on:', standDataBefore === standDataRestored);
  console.log('chart.showMusicStand is true again:', window.eval('chart.showMusicStand') === true);

  console.log('=== Test 4: save/load round-trip preserves the setting ===');
  window.eval("chart.showMusicStand = false;");
  const json = window.eval('JSON.stringify(chart)');
  const reloaded = JSON.parse(json);
  window.eval(`applyLoadedChartData(${JSON.stringify(reloaded)}, 'test')`);
  await wait(20);
  console.log('showMusicStand persists through save/load:', window.eval('chart.showMusicStand') === false);
  console.log('Checkbox reflects it:', doc.getElementById('showMusicStand').checked === false);

  console.log('=== Test 5: old file missing the field migrates to default true ===');
  const oldFile = { title: 'Old', seats: [], rowIndex: 0 };
  window.eval(`applyLoadedChartData(${JSON.stringify(oldFile)}, 'old')`);
  await wait(20);
  console.log('Old file defaults to shown:', window.eval('chart.showMusicStand') === true);

  const pass = doc.getElementById('showMusicStand').checked === true; // will be overwritten below properly
  const finalPass = window.eval('chart.showMusicStand')===true && standDataBefore===standDataAfter &&
                    standDataBefore===standDataRestored;
  console.log(finalPass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
