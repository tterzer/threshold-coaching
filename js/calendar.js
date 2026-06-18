// ========== DASHBOARD CALENDAR TAB ==========
var athCalMonth=new Date(); athCalMonth.setDate(1);
var athWorkoutsCache=[];
var athRacesCache=[];
var athViewingWo=null;
var athViewingRace=null;

async function loadAthCal(){
  if(!currentAthlete||!currentAthlete.id)return;
  try{
    const [wr,rr]=await Promise.all([
      fetch('/api/workouts?athlete_id='+encodeURIComponent(currentAthlete.id)).then(r=>r.json()),
      fetch('/api/races?athlete_id='+encodeURIComponent(currentAthlete.id)).then(r=>r.json())
    ]);
    athWorkoutsCache=wr.workouts||[];
    athRacesCache=rr.races||[];
  }catch{
    athWorkoutsCache=[];
    athRacesCache=[];
  }
  renderAthCal();
}

function athCalShift(dir){
  athCalMonth.setMonth(athCalMonth.getMonth()+dir);
  renderAthCal();
}

function athSportClass(sport){
  const s=(sport||'').toLowerCase();
  if(s==='cycling'||s==='bike')return'sport-cycling';
  if(s==='running'||s==='run')return'sport-running';
  if(s==='swimming'||s==='swim')return'sport-swimming';
  if(s==='strength')return'sport-strength';
  return'sport-other';
}

function athEscHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function athIcuTypeToSport(type){
  const t=(type||'').toLowerCase();
  if(t.includes('ride')||t.includes('cycl')||t.includes('virtual'))return'cycling';
  if(t.includes('run')||t.includes('jog')||t.includes('trail')||t.includes('treadmill'))return'running';
  if(t.includes('swim'))return'swimming';
  if(t.includes('weight')||t.includes('strength')||t.includes('gym')||t==='yoga'||t==='workout'||t==='crossfit'||t==='pilates')return'strength';
  return'other';
}

