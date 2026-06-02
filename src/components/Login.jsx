import { useEffect, useRef } from 'react'
import { GOOGLE_CLIENT_ID } from '../config'

export default function Login({ onSignedIn }) {
  const btnRef = useRef(null)

  useEffect(() => {
    function init() {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          const payload = parseJwt(response.credential)
          onSignedIn({ email: payload.email, name: payload.name || payload.email })
        },
        auto_select: false,
      })
      google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline', size: 'large', text: 'signin_with', locale: 'es',
      })
    }

    if (typeof google !== 'undefined' && google.accounts) {
      init()
      return
    }
    const poll = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(poll)
        init()
      }
    }, 100)
    return () => clearInterval(poll)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="view-login" className="view">
      <div className="login-card">
        <h2>🏆 Academias Ágiles</h2>
        <p>Sistema de Recompensas</p>
        <div ref={btnRef} id="sign-in-btn-container"></div>
      </div>
    </div>
  )
}

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}
