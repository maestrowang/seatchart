const M = require('./model.js');
const ANCHOR=577, CENTER=450;
const BOUNDS={minX:42,maxX:858,minY:42,maxY:518};

// Deterministic PRNG so any failure is reproducible from its seed.
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

function randomChart(seed){
  const r = rng(seed);
  const n = 2 + Math.floor(r()*40);
  const style = Math.floor(r()*5);
  const seats = [];
  for(let i=0;i<n;i++){
    let x,y;
    if(style===0){                       // tidy grid
      x = 120 + (i%8)*80; y = ANCHOR - (100 + Math.floor(i/8)*70);
    } else if(style===1){                // fully scattered
      x = 60 + r()*780; y = ANCHOR - (40 + r()*460);
    } else if(style===2){                // arcs
      const ang=(i/n)*2.2-1.1, rad=120+Math.floor(i/6)*80;
      x = CENTER+Math.sin(ang)*rad; y = ANCHOR-(80+(1-Math.cos(ang))*rad*0.8+rad*0.4);
    } else if(style===3){                // tight cluster + far outliers
      x = 400 + r()*60; y = ANCHOR - (200 + r()*30);
      if(i%7===0){ x = 60+r()*780; y = ANCHOR-(40+r()*470); }
    } else {                             // near-degenerate: many identical depths
      x = 100 + (i%12)*62; y = ANCHOR - (150 + (i%3)*2);
    }
    seats.push({ id:`s${i}`, x, y });
  }
  return seats;
}

function bandOrderHolds(snap, after){
  const a=new Map(after.map(p=>[p.id,p.depth]));
  const bmin={};
  snap.points.forEach(p=>{ const b=snap.bandOf.get(p.id);
    bmin[b]=bmin[b]===undefined?a.get(p.id):Math.min(bmin[b],a.get(p.id)); });
  const ks=Object.keys(bmin).map(Number).sort((x,y)=>x-y);
  for(let i=1;i<ks.length;i++) if(bmin[ks[i]]<bmin[ks[i-1]]-1e-6) return false;
  return true;
}
function withinBandLateralHolds(snap, after){
  const a=new Map(after.map(p=>[p.id,p.lateral]));
  const byB={};
  snap.points.forEach(p=>{ const b=snap.bandOf.get(p.id); (byB[b]=byB[b]||[]).push(p); });
  for(const ms of Object.values(byB))
    for(let i=0;i<ms.length;i++) for(let j=i+1;j<ms.length;j++){
      const db=ms[i].lateral-ms[j].lateral, da=a.get(ms[i].id)-a.get(ms[j].id);
      if(Math.abs(db)>1e-6 && Math.abs(da)>1e-6 && Math.sign(db)!==Math.sign(da)) return false;
    }
  return true;
}

const RATIOS=[0.6,0.75,0.9,1.0,1.1,1.25,1.4,1.6];
const failures=[];
const TRIALS=600;

for(let seed=1; seed<=TRIALS; seed++){
  const seats = randomChart(seed);
  const snap = M.prepare(seats, ANCHOR, CENTER);
  const orig = new Map(snap.points.map(p=>[p.id,p]));
  const startOv = M.overflowAmount(snap.points, snap, BOUNDS);

  for(const r of RATIOS){
    const rowOut  = M.transformRowSpacing(snap,r);
    const seatOut = M.transformSeatSpacing(snap,r);

    if(!bandOrderHolds(snap,rowOut))            failures.push(`seed ${seed} r ${r}: rows overtook`);
    if(!withinBandLateralHolds(snap,seatOut))   failures.push(`seed ${seed} r ${r}: within-row order broke`);
    if(seatOut.some(p=>Math.abs(p.depth-orig.get(p.id).depth)>1e-9))
                                                failures.push(`seed ${seed} r ${r}: seat spacing moved depth`);
    for(const [lbl,out] of [['row',rowOut],['seat',seatOut]]){
      if(out.some(p=>!isFinite(p.depth)||!isFinite(p.lateral)))
        failures.push(`seed ${seed} r ${r}: ${lbl} produced non-finite value`);
    }
    for(const [lbl,fn] of [['row',M.transformRowSpacing],['seat',M.transformSeatSpacing]]){
      const fitted = M.applyWithFit(snap, fn, r, BOUNDS);
      if(M.overflowAmount(fitted,snap,BOUNDS) > startOv+0.01)
        failures.push(`seed ${seed} r ${r}: ${lbl} pushed further off-page`);
      if(!bandOrderHolds(snap,fitted))
        failures.push(`seed ${seed} r ${r}: ${lbl} order broke after fitting`);
    }
  }

  // identity and tiny-nudge behaviour
  for(const [lbl,fn] of [['row',M.transformRowSpacing],['seat',M.transformSeatSpacing]]){
    const idMove = Math.max(...fn(snap,1.0).map(p=>{
      const o=orig.get(p.id); return Math.hypot(p.depth-o.depth,p.lateral-o.lateral); }));
    if(idMove>1e-9) failures.push(`seed ${seed}: ${lbl} identity moved seats`);
    const nudge = Math.max(...fn(snap,1.01).map(p=>{
      const o=orig.get(p.id); return Math.hypot(p.depth-o.depth,p.lateral-o.lateral); }));
    if(nudge>15) failures.push(`seed ${seed}: ${lbl} 1% nudge jumped ${nudge.toFixed(0)}px`);
  }
}

console.log(`Fuzzed ${TRIALS} randomly generated charts x ${RATIOS.length} slider values`);
console.log(`across 5 chart styles (grid, scattered, arcs, cluster+outliers, degenerate depths).`);
if(failures.length){
  console.log(`\n${failures.length} failures. First 20:`);
  failures.slice(0,20).forEach(f=>console.log('  - '+f));
} else {
  console.log('\nAll invariants held on every generated chart.');
}
console.log(failures.length===0?'RESULT: PASS':'RESULT: FAIL');
