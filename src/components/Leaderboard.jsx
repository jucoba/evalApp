import { useEffect, useState } from 'react'
import { getPrizeTier } from '../scoring'

export default function Leaderboard({ appData, onRefresh }) {
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString('es'))

  useEffect(() => {
    if (appData) setLastUpdated(new Date().toLocaleTimeString('es'))
  }, [appData])

  if (!appData) {
    return <div className="container"><p className="empty-msg">Cargando...</p></div>
  }

  const wsMap = {}
  ;(appData.workshopScores || []).forEach(s => { wsMap[s.teamId] = (wsMap[s.teamId] || 0) + s.total })
  const initMap = {}
  ;(appData.initiativeScores || []).forEach(s => { initMap[s.teamId] = s.score })

  const rows = appData.teams.map(t => ({
    team: t,
    ws: wsMap[t.id] || 0,
    init: initMap[t.id] || 0,
    total: (wsMap[t.id] || 0) + (initMap[t.id] || 0),
  })).sort((a, b) => b.total - a.total)

  const maxTotal = rows.length > 0 ? rows[0].total : 0

  return (
    <div id="view-leaderboard" className="view">
      <div className="container">
        <div className="leaderboard-header">
          <h2>Marcador General</h2>
          <span id="leaderboard-updated">Actualizado: {lastUpdated}</span>
          <button className="btn-secondary btn-sm" onClick={onRefresh}>↻ Actualizar</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Equipo</th>
                <th style={{textAlign:'right'}}>Talleres</th>
                <th style={{textAlign:'right'}}>Iniciativa</th>
                <th style={{textAlign:'right'}}>Total</th>
                <th>Premio</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="empty-msg">Sin equipos aún</td></tr>
              ) : rows.map((r, idx) => {
                const tier = getPrizeTier(r.total)
                const isTop = r.total > 0 && r.total === maxTotal &&
                  rows.filter(x => x.total === maxTotal).length === 1
                return (
                  <tr key={r.team.id}>
                    <td className="rank">{idx + 1}</td>
                    <td className="team-name">
                      {r.team.name}
                      {isTop && <span className="special-badge" title="Premio especial"> ★</span>}
                    </td>
                    <td className="pts">{r.ws}</td>
                    <td className="pts">{r.init}</td>
                    <td className="pts total">{r.total}</td>
                    <td><span className={`tier-badge ${tier.css}`}>{tier.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:'20px', fontSize:'0.8rem', color:'var(--muted)'}}>
          <strong>Escala de premios:</strong>
          <span className="tier-badge tier-mayor" style={{margin:'0 6px'}}>Premio Mayor 900–1000</span>
          <span className="tier-badge tier-medio" style={{margin:'0 6px'}}>Premio Medio 700–899</span>
          <span className="tier-badge tier-menor" style={{margin:'0 6px'}}>Premio Menor 400–699</span>
          &nbsp;★ = Premio Especial (puntaje más alto)
        </div>
      </div>
    </div>
  )
}
