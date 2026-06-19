const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const savedTheme = localStorage.getItem('amif_home_theme') || 'dark';
if (savedTheme === 'light') document.body.classList.add('light');

const progress = $('#pageProgress');
function updateProgress(){
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${(scrollY / (max || 1)) * 100}%`;
  $('#siteHeader').classList.toggle('scrolled', scrollY > 18);
  let active = '';
  $$('main section[id]').forEach(section => { if (scrollY >= section.offsetTop - 160) active = section.id; });
  $$('.site-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${active}`));
}
addEventListener('scroll', updateProgress, {passive:true});
updateProgress();

const io = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) entry.target.classList.add('show');
}), { threshold: .16 });
$$('.reveal').forEach(el => io.observe(el));

function countUp(){
  $$('[data-count]').forEach(el => {
    const target = Number(el.dataset.count || 0);
    const start = performance.now();
    function frame(t){
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
setTimeout(countUp, 450);

$('#themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('amif_home_theme', document.body.classList.contains('light') ? 'light' : 'dark');
});
$('#mobileMenuBtn').addEventListener('click', () => $('#siteHeader').classList.toggle('open'));
$$('.site-nav a').forEach(a => a.addEventListener('click', () => $('#siteHeader').classList.remove('open')));

const logLines = [
  '[10:30:00] event.ingested camera_warehouse_a_01 forklift_detected',
  '[10:30:01] event.processed schema=1.0 dedupe=pass',
  '[10:31:10] sensor.reading machine_a temperature=91.5C',
  '[10:31:11] anomaly.generated temperature_anomaly severity=high',
  '[10:31:12] incident.created forklift + overheating correlation',
  '[10:31:15] agent.retriever manual evidence found',
  '[10:31:17] guard.decision human approval required',
  '[10:31:18] dashboard.updated summary + graph + audit ready'
];
const typed = $('#typedLog');
let i = 0, j = 0;
function typeLog(){
  if (!typed) return;
  if (i >= logLines.length) return;
  const line = logLines[i];
  typed.textContent = logLines.slice(0, i).join('\n') + (i ? '\n' : '') + line.slice(0, j);
  j++;
  if (j <= line.length) setTimeout(typeLog, 18);
  else { i++; j = 0; setTimeout(typeLog, 260); }
}
setTimeout(typeLog, 700);

const canvas = $('#heroCanvas');
const ctx = canvas.getContext('2d');
let points = [];
function resize(){
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  points = Array.from({length: Math.min(80, Math.floor(innerWidth/18))}, () => ({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35}));
}
addEventListener('resize', resize); resize();
function animate(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  ctx.strokeStyle = document.body.classList.contains('light') ? 'rgba(56,189,248,.16)' : 'rgba(103,232,249,.16)';
  ctx.fillStyle = document.body.classList.contains('light') ? 'rgba(56,189,248,.45)' : 'rgba(103,232,249,.45)';
  points.forEach(p => { p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>innerWidth)p.vx*=-1; if(p.y<0||p.y>innerHeight)p.vy*=-1; ctx.beginPath(); ctx.arc(p.x,p.y,1.3,0,Math.PI*2); ctx.fill(); });
  for(let a=0;a<points.length;a++) for(let b=a+1;b<points.length;b++){
    const dx=points[a].x-points[b].x, dy=points[a].y-points[b].y, d=Math.hypot(dx,dy);
    if(d<115){ ctx.globalAlpha = 1 - d/115; ctx.beginPath(); ctx.moveTo(points[a].x,points[a].y); ctx.lineTo(points[b].x,points[b].y); ctx.stroke(); ctx.globalAlpha=1; }
  }
  requestAnimationFrame(animate);
}
animate();
