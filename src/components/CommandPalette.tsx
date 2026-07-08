import { useEffect, useState } from 'react';
import { Terminal, Settings, Activity, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'chat' | 'files' | 'audit_log' | 'settings') => void;
  onNewChat: () => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate, onNewChat }: CommandPaletteProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent, this just catches it if we wanted to
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
    setSearch('');
  };

  const commands = [
    { name: 'New Chat', icon: <Terminal size={16} />, action: onNewChat },
    { name: 'Go to Settings', icon: <Settings size={16} />, action: () => onNavigate('settings') },
    { name: 'Go to Audit Log', icon: <Activity size={16} />, action: () => onNavigate('audit_log') },
    { name: 'Go to Files', icon: <Folder size={16} />, action: () => onNavigate('files') },
    { name: 'Go to Chat', icon: <Terminal size={16} />, action: () => onNavigate('chat') },
  ];

  const filtered = commands.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '20vh', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '400px', maxWidth: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)' }}>
            <input 
              autoFocus
              type="text" 
              placeholder="Type a command or search..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }}
            />
          </div>
          <div style={{ padding: 'var(--space-sm)' }}>
            {filtered.map((cmd, i) => (
              <div 
                key={i} 
                onClick={() => handleAction(cmd.action)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-transparent)', e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {cmd.icon}
                {cmd.name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
