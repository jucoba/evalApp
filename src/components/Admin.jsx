import { useState } from 'react'
import { WORKSHOP_COUNT } from '../config'
import { getPrizeTier } from '../scoring'

export default function Admin({ appData, api, onReload }) {
  const [activeTab, setActiveTab] = useState('teams')

  if (!appData) {
    return <div className="container"><p className="empty-msg">Cargando...</p></div>
  }

  const tabs = [
    { id: 'teams', label: 'Equipos' },
    { id: 'evaluators', label: 'Evaluadores' },
    { id: 'viewers', label: 'Viewers' },
    { id: 'scores', label: 'Calificaciones' },
  ]

  return (
    <div id="view-admin" className="view">
      <div className="container">
        <h2>Panel de Administración</h2>
        <div className="admin-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`admin-tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>
        {activeTab === 'teams' && <TeamsTab appData={appData} api={api} onReload={onReload} />}
        {activeTab === 'evaluators' && <EvaluatorsTab appData={appData} api={api} onReload={onReload} />}
        {activeTab === 'viewers' && <ViewersTab appData={appData} api={api} onReload={onReload} />}
        {activeTab === 'scores' && <ScoresTab appData={appData} />}
      </div>
    </div>
  )
}

// ─── Teams ────────────────────────────────────────────────────────────────────
function TeamsTab({ appData, api, onReload }) {
  const [name, setName] = useState('')
  const [size, setSize] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  function startEdit(team) {
    setEditingId(team.id)
    setName(team.name)
    setSize(String(team.memberCount))
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setSize('')
  }

  async function saveTeam() {
    if (!name.trim()) { alert('Escribe el nombre del equipo'); return }
    const sz = parseInt(size, 10)
    if (!sz || sz < 1) { alert('Número de integrantes inválido'); return }
    setSaving(true)
    const params = editingId
      ? { action: 'updateTeam', teamId: editingId, name: name.trim(), memberCount: sz }
      : { action: 'saveTeam', name: name.trim(), memberCount: sz }
    const res = await api(params)
    setSaving(false)
    if (res.error) { alert(res.error); return }
    cancelEdit()
    await onReload()
  }

  async function deleteTeam(team) {
    if (!confirm(`¿Eliminar el equipo "${team.name}"? Se borrarán todas sus calificaciones.`)) return
    const res = await api({ action: 'deleteTeam', teamId: team.id })
    if (res.error) { alert(res.error); return }
    await onReload()
  }

  return (
    <div id="admin-teams" className="admin-tab-content">
      <div className="form-card">
        <h3>{editingId ? 'Editar Equipo' : 'Nuevo Equipo'}</h3>
        <div className="form-row">
          <input type="text" id="team-name" value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre del equipo" maxLength={60} />
          <input type="number" id="team-size" value={size} onChange={e => setSize(e.target.value)}
            min="1" max="30" placeholder="# integrantes" style={{width:'130px'}} />
          <button id="save-team-btn" className="btn-primary" onClick={saveTeam} disabled={saving}>
            Guardar
          </button>
          {editingId && (
            <button id="cancel-team-btn" className="btn-secondary" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Equipo</th><th>Integrantes</th><th>Acciones</th></tr></thead>
          <tbody>
            {appData.teams.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.memberCount}</td>
                <td>
                  <button className="btn-sm btn-secondary" onClick={() => startEdit(t)}>Editar</button>
                  {' '}
                  <button className="btn-sm btn-danger" onClick={() => deleteTeam(t)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Evaluators ───────────────────────────────────────────────────────────────
function EvaluatorsTab({ appData, api, onReload }) {
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  function toggleSession(s) {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function saveAssignment() {
    if (!email.trim()) { alert('Ingresa un correo electrónico'); return }
    if (selected.length === 0) { alert('Selecciona al menos una sesión'); return }
    setSaving(true)
    const res = await api({
      action: 'saveEvaluatorAssignment',
      targetEmail: email.trim().toLowerCase(),
      sessions: selected.join(','),
    })
    setSaving(false)
    if (res.error) { alert(res.error); return }
    setEmail('')
    setSelected([])
    await onReload()
  }

  async function deleteAssignment(evalEmail) {
    if (!confirm(`¿Eliminar asignación de ${evalEmail}?`)) return
    const res = await api({ action: 'deleteEvaluatorAssignment', targetEmail: evalEmail })
    if (res.error) { alert(res.error); return }
    await onReload()
  }

  const sessionList = Array.from({ length: WORKSHOP_COUNT + 1 }, (_, i) => i + 1)

  return (
    <div id="admin-evaluators" className="admin-tab-content">
      <div className="form-card">
        <h3>Asignar Evaluador</h3>
        <div className="form-row">
          <input type="email" id="evaluator-email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div className="sessions-checkboxes" id="session-checkboxes">
          {sessionList.map(s => (
            <label key={s} className="check-label">
              <input type="checkbox" checked={selected.includes(s)}
                onChange={() => toggleSession(s)} />
              {s <= WORKSHOP_COUNT ? 'Taller ' + s : 'Iniciativa'}
            </label>
          ))}
        </div>
        <button id="save-evaluator-btn" className="btn-primary" style={{marginTop:'10px'}}
          onClick={saveAssignment} disabled={saving}>
          Guardar asignación
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Correo</th><th>Sesiones asignadas</th><th>Acciones</th></tr></thead>
          <tbody>
            {(appData.evaluatorAssignments || []).map(ea => (
              <tr key={ea.email}>
                <td>{ea.email}</td>
                <td>{ea.sessions.map(s => s <= WORKSHOP_COUNT ? 'T' + s : 'Init').join(', ')}</td>
                <td>
                  <button className="btn-sm btn-danger" onClick={() => deleteAssignment(ea.email)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Viewers ──────────────────────────────────────────────────────────────────
function ViewersTab({ appData, api, onReload }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function addViewer() {
    if (!email.trim()) { alert('Ingresa un correo electrónico'); return }
    setSaving(true)
    const res = await api({ action: 'saveViewer', targetEmail: email.trim().toLowerCase() })
    setSaving(false)
    if (res.error) { alert(res.error); return }
    setEmail('')
    await onReload()
  }

  async function removeViewer(viewerEmail) {
    if (!confirm(`¿Eliminar acceso de ${viewerEmail}?`)) return
    const res = await api({ action: 'deleteViewer', targetEmail: viewerEmail })
    if (res.error) { alert(res.error); return }
    await onReload()
  }

  return (
    <div className="admin-tab-content">
      <div className="form-card">
        <h3>Agregar Viewer</h3>
        <p style={{marginBottom:'10px', color:'var(--muted)', fontSize:'0.875rem'}}>
          Viewers pueden ver el marcador, indicadores y tabla de calificaciones.
        </p>
        <div className="form-row">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com" />
          <button className="btn-primary" onClick={addViewer} disabled={saving}>
            Agregar
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Correo</th><th>Acciones</th></tr></thead>
          <tbody>
            {(appData.viewers || []).length === 0 && (
              <tr><td colSpan={2} className="empty-msg">Sin viewers configurados.</td></tr>
            )}
            {(appData.viewers || []).map(v => (
              <tr key={v}>
                <td>{v}</td>
                <td>
                  <button className="btn-sm btn-danger" onClick={() => removeViewer(v)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Scores matrix ────────────────────────────────────────────────────────────
export function ScoresTab({ appData }) {
  const { teams, workshopScores, initiativeScores } = appData

  if (teams.length === 0) {
    return <p className="empty-msg">Sin equipos.</p>
  }

  const wsMap = {}
  workshopScores.forEach(s => { wsMap[`${s.teamId}_${s.session}`] = s.total })
  const initMap = {}
  initiativeScores.forEach(s => { initMap[s.teamId] = s.score })

  return (
    <div id="admin-scores" className="admin-tab-content">
      <div className="table-scroll">
        <table className="score-matrix">
          <thead>
            <tr>
              <th>Equipo</th>
              {Array.from({ length: WORKSHOP_COUNT }, (_, i) => <th key={i+1}>T{i+1}</th>)}
              <th>Init</th><th>Total</th><th>Premio</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(t => {
              let workshopSum = 0
              const cells = Array.from({ length: WORKSHOP_COUNT }, (_, i) => {
                const pts = wsMap[`${t.id}_${i+1}`]
                workshopSum += pts || 0
                return <td key={i+1} className="pts">{pts !== undefined ? pts : '--'}</td>
              })
              const init = initMap[t.id]
              const total = workshopSum + (init || 0)
              const tier = getPrizeTier(total)
              return (
                <tr key={t.id}>
                  <td className="team-name">{t.name}</td>
                  {cells}
                  <td className="pts">{init !== undefined ? init : '--'}</td>
                  <td className="pts total"><strong>{total}</strong></td>
                  <td><span className={`tier-badge ${tier.css}`}>{tier.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
