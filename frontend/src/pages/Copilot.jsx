import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { 
  Brain, Send, Plus, ChevronDown, ChevronUp, Filter, Calendar, MessageSquare, Menu, X, CheckSquare, RefreshCw
} from 'lucide-react';
import { queryCopilot, getSessionHistory } from '../api/client';
import ConfidenceBadge from '../components/ConfidenceBadge';
import { useToast } from '../hooks/useToast';

const EXAMPLES = [
  "What is the maintenance history of pump P-101A?",
  "When was PRV-201 last inspected?",
  "What does OISD-118 say about fire extinguisher intervals?",
  "Who performed the last inspection on Unit 4?"
];

const DOC_TYPES = [
  { value: 'maintenance_record', label: 'Maintenance Records' },
  { value: 'safety_procedure', label: 'Safety Procedures' },
  { value: 'inspection_report', label: 'Inspection Reports' },
  { value: 'operating_instruction', label: 'Operating Instructions' },
  { value: 'regulatory_document', label: 'Regulations' }
];

export function Copilot() {
  const queryClient = useQueryClient();
  const { error: toastError, info } = useToast();
  
  // Sessions & Messages States
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessions, setSessions] = useState([]); // List of sessions { id, firstQuery, time }
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  
  // UI Panels
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedSources, setExpandedSources] = useState({}); // messageIndex -> bool
  
  // Filters
  const [filterDocTypes, setFilterDocTypes] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Auto-resize textarea height as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = (e) => {
    const el = e.target;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!isNearBottom);
  };

  // Load Session History from Backend
  const { data: sessionHistory = [], isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['sessionHistory', activeSessionId],
    queryFn: () => getSessionHistory(activeSessionId),
    enabled: !!activeSessionId,
    onSuccess: (data) => {
      // Map history backend schema to frontend message schema
      const mapped = data.map(msg => ({
        role: msg.role,
        content: msg.content,
        confidence_score: msg.confidence_score,
        confidence_label: msg.confidence_score >= 0.8 ? 'HIGH' : msg.confidence_score >= 0.5 ? 'MEDIUM' : 'LOW',
        sources: [],
        follow_up_suggestions: []
      }));
      setMessages(mapped);
    }
  });

  // Effect to sync react-query data to local state
  useEffect(() => {
    if (sessionHistory && sessionHistory.length > 0) {
      const mapped = sessionHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        confidence_score: msg.confidence_score,
        confidence_label: msg.confidence_score >= 0.8 ? 'HIGH' : msg.confidence_score >= 0.5 ? 'MEDIUM' : 'LOW',
        sources: [],
        follow_up_suggestions: []
      }));
      setMessages(mapped);
    }
  }, [sessionHistory]);

  // Query Copilot Mutation
  const copilotMutation = useMutation({
    mutationFn: (payload) => queryCopilot(payload),
    onSuccess: (data) => {
      const duration = startTimeRef.current ? ((Date.now() - startTimeRef.current) / 1000).toFixed(1) : null;
      // Add Assistant response
      const assistantMessage = {
        role: 'assistant',
        content: data.answer,
        confidence_score: data.confidence_score,
        confidence_label: data.confidence_label,
        sources: data.sources || [],
        follow_up_suggestions: data.follow_up_suggestions || [],
        responseTime: duration
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Update session ID if it was a new session
      if (!activeSessionId) {
        setActiveSessionId(data.session_id);
        const newSession = {
          id: data.session_id,
          firstQuery: data.query,
          time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        };
        setSessions([newSession, ...sessions]);
      }
    },
    onError: (err) => {
      toastError(`Copilot Query Failed: ${err.message || 'Server error'}`);
      // Remove the user's optimistic message if failed or mark error
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: Could not retrieve answer. Please make sure the backend is running. Details: ${err.message || 'Network error'}`,
        confidence_score: 0.0,
        sources: [],
        follow_up_suggestions: []
      }]);
    }
  });

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputValue;
    if (!text || !text.trim()) return;
    
    startTimeRef.current = Date.now();
    
    // Add User optimistically
    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsFilterOpen(false);

    // Call API
    const filters = {};
    if (filterDocTypes.length > 0) {
      filters.doc_type = filterDocTypes[0]; // Simple single type filter in RAG
    }
    
    copilotMutation.mutate({
      query: text,
      session_id: activeSessionId || undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      top_k: 5
    });
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setIsMobileSessionOpen(false);
  };

  const handleSessionClick = (id) => {
    setActiveSessionId(id);
    setIsMobileSessionOpen(false);
  };

  const toggleSourceAccordion = (idx) => {
    setExpandedSources((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const toggleDocTypeFilter = (val) => {
    if (filterDocTypes.includes(val)) {
      setFilterDocTypes(filterDocTypes.filter(v => v !== val));
    } else {
      setFilterDocTypes([...filterDocTypes, val]);
    }
  };

  // Session sidebar render helper
  const renderSessionList = () => (
    <div className="flex flex-col h-full bg-surface-sidebar justify-between p-3 select-none">
      <div className="space-y-4">
        {/* New Chat Button */}
        <button
          onClick={startNewChat}
          className="w-full flex items-center justify-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-sm py-2 px-4 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold text-text-secondary px-1 uppercase tracking-wider">
            <span>Sessions</span>
            {sessions.length > 0 && (
              <span className="bg-[#21262D] border border-surface-border text-text-muted px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                {sessions.length}
              </span>
            )}
          </div>
          
          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-text-muted italic p-3 text-center">
                No previous sessions. Start a new chat above.
              </p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSessionClick(s.id)}
                  className={`w-full text-left p-3 rounded-md border text-xs transition-colors block ${
                    activeSessionId === s.id
                      ? 'border-accent-blue bg-surface-card text-accent-blue font-semibold border-l-2'
                      : 'border-surface-border hover:bg-[#1C2128] text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="truncate font-medium mb-1 pr-4">{s.firstQuery}</div>
                  <div className="text-[10px] text-text-muted font-mono">{s.time}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="border-t border-surface-border pt-4 text-[10px] text-text-muted text-center font-mono select-none">
        Secure RAG • Local Graph Fallback
      </div>
    </div>
  );

  return (
    <div className="flex bg-surface-card border border-surface-border rounded-md min-h-[560px] max-h-[640px] overflow-hidden">
      
      {/* DESKTOP SESSION SIDEBAR */}
      <div className="hidden md:block w-[260px] border-r border-surface-border flex-shrink-0">
        {renderSessionList()}
      </div>

      {/* CHAT CONTAINER AREA */}
      <div className="flex-1 flex flex-col justify-between bg-surface-card relative">
        
        {/* Mobile Header Row */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-surface-border bg-surface-sidebar select-none">
          <button
            onClick={() => setIsMobileSessionOpen(true)}
            className="flex items-center gap-1.5 text-xs text-accent-blue font-semibold hover:underline"
          >
            <Menu className="w-4 h-4" />
            Sessions
          </button>
          <span className="text-xs font-mono text-text-muted truncate max-w-[160px]">
            {activeSessionId ? `Session: ${activeSessionId.slice(0, 8)}...` : 'New Chat'}
          </span>
          <button 
            onClick={startNewChat}
            className="p-1 border border-surface-border bg-[#1C2128] text-text-secondary hover:text-text-primary rounded"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* MESSAGES THREAD (SCROLLABLE) */}
        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="p-4 bg-accent-blue/10 border border-accent-blue/20 rounded-full animate-bounce">
                <Brain className="w-10 h-10 text-accent-blue" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary select-none">
                  Ask anything about your plant
                </h3>
                <p className="text-xs text-text-secondary max-w-sm select-none">
                  AIKI extracts answers directly from your maintenance records, safety instructions, and regulation manuals.
                </p>
              </div>

              {/* Example click chips */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-w-lg w-full pt-4 select-none">
                {EXAMPLES.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(ex)}
                    className="p-3 bg-surface hover:bg-[#1C2128] border border-surface-border text-left rounded-md text-xs text-text-primary transition-all duration-150 hover:border-accent-blue/40"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Stream */
            <div className="space-y-4">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[85%] p-4 shadow-sm transition-all duration-150 ${
                        isUser 
                          ? 'bg-accent-blue text-white rounded-[12px_12px_2px_12px]' 
                          : 'bg-surface border border-surface-border text-text-primary rounded-[12px_12px_12px_2px] space-y-3'
                      }`}
                    >
                      {/* User Text */}
                      {isUser ? (
                        <p className="text-sm font-medium whitespace-pre-wrap select-text">
                          {msg.content}
                        </p>
                      ) : (
                        /* Assistant Text */
                        <div className="space-y-3 select-text">
                          {/* Top Row: Confidence */}
                          <div className="flex justify-between items-center border-b border-surface-border pb-1.5 select-none">
                            <span className="text-[10px] text-text-muted font-mono">AIKI Operations Brain</span>
                            <ConfidenceBadge score={msg.confidence_score} label={msg.confidence_label} />
                          </div>

                          {/* Markdown Text */}
                          <div className="text-sm prose prose-invert max-w-none text-text-primary leading-relaxed">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>

                          {/* Response timing details */}
                          {msg.responseTime && (
                            <div className="text-[10px] text-text-muted font-mono select-none">
                              Answered in {msg.responseTime}s across {msg.sources?.length || 0} document{msg.sources?.length === 1 ? '' : 's'}
                            </div>
                          )}

                          {/* Sources Accordion */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="border-t border-surface-border pt-2 space-y-2 select-none">
                              <button
                                onClick={() => toggleSourceAccordion(idx)}
                                className="flex items-center gap-1.5 text-xs text-accent-blue font-semibold hover:underline"
                              >
                                {expandedSources[idx] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {expandedSources[idx] ? 'Hide sources' : `Show sources (${msg.sources.length})`}
                              </button>
                              
                              {expandedSources[idx] && (
                                <div className="grid grid-cols-1 gap-2 pt-1 transition-all duration-300">
                                  {msg.sources.map((src, sIdx) => {
                                    const dotColor = src.relevance_score > 0.8 ? 'bg-accent-green' : src.relevance_score > 0.5 ? 'bg-accent-amber' : 'bg-accent-red';
                                    return (
                                      <div key={sIdx} className="bg-[#1C2128] border border-surface-border p-3 rounded-md space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="font-mono text-accent-blue truncate max-w-[200px]">{src.filename}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-text-muted">Page {src.page}</span>
                                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} title={`relevance: ${Math.round(src.relevance_score * 100)}%`} />
                                          </div>
                                        </div>
                                        <p className="text-xs text-text-secondary italic leading-normal pl-2 border-l border-text-muted/20">
                                          "{src.excerpt}"
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Follow-up suggestions */}
                          {msg.follow_up_suggestions && msg.follow_up_suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 border-t border-surface-border pt-3 select-none">
                              {msg.follow_up_suggestions.map((q, qIdx) => (
                                <button
                                  key={qIdx}
                                  onClick={() => handleSendMessage(q)}
                                  className="text-xs border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 px-3 py-1.5 rounded-full font-medium transition-colors"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Copilot Loading Animation */}
              {copilotMutation.isPending && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-surface border border-surface-border p-4 rounded-[12px_12px_12px_2px] space-y-3 w-[320px] shadow-sm select-none">
                    <div className="flex justify-between items-center border-b border-surface-border pb-1.5">
                      <span className="text-[10px] text-text-muted font-mono">Thinking...</span>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-blue" />
                    </div>
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-[#30363D] rounded w-full" />
                      <div className="h-3 bg-[#30363D] rounded w-5/6" />
                      <div className="h-3 bg-[#30363D] rounded w-2/3" />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* INPUT INPUT BOX (STICKY BOTTOM) */}
        <div className="p-4 border-t border-surface-border bg-surface-sidebar sticky bottom-0 z-20 space-y-2">
          {/* Floating Scroll to Bottom Button */}
          {showScrollBtn && (
            <button
              onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute -top-12 right-4 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-full p-2.5 shadow-lg border border-accent-blue/30 transition-all duration-150 animate-bounce"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Input Form */}
          <div className="flex items-end bg-[#1C2128] border border-surface-border rounded-md px-3 py-2">
            
            {/* Filter Toggle Icon */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-1.5 rounded transition-colors mr-2 mb-0.5 flex-shrink-0 ${
                isFilterOpen || filterDocTypes.length > 0
                  ? 'bg-accent-blue/10 text-accent-blue' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-[#21262D]'
              }`}
              title="Filter context documents"
            >
              <Filter className="w-4.5 h-4.5" />
            </button>

            {/* Input Bar (Textarea for auto-resize, Enter to send, Shift+Enter for newline) */}
            <textarea
              ref={textareaRef}
              rows={1}
              maxLength={500}
              placeholder="Ask a question about Unit-4, pump P-101A, or OISD standards... (Enter to send)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={copilotMutation.isPending}
              className="bg-transparent border-none w-full text-sm text-text-primary placeholder-text-muted focus:outline-none disabled:text-text-muted resize-none max-h-[120px] py-1"
            />
            
            {/* Character count warning */}
            {inputValue.length > 400 && (
              <span className="text-[10px] text-text-muted font-mono mr-2 mb-1">
                {500 - inputValue.length}
              </span>
            )}

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || copilotMutation.isPending}
              className="p-1.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-[#21262D] text-white disabled:text-text-muted rounded transition-colors ml-2 mb-0.5 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* FILTERS PANEL (EXPANDABLE POPOVER) */}
          {isFilterOpen && (
            <div className="bg-surface border border-surface-border rounded-md p-4 absolute bottom-[72px] left-4 right-4 z-30 shadow-2xl space-y-4 select-none">
              <div className="flex justify-between items-center border-b border-surface-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Context Filters
                </h4>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Doc Type Checklist */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Document Type</span>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map((dt) => {
                    const isSelected = filterDocTypes.includes(dt.value);
                    return (
                      <button
                        key={dt.value}
                        onClick={() => toggleDocTypeFilter(dt.value)}
                        className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-accent-blue/10 border-accent-blue text-accent-blue font-semibold'
                            : 'bg-[#1C2128] border-surface-border text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                        {dt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-[#1C2128] border border-surface-border rounded p-1.5 text-xs text-text-primary w-full focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-[#1C2128] border border-surface-border rounded p-1.5 text-xs text-text-primary w-full focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET FOR SESSIONS */}
      {isMobileSessionOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 select-none md:hidden">
          <div className="flex-1" onClick={() => setIsMobileSessionOpen(false)} />
          <div className="h-[75%] bg-[#161B22] border-t border-surface-border rounded-t-xl overflow-hidden flex flex-col justify-between p-4">
            <div className="flex justify-between items-center border-b border-surface-border pb-3 mb-3">
              <span className="font-bold text-sm text-text-primary">Chat History</span>
              <button onClick={() => setIsMobileSessionOpen(false)}>
                <X className="w-5 h-5 text-text-secondary hover:text-text-primary" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {renderSessionList()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Copilot;
