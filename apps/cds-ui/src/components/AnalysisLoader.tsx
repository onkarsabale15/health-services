'use client';

const MESSAGES = {
  pending: 'Preparing clinical analysis...',
  analyzing: 'Running AI-powered clinical analysis...',
};

export default function AnalysisLoader({ status }: { status: 'pending' | 'analyzing' }) {
  return (
    <div className="aegis-card p-12 flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary-container border-t-primary rounded-full animate-spin" />
      <p className="text-surface-on font-medium">{MESSAGES[status]}</p>
      <p className="text-sm text-secondary">
        This may take a moment. The AI is reviewing patient data and applying clinical rules.
      </p>
    </div>
  );
}
