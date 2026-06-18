// ═══════════════════════════════════════════════════════════════════
// FUELPRO — CARB CYCLING ALGORITHM
// ═══════════════════════════════════════════════════════════════════
const SESSION_TYPES = [
  { id:1,  name:'Rest Day',                        tssPerHour:0,   glycogenCoeff:0,    kcalPerMin:1.2,  intraCarbs:0,  quality:false },
  { id:2,  name:'Active Recovery',                 tssPerHour:15,  glycogenCoeff:0.20, kcalPerMin:3,    intraCarbs:0,  quality:false },
  { id:3,  name:'Yoga',                            tssPerHour:20,  glycogenCoeff:0.10, kcalPerMin:2.5,  intraCarbs:0,  quality:false },
  { id:4,  name:'Mobility / Stretching',           tssPerHour:10,  glycogenCoeff:0.05, kcalPerMin:2,    intraCarbs:0,  quality:false },
  { id:5,  name:'Foam Roll / Recovery Work',       tssPerHour:5,   glycogenCoeff:0.05, kcalPerMin:1.5,  intraCarbs:0,  quality:false },
  { id:6,  name:'Strength — Upper Body',           tssPerHour:35,  glycogenCoeff:0.30, kcalPerMin:6,    intraCarbs:0,  quality:false },
  { id:7,  name:'Strength — Lower Body',           tssPerHour:45,  glycogenCoeff:0.40, kcalPerMin:7,    intraCarbs:0,  quality:false },
  { id:8,  name:'Strength — Full Body / Dynamic',  tssPerHour:50,  glycogenCoeff:0.45, kcalPerMin:7.5,  intraCarbs:0,  quality:false },
  { id:9,  name:'Strength — Core',                 tssPerHour:30,  glycogenCoeff:0.25, kcalPerMin:5,    intraCarbs:0,  quality:false },
  { id:10, name:'Easy / Technique Swim',           tssPerHour:30,  glycogenCoeff:0.35, kcalPerMin:8,    intraCarbs:0,  quality:false },
  { id:11, name:'Aerobic Endurance Swim',          tssPerHour:50,  glycogenCoeff:0.55, kcalPerMin:10,   intraCarbs:0,  quality:false },
  { id:12, name:'Threshold / CSS Swim',            tssPerHour:70,  glycogenCoeff:0.70, kcalPerMin:12,   intraCarbs:20, quality:true  },
  { id:13, name:'VO2 / Speed Swim',                tssPerHour:80,  glycogenCoeff:0.80, kcalPerMin:13,   intraCarbs:20, quality:true  },
  { id:14, name:'Open Water Swim',                 tssPerHour:55,  glycogenCoeff:0.60, kcalPerMin:10,   intraCarbs:0,  quality:false },
  { id:15, name:'Race Simulation Swim',            tssPerHour:75,  glycogenCoeff:0.75, kcalPerMin:12,   intraCarbs:20, quality:true  },
  { id:16, name:'Recovery Ride',                   tssPerHour:25,  glycogenCoeff:0.25, kcalPerMin:5,    intraCarbs:0,  quality:false },
  { id:17, name:'Aerobic Base / Z2 Ride',          tssPerHour:55,  glycogenCoeff:0.55, kcalPerMin:8,    intraCarbs:40, quality:false },
  { id:18, name:'Tempo / Sweet Spot Ride',         tssPerHour:75,  glycogenCoeff:0.70, kcalPerMin:10,   intraCarbs:60, quality:true  },
  { id:19, name:'Threshold / FTP Intervals',       tssPerHour:90,  glycogenCoeff:0.85, kcalPerMin:12,   intraCarbs:80, quality:true  },
  { id:20, name:'VO2max Intervals',                tssPerHour:100, glycogenCoeff:0.90, kcalPerMin:13,   intraCarbs:80, quality:true  },
  { id:21, name:'Neuromuscular / Cadence Drills',  tssPerHour:45,  glycogenCoeff:0.40, kcalPerMin:7,    intraCarbs:20, quality:false },
  { id:22, name:'Sprint / Power Work',             tssPerHour:80,  glycogenCoeff:0.70, kcalPerMin:11,   intraCarbs:40, quality:true  },
  { id:23, name:'Long Endurance Ride',             tssPerHour:60,  glycogenCoeff:0.65, kcalPerMin:9,    intraCarbs:60, quality:false },
  { id:24, name:'Race Simulation Ride',            tssPerHour:85,  glycogenCoeff:0.80, kcalPerMin:11,   intraCarbs:90, quality:true  },
  { id:25, name:'Recovery Run',                    tssPerHour:30,  glycogenCoeff:0.30, kcalPerMin:7,    intraCarbs:0,  quality:false },
  { id:26, name:'Easy Base Run',                   tssPerHour:45,  glycogenCoeff:0.45, kcalPerMin:9,    intraCarbs:0,  quality:false },
  { id:27, name:'Easy Base Run — Short Brick',     tssPerHour:40,  glycogenCoeff:0.40, kcalPerMin:9,    intraCarbs:0,  quality:false },
  { id:28, name:'Easy Base Run — Long Brick',      tssPerHour:50,  glycogenCoeff:0.50, kcalPerMin:9,    intraCarbs:20, quality:false },
  { id:29, name:'Long Easy Run',                   tssPerHour:55,  glycogenCoeff:0.60, kcalPerMin:9,    intraCarbs:40, quality:false },
  { id:30, name:'Tempo Run',                       tssPerHour:75,  glycogenCoeff:0.75, kcalPerMin:12,   intraCarbs:40, quality:true  },
  { id:31, name:'Tempo Run — Short Brick',         tssPerHour:70,  glycogenCoeff:0.70, kcalPerMin:12,   intraCarbs:20, quality:true  },
  { id:32, name:'Tempo Run — Long Brick',          tssPerHour:80,  glycogenCoeff:0.80, kcalPerMin:12,   intraCarbs:40, quality:true  },
  { id:33, name:'Threshold / Track Intervals',     tssPerHour:90,  glycogenCoeff:0.85, kcalPerMin:13,   intraCarbs:60, quality:true  },
  { id:34, name:'VO2max / Speed Work',             tssPerHour:100, glycogenCoeff:0.90, kcalPerMin:14,   intraCarbs:60, quality:true  },
  { id:35, name:'Hill Repeats',                    tssPerHour:85,  glycogenCoeff:0.80, kcalPerMin:13,   intraCarbs:40, quality:true  },
  { id:36, name:'Race Simulation Run',             tssPerHour:90,  glycogenCoeff:0.85, kcalPerMin:13,   intraCarbs:60, quality:true  },
  { id:37, name:'Triathlon Race — Sprint',         tssPerHour:85,  glycogenCoeff:0.85, kcalPerMin:13,   intraCarbs:60, quality:true  },
  { id:38, name:'Triathlon Race — Olympic',        tssPerHour:90,  glycogenCoeff:0.90, kcalPerMin:13,   intraCarbs:70, quality:true  },
  { id:39, name:'Triathlon Race — 70.3',           tssPerHour:95,  glycogenCoeff:0.95, kcalPerMin:13,   intraCarbs:90, quality:true  },
  { id:40, name:'Triathlon Race — Full IM',        tssPerHour:100, glycogenCoeff:1.00, kcalPerMin:13,   intraCarbs:90, quality:true  },
  { id:41, name:'Hockey',                          tssPerHour:75,  glycogenCoeff:0.75, kcalPerMin:12,   intraCarbs:30, quality:true  },
  { id:42, name:'Other Aerobic',                   tssPerHour:50,  glycogenCoeff:0.50, kcalPerMin:8,    intraCarbs:20, quality:false },
];
const NUTR_SESSION_TYPES=Object.fromEntries(SESSION_TYPES.map(t=>[t.id,t]));

// ── TDEE CALCULATION ─────────────────────────────────────────────
const NEAT_LEVELS={
  'desk':0.20,'light':0.30,'active':0.40,'manual':0.60
};
function calcDayTargets(dateStr,profile,plannedWorkouts,completedActivities){
  const today=new Date();
  const todayStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  const isPast=dateStr<todayStr;
  const isToday=dateStr===todayStr;
  const isFuture=dateStr>todayStr;

  const weight_lbs=parseFloat(profile.weight_lbs)||165;
  const weight_kg=weight_lbs*0.453592;
  const height_ft=parseFloat(profile.height_feet)||5;
  const height_in=parseFloat(profile.height_inches)||10;
  const height_cm=((height_ft*12)+height_in)*2.54;
  const age=parseFloat(profile.age)||35;
  const experience=profile.experience_level||'intermediate';
  const activityLevel=profile.activity_level||'light';
  const mode=parseInt(profile.mode)||0;
  const weeklyLoss=parseFloat(profile.weekly_loss_target)||0.5;
  const goalWeight=parseFloat(profile.goal_weight_lbs)||weight_lbs;

  const bmrRaw=(10*weight_kg)+(6.25*height_cm)-(5*age)+5;
  const expMultiplier={beginner:1.02,intermediate:1.05,advanced:1.08,elite:1.10}[experience]||1.05;
  const ctl=parseFloat(window.currentCTL)||0;
  const ctlMultiplier=ctl>80?1.03:ctl>60?1.02:1.0;
  const bmr=Math.round(bmrRaw*expMultiplier*ctlMultiplier);

  const neatMultiplier={sedentary:0.20,light:0.30,active:0.40,manual:0.60}[activityLevel]||0.30;
  const neat=Math.round(bmr*neatMultiplier);

  let exerciseKcal=0;
  let totalTSS=0;

  if(isPast||isToday){
    const dayActivities=(completedActivities||[]).filter(a=>(a.start_date_local||'').slice(0,10)===dateStr);
    dayActivities.forEach(a=>{
      const mins=(a.moving_time||0)/60;
      const type=(a.type||'').toLowerCase();
      if(type.includes('ride')||type.includes('virtual')){
        const kj=parseFloat(a.work)||0;
        exerciseKcal+=kj>0?Math.round(kj/0.238):Math.round(mins*10);
      }else if(type.includes('run')){
        const dist_km=(a.distance||0)/1000;
        exerciseKcal+=Math.round(weight_kg*dist_km*1.04);
      }else if(type.includes('swim')){
        exerciseKcal+=Math.round(7*weight_kg*(mins/60));
      }else{
        exerciseKcal+=Math.round(5*weight_kg*(mins/60));
      }
      totalTSS+=parseFloat(a.icu_training_load)||0;
    });
  }else{
    const dayPlanned=(plannedWorkouts||[]).filter(w=>w.date===dateStr);
    dayPlanned.forEach(w=>{
      const mins=parseFloat(w.duration_minutes)||0;
      const sport=(w.sport||'').toLowerCase();
      if(sport.includes('bike')||sport.includes('cycl')||sport.includes('ride')){
        exerciseKcal+=Math.round(mins*10);
        totalTSS+=Math.round(mins*0.8);
      }else if(sport.includes('run')){
        exerciseKcal+=Math.round(weight_kg*(mins/60)*10);
        totalTSS+=Math.round(mins*0.7);
      }else if(sport.includes('swim')){
        exerciseKcal+=Math.round(7*weight_kg*(mins/60));
        totalTSS+=Math.round(mins*0.5);
      }else{
        exerciseKcal+=Math.round(5*weight_kg*(mins/60));
        totalTSS+=Math.round(mins*0.3);
      }
    });
  }

  const tdee=bmr+neat+exerciseKcal;

  let tdeeAdjusted=tdee;
  if(mode===1&&weight_lbs>goalWeight){
    tdeeAdjusted=tdee-Math.round(weeklyLoss*500);
  }else if(mode===2){
    tdeeAdjusted=tdee+300;
  }
  tdeeAdjusted=Math.max(tdeeAdjusted,1200);

  const protein=Math.round(weight_lbs*1.09);

  const fatFloor=85,fatCeiling=110;
  const tssNorm=Math.min(totalTSS/200,1);
  const fat=Math.round(fatCeiling-(tssNorm*(fatCeiling-fatFloor)));

  const carbs=Math.max(0,Math.round((tdeeAdjusted-protein*4-fat*9)/4));
  const kcal=Math.round(carbs*4+protein*4+fat*9);

  const source=isFuture?'predicted':isToday?'live':'actual';

  let intentLabel;
  if(mode===2){
    intentLabel={label:'BUILD',cls:'nutr-intent-green'};
  }else if(totalTSS>150||exerciseKcal>700){
    intentLabel={label:'FUEL UP',cls:'nutr-intent-yellow'};
  }else if(mode===1&&totalTSS<80&&exerciseKcal<400){
    intentLabel={label:'CUT DAY',cls:'nutr-intent-blue'};
  }else{
    intentLabel={label:'MAINTAIN',cls:'nutr-intent-green'};
  }

  return{carbs,protein,fat,kcal,tdee,tdeeAdjusted,bmr,neat,exercise:exerciseKcal,tss:totalTSS,source,
    intent:intentLabel,
    // legacy fields used by fuelling window and save logic
    tdeeTarget:tdeeAdjusted,intra:0,pre:0,post:Math.round(weight_kg*1.2),foodCarbs:carbs,
  };
}
function nutrCalcIntra(typeNum,durationMins){
  if(!typeNum||!durationMins) return 0;
  const t=NUTR_SESSION_TYPES[Number(typeNum)];
  if(!t||!t.intraCarbs) return 0;
  return Math.round(t.intraCarbs*durationMins/60);
}
function nutrCalcPre(typeNum,dailyCarbs){
  const t=NUTR_SESSION_TYPES[Number(typeNum)];
  return t?.quality?Math.round(dailyCarbs*0.20):0;
}
function nutrCalcWindows(sessions,targets,foodEntries){
  const active=(sessions||[]).filter(s=>s.typeNum&&s.startTime);
  if(!active.length) return null;
  const WAKE=6,SLEEP=22,TOTAL=16;
  const toHr=t=>{const[h,m]=t.split(':').map(Number);return h+m/60;};
  active.forEach(s=>{
    if(s.startTime&&s.durationMins&&!s.endTime){
      const[h,m]=s.startTime.split(':').map(Number);
      const tot=h*60+m+Number(s.durationMins);
      s.endTime=String(Math.floor(tot/60)%24).padStart(2,'0')+':'+String(tot%60).padStart(2,'0');
    }
  });
  const sorted=[...active].sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const totalIntra=sorted.reduce((s,x)=>s+nutrCalcIntra(x.typeNum,x.durationMins),0);
  const avail=Math.max(0,targets.carbs-totalIntra);
  const windows=[];
  const firstStart=toHr(sorted[0].startTime);
  const preHrs=Math.max(0,firstStart-WAKE);
  const preFrac=preHrs/TOTAL;
  const preCarbs=Math.max(targets.pre,Math.round(avail*preFrac));
  windows.push({id:'pre_0',label:'Before '+( NUTR_SESSION_TYPES[sorted[0].typeNum]?.name||'Session'),
    type:'before',timeLabel:'Wake → '+sorted[0].startTime,
    carbTarget:preCarbs,proteinTarget:Math.round(targets.protein*preFrac),fatTarget:Math.round(targets.fat*preFrac),
    carbEaten:0,proteinEaten:0,fatEaten:0});
  let allocC=preCarbs,allocP=Math.round(targets.protein*preFrac),allocF=Math.round(targets.fat*preFrac);
  sorted.forEach((s,i)=>{
    windows.push({id:'intra_'+i,label:'During: '+(NUTR_SESSION_TYPES[s.typeNum]?.name||'Session'),
      type:'intra',timeLabel:s.startTime+' → '+s.endTime,
      carbTarget:nutrCalcIntra(s.typeNum,s.durationMins),proteinTarget:0,fatTarget:0,
      carbEaten:0,proteinEaten:0,fatEaten:0});
    if(i<sorted.length-1){
      const gapHrs=Math.max(0,toHr(sorted[i+1].startTime)-toHr(s.endTime));
      const gf=gapHrs/TOTAL;
      const gc=Math.round(avail*gf);
      allocC+=gc;allocP+=Math.round(targets.protein*gf);allocF+=Math.round(targets.fat*gf);
      windows.push({id:'between_'+i,label:'Between Sessions',type:'between',
        timeLabel:s.endTime+' → '+sorted[i+1].startTime,
        carbTarget:gc,proteinTarget:Math.round(targets.protein*gf),fatTarget:Math.round(targets.fat*gf),
        carbEaten:0,proteinEaten:0,fatEaten:0});
    }
  });
  windows.push({id:'post_final',label:'After Training',type:'after',
    timeLabel:sorted[sorted.length-1].endTime+' → Sleep',
    carbTarget:Math.max(0,avail-allocC),proteinTarget:Math.max(0,targets.protein-allocP),
    fatTarget:Math.max(0,targets.fat-allocF),carbEaten:0,proteinEaten:0,fatEaten:0});
  windows.forEach(w=>{
    const ents=(foodEntries||[]).filter(e=>e.windowId===w.id);
    w.carbEaten=ents.reduce((s,e)=>s+(e.carbs||0),0);
    w.proteinEaten=ents.reduce((s,e)=>s+(e.protein||0),0);
    w.fatEaten=ents.reduce((s,e)=>s+(e.fat||0),0);
    w.kcalEaten=ents.reduce((s,e)=>s+(e.calories||0),0);
  });
  return windows;
}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — HELPERS
// ═══════════════════════════════════════════════════════════════════
const NUTR_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function nutrTodayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _localStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function nutrGetWeekBounds(){
  const now=new Date(),day=now.getDay();
  const mon=new Date(now);mon.setDate(now.getDate()-(day===0?6:day-1));mon.setHours(0,0,0,0);
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  const dates=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return _localStr(d);});
  return{start:_localStr(mon),end:_localStr(sun),dates};
}

