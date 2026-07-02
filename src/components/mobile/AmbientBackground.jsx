// Soft ambient color blobs behind glass surfaces — gives the blur something to refract.
export default function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-secondary/15 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-accent/15 blur-3xl" />
    </div>
  )
}