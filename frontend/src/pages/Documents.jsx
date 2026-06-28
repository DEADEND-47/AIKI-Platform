import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Search, FileText, X, Filter, ChevronRight, RefreshCw, Layers, Sparkles, AlertTriangle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { listDocuments, uploadDocuments, getDocument, getJobStatus, getDocumentVersions, compareDocumentVersions } from '../api/client';
import EntityChip from '../components/EntityChip';
import SkeletonTable from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import AIBadge from '../components/AIBadge';
import { useToast } from '../hooks/useToast';
import EquipmentTimelineModal from '../components/EquipmentTimelineModal';
import { useNavigate } from 'react-router-dom';

const DOC_TYPES = [
  { value: 'maintenance_record', label: 'Maintenance Record' },
  { value: 'safety_procedure', label: 'Safety Procedure' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'engineering_drawing', label: 'Engineering Drawing' },
  { value: 'operating_instruction', label: 'Operating Instruction' },
  { value: 'regulatory_document', label: 'Regulatory Document' },
  { value: 'other', label: 'Other' },
];

/**
 * Compliance tag derived from doc metadata. 
 * In a real backend this would be a real field — here we derive from status + age.
 */
function getComplianceTag(doc) {
  if (doc.status === 'failed') return { label: 'Scan Failed', variant: 'danger' };
  if (doc.status === 'processing' || doc.status === 'queued') return { label: 'Pending', variant: 'neutral' };
  
  // Derive from upload age (mock logic — replace with real backend field)
  const uploadedAt = new Date(doc.upload_timestamp);
  const daysSince = (Date.now() - uploadedAt.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSince > 365) return { label: 'Expired', variant: 'danger' };
  if (daysSince > 180) return { label: 'Review Needed', variant: 'warning' };
  return { label: 'Compliant', variant: 'success' };
}

const COMPLIANCE_STYLES = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  neutral: 'badge-neutral',
};

const COMPLIANCE_ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger:  AlertCircle,
  neutral: Clock,
};

const STATUS_STYLES = {
  queued:     'status-queued',
  processing: 'status-processing',
  completed:  'status-completed',
  failed:     'status-failed',
};

