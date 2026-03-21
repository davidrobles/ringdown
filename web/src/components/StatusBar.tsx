import type { Stats } from '../types.ts';

interface Props {
  stats: Stats | null;
  total: number;
}

export default function StatusBar({ stats, total }: Props) {
  return (
    <div className="flex items-center gap-6 px-6 py-3 border-b border-zinc-800 bg-zinc-900 text-xs text-zinc-400">
      <span><span className="text-white font-medium">{total.toLocaleString()}</span> events shown</span>
      {stats && (
        <>
          <span>·</span>
          <span><span className="text-green-400 font-medium">{stats.downloaded.toLocaleString()}</span> downloaded</span>
          <span><span className="text-amber-400 font-medium">{stats.pending.toLocaleString()}</span> pending</span>
          <span><span className="text-zinc-300 font-medium">{stats.total.toLocaleString()}</span> total in DB</span>
        </>
      )}
    </div>
  );
}
