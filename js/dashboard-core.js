// ── Auth guard ──────────────────────────────────────────────────────
(function(){
  const raw = localStorage.getItem('hm2l_athlete');
  if (!raw) { window.location.href = '/login.html'; throw new Error('redirect'); }
  try { window.currentAthlete = JSON.parse(raw); }
  catch(e) { localStorage.removeItem('hm2l_athlete'); window.location.href = '/login.html'; throw new Error('redirect'); }
})();

var pmcInst,sportLoadInst,loadInst,curveInst,lastActs=[],useMetric=false; // default imperial (mi/yd)
var _snapshotRamp=null;
var allActivities=[];
var allTimeActivities=[];
var zoneStreamCache={};
var swimActivityCache={};

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.querySelector('.eye-icon').style.display = isText ? '' : 'none';
  btn.querySelector('.eye-off-icon').style.display = isText ? 'none' : '';
}

function logout(){
  localStorage.removeItem('hm2l_athlete');
  window.location.href='/login.html';
}

function showSetupModal() { document.getElementById('setupModal').style.display='flex'; }

async function saveSetup() {
  const athleteId = document.getElementById('setupAthleteId').value.trim();
  const apiKey = document.getElementById('setupApiKey').value.trim();
  const errEl = document.getElementById('setupError');
  const btn = document.getElementById('setupBtn');
  errEl.style.display='none';
  if (!athleteId || !apiKey) { errEl.textContent='Both fields required'; errEl.style.display='block'; return; }
  btn.disabled=true; btn.textContent='Saving...';
  try {
    const res = await fetch('/api/auth', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update_profile', athlete_id: currentAthlete.id, intervals_athlete_id: athleteId, intervals_api_key: apiKey })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Save failed');
    currentAthlete.intervals_athlete_id = athleteId;
    currentAthlete.intervals_api_key = apiKey;
    localStorage.setItem('hm2l_athlete', JSON.stringify(currentAthlete));
    document.getElementById('setupModal').style.display='none';
    curId = athleteId; curKey = apiKey;
    loadDashboard();
  } catch(e) {
    errEl.textContent = e.message; errEl.style.display='block';
    btn.disabled=false; btn.textContent='Save & connect';
  }
}

function toggleUnits(){
  useMetric=!useMetric;
  document.getElementById('unitToggle').textContent=useMetric?'km / m':'mi / yd';
  buildActs(lastActs);
}

function fmtDist(m,type){
  if(!m)return'—';
  const isSwim=(type||'').toLowerCase().includes('swim');
  if(useMetric){
    return isSwim?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
  }else{
    return isSwim?Math.round(m*1.09361)+' yd':(m/1609.34).toFixed(1)+' mi';
  }
}


window.addEventListener('DOMContentLoaded',()=>{
  window.applyTierGating();
  // Populate athlete header immediately from localStorage (before API data loads)
  if(currentAthlete){
    const name=currentAthlete.name||'Athlete';
    const initials=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatarEl=document.getElementById('avatarEl');
    const nameEl=document.getElementById('nameEl');
    if(avatarEl)avatarEl.textContent=initials;
    if(nameEl)nameEl.textContent=name;
  }
  // Check for intervals.icu credentials
  if(currentAthlete&&currentAthlete.intervals_athlete_id&&currentAthlete.intervals_api_key){
    curId=currentAthlete.intervals_athlete_id;
    curKey=currentAthlete.intervals_api_key;
    loadDashboard();
  }else{
    showSetupModal();
  }
  // Onboarding banner — show if profile is empty and not dismissed
  if(currentAthlete&&!localStorage.getItem('hm2l_onboard_dismissed')){
    fetch('/api/athlete-profile?athlete_id='+encodeURIComponent(currentAthlete.id))
      .then(r=>r.json())
      .then(({profile})=>{
        const p=profile||{};
        const hasData=p.date_of_birth||p.weight_kg||p.height_cm||p.primary_sport||p.bio;
        if(!hasData)document.getElementById('onboardingBanner').style.display='block';
      }).catch(()=>{});
  }
});

var curId='',curKey='';
async function apiCall(athleteId,apiKey,path,qs,base){
  const params=new URLSearchParams({athleteId,apiKey,path});
  if(qs)params.set('qs',qs);
  if(base)params.set('base',base);
  const r=await fetch('/api/intervals?'+params.toString());
  if(!r.ok)throw new Error(r.status);
  return r.json();
}

