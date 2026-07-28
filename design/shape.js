// ===========================================================================
// SHAPE-AWARE ROW MODEL
//
// The earlier model described a seat by depth (how far back) and lateral (how
// far sideways). Measured on real charts that is the wrong frame for a curved
// row: an arc's seats vary by up to 293px in DEPTH but only a few px in RADIUS
// from the podium. So depth-banding tore single arcs apart, and depth-based
// transforms moved an arc's centre while barely touching its edges -- exactly
// the "only the middle moves" and "the arch pinches" behaviour reported.
//
// A row is a curve. Work in the frame that curve naturally lives in:
//     an arc  -> (radius from podium, angle about podium)
//     a line  -> (depth, lateral)
// Row spacing moves the whole curve away from the podium, so every seat --
// edge and centre alike -- travels together. Seat spacing redistributes seats
// ALONG the curve, so an arc keeps its shape and its edges spread too.
// ===========================================================================

// A row reads as flat when it barely rises across its own width. This is a far
// more robust discriminator than least-squares curve fitting, which a couple of
// stray freeform chairs sitting near the row can easily skew.
function isFlatRow(pts){
  if(pts.length < 3) return true;
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  const spanX = Math.max(...xs)-Math.min(...xs);
  const spanY = Math.max(...ys)-Math.min(...ys);
  if(spanX < 1) return false;
  return (spanY / spanX) < 0.25;
}

function splitByGaps(values, indices){
  const order = indices.slice().sort((a,b)=>values[a]-values[b]);
  const gaps = [];
  for(let i=1;i<order.length;i++) gaps.push(values[order[i]]-values[order[i-1]]);
  const nz = gaps.filter(g=>g>0.5).sort((a,b)=>a-b);
  const med = nz.length ? nz[Math.floor(nz.length/2)] : 1;
  const cut = Math.max(med*2.5, 12);
  const out=[]; let cur=[order[0]];
  for(let i=0;i<gaps.length;i++){
    if(gaps[i] > cut){ out.push(cur); cur=[]; }
    cur.push(order[i+1]);
  }
  out.push(cur);
  return out;
}

const median = a => { const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };

function buildRows(seats, podium){
  if(seats.length === 0) return [];
  const idx = seats.map((_,i)=>i);
  const radius = seats.map(s=>Math.hypot(s.x-podium.x, s.y-podium.y));
  let bands = splitByGaps(radius, idx);

  // Radius banding groups a curved row perfectly, because its radius is what
  // stays constant. A STRAIGHT row's radius genuinely varies along its length,
  // so it can arrive here in pieces. Those pieces all sit at the same depth,
  // so rejoin neighbouring bands that share a depth.
  let merged = true;
  while(merged && bands.length > 1){
    merged = false;
    for(let i=0;i<bands.length-1;i++){
      const yA = median(bands[i].map(j=>seats[j].y));
      const yB = median(bands[i+1].map(j=>seats[j].y));
      if(Math.abs(yA-yB) < 16){
        bands.splice(i, 2, bands[i].concat(bands[i+1]));
        merged = true;
        break;
      }
    }
  }
  // Keep bands ordered from the front of the stage backwards.
  bands.sort((a,b)=>median(a.map(j=>seats[j].y)) > median(b.map(j=>seats[j].y)) ? -1 : 1);
  return bands;
}

module.exports = { isFlatRow, splitByGaps, buildRows, median };
