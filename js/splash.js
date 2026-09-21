// ================================================================
// SPLASH SCREEN — شاشة البداية: النجوم + رسمة الموتوسيكل المتحركة
// ================================================================

// ===== SPLASH STARS =====
(function(){
  const c=document.getElementById('sp-stars');
  c.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
  for(let i=0;i<65;i++){
    const s=document.createElement('div');
    s.className='sp-star';
    const sz=Math.random()*2.2+.5;
    s.style.cssText=`width:${sz}px;height:${sz}px;top:${Math.random()*100}%;left:${Math.random()*100}%;opacity:${Math.random()*.5+.1};animation:sp-twinkle ${1.5+Math.random()*3}s ${Math.random()*4}s ease-in-out infinite`;
    c.appendChild(s);
  }
  const st=document.createElement('style');
  st.textContent='@keyframes sp-twinkle{0%,100%{opacity:.08}50%{opacity:.75}}';
  document.head.appendChild(st);
})();

// ===== SPLASH MOTO CANVAS =====
(function(){
  const canvas=document.getElementById('splashCanvas');
  const ctx=canvas.getContext('2d');
  const W=520,H=130,G=105;
  canvas.width=W; canvas.height=H;
  canvas.style.width='100%'; canvas.style.height=H+'px';

  let wheelAngle=0, lastTs=0;
  const LOOP=3000;

  function lerp(a,b,t){return a+(b-a)*t}
  function easeInExpo(t){return t===0?0:Math.pow(2,10*t-10)}
  function easeOutCubic(t){return 1-Math.pow(1-t,3)}

  function drawWheel(cx,cy,r,angle){
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle='#111';ctx.fill();
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,r*.58,0,Math.PI*2);
    ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1.2;ctx.stroke();
    ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
    for(let i=0;i<6;i++){
      ctx.rotate(Math.PI/3);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,r*.85);
      ctx.strokeStyle='#333';ctx.lineWidth=1.2;ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,r*.13,0,Math.PI*2);
    ctx.fillStyle='#555';ctx.fill();
  }

  function drawFire(cx,cy,flicker){
    ctx.save();ctx.translate(cx,cy);
    const g=ctx.createRadialGradient(0,0,0,0,0,20);
    g.addColorStop(0,'rgba(255,255,220,.95)');
    g.addColorStop(.3,'rgba(255,140,80,.85)');
    g.addColorStop(.65,'rgba(220,60,30,.5)');
    g.addColorStop(1,'rgba(255,0,0,0)');
    ctx.beginPath();ctx.ellipse(0,0,9*flicker,17*flicker,0,0,Math.PI*2);
    ctx.fillStyle=g;ctx.fill();
    const g2=ctx.createRadialGradient(0,2,0,0,0,7);
    g2.addColorStop(0,'rgba(255,255,255,1)');
    g2.addColorStop(.5,'rgba(255,150,100,.9)');
    g2.addColorStop(1,'rgba(255,100,0,0)');
    ctx.beginPath();ctx.ellipse(0,2,4,7*flicker,0,0,Math.PI*2);
    ctx.fillStyle=g2;ctx.fill();
    ctx.restore();
  }

  function drawSpark(cx,cy,elapsed){
    const sparks=[
      {ox:-6,oy:0,vx:-1.6,vy:-.7,r:1.6,c:'#ff6b4a'},
      {ox:-12,oy:2,vx:-1.1,vy:-1.1,r:1.3,c:'#ff9900'},
      {ox:-16,oy:-2,vx:-.85,vy:-1.4,r:1.1,c:'#ff6600'},
      {ox:-5,oy:3,vx:-2,vy:-.3,r:.95,c:'#ffdd00'},
      {ox:-20,oy:1,vx:-.55,vy:-.85,r:.8,c:'#ff4400'},
    ];
    sparks.forEach(s=>{
      const ph=(elapsed*.0028+Math.abs(s.ox)*.05)%1;
      const sx=cx+s.ox+s.vx*ph*16;
      const sy=cy+s.oy+s.vy*ph*16;
      const al=(1-ph)*.9;
      ctx.globalAlpha=al;
      ctx.beginPath();ctx.arc(sx,sy,s.r*(1-ph*.4),0,Math.PI*2);
      ctx.fillStyle=s.c;ctx.fill();
      ctx.globalAlpha=1;
    });
  }

  function drawScooter(x,bob,wa,elapsed){
    ctx.save();ctx.translate(0,bob);

    // rear wheel
    drawWheel(x-36,G,22,wa);
    // front wheel
    drawWheel(x+60,G,22,wa);

    // exhaust
    ctx.beginPath();ctx.moveTo(x-30,G-12);
    ctx.bezierCurveTo(x-44,G-12,x-52,G-5,x-50,G+4);
    ctx.strokeStyle='#555';ctx.lineWidth=2.8;ctx.lineCap='round';ctx.stroke();

    // frame backbone
    ctx.beginPath();ctx.moveTo(x-36,G-22);ctx.lineTo(x-6,G-40);
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-6,G-40);ctx.lineTo(x+20,G-50);ctx.lineTo(x+42,G-38);
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=3.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+42,G-38);ctx.lineTo(x+60,G-22);
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=3;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+2,G-50);ctx.lineTo(x+38,G-50);
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=2.5;ctx.stroke();

    // engine
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x+2,G-48,26,15,3);
    else ctx.rect(x+2,G-48,26,15);
    ctx.fillStyle='#181828';ctx.fill();
    ctx.strokeStyle='rgba(255,107,74,.35)';ctx.lineWidth=1;ctx.stroke();

    // handlebar
    ctx.beginPath();ctx.moveTo(x+46,G-50);ctx.lineTo(x+52,G-63);
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=3;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+49,G-59);ctx.lineTo(x+59,G-56);
    ctx.strokeStyle='#ccc';ctx.lineWidth=2.5;ctx.stroke();

    // seat
    ctx.beginPath();ctx.moveTo(x+2,G-50);
    ctx.bezierCurveTo(x+8,G-57,x+30,G-58,x+40,G-52);
    ctx.strokeStyle='#1a1a1a';ctx.lineWidth=6;ctx.stroke();
    ctx.strokeStyle='#3a3a3a';ctx.lineWidth=4;ctx.stroke();

    // headlight
    const hg=ctx.createRadialGradient(x+65,G-44,0,x+65,G-44,10);
    hg.addColorStop(0,'rgba(255,250,200,1)');
    hg.addColorStop(.4,'rgba(255,107,74,.7)');
    hg.addColorStop(1,'rgba(255,107,74,0)');
    ctx.beginPath();ctx.ellipse(x+63,G-44,6,5,-.2,0,Math.PI*2);
    ctx.fillStyle=hg;ctx.fill();
    ctx.save();
    const beam=ctx.createLinearGradient(x+68,G-44,x+110,G-38);
    beam.addColorStop(0,'rgba(255,107,74,.18)');beam.addColorStop(1,'rgba(255,107,74,0)');
    ctx.beginPath();ctx.moveTo(x+68,G-48);ctx.lineTo(x+112,G-54);
    ctx.lineTo(x+112,G-33);ctx.lineTo(x+68,G-40);ctx.closePath();
    ctx.fillStyle=beam;ctx.fill();
    ctx.restore();

    // delivery box
    ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x-30,G-86,30,28,3);
    else ctx.rect(x-30,G-86,30,28);
    ctx.fillStyle='#080814';ctx.fill();
    ctx.shadowColor='transparent';
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=1.8;ctx.stroke();
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x-28,G-84,26,24,2);
    else ctx.rect(x-28,G-84,26,24);
    ctx.fillStyle='rgba(255,107,74,.04)';ctx.fill();
    ctx.font='bold 7.5px Cairo,sans-serif';
    ctx.fillStyle='rgba(255,107,74,.9)';ctx.textAlign='center';
    ctx.fillText('DODDZ',x-15,G-71);ctx.fillText('GO',x-15,G-62);
    ctx.beginPath();ctx.moveTo(x-28,G-74);ctx.lineTo(x-2,G-74);
    ctx.strokeStyle='rgba(255,107,74,.25)';ctx.lineWidth=1;ctx.stroke();

    // rider — torso
    ctx.save();ctx.translate(x+11,G-57);ctx.rotate(-.2);
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(-7,-21,14,21,3);
    else ctx.rect(-7,-21,14,21);
    ctx.fillStyle='#c0392b';ctx.fill();
    ctx.beginPath();ctx.moveTo(-7,-14);ctx.lineTo(7,-14);
    ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();

    // arm
    ctx.beginPath();ctx.moveTo(x+13,G-69);ctx.lineTo(x+55,G-57);
    ctx.strokeStyle='#c0392b';ctx.lineWidth=5;ctx.lineCap='round';ctx.stroke();

    // leg
    ctx.beginPath();ctx.moveTo(x+9,G-56);
    ctx.bezierCurveTo(x+18,G-46,x+30,G-38,x+42,G-34);
    ctx.strokeStyle='#111';ctx.lineWidth=6;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+9,G-56);
    ctx.bezierCurveTo(x+18,G-46,x+30,G-38,x+42,G-34);
    ctx.strokeStyle='#2a2a2a';ctx.lineWidth=4;ctx.stroke();
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x+39,G-36,13,6,2);
    else ctx.rect(x+39,G-36,13,6);
    ctx.fillStyle='#0a0a0a';ctx.fill();

    // helmet
    ctx.save();ctx.translate(x+13,G-77);
    const hsh=ctx.createRadialGradient(-2,-5,2,-2,-5,17);
    hsh.addColorStop(0,'#1a1a2e');hsh.addColorStop(.7,'#0d0d1a');hsh.addColorStop(1,'#060610');
    ctx.beginPath();ctx.arc(0,0,15,Math.PI*.1,Math.PI*1.1,false);
    ctx.lineTo(-14,7);ctx.lineTo(14,7);ctx.closePath();
    ctx.fillStyle=hsh;ctx.fill();
    ctx.strokeStyle='rgba(255,107,74,.12)';ctx.lineWidth=.8;ctx.stroke();
    const vg=ctx.createLinearGradient(-10,0,10,0);
    vg.addColorStop(0,'rgba(100,180,255,.55)');
    vg.addColorStop(.5,'rgba(180,225,255,.75)');
    vg.addColorStop(1,'rgba(100,180,255,.55)');
    ctx.beginPath();ctx.ellipse(0,2,10,4,0,0,Math.PI);
    ctx.fillStyle=vg;ctx.fill();
    ctx.beginPath();ctx.ellipse(-3,-1,4,1.5,-.3,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.fill();
    ctx.beginPath();ctx.moveTo(-14,-2);ctx.lineTo(14,-2);
    ctx.strokeStyle='#ff6b4a';ctx.lineWidth=1.5;ctx.stroke();
    for(let i=0;i<3;i++){
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(-4+i*4,-13,2.5,4.5,1);
      else ctx.rect(-4+i*4,-13,2.5,4.5);
      ctx.fillStyle='rgba(255,107,74,.22)';ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  function frame(ts){
    if(!lastTs) lastTs=ts;
    const dt=ts-lastTs; lastTs=ts;
    ctx.clearRect(0,0,W,H);

    const cycleT=(ts%LOOP)/LOOP;
    let x,bob;

    if(cycleT<.48){
      const p=cycleT/.48;
      x=lerp(-90,W*.42,easeOutCubic(p));
      bob=Math.sin(p*Math.PI*5)*.9;
    } else if(cycleT<.86){
      const p=(cycleT-.48)/.38;
      x=lerp(W*.42,W+90,easeInExpo(p));
      bob=Math.sin(p*Math.PI*7)*.7;
    } else {
      x=-200; bob=0;
    }

    wheelAngle+=dt*.013;

    if(x>-100&&x<W+100){
      const flicker=.8+Math.sin(ts*.019)*.25+Math.sin(ts*.031)*.14;
      drawFire(x-36,G+bob,flicker);
      const spd=cycleT>.48?((cycleT-.48)/.38):.1;
      if(spd>.05) drawSpark(x-36,G,ts);
      drawScooter(x,bob,wheelAngle,ts);
    }

    // shake الـ logo في الـ header لما الموتو يعدي المنتصف
    if(cycleT>.46&&cycleT<.52&&!frame._shook){
      frame._shook=true;
      const logo=document.querySelector('header .logo');
      if(logo){ logo.classList.remove('shake'); void logo.offsetWidth; logo.classList.add('shake'); }
    }
    if(cycleT<.05) frame._shook=false;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

function enterSite(){
  const sp=document.getElementById('splash');
  sp.classList.add('hidden');
  setTimeout(()=>sp.style.display='none',750);
}