function renderAthCal(){
  const grid=document.getElementById('athCalGrid');
  const headRow=document.getElementById('athCalHeadRow');
  const title=document.getElementById('athCalTitle');
  if(!grid)return;
  title.textContent=athCalMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  if(headRow)headRow.innerHTML=days.map(d=>'<div class="ath-cal-head">'+d+'</div>').join('');
  let html='';

  const firstOfMonth=new Date(athCalMonth);
  const firstDow=(firstOfMonth.getDay()+6)%7;
  const gridStart=new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate()-firstDow);

  const woByDate={};
  athWorkoutsCache.forEach(w=>{ (woByDate[w.date]=woByDate[w.date]||[]).push(w); });
  const raceByDate={};
  athRacesCache.forEach(r=>{ (raceByDate[r.date]=raceByDate[r.date]||[]).push(r); });

  // Build ICU activities by date from allActivities
  const icuByDate={};
  (allActivities||[]).forEach(a=>{
    const key=(a.start_date_local||'').slice(0,10);
    if(!key)return;
    (icuByDate[key]=icuByDate[key]||[]).push(a);
  });
  for(const d of Object.keys(icuByDate)){
    icuByDate[d].sort((a,b)=>new Date(a.start_date_local)-new Date(b.start_date_local));
  }

  const _dim=new Date(athCalMonth.getFullYear(),athCalMonth.getMonth()+1,0).getDate();
  const _cellCount=Math.ceil((firstDow+_dim)/7)*7;
  for(let i=0;i<_cellCount;i++){
    const d=new Date(gridStart);
    d.setDate(gridStart.getDate()+i);
    const key=toYMD(d);
    const otherMonth=d.getMonth()!==athCalMonth.getMonth();
    const wos=woByDate[key]||[];
    const races=raceByDate[key]||[];
    const icuForDay=(icuByDate[key]||[]).slice();

    const racesHtml=races.map(r=>{
      const pri=r.priority||'C';
      const dist=r.distance?(' · '+r.distance):'';
      return '<div class="ath-cal-race priority-'+pri+'" onclick="event.stopPropagation();openAthRaceModal(\''+String(r.id)+'\')" title="'+athEscHtml(r.name)+'">'
        +'&#9873; '+athEscHtml(r.name||'Race')+athEscHtml(dist)+'</div>';
    }).join('');

    // Match planned workouts with ICU activities by sport, build merged sorted list
    const matchedIcuIds=new Set();
    const dayItems=[]; // {html, sortKey} — sortKey is ISO string or '' for untimed planned

    wos.forEach(w=>{
      const spClass='sport-'+(w.sport||'other');
      const woIdStr=String(w.id);
      const matchIdx=icuForDay.findIndex(a=>athIcuTypeToSport(a.type)===(w.sport||'other')&&!matchedIcuIds.has(a.id));
      if(matchIdx!==-1){
        const icu=icuForDay[matchIdx];
        matchedIcuIds.add(icu.id);
        const mins=Math.round((icu.moving_time||0)/60);
        const tss=Math.round(icu.icu_training_load||0);
        const timePrefix=_fmtBlockTime(icu.start_date_local);
        const label=athEscHtml((timePrefix?timePrefix+' · ':'')+(icu.name||'Activity')+(mins?' · '+mins+'min':'')+(tss?' · '+tss+'tss':''));
        const icuIdStr=String(icu.id);
        const badge=w.created_by==='athlete'?'<span class="ath-badge-a">A</span>':'';
        dayItems.push({html:'<div class="ath-cal-block completed '+spClass+'" onclick="event.stopPropagation();openAthBlockModal(\'completed\',\''+woIdStr+'\',\''+icuIdStr+'\')" title="'+label+'"><span class="pill-title">'+label+'</span>'+badge+'</div>',sortKey:icu.start_date_local||''});
      }else{
        const label=athEscHtml(w.title||w.sport||'Workout');
        const badge=w.created_by==='athlete'?'<span class="ath-badge-a">A</span>':'';
        dayItems.push({html:'<div class="ath-cal-block planned '+spClass+'" onclick="event.stopPropagation();openAthBlockModal(\'planned\',\''+woIdStr+'\',null)" title="'+label+'"><span class="pill-title">'+label+'</span>'+badge+'</div>',sortKey:'',createdAt:w.created_at||''});
      }
    });

    // Unmatched ICU activities
    icuForDay.filter(a=>!matchedIcuIds.has(a.id)).forEach(a=>{
      const sp=athIcuTypeToSport(a.type);
      const spClass='sport-'+sp;
      const mins=Math.round((a.moving_time||0)/60);
      const tss=Math.round(a.icu_training_load||0);
      const timePrefix=_fmtBlockTime(a.start_date_local);
      const label=athEscHtml((timePrefix?timePrefix+' · ':'')+(a.name||'Activity')+(mins?' · '+mins+'min':'')+(tss?' · '+tss+'tss':''));
      const icuIdStr=String(a.id);
      dayItems.push({html:'<div class="ath-cal-block completed '+spClass+'" onclick="event.stopPropagation();openAthBlockModal(\'icu_only\',null,\''+icuIdStr+'\')" title="'+label+'"><span class="pill-title">'+label+'</span></div>',sortKey:a.start_date_local||''});
    });

    // Sort: timed items (completed) by start_date_local asc, untimed planned after by created_at asc
    dayItems.sort((a,b)=>{
      const aT=a.sortKey,bT=b.sortKey;
      if(aT&&bT)return aT.localeCompare(bT);
      if(aT)return -1;
      if(bT)return 1;
      return (a.createdAt||'').localeCompare(b.createdAt||'');
    });

    html+='<div class="ath-cal-cell'+(otherMonth?' other-month':'')+'" onclick="openAthDayModal(\''+key+'\')">'
      +'<div class="ath-cal-date">'+d.getDate()+'</div>'
      +racesHtml+dayItems.map(x=>x.html).join('')
      +'</div>';
  }
  grid.innerHTML=html;
}

function openAthWoModal(id){
  openAthBlockModal('planned',id,null);
}

function _athFmtDur(secs){if(!secs)return'—';const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60);return h>0?h+'h '+m+'m':m+'m';}
function _athFmtDist(m){if(!m)return'—';return m>=1000?(m/1000).toFixed(1)+'km':Math.round(m)+'m';}
function _athFmtPace(ms){if(!ms||ms<=0)return'—';const spk=1000/ms;const mn=Math.floor(spk/60),sc=Math.round(spk%60);return mn+':'+(sc<10?'0':'')+sc+'/km';}

function _fmtModalDate(iso){
  if(!iso)return'—';
  const d=new Date(iso);
  const dateStr=d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const timeStr=d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
  return dateStr+' at '+timeStr;
}

function _fmtBlockTime(iso){
  if(!iso)return'';
  const d=new Date(iso);
  return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
}

