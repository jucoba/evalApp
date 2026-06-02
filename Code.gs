// ─── Configuration ────────────────────────────────────────────────────────────
// Paste your Google Spreadsheet ID here (from the URL: /d/SPREADSHEET_ID/edit)
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
var ADMIN_EMAIL = 'admin@example.com'; // must match config.js

var SHEET = {
  TEAMS: 'Teams',
  WORKSHOP: 'WorkshopScores',
  INITIATIVE: 'InitiativeScores',
  EVALUATORS: 'EvaluatorAssignments'
};

// ─── Entry point ──────────────────────────────────────────────────────────────
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';
  var email = (params.email || '').toLowerCase().trim();

  try {
    var result;
    switch (action) {
      case 'getAll':              result = getAll(email); break;
      case 'saveWorkshopScore':   result = saveWorkshopScore(params, email); break;
      case 'saveInitiativeScore': result = saveInitiativeScore(params, email); break;
      case 'saveTeam':            result = saveTeam(params, email); break;
      case 'updateTeam':          result = updateTeam(params, email); break;
      case 'deleteTeam':          result = deleteTeam(params, email); break;
      case 'saveEvaluatorAssignment':   result = saveEvaluatorAssignment(params, email); break;
      case 'deleteEvaluatorAssignment': result = deleteEvaluatorAssignment(params, email); break;
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

// ─── Role helpers ─────────────────────────────────────────────────────────────
function isAdmin(email) {
  return email === ADMIN_EMAIL.toLowerCase();
}

function getAssignedSessions(email) {
  var rows = getSheet(SHEET.EVALUATORS).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toLowerCase() === email) {
      return (rows[i][1] || '').split(',')
        .map(function(s) { return parseInt(s.trim(), 10); })
        .filter(function(n) { return !isNaN(n); });
    }
  }
  return [];
}

function canScoreSession(email, session) {
  if (isAdmin(email)) return true;
  return getAssignedSessions(email).indexOf(parseInt(session, 10)) !== -1;
}

function getUserRole(email) {
  if (!email) return 'none';
  if (isAdmin(email)) return 'admin';
  var sessions = getAssignedSessions(email);
  return sessions.length > 0 ? 'evaluator' : 'none';
}

// ─── getAll ───────────────────────────────────────────────────────────────────
function getAll(email) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var teams = sheetToObjects(ss.getSheetByName(SHEET.TEAMS),
    ['id', 'name', 'memberCount', 'createdAt']);

  var workshopScores = sheetToObjects(ss.getSheetByName(SHEET.WORKSHOP),
    ['teamId', 'session', 'attendees', 'grade', 'daysLate', 'total', 'submittedBy', 'submittedAt']);

  var initiativeScores = sheetToObjects(ss.getSheetByName(SHEET.INITIATIVE),
    ['teamId', 'score', 'submittedBy', 'submittedAt']);

  var evalRows = ss.getSheetByName(SHEET.EVALUATORS).getDataRange().getValues();
  var evaluatorAssignments = [];
  for (var i = 1; i < evalRows.length; i++) {
    if (evalRows[i][0]) {
      evaluatorAssignments.push({
        email: evalRows[i][0],
        sessions: (evalRows[i][1] || '').split(',')
          .map(function(s) { return parseInt(s.trim(), 10); })
          .filter(function(n) { return !isNaN(n); })
      });
    }
  }

  // Cast numeric fields
  teams = teams.map(function(t) {
    return { id: t.id, name: t.name, memberCount: parseInt(t.memberCount, 10) || 0 };
  });

  workshopScores = workshopScores.map(function(s) {
    return {
      teamId: s.teamId,
      session: parseInt(s.session, 10),
      attendees: parseFloat(s.attendees) || 0,
      grade: parseInt(s.grade, 10) || 0,
      daysLate: parseInt(s.daysLate, 10) || 0,
      total: parseInt(s.total, 10) || 0,
      submittedBy: s.submittedBy
    };
  });

  initiativeScores = initiativeScores.map(function(s) {
    return {
      teamId: s.teamId,
      score: parseInt(s.score, 10) || 0,
      submittedBy: s.submittedBy
    };
  });

  return {
    teams: teams,
    workshopScores: workshopScores,
    initiativeScores: initiativeScores,
    evaluatorAssignments: evaluatorAssignments,
    userRole: getUserRole(email),
    assignedSessions: isAdmin(email) ? range(1, 10) : getAssignedSessions(email)
  };
}