export function Documents() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  // Auto-open doc from URL ?open=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openDocId = params.get('open');
    if (openDocId) {
      setSelectedDocId(openDocId);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setFiles(acceptedFiles),
    maxFiles: 5,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
  });

  // Tags
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (val && !tags.includes(val)) setTags([...tags, val]);
      setTagInput('');
    }
  };
  const removeTag = (t) => setTags(tags.filter((tag) => tag !== t));

  // Queries
  const { data: documentList = [], isLoading, refetch } = useQuery({
    queryKey: ['documents', filterDocType, searchQuery, activePlantId],
    queryFn: () => listDocuments({ doc_type: filterDocType || undefined, plant_id: activePlantId }),
    refetchInterval: 5000,
  });

  const filteredDocs = documentList.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = filterTag
      ? (doc.tags || []).some(t => t.toLowerCase().includes(filterTag.toLowerCase()))
      : true;
    return matchesSearch && matchesTag;
  });

  const { data: docDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['documentDetails', selectedDocId],
    queryFn: () => getDocument(selectedDocId),
    enabled: !!selectedDocId,
  });

  const { data: docVersions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ['documentVersions', selectedDocId],
    queryFn: () => getDocumentVersions(selectedDocId),
    enabled: !!selectedDocId,
  });

  const { data: compareResult, isLoading: isLoadingCompare } = useQuery({
    queryKey: ['versionsCompare', selectedDocId, compareDocId],
    queryFn: () => compareDocumentVersions(selectedDocId, compareDocId),
    enabled: !!selectedDocId && !!compareDocId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadDocuments(formData),
    onSuccess: (data) => {
      success('Files uploaded! Starting ingestion pipeline…');
      setFiles([]);
      setTags([]);
      setActiveJobId(data.job_id);
      setJobProgress({ progress: 0, documents_processed: 0, entities_extracted: 0, status: 'queued' });
    },
    onError: (err) => toastError(`Upload failed: ${err.message || 'Server error'}`),
  });

  const handleUpload = () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('doc_type', selectedDocType);
    if (tags.length > 0) formData.append('tags', tags.join(','));
    formData.append('plant_id', activePlantId);
    uploadMutation.mutate(formData);
  };

  // Job WebSocket
  useEffect(() => {
    if (!activeJobId) return;
    const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
      (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')
        .replace('http://', '').replace('https://', '').replace('/api/v1', '') +
      `/ws/jobs/${activeJobId}`;
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setJobProgress(data);
        if (['completed', 'failed', 'completed_with_errors'].includes(data.status)) {
          queryClient.invalidateQueries(['documents']);
          socket.close();
        }
      } catch (e) { console.error('[WS] Parse error:', e); }
    };
    return () => socket.close();
  }, [activeJobId, queryClient]);

  // Job polling & progress animation
  useEffect(() => {
    if (!activeJobId) return;
    const animationTimer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (!jobProgress) return Math.min(prev + 1, 15);
        if (jobProgress.status === 'queued') return Math.min(prev + 1, 15);
        if (jobProgress.status === 'processing') {
          const target = jobProgress.progress || 20;
          return Math.min(prev + 0.5, target - 2);
        }
        if (['completed', 'completed_with_errors'].includes(jobProgress.status)) return 100;
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
          if (data.status !== 'failed') {
            const errSuffix = data.status === 'completed_with_errors' ? ' (some files failed)' : '';
            success(`Ingestion complete${errSuffix}! Extracted ${data.entities_extracted} entities.`);
            setDisplayProgress(100);
          } else {
            toastError(`Ingestion failed: ${data.error || 'Unknown error'}`);
            setDisplayProgress(0);
          }
          setTimeout(() => {
            setActiveJobId(null); setJobProgress(null); setDisplayProgress(0);
            queryClient.invalidateQueries(['documents']);
          }, 1500);
        }
      } catch (err) { console.error('Job poll error:', err); }
    };

    pollIntervalRef.current = setInterval(pollJob, 1500);
    return () => { clearInterval(pollIntervalRef.current); clearInterval(animationTimer); };
  }, [activeJobId, jobProgress, queryClient]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-surface-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Document Hub</h1>
          <p className="text-xs text-text-secondary flex items-center gap-1.5">
            <AIBadge label="AI Indexed" />
            <span>Ingest, classify, and extract knowledge from industrial documents.</span>
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 btn-ghost text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Section 1: Upload Zone + Progress */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Upload card */}
        <div className="flex-1 card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Document Ingestion Pipeline</h2>
            <AIBadge label="AI Extract" />
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 py-8 px-4 dropzone-hover ${
              isDragActive
                ? 'border-[#D85A30] bg-[#D85A30]/5 dropzone-active'
                : 'border-surface-border hover:bg-surface-card/60'
            }`}
          >
            <input {...getInputProps()} />
            <div className={`p-3 rounded-full border mb-3 transition-all duration-200 ${
              isDragActive ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue' : 'border-surface-border bg-surface text-text-secondary'
            }`}>
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              {isDragActive ? 'Drop files to upload' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-text-muted mt-1">
              PDF, PNG, JPG, XLSX, CSV — up to 5 files
            </p>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="bg-surface rounded-lg border border-surface-border divide-y divide-surface-border/60">
              <p className="text-[11px] font-medium text-text-muted px-3 py-2">
                Selected files ({files.length})
              </p>
              {files.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
                    <span className="font-mono text-text-primary truncate">{file.name}</span>
                  </div>
                  <span className="text-text-muted flex-shrink-0 ml-2">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Controls row */}
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="flex-1 min-w-[160px] bg-surface-card border border-surface-border text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue/60 transition-colors"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <div className="flex-1 min-w-[200px] flex items-center bg-surface-card border border-surface-border text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-sm focus-within:border-accent-blue/60 transition-colors gap-2">
              <Filter className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Add tags (Enter or comma)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="bg-transparent border-none w-full text-text-primary placeholder:text-text-muted focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="badge-neutral text-xs flex items-center gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="text-text-muted hover:text-accent-red transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploadMutation.isPending}
            className="w-full bg-[#D85A30] hover:bg-[#D85A30]/90 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 duration-150 shadow-sm"
          >
            <Upload className="w-4 h-4" />
            {uploadMutation.isPending ? 'Uploading…' : 'Ingest & Process Documents'}
          </button>
        </div>

        {/* Progress card */}
        {jobProgress && (
          <div className="w-full lg:w-[300px] card flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-text-primary">Ingestion active</h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-amber" />
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Pipeline status:</span>
              <span className={`font-semibold uppercase tracking-wider text-[10px] ${
                jobProgress.status === 'completed' ? 'text-accent-green'
                : jobProgress.status === 'failed' ? 'text-accent-red'
                : 'text-accent-amber'
              }`}>
                {jobProgress.status}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-text-secondary">
                <span>Progress</span>
                <span>{Math.round(displayProgress)}%</span>
              </div>
              <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
                <div
                  className="bg-accent-blue h-full rounded-full transition-all duration-300"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-surface p-3 rounded-lg border border-surface-border text-center">
              <div>
                <div className="section-label">Files</div>
                <div className="text-lg font-bold text-text-primary font-mono mt-0.5">
                  {jobProgress.documents_processed}
                </div>
              </div>
              <div>
                <div className="section-label">Entities</div>
                <div className="text-lg font-bold text-accent-green font-mono mt-0.5">
                  {jobProgress.entities_extracted}
                </div>
              </div>
            </div>

            <div className="text-[9px] text-text-muted font-mono text-center">
              Job: {String(jobProgress.job_id || '').slice(0, 12)}…
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Filter Bar */}
      <div className="card py-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search documents by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-card border border-surface-border text-text-primary placeholder:text-text-muted rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent-blue/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterDocType}
            onChange={(e) => setFilterDocType(e.target.value)}
            className="bg-surface-card border border-surface-border text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent-blue/60 transition-colors flex-1 sm:flex-none sm:w-44"
          >
            <option value="">All Document Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Filter by tag…"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-surface-card border border-surface-border text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent-blue/60 transition-colors w-28 sm:w-36"
          />

          <button
            onClick={() => refetch()}
            className="btn-ghost p-2 text-text-secondary"
            title="Refresh list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results count */}
        {!isLoading && (
          <span className="text-[10px] text-text-muted font-mono whitespace-nowrap hidden md:block">
            {filteredDocs.length} of {documentList.length} docs
          </span>
        )}
      </div>

      {/* Section 3: Document Table */}
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon="file"
          title="No documents indexed yet"
          subtitle="Upload industrial work orders, checklists, safety procedures, or inspection reports above to build your knowledge brain."
          action="Upload Your First Document"
          onAction={() => document.querySelector('input[type="file"]')?.click()}
        />
      ) : (
        <div className="border border-surface-border rounded-xl bg-surface-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-surface-border">
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium">Filename</th>
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium">Type</th>
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium">Pipeline</th>
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium">Compliance</th>
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium text-center">Entities</th>
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium">Indexed</th>
                  <th className="px-4 py-3 text-[11px] text-text-muted font-medium">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60 text-sm">
                {filteredDocs.map((doc) => {
                  const pillStyle = STATUS_STYLES[doc.status] || STATUS_STYLES.queued;
                  const complianceTag = getComplianceTag(doc);
                  const ComplianceIcon = COMPLIANCE_ICONS[complianceTag.variant];

                  return (
                    <tr
                      key={doc.doc_id}
                      onClick={() => setSelectedDocId(doc.doc_id)}
                      className="table-row-hover group"
                    >
                      {/* Filename */}
                      <td className="px-4 py-3 font-medium text-text-primary">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 bg-accent-blue/10 rounded border border-accent-blue/20 flex-shrink-0">
                            <FileText className="w-3.5 h-3.5 text-accent-blue" />
                          </div>
                          <span className="font-mono text-xs truncate max-w-[200px]" title={doc.filename}>
                            {doc.filename}
                          </span>
                          {doc.status === 'completed' && (
                            <AIBadge label="AI" className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className="badge-neutral capitalize text-[10px]">
                          {doc.doc_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Pipeline status */}
                      <td className="px-4 py-3">
                        <span className={`badge ${pillStyle} capitalize`}>
                          {doc.status}
                        </span>
                      </td>

                      {/* Compliance tag */}
                      <td className="px-4 py-3">
                        <span className={`badge ${COMPLIANCE_STYLES[complianceTag.variant]} flex items-center gap-1`}>
                          <ComplianceIcon className="w-2.5 h-2.5" />
                          {complianceTag.label}
                        </span>
                      </td>

                      {/* Entity count */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-xs font-semibold text-accent-blue bg-accent-blue/8 px-2 py-0.5 rounded">
                          {doc.entity_count}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {formatDate(doc.upload_timestamp)}
                      </td>

                      {/* Tags */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {doc.tags && doc.tags.length > 0 ? (
                            <>
                              {doc.tags.slice(0, 2).map((t) => (
                                <span key={t} className="badge-neutral text-[9px]">{t}</span>
                              ))}
                              {doc.tags.length > 2 && (
                                <span className="text-[9px] text-text-muted">+{doc.tags.length - 2}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-text-muted italic">—</span>
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

      {/* Section 4: Document Detail Drawer */}
      {selectedDocId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedDocId(null)}
          />
          {/* Drawer panel */}
          <div className="relative w-full md:w-[460px] bg-surface-card border-l border-surface-border overflow-y-auto shadow-2xl drawer-enter flex flex-col">
            {isLoadingDetails ? (
              <div className="p-6 space-y-5">
                <div className="shimmer-bg h-5 rounded w-3/4" />
                <div className="shimmer-bg h-4 rounded w-1/2" />
                <div className="space-y-3 pt-4">
                  <div className="shimmer-bg h-20 rounded w-full" />
                  <div className="shimmer-bg h-20 rounded w-full" />
                </div>
              </div>
            ) : docDetails ? (
              <div className="flex flex-col flex-1">
                {/* Drawer header */}
                <div className="flex justify-between items-start p-6 border-b border-surface-border bg-surface sticky top-0 z-10">
                  <div className="space-y-1 min-w-0 pr-4">
                    <span className="section-label block">
                      Doc ID: {docDetails.metadata.doc_id.slice(0, 8)}…
                    </span>
                    <h3 className="text-sm font-bold text-text-primary truncate font-mono">
                      {docDetails.metadata.filename}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="badge-neutral capitalize text-[10px]">
                        {docDetails.metadata.doc_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {docDetails.metadata.page_count} pages
                      </span>
                      {docDetails.metadata.status === 'completed' && <AIBadge label="AI Indexed" />}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDocId(null)}
                    className="btn-ghost p-1.5 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-6 flex-1">
                  {/* Metadata row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Status', value: docDetails.metadata.status, cls: 'text-accent-green font-semibold uppercase' },
                      { label: 'Entities', value: `${docDetails.metadata.entity_count}`, cls: 'text-accent-blue font-mono font-semibold' },
                      { label: 'Version', value: `v${docDetails.metadata.version}${docDetails.metadata.is_latest ? ' ★' : ''}`, cls: 'text-text-primary font-mono' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-surface border border-surface-border rounded-lg p-3 text-center">
                        <div className="section-label mb-1">{label}</div>
                        <div className={`text-xs ${cls}`}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-text-secondary flex justify-between">
                    <span>Indexed On:</span>
                    <span className="text-text-primary">{formatDate(docDetails.metadata.upload_timestamp)}</span>
                  </div>

                  {/* Contradiction warning */}
                  {docDetails.contradictions?.length > 0 && (
                    <div className="border border-accent-red/30 bg-accent-red/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-accent-red font-medium text-xs">
                    <AlertCircle className="w-4 h-4" />
                    {docDetails.contradictions.length} contradiction{docDetails.contradictions.length > 1 ? 's' : ''} detected
                  </div>
                      {docDetails.contradictions.map((c, i) => (
                        <div key={i} className="text-[11px] text-text-secondary space-y-2">
                          <div className="font-semibold text-text-primary">Topic: {c.topic} ({c.equipment_tag})</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-surface p-2 rounded-lg border border-surface-border text-[10px]">
                              <span className="text-accent-blue block font-medium text-[10px] mb-0.5">This doc:</span>
                              "{c.new_doc_says}"
                            </div>
                            <div className="bg-surface p-2 rounded-lg border border-surface-border text-[10px]">
                              <span className="text-text-muted block font-medium text-[10px] mb-0.5">{c.related_filename}:</span>
                              "{c.existing_doc_says}"
                            </div>
                          </div>
                          <div className="text-[10px] text-accent-amber bg-accent-amber/5 border border-accent-amber/20 px-3 py-1.5 rounded-lg">
                            💡 <strong>Resolution:</strong> {c.resolution}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {docDetails.metadata.tags?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-text-secondary">Associated Tags</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {docDetails.metadata.tags.map((t) => (
                          <span key={t} className="badge-neutral text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Version History */}
                  <div className="bg-surface border border-surface-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-accent-blue" />
                        Version History
                      </h4>
                      <span className="badge-info text-[9px]">v{docDetails.metadata.version}</span>
                    </div>

                    {isLoadingVersions ? (
                      <div className="text-[10px] text-text-muted italic">Loading…</div>
                    ) : docVersions.length <= 1 ? (
                      <p className="text-[10px] text-text-muted">No prior versions exist.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                          {docVersions.map((v) => (
                            <button
                              key={v.doc_id}
                              onClick={() => { setSelectedDocId(v.doc_id); setCompareDocId(''); }}
                              className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-all duration-150 active:scale-95 ${
                                v.doc_id === selectedDocId
                                  ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                                  : 'bg-surface text-text-secondary border-surface-border hover:border-text-muted'
                              }`}
                            >
                              v{v.version}{v.is_latest ? ' ★' : ''}
                            </button>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-surface-border/60 space-y-1.5">
                          <label className="section-label block">Compare with version</label>
                          <select
                            value={compareDocId}
                            onChange={(e) => setCompareDocId(e.target.value)}
                            className="w-full bg-surface-card border border-surface-border text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent-blue/60 transition-colors"
                          >
                            <option value="">— Select version —</option>
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

                    {/* Compare result */}
                    {compareDocId && compareResult && (
                      <div className="bg-surface border border-surface-border rounded-lg p-3 space-y-2 text-[11px]">
                        <div className="flex justify-between items-center text-[10px] border-b border-surface-border/60 pb-1.5 mb-1">
                          <span className="text-text-muted font-semibold">Comparison Results</span>
                          <button onClick={() => setCompareDocId('')} className="text-accent-red hover:underline">Clear</button>
                        </div>
                        <p className="text-text-secondary leading-relaxed">{compareResult.summary}</p>
                        {compareResult.added_entities.length > 0 && (
                          <div className="space-y-1">
                          <span className="text-accent-green font-medium text-[10px] block">
                              Added ({compareResult.added_entities.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {compareResult.added_entities.slice(0, 5).map((e, i) => (
                                <span key={i} className="badge-success text-[9px] font-mono">{e.value}</span>
                              ))}
                              {compareResult.added_entities.length > 5 && (
                                <span className="text-[9px] text-text-muted">+{compareResult.added_entities.length - 5}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {compareResult.removed_entities.length > 0 && (
                          <div className="space-y-1">
                          <span className="text-accent-red font-medium text-[10px] block">
                              Removed ({compareResult.removed_entities.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {compareResult.removed_entities.slice(0, 5).map((e, i) => (
                                <span key={i} className="badge-danger text-[9px] font-mono">{e.value}</span>
                              ))}
                              {compareResult.removed_entities.length > 5 && (
                                <span className="text-[9px] text-text-muted">+{compareResult.removed_entities.length - 5}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extracted Entities */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-surface-border pb-2">
                      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
                        Extracted Entities
                      </h4>
                      <AIBadge label="NLP" />
                    </div>

                    {/* Entity type tabs */}
                    <div className="flex overflow-x-auto gap-0.5 border-b border-surface-border pb-0 -mb-px">
                      {[
                        { key: 'equipment_tag', label: 'Tags' },
                        { key: 'process_parameter', label: 'Parameters' },
                        { key: 'regulatory_ref', label: 'Regulations' },
                        { key: 'personnel', label: 'Personnel' },
                        { key: 'failure_mode', label: 'Failures' },
                        { key: 'date', label: 'Dates' },
                        { key: 'location', label: 'Locations' },
                      ].map((tab) => {
                        const count = docDetails.entities.filter(e => e.type === tab.key).length;
                        return (
                          <button
                            key={tab.key}
                            onClick={() => setActiveEntityTab(tab.key)}
                            className={`text-xs px-3 py-2 font-medium whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-all duration-150 ${
                              activeEntityTab === tab.key
                                ? 'border-accent-blue text-accent-blue font-semibold'
                                : 'border-transparent text-text-muted hover:text-text-primary hover:border-surface-border'
                            }`}
                          >
                            {tab.label}
                            {count > 0 && (
                              <span className="text-[9px] bg-accent-blue/10 text-accent-blue px-1.5 rounded-full font-semibold">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Entity list */}
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 pt-1">
                      {docDetails.entities.filter(e => e.type === activeEntityTab).length === 0 ? (
                        <p className="text-xs text-text-muted italic py-6 text-center">
                          No entities of this type extracted.
                        </p>
                      ) : (
                        docDetails.entities
                          .filter(e => e.type === activeEntityTab)
                          .map((e) => {
                            const confPercent = Math.round(e.confidence * 100);
                            const barColor = e.confidence > 0.8 ? 'bg-accent-green' : e.confidence > 0.5 ? 'bg-accent-amber' : 'bg-accent-red';
                            return (
                              <div
                                key={e.entity_id}
                                className="p-3 bg-surface border border-surface-border rounded-xl space-y-2 hover:border-surface-border/80 hover:bg-surface-card/60 transition-all duration-150"
                              >
                                <div className="flex justify-between items-center">
                                  <div
                                    onClick={() => e.type === 'equipment_tag' && setActiveTimelineTag(e.value)}
                                    className={e.type === 'equipment_tag' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                                    title={e.type === 'equipment_tag' ? 'View asset timeline' : ''}
                                  >
                                    <EntityChip type={e.type} value={e.value} />
                                  </div>
                                  <span className="text-[9px] font-mono text-text-muted">p.{e.page}</span>
                                </div>
                                {e.context && (
                                  <p className="text-xs text-text-secondary line-clamp-2 italic pl-2.5 border-l-2 border-surface-border leading-relaxed">
                                    "{e.context}"
                                  </p>
                                )}
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[9px] font-mono text-text-muted">
                                    <span>Confidence</span>
                                    <span>{confPercent}%</span>
                                  </div>
                                  <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${confPercent}%` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer footer */}
                <div className="border-t border-surface-border px-6 py-4 flex justify-between items-center text-[10px] text-text-muted bg-surface sticky bottom-0">
                  <span>AIKI AssetBrain · v2.0.0</span>
                  <button onClick={() => setSelectedDocId(null)} className="text-accent-blue hover:underline font-semibold">
                    Close Drawer
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <p className="text-sm text-text-secondary">Failed to load document details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment timeline modal */}
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