async function openAthBlockModal(mode, woId, icuId){
  const wo=woId?athWorkoutsCache.find(x=>String(x.id)===String(woId)):null;
  const act=icuId?allActivities.find(x=>String(x.id)===String(icuId)):null;

  function _fmtDur(s){if(!s)return'—';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?h+'h '+m+'m':m+'m';}
  function _fmtDist(m){if(!m)return'—';const mi=m/1609.34;return mi.toFixed(1)+' mi';}

  const sport=act?athIcuTypeToSport(act.type):(wo?wo.sport:'');
  const sportColor=sport==='cycling'?'#378ADD':sport==='running'?'#639922':sport==='swimming'?'#1D9E75':sport==='strength'?'#7F77DD':'#666';
  const actName=act?(act.name||'Activity'):(wo?(wo.title||'Planned Workout'):'Workout');
  const actDate=act?_fmtModalDate(act.start_date_local):(wo?wo.date:'');

  let paceVal='—';
  if(act&&act.average_speed&&act.average_speed>0){
    if(sport==='running'){
      const secPerMile=1609.34/act.average_speed;
      const mm=Math.floor(secPerMile/60),ss=Math.round(secPerMile%60);
      paceVal=mm+':'+(ss<10?'0':'')+ss+'/mi';
    }else{
      paceVal=(act.average_speed*2.23694).toFixed(1)+' mph';
    }
  }

  const metrics=[
    {label:'Duration',val:act?_fmtDur(act.moving_time||act.elapsed_time):(wo&&wo.duration_minutes?wo.duration_minutes+'min':'—')},
    {label:'Distance',val:act?_fmtDist(act.distance):'—'},
    {label:'TSS',val:act&&act.icu_training_load?Math.round(act.icu_training_load):'—'},
    {label:'Avg HR',val:(act&&(act.average_heartrate||act.avg_heart_rate))?Math.round(act.average_heartrate||act.avg_heart_rate)+' bpm':'—'},
    {label:sport==='running'?'Avg Pace':'Avg Speed',val:paceVal},
    {label:'Avg Power',val:(()=>{if(!act)return'—';const pw=act.average_watts||act.weighted_average_watts||act.icu_weighted_avg_watts||act.icu_average_watts;console.log('[power fields]',{average_watts:act.average_watts,weighted_average_watts:act.weighted_average_watts,icu_weighted_avg_watts:act.icu_weighted_avg_watts,icu_average_watts:act.icu_average_watts,max_watts:act.max_watts,device_watts:act.device_watts,used:pw});return pw?Math.round(pw)+' w':'—';})()},
  ];

  let html='<button class="modal-close-x" onclick="closeAthModal()">&times;</button>'
    +'<div class="modal-header">'
      +'<div><span class="modal-title">'+athEscHtml(actName)+'</span>'
        +'<span class="modal-sport-badge" style="background:'+sportColor+'22;color:'+sportColor+';border:1px solid '+sportColor+'44">'+athEscHtml(sport||'activity')+'</span>'
      +'</div>'
      +'<div class="modal-date">'+athEscHtml(actDate)+'</div>'
    +'</div>'
    +'<div class="modal-metrics">'
      +metrics.map(m=>'<div class="modal-metric"><div class="modal-metric-val">'+athEscHtml(String(m.val))+'</div><div class="modal-metric-label">'+m.label+'</div></div>').join('')
    +'</div>';

  if(wo&&act){
    const planDur=wo.duration_minutes?wo.duration_minutes+'min':'—';
    const planTSS=wo.tss_target||'—';
    const actDur=act.moving_time?_fmtDur(act.moving_time):'—';
    const actTSS=act.icu_training_load?Math.round(act.icu_training_load):'—';
    html+='<div class="modal-comparison">'
      +'<div class="modal-comp-col"><div class="modal-comp-col-title">Planned</div>'
        +'<div class="modal-comp-row"><span class="modal-comp-label">Duration</span><span class="modal-comp-val">'+athEscHtml(planDur)+'</span></div>'
        +'<div class="modal-comp-row"><span class="modal-comp-label">TSS</span><span class="modal-comp-val">'+athEscHtml(String(planTSS))+'</span></div>'
      +'</div>'
      +'<div class="modal-comp-col"><div class="modal-comp-col-title">Actual</div>'
        +'<div class="modal-comp-row"><span class="modal-comp-label">Duration</span><span class="modal-comp-val">'+athEscHtml(actDur)+'</span></div>'
        +'<div class="modal-comp-row"><span class="modal-comp-label">TSS</span><span class="modal-comp-val">'+athEscHtml(String(actTSS))+'</span></div>'
      +'</div>'
    +'</div>';
  }

  if(wo){
    const fpType=wo.fuelpro_type?SESSION_TYPES.find(t=>t.id===Number(wo.fuelpro_type)):null;
    const fpName=fpType?fpType.name:'Not set';
    const rawIntensity=wo.intensity||wo.workout_type||'';
    const intensity=rawIntensity?rawIntensity.charAt(0).toUpperCase()+rawIntensity.slice(1):'—';
    html+='<div class="modal-section-label">FuelPro</div>';
    html+='<div class="modal-coach-notes" style="margin-bottom:4px">Type: '+athEscHtml(fpName)+'</div>';
    html+='<div class="modal-coach-notes">Intensity: '+athEscHtml(intensity)+'</div>';
  }
  if(wo&&(wo.description||wo.coach_notes)){
    html+='<div class="modal-section-label">Coach Notes</div><div class="modal-coach-notes">'+athEscHtml(wo.description||wo.coach_notes)+'</div>';
  }

  // "View planned" toggle for matched mode (completed activity + planned workout)
  if(mode==='completed'&&wo&&act){
    html+='<div style="margin-bottom:12px">'
      +'<button onclick="openAthBlockModal(\'planned\',\''+String(wo.id)+'\',null)" '
      +'style="background:none;border:none;color:var(--acc);font-family:\'DM Mono\',monospace;font-size:10px;cursor:pointer;letter-spacing:0.06em;padding:0;text-transform:uppercase">'
      +'View planned workout →</button></div>';
  }

  // "View completed" back-link for planned mode when a matching ICU activity exists
  if(mode==='planned'&&wo){
    const pairedAct=allActivities.find(a=>{
      const key=(a.start_date_local||'').slice(0,10);
      return key===wo.date&&athIcuTypeToSport(a.type)===(wo.sport||'other');
    });
    if(pairedAct){
      html+='<div style="margin-bottom:12px">'
        +'<button onclick="openAthBlockModal(\'completed\',\''+String(wo.id)+'\',\''+String(pairedAct.id)+'\')" '
        +'style="background:none;border:none;color:var(--tc3);font-family:\'DM Mono\',monospace;font-size:10px;cursor:pointer;letter-spacing:0.06em;padding:0;text-transform:uppercase">'
        +'← View completed activity</button></div>';
    }
  }

  // Fetch existing note: from planned workout cache OR coaching_notes table for ICU-only
  let existingNote = wo ? (wo.compliance_note||'') : '';
  if (!wo && act && currentAthlete && currentAthlete.id) {
    const actDate = (act.start_date_local||'').slice(0,10);
    try {
      const nr = await fetch('/api/coaching-notes?athlete_id='+currentAthlete.id+'&date='+actDate);
      if (nr.ok) { const nd = await nr.json(); if (nd.notes && nd.notes[0]) existingNote = nd.notes[0].note || ''; }
    } catch(e) {}
  }
  const _noteActDate = act ? (act.start_date_local||'').slice(0,10) : (wo ? wo.date : '');
  html+='<div class="modal-section-label">How did it go?</div>'
    +'<textarea class="modal-note-input" id="athCompNote" placeholder="Add a note about this session..." data-wo-id="'+(wo?wo.id:'')+'" data-act-date="'+_noteActDate+'">'+athEscHtml(existingNote)+'</textarea>';

  // Footer: delete button only for planned-only workouts
  const deleteBtn=(mode==='planned'&&wo)
    ?'<button class="modal-btn-delete" onclick="deleteAthWorkout(\''+String(wo.id)+'\')">Delete</button>'
    :'';
  const detailBtn=act?'<button class="modal-btn-close" onclick="document.getElementById(\'athWoModal\').style.display=\'none\';openDetailView(\''+String(act.id)+'\',\''+sport+'\')" style="border-color:var(--acc);color:var(--acc)">Detailed view →</button>':'';
  const editBtn=(wo&&wo.created_by==='athlete')?'<button class="modal-btn-close" onclick="closeAthModal();openAthAddWoModal(null,athWorkoutsCache.find(x=>String(x.id)===\''+String(wo.id)+'\'))">Edit</button>':'';
  const woDate=wo?wo.date:(act?(act.start_date_local||'').slice(0,10):'');
  const addSessionBtn=woDate?'<button class="modal-btn-close" onclick="closeAthModal();openAthAddWoModal(\''+woDate+'\')">+ Add Session</button>':'';
  html+='<div class="modal-actions">'
    +'<div style="display:flex;gap:8px">'
      +deleteBtn
      +editBtn
      +'<button class="modal-btn-save" onclick="saveAthNote()">Save note</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
      +addSessionBtn
      +detailBtn
      +'<button class="modal-btn-close" onclick="closeAthModal()">Close</button>'
    +'</div>'
  +'</div>';

  document.getElementById('athWoModalContent').innerHTML=html;
  document.getElementById('athWoModal').classList.add('show');
}

