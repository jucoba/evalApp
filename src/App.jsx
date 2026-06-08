import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import Login from './components/Login'
import Leaderboard from './components/Leaderboard'
import ScoreEntry from './components/ScoreEntry'
import Admin, { ScoresTab } from './components/Admin'
import Indicators from './components/Indicators'
import { callApi } from './api'
import './style.css'

function LoadingOverlay() {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <span className="loading-text">Cargando...</span>
    </div>
  )
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [appData, setAppData] = useState(null)
  const [currentLevel, setCurrentLevel] = useState(() =>
    sessionStorage.getItem('level') === 'avanzado' ? 'avanzado' : 'intermedio'
  )
  const [currentView, setCurrentView] = useState('leaderboard')
  const [flashMsg, setFlashMsg] = useState('')
  const [loading, setLoading] = useState(!!currentUser)

  // Keep refs fresh for the auto-refresh interval closure
  const stateRef = useRef({ currentUser, currentLevel, currentView })
  useEffect(() => { stateRef.current = { currentUser, currentLevel, currentView } })

  const fetchAll = useCallback((user, level) => {
    setLoading(true)
    return callApi({ action: 'getAll' }, user, level).then(data => {
      if (data.error) return data
      setAppData(data)
      return data
    }).finally(() => setLoading(false))
  }, [])

  const api = useCallback(
    (params) => callApi(params, currentUser, currentLevel),
    [currentUser, currentLevel]
  )

  // Load on mount if session exists
  useEffect(() => {
    if (currentUser) fetchAll(currentUser, currentLevel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh leaderboard every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      const { currentUser, currentLevel, currentView } = stateRef.current
      if (currentView === 'leaderboard' && currentUser) {
        callApi({ action: 'getAll' }, currentUser, currentLevel).then(setAppData)
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  function handleSignIn(user) {
    setCurrentUser(user)
    sessionStorage.setItem('user', JSON.stringify(user))
    fetchAll(user, currentLevel).then(data => {
      if (data.userRole === 'none') {
        setFlashMsg('Tu correo no tiene acceso configurado. Contacta al administrador.')
        setTimeout(() => setFlashMsg(''), 5000)
      }
    })
  }

  function handleSignOut() {
    if (typeof google !== 'undefined') google.accounts.id.disableAutoSelect()
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('level')
    setCurrentUser(null)
    setAppData(null)
    setCurrentLevel('intermedio')
    setCurrentView('leaderboard')
  }

  function handleLevelSwitch(newLevel) {
    if (newLevel === currentLevel) return
    setCurrentLevel(newLevel)
    sessionStorage.setItem('level', newLevel)
    fetchAll(currentUser, newLevel)
  }

  function handleViewSwitch(view) {
    setCurrentView(view)
    fetchAll(currentUser, currentLevel)
  }

  if (!currentUser) {
    return <Login onSignedIn={handleSignIn} />
  }

  const userRole = appData?.userRole || 'none'

  return (
    <>
      <Header
        currentUser={currentUser}
        currentLevel={currentLevel}
        currentView={currentView}
        userRole={userRole}
        onLevelSwitch={handleLevelSwitch}
        onViewSwitch={handleViewSwitch}
        onSignOut={handleSignOut}
      />
      {flashMsg && (
        <div style={{maxWidth:'1100px', margin:'0 auto', padding:'0 20px'}}>
          <div id="flash-msg" style={{display:''}}>{flashMsg}</div>
        </div>
      )}
      {loading && <LoadingOverlay />}
      {currentView === 'indicators' && (
        <Indicators appData={appData} />
      )}
      {currentView === 'leaderboard' && (
        <Leaderboard
          appData={appData}
          onRefresh={() => fetchAll(currentUser, currentLevel)}
        />
      )}
      {currentView === 'score-entry' && (
        <ScoreEntry appData={appData} api={api} onDataUpdate={setAppData} />
      )}
      {currentView === 'scores' && (
        <div id="view-scores" className="view">
          <div className="container">
            <h2>Calificaciones</h2>
            <ScoresTab appData={appData} />
          </div>
        </div>
      )}
      {currentView === 'admin' && (
        <Admin
          appData={appData}
          api={api}
          onReload={() => fetchAll(currentUser, currentLevel)}
        />
      )}
    </>
  )
}
