import React from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchDataSources } from '../lib/apiClient';
import { PageShell, LoadingBlock, ErrorBlock, StatusPill } from '../components/page/PageShell';

/**
 * Data & Sources page (Final Upgrade Spec §26)
 *
 * Every source shows: name, type, last update, spatial/temporal resolution,
 * coverage, status, provenance. Status values are honest:
 * the prototype never claims LIVE without an actual live feed.
 */

const DataSourcesPage: React.FC = () => {
  const sourcesQ = useApiResource(fetchDataSources, []);
  const sources = sourcesQ.data?.sources ?? [];

  return (
    <PageShell
      title="Data & Sources"
      description="Source registry for every environmental input TALWEG consumes. Provenance and status are explicit — demo/synthetic sources are labeled as such."
    >
      {sourcesQ.loading && <LoadingBlock label="Loading source registry…" />}
      {sourcesQ.error && <ErrorBlock message={sourcesQ.error.message} onRetry={sourcesQ.reload} />}
      {!sourcesQ.loading && !sourcesQ.error && (
        <div className="bg-ink-900 border border-line-subtle rounded-md overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Data source registry</caption>
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-paper-400 border-b border-line-subtle">
                <th scope="col" className="px-4 py-2.5">Source</th>
                <th scope="col" className="px-4 py-2.5">Type</th>
                <th scope="col" className="px-4 py-2.5">Last update</th>
                <th scope="col" className="px-4 py-2.5">Spatial res.</th>
                <th scope="col" className="px-4 py-2.5">Temporal res.</th>
                <th scope="col" className="px-4 py-2.5">Coverage</th>
                <th scope="col" className="px-4 py-2.5">Status</th>
                <th scope="col" className="px-4 py-2.5">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {sources.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-paper-100 font-medium">{s.name}</p>
                    <p className="text-[10px] font-mono text-paper-400">{s.provider}</p>
                    <p className="text-[10px] text-paper-400 mt-1 max-w-72">{s.usage}</p>
                    {s.citation && <p className="text-[10px] font-mono text-paper-400/80 mt-1 italic">{s.citation}</p>}
                  </td>
                  <td className="px-4 py-3 text-paper-300 font-mono text-[11px]">{s.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-paper-300 font-mono text-[11px]">
                    {s.last_update ? new Date(s.last_update).toLocaleString() : 'static snapshot'}
                  </td>
                  <td className="px-4 py-3 text-paper-300 font-mono text-[11px]">{s.spatial_resolution}</td>
                  <td className="px-4 py-3 text-paper-300 font-mono text-[11px]">{s.temporal_resolution}</td>
                  <td className="px-4 py-3 text-paper-300 font-mono text-[11px]">{s.coverage}</td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3 text-paper-300 font-mono text-[11px]">{s.provenance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sourcesQ.data && (
            <p className="px-4 py-2.5 text-[10px] font-mono text-paper-400 border-t border-line-subtle">
              Canonical feature schema version: {sourcesQ.data.feature_schema_version}
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
};

export default DataSourcesPage;
