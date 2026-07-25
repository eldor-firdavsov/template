export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-border rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}
