import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const VARIANT_MAP: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm disabled:bg-blue-300',
  secondary: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400',
  ghost: 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 disabled:text-slate-300',
  outline: 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50 disabled:text-slate-300',
};

const SIZE_MAP: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-xs',
  lg: 'px-4 py-2 text-xs font-semibold',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}) => {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg border transition-colors select-none focus:outline-none ${VARIANT_MAP[variant]} ${SIZE_MAP[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};