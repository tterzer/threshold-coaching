window.PMC_SEED_DATE = '2026-01-01';
window.PMC_SEED_CTL = 75;
window.PMC_SEED_ATL = 67;

window.computeFitness = function(acts) {
  var tssByDay = {};
  (acts || []).forEach(function(a) {
    var day = (a.start_date_local || '').slice(0, 10);
    if (!day) return;
    tssByDay[day] = (tssByDay[day] || 0) + (Number(a.icu_training_load) || 0);
  });
  var series = [];
  var byDate = {};
  var today = new Date();
  today.setHours(0,0,0,0);
  var start = new Date(window.PMC_SEED_DATE + 'T00:00:00');
  var totalDays = Math.round((today - start) / 86400000) + 1;
  var ctlPrev = window.PMC_SEED_CTL;
  var atlPrev = window.PMC_SEED_ATL;
  for (var i = 0; i < totalDays; i++) {
    var d = new Date(start);
    d.setDate(start.getDate() + i);
    var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var tss = tssByDay[key] || 0;
    var ctl = ctlPrev * Math.exp(-1/42) + tss * (1 - Math.exp(-1/42));
    var atl = atlPrev * Math.exp(-1/7) + tss * (1 - Math.exp(-1/7));
    var tsb = ctlPrev - atl;
    var entry = {date: key, ctl: Math.round(ctl*10)/10, atl: Math.round(atl*10)/10, tsb: Math.round(tsb*10)/10};
    series.push(entry);
    byDate[key] = entry;
    ctlPrev = ctl;
    atlPrev = atl;
  }
  return {series: series, byDate: byDate};
};

window.getTier = function() {
  var t = (window.currentAthlete && window.currentAthlete.coaching_tier) || 'base';
  if (t === 'peak') return 3;
  if (t === 'build') return 2;
  return 1;
};

window.TIER_LOCK_HTML = '<div class="tier-lock"><div>Available on Build & Peak plans</div><a href="mailto:travis.terzer95@gmail.com">Contact Travis to upgrade</a></div>';

window.applyTierGating = function() {
  var tier = window.getTier();
  var fuelTab = document.querySelector('.dash-tab[data-dtab="nutrition"]');
  if (fuelTab) fuelTab.style.display = tier >= 3 ? '' : 'none';
  if (tier < 2) {
    ['sportCtlBox','loadRow','zoneRow'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el.querySelector('.tier-lock')) el.insertAdjacentHTML('beforeend', window.TIER_LOCK_HTML);
    });
  }
};
