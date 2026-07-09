import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Loader2, Database, Wrench, Coins, Cpu, CheckCircle } from 'lucide-react';
import { List as FixedSizeList } from 'react-window';
const VirtualList: any = FixedSizeList;

interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  supported_parameters: string[];
}

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [preferredModel, setPreferredModel] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load preferred model from backend preferences DB
        try {
          const prefs: any[] = await invoke('get_preferences', { memoryType: 'system' });
          const prefModel = prefs.find(p => p.key === 'preferred_model');
          if (prefModel) {
            setPreferredModel(prefModel.value);
          }
        } catch (dbErr) {
          console.warn("Could not load preferences from DB:", dbErr);
        }

        const data: any = await invoke('fetch_openrouter_models');
        if (data && data.data) {
          setModels(data.data as Model[]);
        } else {
          setError('Invalid data format received from OpenRouter');
        }
      } catch (err: any) {
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSelectModel = async (id: string) => {
    try {
      setPreferredModel(id);
      // Persist to backend DB
      await invoke('set_preference', {
        key: 'preferred_model',
        value: id,
        memoryType: 'system'
      });
    } catch (e) {
      console.error("Failed to save preference:", e);
    }
  };

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const lowerSearch = search.toLowerCase();
    return models.filter(m => 
      m.id.toLowerCase().includes(lowerSearch) || 
      m.name.toLowerCase().includes(lowerSearch)
    );
  }, [models, search]);

  const Row = ({ index, style }: { index: number, style: CSSProperties }) => {
    const model = filteredModels[index];
    if (!model) return null;
    
    // We adjust the style slightly so there is a gap between items
    const rowStyle = {
      ...style,
      top: (style.top as number) + 8,
      height: (style.height as number) - 16,
    };

    return (
      <div style={rowStyle}>
        <div style={{ 
          height: '100%',
          padding: 'var(--space-lg)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 8, 
          background: preferredModel === model.id ? 'var(--accent-transparent)' : 'var(--surface-color)',
          borderColor: preferredModel === model.id ? 'var(--accent-color)' : 'var(--border-color)',
          display: 'flex', 
          flexDirection: 'column', 
          gap: 'var(--space-sm)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-xs) 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                {model.name}
                {preferredModel === model.id && <CheckCircle size={16} color="var(--accent-color)" />}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{model.id}</div>
            </div>
            <button 
              className={`praxis-btn ${preferredModel === model.id ? 'btn-primary' : ''}`}
              onClick={() => handleSelectModel(model.id)}
            >
              {preferredModel === model.id ? 'Active' : 'Use Model'}
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--space-lg)', marginTop: 'var(--space-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={14} /> {Math.round(model.context_length / 1024)}k context
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Coins size={14} /> 
              {model.id.endsWith(':free') ? 'Free' : `$${Number(model.pricing.prompt) * 1000000}/M input`}
            </div>
            {model.supported_parameters?.includes('tools') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)' }}>
                <Wrench size={14} /> Tools Supported
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-xl)', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <Database size={24} color="var(--accent-color)" />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Models</h2>
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="command-input"
            style={{ width: '100%', paddingLeft: 40, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-color)' }}
            placeholder="Search models by name or ID..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ flex: 1, padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={18} /> Fetching models from OpenRouter...
          </div>
        )}
        
        {error && (
          <div style={{ color: 'var(--danger)', padding: 'var(--space-md)', border: '1px solid var(--danger)', borderRadius: 8, background: 'var(--danger-transparent)' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', height: '100%' }}>
            {filteredModels.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                No models found matching "{search}"
              </div>
            ) : (
              <VirtualList
                height={800} // We can make this responsive later, hardcoded for demonstration
                width="100%"
                itemCount={filteredModels.length}
                itemSize={130} // 130px height per item row
              >
                {Row}
              </VirtualList>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