function closeAthModal(){
  document.getElementById('athWoModal').classList.remove('show');
  athViewingWo=null;
}

function openAthDayModal(dateStr){
  const wo=(athWorkoutsCache||[]).find(w=>w.date===dateStr);
  const act=(allActivities||[]).find(a=>(a.start_date_local||'').slice(0,10)===dateStr);
  if(wo&&act){
    openAthBlockModal('completed',String(wo.id),String(act.id));
  } else if(wo){
    openAthBlockModal('planned',String(wo.id),null);
  } else if(act){
    openAthBlockModal('icu_only',null,String(act.id));
  } else {
    openAthAddWoModal(dateStr);
  }
}

let _athEditingWoId=null;

function athWoAutoSuggest(){
  const sel=document.getElementById('athWoFuelpro');
  if(!sel||sel.value!=='')return;
  const sport=document.getElementById('athWoSport').value;
  const intensity=document.getElementById('athWoIntensity').value;
  const dur=Number(document.getElementById('athWoDuration').value)||0;
  let t=42;
  if(/swim/i.test(sport))               t=dur>0&&dur<40?10:11;
  else if(/run/i.test(sport)){
    if(/interval/i.test(intensity))     t=14;
    else if(/tempo/i.test(intensity))   t=30;
    else if(/threshold/i.test(intensity)) t=33;
    else if(dur>=70)                    t=29;
    else                                t=26;
  } else if(/cycl|bike|ride/i.test(sport)){
    if(/threshold|interval/i.test(intensity)) t=19;
    else if(/tempo|sweet/i.test(intensity))   t=18;
    else if(dur>=150)                   t=23;
    else                                t=17;
  } else if(/strength|gym|lift/i.test(sport)) t=8;
  else if(/yoga/i.test(sport))          t=3;
  else if(/mobil|stretch/i.test(sport)) t=4;
  sel.value=String(t);
}

