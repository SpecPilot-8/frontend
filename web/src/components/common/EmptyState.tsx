import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center border border-dashed border-neutral-300 rounded-lg bg-neutral-50/50 ${className}`}
    >
      <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
        <span className="text-base font-medium">!</span>
      </div>
      <h4 className="text-sm font-semibold text-neutral-700">{title}</h4>
      {description && (
        <p className="mt-1 text-xs text-neutral-500 max-w-sm whitespace-pre-line">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};