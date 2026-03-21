import type { Event } from '../types.ts';
import { thumbnailUrl } from '../api.ts';

interface Props {
  event: Event;
  onClick: () => void;
}

const kindColor: Record<string, string> = {
  motion:    'bg-amber-500/20 text-amber-300',
  ding:      'bg-blue-500/20 text-blue-300',
  on_demand: 'bg-purple-500/20 text-purple-300',
};

export default function EventCard({ event, onClick }: Props) {
  const date = new Date(event.created_at * 1000);
  const kindClass = kindColor[event.kind] ?? 'bg-zinc-700 text-zinc-300';

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded-xl overflow-hidden transition-all text-left"
    >
      {/* Thumbnail */}
      <div className="bg-zinc-900 aspect-video flex items-center justify-center relative overflow-hidden">
        {event.thumbnail_path ? (
          <img
            src={thumbnailUrl(event.id)}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : event.downloaded ? (
          <div className="flex flex-col items-center gap-2 text-zinc-500 group-hover:text-zinc-300 transition-colors">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
            <span className="text-xs">Play video</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span className="text-xs">Not downloaded</span>
          </div>
        )}

        {/* Downloaded badge */}
        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${event.downloaded ? 'bg-green-400' : 'bg-zinc-600'}`} />
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{event.device_name}</p>
        <p className="text-xs text-zinc-400">
          {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <span className={`mt-1 self-start text-xs font-medium px-2 py-0.5 rounded-full capitalize ${kindClass}`}>
          {event.kind}
        </span>
      </div>
    </button>
  );
}
