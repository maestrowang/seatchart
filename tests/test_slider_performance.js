const { JSDOM } = require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('/home/claude/test.html','utf8'); const noop=()=>{};
const c={save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,stroke:noop,arc:noop,rect:noop,fillRect:noop,strokeRect:noop,fillText:noop,setLineDash:noop,measureText:()=>({width:10}),clearRect:noop,drawImage:noop,ellipse:noop,roundRect:noop,bezierCurveTo:noop,quadraticCurveTo:noop,getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128),width:w,height:h}),putImageData:noop};
const dom=new JSDOM(html,{url:'https://x.io/',runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy(c,{get(t,p){if(p in t)return t[p];if(typeof p==='string'&&(p.endsWith('Style')||['font','lineWidth','lineCap','globalAlpha','textAlign','textBaseline'].includes(p)))return '';return noop;},set(){return true;}});};}});
const {window}=dom; const doc=window.document; const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await wait(300);
  console.log('Slider responsiveness vs chart size (a drag fires many of these per second):');
  for(const nRows of [4, 8, 12, 16]){
    window.eval('chart.seats=[];chart.rowIndex=0;chart.rowRadii=[];chart.rowShapes=[];chart.rowSagittaBase=[];chart.rowWidthBase=[];chart.rowSpanRad=[];chart.rowGapBase=[];chart.rowSeatSpacingPct=[];chart.edgeK=undefined;chart.standPositions={};');
    await wait(5);
    // build a chart by hand so the row-add gate does not stop us short
    window.eval(`(()=>{
      const cx=canvas.width/2, anchor=podiumAnchorY();
      for(let r=0;r<${nRows};r++){
        const n=8+r*2, R=120+r*26;
        chart.rowShapes[r]='arc'; chart.rowRadii[r]=R; chart.rowSeatSpacingPct[r]=100;
        chart.rowSpanRad[r]=1.6; chart.rowGapBase[r]=26;
        for(let i=0;i<n;i++){
          const t=(i/(n-1))-0.5, a=t*1.6;
          chart.seats.push({id:'s'+r+'_'+i, x:cx+Math.sin(a)*R, y:anchor-Math.cos(a)*R,
            label:String(i+1), color:'#B9AF95', row:r, rowT:i/(n-1), preset:'', hidden:false});
        }
      }
      chart.rowIndex=${nRows};
    })()`);
    await wait(10);
    const n = window.eval('chart.seats.length');
    window.eval('clearSelection()'); await wait(5);
    const el=doc.getElementById('rowSpacingSlider');
    el.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
    const t0=Date.now();
    const STEPS=20;
    for(let k=0;k<STEPS;k++){
      el.value = 100 + (k%20) - 10;
      el.dispatchEvent(new window.Event('input',{bubbles:true}));
    }
    const ms=(Date.now()-t0)/STEPS;
    el.dispatchEvent(new window.Event('change',{bubbles:true}));
    const verdict = ms < 16 ? 'smooth (60fps)' : ms < 33 ? 'ok (30fps)' : ms < 100 ? 'SLUGGISH' : '*** UNUSABLE ***';
    console.log('  '+String(nRows).padStart(2)+' rows / '+String(n).padStart(3)+' seats: '+ms.toFixed(1).padStart(6)+' ms per slider step   '+verdict);
  }
})().catch(e=>console.error(e));
