import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Activity, CheckCircle, XCircle, Clock, ShieldAlert, ChevronRight, ChevronDown, Terminal, FileText, Search, Filter } from "lucide-react";
import { Action } from "../core/types";

export default function AuditLog({ conversationId }: { conversationId: string | null }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadLogs() {
      if (!conversationId) {
        setActions([]);
        setLoading(false);
        return;
      }
      try {
        const data = await invoke<Action[]>('get_actions', { conversationId });
        setActions(data.reverse()); // Newest first
      } catch (err) {
        console.error("Failed to load audit logs", err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [conversationId]);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedCards);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedCards(newSet);
  };

  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      const matchesStatus = statusFilter === 'all' || action.status === statusFilter;
      const matchesSearch = !searchQuery || 
        action.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        action.reasoning.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [actions, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-indicator">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', overflow: 'hidden' }}>
      {/* Header & Controls */}
      <div style={{ padding: 'var(--space-xl)', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-color)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-lg)', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Activity size={24} color="var(--accent-color)" />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Audit Log</h2>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1, maxWidth: '600px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search tools or reasoning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="command-input"
              style={{ width: '100%', paddingLeft: 36, border: '1px solid var(--border-color)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--bg-color)', fontSize: '0.9rem' }}
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="command-input"
              style={{ paddingLeft: 36, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-color)', fontSize: '0.9rem', color: 'var(--text-primary)', appearance: 'none', paddingRight: 'var(--space-xl)' }}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {actions.length === 0 ? (
          <div className="empty-state">
            <Activity className="empty-state-icon" size={48} />
            <h2 style={{ fontSize: '1.2rem' }}>No actions recorded</h2>
            <p>Actions taken by the agent will appear here.</p>
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="empty-state" style={{ height: '50%' }}>
            <p>No actions match your filters.</p>
          </div>
        ) : (
          filteredActions.map((action) => {
            const isExpanded = expandedCards.has(action.id);
            const statusConfig = getStatusConfig(action.status);
            
            return (
              <div key={action.id} style={{ 
                background: 'var(--surface-color)', 
                border: '1px solid var(--border-color)', 
                borderLeft: `3px solid ${statusConfig.color}`, 
                borderRadius: '8px',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    {getToolIcon(action.tool_name)}
                    <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>{action.tool_name}</strong>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.7rem', 
                      background: 'var(--bg-color)',
                      border: '1px solid var(--border-color)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {action.trust_tier}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '4px', 
                      padding: '2px 8px', borderRadius: '12px', 
                      fontSize: '0.75rem', 
                      background: statusConfig.bg, 
                      color: statusConfig.color 
                    }}>
                      {statusConfig.icon}
                      <span style={{ textTransform: 'capitalize' }}>{action.status}</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginLeft: 'var(--space-sm)' }}>
                      {new Date(action.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>Reasoning:</span> 
                  {action.reasoning}
                </div>

                <div className="technical-details" style={{ margin: 0 }}>
                  <div className="technical-summary" onClick={() => toggleExpand(action.id)}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {isExpanded ? 'Hide Payload' : 'Show Payload'}
                  </div>
                  {isExpanded && (
                    <div className="technical-content">
                      {action.input_params_json}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed': return { color: 'var(--success)', bg: 'var(--success-transparent)', icon: <CheckCircle size={12} /> };
    case 'approved': return { color: 'var(--accent-color)', bg: 'var(--accent-transparent)', icon: <CheckCircle size={12} /> };
    case 'rejected': return { color: 'var(--danger)', bg: 'var(--danger-transparent)', icon: <XCircle size={12} /> };
    case 'failed': return { color: 'var(--danger)', bg: 'var(--danger-transparent)', icon: <ShieldAlert size={12} /> };
    case 'pending': return { color: 'var(--warning)', bg: 'var(--warning-transparent)', icon: <Clock size={12} /> };
    default: return { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)', icon: <Activity size={12} /> };
  }
}

function getToolIcon(toolName: string) {
  if (toolName.includes('file') || toolName.includes('dir')) return <FileText size={18} color="var(--text-secondary)" />;
  if (toolName.includes('command') || toolName.includes('shell')) return <Terminal size={18} color="var(--text-secondary)" />;
  if (toolName.includes('search')) return <Search size={18} color="var(--text-secondary)" />;
  return <Activity size={18} color="var(--text-secondary)" />;
}
