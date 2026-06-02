// ─── State ────────────────────────────────────────────────────────────────────
var currentUser = null; // { email, name }
var appData = null;     // full getAll response
var currentView = null;
var refreshTimer = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────
function initAuth() {
  // Restore session from sessionStorage
  var saved = sessionStorage.getItem('user');
  if (saved) {
    currentUser = JSON.parse(saved);
    onSignedIn();
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onGoogleCredential,
    auto_select: false
  });

  google.accounts.id.renderButton(
    document.getElementById('sign-in-btn-container'),
    { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' }
  );
}

function onGoogleCredential(response) {
  var payload = parseJwt(response.credential);
  currentUser = { email: payload.email, name: payload.name || payload.email };
  sessionStorage.setItem('user', JSON.stringify(currentUser));
  onSignedIn();
}

function parseJwt(token) {
  var base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

function signOut() {
  google.accounts.id.disableAutoSelect();
  sessionStorage.removeItem('user');
  currentUser = null;
  appData = null;
  clearInterval(refreshTimer);
  showView('login');
  document.getElementById('app-header').style.display = 'none';
}

// ─── API ──────────────────────────────────────────────────────────────────────
function api(params) {
  if (currentUser) params.email = currentUser.email;
  var qs = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  return fetch(API_URL + '?' + qs, { redirect: 'follow' })
    .then(function(r) { return r.json(); });
}

function loadAll() {
  return api({ action: 'getAll' }).then(function(data) {
    appData = data;
    return data;
  });
}

// ─── View management ──────────────────────────────────────────────────────────
function showView(name) {
  ['login', 'leaderboard', 'score-entry', 'admin'].forEach(function(v) {
    var el = document.getElementById('view-' + v);
    if (el) el.style.display = v === name ? '' : 'none';
  });
  currentView = name;

  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
}

function onSignedIn() {
  document.getElementById('app-header').style.display = '';
  document.getElementById('user-name').textContent = currentUser.name;

  loadAll().then(function(data) {
    // Show/hide nav items based on role
    var isAdmin = data.userRole === 'admin';
    var isEvaluator = data.userRole === 'evaluator' || isAdmin;
    document.getElementById('tab-score').style.display = isEvaluator ? '' : 'none';
    document.getElementById('tab-admin').style.display = isAdmin ? '' : 'none';

    if (data.userRole === 'none') {
      showView('leaderboard');
      showMsg('Tu correo no está asignado a ninguna sesión. Contacta al administrador.');
    } else {
      showView('leaderboard');
    }

    renderLeaderboard();
    startAutoRefresh();
  });
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(function() {
    if (currentView === 'leaderboard') {
      loadAll().then(renderLeaderboard);
    }
  }, 60000);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function renderLeaderboard() {
  if (!appData) return;
  var teams = appData.teams;
  var wsMap = {};
  appData.workshopScores.forEach(function(s) {
    wsMap[s.teamId] = (wsMap[s.teamId] || 0) + s.total;
  });
  var initMap = {};
  appData.initiativeScores.forEach(function(s) {
    initMap[s.teamId] = s.score;
  });

  var rows = teams.map(function(t) {
    var ws = wsMap[t.id] || 0;
    var init = initMap[t.id] || 0;
    var total = ws + init;
    return { team: t, ws: ws, init: init, total: total };
  }).sort(function(a, b) { return b.total - a.total; });

  var maxTotal = rows.length > 0 ? rows[0].total : 0;

  var tbody = document.getElementById('leaderboard-tbody');
  tbody.innerHTML = '';
  rows.forEach(function(r, idx) {
    var tier = getPrizeTier(r.total);
    var special = r.total > 0 && r.total === maxTotal && rows.filter(function(x) { return x.total === maxTotal; }).length === 1;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="rank">' + (idx + 1) + '</td>' +
      '<td class="team-name">' + esc(r.team.name) + (special ? ' <span class="special-badge" title="Premio especial">★</span>' : '') + '</td>' +
      '<td class="pts">' + r.ws + '</td>' +
      '<td class="pts">' + r.init + '</td>' +
      '<td class="pts total">' + r.total + '</td>' +
      '<td><span class="tier-badge ' + tier.css + '">' + tier.label + '</span></td>';
    tbody.appendChild(tr);
  });

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Sin equipos aún</td></tr>';
  }

  document.getElementById('leaderboard-updated').textContent =
    'Actualizado: ' + new Date().toLocaleTimeString('es');
}

// ─── Score Entry ───────────────────────────────────────────────────────────────
function initScoreEntry() {
  if (!appData) return;
  var sessions = appData.assignedSessions || [];
  var select = document.getElementById('session-select');
  select.innerHTML = '';

  sessions.forEach(function(s) {
    var opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s === 10 ? 'Iniciativa Final' : 'Taller ' + s;
    select.appendChild(opt);
  });

  if (sessions.length > 0) renderScoreForm(sessions[0]);
}

function renderScoreForm(session) {
  var container = document.getElementById('score-form-container');
  session = parseInt(session, 10);
  var isInitiative = session === 10;

  if (appData.teams.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay equipos registrados.</p>';
    return;
  }

  var html = '<table class="score-table"><thead><tr>' +
    '<th>Equipo</th>' +
    (isInitiative
      ? '<th>Puntaje Iniciativa (0-370)</th>'
      : '<th>Asistentes</th><th>Nota (1-10)</th><th>Días de retraso</th><th>Vista previa</th>') +
    '<th></th></tr></thead><tbody>';

  appData.teams.forEach(function(team) {
    var existing = isInitiative
      ? (appData.initiativeScores.find(function(s) { return s.teamId === team.id; }) || {})
      : (appData.workshopScores.find(function(s) { return s.teamId === team.id && s.session === session; }) || {});

    html += '<tr data-team-id="' + team.id + '" data-session="' + session + '">';
    html += '<td class="team-cell"><strong>' + esc(team.name) + '</strong><br><small>' + team.memberCount + ' integrantes</small></td>';

    if (isInitiative) {
      html += '<td><input type="number" class="input-initiative" min="0" max="370" value="' + (existing.score || '') + '" placeholder="0-370"></td>';
    } else {
      html +=
        '<td><input type="number" class="input-attendees" min="0" max="' + team.memberCount + '" value="' + (existing.attendees || '') + '" placeholder="0-' + team.memberCount + '"></td>' +
        '<td><select class="input-grade">' + gradeOptions(existing.grade || 0) + '</select></td>' +
        '<td><input type="number" class="input-days" min="0" value="' + (existing.daysLate || 0) + '"></td>' +
        '<td class="preview-cell">' + (existing.total ? '<strong>' + existing.total + ' pts</strong>' : '--') + '</td>';
    }
    html += '<td><button class="btn-save-row btn-primary btn-sm">Guardar</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Live preview update
  container.querySelectorAll('tr[data-team-id]').forEach(function(row) {
    var teamId = row.dataset.teamId;
    var team = appData.teams.find(function(t) { return t.id === teamId; });
    if (!team || isInitiative) return;

    function updatePreview() {
      var att = parseFloat(row.querySelector('.input-attendees').value) || 0;
      var grade = parseInt(row.querySelector('.input-grade').value, 10) || 0;
      var days = parseInt(row.querySelector('.input-days').value, 10) || 0;
      var attPts = calcAttendance(att, team.memberCount);
      var total = grade > 0 ? calcWorkshopTotal(attPts, grade, days) : '--';
      row.querySelector('.preview-cell').innerHTML = total !== '--' ? '<strong>' + total + ' pts</strong>' : '--';
    }

    row.querySelector('.input-attendees').addEventListener('input', updatePreview);
    row.querySelector('.input-grade').addEventListener('change', updatePreview);
    row.querySelector('.input-days').addEventListener('input', updatePreview);
  });

  // Save row
  container.querySelectorAll('.btn-save-row').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var row = btn.closest('tr');
      var teamId = row.dataset.teamId;
      var session = parseInt(row.dataset.session, 10);
      var team = appData.teams.find(function(t) { return t.id === teamId; });
      var isInit = session === 10;

      if (isInit) {
        var score = parseInt(row.querySelector('.input-initiative').value, 10);
        if (isNaN(score) || score < 0 || score > 370) {
          alert('Puntaje debe estar entre 0 y 370');
          return;
        }
        btn.disabled = true;
        api({ action: 'saveInitiativeScore', teamId: teamId, score: score }).then(function(res) {
          btn.disabled = false;
          if (res.error) { alert(res.error); return; }
          var idx = appData.initiativeScores.findIndex(function(s) { return s.teamId === teamId; });
          var entry = { teamId: teamId, score: score, submittedBy: currentUser.email };
          if (idx === -1) appData.initiativeScores.push(entry); else appData.initiativeScores[idx] = entry;
          showSaved(btn);
        });
      } else {
        var att = parseFloat(row.querySelector('.input-attendees').value) || 0;
        var grade = parseInt(row.querySelector('.input-grade').value, 10);
        var days = parseInt(row.querySelector('.input-days').value, 10) || 0;
        if (!grade) { alert('Selecciona una nota'); return; }
        var attPts = calcAttendance(att, team.memberCount);
        var total = calcWorkshopTotal(attPts, grade, days);
        btn.disabled = true;
        api({ action: 'saveWorkshopScore', teamId: teamId, session: session, attendees: att, grade: grade, daysLate: days, total: total }).then(function(res) {
          btn.disabled = false;
          if (res.error) { alert(res.error); return; }
          var key = function(s) { return s.teamId === teamId && s.session === session; };
          var idx = appData.workshopScores.findIndex(key);
          var entry = { teamId: teamId, session: session, attendees: att, grade: grade, daysLate: days, total: total };
          if (idx === -1) appData.workshopScores.push(entry); else appData.workshopScores[idx] = entry;
          row.querySelector('.preview-cell').innerHTML = '<strong>' + total + ' pts</strong>';
          showSaved(btn);
        });
      }
    });
  });
}

