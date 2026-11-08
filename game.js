(() => {
  'use strict';
  const canvas = document.getElementById('farm');
  const ctx = canvas.getContext('2d');
  const TILE = 80, COLS = 13, ROWS = 9;
  const FIELD = {x:4,y:3,w:5,h:4};
  const $ = id => document.getElementById(id);
  const ui = {
    seasonDay:$('seasonDay'),time:$('timeLabel'),coins:$('coins'),seedCount:$('seedCount'),inventorySeeds:$('inventorySeeds'),
    carrots:$('inventoryCarrots'),harvest:$('harvestCount'),sellValue:$('sellValue'),dialogSellValue:$('dialogSellValue'),
    questCount:$('questCount'),questProgress:$('questProgress'),fieldTip:$('fieldTip'),energy:$('energyFill'),badge:$('ripeBadge'),
    toast:$('toast'),weatherIcon:$('weatherIcon'),weatherLabel:$('weatherLabel')
  };
  const createState = () => ({day:1,coins:40,seeds:8,carrots:0,energy:100,time:360,tool:'hoe',player:{x:6,y:7,fx:6,fy:7,dir:'up'},crops:{},quest:0,harvested:0,weather:'Clear skies',firstVisit:true});
  let state = createState(), toastTimer, mouse = null, frame = 0, lastAction = 0, shake = 0;
  try { const saved = JSON.parse(localStorage.getItem('littleAcreSave')||'null'); if(saved && saved.version===1){ state={...createState(),...saved.data,player:{...createState().player,...saved.data.player}}; } } catch(_) {}
  const save = () => { try { localStorage.setItem('littleAcreSave',JSON.stringify({version:1,data:state})); } catch(_){} };
  const keyOf = (x,y) => `${x},${y}`;
  const cell = (x,y) => state.crops[keyOf(x,y)] || null;
  const inField = (x,y) => x>=FIELD.x && x<FIELD.x+FIELD.w && y>=FIELD.y && y<FIELD.y+FIELD.h;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hash = (x,y,n=0) => {const a=Math.sin(x*127.1+y*311.7+n*74.7)*43758.5453;return a-Math.floor(a);};
  const center = (x,y) => ({x:x*TILE+TILE/2,y:y*TILE+TILE/2});

  function toast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2100)}
  function updateUI(){
    ui.seasonDay.textContent=`Spring · Day ${state.day}`;
    const h=Math.floor(state.time/60),m=state.time%60;ui.time.textContent=`${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
    ui.coins.textContent=state.coins;ui.seedCount.textContent=state.seeds;ui.inventorySeeds.textContent=state.seeds;
    ui.carrots.textContent=state.carrots;ui.harvest.textContent=state.carrots;
    ui.sellValue.textContent=`${state.carrots*18} coins  ↗`;ui.dialogSellValue.textContent=`${state.carrots*18} ✦`;
    ui.questCount.textContent=`${Math.min(state.quest,4)} / 4`;ui.questProgress.style.width=`${Math.min(state.quest,4)*25}%`;
    ui.energy.style.width=`${state.energy}%`;ui.badge.hidden=!Object.values(state.crops).some(c=>c.stage>=3);
    ui.weatherIcon.textContent=state.weather==='Rainy'?'☂':'☀';ui.weatherLabel.textContent=state.weather==='Rainy'?'Gentle rain':'Clear skies';
    const crops=Object.values(state.crops),ready=crops.filter(c=>c.stage>=3).length, planted=crops.length;
    if(ready)ui.fieldTip.textContent=`${ready} carrot${ready===1?' is':'s are'} ready to pick! Select your basket, then harvest the golden roots.`;
    else if(planted)ui.fieldTip.textContent='Your carrots need a drink each day. Water the little sprouts, then sleep to help them grow.';
    else if(Object.keys(state.crops).length===0 && state.harvested)ui.fieldTip.textContent='Lovely harvest! Plant another row and keep the good things growing.';
    else ui.fieldTip.textContent='Till a patch of earth, then plant a carrot seed. Water it each day to help it grow.';
    save();
  }
  function spend(amount=1){if(state.energy<amount){toast('You are all tuckered out. Get some rest!');return false}state.energy-=amount;state.time+=10;return true}

  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
  function path(points,color,width=1){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()}
  function drawGrass(){
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const n=hash(x,y),colors=['#87aa6a','#8eaf72','#83a666','#8aab6c','#91b176'];
      ctx.fillStyle=colors[Math.floor(n*colors.length)];ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      ctx.fillStyle='rgba(233,237,184,.08)';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      for(let i=0;i<5;i++){const rx=x*TILE+hash(x,y,i+2)*TILE,ry=y*TILE+hash(x,y,i+8)*TILE;ctx.strokeStyle=i%2?'rgba(48,103,63,.15)':'rgba(220,230,171,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(rx,ry+3);ctx.lineTo(rx+1,ry);ctx.lineTo(rx+3,ry+3);ctx.stroke()}
      if(n>.86 && !inField(x,y)){const fx=x*TILE+18+hash(x,y,23)*46,fy=y*TILE+18+hash(x,y,24)*46;ellipse(fx,fy,2.4,2.4,'#f5e8b3');ellipse(fx+3,fy-2,1.3,1.3,'#f4f1d8')}
    }
    // soft path winding from the cottage to the garden
    const tiles=[[2,3],[2,4],[2,5],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6]];
    tiles.forEach(([x,y])=>{ctx.fillStyle='#bdab7c';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);ctx.fillStyle='rgba(246,229,183,.22)';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);for(let i=0;i<5;i++){ellipse(x*TILE+hash(x,y,i)*78,y*TILE+hash(x,y,i+3)*78,1.5,1,'#968b68')}});
    // garden boundary and 20 soft earth squares
    rounded(4*TILE-9,3*TILE-9,5*TILE+18,4*TILE+18,20,'#729258','#63844e');
    rounded(4*TILE-5,3*TILE-5,5*TILE+10,4*TILE+10,16,'#d0b782','#ead7a4');
    for(let y=FIELD.y;y<FIELD.y+FIELD.h;y++)for(let x=FIELD.x;x<FIELD.x+FIELD.w;x++){
      const c=cell(x,y),px=x*TILE+4,py=y*TILE+4;
      if(c){
        rounded(px,py,TILE-8,TILE-8,11,c.watered?'#70533a':'#866443','#c6a575');
        // curved furrows
        for(let i=0;i<3;i++){path([[px+10,py+20+i*15],[px+26,py+18+i*15],[px+44,py+20+i*15],[px+65,py+18+i*15]],c.watered?'#563d2d':'#69482f',2);}
        if(c.watered){ellipse(px+17,py+13,2,2,'#b3d2c2');ellipse(px+54,py+55,2,2,'#b3d2c2')}
        if(c.stage>=0)drawCrop(x,y,c);
      }else{
        rounded(px,py,TILE-8,TILE-8,11,'#99b876','#abc48b');
        ctx.fillStyle='rgba(238,227,175,.2)';ctx.fillRect(px+9,py+10,TILE-26,1);
        for(let i=0;i<4;i++){ellipse(px+13+hash(x,y,i+30)*48,py+14+hash(x,y,i+35)*47,1.2,1,'#91aa6e')}
      }
    }
    // perimeter fence; breaks for the garden gate
    ctx.fillStyle='#d5bc8d';ctx.fillRect(0,0,1040,7);ctx.fillRect(0,0,7,720);ctx.fillRect(1033,0,7,720);ctx.fillRect(0,713,1040,7);
    for(let x=0;x<1040;x+=62){if(x>300&&x<730)continue;fencePost(x,14);fencePost(x,704)}
    for(let y=0;y<720;y+=62){fencePost(14,y);fencePost(1026,y)}
    path([[17,34],[1020,34]],'#f0d7a3',4);path([[17,695],[1020,695]],'#f0d7a3',4);
  }
  function fencePost(x,y){rounded(x-3,y-5,7,15,2,'#c7a576','#a98c65')}
  function drawCrop(x,y,c){
    const cx=x*TILE+TILE/2,cy=y*TILE+TILE/2+5;
    if(c.stage===0){ellipse(cx,cy+3,4,3,'#b8a074');path([[cx,cy+1],[cx-1,cy-5]],'#9caa60',2);return}
    const growth=Math.min(1,c.stage/3),leaf='#537c47',light='#7f9e54';
    // leaves unfurl in layers
    const leaves=Math.min(7,2+c.stage*2);
    for(let i=0;i<leaves;i++){
      const a=(Math.PI*2*i/leaves)-Math.PI/2, len=12+growth*12+(i%2)*2;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(a);
      ctx.beginPath();ctx.moveTo(0,1);ctx.quadraticCurveTo(len*.45,-len*.55,len,-len*.12);ctx.quadraticCurveTo(len*.68,len*.38,0,1);ctx.fillStyle=i%2?leaf:light;ctx.fill();path([[0,0],[len*.76,-len*.08]],'rgba(225,229,157,.46)',1);ctx.restore();
    }
    if(c.stage>=2){ellipse(cx,cy+5,9,10,'#ed984d');ellipse(cx-2,cy+4,2,6,'#f5b362');path([[cx,cy-3],[cx-2,cy-14]],'#48784a',2);}
    if(c.stage>=3){ellipse(cx,cy+4,10,13,'#e28b42');ellipse(cx-3,cy+1,2.6,7,'#f2b05d');ellipse(cx+18,cy-17,10,10,'#fff5d8');ellipse(cx+18,cy-17,6,6,'#e7aa55');}
    if(c.watered && c.stage<3){ellipse(cx+23,cy-19,3,3,'#d7eff0');ellipse(cx+27,cy-14,2,2,'#d7eff0')}
  }
  function drawHouse(){
    // cottage shadow, timber walls and brick-red roof
    ellipse(198,288,142,24,'rgba(49,72,43,.20)');
    rounded(78,128,242,156,9,'#e8d4a9','#9d8a69');
    ctx.fillStyle='#f3e5bf';ctx.fillRect(89,145,220,130);
    for(let y=161;y<275;y+=24)path([[90,y],[307,y]],'rgba(157,129,91,.18)',1);
    // roof
    ctx.beginPath();ctx.moveTo(63,157);ctx.lineTo(193,62);ctx.lineTo(334,157);ctx.lineTo(315,164);ctx.lineTo(193,87);ctx.lineTo(79,165);ctx.closePath();ctx.fillStyle='#a95f49';ctx.fill();ctx.strokeStyle='#864e3d';ctx.lineWidth=3;ctx.stroke();
    path([[86,151],[193,79],[313,151]],'#d18a69',3);path([[111,143],[193,88],[288,145]],'rgba(255,215,164,.35)',2);
    // chimney
    rounded(260,75,25,48,3,'#a96550','#8d5745');rounded(255,68,35,10,2,'#be7d60');
    // window shutters
    for(const wx of [108,255]){rounded(wx,177,38,44,4,'#bfd0af','#87775f');ctx.fillStyle='#e7e8ce';ctx.fillRect(wx+4,181,30,36);path([[wx+19,181],[wx+19,217]],'#9ba88d',2);path([[wx+4,199],[wx+34,199]],'#9ba88d',2);rounded(wx-5,173,5,50,2,'#9b704d');rounded(wx+38,173,5,50,2,'#9b704d');}
    // door + stoop
    rounded(176,216,39,65,6,'#8a6547','#70543c');rounded(182,222,27,59,5,'#aa8054');ellipse(205,250,2,2,'#f4d18c');rounded(167,275,58,8,2,'#c4a475');
    // flower boxes
    rounded(101,221,52,10,3,'#946d49');for(let i=0;i<4;i++){path([[110+i*11,220],[108+i*11,211]],'#5a8650',3);ellipse(107+i*11,209,3,2,'#d38275')}
    // sign
    path([[324,181],[324,246]],'#795f44',5);rounded(300,173,55,29,5,'#f4e3b8','#a88c65');ctx.fillStyle='#667b54';ctx.font='600 11px Nunito';ctx.textAlign='center';ctx.fillText('HOME',327,191);
  }
  function drawMarket(){
    ellipse(871,282,115,18,'rgba(49,72,43,.18)');
    // striped canopy
    ctx.beginPath();ctx.moveTo(782,138);ctx.lineTo(962,138);ctx.lineTo(946,199);ctx.lineTo(798,199);ctx.closePath();ctx.fillStyle='#f4ddaa';ctx.fill();
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(782+i*36,138);ctx.lineTo(800+i*30,198);ctx.lineTo(819+i*30,198);ctx.lineTo(801+i*36,138);ctx.closePath();ctx.fillStyle=i%2?'#8a9e68':'#cf875e';ctx.fill()}
    rounded(800,192,145,79,6,'#b48a5c','#8b704b');rounded(811,204,123,42,3,'#ecd6a7');
    // jars and produce display
    for(let i=0;i<4;i++){ellipse(826+i*27,231,9,10,['#e18a4d','#879d57','#d0a04c','#a36b54'][i]);ellipse(823+i*27,228,3,3,'#f4d08b')}
    path([[792,201],[792,276]],'#8f704f',5);path([[955,201],[955,276]],'#8f704f',5);
    rounded(835,160,79,25,4,'#f6e8c5','#a68c62');ctx.fillStyle='#637550';ctx.font='600 10px Nunito';ctx.textAlign='center';ctx.fillText('MARIGOLD',874,177);
    // produce crate
    rounded(809,258,58,33,3,'#b88955','#88683f');path([[812,267],[864,267]],'#d3a66c',3);path([[812,280],[864,280]],'#d3a66c',3);
  }
  function drawPond(){
    ctx.save();ctx.beginPath();ctx.moveTo(849,478);ctx.bezierCurveTo(873,448,931,448,971,472);ctx.bezierCurveTo(1011,494,1030,539,1014,585);ctx.bezierCurveTo(1001,626,957,670,912,657);ctx.bezierCurveTo(870,645,851,609,840,570);ctx.bezierCurveTo(827,532,827,500,849,478);ctx.closePath();ctx.fillStyle='#78a9a2';ctx.fill();ctx.strokeStyle='#b9cc9e';ctx.lineWidth=7;ctx.stroke();
    ctx.beginPath();ctx.ellipse(933,548,70,44,-.18,Math.PI*1.1,Math.PI*1.88);ctx.strokeStyle='rgba(219,239,212,.55)';ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.ellipse(938,554,47,26,-.18,Math.PI*1.1,Math.PI*1.85);ctx.strokeStyle='rgba(217,235,208,.42)';ctx.lineWidth=2;ctx.stroke();
    // lily pads
    ellipse(884,524,11,6,'#6e9667');path([[884,524],[891,520]],'#b2c88a',1);ellipse(981,581,13,7,'#6e9667');path([[981,581],[989,576]],'#b2c88a',1);ellipse(907,610,8,5,'#688e61');
    // reeds
    for(const [x,y] of [[858,510],[1004,522],[870,590],[1000,605]]){path([[x,y],[x-3,y-22]],'#5c804f',3);path([[x+2,y],[x+5,y-17]],'#729252',3);ellipse(x-4,y-22,2,4,'#8d8061')}
    ctx.restore();
  }
  function drawTree(x,y,s=1){
    const tx=x*TILE+40,ty=y*TILE+40;
    ellipse(tx+4,ty+24,31*s,10*s,'rgba(51,74,40,.22)');rounded(tx-5*s,ty-4*s,10*s,33*s,3,'#866344');
    const greens=['#567d4a','#62884e','#709358'];
    [[-16,-11,25],[8,-18,27],[-1,-35,24],[-27,-26,20],[25,-29,20]].forEach(([dx,dy,r],i)=>{ellipse(tx+dx*s,ty+dy*s,r*s,r*.8*s,greens[(i+Math.floor(hash(x,y)*3))%3]);ellipse(tx+(dx-6)*s,ty+(dy-6)*s,r*.34*s,r*.25*s,'rgba(194,213,137,.32)')});
    if(hash(x,y,3)>.4)ellipse(tx+4*s,ty-12*s,4*s,4*s,'#d3a16b');
  }
  function drawDecor(){
    [[0.55,0.8,1],[12.25,.75,.9],[.65,7.75,1],[3.6,.65,.78],[8.95,1.2,.72],[3.35,7.55,.8],[8.9,7.8,.82],[11.3,4.0,.62],[1.0,4.25,.65]].forEach(([x,y,s])=>drawTree(x,y,s));
    // a wheelbarrow and stacked hay beside the house
    ellipse(262,336,25,6,'rgba(55,75,43,.18)');path([[236,316],[270,326],[292,312]],'#765b43',4);ellipse(234,319,7,7,'#686d58');rounded(242,301,37,19,7,'#9b7955');
    ellipse(313,342,17,9,'#d0b46d');ellipse(331,344,16,9,'#dfc27a');
    // white and butter-yellow garden flowers
    [[278,399],[273,536],[750,363],[761,574],[368,603],[706,626],[829,365],[750,210],[389,194]].forEach(([x,y],i)=>{path([[x,y+8],[x+1,y]],'#5d884d',2);for(let j=0;j<5;j++)ellipse(x+Math.cos(j*1.25)*4,y+Math.sin(j*1.25)*4,2.1,2.1,i%3?'#f3e8b5':'#e9c98b');ellipse(x,y,1.5,1.5,'#bd8652')});
  }
  function drawPlayer(){
    const p=state.player, t=performance.now()/180;
    const x=(p.fx+(p.x-p.fx)*Math.min(1,frame/8))*TILE+40, y=(p.fy+(p.y-p.fy)*Math.min(1,frame/8))*TILE+40;
    const bob=Math.sin(t)*1.3;
    ellipse(x,y+21,17,6,'rgba(37,56,36,.26)');
    // legs
    rounded(x-9,y+8+bob,7,12,3,'#586953');rounded(x+2,y+8-bob,7,12,3,'#586953');
    // little overalls
    rounded(x-13,y-8+bob,26,23,8,'#668b70','#42654f');rounded(x-10,y-5+bob,20,7,4,'#7fa28a');
    // sleeves and hands
    ellipse(x-15,y,4,6,'#e6b98b');ellipse(x+15,y,4,6,'#e6b98b');
    // head and ears
    ellipse(x,y-16+bob,13,14,'#e7b98c');ellipse(x-12,y-17+bob,3,4,'#d89f79');ellipse(x+12,y-17+bob,3,4,'#d89f79');
    // hair cap
    ctx.beginPath();ctx.moveTo(x-13,y-18+bob);ctx.quadraticCurveTo(x-12,y-33+bob,x+1,y-31+bob);ctx.quadraticCurveTo(x+14,y-31+bob,x+13,y-17+bob);ctx.quadraticCurveTo(x+6,y-22+bob,x-2,y-20+bob);ctx.closePath();ctx.fillStyle='#795b43';ctx.fill();
    ellipse(x-4,y-14+bob,1.2,1.5,'#4e493d');ellipse(x+4,y-14+bob,1.2,1.5,'#4e493d');path([[x-2,y-8+bob],[x,y-7+bob],[x+2,y-8+bob]],'#b57865',1);
    // straw hat brim
    ellipse(x,y-26+bob,18,4,'#d8b669');ctx.beginPath();ctx.ellipse(x,y-29+bob,11,8,0,Math.PI,Math.PI*2);ctx.fillStyle='#e6c77e';ctx.fill();path([[x-10,y-28+bob],[x+10,y-28+bob]],'#c5a45e',2);
    if(performance.now()-lastAction<500){ctx.globalAlpha=clamp(1-(performance.now()-lastAction)/500,0,1);ellipse(x+22,y-24,4,4,'#f5d992');ellipse(x+29,y-34,2,2,'#fff1c7');ctx.globalAlpha=1}
  }
  function render(){
    frame=Math.min(8,frame+.65);ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrass();drawPond();drawHouse();drawMarket();drawDecor();drawPlayer();
    if(mouse){const {x,y}=mouse;ctx.strokeStyle='rgba(255,249,226,.9)';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(x*TILE+4,y*TILE+4,TILE-8,TILE-8);ctx.setLineDash([])}
    if(state.time>=18*60){ctx.fillStyle='rgba(49,64,48,.09)';ctx.fillRect(0,0,1040,720)}
    requestAnimationFrame(render);
  }

  function setTool(tool){state.tool=tool;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));canvas.focus({preventScroll:true})}
  function act(x,y){
    if(!inField(x,y)){return false}
    const k=keyOf(x,y),c=cell(x,y);
    if(state.tool==='hoe'){
      if(c){toast('That little patch is already planted.');return true}
      if(!spend())return true;state.crops[k]={stage:-1,watered:false};lastAction=performance.now();toast('Soil turned. Ready for a seed!');
    }else if(state.tool==='seed'){
      if(!c||c.stage!==-1){toast(c?'There is already something growing here.':'Till the soil before planting.');return true}
      if(state.seeds<=0){toast('No seeds left. Stop by the market!');return true}
      if(!spend())return true;state.seeds--;state.crops[k]={stage:0,watered:false};lastAction=performance.now();toast('A tiny carrot is on its way.');
    }else if(state.tool==='water'){
      if(!c||c.stage<0){toast('Plant a seed before watering.');return true}
      if(c.watered){toast('This patch is lovely and damp already.');return true}
      if(!spend())return true;c.watered=true;lastAction=performance.now();toast('A good drink for your carrots!');
    }else if(state.tool==='harvest'){
      if(!c||c.stage<3){toast('Not quite ripe yet. Keep watering!');return true}
      if(!spend())return true;delete state.crops[k];state.carrots++;state.quest++;state.harvested++;lastAction=performance.now();toast(state.quest===4?'First harvest complete! You did it!':'A lovely, fresh carrot!');
    }
    updateUI();return true;
  }
  function move(dx,dy){
    const nx=clamp(state.player.x+dx,0,COLS-1),ny=clamp(state.player.y+dy,0,ROWS-1);state.player.dir=dy<0?'up':dy>0?'down':dx<0?'left':'right';
    // avoid walking through buildings and the pond
    if((nx>=1&&nx<=3&&ny>=1&&ny<=2)||(nx===2&&ny===3)||(nx>=10&&nx<=12&&ny>=1&&ny<=3)||(nx>=10&&ny<=12&&ny>=6&&ny<=8))return;
    state.player.fx=state.player.x;state.player.fy=state.player.y;state.player.x=nx;state.player.y=ny;frame=0;
  }
  function useFacing(){const {x,y,dir}=state.player,delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir];let tx=x+delta[0],ty=y+delta[1];if(!inField(tx,ty)&&inField(x,y)){tx=x;ty=y}if(inField(tx,ty)){act(tx,ty);return}if(x>=9&&x<=12&&y<=4){openMarket();return}toast('Nothing to do just here.');}
  function clickTile(x,y){
    if(inField(x,y)){state.player.dir=x>state.player.x?'right':x<state.player.x?'left':y>state.player.y?'down':'up';act(x,y);state.player.fx=state.player.x;state.player.fy=state.player.y;state.player.x=x;state.player.y=y;frame=0;return}
    if(x>=9&&x<=12&&y>=1&&y<=4){openMarket();return}
    if(x>=1&&x<=3&&y>=1&&y<=3){toast('Home sweet home. End the day whenever you are ready.');return}
    state.player.fx=state.player.x;state.player.fy=state.player.y;state.player.x=x;state.player.y=y;frame=0;
  }
  function sleep(){
    const planted=Object.values(state.crops).filter(c=>c.stage>=0);let grew=0;
    planted.forEach(c=>{if(c.watered){c.stage=Math.min(3,c.stage+1);grew++}c.watered=false});
    state.day++;state.time=360;state.energy=100;
    state.weather=Math.random()<.2?'Rainy':'Clear skies';
    if(state.weather==='Rainy')Object.values(state.crops).forEach(c=>{if(c.stage>=0)c.watered=true});
    updateUI();toast(grew?`A new day dawns. ${grew} crop${grew===1?'':'s'} grew overnight.`:'Rest well. A new day is waiting!');
  }
  function sell(){if(!state.carrots){toast('Your basket is empty. Pick a few carrots first!');return false}const amount=state.carrots*18;state.coins+=amount;state.carrots=0;updateUI();toast(`Sold your harvest for ${amount} coins. Lovely work!`);return true}
  const dialog=$('marketDialog');function openMarket(){if(!dialog.open)dialog.showModal()}

  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  $('sleepButton').addEventListener('click',sleep);$('marketButton').addEventListener('click',openMarket);
  $('sellButton').addEventListener('click',sell);$('dialogSell').addEventListener('click',()=>{sell();});
  $('closeMarket').addEventListener('click',()=>dialog.close());
  $('buySeeds').addEventListener('click',()=>{if(state.coins<32){toast('You need 32 coins for a seed packet.');return}state.coins-=32;state.seeds+=4;updateUI();toast('Four little seeds added to your basket!')});
  canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect();const x=Math.floor((e.clientX-r.left)/r.width*COLS),y=Math.floor((e.clientY-r.top)/r.height*ROWS);if(x>=0&&x<COLS&&y>=0&&y<ROWS)clickTile(x,y)});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouse={x:Math.floor((e.clientX-r.left)/r.width*COLS),y:Math.floor((e.clientY-r.top)/r.height*ROWS)}});canvas.addEventListener('pointerleave',()=>mouse=null);
  const keyDirections={w:[0,-1],arrowup:[0,-1],s:[0,1],arrowdown:[0,1],a:[-1,0],arrowleft:[-1,0],d:[1,0],arrowright:[1,0]};let heldKey=null,moveTimer=null;
  function handleKey(e){const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();if(dialog.open&&key==='escape')return;
    if(keyDirections[key]){if(!heldKey){move(...keyDirections[key]);heldKey=key;moveTimer=setInterval(()=>{if(heldKey)move(...keyDirections[heldKey])},145)}return}
    if(key==='e'||key===' '){useFacing();return}if(key==='n'){sleep();return}if(['1','2','3','4'].includes(key)){setTool(['hoe','seed','water','harvest'][Number(key)-1]);return}
  }
  window.addEventListener('keydown',handleKey);window.addEventListener('keyup',e=>{if(e.key.toLowerCase()===heldKey){heldKey=null;clearInterval(moveTimer)}});window.addEventListener('blur',()=>{heldKey=null;clearInterval(moveTimer)});
  document.querySelectorAll('[data-move]').forEach(b=>{const dir={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[b.dataset.move];b.addEventListener('pointerdown',e=>{e.preventDefault();move(...dir);heldKey='touch';moveTimer=setInterval(()=>move(...dir),160)});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{heldKey=null;clearInterval(moveTimer)}))});
  $('touchUse').addEventListener('click',useFacing);
  updateUI();render();if(state.firstVisit){setTimeout(()=>toast('Welcome home! Click a garden patch to get started.'),700);state.firstVisit=false;save()}
})();
