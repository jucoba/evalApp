// ─── Configuration ────────────────────────────────────────────────────────────
var SPREADSHEET_ID = '12ORP-RHor9V09sumNbcbn4T26hIfOYSAdGM-y9mVFc8';
var ADMIN_EMAILS = ['jubel_correa@trascendglobal.com', 'emilio_vadillo@trascendglobal.com'];

function sheetNames(level) {
  var prefix = level === 'avanzado' ? 'Avanzado' : 'Intermedio';
  return {
    TEAMS:      prefix + '_Teams',
    WORKSHOP:   prefix + '_WorkshopScores',
    INITIATIVE: prefix + '_InitiativeScores',
    EVALUATORS: prefix + '_EvaluatorAssignments'
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';
  var email = (params.email || '').toLowerCase().trim();
  var level = (params.level === 'avanzado') ? 'avanzado' : 'intermedio';

  try {
    var result;
    switch (action) {
      case 'getAll':              result = getAll(email, level); break;
      case 'saveWorkshopScore':   result = saveWorkshopScore(params, email, level); break;
      case 'saveInitiativeScore': result = saveInitiativeScore(params, email, level); break;
      case 'saveTeam':            result = saveTeam(params, email, level); break;
      case 'updateTeam':          result = updateTeam(params, email, level); break;
      case 'deleteTeam':          result = deleteTeam(params, email, level); break;
      case 'saveEvaluatorAssignment':   result = saveEvaluatorAssignment(params, email, level); break;
      case 'deleteEvaluatorAssignment': result = deleteEvaluatorAssignment(params, email, level); break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return json(result);
  } catch (err) {
    return json({ error: err.message });
  }
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Cache ────────────────────────────────────────────────────────────────────
function getCacheKey(level) { return 'getAll_' + level; }

function invalidateCache(level) {
  CacheService.getScriptCache().remove(getCacheKey(level));
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
function isAdmin(email) {
  return ADMIN_EMAILS.map(function(e) { return e.toLowerCase(); }).indexOf(email) !== -1;
}

function sessionsFromAssignments(evaluatorAssignments, email) {
  for (var i = 0; i < evaluatorAssignments.length; i++) {
    if (evaluatorAssignments[i].email.toLowerCase() === email) {
      return evaluatorAssignments[i].sessions;
    }
  }
  return [];
}

// Used only in write ops where we already have an open ss
function getAssignedSessions(email, level, ss) {
  var rows = openSheet(sheetNames(level).EVALUATORS, ss).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toLowerCase() === email) {
      return String(rows[i][1] || '').split(',')
        .map(function(s) { return parseInt(s.trim(), 10); })
        .filter(function(n) { return !isNaN(n); });
    }
  }
  return [];
}

function canScoreSession(email, session, level, ss) {
  if (isAdmin(email)) return true;
  return getAssignedSessions(email, level, ss).indexOf(parseInt(session, 10)) !== -1;
}

// ─── getAll ───────────────────────────────────────────────────────────────────
function getAll(email, level) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(getCacheKey(level));

  var teams, workshopScores, initiativeScores, evaluatorAssignments;

  if (cached) {
    var parsed = JSON.parse(cached);
    teams = parsed.teams;
    workshopScores = parsed.workshopScores;
    initiativeScores = parsed.initiativeScores;
    evaluatorAssignments = parsed.evaluatorAssignments;
  } else {
    // ONE spreadsheet open for the entire getAll
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var s = sheetNames(level);

    var rawTeams = sheetToObjects(ss.getSheetByName(s.TEAMS),
      ['id', 'name', 'memberCount', 'createdAt']);
    var rawWorkshop = sheetToObjects(ss.getSheetByName(s.WORKSHOP),
      ['teamId', 'session', 'attendees', 'grade', 'daysLate', 'total', 'submittedBy', 'submittedAt']);
    var rawInitiative = sheetToObjects(ss.getSheetByName(s.INITIATIVE),
      ['teamId', 'score', 'submittedBy', 'submittedAt']);
    var evalRows = ss.getSheetByName(s.EVALUATORS).getDataRange().getValues();

    teams = rawTeams.map(function(t) {
      return { id: t.id, name: t.name, memberCount: parseInt(t.memberCount, 10) || 0 };
    });
    workshopScores = rawWorkshop.map(function(ws) {
      return {
        teamId: ws.teamId,
        session: parseInt(ws.session, 10),
        attendees: parseFloat(ws.attendees) || 0,
        grade: parseInt(ws.grade, 10) || 0,
        daysLate: parseInt(ws.daysLate, 10) || 0,
        total: parseInt(ws.total, 10) || 0,
        submittedBy: ws.submittedBy
      };
    });
    initiativeScores = rawInitiative.map(function(is) {
      return { teamId: is.teamId, score: parseInt(is.score, 10) || 0, submittedBy: is.submittedBy };
    });

    evaluatorAssignments = [];
    for (var i = 1; i < evalRows.length; i++) {
      if (evalRows[i][0]) {
        evaluatorAssignments.push({
          email: evalRows[i][0],
          sessions: String(evalRows[i][1] || '').split(',')
            .map(function(n) { return parseInt(n.trim(), 10); })
            .filter(function(n) { return !isNaN(n); })
        });
      }
    }

    cache.put(getCacheKey(level), JSON.stringify({
      teams: teams,
      workshopScores: workshopScores,
      initiativeScores: initiativeScores,
      evaluatorAssignments: evaluatorAssignments
    }), 30);
  }

  // Compute user-specific fields from already-loaded evaluatorAssignments — no extra sheet read
  var assignedSessions = isAdmin(email) ? range(1, 10) : sessionsFromAssignments(evaluatorAssignments, email);
  var userRole = isAdmin(email) ? 'admin' : (assignedSessions.length > 0 ? 'evaluator' : 'none');
  if (!email) userRole = 'none';

  return {
    teams: teams,
    workshopScores: workshopScores,
    initiativeScores: initiativeScores,
    evaluatorAssignments: evaluatorAssignments,
    userRole: userRole,
    assignedSessions: assignedSessions
  };
}

// ─── Score operations ─────────────────────────────────────────────────────────
function saveWorkshopScore(params, email, level) {
  var session = parseInt(params.session, 10);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID); // ONE open for the whole operation
  if (!canScoreSession(email, session, level, ss)) return { error: 'No autorizado para esta sesión' };

  var sheet = openSheet(sheetNames(level).WORKSHOP, ss);
  var rows = sheet.getDataRange().getValues();
  var teamId = params.teamId;
  var rowIdx = -1;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === teamId && parseInt(rows[i][1], 10) === session) { rowIdx = i + 1; break; }
  }

  var rowData = [
    teamId, session,
    parseFloat(params.attendees) || 0,
    parseInt(params.grade, 10) || 0,
    parseInt(params.daysLate, 10) || 0,
    parseInt(params.total, 10) || 0,
    email, new Date().toISOString()
  ];

  if (rowIdx === -1) { sheet.appendRow(rowData); }
  else { sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]); }

  invalidateCache(level);
  return { ok: true };
}

