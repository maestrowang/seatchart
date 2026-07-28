const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
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
    window.HTMLCanvasElement.prototype.getBoundingClientRect = function(){
      return { left: 0, top: 0, width: this.width, height: this.height };
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  const doc = window.document;

  console.log('=== Set up: 8-seat section with names, some with stand partners ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(8, 'straight');
    chart.seats.forEach(s=>{ s.preset='Violin 1'; s.color='#3EA6CC'; });
    chart.rosters['Violin 1'] = ['P1','P2','P3','P4','P5','P6','P7','P8'];
  `);
  await wait(20);

  // Link rank1+rank2 as stand partners, and rank3+rank4
  window.eval(`
    const ranks = computeAllSeatRanks();
    const seats = chart.seats.filter(s=>s.preset==='Violin 1');
    const byRank = {}; seats.forEach(s=>{ byRank[ranks.get(s.id)] = s; });
    byRank[1].standPartner = byRank[2].id; byRank[2].standPartner = byRank[1].id;
    byRank[3].standPartner = byRank[4].id; byRank[4].standPartner = byRank[3].id;
  `);
  await wait(10);

  console.log('=== Test 1: before shuffle, assignments match true roster order exactly ===');
  const beforeShuffle = window.eval(`
    const ranks = computeAllSeatRanks();
    const a = getRosterAssignments();
    const seats = chart.seats.filter(s=>s.preset==='Violin 1');
    JSON.stringify(seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id)).map(s=>a.get(s.id)))
  `);
  console.log('Assignments before shuffle (rank order):', beforeShuffle);
  const identityBefore = beforeShuffle === JSON.stringify(['P1','P2','P3','P4','P5','P6','P7','P8']);
  console.log('Matches identity (P1..P8 in order):', identityBefore);

  console.log('=== Test 2: shuffle WITHOUT preserving partners changes assignment order ===');
  window.eval("shuffleRosterSection('Violin 1', false)");
  const afterShuffle = window.eval(`
    const ranks = computeAllSeatRanks();
    const a = getRosterAssignments();
    const seats = chart.seats.filter(s=>s.preset==='Violin 1');
    JSON.stringify(seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id)).map(s=>a.get(s.id)))
  `);
  console.log('Assignments after shuffle:', afterShuffle);
  const changed = afterShuffle !== beforeShuffle;
  console.log('Order actually changed:', changed);
  const trueRosterUntouched = window.eval("JSON.stringify(chart.rosters['Violin 1'])") === JSON.stringify(['P1','P2','P3','P4','P5','P6','P7','P8']);
  console.log('True underlying roster array UNTOUCHED by shuffle:', trueRosterUntouched);

  console.log('=== Test 3: revert restores the exact original assignment ===');
  window.eval("revertRosterShuffle('Violin 1')");
  const afterRevert = window.eval(`
    const ranks = computeAllSeatRanks();
    const a = getRosterAssignments();
    const seats = chart.seats.filter(s=>s.preset==='Violin 1');
    JSON.stringify(seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id)).map(s=>a.get(s.id)))
  `);
  console.log('Assignments after revert:', afterRevert);
  const revertedCorrectly = afterRevert === beforeShuffle;
  console.log('Exactly restored to original:', revertedCorrectly);

  console.log('=== Test 4: shuffle WITH preserve-partners keeps stand-linked names together ===');
  let partnersPreservedAllTrials = true;
  for(let trial = 0; trial < 15; trial++){
    window.eval("revertRosterShuffle('Violin 1')");
    window.eval("shuffleRosterSection('Violin 1', true)");
    const result = JSON.parse(window.eval(`
      const ranks = computeAllSeatRanks();
      const a = getRosterAssignments();
      const seats = chart.seats.filter(s=>s.preset==='Violin 1');
      JSON.stringify(seats.sort((x,y)=>ranks.get(x.id)-ranks.get(y.id)).map(s=>({rank:ranks.get(s.id), name:a.get(s.id), standPartner:s.standPartner})))
    `));
    // rank1&2 are partners, rank3&4 are partners -- each stand-pair-position should
    // host one of the two KNOWN valid pairs together, though WHICH stand they land at
    // can vary (that's expected -- only staying together matters, not which stand).
    const pair12 = [result[0].name, result[1].name].sort();
    const pair34 = [result[2].name, result[3].name].sort();
    const validPairs = [JSON.stringify(['P1','P2']), JSON.stringify(['P3','P4'])];
    const pair12Valid = validPairs.includes(JSON.stringify(pair12));
    const pair34Valid = validPairs.includes(JSON.stringify(pair34));
    const bothPairsIntact = pair12Valid && pair34Valid && JSON.stringify(pair12) !== JSON.stringify(pair34);
    if(!bothPairsIntact){
      partnersPreservedAllTrials = false;
      console.log('Trial', trial, 'FAILED - pair12:', pair12, 'pair34:', pair34);
    }
  }
  console.log('Stand partners stayed together across 15 shuffle trials:', partnersPreservedAllTrials);

  console.log('=== Test 5: drag reordering disabled in the roster panel while shuffled ===');
  window.eval("revertRosterShuffle('Violin 1'); shuffleRosterSection('Violin 1', false);");
  doc.getElementById('rosterToggleBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  doc.getElementById('rosterSectionSelect').value = 'Violin 1';
  doc.getElementById('rosterSectionSelect').dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(20);
  const rows = Array.from(doc.querySelectorAll('.roster-name-row'));
  const noneDraggable = rows.every(r => r.draggable === false);
  console.log('No rows draggable while shuffled:', noneDraggable);
  const revertVisible = doc.getElementById('rosterRevertBtn').style.display === 'block';
  console.log('Revert button visible while shuffled:', revertVisible);
  const noteVisible = doc.getElementById('rosterShuffleNote').style.display === 'block';
  console.log('Shuffle note visible:', noteVisible);

  console.log('=== Test 6: revert via button re-enables dragging ===');
  doc.getElementById('rosterRevertBtn').dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
  await wait(20);
  const rowsAfterRevert = Array.from(doc.querySelectorAll('.roster-name-row'));
  const allDraggableAgain = rowsAfterRevert.every(r => r.draggable === true);
  console.log('Rows draggable again after revert:', allDraggableAgain);
  const revertHiddenAfter = doc.getElementById('rosterRevertBtn').style.display === 'none';
  console.log('Revert button hidden again after reverting:', revertHiddenAfter);

  console.log('=== Test 7: inline-editing a name while shuffled writes to the TRUE underlying slot ===');
  window.eval("shuffleRosterSection('Violin 1', false)");
  await wait(10);
  const shuffledSeatAtRank1 = window.eval(`
    const ranks = computeAllSeatRanks();
    chart.seats.find(s=>s.preset==='Violin 1' && ranks.get(s.id)===1).id
  `);
  const nameShownAtRank1 = window.eval(`getRosterAssignments().get('${shuffledSeatAtRank1}')`);
  console.log('Name currently shown at rank 1 (shuffled):', nameShownAtRank1);
  window.eval(`applyRosterNameEdit(getSeat('${shuffledSeatAtRank1}'), 'EditedName')`);
  await wait(10);
  const trueArrayAfterEdit = JSON.parse(window.eval("JSON.stringify(chart.rosters['Violin 1'])"));
  const editLandedOnTrueSlot = trueArrayAfterEdit.includes('EditedName') && !trueArrayAfterEdit.includes(nameShownAtRank1);
  console.log('True roster array after edit:', JSON.stringify(trueArrayAfterEdit));
  console.log('Edit correctly replaced the TRUE slot for that name (not slot 0):', editLandedOnTrueSlot);

  const pass = identityBefore && changed && trueRosterUntouched && revertedCorrectly &&
               partnersPreservedAllTrials && noneDraggable && revertVisible && noteVisible &&
               allDraggableAgain && revertHiddenAfter && editLandedOnTrueSlot;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
