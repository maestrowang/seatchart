const { JSDOM } = require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('/home/claude/test.html','utf8'); const noop=()=>{};
const c={save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,stroke:noop,arc:noop,rect:noop,fillRect:noop,strokeRect:noop,fillText:noop,setLineDash:noop,measureText:()=>({width:10}),clearRect:noop,drawImage:noop,ellipse:noop,roundRect:noop,bezierCurveTo:noop,quadraticCurveTo:noop,getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128),width:w,height:h}),putImageData:noop};
const dom=new JSDOM(html,{url:'https://x.io/',runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy(c,{get(t,p){if(p in t)return t[p];if(typeof p==='string'&&(p.endsWith('Style')||['font','lineWidth','lineCap','globalAlpha','textAlign','textBaseline'].includes(p)))return '';return noop;},set(){return true;}});};}});
const {window}=dom; const doc=window.document; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R=[]; const rec=(n,ok,d='')=>R.push({n,ok,d});
(async()=>{
  await wait(300);
  const d=JSON.parse(fs.readFileSync('/home/claude/bass_case.json','utf8'));
  const W=window.eval('canvas.width'), H=window.eval('canvas.height');
  const SEL = "chart.seats.filter(s=>s.preset==='Bass')";
  const setup=async()=>{
    window.eval('applyLoadedChartData('+JSON.stringify(d)+",'t')"); await wait(35);
    window.eval('setSelection('+window.eval(`JSON.stringify(${SEL}.map(s=>s.id))`)+')'); await wait(8);
  };
  const seats=()=>JSON.parse(window.eval(`JSON.stringify(${SEL}.sort((a,b)=>a.x-b.x).map(s=>({id:s.id,x:s.x,y:s.y})))`));
  const orderOf=s=>s.map(o=>o.id).join(',');

  for(const [id,label] of [['seatSpacing','seat'],['rowSpacingSlider','row'],['stageSpacingSlider','stage']]){
    // Drive by dragging: one gesture, many input events.
    await setup();
    const startOrder=orderOf(seats());
    const el=doc.getElementById(id);
    el.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true})); await wait(4);
    for(let v=101;v<=160;v++){ el.value=v; el.dispatchEvent(new window.Event('input',{bubbles:true})); await wait(1); }
    el.dispatchEvent(new window.Event('change',{bubbles:true})); await wait(4);
    const dragged=seats();

    // Drive by keyboard: a browser bumps .value then fires input, and fires
    // change when the key is released.
    await setup();
    const el2=doc.getElementById(id);
    el2.focus();
    for(let v=101;v<=160;v++){ el2.value=v; el2.dispatchEvent(new window.Event('input',{bubbles:true})); await wait(1); }
    el2.dispatchEvent(new window.Event('change',{bubbles:true})); await wait(4);
    const keyed=seats();

    const same = dragged.length===keyed.length &&
      dragged.every((s,i)=>Math.abs(s.x-keyed[i].x)<0.5 && Math.abs(s.y-keyed[i].y)<0.5);
    rec(`${label}: keyboard reaches the same place as dragging`, same,
        same?'':`drag ${dragged.map(s=>Math.round(s.x)).join('/')} vs keys ${keyed.map(s=>Math.round(s.x)).join('/')}`);
    rec(`${label}: keyboard never reverses seat order`, orderOf(keyed)===startOrder);
    rec(`${label}: keyboard never pushes a seat off the stage`,
        !keyed.some(s=>s.x<0||s.x>W||s.y<0||s.y>H));

    // Releasing and stepping again must not compound.
    await setup();
    const el3=doc.getElementById(id);
    el3.focus();
    let prev=null, compounded=false;
    for(let round=0;round<5;round++){
      for(let v=101;v<=160;v++){ el3.value=v; el3.dispatchEvent(new window.Event('input',{bubbles:true})); await wait(1); }
      el3.dispatchEvent(new window.Event('change',{bubbles:true})); await wait(3);
      const now=seats();
      if(prev && now.some((s,i)=>Math.abs(s.x-prev[i].x)>2 || Math.abs(s.y-prev[i].y)>2)) compounded=true;
      prev=now;
    }
    rec(`${label}: repeating the keystrokes does not compound`, !compounded);
    rec(`${label}: slider returns to neutral after a scoped gesture`,
        parseInt(doc.getElementById(id).value)===100, `thumb at ${doc.getElementById(id).value}`);
  }

  R.forEach(r=>console.log(`  ${r.ok?'PASS':'FAIL'}  ${r.n}${r.d?'  '+r.d:''}`));
  const f=R.filter(r=>!r.ok).length;
  console.log(`\n${R.length-f}/${R.length} checks passed`);
  console.log(f===0?'RESULT: PASS':'RESULT: FAIL');
})().catch(e=>{console.error('ERROR:',e);console.log('RESULT: FAIL');});