function fmtTime(s){if(!s)return'—';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?h+'h '+m+'m':m+'m';}
function fmtDate(d){return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'});}

function isRunActivity(type){
  const t=(type||'').toLowerCase();
  return t.includes('run')||t.includes('trail')||t.includes('treadmill')
      ||t.includes('track')||t.includes('road')
      ||t==='race'||t==='walk'; // 'race' exact + walk for safety
}
function sportClass(type){
  const t=(type||'').toLowerCase();
  if(t.includes('ride')||t.includes('cycl')||t.includes('bike'))return'cycling';
  if(isRunActivity(t))return'running';
  if(t.includes('swim'))return'swimming';
  return'other';
}

// Total fetch window: 3 years. First WARMUP_DAYS run the model without
var fitnessSeries=[],fitnessByDate={};

function dayKey(d){const dt=d instanceof Date?d:new Date(d);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}

async function loadDashboard(){
  const id=curId||(currentAthlete&&currentAthlete.intervals_athlete_id);
  const key=curKey||(currentAthlete&&currentAthlete.intervals_api_key);
  if(!id||!key){
    showSetupModal();
    return;
  }
  curId=id;curKey=key;
  try{
    const today=new Date();
    const oldest=new Date(today);oldest.setDate(today.getDate()-90);
    const oldestStr=oldest.toISOString().split('T')[0];
    const fitOldestStr='2026-01-01';
    const allTimeOldest=new Date(today);allTimeOldest.setDate(today.getDate()-548); // 18 months
    const allTimeOldestStr=allTimeOldest.toISOString().split('T')[0];
    const[athlete,activities,fitnessActs,allTimeActs]=await Promise.all([
      apiCall(id,key,'profile'),
      apiCall(id,key,'activities','oldest='+oldestStr+'&fields=id,name,type,start_date_local,distance,moving_time,icu_training_load,icu_atl,icu_ctl,icu_zone_times,average_heartrate,average_speed,average_watts,weighted_average_watts,max_watts,device_watts,icu_weighted_avg_watts,icu_average_watts'),
      apiCall(id,key,'activities','oldest='+fitOldestStr+'&fields=id,start_date_local,icu_training_load,type'),
      apiCall(id,key,'activities','oldest='+allTimeOldestStr+'&fields=id,type,start_date_local')
    ]);
    allTimeActivities=Array.isArray(allTimeActs)?allTimeActs:[];
    document.getElementById('dash').style.display='block';
    const name=(currentAthlete&&currentAthlete.name)||athlete.athlete?.name||athlete.name||'Athlete';
    document.getElementById('avatarEl').textContent=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('nameEl').textContent=name;
    const a2=athlete.athlete||athlete;
    document.getElementById('subEl').textContent=[a2.city,a2.country].filter(Boolean).join(', ')||'intervals.icu athlete';
    const sorted=[...activities].sort((a,b)=>new Date(b.start_date_local)-new Date(a.start_date_local));
    allActivities=sorted;
    window.allActivities=sorted;

    // Compute CTL/ATL/TSB using seed-based Banister model from SEED_DATE.
    const fitSorted=[...fitnessActs].sort((a,b)=>new Date(a.start_date_local)-new Date(b.start_date_local));
    const fit=window.computeFitness(fitSorted);
    fitnessSeries=fit.series;
    fitnessByDate=fit.byDate;
    const todayEntry=fitnessSeries[fitnessSeries.length-1];
    let ctl=0,atl=0,tsb=0;
    if(todayEntry){
      ctl=Math.round(todayEntry.ctl);atl=Math.round(todayEntry.atl);tsb=ctl-atl;
      window.currentCTL=ctl;
      const ctlEl=document.getElementById('mCTL');
      ctlEl.textContent=ctl;ctlEl.style.color='#378ADD';
      const atlEl=document.getElementById('mATL');
      atlEl.textContent=atl;atlEl.style.color='#E24B4A';
      const tsbEl=document.getElementById('mTSB');
      tsbEl.textContent=(tsb>=0?'+':'')+tsb;
      tsbEl.className='metric-val';
      tsbEl.style.color='#c8f036';
      localStorage.setItem('hm2l_snap_ctl',ctl);
      localStorage.setItem('hm2l_snap_atl',atl);
      localStorage.setItem('hm2l_snap_tsb',tsb);
    }
    buildRamp();
    // "This week" = Monday of the current calendar week through today (inclusive).
    const now=new Date();
    const monday=new Date(now);
    const dow=monday.getDay(); // 0=Sun..6=Sat
    const diffToMonday=(dow===0?6:dow-1);
    monday.setDate(monday.getDate()-diffToMonday);
    monday.setHours(0,0,0,0);
    const lastMonday=new Date(monday);lastMonday.setDate(monday.getDate()-7);
    const nowStr=toYMD(now);const mondayStr=toYMD(monday);const lastMondayStr=toYMD(lastMonday);
    const thisWeekLoad=Math.round(sorted.filter(a=>{const ds=(a.start_date_local||'').slice(0,10);return ds>=mondayStr&&ds<=nowStr;}).reduce((s,a)=>s+(a.icu_training_load||0),0));
    const lastWeekLoad=Math.round(sorted.filter(a=>{const ds=(a.start_date_local||'').slice(0,10);return ds>=lastMondayStr&&ds<mondayStr;}).reduce((s,a)=>s+(a.icu_training_load||0),0));
    const weekEl=document.getElementById('mWeek');
    weekEl.textContent=thisWeekLoad;weekEl.style.color='#c8f036';
    const lastWeekEl=document.getElementById('mLastWeek');
    lastWeekEl.textContent=lastWeekLoad;lastWeekEl.style.color='#c8f036';
    localStorage.setItem('hm2l_snap_this_week',thisWeekLoad);
    localStorage.setItem('hm2l_snap_last_week',lastWeekLoad);
    localStorage.setItem('hm2l_snap_pmc_data',JSON.stringify(fitnessSeries));
    buildPMC();
    buildSportCTL();
    upsertAthleteSnapshot(ctl,atl,tsb,thisWeekLoad,lastWeekLoad);
    buildSportLoad(sorted);
    buildLoad(sorted);
    buildZones(sorted);
    buildActs(sorted.slice(0,7));
    initZoneCalc();
    loadZoneDistribution();
    // One-time wipe of stale velocity_smooth entries (old run/swim cache may be corrupt).
    // Runs once per browser; afterwards the cache builds fresh from today forward.
    if(!localStorage.getItem('hm2l_stream_cache_v2')){
      fetch('/api/stream-cache?stream_type=velocity_smooth',{method:'DELETE'})
        .then(()=>localStorage.setItem('hm2l_stream_cache_v2','cleared'))
        .catch(()=>{}); // fire-and-forget; renderCurve proceeds regardless
    }
    renderCurve();
    // Pre-load calendar data in background
    if(currentAthlete&&currentAthlete.id){ loadAthCal(); }
  }catch(e){
    console.error('loadDashboard error:',e);
  }
}

function buildRamp(){
  const today=new Date();
  const wkAgoDate=new Date(today);wkAgoDate.setDate(today.getDate()-7);
  const now=fitnessByDate[dayKey(today)];
  const then=fitnessByDate[dayKey(wkAgoDate)];
  const rampEl=document.getElementById('mRamp');
  const pillEl=document.getElementById('mRampPill');
  if(!now||!then){rampEl.textContent='—';pillEl.textContent='—';pillEl.className='risk-pill';return;}
  const ramp=Math.round(now.ctl-then.ctl);
  _snapshotRamp=ramp;
  rampEl.textContent=(ramp>=0?'+':'')+ramp;
  rampEl.className='metric-val';
  rampEl.style.color='#7F77DD';
  localStorage.setItem('hm2l_snap_ramp',ramp);
  let label='Low risk';
  if(ramp>8)label='High risk';
  else if(ramp>5)label='Moderate';
  pillEl.textContent=label;
  pillEl.className='risk-pill';
  pillEl.style.color='#7F77DD';
  pillEl.style.background='#7F77DD22';
  pillEl.style.border='1px solid #7F77DD44';
}

function upsertAthleteSnapshot(ctl,atl,tsb,thisWeek,lastWeek){
  if(!window.currentAthlete||!window.currentAthlete.id)return;
  // Build 180-day PMC series from fitnessByDate
  const n=180;
  const pmcDays=Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(n-1-i));return d;});
  const pmcCtl=[],pmcAtl=[],pmcTsb=[];
  pmcDays.forEach(d=>{
    const e=fitnessByDate[dayKey(d)];
    if(e){pmcCtl.push(Math.round(e.ctl));pmcAtl.push(Math.round(e.atl));pmcTsb.push(Math.round(e.ctl)-Math.round(e.atl));}
    else{pmcCtl.push(null);pmcAtl.push(null);pmcTsb.push(null);}
  });
  const pmcLabels=pmcDays.map(d=>fmtDate(d));
  // Build 180-day sport CTL from window._fitnessFetchedActs
  const acts=window._fitnessFetchedActs||[];
  const storedOffset=Number(localStorage.getItem(CTL_OFFSET_KEY)||0)||0;
  const sportOffset=storedOffset/3;
  const cycByDate=calcSportCTL(acts,'cycling');
  const runByDate=calcSportCTL(acts,'running');
  const swimByDate=calcSportCTL(acts,'swimming');
  const sportCyc=[],sportRun=[],sportSwim=[];
  pmcDays.forEach(d=>{
    const k=dayKey(d);
    sportCyc.push(cycByDate[k]!=null?Math.round(cycByDate[k]+sportOffset):null);
    sportRun.push(runByDate[k]!=null?Math.round(runByDate[k]+sportOffset):null);
    sportSwim.push(swimByDate[k]!=null?Math.round(swimByDate[k]+sportOffset):null);
  });
  const body={
    athlete_id:window.currentAthlete.id,
    ctl,atl,tsb,
    ramp_rate:_snapshotRamp,
    this_week:thisWeek,
    last_week:lastWeek,
    pmc_data:{labels:pmcLabels,ctl:pmcCtl,atl:pmcAtl,tsb:pmcTsb},
    sport_ctl_data:{labels:pmcLabels,cycling:sportCyc,running:sportRun,swimming:sportSwim},
    updated_at:new Date().toISOString()
  };
  fetch('https://jrgyfokygizsxtupbisg.supabase.co/rest/v1/athlete_snapshots',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'apikey':'sb_publishable_LcoHaks3xpZW4Om8IOT5Ng_6nwMYxbe',
      'Authorization':'Bearer sb_publishable_LcoHaks3xpZW4Om8IOT5Ng_6nwMYxbe',
      'Prefer':'resolution=merge-duplicates'
    },
    body:JSON.stringify(body)
  }).catch(()=>{});
}

