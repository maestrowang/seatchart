// ============================================================================
// UNIFIED SPACING MODEL -- pure functions, no DOM, fully testable in isolation.
//
// WHY THIS EXISTS: the previous implementation split seats into four categories
// (normal / manually-moved / custom-layout / freeform) x three sliders = twelve
// code paths, each with its own snapshot and its own clamp. Fixing one cell
// routinely broke another, which is why recent fixes felt like regressions.
// This model erases the categories entirely.
//
// THE VISUAL MODEL: ignore row metadata. Every seat is just a point, described
// relative to the podium:
//     depth   = how far BACK it sits   (bigger = farther from the audience)
//     lateral = how far SIDEWAYS from centre
// Seats sitting at a similar depth read as "a row" whether or not the data says
// so. That is what makes an all-freeform chart behave like a rowed one.
//
// THE THREE SLIDERS AS VISUAL INTENT:
//     stage spacing -- slide the whole formation toward/away from the audience
//     row  spacing  -- spread the depth-bands apart from one another
//     seat spacing  -- spread seats sideways within their own band
//
// THE KEY PROPERTY: every transform is MONOTONIC in the coordinate it changes,
// so seats mathematically cannot swap or overtake a neighbouring band. That is
// a property of the transform's shape, not something patched up afterwards by
// clamping individual seats -- which is exactly what made seats jump before.
// ============================================================================

const BAND_TOLERANCE = 28; // fallback when a chart is too sparse to infer a scale from

// How close in depth two seats must be to read as the same visual row. This is
// derived from the chart's OWN scale rather than being a fixed pixel value: a
// fixed threshold sits arbitrarily close to some charts' real row gaps, so a
// modest stretch tips those gaps across it and silently re-groups the seats.
// Deriving it from the median gap means every gap and the threshold scale
// together, so stretching a chart never changes which seats read as a row.
function bandTolerance(points){
  if(points.length < 2) return BAND_TOLERANCE;
  const depths = points.map(p=>p.depth).sort((a,b)=>a-b);
  const gaps = [];
  for(let i=1;i<depths.length;i++){
    const g = depths[i]-depths[i-1];
    if(g > 0.5) gaps.push(g);           // ignore seats sharing a depth exactly
  }
  if(gaps.length === 0) return BAND_TOLERANCE;
  gaps.sort((a,b)=>a-b);
  const median = gaps[Math.floor(gaps.length/2)];
  return Math.max(6, median * 0.55);
}

function toPolar(seat, anchorY, centerX){
  return { id: seat.id, depth: anchorY - seat.y, lateral: seat.x - centerX };
}
function fromPolar(p, anchorY, centerX){
  return { id: p.id, x: centerX + p.lateral, y: anchorY - p.depth };
}

// Groups seats into visual rows by depth alone. A seat's declared row, whether
// it was dragged by hand, and whether it is freeform are all irrelevant: if it
// LOOKS like it belongs to a row, it is treated as belonging to that row.
function buildBands(points, tolerance){
  if(tolerance === undefined) tolerance = bandTolerance(points);
  if(points.length === 0) return [];
  const sorted = points.slice().sort((a,b)=>a.depth - b.depth);
  const groups = [];
  let current = [sorted[0]];
  for(let i=1;i<sorted.length;i++){
    if(sorted[i].depth - current[current.length-1].depth <= tolerance) current.push(sorted[i]);
    else { groups.push(current); current = [sorted[i]]; }
  }
  groups.push(current);
  // Mean depth, so one stray seat cannot drag its band's reference point around.
  return groups.map(members=>({
    depth: members.reduce((s,p)=>s+p.depth,0)/members.length,
    memberIds: members.map(m=>m.id),
  }));
}

