import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({
  error = false,
  className = '',
  ...props
}) => {
  return (
    <input
      className={`w-full px-3 py-2 text-xs text-slate-800 bg-white border rounded-lg placeholder-slate-400 focus:outline-none transition-colors ${
        error
          ? 'border-rose-400 focus:border-rose-500'
          : 'border-slate-200 focus:border-blue-500'
      } disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      {...props}
    />
  );
};