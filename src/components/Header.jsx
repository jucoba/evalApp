import TrascendLogo from './TrascendLogo'

export default function Header({
  currentUser, currentLevel, currentView, userRole,
  onLevelSwitch, onViewSwitch, onSignOut,
}) {
  const isAdmin = userRole === 'admin'
  const isEvaluator = userRole === 'evaluator' || isAdmin

  return (
    <header id="app-header">
      <div className="header-inner">
        <div className="logo-section">
          <TrascendLogo height={30} />
          <span className="logo-divider" />
          <h1>Academias Ágiles</h1>
        </div>
        <div className="level-switcher">
          {['intermedio', 'avanzado'].map(lvl => (
            <button
              key={lvl}
              className={`level-btn${currentLevel === lvl ? ' active' : ''}`}
              onClick={() => onLevelSwitch(lvl)}
            >
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </button>
          ))}
        </div>
        <nav id="nav-tabs">
          <button
            className={`tab-btn${currentView === 'leaderboard' ? ' active' : ''}`}
            onClick={() => onViewSwitch('leaderboard')}
          >Marcador</button>
          {isEvaluator && (
            <button
              className={`tab-btn${currentView === 'score-entry' ? ' active' : ''}`}
              onClick={() => onViewSwitch('score-entry')}
            >Calificar</button>
          )}
          {isAdmin && (
            <button
              className={`tab-btn${currentView === 'admin' ? ' active' : ''}`}
              onClick={() => onViewSwitch('admin')}
            >Admin</button>
          )}
        </nav>
        <div className="header-user">
          <span id="user-name">{currentUser.name}</span>
          <button id="sign-out-btn" onClick={onSignOut}>Salir</button>
        </div>
      </div>
    </header>
  )
}
