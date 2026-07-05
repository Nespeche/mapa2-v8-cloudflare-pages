export function LoadingState({ label = 'Cargando datos del mapa…' }: { label?: string }) {
  return (
    <main className="loading-shell" role="status" aria-live="polite">
      <div className="state-card state-card--loading">
        <span className="spinner" aria-hidden="true" />
        <div>
          <strong>{label}</strong>
          <span>Inicializando datos territoriales, KPIs y capas base.</span>
        </div>
      </div>
    </main>
  );
}