function nutrMapWorkoutToTypeNum(sport,durationMins){
  // IDs reference the SESSION_TYPES array (id field, 1-42)
  const s=(sport||'').toLowerCase(),d=Number(durationMins)||60;
  if(/swim/i.test(s))return d<40?10:11;                          // 10=Easy/Technique Swim, 11=Aerobic Endurance Swim
  if(/run|jog/i.test(s))return d>=70?29:26;                     // 29=Long Easy Run, 26=Easy Base Run
  if(/ride|cycl|virtual|bike/i.test(s))return d>=90?23:17;      // 23=Long Endurance Ride, 17=Aerobic Base/Z2 Ride
  if(/strength|gym|lift|weight/i.test(s))return 8;              // 8=Strength Full Body/Dynamic
  if(/yoga/i.test(s))return 3;                                   // 3=Yoga
  if(/mobil|flex|stretch/i.test(s))return 4;                    // 4=Mobility/Stretching
  if(/brick|tri/i.test(s))return d>=180?40:20;                  // 40=Full IM, 20=Brick Bike+Run
  return 42;                                                      // 42=Other Aerobic
}

function nutrMatchActivity(act,planned){
  const aType=(act.type||act.sport_type||'').toLowerCase();
  const isBike=t=>/ride|cycl|virtual|bike/i.test(t);
  const isRun=t=>/run|jog/i.test(t);
  const isSwim=t=>/swim/i.test(t);
  return planned.find(p=>{
    const ps=(p.sport||'').toLowerCase();
    return (isBike(aType)&&(isBike(ps)||ps.includes('tri')))||(isRun(aType)&&(isRun(ps)||ps.includes('tri')))||(isSwim(aType)&&(isSwim(ps)||ps.includes('tri')));
  });
}

function nutrSportKey(s){
  const t=(s||'').toLowerCase();
  if(/ride|cycl|virtual|bike/i.test(t))return 'ride';
  if(/run|jog/i.test(t))return 'run';
  if(/swim/i.test(t))return 'swim';
  return t||'other';
}

function nutrComputeAdjustments(activities,planned){
  const out=[];
  // Group completed activities by sport key, summing moving_time
  const sportGroups={};
  (activities||[]).forEach(a=>{
    const k=nutrSportKey(a.type||a.sport_type);
    if(!sportGroups[k])sportGroups[k]={totalMins:0,acts:[],sport:a.sport_type||a.type||k};
    sportGroups[k].totalMins+=Math.round((a.moving_time||0)/60);
    sportGroups[k].acts.push(a);
  });
  const usedKeys=new Set();
  (planned||[]).forEach(w=>{
    const k=nutrSportKey(w.sport);
    const grp=sportGroups[k];
    if(!grp)return;
    usedKeys.add(k);
    const actualMins=grp.totalMins;
    const plannedMins=w.duration_minutes||actualMins;
    if(!plannedMins)return;
    const ratio=actualMins/plannedMins;
    if(ratio>=0.90)return; // complete — no adjustment needed
    const typeNum=w.fuelpro_type||nutrMapWorkoutToTypeNum(w.sport,plannedMins);
    const t=NUTR_SESSION_TYPES[typeNum];
    const kcalDelta=(t?.kcalPerMin||8)*(actualMins-plannedMins);
    const carbDelta=Math.round(kcalDelta/4);
    if(Math.abs(carbDelta)<10)return;
    out.push({name:w.title||grp.sport||'Workout',actualMins,plannedMins,diffMins:Math.round(actualMins-plannedMins),carbAdjust:carbDelta,type:'partial',sportKey:k});
  });
  Object.entries(sportGroups).filter(([k])=>!usedKeys.has(k)).forEach(([k,grp])=>{
    const mins=grp.totalMins;
    const typeNum=nutrMapWorkoutToTypeNum(grp.sport,mins);
    const t=NUTR_SESSION_TYPES[typeNum];
    const carbAdj=Math.round((t?.kcalPerMin||8)*mins/4);
    if(carbAdj<10)return;
    const label=grp.sport.charAt(0).toUpperCase()+grp.sport.slice(1);
    out.push({name:'Unplanned '+label,actualMins:mins,plannedMins:0,diffMins:mins,carbAdjust:carbAdj,type:'unplanned',sportKey:k});
  });
  return out;
}

function nutrBuildSessionPillsHtml(planned,completed){
  const sc=s=>/cycl|bike|ride|virtual/i.test(s)?'#378ADD':/run|jog/i.test(s)?'#639922':/swim/i.test(s)?'#1D9E75':'#c8f036';
  const fillBg=c=>{const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return`rgba(${r},${g},${b},0.14)`;};

  // Group completed by sport key, summing time, tracking earliest start_date_local
  const sportGroups={};
  (completed||[]).forEach(a=>{
    const k=nutrSportKey(a.type||a.sport_type);
    if(!sportGroups[k])sportGroups[k]={totalMins:0,sport:a.sport_type||a.type||k,startDate:a.start_date_local||''};
    else if((a.start_date_local||'')<sportGroups[k].startDate)sportGroups[k].startDate=a.start_date_local||'';
    sportGroups[k].totalMins+=Math.round((a.moving_time||0)/60);
  });

  // Build completedList and plannedList separately, then concat
  const completedList=[];  // {pill, startDate} — matched or unplanned completed
  const plannedList=[];    // {pill, createdAt} — unmatched planned workouts
  const usedPlanIds=new Set();
  const usedSportKeys=new Set();

  // Pass 1: for each planned workout, check for a completed match
  (planned||[]).forEach(w=>{
    const k=nutrSportKey(w.sport);
    const grp=sportGroups[k];
    if(grp&&!usedSportKeys.has(k)){
      usedSportKeys.add(k);
      usedPlanIds.add(w.id);
      const c=sc(w.sport||'');
      const plannedMins=w.duration_minutes||60;
      const actualMins=grp.totalMins;
      const ratio=plannedMins?actualMins/plannedMins:null;
      let pill;
      if(ratio!==null&&ratio>=0.90){
        pill=`<div class="nutr-session-pill" style="background:${fillBg(c)};border-color:${c};color:${c}">
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em">${w.sport||'—'}</span>
          <span style="font-weight:600;margin-left:6px">${w.title||'Workout'}</span>
          <span style="margin-left:6px;opacity:0.6">${actualMins}min</span>
          <span style="color:#639922;margin-left:6px">✓</span>
        </div>`;
      }else{
        pill=`<div class="nutr-session-pill" style="background:${fillBg(c)};border-color:${c};color:${c}">
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em">${w.sport||'—'}</span>
          <span style="font-weight:600;margin-left:6px">${w.title||'Workout'}</span>
          <span style="margin-left:6px;opacity:0.6">${actualMins}min of ${plannedMins}min</span>
          <span style="color:#c8f036;margin-left:6px">⚠</span>
        </div>`;
      }
      completedList.push({pill,startDate:grp.startDate});
    }else{
      const c=sc(w.sport||'');
      const plannedMins=w.duration_minutes||60;
      plannedList.push({pill:`<div class="nutr-session-pill" style="border-color:${c};color:${c}">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em">${w.sport||'—'}</span>
        <span style="font-weight:600;margin-left:6px">${w.title||'Workout'}</span>
        <span style="margin-left:6px;opacity:0.6">${plannedMins}min</span>
      </div>`,createdAt:w.created_at||''});
    }
  });

  // Pass 2: unplanned completed sport groups (no matching planned workout)
  Object.entries(sportGroups).filter(([k])=>!usedSportKeys.has(k)).forEach(([k,grp])=>{
    const label=grp.sport.charAt(0).toUpperCase()+grp.sport.slice(1);
    completedList.push({pill:`<div class="nutr-session-pill" style="border-color:#444;color:#777">
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em">Unplanned ${label}</span>
      <span style="margin-left:6px;opacity:0.6">${grp.totalMins}min</span>
    </div>`,startDate:grp.startDate});
  });

  // Sort: completed by start_date_local asc, planned by created_at asc
  completedList.sort((a,b)=>a.startDate.localeCompare(b.startDate));
  plannedList.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));

  const pills=[...completedList,...plannedList].map(x=>x.pill);
  return pills.length?pills.join(''):`<span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc3)">No workouts planned today — targets shown for rest day</span>`;
}

