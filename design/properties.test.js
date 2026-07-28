const M = require('./model.js');
const ANCHOR = 577, CENTER = 450;
const BOUNDS = { minX: 42, maxX: 858, minY: 42, maxY: 518 };

function scenarios(){
  const s = {};
  s['tidy rows'] = [];
  for(let r=0;r<5;r++) for(let i=0;i<8;i++)
    s['tidy rows'].push({ id:`r${r}s${i}`, x: 200+i*60, y: ANCHOR-(120+r*70) });

  s['all freeform (scattered)'] = [];
  for(let i=0;i<24;i++){
    const a=(i*137.5)*Math.PI/180, rad=70+(i%6)*38;
    s['all freeform (scattered)'].push({ id:`f${i}`, x: CENTER+Math.cos(a)*rad*1.4, y: ANCHOR-(120+Math.sin(a)*rad*0.7+rad*0.5) });
  }

  s['rows + hand-nudged strays'] = [];
  for(let r=0;r<4;r++) for(let i=0;i<7;i++)
    s['rows + hand-nudged strays'].push({ id:`r${r}s${i}`, x: 220+i*65, y: ANCHOR-(130+r*75) });
  s['rows + hand-nudged strays'].push({ id:'stray-close', x:120, y:ANCHOR-79 });
  s['rows + hand-nudged strays'].push({ id:'stray-off',   x:800, y:ANCHOR-300 });
  s['rows + hand-nudged strays'].push({ id:'stray-mid',   x:450, y:ANCHOR-205 });

  s['straight seats inside curved row'] = [];
  for(let i=0;i<11;i++){
    const t=(i-5)/5, ang=t*0.9;
    s['straight seats inside curved row'].push({ id:`arc${i}`, x:CENTER+Math.sin(ang)*300, y:ANCHOR-(200+(1-Math.cos(ang))*300) });
  }
  for(let i=0;i<5;i++)
    s['straight seats inside curved row'].push({ id:`flat${i}`, x:320+i*58, y:ANCHOR-368 });

  s['single row only'] = [];
  for(let i=0;i<6;i++) s['single row only'].push({ id:`o${i}`, x:250+i*70, y:ANCHOR-200 });

  s['two seats'] = [{id:'a',x:400,y:ANCHOR-150},{id:'b',x:500,y:ANCHOR-260}];

  s['near-edge cluster'] = [];
  for(let i=0;i<9;i++) s['near-edge cluster'].push({ id:`e${i}`, x:60+i*95, y:ANCHOR-(470-(i%2)*8) });

  s['wildly uneven depths'] = [
    {id:'p0',x:450,y:ANCHOR-60},{id:'p1',x:300,y:ANCHOR-65},
    {id:'p2',x:600,y:ANCHOR-300},{id:'p3',x:200,y:ANCHOR-310},{id:'p4',x:700,y:ANCHOR-480},
  ];

  s['dense single cluster'] = [];
  for(let i=0;i<12;i++) s['dense single cluster'].push({ id:`d${i}`, x:400+(i%4)*22, y:ANCHOR-(250+Math.floor(i/4)*7) });

  return s;
}

const RATIOS=[0.6,0.7,0.8,0.9,0.95,0.99,1.0,1.01,1.05,1.1,1.2,1.3,1.45,1.6];
const results=[];
const record=(n,ok,d='')=>results.push({name:n,ok,detail:d});

// Order must hold WITHIN a band. Across different bands, lateral crossing is
// legitimate -- real rows have different widths and centres, so a seat in one
// row being left of a seat in another is normal, not a swap.
function withinBandOrderHolds(snap, after, key){
  const a = new Map(after.map(p=>[p.id,p[key]]));
  const byBand = {};
  snap.points.forEach(p=>{
    const b = snap.bandOf.get(p.id);
    (byBand[b] = byBand[b] || []).push(p);
  });
  for(const members of Object.values(byBand)){
    for(let i=0;i<members.length;i++) for(let j=i+1;j<members.length;j++){
      const db = members[i][key]-members[j][key];
      const da = a.get(members[i].id)-a.get(members[j].id);
      if(Math.abs(db)>1e-6 && Math.abs(da)>1e-6 && Math.sign(db)!==Math.sign(da))
        return {ok:false, detail:`${members[i].id} vs ${members[j].id}: ${db.toFixed(2)} -> ${da.toFixed(2)}`};
    }
  }
  return {ok:true};
}

// Band ORDER front-to-back must never invert -- this is the real "no overtaking".
function bandOrderHolds(snap, after){
  const a = new Map(after.map(p=>[p.id,p.depth]));
  const bandMin = {};
  snap.points.forEach(p=>{
    const b = snap.bandOf.get(p.id);
    bandMin[b] = bandMin[b] === undefined ? a.get(p.id) : Math.min(bandMin[b], a.get(p.id));
  });
  const keys = Object.keys(bandMin).map(Number).sort((x,y)=>x-y);
  for(let i=1;i<keys.length;i++){
    if(bandMin[keys[i]] < bandMin[keys[i-1]] - 1e-6)
      return {ok:false, detail:`band ${keys[i-1]} -> ${keys[i]} inverted`};
  }
  return {ok:true};
}