// ---------------------------------------------------------------- SNAPSHOT
// Everything a gesture needs, frozen at the moment the drag begins. Banding is
// captured HERE and never recomputed mid-drag: stretching the chart can shift
// which seats look like they share a row, and re-grouping partway through a
// gesture makes seats drift and regroup under the cursor.
function prepare(seats, anchorY, centerX){
  const points = seats.map(s=>toPolar(s, anchorY, centerX));
  const bands = buildBands(points);
  const bandOf = new Map();
  bands.forEach((b,i)=>b.memberIds.forEach(id=>bandOf.set(id,i)));
  return {
    anchorY, centerX,
    points,                                  // original positions -- the single source of truth
    bands: bands.map(b=>({ depth:b.depth })), // frozen band depths
    bandOf,                                  // seat id -> frozen band index
    bandCentre: (()=>{
      const centres = bands.map(b=>{
        const ms = b.memberIds.map(id=>points.find(p=>p.id===id));
        return ms.reduce((s,p)=>s+p.lateral,0)/ms.length;
      });
      // A seat alone at its own depth has no centre of its own to spread from,
      // so it would sit frozen while everything else moved. Borrow the nearest
      // populated band's centre so it travels with the row it looks part of.
      const overall = points.length ? points.reduce((s,p)=>s+p.lateral,0)/points.length : 0;
      bands.forEach((b,i)=>{
        if(b.memberIds.length >= 2) return;
        let best=-1, bestDist=Infinity;
        bands.forEach((o,j)=>{
          if(j===i || o.memberIds.length<2) return;
          const dist=Math.abs(bands[j].depth-bands[i].depth);
          if(dist<bestDist){ bestDist=dist; best=j; }
        });
        // If nothing forms a row either, spread around the group's collective centre.
        centres[i] = best!==-1 ? centres[best] : overall;
      });
      return centres;
    })(),
  };
}

// ------------------------------------------------------------- TRANSFORMS
// All three take the ORIGINAL snapshot and a slider value, and return fresh
// positions. None of them read the seats' live positions, so repeated slider
// movement never compounds -- dragging to 130% always means the same thing
// regardless of the path taken to get there.

// STAGE: translate every depth equally. Trivially order-preserving.
function transformStage(snap, deltaDepth){
  return snap.points.map(p=>({ ...p, depth: p.depth + deltaDepth }));
}

// ROW: scale the GAPS between consecutive bands. The frontmost band anchors in
// place. Each seat keeps its own offset within its band, scaled by the same
// ratio so everything expands and compresses together.
// Monotonic for any ratio > 0: gaps stay strictly positive, so band order holds;
// offsets scale by the same factor, so within-band order holds too.
function transformRowSpacing(snap, ratio){
  if(snap.bands.length === 0) return snap.points.slice();
  const newBandDepth = [snap.bands[0].depth];
  for(let i=1;i<snap.bands.length;i++){
    const gap = snap.bands[i].depth - snap.bands[i-1].depth;
    newBandDepth[i] = newBandDepth[i-1] + gap * ratio;
  }
  return snap.points.map(p=>{
    const bi = snap.bandOf.get(p.id);
    const offset = p.depth - snap.bands[bi].depth;
    return { ...p, depth: newBandDepth[bi] + offset * ratio };
  });
}

// SEAT: scale lateral spread within each band, around that band's own centre.
// Depth is never touched, so seat spacing structurally cannot make a seat
// overtake the row in front or behind -- a whole class of past bugs made
// impossible by construction rather than guarded against after the fact.
function transformSeatSpacing(snap, ratio){
  return snap.points.map(p=>{
    const bi = snap.bandOf.get(p.id);
    const centre = snap.bandCentre[bi];
    return { ...p, lateral: centre + (p.lateral - centre) * ratio };
  });
}

// ------------------------------------------------------------ FIT TO PAGE
// If a transform pushes seats off-page we do NOT clamp individual seats -- that
// is what made them pile up against an edge and jump the moment a slider moved.
// Instead we ease the ratio back toward neutral and re-apply the SAME transform
// more gently, so relative positions stay intact and monotonicity survives.
// The goal is "never worse than where it started", so a chart that already had
// seats off-page is left alone rather than being yanked back into frame.
function overflowAmount(points, snap, bounds){
  let worst = 0;
  for(const p of points){
    const s = fromPolar(p, snap.anchorY, snap.centerX);
    worst = Math.max(worst,
      bounds.minX - s.x, s.x - bounds.maxX,
      bounds.minY - s.y, s.y - bounds.maxY, 0);
  }
  return worst;
}

function applyWithFit(snap, transform, ratio, bounds, identityRatio = 1){
  const startOverflow = overflowAmount(snap.points, snap, bounds);
  let candidate = transform(snap, ratio);
  if(overflowAmount(candidate, snap, bounds) <= startOverflow + 0.001) return candidate;
  const steps = 24;
  for(let i=1;i<=steps;i++){
    const eased = ratio + (identityRatio - ratio) * (i/steps);
    candidate = transform(snap, eased);
    if(overflowAmount(candidate, snap, bounds) <= startOverflow + 0.001) return candidate;
  }
  return transform(snap, identityRatio);
}

module.exports = {
  BAND_TOLERANCE, bandTolerance, toPolar, fromPolar, buildBands, prepare,
  transformStage, transformRowSpacing, transformSeatSpacing,
  overflowAmount, applyWithFit,
};
