'use client';

import { useState, useEffect, JSX, useRef } from 'react';

interface MovieItem {
  subjectId: string;
  title: string;
  cover?: { url: string };
  coverUrl?: string;
  releaseDate?: string;
  imdbRatingValue?: string;
  subjectType: number;
  genre?: string;
  countryName?: string;
  description?: string;
  duration?: number;
  detailPath: string;
  _resource?: {
    seasons: Array<{ se: number; maxEp: number }>;
  };
}

interface StreamOption {
  url: string;
  resolutions: number;
  label: string;
  format?: string;
  codecName?: string;
  size?: number;
  duration?: number;
}

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [subjectType, setSubjectType] = useState(1);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [stats, setStats] = useState({ fetched: 0, matched: 0 });
  const [results, setResults] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ subjectId: string; detailPath: string; title: string; seasons: Array<{ se: number; maxEp: number }>; } | null>(null);
  const [modalContent, setModalContent] = useState<JSX.Element | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoPlayerData, setVideoPlayerData] = useState<{ subjectId: string; detailPath: string; title: string; seasons: Array<{ se: number; maxEp: number }>; } | null>(null);
  const [streamOptions, setStreamOptions] = useState<StreamOption[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamOption | null>(null);

  async function searchMovies(page = 0, perPage = 28) {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword, page: String(page), perPage, subjectType }),
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'Search failed');
    return data.data;
  }

  async function searchAllPages() {
    let page = 0;
    let allItems: MovieItem[] = [];
    let hasMore = true;
    while (hasMore) {
      const r = await searchMovies(page, 28);
      allItems = allItems.concat(r.items || []);
      hasMore = r.pager?.hasMore === true;
      page++;
    }
    return allItems;
  }

  async function getDetails(subjectId: string) {
    const res = await fetch(`/api/detail?subjectId=${subjectId}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'Detail failed');
    return data.data;
  }

  async function getDownloadLinks(subjectId: string, detailPath: string, se = 0, ep = 0) {
    const res = await fetch(`/api/download?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'Download failed');
    return data.data;
  }

  async function getPlayStreams(subjectId: string, detailPath: string, se = 0, ep = 0) {
    const res = await fetch(`/api/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'Play failed');
    return data.data;
  }

  function formatSize(bytes: number) {
    const n = Number(bytes);
    if (!n) return 'N/A';
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }

  function formatDuration(sec: number) {
    if (!sec) return '';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function typeName(t: number) {
    return t === 1 ? 'Movie' : t === 2 ? 'Series' : t === 3 ? 'Music' : 'Other';
  }

  function proxyVideoUrl(url: string) {
    return `/api/file?url=${encodeURIComponent(url)}&name=video.mp4`;
  }

  function proxyDownloadUrl(url: string, name: string) {
    return `/api/file?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
  }

  async function doSearch() {
    if (!keyword.trim()) return;
    setIsSearching(true);
    setStatusMsg(`Searching for "${keyword}"...`);
    setResults([]);
    setIsError(false);
    try {
      const allItems = await searchAllPages();
      const filtered = allItems.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()));
      setStats({ fetched: allItems.length, matched: filtered.length });
      setStatusMsg(`Fetching details for ${filtered.length} result(s)...`);
      const detailed: MovieItem[] = [];
      for (const item of filtered) {
        try {
          const detail = await getDetails(item.subjectId);
          detail.subject._resource = detail.resource || null;
          detailed.push(detail.subject);
        } catch { detailed.push(item); }
      }
      setStatusMsg(`Found ${detailed.length} result(s) for "${keyword}"`);
      setResults(detailed);
    } catch (err: any) {
      setStatusMsg('Error: ' + err.message);
      setIsError(true);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function openDetails(index: number) {
    const item = results[index];
    if (!item) return;
    setDetailsModalOpen(true);
    setIsLoadingDetails(true);
    setDetailsData(null);
    try {
      const detail = await getDetails(item.subjectId);
      setDetailsData(detail);
    } catch (err: any) {
      setDetailsData({ error: err.message });
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function openDownloads(index: number) {
    const item = results[index];
    if (!item) return;
    const isSeries = item.subjectType === 2;
    const seasons = item._resource?.seasons || [];
    setModalData({ subjectId: item.subjectId, detailPath: item.detailPath, title: item.title, seasons });
    setModalOpen(true);
    if (isSeries && seasons.length > 0) {
      setModalContent(<EpisodePicker title={item.title} seasons={seasons} subjectId={item.subjectId} detailPath={item.detailPath} onFetchLinks={fetchAndRenderLinks} />);
    } else {
      setModalContent(
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-slate-400">
          <div className="spinner w-6 h-6 sm:w-8 sm:h-8 border-3 mb-3 sm:mb-4"></div>
          <p className="text-base sm:text-lg">Fetching download links...</p>
        </div>
      );
      const content = await fetchAndRenderLinks(item.subjectId, item.detailPath, item.title, 0, 0);
      setModalContent(content);
    }
  }

  async function loadStreams(subjectId: string, detailPath: string, title: string, se = 0, ep = 0) {
    const playData = await getPlayStreams(subjectId, detailPath, se, ep);
    const streams: StreamOption[] = (playData.streams || [])
      .sort((a: any, b: any) => (b.resolutions || 0) - (a.resolutions || 0))
      .map((s: any) => ({
        url: proxyVideoUrl(s.url),
        resolutions: s.resolutions || 0,
        label: s.resolutions ? `${s.resolutions}p` : 'Auto',
        format: s.format,
        codecName: s.codecName,
        size: s.size,
        duration: s.duration,
      }));
    setStreamOptions(streams);
    if (streams.length > 0) setSelectedStream(streams[0]);
    const label = se > 0 && ep > 0
      ? `${title} S${String(se).padStart(2, '0')}E${String(ep).padStart(2, '0')}`
      : title;
    setVideoTitle(label);
  }

  async function openVideoPlayer(index: number) {
    const item = results[index];
    if (!item) return;
    const isSeries = item.subjectType === 2;
    const seasons = item._resource?.seasons || [];
    setVideoPlayerData({ subjectId: item.subjectId, detailPath: item.detailPath, title: item.title, seasons });
    setVideoTitle(item.title);
    setStreamOptions([]);
    setSelectedStream(null);
    setVideoPlayerOpen(true);
    if (!isSeries || seasons.length === 0) {
      setIsLoadingVideo(true);
      try {
        await loadStreams(item.subjectId, item.detailPath, item.title, 0, 0);
      } catch {
        setStreamOptions([]);
        setSelectedStream(null);
      } finally {
        setIsLoadingVideo(false);
      }
    }
  }

  async function playVideo(subjectId: string, detailPath: string, title: string, se = 0, ep = 0) {
    setIsLoadingVideo(true);
    setStreamOptions([]);
    setSelectedStream(null);
    try {
      await loadStreams(subjectId, detailPath, title, se, ep);
    } catch {
      setStreamOptions([]);
      setSelectedStream(null);
    } finally {
      setIsLoadingVideo(false);
    }
  }

  async function fetchAndRenderLinks(subjectId: string, detailPath: string, label: string, se = 0, ep = 0): Promise<JSX.Element> {
    try {
      const [dlData, playData] = await Promise.all([
        getDownloadLinks(subjectId, detailPath, se, ep),
        getPlayStreams(subjectId, detailPath, se, ep),
      ]);
      const downloads = dlData.downloads || [];
      const captions = dlData.captions || [];
      const streams = playData.streams || [];
      return (
        <div className="space-y-4 sm:space-y-6">
          {downloads.length > 0 && (
            <div>
              <h3 className="text-base sm:text-lg font-bold text-rose-500 mb-2 sm:mb-3 flex items-center gap-2"><span>⬇</span> Download Links</h3>
              <div className="space-y-2">
                {downloads.map((dl: any, idx: number) => {
                  const fname = `${label} (${dl.resolution}p).mp4`;
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm text-slate-300">
                        <span className="font-bold text-white text-sm sm:text-base">{dl.resolution}p</span>
                        <span className="hidden sm:inline">{dl.format}</span>
                        <span className="hidden md:inline">{dl.codecName}</span>
                        <span>{formatSize(dl.size)}</span>
                        <span>{formatDuration(dl.duration)}</span>
                      </div>
                      <a href={proxyDownloadUrl(dl.url, fname)} download={fname} className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm transition-colors text-center">Download</a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {streams.length > 0 && (
            <div>
              <h3 className="text-base sm:text-lg font-bold text-rose-500 mb-2 sm:mb-3 flex items-center gap-2"><span>▶</span> Stream Links</h3>
              <div className="space-y-2">
                {streams.map((s: any, idx: number) => {
                  const fname = `${label} (${s.resolutions}p).mp4`;
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm text-slate-300">
                        <span className="font-bold text-white text-sm sm:text-base">{s.resolutions}p</span>
                        <span className="hidden sm:inline">{s.format}</span>
                        <span className="hidden md:inline">{s.codecName}</span>
                        <span>{formatSize(s.size)}</span>
                        <span>{formatDuration(s.duration)}</span>
                      </div>
                      <a href={proxyDownloadUrl(s.url, fname)} download={fname} className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm transition-colors text-center">Download</a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {captions.length > 0 && (
            <div>
              <h3 className="text-base sm:text-lg font-bold text-rose-500 mb-2 sm:mb-3 flex items-center gap-2"><span>🗂</span> Subtitles</h3>
              <div className="space-y-2">
                {captions.map((cap: any, idx: number) => {
                  const fname = `${label}.${cap.lan}.srt`;
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm text-slate-300">
                        <span className="font-bold text-white text-sm sm:text-base">{cap.lanName}</span>
                        <span>({cap.lan})</span>
                        <span>{formatSize(cap.size)}</span>
                      </div>
                      <a href={proxyDownloadUrl(cap.url, fname)} download={fname} className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-colors text-center">Download .srt</a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {downloads.length === 0 && streams.length === 0 && captions.length === 0 && (
            <div className="text-center py-12 sm:py-16 text-slate-500 text-sm sm:text-base">No download links available for this content</div>
          )}
        </div>
      );
    } catch (err: any) {
      return (
        <div className="text-center py-12 sm:py-16 text-rose-400">
          <p className="text-base sm:text-lg font-semibold">Failed to fetch links</p>
          <p className="text-xs sm:text-sm mt-2">{err.message}</p>
        </div>
      );
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setModalOpen(false); setDetailsModalOpen(false); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg shadow-rose-500/20">▶</div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">MovieBox Downloader</h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="Search movies, series, music..." className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all text-sm sm:text-base" autoFocus />
              <div className="flex gap-2 sm:gap-3">
                <select value={subjectType} onChange={(e) => setSubjectType(Number(e.target.value))} className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all cursor-pointer min-w-[100px] sm:min-w-[120px] text-sm sm:text-base">
                  <option value={0}>All</option>
                  <option value={1}>Movies</option>
                  <option value={2}>Series</option>
                  <option value={3}>Music</option>
                </select>
                <button onClick={doSearch} disabled={isSearching} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2 text-sm sm:text-base whitespace-nowrap">
                  {isSearching ? (<><div className="spinner"></div><span className="hidden sm:inline">Searching...</span><span className="sm:hidden">...</span></>) : 'Search'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {statusMsg && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 mt-3 sm:mt-4">
          <div className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base ${isError ? 'bg-rose-500/10 border border-rose-500/50 text-rose-400' : 'bg-slate-800/50 border border-slate-700/50 text-slate-300'}`}>{statusMsg}</div>
        </div>
      )}

      {stats.fetched > 0 && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3">
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs sm:text-sm text-slate-300">Fetched: <span className="font-bold text-rose-400">{stats.fetched}</span></div>
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs sm:text-sm text-slate-300">Matched: <span className="font-bold text-rose-400">{stats.matched}</span></div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {results.length === 0 && !isSearching && (
          <div className="text-center py-12 sm:py-16 md:py-20">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">🎬</div>
            <p className="text-lg sm:text-xl text-slate-400">No results found</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">Try searching for a movie, series, or music</p>
          </div>
        )}
        {isSearching && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
            {Array(8).fill(0).map((_, i) => (<div key={i} className="skeleton"></div>))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
          {results.map((item, i) => {
            const cover = item.cover?.url || item.coverUrl || '';
            const year = (item.releaseDate || '').substring(0, 4) || 'N/A';
            const rating = item.imdbRatingValue || '—';
            const type = typeName(item.subjectType);
            const genre = item.genre || '';
            const country = item.countryName || '';
            const desc = item.description || '';
            const duration = item.duration ? formatDuration(item.duration) : '';
            return (
              <div key={i} className="group bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 hover:-translate-y-1">
                {cover ? (
                  <img src={cover} alt={item.title} className="w-full h-48 sm:h-56 md:h-64 object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-48 sm:h-56 md:h-64 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-4xl sm:text-5xl md:text-6xl">🎬</div>
                )}
                <div className="p-3 sm:p-4 md:p-5">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3 line-clamp-2">{item.title}</h3>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-blue-500/20 text-blue-300 text-[10px] sm:text-xs font-semibold">{year}</span>
                    <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] sm:text-xs font-semibold">{type}</span>
                    {rating !== '—' && <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs font-semibold">⭐ {rating}</span>}
                    {country && <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] sm:text-xs font-semibold">{country}</span>}
                    {duration && <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] sm:text-xs font-semibold">{duration}</span>}
                  </div>
                  {genre && <p className="text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2 line-clamp-1">{genre}</p>}
                  {desc && <p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4 line-clamp-2">{desc}</p>}
                  <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                    <button onClick={() => openVideoPlayer(i)} className="w-full sm:flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1">
                      <span>▶</span><span>Watch</span>
                    </button>
                    <button onClick={() => openDownloads(i)} className="w-full sm:flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold text-xs sm:text-sm transition-all">
                      <span className="hidden sm:inline">⬇ </span>Downloads
                    </button>
                    <button onClick={() => openDetails(i)} className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-rose-500/50 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm transition-all">Details</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Downloads Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-white line-clamp-1 pr-2">{modalData?.title || 'Loading...'}</h2>
              <button onClick={() => setModalOpen(false)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-xl sm:text-2xl leading-none flex-shrink-0">×</button>
            </div>
            <div className="p-4 sm:p-6">{modalContent}</div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setDetailsModalOpen(false); }}>
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl my-4 sm:my-8" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white line-clamp-1 pr-2">{detailsData?.subject?.title || 'Loading...'}</h2>
              <button onClick={() => setDetailsModalOpen(false)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-xl sm:text-2xl leading-none flex-shrink-0">×</button>
            </div>
            <div className="p-4 sm:p-6">
              {isLoadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-slate-400"><div className="spinner w-6 h-6 sm:w-8 sm:h-8 mb-3 sm:mb-4"></div><p className="text-base sm:text-lg">Loading details...</p></div>
              ) : detailsData?.error ? (
                <div className="text-center py-12 sm:py-16 text-rose-400"><p className="text-base sm:text-lg font-semibold">Failed to load details</p><p className="text-xs sm:text-sm mt-2">{detailsData.error}</p></div>
              ) : detailsData?.subject ? (<DetailsContent data={detailsData} />) : null}
            </div>
          </div>
        </div>
      )}

      {/* Video Player — full screen */}
      {videoPlayerOpen && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">
          {videoPlayerData?.seasons && videoPlayerData.seasons.length > 0 && !selectedStream && !isLoadingVideo ? (
            <>
              <div className="bg-slate-900 border-b border-slate-700/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1 pr-2">{videoTitle}</h2>
                <button onClick={() => { setVideoPlayerOpen(false); setStreamOptions([]); setSelectedStream(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-2xl leading-none">×</button>
              </div>
              <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
                <div className="w-full max-w-lg">
                  <VideoEpisodePicker title={videoPlayerData.title} seasons={videoPlayerData.seasons} subjectId={videoPlayerData.subjectId} detailPath={videoPlayerData.detailPath} onPlay={playVideo} />
                </div>
              </div>
            </>
          ) : (
            <NetflixPlayer
              streamOptions={streamOptions}
              selectedStream={selectedStream}
              onSelectStream={(s) => setSelectedStream(s)}
              title={videoTitle}
              isLoading={isLoadingVideo}
              onClose={() => { setVideoPlayerOpen(false); setStreamOptions([]); setSelectedStream(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Netflix Player ───────────────────────────────────────────────────────────

function NetflixPlayer({ streamOptions, selectedStream, onSelectStream, title, isLoading, onClose }: {
  streamOptions: StreamOption[];
  selectedStream: StreamOption | null;
  onSelectStream: (s: StreamOption) => void;
  title: string;
  isLoading: boolean;
  onClose: () => void;
}) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoCallbackRef = (el: HTMLVideoElement | null) => setVideoEl(el);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [skipAnim, setSkipAnim] = useState<'forward' | 'backward' | null>(null);

  const switchQuality = (stream: StreamOption) => {
    if (videoEl) savedTimeRef.current = videoEl.currentTime;
    onSelectStream(stream);
    setShowQuality(false);
  };

  useEffect(() => {
    const video = videoEl;
    if (!video || !selectedStream) return;
    const onLoaded = () => {
      if (savedTimeRef.current > 0) video.currentTime = savedTimeRef.current;
      video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, [videoEl, selectedStream]);

  useEffect(() => {
    const video = videoEl;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.duration ? (video.buffered.end(video.buffered.length - 1) / video.duration) * 100 : 0);
      }
    };
    const onDuration = () => setDuration(video.duration || 0);
    const onWaiting = () => setIsBuffering(true);
    const onResume = () => setIsBuffering(false);
    const onVolChange = () => { setVolume(video.volume); setIsMuted(video.muted); };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onResume);
    video.addEventListener('canplay', onResume);
    video.addEventListener('volumechange', onVolChange);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onResume);
      video.removeEventListener('canplay', onResume);
      video.removeEventListener('volumechange', onVolChange);
    };
  }, [videoEl]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': case 'KeyL': e.preventDefault(); skip(10); break;
        case 'ArrowLeft': case 'KeyJ': e.preventDefault(); skip(-10); break;
        case 'ArrowUp': e.preventDefault(); changeVolume(Math.min(1, (videoEl?.volume || 0) + 0.1)); break;
        case 'ArrowDown': e.preventDefault(); changeVolume(Math.max(0, (videoEl?.volume || 0) - 0.1)); break;
        case 'KeyM': e.preventDefault(); toggleMute(); break;
        case 'KeyF': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoEl && !videoEl.paused) setShowControls(false);
    }, 3000);
  };

  const togglePlay = () => {
    const v = videoEl;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const skip = (sec: number) => {
    const v = videoEl;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sec));
    setSkipAnim(sec > 0 ? 'forward' : 'backward');
    setTimeout(() => setSkipAnim(null), 700);
    resetControlsTimer();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoEl;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const changeVolume = (val: number) => {
    const v = videoEl;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const toggleMute = () => { if (videoEl) videoEl.muted = !videoEl.muted; };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const fmt = (s: number) => {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center select-none overflow-hidden"
      style={{ cursor: showControls ? 'default' : 'none' }}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { if (videoEl && !videoEl.paused) setShowControls(false); }}
      onClick={(e) => { if ((e.target as HTMLElement).closest('.ctrl-zone')) return; togglePlay(); }}
    >
      {selectedStream && (
        <video
          key={selectedStream.url}
          ref={videoCallbackRef}
          src={selectedStream.url}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          onError={() => setIsBuffering(false)}
        />
      )}

      {(isLoading || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <svg className="animate-spin w-16 h-16" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="#e11d48" strokeWidth="4" strokeDasharray="80 60" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {!selectedStream && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 pointer-events-none">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-xl font-semibold text-white">No stream available</p>
        </div>
      )}

      {skipAnim && (
        <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none z-20 flex flex-col items-center gap-2 ${skipAnim === 'forward' ? 'right-[20%]' : 'left-[20%]'}`}>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-4 border border-white/20">
            <span className="text-white text-2xl font-black">{skipAnim === 'forward' ? '+10s' : '-10s'}</span>
          </div>
        </div>
      )}

      <div
        className={`ctrl-zone absolute inset-0 flex flex-col justify-between z-30 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: showControls || !isPlaying ? 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 20%, transparent 60%, rgba(0,0,0,0.95) 100%)' : 'none' }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-white/20 text-white backdrop-blur-sm border border-white/10 transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <h2 className="text-white font-semibold text-sm sm:text-base truncate drop-shadow-lg">{title}</h2>
              {selectedStream && <p className="text-white/50 text-xs mt-0.5">{selectedStream.label}{selectedStream.format ? ` · ${selectedStream.format}` : ''}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Speed */}
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(v => !v); setShowQuality(false); }} className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-sm border border-white/10 transition-all min-w-[52px] text-center">
                {playbackRate}×
              </button>
              {showSpeedMenu && (
                <div className="absolute right-0 top-full mt-2 bg-slate-900/98 backdrop-blur-xl border border-slate-600/50 rounded-2xl overflow-hidden shadow-2xl z-50 w-32" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-2.5 border-b border-slate-700/50"><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Speed</p></div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => (
                    <button key={r} onClick={() => { if (videoEl) videoEl.playbackRate = r; setPlaybackRate(r); setShowSpeedMenu(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${playbackRate === r ? 'text-rose-400 bg-rose-500/10 font-bold' : 'text-white hover:bg-slate-700/60'}`}>
                      <span>{r === 1 ? 'Normal' : `${r}×`}</span>
                      {playbackRate === r && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Quality */}
            {streamOptions.length > 1 && (
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setShowQuality(v => !v); setShowSpeedMenu(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-sm border border-white/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                  <span>{selectedStream?.label || 'HD'}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {showQuality && (
                  <div className="absolute right-0 top-full mt-2 bg-slate-900/98 backdrop-blur-xl border border-slate-600/50 rounded-2xl overflow-hidden shadow-2xl z-50 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                    <div className="px-4 py-2.5 border-b border-slate-700/50"><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Video Quality</p></div>
                    {streamOptions.map((s, idx) => (
                      <button key={idx} onClick={() => switchQuality(s)}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${selectedStream?.url === s.url ? 'text-rose-400 bg-rose-500/10 font-bold' : 'text-white hover:bg-slate-700/60'}`}>
                        <div className="text-left">
                          <div className="text-sm">{s.label}</div>
                          {s.format && <div className="text-xs text-slate-500 mt-0.5">{s.format}{s.codecName ? ` · ${s.codecName}` : ''}</div>}
                        </div>
                        {selectedStream?.url === s.url && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center play button */}
        <div className="flex items-center justify-center flex-1" onClick={(e) => e.stopPropagation()}>
          {!isPlaying && !isLoading && !isBuffering && selectedStream && (
            <button onClick={togglePlay} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 hover:bg-white/20 hover:border-white/60 transition-all duration-200 hover:scale-110 active:scale-95">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            </button>
          )}
        </div>

        {/* Bottom controls */}
        <div className="px-3 sm:px-5 pb-5 sm:pb-7 space-y-2 sm:space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Progress bar */}
          <div
            className="group relative h-1 sm:h-1.5 rounded-full cursor-pointer transition-all duration-150 hover:h-3 sm:hover:h-3.5"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            onClick={seek}
            onMouseMove={(e) => {
              if (!duration) return;
              const r = e.currentTarget.getBoundingClientRect();
              setSeekPreview(((e.clientX - r.left) / r.width) * duration);
            }}
            onMouseLeave={() => setSeekPreview(null)}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25 pointer-events-none" style={{ width: `${buffered}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-rose-500 pointer-events-none" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ left: `${pct}%` }} />
            {seekPreview !== null && duration > 0 && (
              <div
                className="absolute -top-10 -translate-x-1/2 bg-black/90 text-white text-xs px-2.5 py-1.5 rounded-lg pointer-events-none whitespace-nowrap font-mono shadow-xl border border-white/10"
                style={{ left: `${Math.max(2, Math.min(98, (seekPreview / duration) * 100))}%` }}
              >
                {fmt(seekPreview)}
              </div>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button onClick={() => skip(-10)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all" title="Back 10s (J)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V7l-4-4 4-4v2.05c.17.01.33.03.5.05V3z" opacity="0.9"/>
                  <text x="7.5" y="15" fontSize="5.5" fontWeight="bold" fontFamily="system-ui,sans-serif" fill="white">10</text>
                </svg>
              </button>
              <button onClick={togglePlay} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-rose-300 rounded-xl hover:bg-white/10 transition-all" title="Play/Pause (Space)">
                {isPlaying
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
              </button>
              <button onClick={() => skip(10)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all" title="Forward 10s (L)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.5 3v2.05A7 7 0 1 1 4.5 12h-2a9 9 0 1 0 9-9z" opacity="0.9"/>
                  <path d="M11.5 3l4 4-4 4V3z"/>
                  <text x="7.5" y="15" fontSize="5.5" fontWeight="bold" fontFamily="system-ui,sans-serif" fill="white">10</text>
                </svg>
              </button>
              <div className="flex items-center gap-1.5 ml-1" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
                <button onClick={toggleMute} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all" title="Mute (M)">
                  {isMuted || volume === 0
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                    : volume < 0.5
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>}
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${showVolumeSlider ? 'w-20 sm:w-28 opacity-100' : 'w-0 opacity-0'}`}>
                  <input type="range" min={0} max={1} step={0.02} value={isMuted ? 0 : volume} onChange={(e) => changeVolume(parseFloat(e.target.value))} className="w-full h-1 accent-rose-500 cursor-pointer" />
                </div>
              </div>
              <span className="text-white/70 text-xs sm:text-sm font-mono ml-2 tabular-nums hidden sm:block">{fmt(currentTime)} <span className="text-white/40">/</span> {fmt(duration)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/70 text-xs font-mono sm:hidden tabular-nums">{fmt(currentTime)}</span>
              <button onClick={toggleFullscreen} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all" title="Fullscreen (F)">
                {isFullscreen
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {(showQuality || showSpeedMenu) && (
        <div className="absolute inset-0 z-20" onClick={(e) => { e.stopPropagation(); setShowQuality(false); setShowSpeedMenu(false); }} />
      )}
    </div>
  );
}

// ─── Details Content ──────────────────────────────────────────────────────────

function DetailsContent({ data }: { data: any }) {
  const formatDuration = (sec: number) => {
    if (!sec) return '';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const subject = data.subject || {};
  const resource = data.resource || {};
  const cast = subject.cast || [];
  const director = subject.director || [];
  const writer = subject.writer || [];
  const cover = subject.cover?.url || subject.coverUrl || '';
  const year = (subject.releaseDate || '').substring(0, 4) || 'N/A';
  const rating = subject.imdbRatingValue || '—';
  const ratingCount = subject.imdbRatingCount || 0;
  const type = subject.subjectType === 1 ? 'Movie' : subject.subjectType === 2 ? 'Series' : subject.subjectType === 3 ? 'Music' : 'Other';
  const genre = subject.genre || '';
  const country = subject.countryName || '';
  const description = subject.description || '';
  const duration = subject.duration ? formatDuration(subject.duration) : '';
  const seasons = resource.seasons || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
        <div className="flex-shrink-0 mx-auto md:mx-0">
          {cover
            ? <img src={cover} alt={subject.title} className="w-full sm:w-56 md:w-64 h-auto sm:h-80 md:h-96 object-cover rounded-xl shadow-xl" />
            : <div className="w-full sm:w-56 md:w-64 h-64 sm:h-80 md:h-96 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center text-5xl sm:text-6xl md:text-8xl">🎬</div>}
        </div>
        <div className="flex-1 space-y-3 sm:space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">{subject.title}</h1>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <span className="px-2 sm:px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs sm:text-sm font-semibold">{year}</span>
              <span className="px-2 sm:px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs sm:text-sm font-semibold">{type}</span>
              {rating !== '—' && <span className="px-2 sm:px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs sm:text-sm font-semibold">⭐ {rating} {ratingCount > 0 && `(${ratingCount.toLocaleString()})`}</span>}
              {country && <span className="px-2 sm:px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs sm:text-sm font-semibold">{country}</span>}
              {duration && <span className="px-2 sm:px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs sm:text-sm font-semibold">{duration}</span>}
            </div>
          </div>
          {genre && <div><h3 className="text-xs sm:text-sm font-semibold text-slate-400 mb-1">Genre</h3><p className="text-sm sm:text-base text-white">{genre}</p></div>}
          {description && <div><h3 className="text-xs sm:text-sm font-semibold text-slate-400 mb-2">Description</h3><p className="text-sm sm:text-base text-slate-300 leading-relaxed">{description}</p></div>}
        </div>
      </div>
      {(cast.length > 0 || director.length > 0 || writer.length > 0) && (
        <div className="border-t border-slate-700/50 pt-4 sm:pt-6">
          <h3 className="text-base sm:text-lg font-bold text-rose-500 mb-3 sm:mb-4">Cast & Crew</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {director.length > 0 && <div><h4 className="text-xs sm:text-sm font-semibold text-slate-400 mb-1.5 sm:mb-2">Director</h4><div className="space-y-1">{director.map((d: any, idx: number) => <p key={idx} className="text-sm sm:text-base text-white">{d.name || d}</p>)}</div></div>}
            {writer.length > 0 && <div><h4 className="text-xs sm:text-sm font-semibold text-slate-400 mb-1.5 sm:mb-2">Writer</h4><div className="space-y-1">{writer.map((w: any, idx: number) => <p key={idx} className="text-sm sm:text-base text-white">{w.name || w}</p>)}</div></div>}
            {cast.length > 0 && <div><h4 className="text-xs sm:text-sm font-semibold text-slate-400 mb-1.5 sm:mb-2">Cast</h4><div className="space-y-1">{cast.slice(0, 10).map((c: any, idx: number) => <p key={idx} className="text-sm sm:text-base text-white">{c.name || c}</p>)}{cast.length > 10 && <p className="text-slate-400 text-xs sm:text-sm">+{cast.length - 10} more</p>}</div></div>}
          </div>
        </div>
      )}
      {seasons.length > 0 && (
        <div className="border-t border-slate-700/50 pt-4 sm:pt-6">
          <h3 className="text-base sm:text-lg font-bold text-rose-500 mb-3 sm:mb-4">Seasons</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {seasons.map((s: any) => (
              <div key={s.se} className="p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors">
                <p className="font-semibold text-white text-sm sm:text-base">Season {s.se}</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">{s.maxEp} episodes</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Episode Picker (Downloads) ───────────────────────────────────────────────

function EpisodePicker({ title, seasons, subjectId, detailPath, onFetchLinks }: {
  title: string;
  seasons: Array<{ se: number; maxEp: number }>;
  subjectId: string;
  detailPath: string;
  onFetchLinks: (subjectId: string, detailPath: string, label: string, se: number, ep: number) => Promise<JSX.Element>;
}) {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.se || 1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [linksContent, setLinksContent] = useState<JSX.Element | null>(null);
  const currentSeason = seasons.find((s) => s.se === selectedSeason);
  const maxEp = currentSeason?.maxEp || 1;

  useEffect(() => { setSelectedEpisode(1); setLinksContent(null); }, [selectedSeason]);

  async function handleFetchLinks() {
    setIsLoading(true);
    setLinksContent(<div className="flex flex-col items-center justify-center py-6 sm:py-8 text-slate-400"><div className="spinner w-5 h-5 sm:w-6 sm:h-6 mb-2 sm:mb-3"></div><p className="text-sm sm:text-base">Fetching S{selectedSeason} E{selectedEpisode}...</p></div>);
    const label = `${title} S${String(selectedSeason).padStart(2, '0')}E${String(selectedEpisode).padStart(2, '0')}`;
    const content = await onFetchLinks(subjectId, detailPath, label, selectedSeason, selectedEpisode);
    setLinksContent(content);
    setIsLoading(false);
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-base sm:text-lg font-bold text-rose-500 flex items-center gap-2"><span>🎬</span> Select Season & Episode</h3>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
        <select value={selectedSeason} onChange={(e) => setSelectedSeason(Number(e.target.value))} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all cursor-pointer text-sm sm:text-base">
          {seasons.map((s) => <option key={s.se} value={s.se}>Season {s.se} ({s.maxEp} episodes)</option>)}
        </select>
        <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(Number(e.target.value))} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all cursor-pointer text-sm sm:text-base">
          {Array.from({ length: maxEp }, (_, i) => i + 1).map((ep) => <option key={ep} value={ep}>Episode {ep}</option>)}
        </select>
        <button onClick={handleFetchLinks} disabled={isLoading} className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
          {isLoading ? <><div className="spinner"></div><span>Loading...</span></> : 'Get Links'}
        </button>
      </div>
      <div>{linksContent}</div>
    </div>
  );
}

// ─── Video Episode Picker (Watch) ─────────────────────────────────────────────

function VideoEpisodePicker({ title, seasons, subjectId, detailPath, onPlay }: {
  title: string;
  seasons: Array<{ se: number; maxEp: number }>;
  subjectId: string;
  detailPath: string;
  onPlay: (subjectId: string, detailPath: string, title: string, se: number, ep: number) => Promise<void>;
}) {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.se || 1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const currentSeason = seasons.find((s) => s.se === selectedSeason);
  const maxEp = currentSeason?.maxEp || 1;

  useEffect(() => { setSelectedEpisode(1); }, [selectedSeason]);

  async function handlePlay() {
    setIsLoading(true);
    await onPlay(subjectId, detailPath, title, selectedSeason, selectedEpisode);
    setIsLoading(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2"><span>▶</span> Select Episode to Watch</h3>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <select value={selectedSeason} onChange={(e) => setSelectedSeason(Number(e.target.value))} className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer text-sm sm:text-base">
          {seasons.map((s) => <option key={s.se} value={s.se}>Season {s.se} ({s.maxEp} episodes)</option>)}
        </select>
        <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(Number(e.target.value))} className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer text-sm sm:text-base">
          {Array.from({ length: maxEp }, (_, i) => i + 1).map((ep) => <option key={ep} value={ep}>Episode {ep}</option>)}
        </select>
        <button onClick={handlePlay} disabled={isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
          {isLoading ? <><div className="spinner"></div><span>Loading...</span></> : <><span>▶</span><span>Play</span></>}
        </button>
      </div>
    </div>
  );
}