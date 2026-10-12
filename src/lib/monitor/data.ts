import { useQuery } from '@tanstack/react-query'
import type {
  ContributorDataset,
  EcosystemDataset,
  HistoryPoint,
  IssueRecord,
  MetricSnapshot,
  MonitorConfig,
  MonitorMeta,
  PullRecord,
} from './types'

/**
 * Static JSON files produced by `scripts/collect.mjs` and shipped with the
 * site. Resolved against Vite's `BASE_URL` so the same build works under a
 * project subpath (`/<repo>/`) or a root domain.
 */
const DATA_DIR = `${import.meta.env.BASE_URL}data`

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${DATA_DIR}/${file}`, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`Failed to load ${file} (HTTP ${res.status})`)
  }
  return (await res.json()) as T
}

function useMonitorQuery<T, R = T>(
  file: string,
  key: string,
  select?: (data: T) => R
) {
  return useQuery({
    queryKey: ['monitor', key],
    queryFn: () => fetchJson<T>(file),
    select,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })
}

/** Detail files wrap their records in an envelope with a generation timestamp. */
type RecordDataset<T> = { generatedAt: string; items: T[] }

export const useMonitorMeta = () =>
  useMonitorQuery<MonitorMeta>('meta.json', 'meta')

export const useLatestSnapshot = () =>
  useMonitorQuery<MetricSnapshot>('latest.json', 'latest')

export const useHistory = () =>
  useMonitorQuery<HistoryPoint[]>('history.json', 'history')

export const usePulls = () =>
  useMonitorQuery<RecordDataset<PullRecord>, PullRecord[]>(
    'pulls.json',
    'pulls',
    (data) => data.items
  )

export const useIssues = () =>
  useMonitorQuery<RecordDataset<IssueRecord>, IssueRecord[]>(
    'issues.json',
    'issues',
    (data) => data.items
  )

export const useContributors = () =>
  useMonitorQuery<ContributorDataset>('contributors.json', 'contributors')

export const useEcosystem = () =>
  useMonitorQuery<EcosystemDataset>('ecosystem.json', 'ecosystem')

export const useMonitorConfig = () =>
  useMonitorQuery<MonitorConfig>('config.json', 'config')

/**
 * Loads the files every monitor page needs (status banner + trend charts).
 */
export function useMonitorCore() {
  const meta = useMonitorMeta()
  const latest = useLatestSnapshot()
  const history = useHistory()

  return {
    meta,
    latest,
    history,
    isLoading: meta.isLoading || latest.isLoading || history.isLoading,
    isError: meta.isError || latest.isError || history.isError,
  }
}

export { DATA_DIR, fetchJson }