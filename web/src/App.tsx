import { useEffect, useState, useCallback } from 'react';
import type { Device, Event, Filters, Stats } from './types.ts';
import { fetchDevices, fetchEvents, fetchStats } from './api.ts';
import FiltersPanel from './components/Filters.tsx';
import EventCard from './components/EventCard.tsx';
import VideoPlayer from './components/VideoPlayer.tsx';
import StatusBar from './components/StatusBar.tsx';

const PAGE_SIZE = 48;

const DEFAULT_FILTERS: Filters = {
  device_ids: [],
  kind: '',
  downloaded: '',
  date_from: '',
  date_to: '',
};

export default function App() {
  const [devices, setDevices]     = useState<Device[]>([]);
  const [events, setEvents]       = useState<Event[]>([]);
  const [total, setTotal]         = useState(0);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS);
  const [offset, setOffset]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<Event | null>(null);

  useEffect(() => {
    fetchDevices().then(setDevices);
    fetchStats().then(setStats);
  }, []);

  const load = useCallback(async (f: Filters, off: number) => {
    setLoading(true);
    try {
      const res = await fetchEvents(f, PAGE_SIZE, off);
      setEvents(off === 0 ? res.events : (prev) => [...prev, ...res.events]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    load(filters, 0);
  }, [filters, load]);

  const handleFiltersChange = (f: Filters) => setFilters(f);
  const handleReset = () => setFilters(DEFAULT_FILTERS);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    load(filters, next);
  };

  const hasMore = events.length < total;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <FiltersPanel
        filters={filters}
        devices={devices}
        onChange={handleFiltersChange}
        onReset={handleReset}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <StatusBar stats={stats} total={total} />

        <main className="flex-1 overflow-y-auto p-6">
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              Loading...
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              No events match your filters.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {events.map((e) => (
                  <EventCard key={e.id} event={e} onClick={() => setSelected(e)} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-6 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-300 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : `Load more (${total - events.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {selected && (
        <VideoPlayer event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
