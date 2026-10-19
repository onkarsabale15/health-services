'use client';

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="aegis-card p-8 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
        <span className="text-red-600 text-xl font-bold">!</span>
      </div>
      <h3 className="text-lg font-semibold text-surface-on">Analysis Error</h3>
      <p className="text-sm text-secondary max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-sm">
          Retry Analysis
        </button>
      )}
      <p className="text-xs text-secondary">If this persists, re-launch from your EHR.</p>
    </div>
  );
}