function saveInitiativeScore(params, email, level) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!canScoreSession(email, 10, level, ss)) return { error: 'No autorizado para iniciativa' };

  var sheet = openSheet(sheetNames(level).INITIATIVE, ss);
  var rows = sheet.getDataRange().getValues();
  var teamId = params.teamId;
  var rowIdx = -1;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === teamId) { rowIdx = i + 1; break; }
  }

  var rowData = [teamId, parseInt(params.score, 10) || 0, email, new Date().toISOString()];

  if (rowIdx === -1) { sheet.appendRow(rowData); }
  else { sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]); }

  invalidateCache(level);
  return { ok: true };
}

// ─── Team operations ──────────────────────────────────────────────────────────
function saveTeam(params, email, level) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = openSheet(sheetNames(level).TEAMS, ss);
  sheet.appendRow([Utilities.getUuid(), params.name, parseInt(params.memberCount, 10) || 1, new Date().toISOString()]);
  invalidateCache(level);
  return { ok: true };
}

function updateTeam(params, email, level) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = openSheet(sheetNames(level).TEAMS, ss);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === params.teamId) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[params.name, parseInt(params.memberCount, 10) || 1]]);
      invalidateCache(level);
      return { ok: true };
    }
  }
  return { error: 'Equipo no encontrado' };
}

