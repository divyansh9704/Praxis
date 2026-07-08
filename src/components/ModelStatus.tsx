import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Cpu } from 'lucide-react';

const ModelStatus: React.FC = () => {
  const [model, setModel] = useState<string>('Auto-Router');

  useEffect(() => {
    const unlisten = listen<string>('llm_model_used', (event) => {
      setModel(event.payload);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', padding: 'var(--space-sm) var(--space-md)', background: 'var(--bg-color)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        <Cpu size={12} />
        <span>Active LLM</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={model}>
          {model}
        </span>
      </div>
    </div>
  );
};

export default ModelStatus;