function nutrAdjTotal(){return nutr.workoutAdjustments.reduce((s,a)=>s+(a.carbAdjust||0),0);}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — STATE
// ═══════════════════════════════════════════════════════════════════
const nutr={
  loaded:false,loading:false,
  profile:{weight_lbs:168,goal_weight_lbs:159,mode:1,weekly_loss_target:0.5,protein_factor:1.09,fat_floor:85,fat_ceiling:110},
  plannedWorkouts:[],weekWorkouts:[],weekActivities:[],weekLoading:false,
  todaySessions:[{typeNum:null,durationMins:null,startTime:''}],
  completedActivities:[],wellness:null,workoutAdjustments:[],
  foodEntries:[],todayLogId:null,
  logHistory:[],weightLogs:[],
  foodHistory:[],foodFavorites:[],combos:[],
  newWeight:'',newBodyFat:'',newFeeling:'',newWeightNotes:'',
  // food modal
  foodModalOpen:false,foodModalWindow:'unassigned',
  selectedFood:null,searchResults:[],searchQuery:'',searchError:'',
  foodQty:'',foodUnit:'g',foodOverrides:{},recentsTab:'recent',
  saveAsCombo:false,comboName:'',
  searchTimer:null,
  // week view
  weekSelectedDay:Math.max(0,new Date().getDay()-1),
  sub:'today',
  viewDate:null,
};

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — LOAD
// ═══════════════════════════════════════════════════════════════════
async function loadNutritionTab(){
  if(!currentAthlete?.id)return;
  if(nutr.loading||nutr.loaded)return;
  nutr.loading=true;
  const todayEl=document.getElementById('nutr-today');
  if(todayEl&&nutr.sub==='today')todayEl.innerHTML='<div style="padding:2rem;font-family:\'DM Mono\',monospace;font-size:12px;color:var(--tc3)">Loading...</div>';
  const aid=currentAthlete.id;
  const today=nutrTodayStr();
  const wb=nutrGetWeekBounds();
  const iId=currentAthlete.intervals_athlete_id;
  const iKey=currentAthlete.intervals_api_key;

  // Schema probe — check if food_entries column exists
  fetch('/api/nutrition-data?type=schema').then(r=>r.json()).then(s=>{
    if(s.food_entries_exists){
      console.log('[FuelPro] ✅ food_entries column EXISTS in daily_logs');
    }else{
      console.warn('[FuelPro] ⚠️ food_entries column MISSING. Run in Supabase SQL Editor:\n  ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS food_entries jsonb DEFAULT \'[]\';');
      console.warn('[FuelPro] Schema probe error:',s.probe_error);
    }
  }).catch(e=>console.error('[FuelPro] Schema probe failed:',e));

  console.log('[FuelPro] Loading food entries for today ('+today+') athlete='+aid);
  try{
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
    const tomStr=_localStr(tomorrow);
    // Pre-load athlete profile fields (age, height, experience_level) so calcBMR works from first render
    fetch('/api/athlete-profile?athlete_id='+encodeURIComponent(aid)).then(r=>r.json()).then(d=>{
      if(d?.profile){const p=d.profile;
        if(p.age!=null)currentAthlete.age=p.age;
        if(p.height_feet!=null)currentAthlete.height_feet=p.height_feet;
        if(p.height_inches!=null)currentAthlete.height_inches=p.height_inches;
        if(p.experience_level)currentAthlete.experience_level=p.experience_level;
        if(p.weight_lbs!=null)currentAthlete.weight_lbs=p.weight_lbs;
        if(p.ftp_watts!=null)currentAthlete.ftp_watts=p.ftp_watts;
        if(p.activity_level)currentAthlete.activity_level=p.activity_level;
      }
    }).catch(()=>{});
    const fetches=[
      fetch('/api/nutrition-data?type=profile&athlete_id='+aid).then(r=>r.json()).catch(()=>({})),
      fetch('/api/workouts?athlete_id='+encodeURIComponent(aid)+'&start='+today+'&end='+today).then(r=>r.json()).catch(()=>({})),
      fetch('/api/workouts?athlete_id='+encodeURIComponent(aid)+'&start='+wb.start+'&end='+wb.end).then(r=>r.json()).catch(()=>({})),
      fetch('/api/nutrition-data?type=log&athlete_id='+aid+'&date='+today).then(r=>r.json()).catch(()=>({})),
      fetch('/api/nutrition-data?type=log&athlete_id='+aid).then(r=>r.json()).catch(()=>[]),
      fetch('/api/nutrition-data?type=weight&athlete_id='+aid).then(r=>r.json()).catch(()=>[]),
      fetch('/api/nutrition-food?type=history&q=&athlete_id='+aid).then(r=>r.json()).catch(()=>[]),
      iId&&iKey?fetch('/api/intervals?athleteId='+encodeURIComponent(iId)+'&apiKey='+encodeURIComponent(iKey)+'&path=activities&qs=oldest='+today+'%26newest='+tomStr).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
      iId&&iKey?fetch('/api/intervals?athleteId='+encodeURIComponent(iId)+'&apiKey='+encodeURIComponent(iKey)+'&path=wellness.json&qs=oldest='+today+'%26newest='+today).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
    ];
    const[prof,todayWoResp,weekWoResp,todayLog,allLogs,weights,foodHist,activities,wellnessArr]=await Promise.all(fetches);
    if(prof&&!prof.error)nutr.profile=prof;
    nutr.viewDate=today;
    // Today's planned workouts → sessions for algorithm
    const todayPlanned=(todayWoResp?.workouts||[]).filter(w=>w.date===today);
    nutr.plannedWorkouts=todayPlanned;
    nutr.todaySessions=todayPlanned.length?todayPlanned.map(w=>({
      typeNum:w.fuelpro_type||nutrMapWorkoutToTypeNum(w.sport,w.duration_minutes),
      durationMins:w.duration_minutes||60,
      startTime:w.start_time||'',
      title:w.title||w.sport||'Workout',
      sport:w.sport||'',workoutId:w.id,
    })):[{typeNum:null,durationMins:null,startTime:''}];
    // Week workouts
    nutr.weekWorkouts=weekWoResp?.workouts||[];
    // Today's food log — try food_entries column first, fall back to sessions
    const rawFE=todayLog?.food_entries;
    const rawSess=todayLog?.sessions;
    const rawEntries=Array.isArray(rawFE)?rawFE:(Array.isArray(rawSess)?rawSess:[]);
    nutr.foodEntries=rawEntries;
    nutr.todayLogId=todayLog?.id||null;
    console.log('[FuelPro LOAD] raw todayLog record:', todayLog);
    console.log('[FuelPro LOAD] food_entries value:', rawFE);
    console.log('[FuelPro LOAD] sessions value:', rawSess);
    console.log('[FuelPro LOAD] restored entries count:', rawEntries.length, '| source:', Array.isArray(rawFE)&&rawFE.length?'food_entries':Array.isArray(rawSess)&&rawSess.length?'sessions':'none');
    // History — exclude today, last 30 days only
    nutr.logHistory=(Array.isArray(allLogs)?allLogs:[]).filter(l=>l.log_date!==today);
    // Weight
    nutr.weightLogs=Array.isArray(weights)?weights:[];
    // Food history, favorites & combos
    const fh=Array.isArray(foodHist)?foodHist:[];
    const nonCombo=fh.filter(f=>!f.is_combo);
    nutr.foodHistory=nonCombo.slice(0,8);
    nutr.foodFavorites=nonCombo.filter(f=>f.is_favorite);
    nutr.combos=fh.filter(f=>f.is_combo).slice(0,5);
    // intervals.icu data
    nutr.completedActivities=Array.isArray(activities)?activities:[];
    nutr.wellness=Array.isArray(wellnessArr)?(wellnessArr.find(w=>w.id===today)||null):null;
    nutr.workoutAdjustments=nutrComputeAdjustments(nutr.completedActivities,nutr.plannedWorkouts);
    nutr.sessionsRendered=false;
    nutr.loaded=true;
  }catch(e){console.error('loadNutritionTab',e);nutr.loaded=true;}
  nutr.loading=false;
  nutrRender();
}

async function nutrRefreshActivities(){
  if(!currentAthlete?.intervals_athlete_id||!currentAthlete?.intervals_api_key)return;
  const iId=currentAthlete.intervals_athlete_id,iKey=currentAthlete.intervals_api_key;
  const today=nutrTodayStr();
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const tomStr=_localStr(tomorrow);
  const btn=document.getElementById('nutrRefreshBtn');
  if(btn){btn.textContent='...';btn.disabled=true;}
  const activities=await fetch('/api/intervals?athleteId='+encodeURIComponent(iId)+'&apiKey='+encodeURIComponent(iKey)+'&path=activities&qs=oldest='+today+'%26newest='+tomStr).then(r=>r.json()).catch(()=>[]);
  nutr.completedActivities=Array.isArray(activities)?activities:[];
  nutr.workoutAdjustments=nutrComputeAdjustments(nutr.completedActivities,nutr.plannedWorkouts);
  nutr.sessionsRendered=false;
  if(btn){btn.textContent='↻';btn.disabled=false;}
  nutrRenderToday();
}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — RENDER ROUTER
// ═══════════════════════════════════════════════════════════════════
function nutrSwitchSub(name){
  nutr.sub=name;
  document.querySelectorAll('#nutrSubTabs .sub-tab').forEach(t=>t.classList.toggle('active',t.dataset.nsub===name));
  document.querySelectorAll('.nutr-sub').forEach(d=>d.style.display='none');
  document.getElementById('nutr-'+name).style.display='block';
  if(name==='week'&&nutr.loaded) nutrLoadWeek();
  else nutrRender();
}

