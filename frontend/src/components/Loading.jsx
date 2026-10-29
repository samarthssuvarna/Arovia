export default function Loading({ text = 'Loading...' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  )
}