for(const [name, seats] of Object.entries(scenarios())){
  const snap = M.prepare(seats, ANCHOR, CENTER);
  const orig = new Map(snap.points.map(p=>[p.id,p]));
  const moveOf = out => Math.max(...out.map(p=>{
    const o = orig.get(p.id);
    return Math.hypot(p.depth-o.depth, p.lateral-o.lateral);
  }));

  // P1 identity
  for(const [lbl,fn] of [['row',M.transformRowSpacing],['seat',M.transformSeatSpacing]])
    record(`[${name}] ${lbl}: neutral slider changes nothing`, moveOf(fn(snap,1.0)) < 1e-9);

  // P2 no jump on a tiny nudge
  for(const [lbl,fn] of [['row',M.transformRowSpacing],['seat',M.transformSeatSpacing]]){
    const mv = moveOf(fn(snap,1.01));
    record(`[${name}] ${lbl}: 1% nudge moves <=12px`, mv < 12, `max ${mv.toFixed(1)}px`);
  }

  // P3 no front/back overtaking
  for(const r of RATIOS){
    const res = bandOrderHolds(snap, M.transformRowSpacing(snap,r));
    record(`[${name}] row @${r}: no row overtakes another`, res.ok, res.detail||'');
  }

  // P4 seat spacing leaves depth completely alone
  for(const r of RATIOS){
    const out = M.transformSeatSpacing(snap,r);
    record(`[${name}] seat @${r}: depth untouched`, !out.some(p=>Math.abs(p.depth-orig.get(p.id).depth)>1e-9));
  }

  // P5 within-row left/right order preserved
  for(const r of RATIOS){
    const res = withinBandOrderHolds(snap, M.transformSeatSpacing(snap,r), 'lateral');
    record(`[${name}] seat @${r}: within-row order preserved`, res.ok, res.detail||'');
  }

  // P6 monotonic response across the slider
  let mono=true, prev=-Infinity;
  for(const r of RATIOS){
    const o=M.transformRowSpacing(snap,r);
    const v=Math.max(...o.map(p=>p.depth))-Math.min(...o.map(p=>p.depth));
    if(v<prev-1e-9) mono=false; prev=v;
  }
  record(`[${name}] row: response monotonic across whole slider`, mono);

  // P7 never pushed further off-page than it started
  const startOv = M.overflowAmount(snap.points, snap, BOUNDS);
  for(const [lbl,fn] of [['row',M.transformRowSpacing],['seat',M.transformSeatSpacing]]){
    for(const r of [0.6,1.3,1.6]){
      const out = M.applyWithFit(snap, fn, r, BOUNDS);
      const ov = M.overflowAmount(out, snap, BOUNDS);
      record(`[${name}] ${lbl} @${r}: no worse off-page than start`, ov <= startOv+0.01, `${startOv.toFixed(1)} -> ${ov.toFixed(1)}`);
      const res = bandOrderHolds(snap, out);
      record(`[${name}] ${lbl} @${r}: order holds after fitting`, res.ok, res.detail||'');
    }
  }

  // P8 path independence -- the same slider value always means the same thing
  const direct = M.transformRowSpacing(snap,1.3);
  const viaOther = (()=>{ M.transformRowSpacing(snap,0.7); M.transformRowSpacing(snap,1.6); return M.transformRowSpacing(snap,1.3); })();
  const pathErr = Math.max(...direct.map(p=>Math.abs(p.depth-viaOther.find(q=>q.id===p.id).depth)));
  record(`[${name}] row: same value = same result regardless of path`, pathErr<1e-9, `err ${pathErr}`);

  // P9 round trip
  const rtSnap = M.prepare(M.transformRowSpacing(snap,1.3).map(p=>M.fromPolar(p,ANCHOR,CENTER)), ANCHOR, CENTER);
  const back = M.transformRowSpacing(rtSnap, 1/1.3);
  const rtErr = Math.max(...back.map(p=>Math.abs(p.depth-orig.get(p.id).depth)));
  record(`[${name}] row: stretch then un-stretch returns home`, rtErr<0.01, `err ${rtErr.toFixed(3)}`);

  // P10 continuity -- no discontinuity anywhere along the drag
  let maxStep=0;
  for(let r=0.6;r<1.6;r+=0.01){
    const a=M.transformRowSpacing(snap,r), b=M.transformRowSpacing(snap,r+0.01);
    for(const p of a) maxStep=Math.max(maxStep, Math.abs(p.depth-b.find(z=>z.id===p.id).depth));
  }
  record(`[${name}] row: no discontinuity along the drag`, maxStep<15, `max step ${maxStep.toFixed(2)}px`);
}

const failed = results.filter(r=>!r.ok);
const by={};
results.forEach(r=>{ const k=r.name.match(/^\[(.+?)\]/)[1]; by[k]=by[k]||{p:0,f:0}; r.ok?by[k].p++:by[k].f++; });
console.log('Scenario coverage:');
Object.entries(by).forEach(([k,v])=>console.log(`  ${v.f===0?'PASS':'FAIL'}  ${k}: ${v.p} passed${v.f?`, ${v.f} FAILED`:''}`));
console.log(`\nTotal: ${results.length-failed.length}/${results.length} properties held`);
if(failed.length){ console.log('\nFailures:'); failed.slice(0,20).forEach(f=>console.log(`  - ${f.name} ${f.detail}`)); }
console.log(failed.length===0?'RESULT: PASS':'RESULT: FAIL');
