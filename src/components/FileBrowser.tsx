import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Folder, File, ChevronLeft, Loader2 } from 'lucide-react';

interface FileInfo {
  name: string;
  is_dir: boolean;
}

const FileBrowser: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // File preview state
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError('');
    setPreviewContent(null);
    setPreviewFile(null);
    try {
      const result = await invoke<FileInfo[]>('tool_list_dir', { path: path || '.' });
      setFiles(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: FileInfo) => {
    const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    
    if (item.is_dir) {
      setCurrentPath(newPath);
    } else {
      setPreviewFile(item.name);
      setPreviewLoading(true);
      setError('');
      try {
        const content = await invoke<string>('tool_read_file', { path: newPath });
        setPreviewContent(content);
      } catch (err) {
        setError(`Failed to read file: ${err}`);
        setPreviewContent(null);
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* File Tree / List */}
      <div style={{ width: '300px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
        <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button 
            className="titlebar-btn" 
            style={{ width: 'auto', padding: '4px', borderRadius: '4px', opacity: currentPath ? 1 : 0.5 }}
            onClick={handleNavigateUp}
            disabled={!currentPath}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentPath || '/ (Workspace Root)'}
          </span>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
          {loading ? (
            <div className="loading-indicator"><Loader2 className="animate-spin" size={16} /> Loading...</div>
          ) : error && !previewFile ? (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>
          ) : files.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>Empty directory</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {files.map(f => (
                <div 
                  key={f.name}
                  className="nav-item"
                  style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: '4px' }}
                  onClick={() => handleItemClick(f)}
                >
                  {f.is_dir ? <Folder size={16} color="var(--accent-color)" /> : <File size={16} color="var(--text-secondary)" />}
                  <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-color)' }}>
        {previewFile ? (
          <>
            <div style={{ padding: 'var(--space-md) var(--space-xl)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <File size={18} color="var(--text-secondary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{previewFile}</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-xl)' }}>
              {previewLoading ? (
                <div className="loading-indicator"><Loader2 className="animate-spin" size={16} /> Reading file...</div>
              ) : error ? (
                <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>
              ) : (
                <pre style={{ 
                  margin: 0, 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.85rem', 
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {previewContent}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <File className="empty-state-icon" size={48} />
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Select a file to preview</h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileBrowser;
