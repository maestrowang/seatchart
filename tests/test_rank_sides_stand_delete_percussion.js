// Covers three v5.5.1 fixes, all reproduced from a real chart (Pacific Blue Band 2026):
//
// 1. Seats sitting EXACTLY on the centre line were classified as the right-hand side,
//    because the split used `s.x >= cx`. Clarinet had 7 chairs left of centre and 2 on
//    it, so those 2 were treated as a separate right-hand side and ranked 8th and 9th
//    instead of 4th and 9th.
//
// 2. Centre-out ordering was applied to any section, but it only means something for a
//    section that IS one half of a row (Violin 1 left, Violin 2 right, each ranking from
//    the centre outward). A section reaching across the centre owns that span and should
//    read straight across -- the Percussion group ranked 371,292,213,135 then 450,528,607
//    rather than simply left to right.
//
// 3. A music stand could be dragged but never selected, so Delete/Backspace had nothing
//    to act on.
//
// Plus the new "Percussion (generic)" preset.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
        get(t,p){ if(p in t) return t[p];
          if(typeof p==='string' && (p.endsWith('Style')||p==='font'||p==='lineWidth'||p==='lineCap'||p==='globalAlpha'||p==='textAlign'||p==='textBaseline')) return '';
          return noop; }, set(){ return true; }
      });
    };
    window.HTMLCanvasElement.prototype.getBoundingClientRect = function(){
      return { left:0, top:0, width:this.width, height:this.height };
    };
  }
});
const { window } = dom;
const wait = ms => new Promise(r=>setTimeout(r,ms));

// x positions in rank order for a section -- the thing the bugs actually got wrong.
function xsInRankOrder(section){
  return JSON.parse(window.eval(`
    (()=>{
      const r = computeAllSeatRanks();
      const ss = chart.seats.filter(s=>!s.hidden && effectiveSectionKey(s) === ${JSON.stringify(section)});
      ss.sort((a,b)=>r.get(a.id)-r.get(b.id));
      return JSON.stringify(ss.map(s=>Math.round(s.x*10)/10));
    })()
  `));
}
function rowsInRankOrder(section){
  return JSON.parse(window.eval(`
    (()=>{
      const r = computeAllSeatRanks();
      const ss = chart.seats.filter(s=>!s.hidden && effectiveSectionKey(s) === ${JSON.stringify(section)});
      ss.sort((a,b)=>r.get(a.id)-r.get(b.id));
      return JSON.stringify(ss.map(s=>s.row));
    })()
  `));
}