function openAthAddWoModal(dateStr, editWo){
  _athEditingWoId=editWo?editWo.id:null;
  document.getElementById('athAddWoTitle').textContent=editWo?'Edit Session':'Add Session';
  document.getElementById('athWoDate').value=editWo?editWo.date:(dateStr||'');
  document.getElementById('athWoSport').value=editWo?(editWo.sport||'cycling'):'cycling';
  document.getElementById('athWoTitle').value=editWo?(editWo.title||''):'';
  document.getElementById('athWoIntensity').value=editWo?(editWo.intensity||editWo.workout_type||'endurance'):'endurance';
  document.getElementById('athWoFuelpro').value=editWo&&editWo.fuelpro_type!=null?String(editWo.fuelpro_type):'';
  document.getElementById('athWoDuration').value=editWo&&editWo.duration_minutes!=null?editWo.duration_minutes:'';
  document.getElementById('athWoTSS').value=editWo&&editWo.tss_target!=null?editWo.tss_target:'';
  document.getElementById('athWoDesc').value=editWo?(editWo.description||''):'';
  document.getElementById('athWoError').style.display='none';
  document.getElementById('athWoDeleteBtn').style.display=editWo?'block':'none';
  document.getElementById('athAddWoModal').classList.add('show');
}

function closeAthAddWoModal(){
  document.getElementById('athAddWoModal').classList.remove('show');
  _athEditingWoId=null;
}