// ─── Score operations ─────────────────────────────────────────────────────────
function saveWorkshopScore(params, email) {
  var session = parseInt(params.session, 10);
  if (!canScoreSession(email, session)) return { error: 'No autorizado para esta sesión' };

  var sheet = getSheet(SHEET.WORKSHOP);
  var rows = sheet.getDataRange().getValues();
  var teamId = params.teamId;
  var rowIdx = -1;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === teamId && parseInt(rows[i][1], 10) === session) {
      rowIdx = i + 1; // 1-based sheet row
      break;
    }
  }

  var rowData = [
    teamId,
    session,
    parseFloat(params.attendees) || 0,
    parseInt(params.grade, 10) || 0,
    parseInt(params.daysLate, 10) || 0,
    parseInt(params.total, 10) || 0,
    email,
    new Date().toISOString()
  ];

  if (rowIdx === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
  }

  return { ok: true };
}

function saveInitiativeScore(params, email) {
  if (!canScoreSession(email, 10)) return { error: 'No autorizado para iniciativa' };

  var sheet = getSheet(SHEET.INITIATIVE);
  var rows = sheet.getDataRange().getValues();
  var teamId = params.teamId;
  var rowIdx = -1;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === teamId) { rowIdx = i + 1; break; }
  }

  var rowData = [teamId, parseInt(params.score, 10) || 0, email, new Date().toISOString()];

  if (rowIdx === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
  }

  return { ok: true };
}

// ─── Team operations ──────────────────────────────────────────────────────────
function saveTeam(params, email) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var sheet = getSheet(SHEET.TEAMS);
  var id = Utilities.getUuid();
  sheet.appendRow([id, params.name, parseInt(params.memberCount, 10) || 1, new Date().toISOString()]);
  return { ok: true, id: id };
}

function updateTeam(params, email) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var sheet = getSheet(SHEET.TEAMS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === params.teamId) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[params.name, parseInt(params.memberCount, 10) || 1]]);
      return { ok: true };
    }
  }
  return { error: 'Equipo no encontrado' };
}

function deleteTeam(params, email) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  deleteRowById(SHEET.TEAMS, params.teamId, 0);
  deleteRowsByTeam(SHEET.WORKSHOP, params.teamId);
  deleteRowsByTeam(SHEET.INITIATIVE, params.teamId);
  return { ok: true };
}

// ─── Evaluator assignment operations ─────────────────────────────────────────
function saveEvaluatorAssignment(params, email) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var sheet = getSheet(SHEET.EVALUATORS);
  var rows = sheet.getDataRange().getValues();
  var targetEmail = (params.targetEmail || '').toLowerCase();
  var sessions = params.sessions || '';

  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toLowerCase() === targetEmail) {
      sheet.getRange(i + 1, 2, 1, 1).setValues([[sessions]]);
      return { ok: true };
    }
  }

  sheet.appendRow([targetEmail, sessions]);
  return { ok: true };
}

function deleteEvaluatorAssignment(params, email) {
  if (!isAdmin(email)) return { error: 'Solo administradores' };
  var sheet = getSheet(SHEET.EVALUATORS);
  var rows = sheet.getDataRange().getValues();
  var targetEmail = (params.targetEmail || '').toLowerCase();
  for (var i = rows.length - 1; i >= 1; i--) {
    if ((rows[i][0] || '').toLowerCase() === targetEmail) {
      sheet.deleteRow(i + 1);
    }
  }
  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSheet(name) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function sheetToObjects(sheet, keys) {
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue; // skip empty rows
    var obj = {};
    for (var j = 0; j < keys.length; j++) {
      obj[keys[j]] = rows[i][j] !== undefined ? rows[i][j] : '';
    }
    result.push(obj);
  }
  return result;
}

function deleteRowById(sheetName, id, col) {
  var sheet = getSheet(sheetName);
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][col] === id) sheet.deleteRow(i + 1);
  }
}

function deleteRowsByTeam(sheetName, teamId) {
  var sheet = getSheet(sheetName);
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

// ─── One-time setup: creates sheets with headers ──────────────────────────────
function setupSpreadsheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = {
    Teams: ['TeamID', 'Name', 'MemberCount', 'CreatedAt'],
    WorkshopScores: ['TeamID', 'Session', 'AttendeeCount', 'ChallengeGrade', 'DaysLate', 'CalculatedTotal', 'SubmittedBy', 'SubmittedAt'],
    InitiativeScores: ['TeamID', 'Score', 'SubmittedBy', 'SubmittedAt'],
    EvaluatorAssignments: ['Email', 'Sessions']
  };

  Object.keys(sheets).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    sheet.getRange(1, 1, 1, sheets[name].length).setValues([sheets[name]]);
    sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold');
  });

  Logger.log('Spreadsheet setup complete.');
}
