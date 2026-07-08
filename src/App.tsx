import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { initCore, handleUserMessage, ExecutorEvent, TrustTier, executor, Conversation } from "./core";
import { Shield, ShieldAlert, Send, Loader2, Folder, CheckCircle, ChevronDown, ChevronRight, Terminal, Activity, MessageSquarePlus, MessageSquare } from "lucide-react";
import "./App.css";
import AuditLog from "./components/AuditLog";
import FileBrowser from "./components/FileBrowser";
import ModelStatus from "./components/ModelStatus";
import Settings from "./components/Settings";
import { Settings as SettingsIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import CommandPalette from "./components/CommandPalette";
import AnimatedNumber from "./components/AnimatedNumber";

type ViewState = 'loading' | 'onboarding' | 'chat' | 'audit_log' | 'files' | 'settings';

function App() {
  const [view, setViewState] = useState<ViewState>('loading');
  const [trustTier, setTrustTier] = useState<TrustTier>('guarded');
  
  const [workspacePath, setWorkspacePath] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Chat state
  const [messages, setMessages] = useState<{role: string, content: string, model?: string}[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing...');
  
  // Stats
  const [actionCount, setActionCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Command Palette
  const [cmdOpen, setCmdOpen] = useState(false);

  // Confirmation state
  const [pendingConfirm, setPendingConfirm] = useState<{
    actionId: string;
    tool: string;
    params: string;
    reasoning: string;
    reviewerConcern?: string;
    userMessage?: string;
  } | null>(null);

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingConfirm, isProcessing]);

  useEffect(() => {
    async function setup() {
      try {
        await initCore();
        const ws = await invoke<string>('get_workspace_path');
        setWorkspacePath(ws);

        const convs = await invoke<Conversation[]>('get_conversations');
        setConversations(convs);

        const hasOpenRouter = await invoke<boolean>('get_api_key_exists', { provider: 'openrouter' });
        if (hasOpenRouter) {
          setViewState('chat');
        } else {
          setViewState('settings'); // Fallback to settings to onboard
          toast("Please configure your API keys to begin.", { icon: "👋" });
        }
      } catch (err) {
        console.error("Setup failed", err);
      }
    }
    setup();

    const unlisten = listen<string>('llm_model_used', (event) => {
      setMessages(prev => {
        if (prev.length === 0) return prev;
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg.role === 'assistant' && !lastMsg.model) {
          lastMsg.model = event.payload;
        }
        return newMsgs;
      });
    });

    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);

    return () => {
      unlisten.then(f => f());
      document.removeEventListener('keydown', down);
    };
  }, []);

  const loadConversation = async (convId: string) => {
    setActiveConversationId(convId);
    try {
      const msgs = await invoke<{role: string, content: string}[]>('get_messages', { conversationId: convId });
      setMessages(msgs);
      setViewState('chat');
    } catch (e) {
      toast.error(`Failed to load conversation: ${e}`);
    }
  };

  const handleNewChat = async () => {
    setActiveConversationId(null);
    setMessages([]);
    setViewState('chat');
    setActionCount(0);
    setPendingCount(0);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isProcessing) return;

    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsProcessing(true);
    setLoadingText('Planning...');

    try {
      let convId = activeConversationId;
      if (!convId) {
        convId = await invoke<string>('create_conversation', { title: userMsg.slice(0, 30) + (userMsg.length > 30 ? "..." : "") });
        setActiveConversationId(convId);
        const convs = await invoke<Conversation[]>('get_conversations');
        setConversations(convs);
      }
      
      const onEvent = (event: ExecutorEvent) => {
        if (event.type === 'step_start') {
          setLoadingText(`Running ${event.step?.tool}...`);
          setActionCount(prev => prev + 1);
        } else if (event.type === 'confirmation_needed' && event.action && event.step) {
          setPendingConfirm({
            actionId: event.action.id,
            tool: event.step.tool,
            params: event.action.input_params_json,
            reasoning: event.step.reasoning,
            reviewerConcern: event.reviewerConcern,
            userMessage: userMsg
          });
          setPendingCount(prev => prev + 1);
          setLoadingText('Waiting for approval...');
          
          if (view !== 'chat') {
            toast('Action requires your confirmation.', { icon: '🛡️' });
          }
        } else if (event.type === 'confirmation_resolved') {
          setPendingConfirm(null);
          setShowTechnicalDetails(false);
          setPendingCount(prev => Math.max(0, prev - 1));
          setLoadingText('Continuing execution...');
        } else if (event.type === 'replanning') {
          setLoadingText('Encountered an issue, replanning...');
        } else if (event.type === 'complete') {
          if (view !== 'chat') {
            toast.success('Task completed in the background.');
          }
        }
      };

      const finalResponse = await handleUserMessage(convId, userMsg, trustTier, onEvent);
      setMessages(prev => [...prev, { role: 'assistant', content: finalResponse }]);
    } catch (err) {
      console.error("[APP ERROR]", err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err}` }]);
      toast.error('Task encountered an error');
    } finally {
      setIsProcessing(false);
      setPendingConfirm(null);
      setShowTechnicalDetails(false);
    }
  };

  const resolveConfirmation = async (approved: boolean) => {
    if (!pendingConfirm) return;
    try {
      if (approved) {
        await invoke('approve_action', { actionId: pendingConfirm.actionId });
      } else {
        await invoke('deny_action', { actionId: pendingConfirm.actionId });
      }
      executor.resolveConfirmation(pendingConfirm.actionId, approved);
    } catch (err) {
      console.error(err);
    }
  };

  if (view === 'loading') {
    return (
      <div className="app-wrapper" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-indicator">
          <Loader2 className="animate-spin" /> Starting Praxis Engine...
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' } }} />
      <CommandPalette 
        isOpen={cmdOpen} 
        onClose={() => setCmdOpen(false)} 
        onNavigate={(v) => setViewState(v)}
        onNewChat={handleNewChat}
      />

      <div style={{ display: 'flex' }}>
        <div data-tauri-drag-region style={{ flex: 1 }}>
          Praxis
        </div>
        <button onClick={() => appWindow.minimize().catch(e => console.error("MINIMIZE_ERROR", e))}>Minimize</button>
        <button onClick={() => appWindow.toggleMaximize().catch(e => console.error("MAXIMIZE_ERROR", e))}>Maximize</button>
        <button onClick={() => appWindow.close().catch(e => console.error("CLOSE_ERROR", e))}>Close</button>
      </div>

      <div className="app-container">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-nav">
            <div className={`nav-item ${view === 'chat' ? 'active' : ''}`} onClick={() => setViewState('chat')}>
              {view === 'chat' && <motion.div layoutId="activeNav" className="nav-item-bg" />}
              <Terminal size={18} style={{ zIndex: 1 }} /> <span style={{ zIndex: 1 }}>Chat</span>
            </div>
            <div className={`nav-item ${view === 'files' ? 'active' : ''}`} onClick={() => setViewState('files')}>
              {view === 'files' && <motion.div layoutId="activeNav" className="nav-item-bg" />}
              <Folder size={18} style={{ zIndex: 1 }} /> <span style={{ zIndex: 1 }}>Files</span>
            </div>
            <div className={`nav-item ${view === 'audit_log' ? 'active' : ''}`} onClick={() => setViewState('audit_log')}>
              {view === 'audit_log' && <motion.div layoutId="activeNav" className="nav-item-bg" />}
              <Activity size={18} style={{ zIndex: 1 }} /> <span style={{ zIndex: 1 }}>Audit Log</span>
            </div>
            <div className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setViewState('settings')}>
              {view === 'settings' && <motion.div layoutId="activeNav" className="nav-item-bg" />}
              <SettingsIcon size={18} style={{ zIndex: 1 }} /> <span style={{ zIndex: 1 }}>Settings</span>
            </div>
          </div>
          
          <div className="sidebar-history">
            <div className="history-header">
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>History</span>
              <button className="icon-btn" onClick={handleNewChat} title="New Chat"><MessageSquarePlus size={16} /></button>
            </div>
            <div className="history-list">
              {conversations.map(c => (
                <div 
                  key={c.id} 
                  className={`history-item ${activeConversationId === c.id ? 'active' : ''}`}
                  onClick={() => loadConversation(c.id)}
                >
                  <MessageSquare size={14} />
                  <span className="truncate">{c.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-footer">
            <ModelStatus />
            <div className="workspace-path" title={workspacePath}>
              {workspacePath || 'No Workspace'}
            </div>
            <div className={`trust-badge ${trustTier === 'trusted' ? 'trusted' : ''}`}>
              {trustTier === 'trusted' ? <ShieldAlert size={14} /> : <Shield size={14} />}
              {trustTier === 'trusted' ? 'Trusted Session' : 'Guarded Mode'}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}
          >
            {view === 'settings' && (
              <Settings 
                currentWorkspace={workspacePath} 
                onWorkspaceChange={setWorkspacePath} 
                currentTrustTier={trustTier} 
                onTrustTierChange={setTrustTier} 
              />
            )}
            {view === 'audit_log' && <AuditLog conversationId={activeConversationId} />}
            {view === 'files' && <FileBrowser />}
            
            {view === 'chat' && (
              <div className="main-content">
                <div className="stats-bar">
                  <div className="stat-item">Messages: <span className="stat-value"><AnimatedNumber value={messages.filter(m => m.role === 'user').length} /></span></div>
                  <div className="stat-item">Actions: <span className="stat-value"><AnimatedNumber value={actionCount} /></span></div>
                  <div className="stat-item">Pending: <span className="stat-value"><AnimatedNumber value={pendingCount} /></span></div>
                </div>

                <div className="chat-scroll-area">
                  {messages.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
                      <Shield className="empty-state-icon" size={48} />
                      <h2>How can I help you today?</h2>
                      <div className="empty-chips">
                        <motion.div whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} className="chip" onClick={() => handleSend("Summarize the files in this workspace")}>Summarize workspace</motion.div>
                        <motion.div whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} className="chip" onClick={() => handleSend("Search the web for the latest Rust news")}>Search the web</motion.div>
                        <motion.div whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} className="chip" onClick={() => handleSend("Create a new hello_world.rs file")}>Create a new file</motion.div>
                      </div>
                    </motion.div>
                  ) : (
                    messages.map((m, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`message-bubble ${m.role}`}
                      >
                        {m.role === 'assistant' && m.model && (
                          <div className="model-badge">
                            <div className="dot"></div>
                            {m.model}
                          </div>
                        )}
                        {m.content.split('\n').map((line, j) => <p key={j}>{line}</p>)}
                      </motion.div>
                    ))
                  )}

                  <AnimatePresence>
                    {pendingConfirm && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`confirmation-card ${pendingConfirm.reviewerConcern ? 'warning' : ''}`}
                      >
                        <div className="confirmation-header">
                          {pendingConfirm.reviewerConcern ? <ShieldAlert size={20} /> : <Shield size={20} />}
                          <h3>Action Requires Confirmation</h3>
                        </div>
                        
                        <div className="confirmation-reasoning">
                          "{pendingConfirm.reasoning}"
                        </div>

                        {pendingConfirm.reviewerConcern && (
                          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--warning-transparent)', borderLeft: '3px solid var(--warning)', borderRadius: '4px' }}>
                            <strong style={{ color: 'var(--warning)', display: 'block', marginBottom: '8px' }}>Security Reviewer Concern</strong>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                              <strong>Original Request:</strong> {pendingConfirm.userMessage}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#fca5a5' }}>
                              {pendingConfirm.reviewerConcern}
                            </p>
                          </div>
                        )}

                        <div className="technical-details">
                          <div className="technical-summary" onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}>
                            {showTechnicalDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            Technical Details: {pendingConfirm.tool}
                          </div>
                          <AnimatePresence>
                            {showTechnicalDetails && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="technical-content"
                              >
                                {JSON.stringify(JSON.parse(pendingConfirm.params), null, 2)}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="confirmation-actions">
                          <button className="praxis-btn btn-deny" onClick={() => resolveConfirmation(false)}>
                            Deny
                          </button>
                          <button className="praxis-btn btn-primary" onClick={() => resolveConfirmation(true)}>
                            <CheckCircle size={16} /> Approve
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isProcessing && !pendingConfirm && (
                    <div className="loading-indicator">
                      <Loader2 className="animate-spin" size={16} /> {loadingText}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <div className="command-bar-wrapper">
                  <form 
                    className="command-bar"
                    onSubmit={e => {
                      e.preventDefault();
                      handleSend();
                    }}
                  >
                    <input 
                      type="text" 
                      className="command-input" 
                      placeholder="Command Praxis... (Cmd+K for menu)" 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      disabled={isProcessing}
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      className="send-btn"
                      disabled={!input.trim() || isProcessing}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
