import type { Device, Filters } from '../types.ts';

interface Props {
  filters: Filters;
  devices: Device[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}

const select = 'w-full rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500';
const input  = 'w-full rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500';
const label  = 'block text-xs font-medium text-zinc-400 mb-1';

export default function FiltersPanel({ filters, devices, onChange, onReset }: Props) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  const toggleDevice = (id: string) => {
    const next = filters.device_ids.includes(id)
      ? filters.device_ids.filter(d => d !== id)
      : [...filters.device_ids, id];
    onChange({ ...filters, device_ids: next });
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-5 p-5 bg-zinc-900 border-r border-zinc-800 h-full overflow-y-auto">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">ringdown</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Ring camera archive</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={label} style={{ marginBottom: 0 }}>Camera</label>
            {filters.device_ids.length > 0 && (
              <button
                onClick={() => onChange({ ...filters, device_ids: [] })}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5 mt-1.5">
            {devices.map((d) => (
              <label key={d.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.device_ids.includes(d.id)}
                  onChange={() => toggleDevice(d.id)}
                  className="accent-blue-500 w-3.5 h-3.5 shrink-0"
                />
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors truncate">{d.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Event type</label>
          <select className={select} value={filters.kind} onChange={set('kind')}>
            <option value="">All types</option>
            <option value="motion">Motion</option>
            <option value="ding">Ding</option>
            <option value="on_demand">On demand</option>
          </select>
        </div>

        <div>
          <label className={label}>Status</label>
          <select className={select} value={filters.downloaded} onChange={set('downloaded')}>
            <option value="">All</option>
            <option value="1">Downloaded</option>
            <option value="0">Pending</option>
          </select>
        </div>

        <div>
          <label className={label}>From</label>
          <input type="date" className={input} value={filters.date_from} onChange={set('date_from')} />
        </div>

        <div>
          <label className={label}>To</label>
          <input type="date" className={input} value={filters.date_to} onChange={set('date_to')} />
        </div>

        <button
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-white text-left mt-1 transition-colors"
        >
          Reset filters
        </button>
      </div>
    </aside>
  );
}
