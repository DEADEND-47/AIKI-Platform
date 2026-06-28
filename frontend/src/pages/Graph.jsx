import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Network, FileText, Share2, CornerDownRight, Database, RefreshCw } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { listEntities, getEntityRelationships, getFullGraph } from '../api/client';
import EntityChip from '../components/EntityChip';
import EmptyState from '../components/EmptyState';

const NODE_COLORS = {
  equipment_tag:     '#2F81F7', // Blue
  personnel:         '#3FB950', // Green
  regulatory_ref:    '#A371F7', // Purple
  process_parameter: '#D29922', // Yellow
  failure_mode:      '#F85149', // Red
  document:          '#7D8590', // Grey
};

export function Graph() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const graphRef = useRef();

  // Debouncing Search Input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // List Entities Query based on debounced search
  const { data: searchResults = [], isLoading: isLoadingSearch } = useQuery({
    queryKey: ['graphSearch', debouncedSearch],
    queryFn: () => listEntities({ search: debouncedSearch }),
    enabled: debouncedSearch.trim().length >= 2,
  });

  // Get full graph structure for force visualizer
  const { data: graphData = { nodes: [], links: [] }, isLoading: isLoadingGraph } = useQuery({
    queryKey: ['fullGraph'],
    queryFn: () => getFullGraph({ limit: 150 }),
  });

  // Selected Entity Relationships Query
  const { data: entityDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['entityRelationships', selectedNode?.id],
    queryFn: () => getEntityRelationships(selectedNode.id),
    enabled: !!selectedNode && selectedNode.type !== 'document',
  });

  const handleEntitySelect = (entity) => {
    const node = graphData.nodes.find(n => n.id === entity.entity_id);
    if (node) {
      setSelectedNode(node);
      // Center graph on clicked node
      if (graphRef.current) {
        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(2.5, 1000);
      }
    } else {
      setSelectedNode({ id: entity.entity_id, value: entity.value, type: entity.type });
    }
    setSearchQuery(entity.value);
    setShowDropdown(false);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setSearchQuery(node.value || node.id);
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 800);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length >= 2) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="space-y-1.5 pt-2 select-none">
        <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <Network className="w-5 h-5 text-accent-blue animate-pulse" />
          Interactive Knowledge Graph
        </h2>
        <p className="text-xs text-text-secondary max-w-2xl">
          Visualize real-time relationships between equipment assets, failure modes, inspection reports, and plant personnel. Drag nodes to explore connections.
        </p>
      </div>

      {/* Search Input Bar with dropdown */}
      <div className="relative z-20 max-w-xl">
        <div className="relative bg-surface border border-surface-border rounded-md px-3 py-2 flex items-center">
          <Search className="w-4 h-4 text-text-muted mr-2.5 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search for tags (P-101A), personnel (Priya), or parameters (12 bar)..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => searchQuery.trim().length >= 2 && setShowDropdown(true)}
            className="bg-transparent border-none w-full text-xs text-text-primary placeholder-text-muted focus:outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setSelectedNode(null); setShowDropdown(false); }}
              className="text-text-muted hover:text-text-primary text-[10px] font-mono font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dropdown Results Box */}
        {showDropdown && searchQuery.trim().length >= 2 && (
          <div className="absolute top-[42px] left-0 right-0 bg-surface-card border border-surface-border rounded-md shadow-2xl z-40 max-h-[200px] overflow-y-auto divide-y divide-surface-border select-none">
            {isLoadingSearch ? (
              <div className="p-3 text-[10px] text-text-muted italic flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-blue" />
                Searching connections...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-[10px] text-text-muted italic">
                No matching entities found.
              </div>
            ) : (
              searchResults.map((ent) => (
                <button
                  key={ent.entity_id}
                  onClick={() => handleEntitySelect(ent)}
                  className="w-full text-left p-2.5 hover:bg-surface-card flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <EntityChip type={ent.type} value={ent.value} />
                  </div>
                  <span className="text-[9px] text-text-muted font-mono bg-surface border border-surface-border px-1.5 py-0.5 rounded">
                    Appears in {ent.document_count} doc{ent.document_count > 1 ? 's' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main Layout Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Graph Visualizer Container */}
        <div className="lg:col-span-2 bg-[#0D1117] border border-surface-border rounded-md min-h-[500px] h-[550px] relative overflow-hidden flex flex-col justify-center items-center">
          {isLoadingGraph ? (
            <div className="flex flex-col items-center gap-3 text-xs text-text-muted italic">
              <RefreshCw className="w-6 h-6 animate-spin text-accent-blue" />
              Building force-directed graph...
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="text-center p-6 space-y-2 select-none">
              <p className="text-xs text-text-secondary">No relationships to display yet.</p>
              <p className="text-[10px] text-text-muted">Please ingest industrial documents in the Hub first.</p>
            </div>
          ) : (
            <div className="w-full h-full">
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeLabel={node => `${node.value || node.id} (${node.type.replace('_', ' ')})`}
                nodeColor={node => NODE_COLORS[node.type] || '#7D8590'}
                nodeRelSize={5}
                linkColor={() => '#30363D'}
                linkWidth={1.5}
                onNodeClick={handleNodeClick}
                backgroundColor="#0D1117"
                cooldownTicks={100}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = node.value || node.id;
                  const fontSize = 10 / globalScale;
                  ctx.font = `${fontSize}px JetBrains Mono, sans-serif`;
                  ctx.fillStyle = NODE_COLORS[node.type] || '#7D8590';
                  
                  // Circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI);
                  ctx.fill();
                  
                  // Selected Border
                  if (selectedNode && selectedNode.id === node.id) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.5 / globalScale;
                    ctx.stroke();
                  }
                  
                  // Label text
                  ctx.fillStyle = '#E6EDF3';
                  ctx.fillText(label, node.x + 7, node.y + 2.5);
                }}
              />
            </div>
          )}
        </div>

        {/* Dynamic Detail Side Panel */}
        <div className="bg-surface-card border border-surface-border rounded-md p-5 flex flex-col justify-start space-y-6 max-h-[550px] overflow-y-auto">
          
          {!selectedNode ? (
            <div className="h-full flex items-center justify-center py-12">
              <EmptyState
                icon="brain"
                title="Explore Node Details"
                subtitle="Click any node in the interactive graph visualizer or search for assets to inspect semantic relationships."
              />
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Header Info */}
              <div className="border-b border-surface-border pb-4 space-y-3">
                <span className="text-[9px] uppercase font-mono tracking-widest text-text-muted font-bold block">
                  Node Inspector
                </span>
                <div>
                  <h3 className="text-base font-bold font-mono text-text-primary break-all">
                    {selectedNode.value || selectedNode.id}
                  </h3>
                  <div className="mt-1.5">
                    <EntityChip type={selectedNode.type} value={selectedNode.type.replace('_', ' ')} />
                  </div>
                </div>
              </div>

              {/* Specific node details depending on type */}
              {selectedNode.type === 'document' ? (
                <div className="space-y-3 select-none">
                  <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-accent-blue" />
                    Document Information
                  </h4>
                  <div className="bg-surface border border-surface-border rounded p-3 space-y-2 text-xs">
                    <p className="text-text-secondary">
                      This node represents a source file in the document base. Entities extracted from this document are linked to it in the graph.
                    </p>
                    <div className="text-[10px] font-mono text-text-muted pt-1">
                      ID: {selectedNode.id}
                    </div>
                  </div>
                </div>
              ) : isLoadingDetails ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-surface-border rounded w-2/3" />
                  <div className="space-y-2">
                    <div className="h-10 bg-surface-border rounded w-full" />
                    <div className="h-10 bg-surface-border rounded w-full" />
                  </div>
                </div>
              ) : entityDetails ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-text-primary flex items-center gap-2 select-none">
                    <CornerDownRight className="w-3.5 h-3.5 text-accent-blue" />
                    Semantic Connections
                  </h4>

                  {entityDetails.relationships.length === 0 ? (
                    <div className="bg-surface border border-surface-border p-4 rounded text-center text-[11px] text-text-secondary select-none">
                      No derived relations. This node is co-located in other documents.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {entityDetails.relationships.map((rel, idx) => {
                        const relLabelColors = {
                          MAINTAINS: 'text-accent-green bg-accent-green/5 border-accent-green/20',
                          OPERATES_AT: 'text-accent-amber bg-accent-amber/5 border-accent-amber/20',
                          SUBJECT_TO: 'text-accent-purple bg-accent-purple/5 border-accent-purple/20',
                          HAS_FAILURE: 'text-accent-red bg-accent-red/5 border-accent-red/20',
                          CO_OCCURS_IN: 'text-text-secondary bg-surface border-surface-border',
                        };
                        const relStyle = relLabelColors[rel.relationship_type] || relLabelColors.CO_OCCURS_IN;
                        
                        return (
                          <div 
                            key={idx}
                            className="bg-surface border border-surface-border rounded p-3 space-y-2 hover:border-text-muted transition-colors text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-[8px] font-bold font-mono border rounded px-1.5 py-0.2 select-none ${relStyle}`}>
                                {rel.relationship_type}
                              </span>
                              <span className="text-text-secondary">→</span>
                              <EntityChip type={rel.target_type} value={rel.target_value} />
                            </div>
                            <div className="text-[10px] text-text-muted truncate select-none">
                              via: <span className="text-text-secondary font-mono">{rel.doc_filename}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-secondary">Failed to load relationships details.</p>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default Graph;
