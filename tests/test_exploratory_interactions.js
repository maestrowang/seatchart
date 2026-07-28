const { JSDOM } = require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(__dirname + '/../index.html','utf8'); const noop=()=>{};
const c={save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,stroke:noop,arc:noop,rect:noop,fillRect:noop,strokeRect:noop,fillText:noop,setLineDash:noop,measureText:()=>({width:10}),clearRect:noop,drawImage:noop,ellipse:noop,roundRect:noop,bezierCurveTo:noop,quadraticCurveTo:noop,getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128),width:w,height:h}),putImageData:noop};
const dom=new JSDOM(html,{url:'https://x.io/',runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
 beforeParse(w){ w.addEventListener('error',e=>console.log('  PAGE ERROR:',e.message));
  w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy(c,{get(t,p){if(p in t)return t[p];if(typeof p==='string'&&(p.endsWith('Style')||['font','lineWidth','lineCap','globalAlpha','textAlign','textBaseline'].includes(p)))return '';return noop;},set(){return true;}});};}});
const {window}=dom; const doc=window.document; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R=[]; const rec=(n,ok,d='')=>R.push({n,ok,d});
(async()=>{
  await wait(300);
  const d=JSON.parse(fs.readFileSync(__dirname + '/latest_upload.json','utf8'));
  const load=async()=>{ window.eval('applyLoadedChartData('+JSON.stringify(d)+",'t')"); await wait(40); window.eval('clearSelection()'); await wait(8); };
  const pos=()=>window.eval('JSON.stringify(chart.seats.map(s=>[Math.round(s.x*100),Math.round(s.y*100)]))');
  const drag=async(id,vals)=>{ const el=doc.getElementById(id);
    el.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true})); await wait(4);
    for(const v of vals){ el.value=v; el.dispatchEvent(new window.Event('input',{bubbles:true})); await wait(4); }
    el.dispatchEvent(new window.Event('change',{bubbles:true})); await wait(4); };

  // 1. UNDO restores exactly, for each slider
  for(const id of ['seatSpacing','rowSpacingSlider','stageSpacingSlider']){
    await load();
    const before=pos();
    await drag(id,[130]);
    const moved = pos()!==before;
    window.eval('undo()'); await wait(20);
    rec(`undo after ${id} restores the chart exactly`, moved && pos()===before, moved?'':'(slider had no effect to undo)');
  }

  // 2. UNDO then REDO
  await load();
  const b2=pos(); await drag('rowSpacingSlider',[135]); const after2=pos();
  window.eval('undo()'); await wait(15); window.eval('redo()'); await wait(15);
  rec('redo after undo returns to the adjusted layout', pos()===after2 && after2!==b2);

  // 3. Save/load round-trip after a spacing change
  await load(); await drag('rowSpacingSlider',[125]); await drag('seatSpacing',[92]);
  const savedPos=pos();
  const saved=window.eval('JSON.stringify(chart)');
  window.eval('applyLoadedChartData('+saved+",'roundtrip')"); await wait(30);
  rec('save/load round-trip preserves adjusted positions', pos()===savedPos);

  // 4. Hidden seats are not stranded or moved
  await load();
  window.eval('chart.seats[3].hidden=true; chart.seats[11].hidden=true;'); await wait(5);
  const hiddenBefore=window.eval('JSON.stringify(chart.seats.filter(s=>s.hidden).map(s=>[s.x,s.y]))');
  await drag('rowSpacingSlider',[130]);
  rec('hidden seats are left untouched by spacing', window.eval('JSON.stringify(chart.seats.filter(s=>s.hidden).map(s=>[s.x,s.y]))')===hiddenBefore);

  // 5. Text boxes unaffected by seat spacing
  await load();
  window.eval("chart.textBoxes.push({id:'tb1',x:200,y:200,text:'Notes',fontSize:16,bold:false,italic:false,underline:false,align:'center'})"); await wait(5);
  await drag('seatSpacing',[140]);
  rec('text boxes are not dragged around by seat spacing', window.eval("JSON.stringify(getTextBox('tb1'))").includes('"x":200'));

  // 6. Roster assignments survive spacing (seats keep their identity/order)
  await load();
  window.eval("chart.rosters['Violin 1']=['A','B','C','D','E','F','G','H','I','J','K','L']"); await wait(5);
  const rosterBefore=window.eval('JSON.stringify([...getRosterAssignments().entries()].sort())');
  await drag('seatSpacing',[80]);
  rec('roster names stay on the same seats after spacing', window.eval('JSON.stringify([...getRosterAssignments().entries()].sort())')===rosterBefore);

  // 7. Degenerate charts must not crash or produce NaN
  for(const [label,setup] of [
    ['a single seat', "chart.seats=[{id:'a',x:450,y:400,label:'1',color:'#B9AF95',row:0,rowT:0,preset:''}];chart.rowIndex=1;chart.rowShapes=['arc'];chart.rowRadii=[177];chart.rowSeatSpacingPct=[100];"],
    ['two identical positions', "chart.seats=[{id:'a',x:450,y:400,label:'1',color:'#B9AF95',row:0,rowT:0,preset:''},{id:'b',x:450,y:400,label:'2',color:'#B9AF95',row:0,rowT:1,preset:''}];chart.rowIndex=1;chart.rowShapes=['arc'];chart.rowRadii=[177];chart.rowSeatSpacingPct=[100];"],
    ['all seats at the podium', "chart.seats=[0,1,2].map(i=>({id:'z'+i,x:450,y:podiumAnchorY(),label:String(i),color:'#B9AF95',row:0,rowT:i/2,preset:''}));chart.rowIndex=1;chart.rowShapes=['arc'];chart.rowRadii=[1];chart.rowSeatSpacingPct=[100];"],
  ]){
    window.eval(setup); window.eval('clearSelection()'); await wait(8);
    let crashed=false;
    try { await drag('rowSpacingSlider',[60,160]); await drag('seatSpacing',[60,160]); await drag('stageSpacingSlider',[60,160]); }
    catch(e){ crashed=true; }
    const finite=window.eval('chart.seats.every(s=>isFinite(s.x)&&isFinite(s.y))');
    rec(`${label}: survives every slider without crashing or going non-finite`, !crashed && finite);
  }

  R.forEach(r=>console.log(`  ${r.ok?'PASS':'FAIL'}  ${r.n}${r.d?'  '+r.d:''}`));
  const f=R.filter(r=>!r.ok).length;
  console.log(`\n${R.length-f}/${R.length} exploratory checks passed`);
  console.log(f===0?'RESULT: PASS':'RESULT: FAIL');
})().catch(e=>{console.error('ERROR:',e);console.log('RESULT: FAIL');});
