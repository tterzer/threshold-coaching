function calendarWeeks(n){
  const now=new Date();
  const curMonday=mondayOf(now);
  const out=[];
  for(let i=n-1;i>=0;i--){
    const start=new Date(curMonday);start.setDate(curMonday.getDate()-i*7);
    const end=new Date(start);end.setDate(start.getDate()+7);
    const cappedEnd=end>now?now:end;
    out.push({label:fmtDate(start),start,end:cappedEnd});
  }
  return out;
}

function setPmcRange(days){
  document.querySelectorAll('#pmcRangeTabs .sub-tab').forEach(t=>t.classList.toggle('active',Number(t.dataset.days)===days));
  buildPMC(days);
}

var pmcRangeDays=180;
function buildPMC(rangeDays){
  if(rangeDays)pmcRangeDays=rangeDays;
  // The fitness series only spans FITNESS_DAYS (~6 months); requesting a wider
  // range simply shows nulls for the days we have no computed fitness for.
  const n=pmcRangeDays;
  const days=Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(n-1-i));return d;});
  const ctlData=[],atlData=[],tsbData=[];
  days.forEach(d=>{
    const entry=fitnessByDate[dayKey(d)];
    if(entry){
      ctlData.push(Math.round(entry.ctl));
      atlData.push(Math.round(entry.atl));
      tsbData.push(Math.round(entry.ctl)-Math.round(entry.atl));
    } else { ctlData.push(null);atlData.push(null);tsbData.push(null); }
  });
  if(pmcInst)pmcInst.destroy();
  const tsbZonePlugin={
    id:'tsbZones',
    beforeDraw(chart){
      const{ctx,chartArea,scales}=chart;
      if(!chartArea)return;
      const y=scales.y;
      ctx.save();
      const top=chartArea.top,bottom=chartArea.bottom,left=chartArea.left,right=chartArea.right;
      const yFresh=Math.max(top,Math.min(bottom,y.getPixelForValue(5)));
      const yRisk=Math.max(top,Math.min(bottom,y.getPixelForValue(-20)));
      ctx.fillStyle='rgba(99,153,34,0.07)';
      ctx.fillRect(left,top,right-left,Math.max(0,yFresh-top));
      ctx.fillStyle='rgba(226,75,74,0.07)';
      ctx.fillRect(left,yRisk,right-left,Math.max(0,bottom-yRisk));
      ctx.restore();
    }
  };
  pmcInst=new Chart(document.getElementById('pmcChart'),{type:'line',data:{labels:days.map(d=>fmtDate(d)),datasets:[
    {label:'CTL',data:ctlData,borderColor:'#378ADD',backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2,yAxisID:'y'},
    {label:'ATL',data:atlData,borderColor:'#E24B4A',backgroundColor:'transparent',tension:0,pointRadius:0,borderWidth:1.5,yAxisID:'y'},
    {label:'TSB',data:tsbData,borderColor:'#c8f036',backgroundColor:'transparent',borderDash:[4,3],tension:0.25,pointRadius:0,borderWidth:1.5,yAxisID:'y'}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
    scales:{x:{ticks:{color:'#666',font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:8},grid:{color:'#1a1a1a'}},
    y:{ticks:{color:'#666',font:{size:10}},grid:{color:'#1a1a1a'}}}},
    plugins:[tsbZonePlugin]});
}

// ── Per-sport CTL chart ─────────────────────────────────────────────
var sportCtlInst = null;
var sportCtlRangeDays = 180;

function fitActSport(type) {
  const t = (type||'').toLowerCase();
  if (t.includes('ride') || t.includes('cycl') || t.includes('virtual')) return 'cycling';
  if (t.includes('run') || t.includes('jog') || t.includes('trail') || t.includes('treadmill')) return 'running';
  if (t.includes('swim')) return 'swimming';
  if (t.includes('weight') || t.includes('strength') || t === 'yoga' || t === 'workout' || t === 'crossfit' || t === 'pilates') return 'strength';
  return 'other';
}

function calcSportCTL(acts, sportName) {
  const filtered = acts.filter(a => fitActSport(a.type) === sportName);
  const tssByDay = {};
  filtered.forEach(a => {
    const day = (a.start_date_local||'').slice(0,10);
    if (!day) return;
    tssByDay[day] = (tssByDay[day]||0) + (Number(a.icu_training_load)||0);
  });
  const totalDays = FITNESS_DAYS;
  const start = new Date();
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() - (totalDays - 1));
  const ctlDecay = 1 - Math.exp(-1/42);
  const result = {};
  let ctlPrev = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = dayKey(d);
    const tss = tssByDay[key]||0;
    const ctl = ctlPrev + (tss - ctlPrev) * ctlDecay;
    if (i >= WARMUP_DAYS) result[key] = ctl;
    ctlPrev = ctl;
  }
  return result;
}

function setSportCtlRange(label, btn) {
  const map = {'6W':42,'3M':90,'6M':180,'1Y':365};
  sportCtlRangeDays = map[label] || 42;
  document.querySelectorAll('[id^="sctl-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  buildSportCTL();
}

function buildSportCTL() {
  const acts = window._fitnessFetchedActs;
  if (!acts || !acts.length) return;
  const storedOffset = Number(localStorage.getItem(CTL_OFFSET_KEY)||0)||0;
  const sportOffset = storedOffset / 3;

  const cyclingByDate = calcSportCTL(acts, 'cycling');
  const runningByDate = calcSportCTL(acts, 'running');
  const swimmingByDate = calcSportCTL(acts, 'swimming');

  const n = sportCtlRangeDays;
  const days = Array.from({length:n}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return d; });

  const cycData = [], runData = [], swimData = [];
  days.forEach(d => {
    const k = dayKey(d);
    cycData.push(cyclingByDate[k] != null ? Math.round(cyclingByDate[k] + sportOffset) : null);
    runData.push(runningByDate[k] != null ? Math.round(runningByDate[k] + sportOffset) : null);
    swimData.push(swimmingByDate[k] != null ? Math.round(swimmingByDate[k] + sportOffset) : null);
  });

  if (sportCtlInst) sportCtlInst.destroy();
  sportCtlInst = new Chart(document.getElementById('sportCtlChart'), {
    type: 'line',
    data: {
      labels: days.map(d => fmtDate(d)),
      datasets: [
        {label:'Cycling CTL', data:cycData, borderColor:'#378ADD', backgroundColor:'#378ADD22', tension:0.25, pointRadius:0, borderWidth:2},
        {label:'Running CTL', data:runData, borderColor:'#639922', backgroundColor:'#63992222', tension:0.25, pointRadius:0, borderWidth:2},
        {label:'Swimming CTL', data:swimData, borderColor:'#1D9E75', backgroundColor:'#1D9E7522', tension:0.25, pointRadius:0, borderWidth:2}
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:'#666',font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:8},grid:{color:'#1a1a1a'}},
        y:{ticks:{color:'#666',font:{size:10}},grid:{color:'#1a1a1a'}}
      }
    }
  });
}

function buildSportLoad(acts){
  const weeks=calendarWeeks(8);
  const sportColors={cycling:'#378ADD',running:'#639922',swimming:'#1D9E75',strength:'#7F77DD',other:'#888'};
  const sportLabels={cycling:'Cycling',running:'Running',swimming:'Swimming',strength:'Strength',other:'Other'};
  const sports=['cycling','running','swimming','strength','other'];
  const datasets=sports.map(sp=>({
    label:sportLabels[sp],
    backgroundColor:sportColors[sp],
    data:weeks.map(w=>Math.round(acts.filter(a=>{const ds=(a.start_date_local||'').slice(0,10);return ds>=toYMD(w.start)&&ds<=toYMD(w.end)&&sportClass(a.type)===sp;}).reduce((s,a)=>s+(a.icu_training_load||0),0))),
    stack:'load'
  })).filter(ds=>ds.data.some(v=>v>0));
  if(sportLoadInst)sportLoadInst.destroy();
  sportLoadInst=new Chart(document.getElementById('sportLoadChart'),{type:'bar',data:{labels:weeks.map(w=>w.label),datasets},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
    scales:{x:{stacked:true,ticks:{color:'#666',font:{size:10},maxRotation:45},grid:{color:'#1a1a1a'}},
    y:{stacked:true,ticks:{color:'#666',font:{size:10}},grid:{color:'#1a1a1a'}}}}});
  document.getElementById('sportLoadLegend').innerHTML=datasets.map(ds=>`<div class="leg-item"><span class="leg-dot" style="background:${ds.backgroundColor}"></span>${ds.label}</div>`).join('');
}

