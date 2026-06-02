import { useState, useEffect } from 'react'
import { WORKSHOP_COUNT } from '../config'
import { gradeToPoints, calcAttendance, calcWorkshopTotal } from '../scoring'

export default function ScoreEntry({ appData, api, onDataUpdate }) {
  const [selectedSession, setSelectedSession] = useState(null)

  useEffect(() => {
    if (appData?.assignedSessions?.length > 0 && selectedSession === null) {
      setSelectedSession(appData.assignedSessions[0])
    }
  }, [appData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!appData) {
    return <div className="container"><p className="empty-msg">Cargando...</p></div>
  }

  const sessions = appData.assignedSessions || []
  const session = selectedSession ?? sessions[0] ?? null

  return (
    <div id="view-score-entry" className="view">
      <div className="container">
        <h2>Calificar Equipos</h2>
        <div className="session-selector">
          <label htmlFor="session-select">Sesión:</label>
          <select
            id="session-select"
            value={session ?? ''}
            onChange={e => setSelectedSession(parseInt(e.target.value, 10))}
          >
            {sessions.map(s => (
              <option key={s} value={s}>
                {s === 10 ? 'Iniciativa Final' : 'Taller ' + s}
              </option>
            ))}
          </select>
        </div>
        {session !== null && (
          <ScoreForm
            key={session}
            session={session}
            appData={appData}
            api={api}
            onDataUpdate={onDataUpdate}
          />
        )}
      </div>
    </div>
  )
}

function ScoreForm({ session, appData, api, onDataUpdate }) {
  const isInitiative = session === 10
  const { teams, workshopScores, initiativeScores } = appData

  if (teams.length === 0) {
    return <p className="empty-msg">No hay equipos registrados.</p>
  }

  return (
    <div className="table-scroll">
      <table className="score-table">
        <thead>
          <tr>
            <th>Equipo</th>
            {isInitiative
              ? <th>Puntaje Iniciativa (0-370)</th>
              : <><th>Asistentes</th><th>Nota (1-10)</th><th>Días de retraso</th><th>Vista previa</th></>
            }
            <th></th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => (
            <TeamRow
              key={team.id}
              team={team}
              session={session}
              isInitiative={isInitiative}
              existingScore={
                isInitiative
                  ? initiativeScores.find(s => s.teamId === team.id)
                  : workshopScores.find(s => s.teamId === team.id && s.session === session)
              }
              api={api}
              appData={appData}
              onDataUpdate={onDataUpdate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamRow({ team, session, isInitiative, existingScore, api, appData, onDataUpdate }) {
  const [attendees, setAttendees] = useState(existingScore?.attendees ?? '')
  const [grade, setGrade] = useState(existingScore?.grade ?? 0)
  const [daysLate, setDaysLate] = useState(existingScore?.daysLate ?? 0)
  const [initiative, setInitiative] = useState(existingScore?.score ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function preview() {
    if (!grade) return '--'
    const attPts = calcAttendance(parseFloat(attendees) || 0, team.memberCount)
    return calcWorkshopTotal(attPts, grade, parseInt(daysLate) || 0) + ' pts'
  }

  async function handleSave() {
    setSaving(true)
    let res
    if (isInitiative) {
      const score = parseInt(initiative, 10)
      if (isNaN(score) || score < 0 || score > 370) {
        alert('Puntaje debe estar entre 0 y 370')
        setSaving(false)
        return
      }
      res = await api({ action: 'saveInitiativeScore', teamId: team.id, score })
      if (!res.error) {
        const next = appData.initiativeScores.filter(s => s.teamId !== team.id)
        next.push({ teamId: team.id, score })
        onDataUpdate({ ...appData, initiativeScores: next })
      }
    } else {
      if (!grade) { alert('Selecciona una nota'); setSaving(false); return }
      const att = parseFloat(attendees) || 0
      const days = parseInt(daysLate, 10) || 0
      const attPts = calcAttendance(att, team.memberCount)
      const total = calcWorkshopTotal(attPts, grade, days)
      res = await api({ action: 'saveWorkshopScore', teamId: team.id, session, attendees: att, grade, daysLate: days, total })
      if (!res.error) {
        const next = appData.workshopScores.filter(s => !(s.teamId === team.id && s.session === session))
        next.push({ teamId: team.id, session, attendees: att, grade, daysLate: days, total })
        onDataUpdate({ ...appData, workshopScores: next })
      }
    }
    setSaving(false)
    if (res.error) { alert(res.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <tr>
      <td className="team-cell">
        <strong>{team.name}</strong><br />
        <small>{team.memberCount} integrantes</small>
      </td>
      {isInitiative ? (
        <td>
          <input type="number" className="input-initiative" min="0" max="370"
            value={initiative} onChange={e => setInitiative(e.target.value)}
            placeholder="0-370" />
        </td>
      ) : (
        <>
          <td>
            <input type="number" className="input-attendees" min="0" max={team.memberCount}
              value={attendees} onChange={e => setAttendees(e.target.value)}
              placeholder={`0-${team.memberCount}`} />
          </td>
          <td>
            <select className="input-grade" value={grade}
              onChange={e => setGrade(parseInt(e.target.value, 10))}>
              <option value={0}>-- nota --</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(g => (
                <option key={g} value={g}>{g} ({gradeToPoints(g)} pts)</option>
              ))}
            </select>
          </td>
          <td>
            <input type="number" className="input-days" min="0"
              value={daysLate} onChange={e => setDaysLate(e.target.value)} />
          </td>
          <td className="preview-cell">
            {grade > 0 ? <strong>{preview()}</strong> : '--'}
          </td>
        </>
      )}
      <td>
        <button
          className={`btn-save-row btn-primary btn-sm${saved ? ' btn-saved' : ''}`}
          disabled={saving}
          onClick={handleSave}
        >
          {saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </td>
    </tr>
  )
}
