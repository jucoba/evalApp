// Grade 1-10 → points: linear, grade 1 = 1 pt, grade 10 = 60 pts
function gradeToPoints(grade) {
  return Math.round(1 + (grade - 1) * 59 / 9);
}

// Attendance: 10 × (attendees / memberCount), 1 decimal
function calcAttendance(attendeeCount, memberCount) {
  if (!memberCount || memberCount === 0) return 0;
  return Math.round((attendeeCount / memberCount) * 10 * 10) / 10;
}

// Late penalty applies to combined attendance + challenge (per rules: "calificación total del punto 1 y 2")
function calcWorkshopTotal(attendancePts, grade, daysLate) {
  const challengePts = gradeToPoints(grade);
  const subtotal = attendancePts + challengePts;
  const penalty = Math.max(0, 1 - 0.1 * (daysLate || 0));
  return Math.floor(subtotal * penalty);
}

function calcGrandTotal(workshopTotals, initiativeScore) {
  const sum = workshopTotals.reduce((acc, t) => acc + (t || 0), 0);
  return sum + (initiativeScore || 0);
}

function getPrizeTier(total) {
  if (total >= 900) return { label: 'Premio Mayor', css: 'tier-mayor' };
  if (total >= 700) return { label: 'Premio Medio', css: 'tier-medio' };
  if (total >= 400) return { label: 'Premio Menor', css: 'tier-menor' };
  return { label: 'Sin Premio', css: 'tier-none' };
}