function nutrRenderWeightLog(){
  const el=document.getElementById('nutr-weightlog');
  if(!el)return;
  const logs=nutr.weightLogs||[];
  const wtRows=logs.map((l,i)=>{
    const prev=logs[i+1];
    const change=prev?+(l.weight_lbs-prev.weight_lbs).toFixed(1):null;
    const chColor=change===null?'var(--tc3)':change<0?'#639922':change>0?'#E24B4A':'var(--tc3)';
    const chLabel=change===null?'—':change>0?'+'+change+' lbs':change+' lbs';
    // show datetime if available, else date
    const dateLabel=l.logged_at?l.logged_at.replace('T',' ').slice(0,16):l.log_date;
    return`<tr id="wl-row-${l.id}">
      <td style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:12px;color:var(--tc3)">${dateLabel}</td>
      <td style="padding:7px 10px;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700">${Number(l.weight_lbs).toFixed(1)}</td>
      <td style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:12px;color:${chColor}">${chLabel}</td>
      <td style="padding:7px 6px"><button onclick="nutrDeleteWeightLog('${l.id}')" style="background:none;border:none;color:var(--tc3);cursor:pointer;font-size:13px;line-height:1;padding:2px 4px" title="Delete">✕</button></td>
    </tr>`;
  }).join('');
  el.innerHTML=`<div class="nutr-card">
    <div class="section-label" style="margin-top:0;margin-bottom:12px">Log weight</div>
    <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:12px">
      <div style="flex:1">
        <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Weight (lbs)</label>
        <input type="number" class="nutr-input" placeholder="168.0" id="nutrWtInput" value="${nutr.newWeight||''}" oninput="nutr.newWeight=this.value">
      </div>
      <button class="nutr-btn" style="padding:10px 20px;white-space:nowrap" onclick="nutrSaveWeight()">LOG WEIGHT</button>
    </div>
    ${logs.length?`<table style="width:100%;border-collapse:collapse;border-top:1px solid var(--border)">
      <thead><tr>
        <th style="padding:6px 10px;font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-align:left;text-transform:uppercase">Date &amp; Time</th>
        <th style="padding:6px 10px;font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-align:left;text-transform:uppercase">Weight (lbs)</th>
        <th style="padding:6px 10px;font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-align:left;text-transform:uppercase">Change</th>
      </tr></thead>
      <tbody>${wtRows}</tbody>
    </table>`:`<div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--tc3)">No entries yet.</div>`}
  </div>`;
}

async function nutrLoadWeek(){
  const wb=nutrGetWeekBounds();
  const aid=currentAthlete?.id;
  const resp=await fetch('/api/workouts?athlete_id='+encodeURIComponent(aid)+'&start='+wb.start+'&end='+wb.end+'&_='+Date.now(),{
    cache:'no-store',
    headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},
  }).then(r=>r.json()).catch(()=>({}));
  nutr.weekWorkouts=(resp?.workouts||[]).filter(w=>w&&w.id&&w.date);
  nutrRenderWeek();
}

function nutrRender(){
  if(!nutr.loaded){loadNutritionTab();return;}
  if(nutr.sub==='today')        nutrRenderToday();
  else if(nutr.sub==='week')    nutrRenderWeek();
  else if(nutr.sub==='weightlog') nutrRenderWeightLog();
  else if(nutr.sub==='profile') nutrRenderProfile();
}

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// FUELPRO — DAY NAVIGATION
// ═══════════════════════════════════════════════════════════════════
async function nutrFetchForDate(dateStr){
  const aid=currentAthlete?.id; if(!aid)return;
  const iId=currentAthlete.intervals_athlete_id,iKey=currentAthlete.intervals_api_key;
  const next=new Date(dateStr+'T00:00:00'); next.setDate(next.getDate()+1);
  const nextStr=_localStr(next);
  const[woResp,logResp,acts]=await Promise.all([
    fetch('/api/workouts?athlete_id='+encodeURIComponent(aid)+'&start='+dateStr+'&end='+dateStr).then(r=>r.json()).catch(()=>({})),
    fetch('/api/nutrition-data?type=log&athlete_id='+aid+'&date='+dateStr).then(r=>r.json()).catch(()=>({})),
    iId&&iKey?fetch('/api/intervals?athleteId='+encodeURIComponent(iId)+'&apiKey='+encodeURIComponent(iKey)+'&path=activities&qs=oldest='+dateStr+'%26newest='+nextStr).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
  ]);
  nutr.plannedWorkouts=(woResp?.workouts||[]).filter(w=>w.date===dateStr);
  const rawFE=logResp?.food_entries,rawSess=logResp?.sessions;
  nutr.foodEntries=Array.isArray(rawFE)?rawFE:(Array.isArray(rawSess)?rawSess:[]);
  nutr.todayLogId=logResp?.id||null;
  const allActs=Array.isArray(acts)?acts:[];
  nutr.completedActivities=allActs.filter(a=>(a.start_date_local||'').slice(0,10)===dateStr);
  nutr.workoutAdjustments=nutrComputeAdjustments(nutr.completedActivities,nutr.plannedWorkouts);
  nutr.sessionsRendered=false;
}
async function nutrSetViewDate(offset){
  const d=new Date((nutr.viewDate||nutrTodayStr())+'T00:00:00');
  if(offset==='today') nutr.viewDate=nutrTodayStr();
  else{ d.setDate(d.getDate()+offset); nutr.viewDate=_localStr(d); }
  const el=document.getElementById('nutr-today');
  if(el) el.innerHTML='<div style="padding:2rem;font-family:\'DM Mono\',monospace;font-size:12px;color:var(--tc3)">Loading...</div>';
  await nutrFetchForDate(nutr.viewDate);
  nutrRenderToday();
}

// FUELPRO — TODAY TAB
// ═══════════════════════════════════════════════════════════════════
function nutrRenderToday(){
  if(nutr.sessionsRendered)return;
  nutr.sessionsRendered=true;
  const el=document.getElementById('nutr-today');
  if(el)el.innerHTML='';
  const viewDate=nutr.viewDate||nutrTodayStr();
  const todayStr=nutrTodayStr();
  const isToday=viewDate===todayStr;
  const isPast=viewDate<todayStr;
  const dayResult=calcDayTargets(viewDate,nutr.profile,nutr.weekWorkouts,allActivities);
  const mode=nutr.profile.mode||1;
  const wkly=nutr.profile.weekly_loss_target||0.5;
  const tdeeResult={tdee:dayResult.tdee,bmr:dayResult.bmr,neat:dayResult.neat,exercise:dayResult.exercise};
  const tdeeTarget=dayResult.tdeeTarget;
  const adjTotal=nutrAdjTotal();
  const adjCarbs=Math.max(dayResult.carbs,dayResult.carbs+adjTotal);
  const adjKcal=adjCarbs*4+dayResult.protein*4+dayResult.fat*9;
  const adj={...dayResult,carbs:adjCarbs,kcal:adjKcal};
  const eaten={
    carbs:nutr.foodEntries.reduce((s,e)=>s+(e.carbs||0),0),
    protein:nutr.foodEntries.reduce((s,e)=>s+(e.protein||0),0),
    fat:nutr.foodEntries.reduce((s,e)=>s+(e.fat||0),0),
  };
  eaten.kcal=Math.round(eaten.carbs*4+eaten.protein*4+eaten.fat*9);
  const rem={
    carbs:Math.max(0,adj.carbs-eaten.carbs),
    protein:Math.max(0,adj.protein-eaten.protein),
    fat:Math.max(0,adj.fat-eaten.fat),
  };
  rem.kcal=rem.carbs*4+rem.protein*4+rem.fat*9;

  // 1. Macro donut gauges
  function donut(label,eaten,target,color){
    const r=27,cx=35,cy=35,circ=2*Math.PI*r;
    const pct=target>0?Math.min(eaten/target,1.2):0;
    const over=pct>1;
    const fillColor=over?'#E24B4A':color;
    const dash=circ*Math.min(pct,1);
    const gap=circ-dash;
    const unit=label==='Kcal'?'':label==='Protein'||label==='Fat'||label==='Carbs'?'g':'';
    return`<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bc3)" stroke-width="6"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${fillColor}" stroke-width="6"
          stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
          stroke-dashoffset="${(circ/4).toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy}) rotate(90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy-3}" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-size="14" font-weight="700" fill="${fillColor}">${eaten}${unit}</text>
        <text x="${cx}" y="${cy+9}" text-anchor="middle" font-family="'DM Mono',monospace" font-size="8" fill="var(--tc3)">/${target}${unit}</text>
      </svg>
      <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.06em">${label}</span>
    </div>`;
  }
  const macroStrip=`<div class="nutr-card" style="padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-around;align-items:flex-start">
      ${donut('Protein',eaten.protein,adj.protein,'#639922')}
      ${donut('Fat',eaten.fat,adj.fat,'#378ADD')}
      ${donut('Carbs',eaten.carbs,adj.carbs,'#E24B4A')}
      ${donut('Kcal',eaten.kcal,adj.kcal,'#c8f036')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px;padding-top:7px;border-top:1px solid var(--border)">
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">${rem.kcal.toLocaleString()} kcal remaining</span>
      <span class="nutr-intent ${adj.intent.cls}">${adj.intent.label}</span>
    </div>
    <div style="font-family:'DM Mono',monospace;font-size:9px;color:#555;margin-top:5px;line-height:1.5">
      BMR: ${tdeeResult.bmr} + NEAT: ${tdeeResult.neat} + Exercise: ${tdeeResult.exercise} = ${tdeeResult.tdee}${mode===1?` − ${Math.round(wkly*500)} (cut)`:mode===3?' + 300 (build)':''}
      = <span style="color:#c8f036;font-weight:700">${tdeeTarget} kcal target</span>
    </div>
  </div>`;

  // 2. Sessions section
  const hasIntervals=!!(currentAthlete?.intervals_athlete_id&&currentAthlete?.intervals_api_key);
  const pills=nutrBuildSessionPillsHtml(nutr.plannedWorkouts,nutr.completedActivities);

  const banners=nutr.workoutAdjustments.map(a=>a.type==='unplanned'
    ?`<div class="nutr-adjust-banner">Unplanned <strong>${a.name}</strong> added <strong>+${a.carbAdjust}g carbs</strong> to your remaining targets.</div>`
    :`<div class="nutr-adjust-banner"><strong>${a.name}</strong>: Partial — ${a.actualMins}min of ${a.plannedMins}min planned. ${a.carbAdjust<0?`${Math.abs(a.carbAdjust)}g carbs removed.`:`+${a.carbAdjust}g carbs added.`}</div>`
  ).join('');

  const sessSection=`<div class="nutr-card" style="padding:8px 10px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
      <div class="section-label" style="margin:0;font-size:10px">Sessions</div>
      ${hasIntervals?`<button id="nutrRefreshBtn" onclick="nutrRefreshActivities()" title="Refresh from intervals.icu" style="background:none;border:1px solid var(--border);color:var(--tc3);padding:2px 8px;cursor:pointer;font-family:'DM Mono',monospace;font-size:11px">↻</button>`:''}
    </div>
    <div class="nutr-pills-row" style="gap:4px">${pills}</div>
    ${banners}
  </div>`;

  // 3. Fuelling windows or simple breakdown
  const windows=nutrCalcWindows(nutr.todaySessions,adj,nutr.foodEntries);
  let fuelHtml='';
  if(windows){
    fuelHtml=windows.map(w=>{
      const pct=w.carbTarget>0?Math.min(100,Math.round(w.carbEaten/w.carbTarget*100)):0;
      const bc=pct>=100?'#E24B4A':pct>=80?'#c8f036':'#378ADD';
      const entries=nutr.foodEntries.filter(e=>e.windowId===w.id);
      const eHtml=entries.map(e=>`<div class="nutr-food-row">
        <div class="nutr-food-name">${e.name} <span style="opacity:0.5">${e.qty}${e.unit}</span></div>
        <div class="nutr-food-macros"><span style="color:#639922">${e.protein}P</span><span style="color:#378ADD">${e.fat}F</span><span style="color:#E24B4A">${e.carbs}C</span>
          ${isToday?`<button onclick="nutrRemoveFood('${e.id}')" style="background:none;border:none;color:var(--tc3);cursor:pointer;padding:0 0 0 6px;font-size:13px">✕</button>`:''}
        </div>
      </div>`).join('');
      return `<div class="nutr-window">
        <div class="nutr-window-hdr"><span class="nutr-window-lbl">${w.label}</span><span class="nutr-window-time">${w.timeLabel}</span></div>
        <div style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:11px;margin-bottom:3px">
          <span style="color:var(--tc3)">Carbs</span><span style="color:#E24B4A;font-weight:700">${w.carbEaten}g / ${w.carbTarget}g</span>
        </div>
        <div class="nutr-progress"><div class="nutr-progress-fill" style="width:${pct}%;background:${bc}"></div></div>
        ${w.type!=='intra'?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc3)">P: ${w.proteinEaten}/${w.proteinTarget}g &nbsp; F: ${w.fatEaten}/${w.fatTarget}g</div>`:''}
        ${eHtml}
        ${isToday?`<button onclick="nutrOpenFoodModal('${w.id}')" style="margin-top:8px;width:100%;background:var(--bc);border:1px dashed var(--border);color:var(--acc);padding:6px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;text-transform:uppercase;letter-spacing:0.08em">+ Add Food</button>`:''}
      </div>`;
    }).join('');
  }else{
    const hasSess=nutr.todaySessions.some(s=>s.typeNum);
    fuelHtml=`<div class="nutr-card" style="padding:8px 10px;margin-bottom:6px">
      <div class="section-label" style="margin-top:0;margin-bottom:5px;font-size:10px">Fuelling breakdown</div>
      <div class="nutr-row" style="padding:2px 0"><span style="color:var(--tc2);font-size:11px">Pre-session</span><span style="color:#c8f036;font-weight:700;font-size:11px">${adj.pre}g carbs</span></div>
      <div class="nutr-row" style="padding:2px 0"><span style="color:var(--tc2);font-size:11px">Intra (during)</span><span style="color:#c8f036;font-weight:700;font-size:11px">${adj.intra}g carbs</span></div>
      <div class="nutr-row" style="padding:2px 0"><span style="color:var(--tc2);font-size:11px">Post-session recovery</span><span style="color:#639922;font-weight:700;font-size:11px">${adj.post}g protein</span></div>
      <div class="nutr-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span style="font-weight:600;font-size:11px">From meals</span><span style="color:#E24B4A;font-size:14px;font-weight:700;font-family:'Barlow Condensed',sans-serif">${adj.foodCarbs}g carbs</span></div>
    </div>`;
  }

  // 4. Food log
  let foodLogRows='';
  if(nutr.foodEntries.length){
    foodLogRows=nutr.foodEntries.map(e=>`<div class="nutr-food-row">
      <div class="nutr-food-name">${e.name} <span style="opacity:0.5">${e.qty}${e.unit}</span></div>
      <div class="nutr-food-macros"><span style="color:#639922">${e.protein}P</span><span style="color:#378ADD">${e.fat}F</span><span style="color:#E24B4A">${e.carbs}C</span><span style="color:var(--tc3);margin-left:4px">${e.calories}kcal</span>
        ${isToday?`<button onclick="nutrRemoveFood('${e.id}')" style="background:none;border:none;color:var(--tc3);cursor:pointer;padding:0 0 0 6px;font-size:13px">✕</button>`:''}
      </div>
    </div>`).join('');
  }else{
    const emptyMsg=isPast?'No food logged for this day.':'Nothing logged yet today.';
    foodLogRows=`<div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--tc3);padding:12px 0">${emptyMsg}</div>`;
  }
  const logLabel=isToday?"Today's food log":viewDate;
  const foodLogHtml=`<div class="nutr-card">
    <div class="section-label" style="margin-top:0;margin-bottom:10px">${logLabel}</div>
    ${foodLogRows}
    ${isToday?`<button onclick="nutrOpenFoodModal('unassigned')" class="nutr-add-btn" style="margin-top:10px">+ Add Food</button>`:''}
  </div>`;

  // Nav header
  const fmtViewDate=(()=>{const d=new Date(viewDate+'T00:00:00');return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});})();
  const navHtml=`<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">
    <button onclick="nutrSetViewDate(-1)" style="background:none;border:1px solid var(--border);color:var(--tc2);width:26px;height:26px;cursor:pointer;font-size:15px;line-height:1">‹</button>
    <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc2);min-width:140px;text-align:center">
      ${isToday?`<span style="color:var(--acc);font-weight:600">TODAY</span> · `:''} ${fmtViewDate}
    </span>
    <button onclick="nutrSetViewDate(1)" style="background:none;border:1px solid var(--border);color:var(--tc2);width:26px;height:26px;cursor:pointer;font-size:15px;line-height:1">›</button>
  </div>`;

  el.innerHTML=navHtml+macroStrip+sessSection+fuelHtml+foodLogHtml;
}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — FOOD MODAL
// ═══════════════════════════════════════════════════════════════════
function nutrEffectiveServingSize(f){
  // If serving_size is missing/100 and name contains 'egg', default to 50g
  const ss=f?.serving_size;
  if((!ss||ss===100)&&(f?.name||'').toLowerCase().includes('egg'))return 50;
  return ss||100;
}
function nutrCalcMult(qty,unit,servingSize){
  const q=Number(qty);
  if(unit==='serving')return q*(servingSize||100)/100;
  if(unit==='oz')return q*28.35/100;
  if(unit==='fl oz')return q*29.57/100;
  if(unit==='cup')return q*240/100;
  if(unit==='tbsp')return q*15/100;
  if(unit==='tsp')return q*5/100;
  return q/100;
}

