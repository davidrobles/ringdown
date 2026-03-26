import type { Event } from '../types.ts';
import { thumbnailUrl } from '../api.ts';

interface Props {
  event: Event;
  onClick: () => void;
  onFavorite: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const kindColor: Record<string, string> = {
  motion:    'bg-amber-500/20 text-amber-300',
  ding:      'bg-blue-500/20 text-blue-300',
  on_demand: 'bg-purple-500/20 text-purple-300',
};

export default function EventCard({ event, onClick, onFavorite }: Props) {
  const date = new Date(event.created_at * 1000);
  const kindClass = kindColor[event.kind] ?? 'bg-zinc-700 text-zinc-300';

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite(event.id);
  };

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded-xl overflow-hidden transition-all text-left"
    >
      {/* Thumbnail */}
      <div className={`bg-zinc-900 aspect-video flex items-center justify-center relative overflow-hidden ${event.file_deleted ? 'opacity-40' : ''}`}>
        {event.file_deleted ? (
          <div className="flex flex-col items-center gap-1.5 text-zinc-500">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            <span className="text-xs">File deleted</span>
          </div>
        ) : event.thumbnail_path ? (
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

        {/* Duration overlay */}
        {event.duration && (
          <span className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded font-mono">
            {Math.floor(event.duration / 60)}:{String(event.duration % 60).padStart(2, '0')}
          </span>
        )}

        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          aria-label={event.favorited ? 'Remove from favorites' : 'Add to favorites'}
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {event.favorited ? (
            <svg className="w-5 h-5 text-red-500 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white/70 hover:text-red-400 drop-shadow transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{event.device_name}</p>
        <p className="text-xs text-zinc-400">
          {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className={`self-start text-xs font-medium px-2 py-0.5 rounded-full capitalize ${kindClass}`}>
            {event.kind}
          </span>
          {event.file_size && (
            <span className="text-xs text-zinc-500">{formatBytes(event.file_size)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
