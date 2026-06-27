import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Network, FileText, Share2, CornerDownRight, Database } from 'lucide-react';
import { listEntities, getEntityRelationships } from '../api/client';
import EntityChip from '../components/EntityChip';
import EmptyState from '../components/EmptyState';

export function Graph() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debouncing Search Input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // List Entities Query based on debounced search
  const { data: entities = [], isLoading: isLoadingSearch } = useQuery({
    queryKey: ['graphSearch', debouncedSearch],
    queryFn: () => listEntities({ search: debouncedSearch }),
    enabled: debouncedSearch.trim().length >= 2,
  });

  // Selected Entity Relationships Query
  const { data: entityDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['entityRelationships', selectedEntityId],
    queryFn: () => getEntityRelationships(selectedEntityId),
    enabled: !!selectedEntityId,
  });

  const handleEntitySelect = (entity) => {
    setSelectedEntityId(entity.entity_id);
    setSearchQuery(entity.value);
    setShowDropdown(false);
  };

  const handleInputFocus = () => {
    if (searchQuery.trim().length >= 2) {
      setShowDropdown(true);
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
    <div className="max-w-[800px] mx-auto space-y-6">
      
      {/* Search Header */}
      <div className="space-y-2 text-center select-none pt-4">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center justify-center gap-2">
          <Network className="w-6 h-6 text-accent-blue animate-pulse" />
          Knowledge Graph Explorer
        </h2>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          Explore semantic relationships and co-occurrences of equipment tags, process parameters, failure modes, and personnel.
        </p>
      </div>

      {/* Search Input Bar with dropdown */}
      <div className="relative">
        <div className="relative w-full bg-[#161B22] border border-surface-border rounded-md px-3 py-2.5 flex items-center">
          <Search className="w-5 h-5 text-text-muted mr-3 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search for equipment tags (P-101A), personnel (Priya), or parameters (12 bar)..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            className="bg-transparent border-none w-full text-sm text-text-primary placeholder-text-muted focus:outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setSelectedEntityId(null); setShowDropdown(false); }}
              className="text-text-muted hover:text-text-primary text-xs font-mono font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dropdown Results Box */}
        {showDropdown && searchQuery.trim().length >= 2 && (
          <div className="absolute top-[50px] left-0 right-0 bg-[#161B22] border border-surface-border rounded-md shadow-2xl z-40 max-h-[240px] overflow-y-auto divide-y divide-surface-border select-none">
            {isLoadingSearch ? (
              <div className="p-3 text-xs text-text-muted italic flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-blue" />
                Searching connections...
              </div>
            ) : entities.length === 0 ? (
              <div className="p-3 text-xs text-text-muted italic">
                No matching entities found.
              </div>
            ) : (
              entities.map((ent) => (
                <button
                  key={ent.entity_id}
                  onClick={() => handleEntitySelect(ent)}
                  className="w-full text-left p-3 hover:bg-[#1C2128] flex items-center justify-between text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <EntityChip type={ent.type} value={ent.value} />
                  </div>
                  <span className="text-[10px] text-text-muted font-mono bg-surface border border-surface-border px-1.5 py-0.5 rounded">
                    Appears in {ent.document_count} doc{ent.document_count > 1 ? 's' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Entity Details Card */}
      {selectedEntityId && (
        <div className="space-y-6">
          {isLoadingDetails ? (
            <div className="bg-surface-card border border-surface-border rounded-md p-6 animate-pulse space-y-4">
              <div className="h-6 bg-[#30363D] rounded w-1/3" />
              <div className="h-4 bg-[#30363D] rounded w-1/6" />
              <div className="space-y-2 pt-4">
                <div className="h-10 bg-[#30363D] rounded w-full" />
                <div className="h-10 bg-[#30363D] rounded w-full" />
              </div>
            </div>
          ) : entityDetails ? (
            <div className="space-y-6">
              {/* Node Card */}
              <div className="bg-surface-card border border-surface-border rounded-md p-6 space-y-4">
                <div className="flex justify-between items-start border-b border-surface-border pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted font-bold block">
                      Active Entity Node
                    </span>
                    <h3 className="text-xl font-bold font-mono text-text-primary">
                      {entityDetails.value}
                    </h3>
                    <div className="pt-1">
                      <EntityChip type={entityDetails.type} value={entityDetails.type.replace('_', ' ')} />
                    </div>
                  </div>
                  <div className="p-3 bg-[#1C2128] border border-surface-border rounded-full text-accent-blue">
                    <Database className="w-6 h-6" />
                  </div>
                </div>

                {/* Graph Description summary */}
                <div className="flex items-center gap-3 text-xs text-text-secondary select-none">
                  <span className="flex items-center gap-1.5">
                    <Share2 className="w-4 h-4 text-accent-purple" />
                    <strong>{entityDetails.relationships.length}</strong> active connections
                  </span>
                </div>
              </div>

              {/* Connections List */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary select-none flex items-center gap-2">
                  <CornerDownRight className="w-4 h-4 text-accent-blue" />
                  Semantic Graph Relationships
                </h3>

                {entityDetails.relationships.length === 0 ? (
                  <div className="bg-surface-card border border-surface-border p-6 rounded-md text-center text-xs text-text-secondary select-none">
                    This entity has co-occurrence entries but no derived semantic relations.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {entityDetails.relationships.map((rel, idx) => {
                      const relLabelColors = {
                        MAINTAINS: 'text-accent-green bg-accent-green/5 border-accent-green/20',
                        OPERATES_AT: 'text-accent-amber bg-accent-amber/5 border-accent-amber/20',
                        SUBJECT_TO: 'text-accent-purple bg-accent-purple/5 border-accent-purple/20',
                        HAS_FAILURE: 'text-accent-red bg-accent-red/5 border-accent-red/20',
                        CO_OCCURS_IN: 'text-text-secondary bg-[#21262D] border-surface-border',
                      };
                      const relStyle = relLabelColors[rel.relationship_type] || relLabelColors.CO_OCCURS_IN;
                      
                      return (
                        <div 
                          key={idx}
                          className="bg-surface-card border border-surface-border rounded-md p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-text-muted transition-colors"
                        >
                          {/* Left: Source -> Target */}
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-mono font-bold text-text-primary">
                              {entityDetails.value}
                            </span>
                            
                            {/* Directional Tag */}
                            <span className={`text-[10px] font-bold font-mono border rounded px-1.5 py-0.5 select-none ${relStyle}`}>
                              [{rel.relationship_type}]
                            </span>
                            
                            <span className="text-text-secondary select-none">→</span>
                            
                            <EntityChip type={rel.target_type} value={rel.target_value} />
                          </div>

                          {/* Right: via filename */}
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary select-none">
                            <span className="text-text-muted">via:</span>
                            <div className="flex items-center gap-1 bg-surface border border-surface-border px-2 py-0.5 rounded font-mono text-[10px] text-text-primary">
                              <FileText className="w-3.5 h-3.5 text-accent-blue" />
                              {rel.doc_filename}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Failed to load entity graph.</p>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedEntityId && (
        <EmptyState
          icon="brain"
          title="No Node Selected"
          subtitle="Explore the semantic connections of the plant layout. Start searching above for assets like pump P-101A, personnel like Priya, or codes like OISD-118."
        />
      )}
    </div>
  );
}

export default Graph;
