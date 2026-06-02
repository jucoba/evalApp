import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Line, ComposedChart, ResponsiveContainer,
} from 'recharts'

const TEAM_COLORS = [
  '#0056b3', '#34a853', '#f9a825', '#e53935',
  '#8e24aa', '#00838f', '#ef6c00', '#3949ab',
]

function linearTrend(points) {
  const n = points.length
  if (n < 2) return points.map(p => ({ ...p, trend: p.value }))
  const sumX = points.reduce((s, _, i) => s + i, 0)
  const sumY = points.reduce((s, p) => s + p.value, 0)
  const sumXY = points.reduce((s, p, i) => s + i * p.value, 0)
  const sumX2 = points.reduce((s, _, i) => s + i * i, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return points.map((p, i) => ({
    ...p,
    trend: Math.round((slope * i + intercept) * 10) / 10,
  }))
}

function GradeChart({ teams, workshopScores }) {
  const sessions = [...new Set(workshopScores.map(s => s.session))]
    .filter(s => s !== 10)
    .sort((a, b) => a - b)

  if (sessions.length === 0) {
    return <p className="empty-msg">Sin calificaciones aún</p>
  }

  const data = sessions.map(session => {
    const row = { name: `Taller ${session}` }
    teams.forEach(t => {
      const score = workshopScores.find(s => s.session === session && s.teamId === t.id)
      row[t.name] = score ? score.grade : null
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} tickCount={6} />
        <Tooltip
          formatter={(val, name) => [val != null ? `${val}` : '—', name]}
          contentStyle={{ fontSize: '0.8rem' }}
        />
        <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
        {teams.map((t, i) => (
          <Bar
            key={t.id}
            dataKey={t.name}
            fill={TEAM_COLORS[i % TEAM_COLORS.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function OnTimeChart({ teams, workshopScores }) {
  const sessions = [...new Set(workshopScores.map(s => s.session))]
    .filter(s => s !== 10)
    .sort((a, b) => a - b)

  if (sessions.length === 0) {
    return <p className="empty-msg">Sin datos de entregas aún</p>
  }

  const totalTeams = teams.length

  const rawPoints = sessions.map(session => {
    const scores = workshopScores.filter(s => s.session === session)
    const onTime = scores.filter(s => (s.daysLate ?? 0) === 0).length
    const pct = scores.length > 0 ? Math.round((onTime / totalTeams) * 100) : 0
    return { name: `Taller ${session}`, value: pct }
  })

  const data = linearTrend(rawPoints)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
        <Tooltip
          formatter={(val, name) => [
            `${val}%`,
            name === 'trend' ? 'Tendencia' : '% a tiempo',
          ]}
          contentStyle={{ fontSize: '0.8rem' }}
        />
        <Legend
          formatter={name => name === 'trend' ? 'Tendencia' : '% Equipos a tiempo'}
          wrapperStyle={{ fontSize: '0.8rem' }}
        />
        <Bar dataKey="value" name="value" fill="#0056b3" radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Line
          type="linear"
          dataKey="trend"
          stroke="#e53935"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function Indicators({ appData }) {
  if (!appData) {
    return <div className="container"><p className="empty-msg">Cargando...</p></div>
  }

  const { teams, workshopScores } = appData

  return (
    <div id="view-indicators" className="view">
      <div className="container">
        <div className="indicators-grid">
          <div className="chart-card">
            <h2>Nota por Taller</h2>
            <p className="chart-subtitle">Calificación (1–10) otorgada por los evaluadores a cada equipo</p>
            <GradeChart teams={teams} workshopScores={workshopScores || []} />
          </div>
          <div className="chart-card">
            <h2>% Entregables a Tiempo</h2>
            <p className="chart-subtitle">Equipos con días de retraso = 0 por taller, con línea de tendencia</p>
            <OnTimeChart teams={teams} workshopScores={workshopScores || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