function calendarMonths(n){
  const now=new Date();
  const out=[];
  for(let i=n-1;i>=0;i--){
    const start=new Date(now.getFullYear(),now.getMonth()-i,1);
    const end=new Date(now.getFullYear(),now.getMonth()-i+1,0,23,59,59,999);
    const cappedEnd=end>now?now:end;
    out.push({label:start.toLocaleString('default',{month:'short',year:'2-digit'}),start,end:cappedEnd});
  }
  return out;
}

function buildLoad(acts){
  const sport=document.getElementById('loadSport')?.value||'all';
  const period=document.getElementById('loadPeriod')?.value||'weekly';
  const metric=document.getElementById('loadMetric')?.value||'load';

  const buckets=period==='monthly'?calendarMonths(6):calendarWeeks(8);

  const filtered=acts.filter(a=>{
    if(sport==='all')return true;
    const sc=sportClass(a.type);
    if(sport==='strength')return sc==='other'&&/weight|workout|yoga|strength|gym/i.test(a.type||'');
    return sc===sport;
  });

  const vals=buckets.map(b=>{
    const bucket=filtered.filter(a=>{const ds=(a.start_date_local||'').slice(0,10);return ds>=toYMD(b.start)&&ds<=toYMD(b.end);});
    if(metric==='load')   return Math.round(bucket.reduce((s,a)=>s+(a.icu_training_load||0),0));
    if(metric==='duration')return Math.round(bucket.reduce((s,a)=>s+(a.moving_time||0),0)/360)/10; // seconds→hours, 1dp
    if(metric==='distance')return Math.round(bucket.reduce((s,a)=>s+(a.distance||0),0)/1609.34*10)/10; // m→mi, 1dp
    return 0;
  });

  const yLabel=metric==='load'?'TSS':metric==='duration'?'hrs':'mi';

  if(loadInst)loadInst.destroy();
  loadInst=new Chart(document.getElementById('loadChart'),{
    type:'bar',
    data:{labels:buckets.map(b=>b.label),datasets:[{data:vals,backgroundColor:'#1a1a1a',borderColor:'#c8f036',borderWidth:1}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.parsed.y}${yLabel}`}}},
      scales:{
        x:{ticks:{color:'#666',font:{size:10},maxRotation:45},grid:{color:'#1a1a1a'}},
        y:{ticks:{color:'#666',font:{size:10},callback:v=>`${v}${yLabel}`},grid:{color:'#1a1a1a'}}
      }
    }
  });
}

function buildZones(acts){
  const totals=[0,0,0,0,0,0,0];
  acts.forEach(a=>{
    const zt=a.icu_zone_times;
    if(!zt)return;
    let arr;
    if(Array.isArray(zt)){arr=zt;}
    else if(typeof zt==='object'){arr=Object.values(zt);}
    else return;
    arr.forEach((t,i)=>{if(i<7)totals[i]+=(Number(t)||0);});
  });
  const total=totals.reduce((s,v)=>s+v,0);
  const colors=['#378ADD','#639922','#c8f036','#BA7517','#E24B4A','#D4537E','#7F77DD'];
  const el=document.getElementById('zoneRows');
  if(!total){
    el.innerHTML='<div class="empty-note">No zone data available for this period</div>';
    return;
  }
  el.innerHTML=totals.map((t,i)=>{
    const pct=total>0?Math.round((t/total)*100):0;
    return`<div class="zone-row-d"><span class="zone-name-d">Z${i+1}</span><div class="zone-bg-d"><div class="zone-fill-d" style="width:${pct}%;background:${colors[i]}"></div><span class="zone-pct-d">${pct}%</span></div></div>`;
  }).join('');
}

function buildActs(acts){
  lastActs=acts;
  const el=document.getElementById('actList');
  if(!acts.length){el.innerHTML='<div class="empty-note">No activities found</div>';return;}
  el.innerHTML=acts.map(a=>{
    const t=(a.type||'').toLowerCase();
    const cls=t.includes('ride')||t.includes('cycl')?'ride':t.includes('run')?'run':t.includes('swim')?'swim':'';
    const label=t.includes('ride')||t.includes('cycl')?'Ride':t.includes('run')?'Run':t.includes('swim')?'Swim':a.type||'Workout';
    return`<div class="act-row"><div class="act-left"><span class="act-badge ${cls}">${label}</span><div><div class="act-name">${a.name||'Activity'}</div><div class="act-date">${fmtDate(a.start_date_local)}</div></div></div><div class="act-stats"><div class="act-stat"><div class="act-stat-val">${fmtDist(a.distance,a.type)}</div><div class="act-stat-label">Dist</div></div><div class="act-stat"><div class="act-stat-val">${fmtTime(a.moving_time)}</div><div class="act-stat-label">Time</div></div><div class="act-stat"><div class="act-stat-val">${Math.round(a.icu_training_load||0)||'—'}</div><div class="act-stat-label">TSS</div></div></div></div>`;
  }).join('');
}

/* ---------- Zone calculator (thresholds, persisted) ---------- */
const ZC_COLORS=['#378ADD','#1D9E75','#639922','#c8f036','#BA7517','#E24B4A','#D4537E'];
const CYCLING_PWR=[{name:'Z1 — Active recovery',desc:'Recovery rides',lo:0,hi:55},{name:'Z2 — Endurance',desc:'Aerobic base',lo:55,hi:75},{name:'Z3 — Tempo',desc:'Sustained effort',lo:75,hi:90},{name:'Z4 — Threshold',desc:'FTP zone',lo:90,hi:105},{name:'Z5 — VO2max',desc:'Hard intervals',lo:105,hi:120},{name:'Z6 — Anaerobic',desc:'Short efforts',lo:120,hi:150},{name:'Z7 — Neuromuscular',desc:'Sprints',lo:150,hi:200}];
const CYCLING_HR=[{name:'Z1 — Recovery',desc:'Very light',lo:0,hi:68},{name:'Z2 — Aerobic',desc:'Fat burning',lo:68,hi:83},{name:'Z3 — Tempo',desc:'Aerobic threshold',lo:83,hi:94},{name:'Z4 — Threshold',desc:'Lactate threshold',lo:94,hi:105},{name:'Z5 — Max',desc:'VO2max / anaerobic',lo:105,hi:115}];
const RUNNING_PACE=[{name:'Z1 — Easy',desc:'Recovery / long easy',lo:0,hi:76},{name:'Z2 — Aerobic',desc:'Conversational',lo:76,hi:88},{name:'Z3 — Tempo',desc:'Comfortably hard',lo:88,hi:95},{name:'Z4 — Threshold',desc:'Lactate threshold',lo:95,hi:105},{name:'Z5 — VO2max',desc:'5K effort',lo:105,hi:115}];
const SWIM_PACE=[{name:'Z1 — Recovery',desc:'Very easy',lo:0,hi:80},{name:'Z2 — Aerobic',desc:'Steady state',lo:80,hi:90},{name:'Z3 — Threshold',desc:'CSS pace',lo:90,hi:100},{name:'Z4 — Speed',desc:'Above CSS',lo:100,hi:110},{name:'Z5 — Sprint',desc:'Max effort',lo:110,hi:120}];

const zs={
  cycling:{ftp:250,max_hr:185,lthr:165,sub:'power',overrides:{power:{},hr:{}}},
  running:{threshold_pace:'6:00',max_hr:185,lthr:165,sub:'pace',overrides:{pace:{},hr:{}}},
  swimming:{css:'1:45',css_unit:'100m',max_hr:185,lthr:165,sub:'pace',overrides:{pace:{},hr:{}}},
};
var currentSport='cycling';

const ZONE_SETTINGS_KEY='tc_zone_settings';
function saveZoneSettings(){
  const data={
    cycling:{ftp:zs.cycling.ftp,lthr:zs.cycling.lthr,max_hr:zs.cycling.max_hr,overrides:zs.cycling.overrides},
    running:{threshold_pace:zs.running.threshold_pace,lthr:zs.running.lthr,max_hr:zs.running.max_hr,overrides:zs.running.overrides},
    swimming:{css:zs.swimming.css,css_unit:zs.swimming.css_unit,lthr:zs.swimming.lthr,max_hr:zs.swimming.max_hr,overrides:zs.swimming.overrides},
  };
  try{localStorage.setItem(ZONE_SETTINGS_KEY,JSON.stringify(data));}catch(e){}
}
function loadZoneSettings(){
  try{
    const raw=localStorage.getItem(ZONE_SETTINGS_KEY);
    if(!raw)return;
    const data=JSON.parse(raw);
    ['cycling','running','swimming'].forEach(sport=>{
      if(!data[sport])return;
      const{overrides,...rest}=data[sport];
      Object.assign(zs[sport],rest);
      if(overrides){
        Object.keys(overrides).forEach(k=>{
          zs[sport].overrides[k]=overrides[k]||{};
        });
      }
    });
  }catch(e){}
}
// Restore persisted thresholds/overrides immediately so nothing renders with defaults first.
loadZoneSettings();

function parsePace(str){const p=str.split(':');return p.length===2?parseInt(p[0])*60+parseInt(p[1]):360;}
function secsToMMSS(s){s=Math.round(s);const m=Math.floor(s/60),sec=s%60;return m+':'+(sec<10?'0':'')+sec;}

function switchSport(sport){
  currentSport=sport;
  document.querySelectorAll('.sport-tab').forEach((t,i)=>t.classList.toggle('active',['cycling','running','swimming'][i]===sport));
  document.querySelectorAll('.sport-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('sp-'+sport).classList.add('active');
  renderSport(sport);
}

function switchSub(sport,sub){
  zs[sport].sub=sub;
  document.querySelectorAll('#sp-'+sport+' .sub-tab').forEach(t=>t.classList.toggle('active',t.dataset.sub===sub));
  renderZoneTable(sport);
}

function initZoneCalc(){['cycling','running','swimming'].forEach(s=>renderSport(s));}

function renderSport(sport){
  const panel=document.getElementById('sp-'+sport);
  const s=zs[sport];
  let inputs='';
  if(sport==='cycling'){
    inputs=`<div class="threshold-row">
      <div class="zc-field"><label class="zc-label">FTP (watts)</label><input class="zc-input" type="number" value="${s.ftp}" min="50" max="700" step="1" oninput="zs.cycling.ftp=+this.value;zs.cycling.overrides={power:{},hr:{}};saveZoneSettings();renderZoneTable('cycling');buildZoneDistribution()" /></div>
      <div class="zc-field"><label class="zc-label">LTHR (bpm)</label><input class="zc-input" type="number" value="${s.lthr}" min="100" max="220" step="1" oninput="zs.cycling.lthr=+this.value;zs.cycling.overrides.hr={};saveZoneSettings();renderZoneTable('cycling');buildZoneDistribution()" /></div>
      <button class="reset-btn" onclick="zs.cycling.overrides={power:{},hr:{}};saveZoneSettings();renderZoneTable('cycling');buildZoneDistribution()">Reset</button>
    </div>`;
  } else if(sport==='running'){
    inputs=`<div class="threshold-row">
      <div class="zc-field"><label class="zc-label">Threshold pace (min/mile)</label><input class="zc-input" type="text" value="${s.threshold_pace}" placeholder="6:00" oninput="zs.running.threshold_pace=this.value;zs.running.overrides.pace={};saveZoneSettings();renderZoneTable('running');buildZoneDistribution()" /></div>
      <div class="zc-field"><label class="zc-label">LTHR (bpm)</label><input class="zc-input" type="number" value="${s.lthr}" min="100" max="220" step="1" oninput="zs.running.lthr=+this.value;zs.running.overrides.hr={};saveZoneSettings();renderZoneTable('running');buildZoneDistribution()" /></div>
      <button class="reset-btn" onclick="zs.running.overrides={pace:{},hr:{}};saveZoneSettings();renderZoneTable('running');buildZoneDistribution()">Reset</button>
    </div>`;
  } else if(sport==='swimming'){
    inputs=`<div class="threshold-row">
      <div class="zc-field"><label class="zc-label">CSS pace</label><input class="zc-input" type="text" value="${s.css}" placeholder="1:45" oninput="zs.swimming.css=this.value;zs.swimming.overrides.pace={};saveZoneSettings();renderZoneTable('swimming');buildZoneDistribution()" /></div>
      <div class="zc-field"><label class="zc-label">Units</label><select class="zc-select" onchange="zs.swimming.css_unit=this.value;zs.swimming.overrides.pace={};saveZoneSettings();renderZoneTable('swimming');buildZoneDistribution()">
        <option value="100m" ${s.css_unit==='100m'?'selected':''}>per 100m</option>
        <option value="100yd" ${s.css_unit==='100yd'?'selected':''}>per 100yd</option>
      </select></div>
      <button class="reset-btn" onclick="zs.swimming.overrides={pace:{},hr:{}};saveZoneSettings();renderZoneTable('swimming');buildZoneDistribution()">Reset</button>
    </div>`;
  }
  const subA=s.sub==='power'||s.sub==='pace';
  const sub1=sport==='cycling'?'power':'pace';
  panel.innerHTML=inputs+`<div class="sub-tabs">
    <button class="sub-tab ${subA?'active':''}" data-sub="${sub1}" onclick="switchSub('${sport}','${sub1}')">${sport==='cycling'?'Power':'Pace'}</button>
    <button class="sub-tab ${!subA?'active':''}" data-sub="hr" onclick="switchSub('${sport}','hr')">Heart rate</button>
  </div><div id="zt-${sport}"></div>`;
  renderZoneTable(sport);
}

function renderZoneTable(sport){
  const s=zs[sport];
  const sub=s.sub;
  const el=document.getElementById('zt-'+sport);
  let zones,getVals;
  if(sport==='cycling'&&sub==='power'){
    zones=CYCLING_PWR;
    getVals=(z,i)=>{const ov=s.overrides.power[i];const lo=ov?ov[0]:Math.round(s.ftp*z.lo/100);const hi=ov?ov[1]:Math.round(s.ftp*z.hi/100);return{loStr:lo+'w',hiStr:hi+'w',barPct:Math.min(100,z.hi/2)};};
  } else if(sport==='cycling'&&sub==='hr'){
    zones=CYCLING_HR;
    getVals=(z,i)=>{const base=s.lthr||s.max_hr;const ov=s.overrides.hr[i];const lo=ov?ov[0]:Math.round(base*z.lo/100);const hi=ov?ov[1]:Math.round(base*z.hi/100);return{loStr:lo+'bpm',hiStr:hi+'bpm',barPct:z.hi};};
  } else if(sport==='running'&&sub==='pace'){
    zones=RUNNING_PACE;
    getVals=(z,i)=>{const thresh=parsePace(s.threshold_pace);const ov=s.overrides.pace[i];const lo=ov?ov[0]:secsToMMSS(thresh*100/z.hi);const hi=ov?ov[1]:(z.lo===0?'—':secsToMMSS(thresh*100/z.lo));return{loStr:lo,hiStr:hi,barPct:Math.min(100,z.hi/1.15)};};
  } else if(sport==='running'&&sub==='hr'){
    zones=CYCLING_HR;
    getVals=(z,i)=>{const base=s.lthr||s.max_hr;const ov=s.overrides.hr[i];const lo=ov?ov[0]:Math.round(base*z.lo/100);const hi=ov?ov[1]:Math.round(base*z.hi/100);return{loStr:lo+'bpm',hiStr:hi+'bpm',barPct:z.hi};};
  } else if(sport==='swimming'&&sub==='pace'){
    zones=SWIM_PACE;
    getVals=(z,i)=>{const css=parsePace(s.css);const ov=s.overrides.pace[i];const lo=ov?ov[0]:secsToMMSS(css*100/z.hi);const hi=ov?ov[1]:(z.lo===0?'—':secsToMMSS(css*100/z.lo));return{loStr:lo+'/'+s.css_unit,hiStr:hi+(hi==='—'?'':'/'+s.css_unit),barPct:Math.min(100,z.hi/1.2)};};
  } else {
    zones=CYCLING_HR;
    getVals=(z,i)=>{const base=s.lthr||s.max_hr;const ov=s.overrides.hr[i];const lo=ov?ov[0]:Math.round(base*z.lo/100);const hi=ov?ov[1]:Math.round(base*z.hi/100);return{loStr:lo+'bpm',hiStr:hi+'bpm',barPct:z.hi};};
  }
  const ovKey=(sub==='power'||sub==='pace')?(sport==='cycling'?'power':'pace'):'hr';
  const hasOv=Object.keys(s.overrides[ovKey]||{}).length>0;
  const rows=zones.map((z,i)=>{
    const{loStr,hiStr,barPct}=getVals(z,i);
    const isOv=!!(s.overrides[ovKey]||{})[i];
    const cls=isOv?'editable ov':'editable';
    return`<tr class="zone-tr"><td class="zone-td"><div class="zone-name-wrap"><span class="zone-color-dot" style="background:${ZC_COLORS[i]}"></span>${z.name}</div><div class="zone-desc-small">${z.desc}</div></td><td class="zone-td"><input class="${cls}" value="${loStr}" onchange="handleOv('${sport}','${ovKey}',${i},'lo',this.value,this)" /></td><td class="zone-td"><input class="${cls}" value="${hiStr}" onchange="handleOv('${sport}','${ovKey}',${i},'hi',this.value,this)" /></td><td class="zone-td" style="width:140px"><div class="bar-bg-z"><div class="bar-fill-z" style="width:${barPct}%;background:${ZC_COLORS[i]}"></div></div><div class="pct-hint">${z.lo}–${z.hi}% threshold</div></td></tr>`;
  }).join('');
  el.innerHTML=`<table class="zone-table"><thead><tr><th style="width:220px">Zone</th><th>From</th><th>To</th><th>Intensity</th></tr></thead><tbody>${rows}</tbody></table>
  ${hasOv?'<p class="ov-note">Highlighted values are manually overridden — click Reset to recalculate from threshold</p>':''}
  <p class="zc-note">Click any value to edit directly. Updating the threshold above recalculates all non-overridden zones.</p>`;
}

function handleOv(sport,ovKey,idx,side,val,inputEl){
  if(!zs[sport].overrides[ovKey])zs[sport].overrides[ovKey]={};
  if(!zs[sport].overrides[ovKey][idx])zs[sport].overrides[ovKey][idx]=['—','—'];
  zs[sport].overrides[ovKey][idx][side==='lo'?0:1]=val;
  inputEl.className='editable ov';
  saveZoneSettings();
  buildZoneDistribution();
}

/* ---------- Zone distribution from stream data, mapped to custom zones ---------- */
function zoneBoundsFor(sport,metric){
  const s=zs[sport];
  if(metric==='hr'){
    const base=s.lthr||s.max_hr;
    return CYCLING_HR.map((z,i)=>{const ov=s.overrides.hr[i];return ov?[Number(ov[0])||0,Number(ov[1])||9999]:[Math.round(base*z.lo/100),Math.round(base*z.hi/100)];});
  }
  if(sport==='cycling'){
    return CYCLING_PWR.map((z,i)=>{const ov=s.overrides.power[i];return ov?[Number(ov[0])||0,Number(ov[1])||9999]:[Math.round(s.ftp*z.lo/100),Math.round(s.ftp*z.hi/100)];});
  }
  if(sport==='running'){
    const thresh=parsePace(s.threshold_pace);
    // pace zones: faster pace = higher speed; convert bound % of threshold pace into m/s thresholds via speed ratio
    return RUNNING_PACE.map(z=>{
      const loSpeed=z.hi/100, hiSpeed=z.lo===0?999:z.lo/100; // relative speed multiples of threshold speed
      return[loSpeed,hiSpeed];
    });
  }
  // swimming pace -> speed multiples too
  return SWIM_PACE.map(z=>{
    const loSpeed=z.hi/100, hiSpeed=z.lo===0?999:z.lo/100;
    return[loSpeed,hiSpeed];
  });
}

// Returns a human-readable zone boundary range string for display inside the bar.
// Uses the same threshold math as renderZoneTable so values always match.
function fmtZoneBoundsDisplay(sport,metric,i){
  const s=zs[sport];
  if(metric==='hr'){
    const base=s.lthr||s.max_hr;
    const z=CYCLING_HR[i]; if(!z)return'';
    const ov=(s.overrides.hr||{})[i];
    const lo=ov?ov[0]:Math.round(base*z.lo/100);
    const hi=ov?ov[1]:Math.round(base*z.hi/100);
    return lo+'–'+hi+' bpm';
  }
  if(sport==='cycling'){
    const z=CYCLING_PWR[i]; if(!z)return'';
    const ov=(s.overrides.power||{})[i];
    const lo=ov?ov[0]:Math.round(s.ftp*z.lo/100);
    const hi=ov?ov[1]:Math.round(s.ftp*z.hi/100);
    return lo+'–'+hi+'w';
  }
  if(sport==='running'){
    const z=RUNNING_PACE[i]; if(!z)return'';
    const thresh=parsePace(s.threshold_pace);
    const ov=(s.overrides.pace||{})[i];
    const faster=ov?ov[0]:secsToMMSS(Math.round(thresh*100/z.hi));
    const slower=ov?ov[1]:(z.lo===0?null:secsToMMSS(Math.round(thresh*100/z.lo)));
    return slower?faster+'–'+slower+'/mi':'<'+faster+'/mi';
  }
  if(sport==='swimming'){
    const z=SWIM_PACE[i]; if(!z)return'';
    const thresh=parsePace(s.css);
    const ov=(s.overrides.pace||{})[i];
    const faster=ov?ov[0]:secsToMMSS(Math.round(thresh*100/z.hi));
    const slower=ov?ov[1]:(z.lo===0?null:secsToMMSS(Math.round(thresh*100/z.lo)));
    const unit='/'+s.css_unit;
    return slower?faster+'–'+slower+unit:'<'+faster+unit;
  }
  return'';
}

async function loadZoneDistribution(){
  updateZdMetricOptions();
  await onZoneDistControlChange();
}

// Re-classify the (already-cached) stream samples into zones using the current
function updateZdMetricOptions(){
  const sport=document.getElementById('zdSport').value;
  const sel=document.getElementById('zdMetric');
  const hrOpt=sel.querySelector('option[value="hr"]');
  const powerOpt=sel.querySelector('option[value="power"]');
  const paceOpt=sel.querySelector('option[value="pace"]');
  if(sport==='cycling'){
    if(hrOpt)hrOpt.style.display='';
    if(powerOpt)powerOpt.style.display='';
    if(paceOpt)paceOpt.style.display='none';
    sel.value='power';
  }else if(sport==='running'){
    if(hrOpt)hrOpt.style.display='';
    if(powerOpt)powerOpt.style.display='none';
    if(paceOpt)paceOpt.style.display='';
    sel.value='pace';
  }else if(sport==='swimming'){
    if(hrOpt)hrOpt.style.display='none';
    if(powerOpt)powerOpt.style.display='none';
    if(paceOpt)paceOpt.style.display='';
    sel.value='pace';
  }
  onZoneDistControlChange();
}

// thresholds/overrides — called whenever a threshold value changes so the
// distribution reflects the new zone boundaries without re-fetching streams.
async function buildZoneDistribution(){
  await onZoneDistControlChange();
}

async function onZoneDistControlChange(){
  const sport=document.getElementById('zdSport').value;
  const metric=document.getElementById('zdMetric').value;
  const win=Number(document.getElementById('zdWindow').value);
  const el=document.getElementById('zoneRows');

  if(sport==='running'){
    if(metric!=='hr'&&metric!=='pace'){el.innerHTML='<div class="empty-note">No running power data available</div>';return;}
    el.innerHTML='<div class="empty-note">Loading run zones…</div>';
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-win);
    const cutoffStr=toYMD(cutoff);
    const acts=allActivities.filter(a=>sportClass(a.type)==='running'&&(a.start_date_local||'').slice(0,10)>=cutoffStr&&(a.start_date_local||'').slice(0,10)>=HM2L_RUN_SWIM_START).slice(0,20);
    if(!acts.length){el.innerHTML='<div class="empty-note">No running activities in this window</div>';return;}
    try{
      const totals=new Array(5).fill(0);
      let any=false;
      if(metric==='hr'){
        const lthr=zs.running.lthr||165;
        const streams=await Promise.all(acts.map(a=>fetchStream(a.id,'heartrate')));
        streams.forEach(stream=>{
          if(!stream||!stream.length)return;
          any=true;
          stream.forEach(v=>{
            if(v==null||v<=0)return;
            const pct=v/lthr*100;
            if(pct<68)totals[0]++;
            else if(pct<83)totals[1]++;
            else if(pct<94)totals[2]++;
            else if(pct<105)totals[3]++;
            else totals[4]++;
          });
        });
        if(!any){el.innerHTML='<div class="empty-note">No HR stream data for running activities in this window</div>';return;}
      } else if(metric==='pace'){
        // pace: velocity_smooth → sec/mile, compare against threshold_pace
        const threshSec=parsePace(zs.running.threshold_pace||'6:00');
        const streams=await Promise.all(acts.map(a=>fetchStream(a.id,'velocity_smooth')));
        streams.forEach(stream=>{
          if(!stream||!stream.length)return;
          any=true;
          stream.forEach(v=>{
            if(v==null||v<=0)return;
            const pace=1609.34/v; // sec/mile
            const pct=pace/threshSec*100;
            // slower pace = higher pct = easier zone
            if(pct>120)totals[0]++;
            else if(pct>110)totals[1]++;
            else if(pct>100)totals[2]++;
            else if(pct>90)totals[3]++;
            else totals[4]++;
          });
        });
        if(!any){el.innerHTML='<div class="empty-note">No velocity stream data for running activities in this window</div>';return;}
      }
      const total=totals.reduce((s,v)=>s+v,0);
      if(!total){el.innerHTML='<div class="empty-note">No samples in zone range</div>';return;}
      el.innerHTML=totals.map((t,i)=>{
        const pct=Math.round((t/total)*100);
        const color=ZC_COLORS[i]||'#7F77DD';
        return`<div class="zone-row-d"><span class="zone-name-d">Z${i+1}</span><div class="zone-bg-d"><div class="zone-fill-d" style="width:${pct}%;background:${color}"></div><span class="zone-pct-d">${pct}%</span></div></div>`;
      }).join('');
    }catch(e){el.innerHTML='<div class="empty-note">Could not load run zone data</div>';}
    return;
  }

  if(sport==='swimming'){
    if(metric==='power'){el.innerHTML='<div class="empty-note">No swimming power data available</div>';return;}
    el.innerHTML='<div class="empty-note">Loading swim zones…</div>';
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-win);
    const cutoffStr=toYMD(cutoff);
    const acts=allActivities.filter(a=>sportClass(a.type)==='swimming'&&(a.start_date_local||'').slice(0,10)>=cutoffStr&&(a.start_date_local||'').slice(0,10)>=HM2L_RUN_SWIM_START).slice(0,20);
    if(!acts.length){el.innerHTML='<div class="empty-note">No swimming activities in this window</div>';return;}
    try{
      const totals=new Array(5).fill(0);
      let any=false;
      const datas=await Promise.all(acts.map(a=>fetchSwimActivity(a.id)));
      datas.forEach(data=>{
        const pzt=data&&data.pace_zone_times;
        if(!pzt||!pzt.length)return;
        any=true;
        for(let i=0;i<5;i++)totals[i]+=(pzt[i]||0);
      });
      if(!any){el.innerHTML='<div class="empty-note">No pace zone data for swim activities in this window</div>';return;}
      const total=totals.reduce((s,v)=>s+v,0);
      if(!total){el.innerHTML='<div class="empty-note">No zone time recorded</div>';return;}
      el.innerHTML=totals.map((t,i)=>{
        const pct=Math.round((t/total)*100);
        const color=ZC_COLORS[i]||'#7F77DD';
        return`<div class="zone-row-d"><span class="zone-name-d">Z${i+1}</span><div class="zone-bg-d"><div class="zone-fill-d" style="width:${pct}%;background:${color}"></div><span class="zone-pct-d">${pct}%</span></div></div>`;
      }).join('');
    }catch(e){el.innerHTML='<div class="empty-note">Could not load swim zone data</div>';}
    return;
  }

  el.innerHTML='<div class="empty-note">Loading zones...</div>';
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-win);
  const cutoffStr=toYMD(cutoff);const acts=allActivities.filter(a=>sportClass(a.type)===sport&&(a.start_date_local||'').slice(0,10)>=cutoffStr).slice(0,20);
  if(!acts.length){el.innerHTML='<div class="empty-note">No '+sport+' activities in this window</div>';return;}
  try{
    // Cycling only: watts streams
    const streamType='watts';
    const results=await Promise.all(acts.map(a=>fetchStream(a.id,streamType)));
    const bounds=zoneBoundsFor(sport,metric);
    const totals=new Array(bounds.length).fill(0);
    let any=false;
    results.forEach(stream=>{
      if(!stream||!stream.length)return;
      any=true;
      stream.forEach(v=>{
        if(v==null)return;
        for(let i=0;i<bounds.length;i++){
          const[lo,hi]=bounds[i];
          if(v>=lo&&v<hi){totals[i]+=1;break;}
        }
      });
    });
    if(!any){el.innerHTML='<div class="empty-note">No power stream data found</div>';return;}
    const total=totals.reduce((s,v)=>s+v,0);
    if(!total){el.innerHTML='<div class="empty-note">No samples in zone range</div>';return;}
    el.innerHTML=totals.map((t,i)=>{
      const pct=Math.round((t/total)*100);
      const color=ZC_COLORS[i]||'#7F77DD';
      const range=fmtZoneBoundsDisplay(sport,metric,i);
      return`<div class="zone-row-d"><span class="zone-name-d">Z${i+1}</span><div class="zone-bg-d"><div class="zone-fill-d" style="width:${pct}%;background:${color}"></div>${range?`<span class="zone-range-d" style="left:${pct}%">${range}</span>`:''}<span class="zone-pct-d">${pct}%</span></div></div>`;
    }).join('');
  }catch(e){
    el.innerHTML='<div class="empty-note">Could not load stream-based zone data</div>';
  }
}

// Stream fetching is used exclusively for cycling watts streams.
// Run and swim streams are not fetched — those curves are disabled while data collects.
async function fetchStream(activityId,type){
  const cacheKey=activityId+':'+type;
  // 1. In-memory cache
  if(zoneStreamCache[cacheKey])return zoneStreamCache[cacheKey];
  // 2. Supabase stream cache
  try{
    const cached=await fetch('/api/stream-cache?activity_id='+activityId+'&stream_type='+type);
    if(cached.ok){
      const cj=await cached.json();
      if(cj.cached&&Array.isArray(cj.data)){
        zoneStreamCache[cacheKey]=cj.data;
        return zoneStreamCache[cacheKey];
      }
    }
  }catch(_){}
  // 3. Fetch from intervals.icu
  try{
    const data=await apiCall(curId,curKey,activityId+'/streams','types='+type,'activity');
    let arr=null;
    if(Array.isArray(data)){
      const match=data.find(d=>d.type===type)||data[0];
      arr=match?match.data:null;
    } else if(data&&data[type]){
      arr=data[type].data||data[type];
    } else if(data&&data.data){
      arr=data.data;
    }
    arr=arr||[];
    zoneStreamCache[cacheKey]=arr;
    // 4. Write to Supabase cache in background
    if(arr.length){
      fetch('/api/stream-cache',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({activity_id:String(activityId),stream_type:type,data:arr})
      }).catch(()=>{});
    }
    return arr;
  }catch(e){
    zoneStreamCache[cacheKey]=[];
    return[];
  }
}

async function fetchSwimActivity(activityId){
  console.log('fetchSwimActivity called:',activityId,'curId:',curId,'curKey:',curKey?'set':'missing');
  if(swimActivityCache[activityId])return swimActivityCache[activityId];
  try{
    const raw=await apiCall(curId,curKey,'activities/'+activityId);
    console.log('fetchSwimActivity raw type:',typeof raw,Array.isArray(raw),'length:',raw?.length);
    const data=(Array.isArray(raw)?raw[0]:raw)||{};
    console.log('fetchSwimActivity data keys:',Object.keys(data).slice(0,10));
    console.log('pace_zone_times:',data.pace_zone_times);
    console.log('interval_summary:',data.interval_summary);
    swimActivityCache[activityId]=data;
    return swimActivityCache[activityId];
  }catch(e){
    console.log('fetchSwimActivity error:',e.message);
    swimActivityCache[activityId]={};
    return {};
  }
}

/* ---------- Peak power / pace duration curve ---------- */
const HM2L_RUN_SWIM_START='2026-06-08';
const CURVE_DURATIONS=[5,10,30,60,120,300,600,1200,1800,3600,5400,7200];
const CURVE_LABELS=['5s','10s','30s','1m','2m','5m','10m','20m','30m','1h','90m','2h'];
const SWIM_CURVE_DISTANCES=[25,50,100,200,400,500,1000,1500];
const SWIM_CURVE_LABELS=['25y','50y','100y','200y','400y','500y','1000y','1500y'];

// Rolling max average over a sliding window — used for cycling watts.
function rollingMax(arr,windowSecs){
  if(!arr||arr.length<windowSecs)return null;
  let sum=0,max=-Infinity;
  for(let i=0;i<arr.length;i++){
    sum+=(Number(arr[i])||0);
    if(i>=windowSecs)sum-=(Number(arr[i-windowSecs])||0);
    if(i>=windowSecs-1)max=Math.max(max,sum/windowSecs);
  }
  return isFinite(max)?max:null;
}

function calcCurveBest(actList,streamMap){
  const best=CURVE_DURATIONS.map(()=>null);
  actList.forEach(a=>{
    const arr=streamMap[a.id];
    if(!arr||!arr.length)return;
    CURVE_DURATIONS.forEach((d,i)=>{
      const m=rollingMax(arr,d);
      if(m!=null&&(best[i]==null||m>best[i]))best[i]=m;
    });
  });
  return best;
}

// Score an intervals.icu label by window length (higher = longer).
function windowScore(l){
  const s=(l||'').toLowerCase();
  if(/all.?time/.test(s))return 1000;
  if(/1.?year|12.?month/.test(s))return 365;
  if(/6.?month/.test(s))return 180;
  if(/3.?month/.test(s))return 90;
  if(/4.?week|28.?day|30.?day|last.?30/.test(s))return 30;
  return 0;
}

// Fetch watts streams for a list of cycling activities and compute per-duration best values.
// Returns array aligned to CURVE_DURATIONS in watts.
async function buildStreamCurve(acts, streamType, progressId){
  const best=CURVE_DURATIONS.map(()=>null);
  let done=0;
  await Promise.all(acts.map(async a=>{
    const arr=await fetchStream(a.id,streamType);
    done++;
    const el=document.getElementById(progressId);
    if(el)el.style.width=Math.round(done/acts.length*100)+'%';
    if(!arr||!arr.length)return;
    const filtered=arr.filter(v=>v!=null&&v>0);
    if(streamType==='velocity_smooth'&&filtered.length){
      const minV=Math.min(...filtered),maxV=Math.max(...filtered);
      console.log(`[curve] act ${a.id} (${a.name||'?'}) len=${filtered.length} v=${minV.toFixed(3)}-${maxV.toFixed(3)} m/s | pace ${(1609.34/maxV).toFixed(0)}-${(1609.34/minV).toFixed(0)} s/mi | ${(100/maxV).toFixed(1)}-${(100/minV).toFixed(1)} s/100m`);
    }
    CURVE_DURATIONS.forEach((d,i)=>{
      const m=rollingMax(filtered,d);
      if(m!=null&&(best[i]==null||m>best[i]))best[i]=m;
    });
  }));
  return best;
}

function mpsToSecsPerMile(v){return v>0?1609.34/v:null;}
function mpsToSecsPer100m(v){return v>0?100/v:null;}
function fmtPace(secs){if(!secs||secs<=0)return'—';const m=Math.floor(secs/60),s=Math.round(secs%60);return m+':'+(s<10?'0':'')+s;}

// interval_summary-based swim curve. Returns array aligned to SWIM_CURVE_DISTANCES.
// Each element is best pace in sec/100yd (null if no data).
// Parses ICU interval_summary strings like "2x 200y 1:34" or "1x 400y 1:28".
async function buildSwimCurve(swims){
  const best=SWIM_CURVE_DISTANCES.map(()=>null);
  let done=0;
  const progEl=()=>document.getElementById('curveProg');
  // interval_summary pace is per 100 of whatever unit — we treat it as sec/100y directly
  const parseMMSS=s=>{if(!s)return null;const p=s.split(':');if(p.length<2)return null;return parseInt(p[0])*60+parseInt(p[1]);};
  await Promise.all(swims.map(async a=>{
    try{
      const data=await fetchSwimActivity(a.id);
      done++;const el=progEl();if(el)el.style.width=Math.round(done/swims.length*100)+'%';
      const summary=(data&&data.interval_summary)||[];
      if(!summary.length)return;
      (Array.isArray(summary)?summary:[summary]).forEach(entry=>{
        // match: {count}x {dist}{unit} {MM:SS}
        const m=entry.trim().match(/^(\d+)x\s+(\d+(?:\.\d+)?)(y|m|yd|km)?\s+(\d+:\d+)/i);
        if(!m)return;
        const count=parseInt(m[1]);
        const dist=parseFloat(m[2]);
        const unit=(m[3]||'y').toLowerCase();
        const pace=parseMMSS(m[4]);
        if(!pace||!dist||!count)return;
        // Normalise distance to yards
        const yards=unit==='m'||unit==='km'?dist*(unit==='km'?1093.61:1.09361):dist;
        // Total distance this set covers
        const totalYards=count*yards;
        SWIM_CURVE_DISTANCES.forEach((targetYards,di)=>{
          if(totalYards<targetYards)return;
          // pace is already sec/100y; use as-is for matching distances
          // if target === yards (single rep), use pace directly
          // if target <= totalYards, the stated pace is valid for that distance
          if(best[di]===null||pace<best[di])best[di]=pace;
        });
      });
    }catch(e){
      done++;const el=progEl();if(el)el.style.width=Math.round(done/swims.length*100)+'%';
    }
  }));
  return best;
}

// Render the dual-dataset power/pace chart.
// allTimePairs: [{s,v}] — raw stream units (watts or m/s)
// recentPairs:  [{s,v}] or null
// isRun: true → convert m/s → secs/mile, inverted Y axis
// note: small attribution text
function drawCurveChart(box, allTimePairs, recentPairs, isRun, note, allTimeLabel, isSwim){
  const DISPLAY_SECS=[5,10,30,60,120,300,600,1200,1800,3600,5400,7200];
  function fmtSecs(s){return s<60?s+'s':s<3600?(s/60)%1===0?(s/60)+'m':(s/60).toFixed(1)+'m':s%3600===0?(s/3600)+'h':(s/3600).toFixed(1)+'h';}

  function makeLookup(pairs){
    return function(secs){
      if(!pairs||!pairs.length)return null;
      let best=null,bestDiff=Infinity;
      pairs.forEach(p=>{const d=Math.abs(p.s-secs);if(d<bestDiff){bestDiff=d;best=p;}});
      return(best&&bestDiff<secs*0.2)?best.v:null;
    };
  }
  const lookupAll=makeLookup(allTimePairs);
  const lookupRec=makeLookup(recentPairs||[]);

  const validSecs=DISPLAY_SECS.filter(s=>lookupAll(s)!=null||lookupRec(s)!=null);
  if(!validSecs.length){box.innerHTML='<div class="empty-note">No curve data for these durations.</div>';return;}
  const chartLabels=validSecs.map(fmtSecs);

  // Convert raw value to chart Y value
  const swimUnit=isSwim?(zs.swimming.css_unit||'100m'):'';
  const swimDist=swimUnit==='100yd'?91.44:100;
  const swimLabel=swimUnit?'/'+swimUnit:'';
  const mpsToSwimPace=v=>v>0?swimDist/v:null;
  const toChart=v=>v==null?null:(isSwim?mpsToSwimPace(v):isRun?mpsToSecsPerMile(v):Math.round(v));
  const fmtVal=v=>v==null?'—':(isSwim?fmtPace(mpsToSwimPace(v))+swimLabel:isRun?fmtPace(mpsToSecsPerMile(v)):Math.round(v)+'w');

  const allTimeData=validSecs.map(s=>toChart(lookupAll(s)));
  const recentData=recentPairs?validSecs.map(s=>toChart(lookupRec(s))):null;

  // For running: detect new peaks where recent is faster (lower secs/mile)
  const isNewPeak=(i)=>{
    if(!recentData)return false;
    const a=allTimeData[i],r=recentData[i];
    if(a==null||r==null)return false;
    return isRun?(r<a):(r>a);
  };

  if(curveInst)curveInst.destroy();
  box.style.overflow='hidden';
  box.innerHTML='<div style="position:relative;height:230px;width:100%;max-width:100%;overflow:hidden"><canvas id="curveChart" style="max-width:100%;width:100%"></canvas></div><div id="curveTableWrap"></div>';

  const datasets=[{
    label:allTimeLabel||'All-time best',
    data:allTimeData,
    borderColor:'#c8f036',backgroundColor:'rgba(200,240,54,0.13)',
    fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#c8f036',order:2
  }];
  if(recentData){
    datasets.push({
      label:'Last 30 days',
      data:recentData,
      borderColor:'#378ADD',backgroundColor:'transparent',
      fill:false,tension:0.3,pointRadius:4,order:1,
      pointBackgroundColor:ctx=>isNewPeak(ctx.dataIndex)?'#00ff88':'#378ADD',
      pointBorderColor:ctx=>isNewPeak(ctx.dataIndex)?'#00ff88':'#378ADD',
      segment:{borderColor:ctx=>isNewPeak(ctx.p0DataIndex)?'#00ff88':'#378ADD'}
    });
  }

  // Running Y axis: 4:00/mi = 240 s/mi (fast), 12:00/mi = 720 s/mi (slow).
  // Swimming Y axis: 1:00/100m = 60 s/100m (fast), 3:20/100m = 200 s/100m (slow).
  // reverse:true so faster (smaller secs) appears higher.
  const yOpts=isSwim?{
    reverse:true,min:60,max:200,
    ticks:{color:'#666',font:{size:10},stepSize:30,callback:v=>fmtPace(v)+swimLabel},
    grid:{color:'#1a1a1a'}
  }:isRun?{
    reverse:true,min:240,max:720,
    ticks:{color:'#666',font:{size:10},stepSize:60,callback:v=>fmtPace(v)},
    grid:{color:'#1a1a1a'}
  }:{
    ticks:{color:'#666',font:{size:10},callback:v=>v+'w'},
    grid:{color:'#1a1a1a'}
  };

  curveInst=new Chart(document.getElementById('curveChart'),{
    type:'line',
    data:{labels:chartLabels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,labels:{color:'#999',font:{size:10,family:'DM Mono, monospace'},boxWidth:12,padding:14}},
        tooltip:{callbacks:{label:ctx=>{
          const raw=ctx.parsed.y;
          if(raw==null)return ctx.dataset.label+': —';
          const disp=isSwim?fmtPace(raw)+swimLabel:isRun?fmtPace(raw):raw+'w';
          const pk=ctx.datasetIndex===1&&isNewPeak(ctx.dataIndex)?' ★ new peak':'';
          return ctx.dataset.label+': '+disp+pk;
        }}}
      },
      scales:{
        x:{ticks:{color:'#666',font:{size:10}},grid:{color:'#1a1a1a'}},
        y:yOpts
      }
    }
  });

  // Summary table
  const wrap=document.getElementById('curveTableWrap');
  const tableRows=[
    {lbl:allTimeLabel||'All-time',data:validSecs.map(s=>fmtVal(lookupAll(s))),color:'var(--tc)'},
    ...(recentData?[{lbl:'30 days',data:validSecs.map((s,i)=>({v:fmtVal(lookupRec(s)),pk:isNewPeak(i)})),color:'#378ADD'}]:[])
  ];
  wrap.innerHTML='<table class="curve-table" style="margin-top:1rem">'
    +'<thead><tr><th>Duration</th>'+chartLabels.map(l=>'<th>'+l+'</th>').join('')+'</tr></thead>'
    +'<tbody>'
    +tableRows.map(r=>'<tr><td style="color:'+r.color+'">'+r.lbl+'</td>'
      +r.data.map(v=>{
        if(typeof v==='object'&&v.pk!==undefined)
          return'<td style="'+(v.pk?'color:#00ff88;font-weight:600':'')+'">'+v.v+(v.pk?' ★':'')+'</td>';
        return'<td>'+v+'</td>';
      }).join('')+'</tr>'
    ).join('')
    +'</tbody></table>'
    +(note?'<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--tc3);margin-top:0.6rem">'+note+'</div>':'');
}

function drawSwimCurveChart(box,allPairs,recentPairs,note){
  // allPairs/recentPairs: [{d: yards, v: sec/100yd}]
  const lookup=(pairs,targetD)=>{
    if(!pairs||!pairs.length)return null;
    const p=pairs.find(x=>x.d===targetD);
    return p?p.v:null;
  };
  const validDists=SWIM_CURVE_DISTANCES.filter(d=>lookup(allPairs,d)!=null||lookup(recentPairs||[],d)!=null);
  if(!validDists.length){box.innerHTML='<div class="empty-note">No swim lap data for these distances.</div>';return;}
  const labels=validDists.map(d=>SWIM_CURVE_LABELS[SWIM_CURVE_DISTANCES.indexOf(d)]);
  const allData=validDists.map(d=>lookup(allPairs,d));
  const recData=recentPairs?validDists.map(d=>lookup(recentPairs,d)):null;
  const isNewPeak=i=>{
    if(!recData)return false;
    const a=allData[i],r=recData[i];
    return a!=null&&r!=null&&r<a;
  };
  if(curveInst)curveInst.destroy();
  box.style.overflow='hidden';
  box.innerHTML='<div style="position:relative;height:230px;width:100%;max-width:100%;overflow:hidden"><canvas id="curveChart" style="max-width:100%;width:100%"></canvas></div><div id="curveTableWrap"></div>';
  const datasets=[{
    label:'All-time best',
    data:allData,
    borderColor:'#c8f036',backgroundColor:'rgba(200,240,54,0.13)',
    fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#c8f036',order:2
  }];
  if(recData){
    datasets.push({
      label:'Last 30 days',
      data:recData,
      borderColor:'#378ADD',backgroundColor:'transparent',
      fill:false,tension:0.3,pointRadius:4,order:1,
      pointBackgroundColor:ctx=>isNewPeak(ctx.dataIndex)?'#00ff88':'#378ADD',
      pointBorderColor:ctx=>isNewPeak(ctx.dataIndex)?'#00ff88':'#378ADD',
      segment:{borderColor:ctx=>isNewPeak(ctx.p0DataIndex)?'#00ff88':'#378ADD'}
    });
  }
  curveInst=new Chart(document.getElementById('curveChart'),{
    type:'line',
    data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#aaa',font:{size:11}}},tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmtPace(ctx.raw)+'/100y'}}},
      scales:{
        x:{ticks:{color:'#666',font:{size:10}},grid:{color:'#1a1a1a'}},
        y:{reverse:true,min:60,max:200,ticks:{color:'#666',font:{size:10},stepSize:20,callback:v=>fmtPace(v)+'/100y'},grid:{color:'#1a1a1a'}}
      }
    }
  });
  // Table
  const rows=validDists.map((d,i)=>{
    const a=allData[i],r=recData?recData[i]:null;
    const pk=r!=null&&a!=null&&r<a;
    return`<tr><td>${SWIM_CURVE_LABELS[SWIM_CURVE_DISTANCES.indexOf(d)]}</td><td>${a!=null?fmtPace(a)+'/100y':'—'}</td><td style="${pk?'color:#00ff88;font-weight:600':''}">${r!=null?fmtPace(r)+'/100y'+(pk?' ★':''):'—'}</td></tr>`;
  }).join('');
  document.getElementById('curveTableWrap').innerHTML=
    '<table style="width:100%;font-family:\'DM Mono\',monospace;font-size:11px;color:var(--tc2);border-collapse:collapse;margin-top:0.75rem">'
    +'<thead><tr style="color:var(--tc3);font-size:10px"><th style="text-align:left;padding:4px 8px">Distance</th><th style="text-align:right;padding:4px 8px">All-time</th><th style="text-align:right;padding:4px 8px">Last 30d</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table>'
    +(note?'<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--tc3);margin-top:0.6rem">'+note+'</div>':'');
}

async function renderCurve(){
  const sport=document.getElementById('curveSport').value;
  const box=document.getElementById('curveBox');

  // 30-day cutoff
  const thirtyDaysAgo=new Date();thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);

  if(sport==='cycling'){
    box.innerHTML='<div class="curve-loading">Loading power curve…'
      +'<div class="curve-progress-bar"><div class="curve-progress-fill" id="curveProg" style="width:0%"></div></div></div>';
    try{
      const rides=allActivities.filter(a=>sportClass(a.type)==='cycling').slice(0,30);
      if(!rides.length){box.innerHTML='<div class="empty-note">No cycling activities available.</div>';return;}
      const recentRides=rides.filter(a=>(a.start_date_local||'').slice(0,10)>=toYMD(thirtyDaysAgo));
      const allBest=await buildStreamCurve(rides,'watts','curveProg');
      const allPairs=CURVE_DURATIONS.map((s,i)=>allBest[i]!=null?{s,v:allBest[i]}:null).filter(Boolean);
      let recentPairs=null;
      if(recentRides.length){
        const recentBest=await buildStreamCurve(recentRides,'watts','curveProg');
        const rp=CURVE_DURATIONS.map((s,i)=>recentBest[i]!=null?{s,v:recentBest[i]}:null).filter(Boolean);
        if(rp.length)recentPairs=rp;
      }
      if(!allPairs.length){box.innerHTML='<div class="empty-note">No cycling power stream data available — ride with a power meter to build the curve</div>';return;}
      const note='All rides: watts streams'+(recentPairs?' | 30 days: '+recentRides.length+' rides':'');
      drawCurveChart(box,allPairs,recentPairs,false,note);
    }catch(e){
      box.innerHTML='<div class="empty-note">Could not load cycling curve: '+(e.message||'error')+'</div>';
    }
    return;
  }

  if(sport==='running'){
    box.innerHTML='<div class="curve-loading">Loading run pace curve…'
      +'<div class="curve-progress-bar"><div class="curve-progress-fill" id="curveProg" style="width:0%"></div></div></div>';
    try{
      const runs=allActivities.filter(a=>sportClass(a.type)==='running'&&(a.start_date_local||'').slice(0,10)>=HM2L_RUN_SWIM_START).slice(0,30);
      if(!runs.length){box.innerHTML='<div class="empty-note">No run data available — complete a run synced from intervals.icu</div>';return;}
      const thirtyAgo=new Date();thirtyAgo.setDate(thirtyAgo.getDate()-30);
      const recentRuns=runs.filter(a=>(a.start_date_local||'').slice(0,10)>=toYMD(thirtyAgo));
      const allBest=await buildStreamCurve(runs,'velocity_smooth','curveProg');
      const allPairs=CURVE_DURATIONS.map((s,i)=>allBest[i]!=null?{s,v:allBest[i]}:null).filter(Boolean);
      let recentPairs=null;
      if(recentRuns.length){
        const recentBest=await buildStreamCurve(recentRuns,'velocity_smooth','curveProg','run');
        const rp=CURVE_DURATIONS.map((s,i)=>recentBest[i]!=null?{s,v:recentBest[i]}:null).filter(Boolean);
        if(rp.length)recentPairs=rp;
      }
      if(!allPairs.length){box.innerHTML='<div class="empty-note">No run velocity stream data available — streams may not be cached yet</div>';return;}
      const note='All runs: velocity_smooth streams'+(recentPairs?' | 30 days: '+recentRuns.length+' runs':'');
      drawCurveChart(box,allPairs,recentPairs,true,note);
    }catch(e){
      box.innerHTML='<div class="empty-note">Could not load run pace curve: '+(e.message||'error')+'</div>';
    }
    return;
  }

  if(sport==='swimming'){
    box.innerHTML='<div class="curve-loading">Loading swim pace curve…'
      +'<div class="curve-progress-bar"><div class="curve-progress-fill" id="curveProg" style="width:0%"></div></div></div>';
    try{
      const swims=allActivities.filter(a=>sportClass(a.type)==='swimming'&&(a.start_date_local||'').slice(0,10)>=HM2L_RUN_SWIM_START).slice(0,30);
      if(!swims.length){box.innerHTML='<div class="empty-note">No swim data available — complete a swim synced from intervals.icu</div>';return;}
      const thirtyAgo=new Date();thirtyAgo.setDate(thirtyAgo.getDate()-30);
      const recentSwims=swims.filter(a=>(a.start_date_local||'').slice(0,10)>=toYMD(thirtyAgo));
      const allBest=await buildSwimCurve(swims);
      const allPairs=SWIM_CURVE_DISTANCES.map((d,i)=>allBest[i]!=null?{d,v:allBest[i]}:null).filter(Boolean);
      let recentPairs=null;
      if(recentSwims.length){
        const recentBest=await buildSwimCurve(recentSwims);
        const rp=SWIM_CURVE_DISTANCES.map((d,i)=>recentBest[i]!=null?{d,v:recentBest[i]}:null).filter(Boolean);
        if(rp.length)recentPairs=rp;
      }
      if(!allPairs.length){box.innerHTML='<div class="empty-note">No swim lap data available — swims may not have lap data in intervals.icu</div>';return;}
      const note='All swims: lap-based'+(recentPairs?' | 30 days: '+recentSwims.length+' swims':'');
      drawSwimCurveChart(box,allPairs,recentPairs,note);
    }catch(e){
      box.innerHTML='<div class="empty-note">Could not load swim pace curve: '+(e.message||'error')+'</div>';
    }
    return;
  }
}
