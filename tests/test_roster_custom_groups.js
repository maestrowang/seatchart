// Custom groups are selectable roster sections: names, shuffle, revert and inline
// edit all work against a hand-picked set of chairs.
//
// A seat can be in a group AND have an instrument, but the roster/rank/shuffle path is
// built on exactly one section key per seat, so the group wins for its members. The
// instrument's own name list is never touched -- those seats just stop consuming ranks
// from it, so deleting the group restores the previous state.
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
const doc = window.document;
const wait = ms => new Promise(r=>setTimeout(r,ms));

function namesInRankOrder(section){
  return JSON.parse(window.eval(`
    (()=>{
      const ranks = computeAllSeatRanks();
      const a = getRosterAssignments();
      const seats = chart.seats.filter(s=>!s.hidden && effectiveSectionKey(s) === ${JSON.stringify(section)});
      seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id));
      return JSON.stringify(seats.map(s=>a.get(s.id) === undefined ? null : a.get(s.id)));
    })()
  `));
}
function pasteInto(section, lines){
  doc.getElementById('rosterSectionSelect').value = section;
  doc.getElementById('rosterPasteArea').value = lines.join('\n');
  doc.getElementById('rosterPasteApplyBtn').dispatchEvent(new window.Event('click'));
}

(async()=>{
  await wait(300);
  const checks = [];

  console.log('=== Set up: two 6-seat instrument sections with their own rosters ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={}; chart.groups=[]; chart.rosters={}; chart.rosterShuffle={};
    addRow(6, 'straight');
    addRow(6, 'straight');
    const ranks0 = computeAllSeatRanks();
    chart.seats.forEach(s=>{ s.preset = s.row === 0 ? 'Violin 1' : 'Cello'; });
    chart.rosters['Violin 1'] = ['V1','V2','V3','V4','V5','V6'];
    chart.rosters['Cello']    = ['C1','C2','C3','C4','C5','C6'];
  `);
  await wait(30);
  window.eval('rosterPanelOpen = true; refreshRosterSectionSelect();');
  await wait(20);

  const beforeViolin = namesInRankOrder('Violin 1');
  console.log('Violin 1 seats before grouping:', JSON.stringify(beforeViolin));

  console.log('=== Test 1: a saved group appears in the roster dropdown, labelled ===');
  // Two seats from each instrument -- the mixed case the whole feature is about.
  const groupId = window.eval(`
    (()=>{
      const ranks = computeAllSeatRanks();
      const pick = p => chart.seats.filter(s=>s.preset===p)
        .sort((a,b)=>ranks.get(a.id)-ranks.get(b.id)).slice(0,2).map(s=>s.id);
      const ids = [...pick('Violin 1'), ...pick('Cello')];
      const id = 'grp1';
      chart.groups.push({ id, name: 'Front Desks', seatIds: ids });
      refreshRosterSectionSelect();
      return id;
    })()
  `);
  await wait(20);
  const key = '__group_' + groupId;
  const opts = JSON.parse(window.eval(`JSON.stringify([...document.getElementById('rosterSectionSelect').options].map(o=>[o.value,o.textContent]))`));
  console.log('  dropdown:', JSON.stringify(opts));
  const t1 = opts.some(([v,t])=>v === key && t === 'Front Desks (group)');
  console.log('  group offered as a section:', t1);
  checks.push(t1);

  console.log('=== Test 2: group members leave their instrument section ===');
  const groupSeatCount = window.eval(`chart.seats.filter(s=>!s.hidden && effectiveSectionKey(s)==='${key}').length`);
  const violinCount = window.eval("chart.seats.filter(s=>!s.hidden && effectiveSectionKey(s)==='Violin 1').length");
  console.log('  group seats:', groupSeatCount, '| Violin 1 seats now:', violinCount, '(was 6)');
  const t2 = groupSeatCount === 4 && violinCount === 4;
  console.log('  members reassigned:', t2);
  checks.push(t2);

  console.log('=== Test 3: the instrument roster ARRAY is left intact ===');
  const violinNames = window.eval("JSON.stringify(chart.rosters['Violin 1'])");
  console.log('  chart.rosters["Violin 1"]:', violinNames);
  const t3 = violinNames === JSON.stringify(['V1','V2','V3','V4','V5','V6']);
  console.log('  untouched (only fewer seats consume it):', t3);
  checks.push(t3);

  console.log('=== Test 4: pasting names into the group puts them on its seats in rank order ===');
  pasteInto(key, ['G1','G2','G3','G4']);
  await wait(30);
  const groupNames = namesInRankOrder(key);
  console.log('  group seats:', JSON.stringify(groupNames));
  const t4 = JSON.stringify(groupNames) === JSON.stringify(['G1','G2','G3','G4']);
  console.log('  applied in rank order:', t4);
  checks.push(t4);

  console.log('=== Test 5: shuffle + revert work on a group section ===');
  window.eval(`shuffleRosterSection('${key}', false)`);
  await wait(20);
  const shuffled = namesInRankOrder(key);
  const rosterAfterShuffle = window.eval(`JSON.stringify(chart.rosters['${key}'])`);
  console.log('  after shuffle:', JSON.stringify(shuffled), '| roster array:', rosterAfterShuffle);
  const shuffledOk = JSON.stringify(shuffled) !== JSON.stringify(['G1','G2','G3','G4'])
    && rosterAfterShuffle === JSON.stringify(['G1','G2','G3','G4'])
    && shuffled.slice().sort().join() === ['G1','G2','G3','G4'].join();
  window.eval(`revertRosterShuffle('${key}')`);
  await wait(20);
  const reverted = namesInRankOrder(key);
  console.log('  after revert:', JSON.stringify(reverted));
  const t5 = shuffledOk && JSON.stringify(reverted) === JSON.stringify(['G1','G2','G3','G4']);
  console.log('  shuffle rearranges seats only, revert restores:', t5);
  checks.push(t5);

  console.log('=== Test 6: inline edit writes back to the group roster ===');
  window.eval(`
    (()=>{
      const ranks = computeAllSeatRanks();
      const seat = chart.seats.filter(s=>effectiveSectionKey(s)==='${key}')
        .find(s=>ranks.get(s.id)===2);
      applyRosterNameEdit(seat, 'Edited');
    })()
  `);
  await wait(20);
  const edited = window.eval(`JSON.stringify(chart.rosters['${key}'])`);
  console.log('  group roster:', edited);
  const t6 = edited === JSON.stringify(['G1','Edited','G3','G4']);
  console.log('  edit landed on the right slot:', t6);
  checks.push(t6);

  console.log('=== Test 7: overlapping groups -- the most recently saved one owns the seat ===');
  const sharedSeat = window.eval(`chart.groups[0].seatIds[0]`);
  window.eval(`
    chart.groups.push({ id:'grp2', name:'Later Group', seatIds: ['${sharedSeat}'] });
  `);
  await wait(10);
  const owner = window.eval(`effectiveSectionKey(getSeat('${sharedSeat}'))`);
  console.log('  seat in both groups resolves to:', owner);
  const t7 = owner === '__group_grp2';
  console.log('  newest group wins:', t7);
  checks.push(t7);

  console.log('=== Test 8: deleting a group returns its seats and clears its roster ===');
  window.eval(`deleteCustomGroup('grp2'); deleteCustomGroup('${groupId}');`);
  await wait(30);
  const violinAfter = namesInRankOrder('Violin 1');
  const groupRosterGone = window.eval(`JSON.stringify(chart.rosters['${key}'] || null)`) === 'null';
  console.log('  Violin 1 seats:', JSON.stringify(violinAfter), '| group roster removed:', groupRosterGone);
  const t8 = groupRosterGone && JSON.stringify(violinAfter) === JSON.stringify(beforeViolin);
  console.log('  fully restored to the pre-group state:', t8);
  checks.push(t8);

  const pass = checks.every(Boolean);
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