// ── NLP parser: "100g chicken breast" / "6oz raspberries" → {qty, unit, foodName}
function nutrParseSearchInput(raw){
  const s=raw.trim();
  // number immediately followed by (optional space) unit then food  e.g. "6oz raspberries", "100 g oats"
  const m=s.match(/^(\d+(?:\.\d+)?)\s*(g|oz|ml|fl\s*oz|cup|tbsp|tsp|serving|piece|large|medium|small)s?\s+(.+)$/i);
  if(m)return{qty:parseFloat(m[1]),unit:m[2].toLowerCase().replace(/\s+/,'').replace(/s$/,''),foodName:m[3].trim()};
  // number glued to unit with no trailing space then food — e.g. "6oz raspberries" with no space after oz
  const m1b=s.match(/^(\d+(?:\.\d+)?)(g|oz|ml|cup|tbsp|tsp)\s+(.+)$/i);
  if(m1b)return{qty:parseFloat(m1b[1]),unit:m1b[2].toLowerCase(),foodName:m1b[3].trim()};
  // word-size + food  e.g. "large chocolate cookie"
  const m2=s.match(/^(large|medium|small|piece)\s+(.+)$/i);
  if(m2)return{qty:1,unit:'serving',foodName:m2[2].trim()};
  // plain number + food  e.g. "2 eggs"
  const m3=s.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if(m3)return{qty:parseFloat(m3[1]),unit:'serving',foodName:m3[2].trim()};
  return{qty:null,unit:null,foodName:s};
}

function nutrOpenFoodModal(windowId){
  nutr.foodModalOpen=true;
  nutr.foodModalWindow=windowId||'unassigned';
  nutr.selectedFood=null;nutr.searchQuery='';nutr.searchResults=[];nutr.searchError='';
  nutr.foodQty='';nutr.foodUnit='g';nutr.foodOverrides={};nutr.parsedQty=null;nutr.parsedUnit=null;
  nutr.saveAsCombo=false;nutr.comboName='';nutr.barcodeWarning='';
  document.getElementById('nutrFoodModal').classList.add('show');
  document.getElementById('nutrFoodModalOverlay').classList.add('show');
  document.body.style.overflow='hidden';
  nutrRenderFoodModal();
  setTimeout(()=>{const inp=document.getElementById('nutrFoodSearchInput');if(inp)inp.focus();},120);
  // Fetch fresh recents + favorites on every open
  const aid=currentAthlete?.id||'';
  fetch('/api/nutrition-food?type=history&q=&athlete_id='+aid+'&limit=20')
    .then(r=>r.json()).then(data=>{
      if(!Array.isArray(data))return;
      nutr.foodHistory=data;
      nutr.foodFavorites=data.filter(h=>h.is_favorite);
      if(!nutr.searchQuery)nutrUpdateSearchResults();
      nutrRenderRecentsPanel();
    }).catch(()=>{});
}

function nutrCloseFoodModal(){
  nutr.foodModalOpen=false;
  document.getElementById('nutrFoodModal').classList.remove('show');
  document.getElementById('nutrFoodModalOverlay').classList.remove('show');
  document.body.style.overflow='';
  if(nutr.sub==='weightlog') nutrRenderWeightLog();
  else{nutr.sessionsRendered=false;nutrRenderToday();}
}

function nutrFoodItemHtml(item,opts={}){
  const js=JSON.stringify(JSON.stringify(item));
  const starColor=item.is_favorite?'#c8f036':'var(--tc3)';
  const starLabel=item.is_favorite?'★':'☆';
  return`<div class="nutr-hist-item" style="display:flex;align-items:center;gap:8px">
    <div style="flex:1;min-width:0;cursor:pointer" onclick='nutrSelectFoodObj(${js})'>
      <div class="nutr-hist-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
      <div class="nutr-hist-macros">
        <span style="color:#639922">${item.per100g?.protein??'?'}P</span>
        <span style="color:#378ADD">${item.per100g?.fat??'?'}F</span>
        <span style="color:#E24B4A">${item.per100g?.carbs??'?'}C</span>
        <span style="color:var(--tc3)">per 100g</span>
        ${opts.showCount&&item.use_count?`<span style="color:var(--tc3);margin-left:4px">${item.use_count}×</span>`:''}
      </div>
    </div>
    <button onmousedown="event.preventDefault()" onclick='nutrToggleFavorite(${js})' style="background:none;border:none;cursor:pointer;font-size:16px;color:${starColor};padding:4px;flex-shrink:0" title="Toggle favorite">${starLabel}</button>
  </div>`;
}

// Build just the search-results/error/recents HTML — never touches the input
function nutrSearchResultsHtml(){
  if(nutr.searchError)
    return`<div style="font-family:'DM Mono',monospace;font-size:11px;color:#E24B4A;background:#E24B4A18;border:1px solid #E24B4A44;padding:8px 12px;margin-top:8px">${nutr.searchError}</div>`;
  if(nutr.searchResults.length)
    return`<div style="border:1px solid var(--border);max-height:260px;overflow-y:auto;margin-top:6px"
        onmousedown="event.preventDefault()">
      ${nutr.searchResults.map(r=>`<div class="nutr-search-result" onmousedown="event.preventDefault()" onclick='nutrSelectFoodObj(${JSON.stringify(JSON.stringify(r))})'>
        <span style="font-weight:600;color:var(--tc)">${r.name}</span>
        ${r.fromHistory?'<span style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--acc);margin-left:6px">HIST</span>':''}
        ${r.brand?`<span style="color:var(--tc3)"> — ${r.brand}</span>`:''}
        <span style="color:#639922;margin-left:8px">${r.per100g?.protein??'?'}P</span>
        <span style="color:#378ADD;margin-left:4px">${r.per100g?.fat??'?'}F</span>
        <span style="color:#E24B4A;margin-left:4px">${r.per100g?.carbs??'?'}C</span>
        <span style="color:var(--tc3);margin-left:4px">per 100g</span>
      </div>`).join('')}
    </div>`;
  return '';
}

async function nutrToggleFavorite(foodJson){
  const food=typeof foodJson==='string'?JSON.parse(foodJson):foodJson;
  const aid=currentAthlete?.id||'';
  const newFav=!food.is_favorite;
  // Update local state
  const upd=arr=>arr.map(h=>h.name===food.name?{...h,is_favorite:newFav}:h);
  nutr.foodHistory=upd(nutr.foodHistory);
  nutr.foodFavorites=newFav
    ?[...nutr.foodFavorites,{...food,is_favorite:true}].filter((v,i,a)=>a.findIndex(x=>x.name===v.name)===i)
    :nutr.foodFavorites.filter(h=>h.name!==food.name);
  nutrUpdateSearchResults();
  // Persist: use PATCH by id if available, else fall back to POST
  if(food.id){
    await fetch('/api/nutrition-food?type=history&id='+food.id,{method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({is_favorite:newFav})}).catch(()=>{});
  }else{
    await fetch('/api/nutrition-food?type=history',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({food:{...food,is_favorite:newFav},athlete_id:aid,set_favorite:true})}).catch(()=>{});
  }
}

// Partial update — only the results div, never the search input
function nutrUpdateSearchResults(){
  const el=document.getElementById('nutrFoodSearchResultsEl');
  if(el)el.innerHTML=nutrSearchResultsHtml();
}

// ── Unified confirmation screen (quantity + editable macros)
function nutrRenderConfirm(){
  const content=document.getElementById('nutrFoodModalContent');
  if(!content)return;
  const f=nutr.selectedFood;
  if(!f)return;
  const effServing=nutrEffectiveServingSize(f);
  const mult=nutr.foodQty?nutrCalcMult(nutr.foodQty,nutr.foodUnit,effServing):0;
  const calc={
    calories:Math.round((f.per100g?.calories||0)*mult),
    protein:Math.round((f.per100g?.protein||0)*mult),
    fat:Math.round((f.per100g?.fat||0)*mult),
    carbs:Math.round((f.per100g?.carbs||0)*mult),
  };
  const macros=[
    {k:'protein',label:'Protein',unit:'g',color:'#639922'},
    {k:'fat',label:'Fat',unit:'g',color:'#378ADD'},
    {k:'carbs',label:'Carbs',unit:'g',color:'#E24B4A'},
    {k:'calories',label:'Kcal',unit:'',color:'var(--tc)'},
  ];
  const isFav=nutr.foodFavorites.some(h=>h.name===f.name)||nutr.foodHistory.find(h=>h.name===f.name)?.is_favorite;
  const starColor=isFav?'#c8f036':'var(--tc3)';
  const warn=nutr.barcodeWarning?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:#E24B4A;background:#E24B4A18;border:1px solid #E24B4A44;padding:8px 10px;margin-bottom:10px">⚠ ${nutr.barcodeWarning}</div>`:'';
  content.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div style="flex:1;min-width:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--tc);text-transform:uppercase;line-height:1.1">${f.name}</div>
        ${f.brand?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);margin-top:2px">${f.brand}</div>`:''}
      </div>
      <button onmousedown="event.preventDefault()" onclick='nutrToggleFavorite(${JSON.stringify(JSON.stringify(f))});nutrRenderConfirm()' style="background:none;border:none;cursor:pointer;font-size:20px;color:${starColor};padding:2px 6px;flex-shrink:0">${isFav?'★':'☆'}</button>
      <button onclick="nutrCloseFoodModal()" style="background:none;border:none;color:var(--tc3);cursor:pointer;font-size:22px;line-height:1;padding:2px 6px">✕</button>
    </div>
    ${warn}
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <input type="number" id="nutrQtyInput" class="nutr-input" style="flex:1;font-size:20px;font-weight:700;padding:10px 12px"
        placeholder="Amount" value="${nutr.foodQty}" oninput="nutrSetFoodQty(this.value)" autocomplete="off">
      <select class="nutr-select" style="padding:10px 8px;font-size:13px" onchange="nutrSetFoodUnit(this.value)">
        ${['g','oz','fl oz','ml','serving','piece','cup','tbsp','tsp'].map(u=>`<option value="${u}"${nutr.foodUnit===u?' selected':''}>${u}</option>`).join('')}
      </select>
    </div>
    ${(()=>{
      const u=nutr.foodUnit;
      let hint='';
      if(u==='serving')hint=`1 serving = ${effServing}g`;
      else if(u==='oz')hint='1 oz = 28.35g';
      else if(u==='fl oz')hint='1 fl oz = 29.57g';
      else if(u==='ml')hint='1 ml = 1g';
      else if(u==='cup')hint='1 cup = 240g';
      else if(u==='tbsp')hint='1 tbsp = 15g';
      else if(u==='tsp')hint='1 tsp = 5g';
      return hint?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:#555;margin-top:-8px;margin-bottom:10px;text-align:right">${hint}</div>`:'';
    })()}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:14px">
      ${macros.map(({k,label,unit,color})=>{
        const displayed=nutr.foodOverrides[k]??calc[k];
        const edited=nutr.foodOverrides[k]!==undefined;
        return`<div style="text-align:center;background:var(--bc3);border:1px solid ${edited?color:'var(--border)'};padding:8px 4px;position:relative">
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3);text-transform:uppercase;margin-bottom:4px">${label}</div>
          <input type="number" class="nutr-input" style="text-align:center;padding:2px;font-size:15px;font-weight:700;border:none;background:transparent;width:100%;color:${color}"
            value="${displayed}" onchange="nutrSetOverride('${k}',this.value);nutrRenderConfirm()">
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3)">${unit}</div>
          ${edited?`<button onmousedown="event.preventDefault()" onclick="delete nutr.foodOverrides['${k}'];nutrRenderConfirm()" style="position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;font-size:9px;color:var(--tc3);line-height:1;padding:1px">↺</button>`:''}
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="nutr-btn" style="flex:1;padding:13px;font-size:14px" onclick="nutrAddFoodFromModal()">ADD TO LOG</button>
      <button class="nutr-btn-ghost" style="padding:13px 18px" onclick="nutrClearFoodModal()">← Back</button>
    </div>`;
  setTimeout(()=>{const inp=document.getElementById('nutrQtyInput');if(inp)inp.focus();},40);
}

function nutrRenderFoodModal(){
  const content=document.getElementById('nutrFoodModalContent');
  if(!content)return;
  if(nutr.selectedFood){nutrRenderConfirm();return;}

  content.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:700;text-transform:uppercase">Add Food</div>
      <button onclick="nutrCloseFoodModal()" style="background:none;border:none;color:var(--tc3);cursor:pointer;font-size:24px;line-height:1;padding:4px 8px">✕</button>
    </div>
    <button onclick="nutrOpenBarcode(nutr.foodModalWindow)" class="nutr-scan-btn">SCAN BARCODE</button>
    <input id="nutrFoodSearchInput" type="text" class="nutr-input nutr-modal-search"
      placeholder="Search food… or try '100g oats', '2 eggs'" value="${nutr.searchQuery.replace(/"/g,'&quot;')}"
      oninput="nutrModalSearchInput(this.value)" autocomplete="off" style="margin-top:8px">
    <div id="nutrFoodSearchResultsEl">${nutrSearchResultsHtml()}</div>
    <div id="nutrRecentsPanel" style="${nutr.searchQuery?'display:none':''}"></div>`;

  const inp=document.getElementById('nutrFoodSearchInput');
  if(inp&&nutr.searchQuery){const l=nutr.searchQuery.length;inp.setSelectionRange(l,l);}
  else if(inp)setTimeout(()=>inp.focus(),50);
  nutrRenderRecentsPanel();
}

function nutrRenderRecentsPanel(){
  const el=document.getElementById('nutrRecentsPanel');
  if(!el)return;
  const tab=nutr.recentsTab||'recent';
  const recents=nutr.foodHistory||[];
  const favs=(nutr.foodHistory||[]).filter(h=>h.is_favorite);
  const tabBtn=(id,label)=>`<button onmousedown="event.preventDefault()" onclick="nutr.recentsTab='${id}';nutrRenderRecentsPanel()"
    style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;background:none;border:none;border-bottom:2px solid ${tab===id?'#c8f036':'transparent'};color:${tab===id?'#c8f036':'#555'};padding:6px 0;margin-right:16px;cursor:pointer">${label}</button>`;
  const rowHtml=(f)=>{
    const js=JSON.stringify(JSON.stringify(f));
    const star=f.is_favorite?'★':'☆';
    const starCol=f.is_favorite?'#c8f036':'#555';
    return`<div style="display:flex;align-items:center;padding:9px 0;border-bottom:1px solid var(--bc3)">
      <div style="flex:1;min-width:0;cursor:pointer" onmousedown="event.preventDefault()" onclick='nutrSelectFoodObj(${js})'>
        <div style="color:#f0f0f0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:#555;margin-top:2px">${(f.per100g?.carbs||0)}g C · ${(f.per100g?.protein||0)}g P · ${(f.per100g?.fat||0)}g F</div>
      </div>
      <button onmousedown="event.preventDefault()" onclick='nutrToggleFavoriteInline(${js})' style="background:none;border:none;cursor:pointer;font-size:18px;color:${starCol};padding:4px 6px;flex-shrink:0">${star}</button>
    </div>`;
  };
  let listHtml='';
  if(tab==='recent'){
    listHtml=recents.length?recents.map(rowHtml).join('')
      :'<div style="font-size:12px;color:#555;padding:10px 0">No recent foods yet — foods you log will appear here</div>';
  }else{
    listHtml=favs.length?favs.map(rowHtml).join('')
      :'<div style="font-size:12px;color:#555;padding:10px 0">No saved foods yet — star a food to save it</div>';
  }
  el.innerHTML=`<div style="margin-top:12px;border-bottom:1px solid var(--bc3);margin-bottom:2px">
    ${tabBtn('recent','Recent')}${tabBtn('saved','Saved')}
  </div>
  <div style="max-height:260px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#555 #333">${listHtml}</div>`;
}

function nutrToggleFavoriteInline(foodJson){
  const food=typeof foodJson==='string'?JSON.parse(foodJson):foodJson;
  const newFav=!food.is_favorite;
  // Update in-memory state
  const idx=nutr.foodHistory.findIndex(h=>h.id===food.id||h.name===food.name);
  if(idx>=0)nutr.foodHistory[idx]={...nutr.foodHistory[idx],is_favorite:newFav};
  nutr.foodFavorites=nutr.foodHistory.filter(h=>h.is_favorite);
  nutrRenderRecentsPanel();
  // Persist
  if(food.id){
    fetch('/api/nutrition-food?type=history&id='+food.id,{method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({is_favorite:newFav})}).catch(()=>{});
  }else{
    const aid=currentAthlete?.id||'';
    fetch('/api/nutrition-food?type=history',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({athlete_id:aid,name:food.name,per100g:food.per100g,serving_size:food.serving_size||100,
        serving_unit:food.serving_unit||'g',is_favorite:newFav,set_favorite:true})}).catch(()=>{});
  }
}

