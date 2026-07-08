import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Settings as SettingsIcon, Key, Folder, Shield, Loader2, Eye, EyeOff, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { TrustTier } from '../core/types';

interface SettingsProps {
  currentWorkspace: string;
  onWorkspaceChange: (path: string) => void;
  currentTrustTier: TrustTier;
  onTrustTierChange: (tier: TrustTier) => void;
}

export default function Settings({ currentWorkspace, onWorkspaceChange, currentTrustTier, onTrustTierChange }: SettingsProps) {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [serperKey, setSerperKey] = useState('');
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [showSerper, setShowSerper] = useState(false);
  
  const [testingOr, setTestingOr] = useState(false);
  const [orStatus, setOrStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const [testingSerper, setTestingSerper] = useState(false);
  const [serperStatus, setSerperStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load existing keys (placeholder, backend doesn't expose raw keys easily, 
  // but we can assume they just need to update it. Wait, the user said:
  // "This must read/write the same keychain-stored values as before"
  // Actually, keychain usually doesn't allow reading back to the frontend for security,
  // but we have a command `get_api_key_exists`. I'll just leave it blank as a password field 
  // and say "Stored securely. Enter a new key to update."

  const [hasOrKey, setHasOrKey] = useState(false);
  const [hasSerperKey, setHasSerperKey] = useState(false);

  useEffect(() => {
    async function checkKeys() {
      try {
        const orExists = await invoke<boolean>('get_api_key_exists', { provider: 'openrouter' });
        setHasOrKey(orExists);
        const srExists = await invoke<boolean>('get_api_key_exists', { provider: 'serper' });
        setHasSerperKey(srExists);
      } catch (e) {
        console.error(e);
      }
    }
    checkKeys();
  }, []);

  const handleTestOpenRouter = async () => {
    setTestingOr(true);
    setOrStatus('idle');
    try {
      // If they haven't typed a new key, we test the existing one
      // Since validate_api_key needs a key, if openRouterKey is empty, we can't test it directly 
      // unless backend supports testing stored key. The current validate_api_key takes `key: String`.
      // Actually we have to pass the new key, or if they just want to test stored, they can't.
      // Wait, let's assume they only test what they just typed.
      if (!openRouterKey && !hasOrKey) {
        setOrStatus('error');
        return;
      }
      // If we don't have a new key but have a stored one, how do we test it? 
      // For now, let's just test the typed key, and if valid, store it.
      if (openRouterKey) {
        const valid = await invoke<boolean>('validate_api_key', { provider: 'openrouter', key: openRouterKey });
        if (valid) {
          await invoke('store_api_key', { provider: 'openrouter', key: openRouterKey });
          setHasOrKey(true);
          setOrStatus('success');
        } else {
          setOrStatus('error');
        }
      }
    } catch (e) {
      setOrStatus('error');
    } finally {
      setTestingOr(false);
    }
  };

  const handleTestSerper = async () => {
    setTestingSerper(true);
    setSerperStatus('idle');
    try {
      if (serperKey) {
        // Serper doesn't have validate_api_key implemented in backend perhaps, wait, I can just save it for now
        await invoke('store_api_key', { provider: 'serper', key: serperKey });
        setHasSerperKey(true);
        setSerperStatus('success');
      }
    } catch (e) {
      setSerperStatus('error');
    } finally {
      setTestingSerper(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath && typeof selectedPath === 'string') {
        await invoke('set_workspace_path', { path: selectedPath });
        onWorkspaceChange(selectedPath);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', overflowY: 'auto' }}>
      <div style={{ padding: 'var(--space-xl)', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
        <SettingsIcon size={24} color="var(--accent-color)" />
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Settings</h2>
      </div>

      <div style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3xl)', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* API Keys */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-sm)' }}>API Configuration</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>OpenRouter API Key {hasOrKey && !openRouterKey && '(Stored securely)'}</label>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Key size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                <input 
                  type={showOpenRouter ? "text" : "password"} 
                  className="command-input" 
                  style={{ width: '100%', paddingLeft: 40, paddingRight: 40, border: '1px solid var(--border-color)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface-color)', fontSize: '0.9rem' }}
                  placeholder="sk-or-v1-..." 
                  value={openRouterKey} 
                  onChange={e => { setOpenRouterKey(e.target.value); setOrStatus('idle'); }} 
                />
                <button 
                  type="button"
                  onClick={() => setShowOpenRouter(!showOpenRouter)}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {showOpenRouter ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                className="praxis-btn" 
                onClick={handleTestOpenRouter} 
                disabled={testingOr || !openRouterKey}
                style={{ width: '140px', justifyContent: 'center' }}
              >
                {testingOr ? <Loader2 className="animate-spin" size={16} /> : 'Save & Test'}
              </button>
              {orStatus === 'success' && <CheckCircle size={20} color="var(--success)" />}
              {orStatus === 'error' && <XCircle size={20} color="var(--danger)" />}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Serper API Key (Optional) {hasSerperKey && !serperKey && '(Stored securely)'}</label>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Key size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                <input 
                  type={showSerper ? "text" : "password"} 
                  className="command-input" 
                  style={{ width: '100%', paddingLeft: 40, paddingRight: 40, border: '1px solid var(--border-color)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface-color)', fontSize: '0.9rem' }}
                  placeholder="Optional" 
                  value={serperKey} 
                  onChange={e => { setSerperKey(e.target.value); setSerperStatus('idle'); }} 
                />
                <button 
                  type="button"
                  onClick={() => setShowSerper(!showSerper)}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {showSerper ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                className="praxis-btn" 
                onClick={handleTestSerper} 
                disabled={testingSerper || !serperKey}
                style={{ width: '140px', justifyContent: 'center' }}
              >
                {testingSerper ? <Loader2 className="animate-spin" size={16} /> : 'Save'}
              </button>
              {serperStatus === 'success' && <CheckCircle size={20} color="var(--success)" />}
              {serperStatus === 'error' && <XCircle size={20} color="var(--danger)" />}
            </div>
          </div>
        </section>

        {/* Workspace Configuration */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-sm)' }}>Workspace</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Workspace Path</label>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Folder size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  className="command-input" 
                  style={{ width: '100%', paddingLeft: 40, border: '1px solid var(--border-color)', borderRadius: 4, boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
                  value={currentWorkspace} 
                  readOnly 
                />
              </div>
              <button 
                className="praxis-btn btn-primary" 
                onClick={handlePickFolder}
                style={{ width: '140px', justifyContent: 'center' }}
              >
                Change Folder
              </button>
            </div>
          </div>
        </section>

        {/* Security Configuration */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-sm)' }}>Security Level</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div 
              style={{ 
                padding: 'var(--space-lg)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                background: currentTrustTier === 'guarded' ? 'var(--accent-transparent)' : 'var(--surface-color)',
                borderColor: currentTrustTier === 'guarded' ? 'var(--accent-color)' : 'var(--border-color)',
                cursor: 'pointer',
                display: 'flex',
                gap: 'var(--space-md)'
              }}
              onClick={() => onTrustTierChange('guarded')}
            >
              <Shield size={24} color={currentTrustTier === 'guarded' ? 'var(--accent-color)' : 'var(--text-secondary)'} />
              <div>
                <h4 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--text-primary)' }}>Guarded Mode (Recommended)</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  The agent requires explicit user confirmation before executing any tool that modifies the filesystem or executes commands.
                </p>
              </div>
            </div>

            <div 
              style={{ 
                padding: 'var(--space-lg)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                background: currentTrustTier === 'trusted' ? 'var(--warning-transparent)' : 'var(--surface-color)',
                borderColor: currentTrustTier === 'trusted' ? 'var(--warning)' : 'var(--border-color)',
                cursor: 'pointer',
                display: 'flex',
                gap: 'var(--space-md)'
              }}
              onClick={() => onTrustTierChange('trusted')}
            >
              <ShieldAlert size={24} color={currentTrustTier === 'trusted' ? 'var(--warning)' : 'var(--text-secondary)'} />
              <div>
                <h4 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--text-primary)' }}>Trusted Session</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  The agent operates autonomously and can execute any tool without confirmation. High risk of accidental data modification.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
