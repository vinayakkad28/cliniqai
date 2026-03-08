'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const shortcuts: ShortcutMap = {
      'g+p': () => router.push('/dashboard/patients'),
      'g+a': () => router.push('/dashboard/appointments'),
      'g+c': () => router.push('/dashboard/consultations'),
      'g+b': () => router.push('/dashboard/billing'),
      'g+s': () => router.push('/dashboard/settings'),
      'g+h': () => router.push('/dashboard'),
      'g+y': () => router.push('/dashboard/pharmacy'),
      'g+n': () => router.push('/dashboard/analytics'),
      'n+p': () => router.push('/dashboard/patients/new'),
      'n+a': () => router.push('/dashboard/appointments/new'),
    };

    let pendingKey = '';
    let pendingTimeout: NodeJS.Timeout;

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (pendingKey) {
        const combo = `${pendingKey}+${key}`;
        clearTimeout(pendingTimeout);
        pendingKey = '';

        if (shortcuts[combo]) {
          e.preventDefault();
          shortcuts[combo]();
        }
      } else if (key === 'g' || key === 'n') {
        pendingKey = key;
        pendingTimeout = setTimeout(() => {
          pendingKey = '';
        }, 500);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
