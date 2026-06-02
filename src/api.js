import { API_URL } from './config'

export function callApi(params, user, level) {
  const p = { ...params }
  if (user) p.email = user.email
  if (level) p.level = level
  const qs = Object.keys(p)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`)
    .join('&')
  return fetch(`${API_URL}?${qs}`, { redirect: 'follow' }).then(r => r.json())
}
