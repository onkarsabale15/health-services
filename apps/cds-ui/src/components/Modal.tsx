'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto w-full max-w-2xl max-h-[80vh] rounded-2xl bg-white p-0 border-0 overflow-hidden backdrop:bg-black/30 backdrop:backdrop-blur-sm"
      style={{ boxShadow: '0 8px 40px rgba(0, 52, 94, 0.12), 0 2px 8px rgba(0, 52, 94, 0.06)' }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high/40 shrink-0">
        <h2 className="text-base font-bold text-surface-on">{title}</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container-low hover:text-surface-on transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            close
          </span>
        </button>
      </div>
      <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 64px)' }}>
        {children}
      </div>
    </dialog>
  );
}
