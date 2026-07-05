export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
