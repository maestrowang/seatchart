const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
const noop = () => {};
const drawLog = [];
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop,
  fillText(text){ drawLog.push(text); },
  setLineDash: noop,
  measureText: (t) => ({ width: (t||'').length * 8 }), // 8px per char, simple deterministic model
  clearRect: noop, drawImage: noop, ellipse: noop,
  roundRect(x,y,w,h){ drawLog.push({op:'roundRect', fillStyle:this._fillStyle}); },
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
          if(prop === 'fillStyle') return target._fillStyle;
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='font'||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        },
        set(target, prop, val){ if(prop==='fillStyle') target._fillStyle = val; return true; }
      });
      return proxy;
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);

  console.log('=== Test 1: opacity is now 0.5 ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(1, 'straight');
    chart.seats[0].preset='Cello'; chart.seats[0].color='#79CC3E'; chart.seats[0].label='Vc';
    chart.rosters['Cello'] = ['Alice Chen'];
  `);
  await wait(20);
  drawLog.length = 0;
  window.eval('render()');
  const roundRects = drawLog.filter(d=>d && d.op==='roundRect');
  console.log('Chip fill styles:', roundRects.map(r=>r.fillStyle));
  const has50pct = roundRects.some(r=>r.fillStyle && r.fillStyle.includes(',0.5)'));
  console.log('Opacity is 0.5:', has50pct);

  console.log('=== Test 2: short hyphenated name stays 2 lines (not forced to 3) ===');
  console.log('wrapNameForDisplay("Mary Jo-Ann") ->', JSON.stringify(window.eval(`
    const ctx = canvas.getContext('2d');
    wrapNameForDisplay('Mary Jo-Ann', ctx, 16)
  `)));
  const shortHyphen = window.eval(`
    const ctx = canvas.getContext('2d');
    JSON.stringify(wrapNameForDisplay('Mary Jo-Ann', ctx, 16))
  `);
  const shortStays2Lines = JSON.parse(shortHyphen).length === 2;
  console.log('Short hyphenated name stays 2 lines:', shortStays2Lines);

  console.log('=== Test 3: long hyphenated surname splits into 3 lines ===');
  const longHyphenResult = window.eval(`
    const ctx = canvas.getContext('2d');
    JSON.stringify(wrapNameForDisplay('Sam Featherington-Worthington', ctx, 16))
  `);
  console.log('Result:', longHyphenResult);
  const parsed = JSON.parse(longHyphenResult);
  const splitsInto3 = parsed.length === 3;
  const hyphenKeptWithFirstPart = parsed[1] && parsed[1].endsWith('-');
  console.log('Splits into 3 lines:', splitsInto3);
  console.log('Hyphen stays with the first fragment:', hyphenKeptWithFirstPart);
  console.log('Lines:', parsed);

  console.log('=== Test 4: name with no hyphen still wraps normally regardless of length ===');
  const noHyphenLong = window.eval(`
    const ctx = canvas.getContext('2d');
    JSON.stringify(wrapNameForDisplay('Christopher Alexanderson', ctx, 16))
  `);
  console.log('No-hyphen long name:', noHyphenLong);
  const noHyphenStays2 = JSON.parse(noHyphenLong).length === 2;
  console.log('Stays 2 lines even if long (no hyphen to split on):', noHyphenStays2);

  console.log('=== Test 5: single name (no space) unaffected ===');
  const singleName = window.eval(`
    const ctx = canvas.getContext('2d');
    JSON.stringify(wrapNameForDisplay('Cher', ctx, 16))
  `);
  console.log('Single name:', singleName);
  const singleCorrect = JSON.parse(singleName).length === 1;

  console.log('=== Test 6: actual rendering with a wide hyphenated name draws 3 fillText calls ===');
  window.eval(`chart.rosters['Cello'] = ['Sam Featherington-Worthington'];`);
  await wait(10);
  drawLog.length = 0;
  window.eval('render()');
  const textDraws = drawLog.filter(d=>typeof d === 'string');
  console.log('Text draws for wide hyphenated name:', textDraws);
  const threeLinesDrawn = textDraws.includes('Sam') && textDraws.some(t=>t.endsWith('-')) && textDraws.includes('Worthington');

  const pass = has50pct && shortStays2Lines && splitsInto3 && hyphenKeptWithFirstPart && noHyphenStays2 && singleCorrect && threeLinesDrawn;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
