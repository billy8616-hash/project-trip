export default function MapNotice({ title, text }) {
  return (
    <div className="map-notice">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  )
}
