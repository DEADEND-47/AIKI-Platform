import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Search, FileText, X, Filter, ChevronRight, RefreshCw, Layers } from 'lucide-react';
import { listDocuments, uploadDocuments, getDocument, getJobStatus, getDocumentVersions, compareDocumentVersions } from '../api/client';
import EntityChip from '../components/EntityChip';
import SkeletonTable from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import EquipmentTimelineModal from '../components/EquipmentTimelineModal';

const DOC_TYPES = [
  { value: 'maintenance_record', label: 'Maintenance Record' },
  { value: 'safety_procedure', label: 'Safety Procedure' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'engineering_drawing', label: 'Engineering Drawing' },
  { value: 'operating_instruction', label: 'Operating Instruction' },
  { value: 'regulatory_document', label: 'Regulatory Document' },
  { value: 'other', label: 'Other' },
];

export function Documents() {
  const queryClient = useQueryClient();
  const { success, error: toastError, info } = useToast();
  
  const activePlantId = localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111';

  // States
  const [selectedDocType, setSelectedDocType] = useState('maintenance_record');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDocType, setFilterDocType] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobProgress, setJobProgress] = useState(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [activeEntityTab, setActiveEntityTab] = useState('equipment_tag');
  
  const [compareDocId, setCompareDocId] = useState('');
  const [activeTimelineTag, setActiveTimelineTag] = useState(null);

  const pollIntervalRef = useRef(null);

  // Check URL query parameters for auto-opening doc drawer
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openDocId = params.get('open');
    if (openDocId) {
      setSelectedDocId(openDocId);
      // Clean up the URL search parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFiles(acceptedFiles);
    },
    maxFiles: 5
  });

  // Tag list helpers
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const removeTag = (t) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  // List Documents query
  const { data: documentList = [], isLoading, refetch } = useQuery({
    queryKey: ['documents', filterDocType, searchQuery, activePlantId],
    queryFn: () => listDocuments({ 
      doc_type: filterDocType || undefined,
      plant_id: activePlantId
    }),
    refetchInterval: 5000, // Refresh documents table every 5s
  });

  // Client-side search filtering of listed documents
  const filteredDocs = documentList.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = filterTag ? (doc.tags || []).some(t => t.toLowerCase().includes(filterTag.toLowerCase())) : true;
    return matchesSearch && matchesTag;
  });

  // Selected Document details query
  const { data: docDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['documentDetails', selectedDocId],
    queryFn: () => getDocument(selectedDocId),
    enabled: !!selectedDocId,
  });

  // Document Versions query
  const { data: docVersions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ['documentVersions', selectedDocId],
    queryFn: () => getDocumentVersions(selectedDocId),
    enabled: !!selectedDocId,
  });

  // Versions Compare query
  const { data: compareResult, isLoading: isLoadingCompare } = useQuery({
    queryKey: ['versionsCompare', selectedDocId, compareDocId],
    queryFn: () => compareDocumentVersions(selectedDocId, compareDocId),
    enabled: !!selectedDocId && !!compareDocId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    queryKey: ['uploadDocuments'],
    mutationFn: (formData) => uploadDocuments(formData),
    onSuccess: (data) => {
      success('Files uploaded successfully! Starting ingestion pipeline...');
      setFiles([]);
      setTags([]);
      setActiveJobId(data.job_id);
      setJobProgress({
        progress: 0,
        documents_processed: 0,
        entities_extracted: 0,
        status: 'queued'
      });
    },
    onError: (err) => {
      toastError(`Upload failed: ${err.message || 'Server error'}`);
    }
  });

  const handleUpload = () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('doc_type', selectedDocType);
    if (tags.length > 0) {
      formData.append('tags', tags.join(','));
    }
    formData.append('plant_id', activePlantId);
    uploadMutation.mutate(formData);
  };

  // Job WebSocket Progress
  useEffect(() => {
    if (!activeJobId) return;
    
    const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
                  (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')
                    .replace('http://', '')
                    .replace('https://', '')
                    .replace('/api/v1', '') + 
                  `/ws/jobs/${activeJobId}`;
                  
    const socket = new WebSocket(wsUrl);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Received progress update:", data);
        setJobProgress(data);
        if (['completed', 'failed', 'completed_with_errors'].includes(data.status)) {
          queryClient.invalidateQueries(['documents']);
          socket.close();
        }
      } catch (e) {
        console.error("[WS] Error parsing websocket update:", e);
      }
    };
    
    return () => {
      socket.close();
    };
  }, [activeJobId, queryClient]);

  // Job Polling & Animation
  useEffect(() => {
    if (!activeJobId) return;
    
    // Animate displayProgress smoothly
    const animationTimer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (!jobProgress) return Math.min(prev + 1, 15);
        if (jobProgress.status === 'queued') return Math.min(prev + 1, 15);
        if (jobProgress.status === 'processing') {
          const target = jobProgress.progress || 20;
          return Math.min(prev + 0.5, target - 2);
        }
        if (['completed', 'completed_with_errors'].includes(jobProgress.status)) {
          return 100;
        }
        return prev;
      });
    }, 100);

    const pollJob = async () => {
      try {
        const data = await getJobStatus(activeJobId);
        setJobProgress(data);
        
        const isFinished = ['completed', 'failed', 'completed_with_errors'].includes(data.status);
        if (isFinished) {
          clearInterval(pollIntervalRef.current);
          clearInterval(animationTimer);
          
          if (data.status === 'completed' || data.status === 'completed_with_errors') {
            const errSuffix = data.status === 'completed_with_errors' ? ' (some files failed)' : '';
            success(`Ingestion complete${errSuffix}! Extracted ${data.entities_extracted} entities.`);
            setDisplayProgress(100);
          } else {
            toastError(`Ingestion pipeline failed: ${data.error || 'Unknown error'}`);
            setDisplayProgress(0);
          }
          
          // Clear active states after a small delay so progress bar shows 100% complete briefly
          setTimeout(() => {
            setActiveJobId(null);
            setJobProgress(null);
            setDisplayProgress(0);
            queryClient.invalidateQueries(['documents']);
          }, 1500);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollJob, 1500); // 1.5s interval
    return () => {
      clearInterval(pollIntervalRef.current);
      clearInterval(animationTimer);
    };
  }, [activeJobId, jobProgress, queryClient]);

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Upload Zone */}
        <div className="flex-1 bg-surface-card border border-surface-border rounded-md p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">
            Document Ingestion Pipeline
          </h2>
          
          {/* react-dropzone Area */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-150 ${
              isDragActive ? 'border-accent-blue bg-accent-blue/5' : 'border-surface-border hover:border-text-muted hover:bg-[#1C2128]'
            }`}
            style={{ minHeight: '120px' }}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-text-secondary mb-2" />
            <p className="text-sm font-medium text-text-primary">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Supports PDF, PNG, JPG, XLSX, CSV
            </p>
          </div>

          {/* Files Selected list */}
          {files.length > 0 && (
            <div className="bg-surface p-3 rounded-md border border-surface-border space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary">Selected Files:</p>
              {files.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-mono text-text-primary truncate max-w-[280px]">
                    {file.name}
                  </span>
                  <span className="text-text-muted">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upload Controls Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Doc Type Dropdown */}
            <div className="flex-1 min-w-[150px]">
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full bg-[#1C2128] border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Tag Input */}
            <div className="flex-1 min-w-[200px] flex items-center bg-[#1C2128] border border-surface-border rounded px-3 py-1 text-sm">
              <input
                type="text"
                placeholder="Enter tags (Enter or comma)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="bg-transparent border-none w-full py-1 text-text-primary placeholder-text-muted focus:outline-none"
              />
            </div>
          </div>

          {/* Tags List */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-[#21262D] border border-[#30363D] text-xs px-2 py-0.5 rounded text-text-primary">
                  {t}
                  <button onClick={() => removeTag(t)} className="text-text-muted hover:text-accent-red">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Ingest Action Button */}
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploadMutation.isPending}
            className="w-full bg-accent-blue hover:bg-accent-blue/90 disabled:bg-[#21262D] disabled:text-text-muted text-white font-medium text-sm py-2 px-4 rounded transition-colors"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Ingest and Process Documents'}
          </button>
        </div>

        {/* Right Side: Active Upload Progress Card */}
        {jobProgress && (
          <div className="w-full lg:w-[320px] bg-surface-card border border-surface-border rounded-md p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-text-primary">Ingestion Active</h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-amber"></span>
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Pipeline Status:</span>
                <span className="font-semibold text-accent-amber uppercase tracking-wider">
                  {jobProgress.status}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-text-secondary">
                  <span>Progress</span>
                  <span>{Math.round(displayProgress)}%</span>
                </div>
                <div className="w-full bg-[#21262D] h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-accent-blue h-full rounded-full transition-all duration-300"
                    style={{ width: `${displayProgress}%` }}
                  />
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-2 bg-surface p-3 rounded border border-surface-border text-center">
                <div>
                  <div className="text-xs text-text-secondary">Files</div>
                  <div className="text-base font-bold text-text-primary font-mono mt-0.5">
                    {jobProgress.documents_processed}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">Entities</div>
                  <div className="text-base font-bold text-accent-green font-mono mt-0.5">
                    {jobProgress.entities_extracted}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-text-muted mt-4 font-mono text-center">
              Job ID: {jobProgress.job_id}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Filter Bar */}
      <div className="bg-surface-card border border-surface-border rounded-md p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search documents by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1C2128] border border-surface-border rounded pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Doc Type Filter */}
          <select
            value={filterDocType}
            onChange={(e) => setFilterDocType(e.target.value)}
            className="bg-[#1C2128] border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
          >
            <option value="">All Document Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Tag Filter */}
          <input
            type="text"
            placeholder="Filter by tag..."
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-[#1C2128] border border-surface-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue w-32 md:w-40"
          />

          <button 
            onClick={() => refetch()} 
            className="p-2 border border-surface-border rounded bg-[#1C2128] hover:bg-[#21262D] text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh documents list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section 3: Document Table */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : filteredDocs.length === 0 ? (
        <EmptyState 
          icon="file" 
          title="No documents indexed" 
          subtitle="Upload industrial work orders, checklists, or procedures above to begin building the knowledge brain."
        />
      ) : (
        <div className="border border-surface-border rounded-md bg-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-surface-border text-xs uppercase tracking-wider text-text-secondary">
                  <th className="p-4 font-semibold">Filename</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-center">Entities</th>
                  <th className="p-4 font-semibold">Uploaded</th>
                  <th className="p-4 font-semibold">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-sm">
                {filteredDocs.map((doc) => {
                  const statusColors = {
                    queued: 'bg-text-muted/20 text-text-secondary border-text-muted/30',
                    processing: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
                    completed: 'bg-accent-green/10 text-accent-green border-accent-green/20',
                    failed: 'bg-accent-red/10 text-accent-red border-accent-red/20',
                  };
                  const pillStyle = statusColors[doc.status] || statusColors.queued;
                  
                  return (
                    <tr 
                      key={doc.doc_id}
                      onClick={() => setSelectedDocId(doc.doc_id)}
                      className="hover:bg-[#1C2128] cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-medium text-text-primary">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-accent-blue" />
                          <span className="font-mono text-xs">{doc.filename}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-semibold capitalize text-text-secondary">
                        {doc.doc_type.replace('_', ' ')}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold border rounded ${pillStyle}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-xs font-semibold text-accent-blue">
                        {doc.entity_count}
                      </td>
                      <td className="p-4 text-xs text-text-secondary">
                        {formatDate(doc.upload_timestamp)}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {doc.tags && doc.tags.length > 0 ? (
                            doc.tags.slice(0, 2).map((t) => (
                              <span key={t} className="text-[10px] bg-[#21262D] border border-surface-border px-1.5 py-0.5 rounded text-text-secondary">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-text-muted italic">no tags</span>
                          )}
                          {doc.tags && doc.tags.length > 2 && (
                            <span className="text-[10px] text-text-muted">
                              +{doc.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: Document Side Drawer Panel */}
      {selectedDocId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 select-none">
          {/* Overlay click to close */}
          <div className="flex-1" onClick={() => setSelectedDocId(null)} />
          
          <div className="w-full md:w-[450px] bg-[#161B22] border-l border-surface-border p-6 overflow-y-auto shadow-2xl flex flex-col justify-between pointer-events-auto">
            {isLoadingDetails ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-6 bg-[#30363D] rounded w-3/4" />
                <div className="h-4 bg-[#30363D] rounded w-1/2" />
                <div className="space-y-3 pt-6">
                  <div className="h-20 bg-[#30363D] rounded w-full" />
                  <div className="h-20 bg-[#30363D] rounded w-full" />
                </div>
              </div>
            ) : docDetails ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-surface-border pb-4">
                  <div className="space-y-1 max-w-[340px]">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted font-bold block">
                      Doc ID: {docDetails.metadata.doc_id.slice(0, 8)}...
                    </span>
                    <h3 className="text-base font-bold text-text-primary truncate font-mono">
                      {docDetails.metadata.filename}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs bg-[#21262D] border border-surface-border px-2 py-0.5 rounded capitalize text-text-secondary">
                        {docDetails.metadata.doc_type.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        Pages: {docDetails.metadata.page_count}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedDocId(null)} 
                    className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-[#1C2128]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Metadata Row */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Status:</span>
                    <span className="text-accent-green font-semibold uppercase">{docDetails.metadata.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Extracted:</span>
                    <span className="text-text-primary font-mono">{docDetails.metadata.entity_count} entities</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Indexed On:</span>
                    <span className="text-text-primary">{formatDate(docDetails.metadata.upload_timestamp)}</span>
                  </div>
                </div>

                {/* Contradiction Warning Banner */}
                {docDetails.contradictions && docDetails.contradictions.length > 0 && (
                  <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-3.5 space-y-2 select-text">
                    <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs uppercase tracking-wider">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      {docDetails.contradictions.length} Contradiction{docDetails.contradictions.length > 1 ? 's' : ''} Detected
                    </div>
                    {docDetails.contradictions.map((c, i) => (
                      <div key={i} className="text-[11px] text-[#7D8590] border-t border-surface-border/20 pt-2 first:border-0 first:pt-0">
                        <div className="font-semibold text-[#E6EDF3] mb-1">Topic: {c.topic} ({c.equipment_tag})</div>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="bg-[#1C2128] p-1.5 rounded border border-surface-border text-[10px]">
                            <span className="text-accent-blue block font-bold uppercase text-[9px] mb-0.5">This Doc:</span>
                            "{c.new_doc_says}"
                          </div>
                          <div className="bg-[#1C2128] p-1.5 rounded border border-surface-border text-[10px]">
                            <span className="text-text-muted block font-bold uppercase text-[9px] mb-0.5">{c.related_filename}:</span>
                            "{c.existing_doc_says}"
                          </div>
                        </div>
                        <div className="text-[10px] text-accent-amber mt-1 bg-accent-amber/5 border border-accent-amber/20 px-2 py-1 rounded">
                          💡 <strong>Resolution:</strong> {c.resolution}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {docDetails.metadata.tags && docDetails.metadata.tags.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-text-secondary">Associated Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {docDetails.metadata.tags.map((t) => (
                        <span key={t} className="text-xs bg-surface border border-surface-border px-2 py-0.5 rounded text-text-primary">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Versioning & History Timeline */}
                <div className="space-y-3 bg-[#1C2128] border border-surface-border rounded-md p-3.5 select-none">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-accent-blue" />
                      Document Version History
                    </h4>
                    <span className="text-[10px] font-mono bg-accent-blue/10 border border-accent-blue/20 px-1.5 py-0.2 rounded text-accent-blue">
                      v{docDetails.metadata.version} {docDetails.metadata.is_latest ? '(Latest)' : ''}
                    </span>
                  </div>

                  {/* Versions Timeline List */}
                  {isLoadingVersions ? (
                    <div className="text-[10px] text-text-muted italic">Loading versions...</div>
                  ) : docVersions.length <= 1 ? (
                    <p className="text-[10px] text-text-muted">No historical versions exist for this procedure.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pt-1">
                        {docVersions.map((v) => (
                          <button
                            key={v.doc_id}
                            onClick={() => { setSelectedDocId(v.doc_id); setCompareDocId(''); }}
                            className={`text-[10px] font-mono px-2 py-0.8 rounded border transition-colors ${
                              v.doc_id === selectedDocId
                                ? 'bg-accent-blue/20 text-white border-accent-blue'
                                : 'bg-surface text-text-secondary border-surface-border hover:border-text-muted'
                            }`}
                          >
                            v{v.version} {v.is_latest ? '★' : ''}
                          </button>
                        ))}
                      </div>

                      {/* Compare Selector */}
                      <div className="pt-2 border-t border-surface-border/50 space-y-1.5">
                        <label className="text-[9px] uppercase font-mono tracking-wider text-text-muted font-bold block">
                          Compare with another version
                        </label>
                        <select
                          value={compareDocId}
                          onChange={(e) => setCompareDocId(e.target.value)}
                          className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:border-accent-blue cursor-pointer"
                        >
                          <option value="">-- Select version --</option>
                          {docVersions
                            .filter(v => v.doc_id !== selectedDocId)
                            .map(v => (
                              <option key={v.doc_id} value={v.doc_id}>
                                Version {v.version} ({formatDate(v.upload_timestamp)})
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Compare results box */}
                  {compareDocId && compareResult && (
                    <div className="mt-3 bg-surface border border-surface-border rounded p-3 space-y-2 text-[11px] select-text">
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-surface-border/50 pb-1 mb-1">
                        <span className="text-text-muted">Compare Results</span>
                        <button onClick={() => setCompareDocId('')} className="text-accent-red hover:underline">Clear</button>
                      </div>
                      <p className="text-text-secondary leading-relaxed font-medium">
                        {compareResult.summary}
                      </p>
                      
                      {/* Added entities */}
                      {compareResult.added_entities.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-accent-green font-bold block text-[9px] uppercase tracking-wider">Added Entities ({compareResult.added_entities.length})</span>
                          <div className="flex flex-wrap gap-1">
                            {compareResult.added_entities.slice(0, 5).map((e, i) => (
                              <span key={i} className="bg-accent-green/5 border border-accent-green/20 px-1 py-0.2 rounded text-[10px] text-accent-green font-mono">
                                {e.value}
                              </span>
                            ))}
                            {compareResult.added_entities.length > 5 && <span className="text-[10px] text-text-muted">+{compareResult.added_entities.length - 5} more</span>}
                          </div>
                        </div>
                      )}

                      {/* Removed entities */}
                      {compareResult.removed_entities.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-accent-red font-bold block text-[9px] uppercase tracking-wider">Removed Entities ({compareResult.removed_entities.length})</span>
                          <div className="flex flex-wrap gap-1">
                            {compareResult.removed_entities.slice(0, 5).map((e, i) => (
                              <span key={i} className="bg-accent-red/5 border border-accent-red/20 px-1 py-0.2 rounded text-[10px] text-accent-red font-mono">
                                {e.value}
                              </span>
                            ))}
                            {compareResult.removed_entities.length > 5 && <span className="text-[10px] text-text-muted">+{compareResult.removed_entities.length - 5} more</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Entities Section tabs */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-surface-border pb-2">
                    <h4 className="text-sm font-semibold text-text-primary">Extracted Entities</h4>
                  </div>
                  
                  {/* Entity Type tabs */}
                  <div className="flex overflow-x-auto gap-1 border-b border-surface-border pb-1">
                    {[
                      { key: 'equipment_tag', label: 'Tags' },
                      { key: 'process_parameter', label: 'Parameters' },
                      { key: 'regulatory_ref', label: 'Regulations' },
                      { key: 'personnel', label: 'Personnel' },
                      { key: 'failure_mode', label: 'Failures' },
                      { key: 'date', label: 'Dates' },
                      { key: 'location', label: 'Locations' }
                    ].map((tab) => {
                      const count = docDetails.entities.filter(e => e.type === tab.key).length;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveEntityTab(tab.key)}
                          className={`text-xs px-2.5 py-1.5 rounded-t-md font-medium whitespace-nowrap flex items-center gap-1.5 ${
                            activeEntityTab === tab.key 
                              ? 'bg-surface-sidebar border-t border-x border-surface-border text-accent-blue font-semibold' 
                              : 'text-text-secondary hover:text-text-primary hover:bg-[#1C2128]'
                          }`}
                        >
                          {tab.label}
                          {count > 0 && (
                            <span className="text-[10px] bg-accent-blue/10 text-accent-blue px-1.5 py-0.2 rounded-full">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* List of entities matching tab */}
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {docDetails.entities.filter(e => e.type === activeEntityTab).length === 0 ? (
                      <p className="text-xs text-text-muted italic py-4 text-center">
                        No entities of this type extracted from this document.
                      </p>
                    ) : (
                      docDetails.entities
                        .filter(e => e.type === activeEntityTab)
                        .map((e) => {
                          const confPercent = Math.round(e.confidence * 100);
                          const barColor = e.confidence > 0.8 ? 'bg-accent-green' : e.confidence > 0.5 ? 'bg-accent-amber' : 'bg-accent-red';
                          
                          return (
                            <div key={e.entity_id} className="p-3 bg-surface border border-surface-border rounded-md space-y-2 hover:bg-[#1C2128] transition-colors">
                              <div className="flex justify-between items-center">
                                <div 
                                  onClick={() => e.type === 'equipment_tag' && setActiveTimelineTag(e.value)} 
                                  className={e.type === 'equipment_tag' ? 'cursor-pointer hover:opacity-80' : ''}
                                  title={e.type === 'equipment_tag' ? 'Click to view asset lifecycle timeline' : ''}
                                >
                                  <EntityChip type={e.type} value={e.value} />
                                </div>
                                <span className="text-[10px] font-mono text-text-muted">
                                  Page {e.page}
                                </span>
                              </div>
                              {e.context && (
                                <p className="text-xs text-text-secondary line-clamp-2 italic pl-2 border-l border-[#30363D]">
                                  "{e.context}"
                                </p>
                              )}
                              {/* Confidence Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-text-muted">
                                  <span>Confidence</span>
                                  <span>{confPercent}%</span>
                                </div>
                                <div className="w-full bg-[#21262D] h-1 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${confPercent}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Failed to load document details.</p>
            )}

            {/* Bottom details */}
            <div className="border-t border-surface-border pt-4 mt-6 flex justify-between items-center text-[10px] text-text-muted">
              <span>AIKI AssetBrain Platform</span>
              <button 
                onClick={() => setSelectedDocId(null)}
                className="text-accent-blue hover:underline"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTimelineTag && (
        <EquipmentTimelineModal 
          tag={activeTimelineTag} 
          onClose={() => setActiveTimelineTag(null)} 
        />
      )}
    </div>
  );
}

export default Documents;
