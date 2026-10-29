import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 border border-gray-300',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
    warning: 'bg-amber-50 text-amber-800 border border-amber-300',
    danger: 'bg-rose-50 text-rose-800 border border-rose-300',
    info: 'bg-slate-100 text-slate-800 border border-slate-300',
  }[variant];

  return (
    <span className={`inline-flex items-center rounded-sm font-medium tracking-wide ${sizeClasses} ${variantClasses}`}>
      {children}
    </span>
  );
};
