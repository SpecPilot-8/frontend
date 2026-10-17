import React from 'react';

interface CardProps {
  title?: string;
  description?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  extra,
  children,
  className = '',
}) => {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm ${className}`}>
      {(title || description || extra) && (
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
            {description && <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};