'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  action: () => void;
  category: string;
  keywords?: string[];
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: '🏠', category: 'Navigation', action: () => router.push('/dashboard'), keywords: ['home'] },
    { id: 'nav-patients', label: 'Go to Patients', icon: '👥', category: 'Navigation', action: () => router.push('/dashboard/patients'), keywords: ['patient list'] },
    { id: 'nav-appointments', label: 'Go to Appointments', icon: '📅', category: 'Navigation', action: () => router.push('/dashboard/appointments'), keywords: ['schedule', 'calendar'] },
    { id: 'nav-consultations', label: 'Go to Consultations', icon: '🩺', category: 'Navigation', action: () => router.push('/dashboard/consultations') },
    { id: 'nav-billing', label: 'Go to Billing', icon: '💰', category: 'Navigation', action: () => router.push('/dashboard/billing'), keywords: ['invoice', 'payment', 'revenue'] },
    { id: 'nav-pharmacy', label: 'Go to Pharmacy', icon: '💊', category: 'Navigation', action: () => router.push('/dashboard/pharmacy'), keywords: ['medicine', 'inventory'] },
    { id: 'nav-analytics', label: 'Go to Analytics', icon: '📊', category: 'Navigation', action: () => router.push('/dashboard/analytics'), keywords: ['reports', 'stats', 'insights'] },
    { id: 'nav-queue', label: 'Go to Queue Display', icon: '📺', category: 'Navigation', action: () => router.push('/dashboard/queue'), keywords: ['tv', 'waiting room'] },
    { id: 'nav-followups', label: 'Go to Follow-ups', icon: '🔔', category: 'Navigation', action: () => router.push('/dashboard/follow-ups'), keywords: ['reminder', 'followup', 'follow up'] },
    { id: 'nav-auditlog', label: 'Go to Audit Log', icon: '📋', category: 'Navigation', action: () => router.push('/dashboard/audit-log'), keywords: ['audit', 'log', 'history', 'trail'] },
    { id: 'nav-settings', label: 'Go to Settings', icon: '⚙️', category: 'Navigation', action: () => router.push('/dashboard/settings'), keywords: ['config', 'profile'] },

    // Quick Actions
    { id: 'action-new-patient', label: 'Register New Patient', icon: '➕', category: 'Actions', action: () => router.push('/dashboard/patients/new'), keywords: ['add patient', 'create patient'] },
    { id: 'action-new-appointment', label: 'Book Appointment', icon: '📅', category: 'Actions', action: () => router.push('/dashboard/appointments/new'), keywords: ['schedule', 'new appointment'] },
    { id: 'action-new-walkin', label: 'Add Walk-in Patient', icon: '🚶', category: 'Actions', action: () => router.push('/dashboard/appointments/new?type=walkin'), keywords: ['token', 'queue'] },

    // Search
    { id: 'search-patient', label: 'Search Patients...', icon: '🔍', category: 'Search', action: () => router.push('/dashboard/patients?focus=search'), keywords: ['find patient'] },
  ];

  const filteredCommands = query
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>
  );

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          cmd.action();
          setIsOpen(false);
        }
      }
    },
    [filteredCommands, selectedIndex]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      {/* Palette */}
      <div className="relative max-w-xl mx-auto mt-[20vh] animate-slide-up">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 text-sm outline-none placeholder-slate-400 text-slate-800"
            />
            <kbd className="px-2 py-0.5 text-2xs bg-slate-50 text-slate-400 rounded border border-slate-200">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category}>
                <p className="text-2xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">{category}</p>
                {items.map((cmd) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        globalIndex === selectedIndex ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <span className="font-medium">{cmd.label}</span>
                        {cmd.description && <span className="text-slate-400 ml-2 text-xs">{cmd.description}</span>}
                      </div>
                      {globalIndex === selectedIndex && (
                        <kbd className="px-1.5 py-0.5 text-2xs bg-primary-100 text-primary-600 rounded">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredCommands.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No commands found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4 text-2xs text-slate-400">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
            <span className="ml-auto">⌘K to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
