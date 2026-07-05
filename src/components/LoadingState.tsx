export function LoadingState({ label = 'Cargando datos del mapa…' }: { label?: string }) {
  return (
    <div className="state-card state-card--floating" role="status" aria-live="polite">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