(async()=>{
  await wait(300);
  const checks = [];

  console.log('=== Test 1: a section touching the centre line is not split at it ===');
  // Row of 5 straight seats, the last sitting exactly on centre (cx = canvas.width/2).
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.groups=[]; chart.rosters={}; chart.rosterShuffle={};
    addRow(5, 'arc');
    const cx = canvas.width/2;
    const xs = [cx-160, cx-120, cx-80, cx-40, cx];   // left of centre, last ON centre
    chart.seats.forEach((s,i)=>{ s.preset='Clarinet'; s.x = xs[i]; s.row = 0; });
  `);
  await wait(20);
  const onCentre = xsInRankOrder('Clarinet');
  console.log('  x in rank order:', JSON.stringify(onCentre));
  // Outer-to-inner for a left-side arc = ascending x, with the centre seat ranking last
  // of its row rather than being deferred behind every other row.
  const t1 = JSON.stringify(onCentre) === JSON.stringify([290,330,370,410,450]);
  console.log('  centre seat ranks with its own side:', t1);
  checks.push(t1);

  console.log('=== Test 2: two rows, centre seat in each -> row 1 then row 2, no deferral ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(4, 'arc'); addRow(5, 'arc');
    const cx = canvas.width/2;
    const r0 = chart.seats.filter(s=>s.row===0), r1 = chart.seats.filter(s=>s.row===1);
    [cx-120,cx-80,cx-40,cx].forEach((x,i)=>{ r0[i].x=x; r0[i].preset='Clarinet'; });
    [cx-190,cx-150,cx-110,cx-60,cx].forEach((x,i)=>{ r1[i].x=x; r1[i].preset='Clarinet'; });
  `);
  await wait(20);
  const twoRowRows = rowsInRankOrder('Clarinet');
  const twoRowXs = xsInRankOrder('Clarinet');
  console.log('  rows in rank order:', JSON.stringify(twoRowRows));
  console.log('  x    in rank order:', JSON.stringify(twoRowXs));
  // The reported bug: the two centre chairs landed at ranks 8 and 9.
  const t2 = JSON.stringify(twoRowRows) === JSON.stringify([0,0,0,0,1,1,1,1,1]);
  console.log('  row 1 takes ranks 1-4, row 2 takes 5-9:', t2);
  checks.push(t2);

  console.log('=== Test 3: a section spanning the centre reads straight across ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.groups=[];
    addRow(7, 'straight');
    const cx = canvas.width/2;
    [cx-315,cx-236,cx-157,cx-79,cx,cx+79,cx+157].forEach((x,i)=>{
      chart.seats[i].x = x; chart.seats[i].preset='Percussion (generic)';
    });
  `);
  await wait(20);
  const across = xsInRankOrder('Percussion (generic)');
  console.log('  x in rank order:', JSON.stringify(across));
  const ascending = across.every((v,i)=> i===0 || v > across[i-1]);
  console.log('  strictly left to right (not centre-out):', ascending);
  checks.push(ascending);

  console.log('=== Test 4: a one-sided straight section still ranks centre-out ===');
  // The convention is correct when the section IS one half of a row, so it must survive.
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.groups=[];
    addRow(4, 'straight');
    const cx = canvas.width/2;
    [cx-300,cx-220,cx-140,cx-60].forEach((x,i)=>{ chart.seats[i].x=x; chart.seats[i].preset='Viola'; });
  `);
  await wait(20);
  const oneSided = xsInRankOrder('Viola');
  console.log('  x in rank order:', JSON.stringify(oneSided));
  const descending = oneSided.every((v,i)=> i===0 || v < oneSided[i-1]);
  console.log('  innermost first, outward (unchanged convention):', descending);
  checks.push(descending);

  console.log('=== Test 5: "Percussion (generic)" exists under Other, dark grey ===');
  const preset = JSON.parse(window.eval(`
    (()=>{ for(const g of PRESETS){ for(const it of g.items){
        if(it[0]==='Percussion (generic)') return JSON.stringify({group:g.group, abbr:it[1], color:it[2]});
      } } return 'null'; })()
  `));
  console.log('  found:', JSON.stringify(preset));
  const hex = preset && preset.color.replace('#','');
  const lum = hex ? (parseInt(hex.slice(0,2),16)+parseInt(hex.slice(2,4),16)+parseInt(hex.slice(4,6),16))/3 : 999;
  const rgb = hex ? [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)] : [0,0,0];
  const neutral = Math.max(...rgb) - Math.min(...rgb) <= 20;   // grey, not a hue
  const t5 = !!preset && preset.group === 'Other' && lum < 128 && neutral;
  console.log('  under Other, neutral and darker than mid-grey:', t5, `(mean ${Math.round(lum)}, spread ${Math.max(...rgb)-Math.min(...rgb)})`);
  checks.push(t5);

  console.log('=== Test 6: a solo stand can be selected and deleted from the keyboard ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.groups=[];
    addRow(2, 'straight');
    chart.seats.forEach(s=>{ s.preset='Flute'; s.stand=true; s.standPartner=null; });
    render();
  `);
  await wait(20);
  const soloSeatId = window.eval('chart.seats[0].id');
  window.eval(`selectedStandKey = standKeySolo('${soloSeatId}')`);
  window.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Delete', bubbles:true}));
  await wait(20);
  const standOff = window.eval(`getSeat('${soloSeatId}').stand === false`);
  const offsetGone = window.eval(`chart.standPositions[standKeySolo('${soloSeatId}')] === undefined`);
  const cleared = window.eval('selectedStandKey === null');
  console.log('  stand off:', standOff, '| stored offset dropped:', offsetGone, '| selection cleared:', cleared);
  const t6 = standOff && offsetGone && cleared;
  checks.push(t6);

  console.log('=== Test 7: deleting a shared stand unlinks both chairs ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.groups=[];
    addRow(2, 'straight');
    const [a,b] = chart.seats;
    a.preset='Flute'; b.preset='Flute';
    a.standPartner=b.id; b.standPartner=a.id; a.stand=false; b.stand=false;
    render();
  `);
  await wait(20);
  const ids = JSON.parse(window.eval('JSON.stringify(chart.seats.map(s=>s.id))'));
  window.eval(`selectedStandKey = standKeyPair('${ids[0]}','${ids[1]}')`);
  window.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Backspace', bubbles:true}));
  await wait(20);
  const unlinked = window.eval(`getSeat('${ids[0]}').standPartner === null && getSeat('${ids[1]}').standPartner === null`);
  const bothOff = window.eval(`getSeat('${ids[0]}').stand === false && getSeat('${ids[1]}').stand === false`);
  const pairGone = window.eval(`chart.standPositions[standKeyPair('${ids[0]}','${ids[1]}')] === undefined`);
  console.log('  unlinked:', unlinked, '| both stands off:', bothOff, '| pair offset dropped:', pairGone);
  const t7 = unlinked && bothOff && pairGone;
  checks.push(t7);

  console.log('=== Test 8: undo restores a deleted stand, and Escape only deselects ===');
  window.eval('undo()');
  await wait(20);
  const restored = window.eval(`getSeat('${ids[0]}').standPartner === '${ids[1]}'`);
  console.log('  undo restored the shared stand:', restored);
  window.eval(`selectedStandKey = standKeySolo('${ids[0]}')`);
  window.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
  await wait(20);
  const deselected = window.eval('selectedStandKey === null');
  const stillLinked = window.eval(`getSeat('${ids[0]}').standPartner === '${ids[1]}'`);
  console.log('  Escape cleared selection:', deselected, '| but deleted nothing:', stillLinked);
  const t8 = restored && deselected && stillLinked;
  checks.push(t8);

  console.log('=== Test 9: selecting seats releases a selected stand ===');
  window.eval(`selectedStandKey = standKeySolo('${ids[0]}'); setSelection(['${ids[1]}']);`);
  await wait(10);
  const released = window.eval('selectedStandKey === null');
  console.log('  stand released when seats are selected:', released);
  checks.push(released);

  const pass = checks.every(Boolean);
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