// Format a Date as YYYY-MM-DD in local time (avoids UTC-shift from toISOString).
function toYMD(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

// Monday 00:00 of the calendar week containing `d`.
function mondayOf(d){
  const m=new Date(d);
  const dow=m.getDay(); // 0=Sun..6=Sat
  m.setDate(m.getDate()-(dow===0?6:dow-1));
  m.setHours(0,0,0,0);
  return m;
}
// Returns the last `n` calendar weeks (Mon-Sun), oldest first. The most recent
// week runs from its Monday through "now" (it may be a partial week).
function switchDashTab(name){
  document.querySelectorAll('.dash-tab').forEach(t=>t.classList.toggle('active',t.dataset.dtab===name));
  document.querySelectorAll('.dash-panel').forEach(p=>p.classList.toggle('active',p.id==='dtp-'+name));
  if(name==='calendar'&&currentAthlete&&currentAthlete.id) loadAthCal();
  if(name==='profile'&&currentAthlete&&currentAthlete.id) loadAthProfile();
  if(name==='nutrition') loadNutritionTab();
}

// ========== ATHLETE PROFILE TAB ==========
let _athProfileLoaded = false;

async function loadAthProfile(){
  if(!currentAthlete||!currentAthlete.id) return;
  try {
    const r = await fetch('/api/athlete-profile?athlete_id='+encodeURIComponent(currentAthlete.id));
    const d = await r.json();
    if(d.profile) fillProfileForm(d.profile);
  } catch(e){ console.error('loadAthProfile error',e); }
  updateWkg();
}

function fillProfileForm(p){
  // Mirror key fields onto currentAthlete so calcBMR / TDEE can read them anywhere
  if(currentAthlete){
    if(p.age!=null) currentAthlete.age=p.age;
    if(p.height_feet!=null) currentAthlete.height_feet=p.height_feet;
    if(p.height_inches!=null) currentAthlete.height_inches=p.height_inches;
    if(p.experience_level) currentAthlete.experience_level=p.experience_level;
    if(p.weight_lbs!=null) currentAthlete.weight_lbs=p.weight_lbs;
    if(p.ftp_watts!=null) currentAthlete.ftp_watts=p.ftp_watts;
    if(p.activity_level) currentAthlete.activity_level=p.activity_level;
  }
  const set = (id, val) => { const el=document.getElementById(id); if(el&&val!=null) el.value=val; };
  const setChk = (id, val) => { const el=document.getElementById(id); if(el) el.checked=!!val; };
  set('pf_age', p.age);
  set('pf_weight_lbs', p.weight_lbs);
  set('pf_height_feet', p.height_feet);
  set('pf_height_inches', p.height_inches);
  set('pf_experience_level', p.experience_level);
  set('pf_years_training', p.years_training);
  set('pf_available_days_per_week', p.available_days_per_week);
  set('pf_max_weekly_hours', p.max_weekly_hours);
  set('pf_preferred_time', p.preferred_time);
  set('pf_pool_days_per_week', p.pool_days_per_week);
  setChk('pf_has_indoor_trainer', p.has_indoor_trainer);
  setChk('pf_has_track_access', p.has_track_access);
  set('pf_primary_limiter', p.primary_limiter);
  set('pf_secondary_limiter', p.secondary_limiter);
  set('pf_injury_history', p.injury_history);
  set('pf_current_injuries', p.current_injuries);
  set('pf_strengths', p.strengths);
  set('pf_long_term_goals', p.long_term_goals);
  set('pf_current_phase', p.current_phase);
  // rest days checkboxes
  const restDays = Array.isArray(p.rest_days) ? p.rest_days : (p.rest_days ? p.rest_days.split(',') : []);
  document.querySelectorAll('#pf_rest_days input[type=checkbox]').forEach(cb=>{
    cb.checked = restDays.includes(cb.value);
  });
  updateWkg();
}

function updateWkg(){
  const weight = parseFloat(document.getElementById('pf_weight_lbs')?.value);
  const ftp = typeof zs !== 'undefined' ? zs.cycling.ftp : null;
  const wkgEl = document.getElementById('profWkg');
  const wkgVal = document.getElementById('profWkgVal');
  if(weight && ftp && weight > 0){
    const wkg = (ftp / (weight / 2.205)).toFixed(2);
    if(wkgEl) wkgEl.style.display='block';
    if(wkgVal) wkgVal.textContent = wkg;
  } else {
    if(wkgEl) wkgEl.style.display='none';
  }
}

async function saveAthProfile(){
  if(!currentAthlete||!currentAthlete.id) return;
  const get = id => { const el=document.getElementById(id); return el?el.value.trim()||null:null; };
  const getN = id => { const el=document.getElementById(id); const v=parseFloat(el?.value); return isNaN(v)?null:v; };
  const getChk = id => { const el=document.getElementById(id); return el?el.checked:false; };
  const restDays = [...document.querySelectorAll('#pf_rest_days input[type=checkbox]:checked')].map(cb=>cb.value);
  const payload = {
    athlete_id: currentAthlete.id,
    age: getN('pf_age'),
    weight_lbs: getN('pf_weight_lbs'),
    height_feet: getN('pf_height_feet'),
    height_inches: getN('pf_height_inches'),
    experience_level: get('pf_experience_level'),
    years_training: getN('pf_years_training'),
    available_days_per_week: getN('pf_available_days_per_week'),
    max_weekly_hours: getN('pf_max_weekly_hours'),
    preferred_time: get('pf_preferred_time'),
    rest_days: restDays,
    pool_days_per_week: getN('pf_pool_days_per_week'),
    has_indoor_trainer: getChk('pf_has_indoor_trainer'),
    has_track_access: getChk('pf_has_track_access'),
    primary_limiter: get('pf_primary_limiter'),
    secondary_limiter: get('pf_secondary_limiter'),
    injury_history: get('pf_injury_history'),
    current_injuries: get('pf_current_injuries'),
    strengths: get('pf_strengths'),
    long_term_goals: get('pf_long_term_goals'),
    current_phase: get('pf_current_phase'),
  };
  const saveMsg = document.getElementById('profSaveMsg');
  const errMsg = document.getElementById('profErrMsg');
  if(saveMsg) saveMsg.style.display='none';
  if(errMsg) errMsg.style.display='none';
  try {
    const r = await fetch('/api/athlete-profile', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Save failed');
    if(saveMsg){ saveMsg.style.display='inline'; setTimeout(()=>saveMsg.style.display='none',2500); }
    updateWkg();
  } catch(e){
    if(errMsg){ errMsg.textContent=e.message; errMsg.style.display='inline'; }
  }
}

// ── Detail view helpers ──────────────────────────────────────────────
function _fmtDur(secs){if(!secs)return'—';const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60);return h>0?h+'h '+m+'m':m+'m';}
function _fmtDist(m){if(!m)return'—';const mi=m/1609.34;return mi.toFixed(1)+' mi';}
function _fmtPaceOrSpeed(ms, sport) {
  if (!ms || ms <= 0) return '—';
  if (sport === 'running') {
    const secPerMile = 1609.34 / ms;
    const mm = Math.floor(secPerMile/60), ss = Math.round(secPerMile%60);
    return mm+':'+(ss<10?'0':'')+ss+'/mi';
  }
  return (ms * 2.23694).toFixed(1)+' mph';
}

let _detailChart = null;
let _detailStreams = {};
let _detailAct = null;
let _detailSport = null;
let _detailVisible = {};

function openDetailView(actId, sport) {
  const overlay = document.getElementById('detailOverlay');
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';

  const act = (allActivities || []).find(a => String(a.id) === String(actId));
  _detailAct = act;
  _detailSport = sport || 'cycling';

  if (!act) return;

  document.getElementById('detailActivityName').textContent = act.name || 'Activity';
  document.getElementById('detailActivityDate').textContent = _fmtModalDate ? _fmtModalDate(act.start_date_local) : act.start_date_local;

  const metricsEl = document.getElementById('detailMetricsStrip');
  const metrics = [
    { label:'Duration', val: _fmtDur(act.moving_time || act.elapsed_time) },
    { label:'Distance', val: _fmtDist(act.distance) },
    { label:'TSS',      val: act.icu_training_load ? Math.round(act.icu_training_load) : '—' },
    { label:'Avg HR',   val: (act.average_heartrate || act.avg_heart_rate) ? Math.round(act.average_heartrate || act.avg_heart_rate) + ' bpm' : '—' },
    { label: sport==='running'?'Avg Pace':'Avg Speed', val: _fmtPaceOrSpeed(act.average_speed, sport) },
    { label:'Avg Power', val: (()=>{ const pw=act.average_watts||act.weighted_average_watts||act.icu_weighted_avg_watts||act.icu_average_watts; return pw?Math.round(pw)+'w':'—'; })() },
  ];
  metricsEl.innerHTML = metrics.map(m => `<div class="detail-metric"><div class="detail-metric-val">${m.val}</div><div class="detail-metric-label">${m.label}</div></div>`).join('');

  if (_detailChart) { _detailChart.destroy(); _detailChart = null; }

  _setupDetailStreams(actId, sport, act);
}

function closeDetailView() {
  document.getElementById('detailOverlay').style.display = 'none';
  document.body.style.overflow = '';
  if (_detailChart) { _detailChart.destroy(); _detailChart = null; }
  // Restore summary modal if it was hidden (not closed) when opening detail view
  const modal = document.getElementById('athWoModal');
  if (modal && modal.style.display === 'none') {
    modal.style.display = '';
  }
}

async function _setupDetailStreams(actId, sport, act) {
  const streamDefs = {
    cycling: ['watts','heartrate','velocity_smooth','cadence','altitude'],
    running: ['velocity_smooth','heartrate','cadence','altitude'],
    swimming: ['velocity_smooth','heartrate'],
    strength: ['heartrate'],
    other: ['heartrate'],
  };
  const streams = streamDefs[sport] || streamDefs.other;

  const streamColors = {
    watts: '#888', heartrate: '#E24B4A', velocity_smooth: sport==='running'?'#639922':'#378ADD',
    cadence: '#7F77DD', altitude: sport==='running'?'#555':'#639922',
  };
  const streamLabels = {
    watts: 'Power', heartrate: 'HR', velocity_smooth: sport==='running'?'Pace':'Speed',
    cadence: 'Cadence', altitude: 'Elevation',
  };

  _detailVisible = Object.fromEntries(streams.map(s => [s, true]));

  const togglesEl = document.getElementById('detailToggles');
  togglesEl.innerHTML = streams.map(s =>
    `<button class="stream-toggle active" id="dtoggle_${s}" onclick="_toggleDetailStream('${s}')" style="border-color:${streamColors[s]};color:${streamColors[s]}">${streamLabels[s]||s}</button>`
  ).join('');

  const chartContainer = document.getElementById('detailChart').parentElement;
  chartContainer.style.opacity = '0.4';

  _detailStreams = {};

  // Fetch laps first
  if (!act.laps && curId && curKey) {
    try {
      const lapData = await apiCall(curId, curKey, actId, null, 'activity');
      act.laps = (lapData && lapData.laps) || [];
    } catch(e) {}
  }
  _renderLaps(act, sport);

  await Promise.all(streams.map(async (streamType) => {
    // Check Supabase cache first
    try {
      const cacheRes = await fetch(`/api/stream-cache?activity_id=${actId}&stream_type=${streamType}`);
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        if (cacheData && cacheData.cached && Array.isArray(cacheData.data) && cacheData.data.length > 0) {
          _detailStreams[streamType] = cacheData.data;
          return;
        }
      }
    } catch(e) {}

    // Fetch from intervals.icu via apiCall proxy
    try {
      const data = await apiCall(curId, curKey, actId+'/streams', 'types='+streamType, 'activity');
      let arr = null;
      if (Array.isArray(data)) {
        const match = data.find(d => d.type === streamType) || data[0];
        arr = match ? (match.data || match) : null;
      } else if (data && data[streamType]) {
        arr = data[streamType].data || data[streamType];
      } else if (data && data.data) {
        arr = data.data;
      }
      arr = Array.isArray(arr) ? arr : [];
      if (arr.length) {
        _detailStreams[streamType] = arr;
        fetch('/api/stream-cache', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ activity_id: String(actId), stream_type: streamType, data: arr })
        }).catch(()=>{});
      }
    } catch(e) { console.warn('Stream fetch failed', streamType, e); }
  }));

  chartContainer.style.opacity = '1';
  _renderDetailChart(sport);
}

