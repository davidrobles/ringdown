import { useEffect, useState, useCallback, useRef } from 'react';
import type { Device, Event, Filters, Stats } from './types.ts';
import { fetchDevices, fetchEvents, fetchStats, toggleFavorite, deleteFile } from './api.ts';
import FiltersPanel from './components/Filters.tsx';
import EventCard from './components/EventCard.tsx';
import VideoPlayer from './components/VideoPlayer.tsx';
import StatusBar from './components/StatusBar.tsx';

const PAGE_SIZE = 48;

function groupByDay(events: Event[]) {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const groups: { label: string; events: Event[]; startIdx: number }[] = [];
  let currentLabel = '';
  let startIdx = 0;

  events.forEach((e, i) => {
    const d = new Date(e.created_at * 1000); d.setHours(0,0,0,0);
    let label: string;
    if (d.getTime() === today.getTime())     label = 'Today';
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    if (label !== currentLabel) {
      groups.push({ label, events: [], startIdx: i });
      currentLabel = label;
      startIdx = i;
    }
    groups[groups.length - 1].events.push(e);
  });

  return groups;
}

const DEFAULT_FILTERS: Filters = {
  device_ids: [],
  kind: '',
  downloaded: '',
  favorited: '',
  show_deleted: false,
  sort_by: 'created_at',
  sort_dir: 'desc',
  date_from: '',
  date_to: '',
};

export default function App() {
  const [devices, setDevices]         = useState<Device[]>([]);
  const [events, setEvents]           = useState<Event[]>([]);
  const [total, setTotal]             = useState(0);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const handleDelete = async (eventId: string) => {
    await deleteFile(eventId);
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, file_deleted: 1, thumbnail_path: null } : e
    ));
  };

  const handleFavorite = async (eventId: string) => {
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, favorited: e.favorited ? 0 : 1 } : e
    ));
    try {
      const { favorited } = await toggleFavorite(eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, favorited } : e));
    } catch {
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, favorited: e.favorited ? 0 : 1 } : e
      ));
    }
  };

  const loadMore = useCallback(() => {
    if (loading) return;
    const next = offset + PAGE_SIZE;
    setOffset(next);
    load(filters, next);
  }, [loading, offset, filters, load]);

  const hasMore = events.length < total;

  // Infinite scroll — watch sentinel element at bottom of grid
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const handlePrev = useCallback(() => {
    setSelectedIdx(i => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedIdx(i => {
      if (i === null) return i;
      // Auto-load more if approaching the end
      if (i >= events.length - 3 && hasMore) {
        const next = offset + PAGE_SIZE;
        setOffset(next);
        load(filters, next);
      }
      return i < events.length - 1 ? i + 1 : i;
    });
  }, [events.length, hasMore, offset, filters, load]);

  const selectedEvent = selectedIdx !== null ? (events[selectedIdx] ?? null) : null;

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
              {groupByDay(events).map(({ label, events: group, startIdx }) => (
                <div key={label} className="mb-8">
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 sticky top-0 bg-zinc-950 py-1 z-10">
                    {label}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {group.map((e, i) => (
                      <EventCard key={e.id} event={e} onClick={() => setSelectedIdx(startIdx + i)} onFavorite={handleFavorite} />
                    ))}
                  </div>
                </div>
              ))}

              <div ref={sentinelRef} className="flex justify-center mt-8 h-10">
                {loading && events.length > 0 && (
                  <div className="text-zinc-500 text-sm animate-pulse">Loading...</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {selectedEvent && (
        <VideoPlayer
          event={events.find(e => e.id === selectedEvent.id) ?? selectedEvent}
          hasPrev={selectedIdx !== null && selectedIdx > 0}
          hasNext={selectedIdx !== null && (selectedIdx < events.length - 1 || hasMore)}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={() => setSelectedIdx(null)}
          onFavorite={handleFavorite}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