function deleteTeam(params, email, level) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID); // ONE open for all three deletes
  var s = sheetNames(level);
  deleteRowById(s.TEAMS, params.teamId, 0, ss);
  deleteRowsByTeam(s.WORKSHOP, params.teamId, ss);
  deleteRowsByTeam(s.INITIATIVE, params.teamId, ss);
  invalidateCache(level);
  return { ok: true };
}

// ─── Evaluator assignment operations ─────────────────────────────────────────
function saveEvaluatorAssignment(params, email, level) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = openSheet(sheetNames(level).EVALUATORS, ss);
  var rows = sheet.getDataRange().getValues();
  var targetEmail = (params.targetEmail || '').toLowerCase();
  var sessions = params.sessions || '';

  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toLowerCase() === targetEmail) {
      sheet.getRange(i + 1, 2, 1, 1).setValues([[sessions]]);
      invalidateCache(level);
      return { ok: true };
    }
  }

  sheet.appendRow([targetEmail, sessions]);
  invalidateCache(level);
  return { ok: true };
}

function deleteEvaluatorAssignment(params, email, level) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = openSheet(sheetNames(level).EVALUATORS, ss);
  var rows = sheet.getDataRange().getValues();
  var targetEmail = (params.targetEmail || '').toLowerCase();
  for (var i = rows.length - 1; i >= 1; i--) {
    if ((rows[i][0] || '').toLowerCase() === targetEmail) { sheet.deleteRow(i + 1); }
  }
  invalidateCache(level);
  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function openSheet(name, ss) {
  var spreadsheet = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

// Legacy alias used nowhere internally but kept for safety
function getSheet(name) { return openSheet(name, null); }

function sheetToObjects(sheet, keys) {
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var obj = {};
    for (var j = 0; j < keys.length; j++) {
      obj[keys[j]] = rows[i][j] !== undefined ? rows[i][j] : '';
    }
    result.push(obj);
  }
  return result;
}

function deleteRowById(sheetName, id, col, ss) {
  var sheet = openSheet(sheetName, ss);
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][col] === id) sheet.deleteRow(i + 1);
  }
}

function deleteRowsByTeam(sheetName, teamId, ss) {
  var sheet = openSheet(sheetName, ss);
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === teamId) sheet.deleteRow(i + 1);
  }
}

function range(start, end) {
  var arr = [];
  for (var i = start; i <= end; i++) arr.push(i);
  return arr;
}

// ─── One-time setup: creates sheets for both levels ───────────────────────────
function setupSpreadsheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var headers = {
    Teams:                ['TeamID', 'Name', 'MemberCount', 'CreatedAt'],
    WorkshopScores:       ['TeamID', 'Session', 'AttendeeCount', 'ChallengeGrade', 'DaysLate', 'CalculatedTotal', 'SubmittedBy', 'SubmittedAt'],
    InitiativeScores:     ['TeamID', 'Score', 'SubmittedBy', 'SubmittedAt'],
    EvaluatorAssignments: ['Email', 'Sessions']
  };
  var levels = ['Intermedio', 'Avanzado'];

  levels.forEach(function(lvl) {
    Object.keys(headers).forEach(function(base) {
      var name = lvl + '_' + base;
      var sheet = ss.getSheetByName(name);
      if (!sheet) sheet = ss.insertSheet(name);
      var cols = headers[base];
      sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
      sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    });
  });

  Logger.log('Spreadsheet setup complete: 8 sheets created.');
}