function nutrModalSearchInput(val){
  nutr.searchQuery=val;
  if(nutr.searchTimer)clearTimeout(nutr.searchTimer);
  const rp=document.getElementById('nutrRecentsPanel');
  if(rp)rp.style.display=val?'none':'';
  if(!val||val.length<2){
    nutr.searchResults=[];nutr.searchError='';
    nutrUpdateSearchResults();
    return;
  }
  nutr.searchError='';
  const parsed=nutrParseSearchInput(val);
  nutr.parsedQty=parsed.qty;nutr.parsedUnit=parsed.unit;
  const foodTerm=parsed.foodName||val;
  nutr.searchTimer=setTimeout(async()=>{
    const aid=currentAthlete?.id||'';
    const[usdaRaw,histRaw]=await Promise.all([
      fetch('/api/nutrition-food?q='+encodeURIComponent(foodTerm)).then(async r=>{
        const d=await r.json();
        if(!r.ok||d.error){nutr.searchError=d.error||('Search failed (HTTP '+r.status+')');return[];}
        return d;
      }).catch(e=>{nutr.searchError='Search unavailable: '+e.message;return[];}),
      fetch('/api/nutrition-food?type=history&q='+encodeURIComponent(foodTerm)+'&athlete_id='+aid).then(async r=>{
        const d=await r.json();return r.ok?d:[];
      }).catch(()=>[]),
    ]);
    const hf=(histRaw||[]).map(h=>({...h,fromHistory:true}));
    const uf=(usdaRaw||[]).filter(u=>!hf.some(h=>h.name.toLowerCase()===u.name.toLowerCase()));
    nutr.searchResults=[...hf,...uf];
    nutrUpdateSearchResults();
    // Never auto-select — user must tap a result to reach the confirm screen
  },300);
}

function nutrSelectFoodObj(jsonStr){
  nutr.selectedFood=JSON.parse(jsonStr);
  const f=nutr.selectedFood;
  // Use NLP-parsed qty if available, else food's serving_size
  nutr.foodQty=nutr.parsedQty?String(nutr.parsedQty):String(f.serving_size||100);
  nutr.foodUnit=nutr.parsedUnit||(f.serving_unit||'g');
  nutr.foodOverrides={};nutr.barcodeWarning='';
  nutrRenderConfirm();
}
function nutrClearFoodModal(){
  nutr.selectedFood=null;nutr.foodQty='';nutr.foodUnit='g';
  nutr.foodOverrides={};nutr.searchResults=[];nutr.searchQuery='';nutr.searchError='';
  nutr.parsedQty=null;nutr.parsedUnit=null;nutr.barcodeWarning='';
  nutrRenderFoodModal();
}
function nutrSetFoodQty(v){nutr.foodQty=v;nutr.foodOverrides={};nutrRenderConfirm();}
function nutrSetFoodUnit(v){nutr.foodUnit=v;nutr.foodOverrides={};nutrRenderConfirm();}
function nutrSetOverride(macro,val){nutr.foodOverrides[macro]=Number(val);}

async function nutrAddFoodFromModal(){
  if(!nutr.selectedFood||!nutr.foodQty)return;
  const f=nutr.selectedFood,qty=nutr.foodQty,unit=nutr.foodUnit,ov={...nutr.foodOverrides};
  const mult=nutrCalcMult(qty,unit,nutrEffectiveServingSize(f));
  const entry={id:crypto.randomUUID(),windowId:nutr.foodModalWindow||'unassigned',name:f.name,qty,unit,
    calories:ov.calories??Math.round((f.per100g?.calories||0)*mult),
    carbs:ov.carbs??Math.round((f.per100g?.carbs||0)*mult),
    protein:ov.protein??Math.round((f.per100g?.protein||0)*mult),
    fat:ov.fat??Math.round((f.per100g?.fat||0)*mult)};
  nutr.foodEntries=[...nutr.foodEntries,entry];
  const aid=currentAthlete?.id||'';
  const histBody={athlete_id:aid,name:entry.name,
    per100g:nutr.selectedFood?nutr.selectedFood.per100g:{carbs:entry.carbs,protein:entry.protein,fat:entry.fat,calories:entry.calories},
    serving_size:nutr.selectedFood?(nutr.selectedFood.serving_size||100):100,
    serving_unit:nutr.selectedFood?(nutr.selectedFood.serving_unit||'g'):'g'};
  console.log('HISTORY POST sending:', JSON.stringify(histBody));
  fetch('/api/nutrition-food?type=history',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(histBody)}).then(function(r){return r.json();}).then(function(d){console.log('HISTORY POST response:', JSON.stringify(d));}).catch(function(e){console.error('HISTORY POST error:',e);});
  if(nutr.saveAsCombo&&nutr.comboName){
    fetch('/api/nutrition-food?type=history',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({athlete_id:aid,name:nutr.comboName,per100g:nutr.selectedFood?.per100g||{},
        serving_size:nutr.selectedFood?.serving_size||100,serving_unit:nutr.selectedFood?.serving_unit||'g',
        is_combo:true,combo_name:nutr.comboName})}).catch(()=>{});
  }
  console.log('SAVE CALLED FROM:', new Error().stack);
  nutrSaveTodayLog();
  nutrCloseFoodModal();
}

async function nutrAddCombo(comboId){
  const c=nutr.combos.find(x=>x.id===comboId);if(!c)return;
  nutr.selectedFood={...c,name:c.combo_name||c.name};
  nutr.foodQty=String(c.serving_size||100);nutr.foodUnit='g';nutr.foodOverrides={};nutr.barcodeWarning='';
  nutrRenderConfirm();
}

function nutrRemoveFood(id){
  nutr.foodEntries=nutr.foodEntries.filter(e=>e.id!==id);
  nutrSaveTodayLog();
  if(nutr.sub==='weightlog') nutrRenderWeightLog();
  else{nutr.sessionsRendered=false;nutrRenderToday();}
}

async function nutrSaveTodayLog(){
  if(!currentAthlete?.id)return;
  const today=nutrTodayStr();
  const _dayResult=calcDayTargets(today,nutr.profile,nutr.weekWorkouts,allActivities);
  const adjCarbs=Math.max(_dayResult.carbs,_dayResult.carbs+nutrAdjTotal());
  const adjKcal=adjCarbs*4+_dayResult.protein*4+_dayResult.fat*9;
  const _eC=nutr.foodEntries.reduce((s,e)=>s+(e.carbs||0),0);
  const _eP=nutr.foodEntries.reduce((s,e)=>s+(e.protein||0),0);
  const _eF=nutr.foodEntries.reduce((s,e)=>s+(e.fat||0),0);
  const eaten={carbs:_eC,protein:_eP,fat:_eF,kcal:_eC*4+_eP*4+_eF*9};
  const payload={
    athlete_id:currentAthlete.id,log_date:today,
    food_entries:nutr.foodEntries,
    sessions:nutr.foodEntries,
    target_carbs:adjCarbs,target_protein:_dayResult.protein,target_fat:_dayResult.fat,target_kcal:adjKcal,
    actual_carbs:eaten.carbs||null,actual_protein:eaten.protein||null,actual_fat:eaten.fat||null,actual_kcal:eaten.kcal||null,
    intent:_dayResult.intent.label,
  };
  console.log('[FuelPro SAVE] athlete_id:', currentAthlete.id);
  console.log('[FuelPro SAVE] payload:', JSON.parse(JSON.stringify(payload)));
  fetch('/api/nutrition-data?type=log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(async r=>{
      const text=await r.text();
      let d;try{d=JSON.parse(text);}catch{d=null;}
      console.log('[FuelPro SAVE] HTTP status:', r.status);
      console.log('[FuelPro SAVE] response body:', d??text);
      if(r.ok&&d&&!d.error){
        console.log('[FuelPro SAVE] ✅ food_entries in response:', d.food_entries);
        nutrShowSavedFlash();
      }else{
        console.error('[FuelPro SAVE] ❌ FAILED — error:', d?.error, '| full response:', d??text);
      }
    }).catch(e=>console.error('[FuelPro SAVE] ❌ fetch threw:', e));
}

