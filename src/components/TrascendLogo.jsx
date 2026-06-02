const LOGO_SRC = `${import.meta.env.BASE_URL}trascendLogo.png`

export function TrascendLogoFull() {
  return (
    <img
      src={LOGO_SRC}
      alt="Trascend"
      style={{ display: 'block', width: 160, height: 'auto' }}
    />
  )
}

export default function TrascendLogo({ height = 36 }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Trascend"
      style={{ display: 'block', height, width: 'auto' }}
    />
  )
}