function gradeOptions(selected) {
  var html = '<option value="0">-- nota --</option>';
  for (var i = 1; i <= 10; i++) {
    html += '<option value="' + i + '"' + (i === selected ? ' selected' : '') + '>' + i + ' (' + gradeToPoints(i) + ' pts)</option>';
  }
  return html;
}

function showSaved(btn) {
  btn.textContent = '✓ Guardado';
  btn.classList.add('btn-saved');
  setTimeout(function() { btn.textContent = 'Guardar'; btn.classList.remove('btn-saved'); }, 2000);
}

// ─── Admin: Teams ─────────────────────────────────────────────────────────────
var editingTeamId = null;

function renderTeamsAdmin() {
  var tbody = document.getElementById('teams-tbody');
  tbody.innerHTML = '';
  appData.teams.forEach(function(t) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(t.name) + '</td>' +
      '<td>' + t.memberCount + '</td>' +
      '<td>' +
        '<button class="btn-sm btn-secondary" onclick="editTeam(\'' + t.id + '\')">Editar</button> ' +
        '<button class="btn-sm btn-danger" onclick="deleteTeamConfirm(\'' + t.id + '\',\'' + esc(t.name) + '\')">Eliminar</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

function editTeam(id) {
  var team = appData.teams.find(function(t) { return t.id === id; });
  if (!team) return;
  editingTeamId = id;
  document.getElementById('team-name').value = team.name;
  document.getElementById('team-size').value = team.memberCount;
  document.getElementById('team-form-title').textContent = 'Editar Equipo';
  document.getElementById('cancel-team-btn').style.display = '';
  document.getElementById('team-name').focus();
}

function cancelTeamEdit() {
  editingTeamId = null;
  document.getElementById('team-name').value = '';
  document.getElementById('team-size').value = '';
  document.getElementById('team-form-title').textContent = 'Nuevo Equipo';
  document.getElementById('cancel-team-btn').style.display = 'none';
}

function saveTeam() {
  var name = document.getElementById('team-name').value.trim();
  var size = parseInt(document.getElementById('team-size').value, 10);
  if (!name) { alert('Escribe el nombre del equipo'); return; }
  if (!size || size < 1) { alert('Número de integrantes inválido'); return; }

  var params = editingTeamId
    ? { action: 'updateTeam', teamId: editingTeamId, name: name, memberCount: size }
    : { action: 'saveTeam', name: name, memberCount: size };

  document.getElementById('save-team-btn').disabled = true;
  api(params).then(function(res) {
    document.getElementById('save-team-btn').disabled = false;
    if (res.error) { alert(res.error); return; }
    return loadAll();
  }).then(function() {
    renderTeamsAdmin();
    cancelTeamEdit();
  });
}

function deleteTeamConfirm(id, name) {
  if (!confirm('¿Eliminar el equipo "' + name + '"? Se borrarán todas sus calificaciones.')) return;
  api({ action: 'deleteTeam', teamId: id }).then(function(res) {
    if (res.error) { alert(res.error); return; }
    return loadAll();
  }).then(function() { renderTeamsAdmin(); });
}

// ─── Admin: Evaluators ────────────────────────────────────────────────────────
function renderEvaluatorsAdmin() {
  // Build session checkboxes
  var checksDiv = document.getElementById('session-checkboxes');
  checksDiv.innerHTML = '';
  for (var s = 1; s <= WORKSHOP_COUNT + 1; s++) {
    var label = s <= WORKSHOP_COUNT ? 'Taller ' + s : 'Iniciativa';
    checksDiv.innerHTML +=
      '<label class="check-label"><input type="checkbox" class="session-check" value="' + s + '"> ' + label + '</label>';
  }

  var tbody = document.getElementById('evaluators-tbody');
  tbody.innerHTML = '';
  (appData.evaluatorAssignments || []).forEach(function(ea) {
    var sessionLabels = ea.sessions.map(function(s) { return s <= WORKSHOP_COUNT ? 'T' + s : 'Init'; }).join(', ');
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(ea.email) + '</td>' +
      '<td>' + sessionLabels + '</td>' +
      '<td><button class="btn-sm btn-danger" onclick="deleteEvaluator(\'' + esc(ea.email) + '\')">Eliminar</button></td>';
    tbody.appendChild(tr);
  });
}

function saveEvaluatorAssignment() {
  var email = document.getElementById('evaluator-email').value.trim().toLowerCase();
  if (!email) { alert('Ingresa un correo electrónico'); return; }
  var checks = document.querySelectorAll('.session-check:checked');
  if (checks.length === 0) { alert('Selecciona al menos una sesión'); return; }
  var sessions = Array.from(checks).map(function(c) { return c.value; }).join(',');

  document.getElementById('save-evaluator-btn').disabled = true;
  api({ action: 'saveEvaluatorAssignment', targetEmail: email, sessions: sessions }).then(function(res) {
    document.getElementById('save-evaluator-btn').disabled = false;
    if (res.error) { alert(res.error); return; }
    document.getElementById('evaluator-email').value = '';
    document.querySelectorAll('.session-check').forEach(function(c) { c.checked = false; });
    return loadAll();
  }).then(function() { renderEvaluatorsAdmin(); });
}

function deleteEvaluator(email) {
  if (!confirm('¿Eliminar asignación de ' + email + '?')) return;
  api({ action: 'deleteEvaluatorAssignment', targetEmail: email }).then(function(res) {
    if (res.error) { alert(res.error); return; }
    return loadAll();
  }).then(function() { renderEvaluatorsAdmin(); });
}

// ─── Admin: Scores matrix ─────────────────────────────────────────────────────
function renderScoresMatrix() {
  var container = document.getElementById('scores-grid-container');
  if (!appData || appData.teams.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin equipos.</p>';
    return;
  }

  var wsMap = {};
  appData.workshopScores.forEach(function(s) {
    wsMap[s.teamId + '_' + s.session] = s.total;
  });
  var initMap = {};
  appData.initiativeScores.forEach(function(s) {
    initMap[s.teamId] = s.score;
  });

  var headers = '<th>Equipo</th>';
  for (var s = 1; s <= WORKSHOP_COUNT; s++) headers += '<th>T' + s + '</th>';
  headers += '<th>Init</th><th>Total</th><th>Premio</th>';

  var rows = '';
  appData.teams.forEach(function(t) {
    var workshopSum = 0;
    var cells = '';
    for (var i = 1; i <= WORKSHOP_COUNT; i++) {
      var pts = wsMap[t.id + '_' + i];
      cells += '<td class="pts">' + (pts !== undefined ? pts : '--') + '</td>';
      workshopSum += pts || 0;
    }
    var init = initMap[t.id];
    var total = workshopSum + (init || 0);
    var tier = getPrizeTier(total);
    rows +=
      '<tr><td class="team-name">' + esc(t.name) + '</td>' + cells +
      '<td class="pts">' + (init !== undefined ? init : '--') + '</td>' +
      '<td class="pts total"><strong>' + total + '</strong></td>' +
      '<td><span class="tier-badge ' + tier.css + '">' + tier.label + '</span></td></tr>';
  });

  container.innerHTML =
    '<div class="table-scroll"><table class="score-matrix"><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

// ─── Admin tab switching ──────────────────────────────────────────────────────
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(function(el) { el.style.display = 'none'; });
  document.querySelectorAll('.admin-tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  document.getElementById('admin-' + tabName).style.display = '';
  document.querySelector('[data-admin-tab="' + tabName + '"]').classList.add('active');

  if (tabName === 'teams') renderTeamsAdmin();
  if (tabName === 'evaluators') renderEvaluatorsAdmin();
  if (tabName === 'scores') renderScoresMatrix();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showMsg(msg) {
  var el = document.getElementById('flash-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Nav tabs
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var view = btn.dataset.view;
      showView(view);
      if (view === 'leaderboard') { loadAll().then(renderLeaderboard); }
      if (view === 'score-entry') { loadAll().then(initScoreEntry); }
      if (view === 'admin') { loadAll().then(function() { switchAdminTab('teams'); }); }
    });
  });

  // Session select in score entry
  document.getElementById('session-select').addEventListener('change', function() {
    renderScoreForm(parseInt(this.value, 10));
  });

  // Sign out
  document.getElementById('sign-out-btn').addEventListener('click', signOut);

  // Admin: save team
  document.getElementById('save-team-btn').addEventListener('click', saveTeam);
  document.getElementById('cancel-team-btn').addEventListener('click', cancelTeamEdit);

  // Admin: save evaluator
  document.getElementById('save-evaluator-btn').addEventListener('click', saveEvaluatorAssignment);

  // Admin tabs
  document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchAdminTab(btn.dataset.adminTab); });
  });

  // Leaderboard refresh
  document.getElementById('refresh-btn').addEventListener('click', function() {
    loadAll().then(renderLeaderboard);
  });

  // Init auth (GIS loads async; wait for it)
  if (typeof google !== 'undefined' && google.accounts) {
    initAuth();
  } else {
    window.addEventListener('load', initAuth);
    // Fallback: GIS may load after DOMContentLoaded
    var checkGIS = setInterval(function() {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(checkGIS);
        initAuth();
      }
    }, 100);
  }
});
