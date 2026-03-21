import { useEffect, useRef } from 'react';
import type { Event } from '../types.ts';
import { videoUrl } from '../api.ts';

interface Props {
  event: Event;
  onClose: () => void;
}

export default function VideoPlayer({ event, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const date = new Date(event.created_at * 1000);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-zinc-900 rounded-xl overflow-hidden w-full max-w-4xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div>
            <p className="text-sm font-semibold text-white">{event.device_name}</p>
            <p className="text-xs text-zinc-400">
              {date.toLocaleDateString()} · {date.toLocaleTimeString()} · <span className="capitalize">{event.kind}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Video */}
        <div className="bg-black">
          {event.downloaded ? (
            <video
              src={videoUrl(event.id)}
              controls
              autoPlay
              className="w-full max-h-[70vh]"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
              Video not yet downloaded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
