'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'danger' | 'success' | 'warning' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  /** Show a confirm() dialog before firing onClick */
  confirmMessage?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  danger: 'bg-red-600 text-white font-medium rounded-md hover:bg-red-700 active:scale-[0.98] disabled:opacity-50',
  success: 'bg-green-600 text-white font-medium rounded-md hover:bg-green-700 active:scale-[0.98] disabled:opacity-50',
  warning:
    'bg-yellow-500 text-white font-medium rounded-md hover:bg-yellow-600 active:scale-[0.98] disabled:opacity-50',
  secondary: 'btn-secondary',
  ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium rounded-md disabled:opacity-50',
  link: 'text-blue-600 hover:underline disabled:opacity-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

// primary and secondary already include padding via globals.css — but only skip for default (md) size
const SKIP_SIZE_VARIANTS = new Set<ButtonVariant>(['primary', 'secondary']);

const SPINNER_SM = 'w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin';
const SPINNER_MD = 'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  confirmMessage,
  children,
  className,
  onClick,
  disabled,
  ...rest
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (confirmMessage && !confirm(confirmMessage)) return;
    onClick?.(e);
  };

  const baseClasses = VARIANT_CLASSES[variant];
  const sizeClasses = SKIP_SIZE_VARIANTS.has(variant) && size === 'md' ? '' : SIZE_CLASSES[size];
  const spinnerClass = size === 'sm' ? SPINNER_SM : SPINNER_MD;

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${loading ? 'flex items-center justify-center gap-2' : ''} ${className ?? ''}`.trim()}
      disabled={disabled || loading}
      onClick={handleClick}
      {...rest}
    >
      {loading ? (
        <>
          <div className={spinnerClass} />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