function _renderDetailChart(sport) {
  if (_detailChart) { _detailChart.destroy(); _detailChart = null; }

  const canvas = document.getElementById('detailChart');
  const ctx = canvas.getContext('2d');

  const streamArrays = Object.values(_detailStreams).filter(a => a && a.length);
  if (streamArrays.length === 0) {
    ctx.fillStyle='#555'; ctx.font='12px monospace';
    ctx.fillText('No stream data available', 20, 150);
    return;
  }
  const maxLen = Math.max(...streamArrays.map(a => a.length));

  const datasets = [];

  if (sport === 'cycling') {
    if (_detailStreams.watts && _detailVisible.watts) {
      datasets.push({ label:'Power (w)', data:_detailStreams.watts.slice(0,maxLen), borderColor:'#666', backgroundColor:'rgba(100,100,100,0.15)', fill:true, tension:0.1, pointRadius:0, borderWidth:1.5, yAxisID:'yLeft', order:3 });
    }
    if (_detailStreams.altitude && _detailVisible.altitude) {
      datasets.push({ label:'Elevation (ft)', data:_detailStreams.altitude.slice(0,maxLen).map(v=>v*3.28084), borderColor:'rgba(100,160,100,0.5)', backgroundColor:'rgba(100,160,100,0.08)', fill:true, tension:0.3, pointRadius:0, borderWidth:1, yAxisID:'yEle', order:4 });
    }
    if (_detailStreams.heartrate && _detailVisible.heartrate) {
      datasets.push({ label:'HR (bpm)', data:_detailStreams.heartrate.slice(0,maxLen), borderColor:'#E24B4A', backgroundColor:'transparent', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yRight', order:2 });
    }
    if (_detailStreams.velocity_smooth && _detailVisible.velocity_smooth) {
      datasets.push({ label:'Speed (mph)', data:_detailStreams.velocity_smooth.slice(0,maxLen).map(v=>v*2.23694), borderColor:'#378ADD', backgroundColor:'transparent', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yRight', order:1 });
    }
    if (_detailStreams.cadence && _detailVisible.cadence) {
      datasets.push({ label:'Cadence (rpm)', data:_detailStreams.cadence.slice(0,maxLen), borderColor:'#7F77DD', backgroundColor:'transparent', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yRight', order:0 });
    }
  } else if (sport === 'running') {
    if (_detailStreams.altitude && _detailVisible.altitude) {
      datasets.push({ label:'Elevation (ft)', data:_detailStreams.altitude.slice(0,maxLen).map(v=>v*3.28084), borderColor:'rgba(100,100,100,0.5)', backgroundColor:'rgba(100,100,100,0.08)', fill:true, tension:0.3, pointRadius:0, borderWidth:1, yAxisID:'yEle', order:4 });
    }
    if (_detailStreams.velocity_smooth && _detailVisible.velocity_smooth) {
      datasets.push({ label:'Pace (min/mi)', data:_detailStreams.velocity_smooth.slice(0,maxLen).map(v=>v>0.1?1609.34/v:null), borderColor:'#639922', backgroundColor:'transparent', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yLeft', order:3 });
    }
    if (_detailStreams.heartrate && _detailVisible.heartrate) {
      datasets.push({ label:'HR (bpm)', data:_detailStreams.heartrate.slice(0,maxLen), borderColor:'#E24B4A', backgroundColor:'transparent', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yRight', order:2 });
    }
    if (_detailStreams.cadence && _detailVisible.cadence) {
      datasets.push({ label:'Cadence (spm)', data:_detailStreams.cadence.slice(0,maxLen), borderColor:'#7F77DD', backgroundColor:'transparent', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yRight', order:1 });
    }
  } else {
    if (_detailStreams.velocity_smooth && _detailVisible.velocity_smooth) {
      datasets.push({ label:'Pace', data:_detailStreams.velocity_smooth.slice(0,maxLen).map(v=>v>0.01?91.44/v:null), borderColor:'#1D9E75', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yLeft', order:2 });
    }
    if (_detailStreams.heartrate && _detailVisible.heartrate) {
      datasets.push({ label:'HR (bpm)', data:_detailStreams.heartrate.slice(0,maxLen), borderColor:'#E24B4A', fill:false, tension:0.2, pointRadius:0, borderWidth:1.5, yAxisID:'yRight', order:1 });
    }
  }

  const scales = {
    x: { type:'category', labels:Array.from({length:maxLen}, (_,i)=> i%300===0 ? (()=>{const h=Math.floor(i/3600),m=Math.floor((i%3600)/60);return h>0?h+'h'+String(m).padStart(2,'0'):m+'m';})() : ''), ticks:{color:'#666',font:{family:"'DM Mono'",size:9},maxRotation:0,autoSkip:true,maxTicksLimit:12}, grid:{color:'rgba(42,42,42,0.5)'} },
    yLeft: { type:'linear', position:'left', reverse:sport==='running', ticks:{ color:'#555', font:{family:"'DM Mono'",size:9}, callback: sport==='running' ? (v)=>{const mm=Math.floor(v/60),ss=Math.round(v%60);return mm+':'+(ss<10?'0':'')+ss;} : undefined }, grid:{color:'rgba(42,42,42,0.5)'} },
    yRight: { type:'linear', position:'right', ticks:{color:'#666',font:{family:"'DM Mono'",size:9}}, grid:{display:false} },
    yEle: { type:'linear', position:'right', display:false },
  };

  _detailChart = new Chart(ctx, {
    type: 'line',
    data: { labels: Array.from({length: maxLen}), datasets },
    options: {
      animation: false,
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false}, tooltip:{mode:'index',intersect:false,backgroundColor:'#1a1a1a',titleColor:'#888',bodyColor:'#ccc',borderColor:'#2a2a2a',borderWidth:1} },
      scales,
      elements: { line:{capBezierPoints:false} },
    }
  });
}

function _toggleDetailStream(stream) {
  _detailVisible[stream] = !_detailVisible[stream];
  const btn = document.getElementById('dtoggle_' + stream);
  if (btn) btn.classList.toggle('active', _detailVisible[stream]);
  _renderDetailChart(_detailSport);
}

function _renderLaps(act, sport) {
  const lapsEl = document.getElementById('detailLapsSection');
  const laps = act.laps;
  if (!laps || !laps.length) { lapsEl.style.display = 'none'; return; }
  lapsEl.style.display = 'block';

  let headers, rows;
  if (sport === 'cycling') {
    headers = ['Lap','Duration','Distance','Avg Power','NP','Avg HR','Avg Speed','Cadence','TSS'];
    rows = laps.map((lap,i) => [
      i+1, _fmtDur(lap.moving_time||lap.elapsed_time),
      lap.distance?(lap.distance/1609.34).toFixed(2)+' mi':'—',
      lap.average_watts?Math.round(lap.average_watts)+'w':'—',
      lap.normalized_power?Math.round(lap.normalized_power)+'w':'—',
      lap.average_heartrate?Math.round(lap.average_heartrate)+' bpm':'—',
      lap.average_speed?(lap.average_speed*2.23694).toFixed(1)+' mph':'—',
      lap.average_cadence?Math.round(lap.average_cadence):'—',
      lap.training_stress_score?Math.round(lap.training_stress_score):'—',
    ]);
  } else if (sport === 'running') {
    headers = ['Lap','Duration','Distance','Avg Pace','Avg HR','Cadence','Elev Gain'];
    rows = laps.map((lap,i) => {
      let pace='—';
      if(lap.average_speed&&lap.average_speed>0){const spmi=1609.34/lap.average_speed,mm=Math.floor(spmi/60),ss=Math.round(spmi%60);pace=mm+':'+(ss<10?'0':'')+ss+'/mi';}
      return [i+1,_fmtDur(lap.moving_time||lap.elapsed_time),lap.distance?(lap.distance/1609.34).toFixed(2)+' mi':'—',pace,lap.average_heartrate?Math.round(lap.average_heartrate)+' bpm':'—',lap.average_cadence?Math.round(lap.average_cadence*2):'—',lap.total_elevation_gain?Math.round(lap.total_elevation_gain*3.28084)+"'":"—"];
    });
  } else {
    headers = ['Lap','Duration','Distance','Avg Pace','Avg HR'];
    rows = laps.map((lap,i) => [
      i+1, _fmtDur(lap.moving_time||lap.elapsed_time),
      lap.distance?Math.round(lap.distance*1.09361)+' yd':'—',
      lap.average_speed&&lap.average_speed>0.01?(()=>{const spyd=91.44/lap.average_speed,mm=Math.floor(spyd/60),ss=Math.round(spyd%60);return mm+':'+(ss<10?'0':'')+ss+'/100yd';})():'—',
      lap.average_heartrate?Math.round(lap.average_heartrate)+' bpm':'—',
    ]);
  }

  document.getElementById('detailLapsTable').innerHTML = `<table class="laps-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// Also load calendar data when loadDashboard completes — hook into end of the function
const _origLoadDashboard=typeof loadDashboard!=='undefined'?loadDashboard:null;

// Update snapshot metrics, PMC and ramp chart from current fitnessSeries.
function _applyFitnessToUI(){
  const todayEntry=fitnessSeries[fitnessSeries.length-1];
  if(todayEntry){
    const ctlEl2=document.getElementById('mCTL');
    ctlEl2.textContent=Math.round(todayEntry.ctl);ctlEl2.style.color='#378ADD';
    const atlEl2=document.getElementById('mATL');
    atlEl2.textContent=Math.round(todayEntry.atl);atlEl2.style.color='#E24B4A';
    const tsb=Math.round(todayEntry.ctl-todayEntry.atl);
    const tsbEl=document.getElementById('mTSB');
    tsbEl.textContent=(tsb>=0?'+':'')+tsb;
    tsbEl.className='metric-val';
    tsbEl.style.color='#c8f036';
  }
  buildPMC();
  buildRamp();
}