function nutrShowSavedFlash(){
  let el=document.getElementById('nutrSavedFlash');
  if(!el){
    el=document.createElement('div');
    el.id='nutrSavedFlash';
    el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#639922;color:#fff;font-family:\'DM Mono\',monospace;font-size:11px;padding:6px 16px;border-radius:4px;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s';
    document.body.appendChild(el);
  }
  el.textContent='Saved';
  el.style.opacity='1';
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.style.opacity='0';},1500);
}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — BARCODE SCANNER
// ═══════════════════════════════════════════════════════════════════
function nutrOpenBarcode(windowId){
  nutr.foodModalWindow=windowId||nutr.foodModalWindow;
  document.getElementById('nutrFoodModal').classList.remove('show');
  document.getElementById('nutrBarcodeModal').style.display='flex';
  nutrStartBarcodeScanner();
}
let _nutrScanner=null;
function nutrStartBarcodeScanner(){
  if(typeof Html5Qrcode==='undefined'){
    const s=document.createElement('script');
    s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload=()=>nutrInitScanner();document.head.appendChild(s);
  }else{nutrInitScanner();}
}
function nutrInitScanner(){
  const divId='nutrScannerDiv';
  _nutrScanner=new Html5Qrcode(divId);
  Html5Qrcode.getCameras().then(cameras=>{
    if(!cameras?.length){document.getElementById('nutrScanError').textContent='No camera found';return;}
    const back=cameras.find(c=>/(back|rear|environment)/i.test(c.label));
    const camId=back?back.id:cameras[cameras.length-1].id;
    _nutrScanner.start(camId,{fps:10,qrbox:{width:300,height:200}},async barcode=>{
      await _nutrScanner.stop().catch(()=>{});
      document.getElementById('nutrBarcodeModal').style.display='none';
      const r=await fetch('/api/nutrition-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({barcode})});
      const food=await r.json();
      if(food.error){alert('Product not found — try searching manually');nutrOpenFoodModal(nutr.foodModalWindow);return;}
      // Calorie sanity check: protein*4 + carbs*4 + fat*9 should be within 10% of stated calories
      const p=food.per100g;
      if(p){
        const computed=Math.round((p.protein||0)*4+(p.carbs||0)*4+(p.fat||0)*9);
        const stated=p.calories||0;
        if(stated>0&&Math.abs(computed-stated)/stated>0.10){
          nutr.barcodeWarning=`Barcode data may be inaccurate — calculated ${computed} kcal from macros but label says ${stated} kcal`;
        }
      }
      nutr.selectedFood=food;nutr.foodQty=String(food.serving_size||100);nutr.foodUnit=food.serving_unit||'g';nutr.foodOverrides={};
      document.getElementById('nutrFoodModal').classList.add('show');
      document.getElementById('nutrFoodModalOverlay').classList.add('show');
      document.body.style.overflow='hidden';
      nutrRenderConfirm();
    },()=>{});
  }).catch(()=>{document.getElementById('nutrScanError').textContent='Camera access denied';});
}
function nutrCloseBarcode(){
  if(_nutrScanner?.isScanning)_nutrScanner.stop().catch(()=>{});
  document.getElementById('nutrBarcodeModal').style.display='none';
}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — WEEK TAB
// ═══════════════════════════════════════════════════════════════════
function nutrRenderWeek(){
  const el=document.getElementById('nutr-week');
  const wb=nutrGetWeekBounds();
  const tsb=nutr.wellness?.form??null;
  function sportClass2(s){
    s=(s||'').toLowerCase();
    if(/ride|cycl|virtual|bike/.test(s))return'cycling';
    if(/run|jog|treadmill|trail/.test(s))return'running';
    if(/swim|pool|open.?water/.test(s))return'swimming';
    if(/strength|weight|gym|lift/.test(s))return'strength';
    return'other';
  }
  function sameWeekSport(plannedSport,actType){
    const pc=sportClass2(plannedSport),ac=sportClass2(actType);
    if(pc==='other'||ac==='other') return pc===ac; // don't cross-match unknowns
    return pc===ac;
  }
  const weekResults=wb.dates.map(date=>calcDayTargets(date,nutr.profile,nutr.weekWorkouts,allActivities));
  const maxCarbs=Math.max(1,...weekResults.map(r=>r.carbs+r.intra));
  const sel=nutr.weekSelectedDay;

  function sportDot(s){return /ride|cycl|virtual|bike/i.test(s)?'#378ADD':/run|jog/i.test(s)?'#639922':/swim/i.test(s)?'#1D9E75':'var(--acc)';}
  // Bar chart
  const barsHtml=wb.dates.map((date,i)=>{
    const r=weekResults[i];
    const total=r.carbs+r.intra;
    const pct=Math.round(total/maxCarbs*100);
    const isToday=date===nutrTodayStr();
    const barColor=r.intent.cls==='nutr-intent-yellow'?'#E24B4A':r.intent.cls==='nutr-intent-green'?'#639922':'#378ADD';
    const dayWos=(nutr.weekWorkouts||[]).filter(w=>w.date===date);
    const dayActs=(allActivities||[]).filter(a=>(a.start_date_local||'').startsWith(date));
    // dot indicators: filled=completed, outlined=planned only
    const dots=dayWos.length
      ?dayWos.map(w=>`<span style="width:5px;height:5px;border-radius:50%;border:1px solid ${sportDot(w.sport||'')};display:inline-block;margin:0 1px"></span>`).join('')
      :dayActs.map(a=>`<span style="width:5px;height:5px;border-radius:50%;background:${sportDot(a.sport_type||a.type||'')};display:inline-block;margin:0 1px"></span>`).join('');
    return `<div class="nutr-week-bar-col${i===sel?' selected':''}" onclick="nutrSelectWeekDay(${i})">
      <div class="nutr-week-bar-track">
        <div class="nutr-week-bar-fill" style="height:${pct}%;background:${barColor};opacity:${i===sel?1:0.55}"></div>
      </div>
      <div class="nutr-week-bar-label" style="${isToday?'color:var(--acc)':''}">${NUTR_DAYS[i]}</div>
      <div style="display:flex;justify-content:center;align-items:center;min-height:9px;margin-top:2px">${dots}</div>
      <div class="nutr-week-bar-val" style="color:${barColor}">${total}g</div>
    </div>`;
  }).join('');

  // Selected day detail
  const sr=weekResults[sel];
  const selDate=wb.dates[sel];
  const wos=(nutr.weekWorkouts||[]).filter(w=>w.date===selDate);
  const selActs=(allActivities||[]).filter(a=>(a.start_date_local||'').startsWith(selDate));
  function sportColor(s){return /cycl|bike|ride|virtual/i.test(s)?'#378ADD':/run|jog/i.test(s)?'#639922':/swim/i.test(s)?'#1D9E75':'var(--acc)';}
  const sessRows=nutrBuildSessionPillsHtml(wos,selActs)||`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc3)">Rest day</div>`;

  const srcLabel=sr.source==='actual'?`<span style="font-family:'DM Mono',monospace;font-size:9px;color:#639922;text-transform:uppercase;letter-spacing:0.06em">ACTUAL</span>`:sr.source==='live'?`<span style="font-family:'DM Mono',monospace;font-size:9px;color:#c8f036;text-transform:uppercase;letter-spacing:0.06em">LIVE</span>`:`<span style="font-family:'DM Mono',monospace;font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.06em">PREDICTED</span>`;
  const weekMode=parseInt(nutr.profile.mode)||0;
  const weekWkly=nutr.profile.weekly_loss_target||0.5;
  const dayDetail=`<div class="nutr-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;text-transform:uppercase">${NUTR_DAYS[sel]} — ${wb.dates[sel]}</div>
        ${srcLabel}
      </div>
      <span class="nutr-intent ${sr.intent.cls}">${sr.intent.label}</span>
    </div>
    <div style="font-family:'DM Mono',monospace;font-size:9px;color:#555;margin-bottom:10px;line-height:1.5">
      BMR: ${sr.bmr} + NEAT: ${sr.neat} + Exercise: ${sr.exercise} = ${sr.tdee}${sr.intent.label==='CUT DAY'?` − ${Math.round(weekWkly*500)} (cut day)`:weekMode===2?' + 300 (build)':''}
      = <span style="color:#c8f036;font-weight:700">${sr.tdeeTarget} kcal target</span>
    </div>
    ${sessRows}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:14px">
      <div style="text-align:center;background:var(--bc3);border:1px solid var(--border);padding:10px 6px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:#639922">${sr.protein}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3);text-transform:uppercase">Protein g</div>
      </div>
      <div style="text-align:center;background:var(--bc3);border:1px solid var(--border);padding:10px 6px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:#378ADD">${sr.fat}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3);text-transform:uppercase">Fat g</div>
      </div>
      <div style="text-align:center;background:var(--bc3);border:1px solid var(--border);padding:10px 6px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:#E24B4A">${sr.carbs+sr.intra}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3);text-transform:uppercase">Carbs g</div>
      </div>
      <div style="text-align:center;background:var(--bc3);border:1px solid var(--border);padding:10px 6px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:var(--tc)">${sr.kcal.toLocaleString()}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--tc3);text-transform:uppercase">kcal</div>
      </div>
    </div>
    <div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
      <div><div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">PRE-SESSION</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:#c8f036">${sr.pre}g</div></div>
      <div><div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">INTRA</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:#c8f036">${sr.intra}g</div></div>
      <div><div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">POST PROTEIN</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:#639922">${sr.post}g</div></div>
    </div>
  </div>`;

  el.innerHTML=`<div class="nutr-week-bars">${barsHtml}</div>${dayDetail}`;
}

function nutrSelectWeekDay(i){nutr.weekSelectedDay=i;nutrRenderWeek();}

// ═══════════════════════════════════════════════════════════════════
// FUELPRO — PROFILE TAB (weight log + nutrition settings)
// ═══════════════════════════════════════════════════════════════════
function nutrRenderProfile(){
  const el=document.getElementById('nutr-profile');
  if(!el)return;
  const p=nutr.profile;
  const currentWt=(nutr.weightLogs||[])[0]?.weight_lbs||p.weight_lbs||0;
  const goalWt=p.goal_weight_lbs||0;
  const goalDate=p.goal_date||'';
  // Auto-calculate weekly loss target
  let weeklyCalc='—';
  if(goalDate&&currentWt&&goalWt){
    const msPerWeek=7*24*60*60*1000;
    const weeksLeft=(new Date(goalDate)-new Date())/msPerWeek;
    const tolose=Number(currentWt).toFixed(1)-Number(goalWt).toFixed(1);
    if(weeksLeft>0&&tolose>0) weeklyCalc=(tolose/weeksLeft).toFixed(2)+' lbs/week';
    else if(weeksLeft<=0) weeklyCalc='Goal date passed';
    else weeklyCalc='Already at/below goal';
  }
  el.innerHTML=`
    <div class="nutr-card">
      <div class="section-label" style="margin-top:0;margin-bottom:12px">Nutrition profile</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div>
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Age</label>
          <input type="number" class="nutr-input" value="${currentAthlete?.age||''}" placeholder="e.g. 32" min="10" max="100" onchange="if(!currentAthlete)currentAthlete={};currentAthlete.age=Number(this.value)">
        </div>
        <div>
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Experience level</label>
          <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--tc);padding:10px 12px;background:var(--bc3);border:1px solid var(--border)">${currentAthlete?.experience_level||'intermediate'} <span style="color:#555;font-size:10px">(set in Profile tab)</span></div>
        </div>
        <div>
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Daily Activity</label>
          <select class="nutr-select" style="width:100%" onchange="if(!currentAthlete)currentAthlete={};currentAthlete.activity_level=this.value">
            <option value="desk"${(currentAthlete?.activity_level||'light')==='desk'?' selected':''}>Desk job / mostly sitting</option>
            <option value="light"${(currentAthlete?.activity_level||'light')==='light'?' selected':''}>Light activity / on feet sometimes</option>
            <option value="active"${(currentAthlete?.activity_level||'')==='active'?' selected':''}>Active job / on feet most of day</option>
            <option value="manual"${(currentAthlete?.activity_level||'')==='manual'?' selected':''}>Manual labor / very active job</option>
          </select>
        </div>
        <div style="grid-column:1/-1">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Mode</label>
          <select class="nutr-select" style="width:100%" onchange="nutr.profile.mode=Number(this.value)">
            <option value="1"${p.mode===1?' selected':''}>CUT — deficit on easy days</option>
            <option value="2"${p.mode===2?' selected':''}>MAINTAIN — match TDEE</option>
            <option value="3"${p.mode===3?' selected':''}>BUILD — surplus on hard days</option>
          </select>
        </div>
        <div>
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Goal weight (lbs)</label>
          <input type="number" class="nutr-input" value="${goalWt||''}" placeholder="e.g. 155" onchange="nutr.profile.goal_weight_lbs=Number(this.value);nutrRenderProfile()">
        </div>
        <div>
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Goal date</label>
          <input type="date" class="nutr-input" value="${goalDate}" onchange="nutr.profile.goal_date=this.value;nutrRenderProfile()">
        </div>
        <div style="grid-column:1/-1">
          <label style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px">Weekly loss target (auto-calculated)</label>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--acc);padding:10px 14px;background:var(--bc3);border:1px solid var(--border)">${weeklyCalc}</div>
        </div>
      </div>
      <button class="nutr-btn" style="width:100%;padding:13px;font-size:12px" onclick="nutrSaveProfile()">SAVE PROFILE</button>
      <div id="nutrProfileSaveMsg" style="font-family:'DM Mono',monospace;font-size:11px;color:#639922;margin-top:8px;display:none">Saved ✓</div>
    </div>`;
}

async function nutrSaveWeight(){
  if(!currentAthlete?.id||!nutr.newWeight)return;
  const now=new Date();
  const body={athlete_id:currentAthlete.id,log_date:nutrTodayStr(),logged_at:now.toISOString(),weight_lbs:Number(nutr.newWeight)};
  const r=await fetch('/api/nutrition-data?type=weight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();
  if(d.error){alert('Error: '+d.error);return;}
  const savedWt=Number(nutr.newWeight);
  console.log('[nutrSaveWeight] saving weight:', savedWt);
  nutr.newWeight='';
  // Update in-memory profile weight so W/kg recalculates immediately
  nutr.profile.weight_lbs=savedWt;
  console.log('[nutrSaveWeight] nutr.profile.weight_lbs updated to:', nutr.profile.weight_lbs);
  // Refresh weight log list
  nutr.weightLogs=await fetch('/api/nutrition-data?type=weight&athlete_id='+currentAthlete.id).then(r=>r.json()).catch(()=>[]);
  // Sync weight to athlete_profiles table
  const apResp=await fetch('/api/athlete-profile',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({athlete_id:currentAthlete.id,weight_lbs:savedWt})}).then(r=>r.json()).catch(e=>({error:e.message}));
  console.log('[nutrSaveWeight] athlete-profile update response:', apResp);
  // Sync to athlete profile form + W/kg banner in main dashboard
  const wtInp=document.getElementById('pf_weight_lbs');
  if(wtInp){wtInp.value=savedWt;if(typeof updateWkg==='function')updateWkg();}
  nutrRenderWeightLog();
  // Confirmation banner
  const el=document.getElementById('nutr-weightlog');
  if(el){
    const msg=document.createElement('div');
    msg.style.cssText='font-family:"DM Mono",monospace;font-size:11px;color:#639922;padding:8px 14px;background:#63992218;border:1px solid #63992244;margin-bottom:10px';
    msg.textContent='Weight logged and profile updated';
    el.prepend(msg);
    setTimeout(()=>msg.remove(),3000);
  }
}

async function nutrDeleteWeightLog(id){
  if(!id)return;
  const r=await fetch('/api/nutrition-data?type=weight&id='+id,{method:'DELETE'}).then(r=>r.json()).catch(()=>({error:'Network error'}));
  if(r.error){alert('Delete failed: '+r.error);return;}
  // Remove from in-memory list and DOM instantly
  nutr.weightLogs=nutr.weightLogs.filter(l=>String(l.id)!==String(id));
  const row=document.getElementById('wl-row-'+id);
  if(row)row.remove();
}

async function nutrSaveProfile(){
  if(!currentAthlete?.id)return;
  // Only send columns that exist in the profiles table
  const payload={
    athlete_id:currentAthlete.id,
    mode:nutr.profile.mode||1,
    goal_weight_lbs:nutr.profile.goal_weight_lbs||null,
    goal_date:nutr.profile.goal_date||null,
    protein_factor:nutr.profile.protein_factor||1.09,
    fat_floor:nutr.profile.fat_floor||85,
    fat_ceiling:nutr.profile.fat_ceiling||110,
    weekly_loss_target:nutr.profile.weekly_loss_target||0.5,
  };
  const r=await fetch('/api/nutrition-data?type=profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  if(d.error){alert('Error: '+d.error);return;}
  nutr.profile={...nutr.profile,...d};
  // Save age + activity_level to athlete_profiles
  if(currentAthlete?.id){
    const apPayload={athlete_id:currentAthlete.id};
    if(currentAthlete.age) apPayload.age=Number(currentAthlete.age);
    if(currentAthlete.activity_level) apPayload.activity_level=currentAthlete.activity_level;
    if(apPayload.age||apPayload.activity_level){
      const apRes=await fetch('/api/athlete-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apPayload)}).then(r=>r.json()).catch(()=>({}));
      // Persist to localStorage so TDEE calc uses updated values on next load
      if(!apRes.error){
        const stored=localStorage.getItem('hm2l_athlete');
        if(stored){try{const a=JSON.parse(stored);a.age=currentAthlete.age;a.activity_level=currentAthlete.activity_level;localStorage.setItem('hm2l_athlete',JSON.stringify(a));}catch(e){}}
      }
    }
  }
  const msg=document.getElementById('nutrProfileSaveMsg');
  if(msg){msg.style.display='block';setTimeout(()=>{msg.style.display='none';nutrRenderProfile();},2000);}
}

// kept for legacy callers — redirect to profile tab
function nutrRenderSettings(){ nutrRenderProfile(); }

// (Stats tab removed)
function nutrRenderHistory(){
  const el=document.getElementById('nutr-history');
  const logs=nutr.logHistory; // already excludes today, sorted desc
  if(!logs.length){
    el.innerHTML='<div class="nutr-card"><p style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--tc3)">No history yet. Food logged on the Today tab will appear here.</p></div>';
    return;
  }

  function macroOk(actual,target){
    if(!actual||!target)return null;
    const p=actual/target;return p>=0.9&&p<=1.1;
  }
  function dayCompliant(log){
    const checks=[macroOk(log.actual_carbs,log.target_carbs),macroOk(log.actual_protein,log.target_protein),macroOk(log.actual_fat,log.target_fat)].filter(v=>v!==null);
    return checks.length>0&&checks.every(Boolean);
  }
  function dotColor(log){
    const c=macroOk(log.actual_carbs,log.target_carbs);
    const p=macroOk(log.actual_protein,log.target_protein);
    const f=macroOk(log.actual_fat,log.target_fat);
    const checks=[c,p,f].filter(v=>v!==null);
    if(!checks.length)return'var(--tc3)';
    const pass=checks.filter(Boolean).length;
    if(pass===checks.length)return'#639922';
    if(pass===checks.length-1)return'#c8f036';
    return'#E24B4A';
  }

  // ── Weekly compliance (last 4 weeks) ──────────────────────────
  const sorted=[...logs].sort((a,b)=>a.log_date>b.log_date?1:-1);
  const today=nutrTodayStr();
  const weekRows=[];
  for(let w=0;w<4;w++){
    const wEnd=new Date(today);wEnd.setDate(wEnd.getDate()-w*7-1);
    const wStart=new Date(wEnd);wStart.setDate(wEnd.getDate()-6);
    const wS=_localStr(wStart),wE=_localStr(wEnd);
    const wLogs=sorted.filter(l=>l.log_date>=wS&&l.log_date<=wE);
    const logged=wLogs.length,compliant=wLogs.filter(dayCompliant).length;
    const pct=logged?Math.round(compliant/logged*100):null;
    weekRows.push({label:`Wk -${w+1}`,logged,compliant,pct});
  }
  const weeklyHtml=`<div class="nutr-card">
    <div class="section-label" style="margin-top:0;margin-bottom:12px">Weekly compliance</div>
    ${weekRows.map(w=>{
      const bar=w.pct!=null?`<div style="flex:1;background:var(--bc3);height:6px;border-radius:3px;overflow:hidden"><div style="height:100%;width:${w.pct}%;background:${w.pct>=80?'#639922':w.pct>=50?'#c8f036':'#E24B4A'};border-radius:3px"></div></div>`:`<div style="flex:1;background:var(--bc3);height:6px;border-radius:3px"></div>`;
      return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc3);width:40px">${w.label}</span>
        ${bar}
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc);width:36px;text-align:right">${w.pct!=null?w.pct+'%':'—'}</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">${w.compliant}/${w.logged}d</span>
      </div>`;
    }).join('')}
  </div>`;

  // ── Best streak ────────────────────────────────────────────────
  let streak=0,best=0,cur=0;
  sorted.forEach(l=>{if(dayCompliant(l)){cur++;best=Math.max(best,cur);}else cur=0;});
  // current streak from most recent
  const rev=[...sorted].reverse();
  for(const l of rev){if(dayCompliant(l))streak++;else break;}
  const streakHtml=`<div class="nutr-card">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:center">
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);margin-bottom:4px">CURRENT STREAK</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#c8f036">${streak}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">days</div>
      </div>
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);margin-bottom:4px">BEST STREAK</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#639922">${best}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3)">days</div>
      </div>
    </div>
  </div>`;

  // ── 30-day averages vs targets ─────────────────────────────────
  function avg(arr,key){const v=arr.filter(l=>l[key]!=null);return v.length?Math.round(v.reduce((s,l)=>s+l[key],0)/v.length):null;}
  const avgP=avg(logs,'actual_protein'),tgtP=avg(logs,'target_protein');
  const avgF=avg(logs,'actual_fat'),tgtF=avg(logs,'target_fat');
  const avgC=avg(logs,'actual_carbs'),tgtC=avg(logs,'target_carbs');
  const avgK=avg(logs,'actual_kcal'),tgtK=avg(logs,'target_kcal');
  function macroBar(label,actual,target,color){
    const pct=actual&&target?Math.min(Math.round(actual/target*100),130):0;
    const over=pct>105;
    return`<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:${color}">${label}</span>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc)">${actual!=null?actual+'g':'—'}<span style="color:var(--tc3)"> / ${target!=null?target+'g':'—'}</span></span>
      </div>
      <div style="background:var(--bc3);height:6px;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${over?'#E24B4A':color};border-radius:3px;transition:width 0.3s"></div>
      </div>
    </div>`;
  }
  const avgHtml=`<div class="nutr-card">
    <div class="section-label" style="margin-top:0;margin-bottom:12px">30-day averages</div>
    ${macroBar('Protein',avgP,tgtP,'#639922')}
    ${macroBar('Fat',avgF,tgtF,'#378ADD')}
    ${macroBar('Carbs',avgC,tgtC,'#E24B4A')}
    ${avgK!=null?`<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border)"><span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--tc3)">Avg Kcal</span><span style="font-family:'DM Mono',monospace;font-size:11px;color:#c8f036">${avgK} kcal<span style="color:var(--tc3)"> / ${tgtK||'—'}</span></span></div>`:''}
  </div>`;

  // ── Weight trend (mini chart) ───────────────────────────────────
  let weightHtml='';
  if(nutr.weightLogs.length>=2){
    const wl=[...nutr.weightLogs].sort((a,b)=>a.log_date>b.log_date?1:-1).slice(-14);
    const vals=wl.map(w=>w.weight_lbs);
    const mn=Math.min(...vals)-1,mx=Math.max(...vals)+1,rng=mx-mn||1;
    const W=260,H=60,pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*(W-20)+10)},${Math.round((1-(v-mn)/rng)*(H-10)+5)}`).join(' ');
    weightHtml=`<div class="nutr-card">
      <div class="section-label" style="margin-top:0;margin-bottom:8px">Weight trend</div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">
        <polyline points="${pts}" fill="none" stroke="#378ADD" stroke-width="2" stroke-linejoin="round"/>
        ${wl.map((w,i)=>`<circle cx="${Math.round(i/(vals.length-1)*(W-20)+10)}" cy="${Math.round((1-(w.weight_lbs-mn)/rng)*(H-10)+5)}" r="3" fill="#378ADD"/>`).join('')}
      </svg>
      <div style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:10px;color:var(--tc3);margin-top:4px">
        <span>${wl[0].log_date}</span><span>${vals[vals.length-1].toFixed(1)} lbs</span><span>${wl[wl.length-1].log_date}</span>
      </div>
    </div>`;
  }

  // ── Daily log (past 30) ────────────────────────────────────────
  function fmtMacro(actual,target,color){
    const a=actual!=null?Math.round(actual)+'g':'—';
    const t=target!=null?`<span style="color:var(--tc3)">/${Math.round(target)}g</span>`:'';
    return`<span style="color:${color}">${a}${t}</span>`;
  }
  const rows=logs.map(log=>{
    const dc=dotColor(log);
    const intFmt=log.intent?`<span class="nutr-intent ${log.intent==='FUEL UP'?'nutr-intent-yellow':log.intent==='CUT DAY'?'nutr-intent-blue':'nutr-intent-green'}">${log.intent}</span>`:'';
    return`<div class="nutr-hist-day">
      <div style="width:8px;height:8px;border-radius:50%;background:${dc};flex-shrink:0;margin-top:3px"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-weight:600;color:var(--tc);font-size:13px">${log.log_date}</span>${intFmt}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-family:'DM Mono',monospace;font-size:11px">
          <span>P: ${fmtMacro(log.actual_protein,log.target_protein,'#639922')}</span>
          <span>F: ${fmtMacro(log.actual_fat,log.target_fat,'#378ADD')}</span>
          <span>C: ${fmtMacro(log.actual_carbs,log.target_carbs,'#E24B4A')}</span>
          ${log.actual_kcal!=null?`<span style="color:var(--tc2)">${Math.round(log.actual_kcal)} kcal</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
  const logHtml=`<div class="nutr-card" style="padding:0;overflow:hidden">
    <div style="padding:14px 14px 10px;border-bottom:1px solid var(--border)"><div class="section-label" style="margin:0">Past 30 days</div></div>
    <div style="padding:4px 14px 14px">${rows}</div>
  </div>`;

  el.innerHTML=streakHtml+weeklyHtml+avgHtml+weightHtml+logHtml;
}