async function saveAthAddWorkout(){
  if(!currentAthlete?.id)return;
  const errEl=document.getElementById('athWoError');
  errEl.style.display='none';
  const fuelpro_raw=document.getElementById('athWoFuelpro').value;
  const tss_raw=document.getElementById('athWoTSS').value;
  const dur_raw=document.getElementById('athWoDuration').value;
  const payload={
    athlete_id:currentAthlete.id,
    date:document.getElementById('athWoDate').value,
    sport:document.getElementById('athWoSport').value,
    title:document.getElementById('athWoTitle').value.trim(),
    description:document.getElementById('athWoDesc').value.trim(),
    intensity:document.getElementById('athWoIntensity').value||null,
    duration_minutes:dur_raw!==''?Number(dur_raw):null,
    tss_target:tss_raw!==''?Number(tss_raw):null,
    fuelpro_type:fuelpro_raw!==''?Number(fuelpro_raw):null,
    created_by:'athlete',
  };
  if(!payload.date){errEl.textContent='Pick a date.';errEl.style.display='block';return;}
  try{
    let r;
    if(_athEditingWoId){
      r=await fetch('/api/workouts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:_athEditingWoId,...payload})});
    }else{
      r=await fetch('/api/workouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    }
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Could not save session');
    closeAthAddWoModal();
    // Refresh workout cache
    const wr=await fetch('/api/workouts?athlete_id='+currentAthlete.id);
    if(wr.ok){const d=await wr.json();athWorkoutsCache=d.workouts||[];}
    renderAthCalendar();
  }catch(err){
    errEl.textContent=err.message||'Could not save session.';
    errEl.style.display='block';
  }
}

async function deleteAthAddWorkout(){
  if(!_athEditingWoId)return;
  if(!confirm('Delete this session?'))return;
  try{
    const r=await fetch('/api/workouts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:_athEditingWoId})});
    if(!r.ok){const d=await r.json();throw new Error(d.error||'Delete failed');}
    closeAthAddWoModal();
    const wr=await fetch('/api/workouts?athlete_id='+currentAthlete.id);
    if(wr.ok){const d=await wr.json();athWorkoutsCache=d.workouts||[];}
    renderAthCalendar();
  }catch(err){
    alert('Could not delete: '+err.message);
  }
}

async function saveAthNote(){
  const ta = document.getElementById('athCompNote');
  if (!ta) return;
  const note = ta.value.trim();
  const woId = ta.dataset.woId ? Number(ta.dataset.woId) || ta.dataset.woId : null;
  const actDate = ta.dataset.actDate || '';
  const btn = document.querySelector('.modal-btn-save');
  try {
    if (woId) {
      // Has planned workout — save to compliance_note
      const res = await fetch('/api/workouts', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: woId, compliance_note: note })
      });
      if (!res.ok) throw new Error('Save failed');
      const wo = (athWorkoutsCache || []).find(w => String(w.id) === String(woId));
      if (wo) wo.compliance_note = note;
    } else if (actDate && currentAthlete && currentAthlete.id) {
      // ICU-only — save to coaching_notes table
      const res = await fetch('/api/coaching-notes', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ athlete_id: currentAthlete.id, date: actDate, note })
      });
      if (!res.ok) throw new Error('Save failed');
    } else {
      return; // nothing to save
    }
    if (btn) { btn.textContent = 'Saved ✓'; setTimeout(() => btn.textContent = 'Save note', 1500); }
  } catch(e) {
    alert('Could not save note: ' + e.message);
  }
}

function closeAthWoModal(){ closeAthModal(); }

async function deleteAthWorkout(id){
  if(!confirm('Delete this planned workout?'))return;
  try{
    console.log('[deleteAthWorkout] deleting id:', id);
    const res=await fetch('/api/workouts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    if(!res.ok)throw new Error('Delete failed');
    closeAthModal();
    athWorkoutsCache=athWorkoutsCache.filter(w=>w.id!==id);
    renderAthCal();
  }catch(e){
    alert('Could not delete workout: '+e.message);
  }
}


function openAthRaceModal(id){
  const r=athRacesCache.find(x=>String(x.id)===String(id));
  if(!r)return;
  athViewingRace=r;
  document.getElementById('athRaceTitle').textContent=r.name||'Race';
  const priorityLabels={A:'A — Peak race',B:'B — Training stimulus',C:'C — Low priority'};
  const rows=[
    ['Date',r.date||'—'],
    ['Priority',priorityLabels[r.priority]||r.priority||'—'],
    ['Sport',r.sport_type||'—'],
    ['Distance',r.distance||'—'],
    ['Goal time',r.goal_time||'—'],
    ['Notes',r.notes||'—'],
  ];
  document.getElementById('athRaceDetails').innerHTML=rows.map(([l,v])=>
    '<div class="ath-detail-row"><span class="ath-detail-label">'+athEscHtml(l)+'</span><span class="ath-detail-val">'+athEscHtml(v)+'</span></div>'
  ).join('');
  document.getElementById('athRaceModal').classList.add('show');
}

function closeAthRaceModal(){
  document.getElementById('athRaceModal').classList.remove('show');
  athViewingRace=null;
}
