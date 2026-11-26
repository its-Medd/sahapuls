export function AsyncState({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: string;
  empty?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  if (error)
    return (
      <div className="state error" role="alert">
        <strong>Could not load this view</strong>
        <p>{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <div className="state" role="status">
        <span className="loader" aria-hidden="true" /> Loading observations…
      </div>
    );
  if (empty)
    return (
      <div className="state">
        <strong>No observations yet</strong>
        <p>{empty}</p>
      </div>
    );
  return <>{children}</>;
}
