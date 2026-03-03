'use client';

import { useState, useEffect, JSX } from 'react';

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

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [subjectType, setSubjectType] = useState(1);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [stats, setStats] = useState({ fetched: 0, matched: 0 });
  const [results, setResults] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    subjectId: string;
    detailPath: string;
    title: string;
    seasons: Array<{ se: number; maxEp: number }>;
  } | null>(null);
  const [modalContent, setModalContent] = useState<JSX.Element | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

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
      const results = await searchMovies(page, 28);
      allItems = allItems.concat(results.items || []);
      hasMore = results.pager?.hasMore === true;
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

  async function getDownloadLinks(
    subjectId: string,
    detailPath: string,
    se = 0,
    ep = 0
  ) {
    const res = await fetch(
      `/api/download?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`
    );
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'Download failed');
    return data.data;
  }

  async function getPlayStreams(
    subjectId: string,
    detailPath: string,
    se = 0,
    ep = 0
  ) {
    const res = await fetch(
      `/api/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`
    );
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'Play failed');
    return data.data;
  }

  function formatSize(bytes: number) {
    const num = Number(bytes);
    if (!num) return 'N/A';
    if (num >= 1073741824) return (num / 1073741824).toFixed(2) + ' GB';
    if (num >= 1048576) return (num / 1048576).toFixed(1) + ' MB';
    if (num >= 1024) return (num / 1024).toFixed(1) + ' KB';
    return num + ' B';
  }

  function formatDuration(sec: number) {
    if (!sec) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function typeName(t: number) {
    return t === 1 ? 'Movie' : t === 2 ? 'Series' : t === 3 ? 'Music' : 'Other';
  }

  function proxyUrl(url: string, name: string) {
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
      const filtered = allItems.filter((item) =>
        item.title.toLowerCase().includes(keyword.toLowerCase())
      );

      setStats({ fetched: allItems.length, matched: filtered.length });
      setStatusMsg(`Fetching details for ${filtered.length} result(s)...`);

      const detailed: MovieItem[] = [];
      for (const item of filtered) {
        try {
          const detail = await getDetails(item.subjectId);
          detail.subject._resource = detail.resource || null;
          detailed.push(detail.subject);
        } catch {
          detailed.push(item);
        }
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

    setModalData({
      subjectId: item.subjectId,
      detailPath: item.detailPath,
      title: item.title,
      seasons,
    });
    setModalOpen(true);

    if (isSeries && seasons.length > 0) {
      setModalContent(
        <EpisodePicker
          title={item.title}
          seasons={seasons}
          subjectId={item.subjectId}
          detailPath={item.detailPath}
          onFetchLinks={fetchAndRenderLinks}
        />
      );
    } else {
      setModalContent(
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="spinner w-8 h-8 border-3 mb-4"></div>
          <p className="text-lg">Fetching download links...</p>
        </div>
      );
      const content = await fetchAndRenderLinks(item.subjectId, item.detailPath, item.title, 0, 0);
      setModalContent(content);
    }
  }

  async function fetchAndRenderLinks(
    subjectId: string,
    detailPath: string,
    label: string,
    se = 0,
    ep = 0
  ): Promise<JSX.Element> {
    try {
      const [dlData, playData] = await Promise.all([
        getDownloadLinks(subjectId, detailPath, se, ep),
        getPlayStreams(subjectId, detailPath, se, ep),
      ]);

      const downloads = dlData.downloads || [];
      const captions = dlData.captions || [];
      const streams = playData.streams || [];

      return (
        <div className="space-y-6">
          {downloads.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-rose-500 mb-3 flex items-center gap-2">
                <span>⬇</span> Download Links
              </h3>
              <div className="space-y-2">
                {downloads.map((dl: any, idx: number) => {
                  const fname = `${label} (${dl.resolution}p).mp4`;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-wrap text-sm text-slate-300">
                        <span className="font-bold text-white text-base">{dl.resolution}p</span>
                        <span>{dl.format}</span>
                        <span>{dl.codecName}</span>
                        <span>{formatSize(dl.size)}</span>
                        <span>{formatDuration(dl.duration)}</span>
                      </div>
                      <a
                        href={proxyUrl(dl.url, fname)}
                        download={fname}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {streams.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-rose-500 mb-3 flex items-center gap-2">
                <span>▶</span> Stream Links
              </h3>
              <div className="space-y-2">
                {streams.map((s: any, idx: number) => {
                  const fname = `${label} (${s.resolutions}p).mp4`;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-wrap text-sm text-slate-300">
                        <span className="font-bold text-white text-base">{s.resolutions}p</span>
                        <span>{s.format}</span>
                        <span>{s.codecName}</span>
                        <span>{formatSize(s.size)}</span>
                        <span>{formatDuration(s.duration)}</span>
                      </div>
                      <a
                        href={proxyUrl(s.url, fname)}
                        download={fname}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {captions.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-rose-500 mb-3 flex items-center gap-2">
                <span>🗂</span> Subtitles
              </h3>
              <div className="space-y-2">
                {captions.map((cap: any, idx: number) => {
                  const fname = `${label}.${cap.lan}.srt`;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-wrap text-sm text-slate-300">
                        <span className="font-bold text-white text-base">{cap.lanName}</span>
                        <span>({cap.lan})</span>
                        <span>{formatSize(cap.size)}</span>
                      </div>
                      <a
                        href={proxyUrl(cap.url, fname)}
                        download={fname}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
                      >
                        Download .srt
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {downloads.length === 0 && streams.length === 0 && captions.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No download links available for this content
            </div>
          )}
        </div>
      );
    } catch (err: any) {
      return (
        <div className="text-center py-16 text-rose-400">
          <p className="text-lg font-semibold">Failed to fetch links</p>
          <p className="text-sm mt-2">{err.message}</p>
        </div>
      );
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-rose-500/20">
                ▶
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                MovieBox Downloader
              </h1>
            </div>

            {/* Search Bar */}
            <div className="flex-1 w-full flex gap-3">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder="Search movies, series, music..."
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all"
                autoFocus
              />
              <select
                value={subjectType}
                onChange={(e) => setSubjectType(Number(e.target.value))}
                className="px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all cursor-pointer min-w-[120px]"
              >
                <option value={0}>All</option>
                <option value={1}>Movies</option>
                <option value={2}>Series</option>
                <option value={3}>Music</option>
              </select>
              <button
                onClick={doSearch}
                disabled={isSearching}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="spinner"></div>
                    <span>Searching...</span>
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      {statusMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div
            className={`px-4 py-3 rounded-xl ${
              isError
                ? 'bg-rose-500/10 border border-rose-500/50 text-rose-400'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-300'
            }`}
          >
            {statusMsg}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats.fetched > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 flex gap-3">
          <div className="px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300">
            Fetched: <span className="font-bold text-rose-400">{stats.fetched}</span>
          </div>
          <div className="px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300">
            Matched: <span className="font-bold text-rose-400">{stats.matched}</span>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {results.length === 0 && !isSearching && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-xl text-slate-400">No results found</p>
            <p className="text-sm text-slate-500 mt-2">Try searching for a movie, series, or music</p>
          </div>
        )}

        {isSearching && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="skeleton"></div>
              ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              <div
                key={i}
                className="group bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Cover Image */}
                {cover ? (
                  <img
                    src={cover}
                    alt={item.title}
                    className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-6xl">
                    🎬
                  </div>
                )}

                {/* Card Body */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-white mb-3 line-clamp-2">{item.title}</h3>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold">
                      {year}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold">
                      {type}
                    </span>
                    {rating !== '—' && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        ⭐ {rating}
                      </span>
                    )}
                    {country && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold">
                        {country}
                      </span>
                    )}
                    {duration && (
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-semibold">
                        {duration}
                      </span>
                    )}
                  </div>

                  {/* Genre */}
                  {genre && (
                    <p className="text-sm text-slate-400 mb-2 line-clamp-1">{genre}</p>
                  )}

                  {/* Description */}
                  {desc && (
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{desc}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openDownloads(i)}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold text-sm transition-all"
                    >
                      ⬇ Downloads
                    </button>
                    <button
                      onClick={() => openDetails(i)}
                      className="px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-rose-500/50 text-slate-300 hover:text-white font-semibold text-sm transition-all"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white line-clamp-1">{modalData?.title || 'Loading...'}</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">{modalContent}</div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailsModalOpen(false);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white line-clamp-1">
                {detailsData?.subject?.title || 'Loading...'}
              </h2>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {isLoadingDetails ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="spinner w-8 h-8 mb-4"></div>
                  <p className="text-lg">Loading details...</p>
                </div>
              ) : detailsData?.error ? (
                <div className="text-center py-16 text-rose-400">
                  <p className="text-lg font-semibold">Failed to load details</p>
                  <p className="text-sm mt-2">{detailsData.error}</p>
                </div>
              ) : detailsData?.subject ? (
                <DetailsContent data={detailsData} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailsContent({ data }: { data: any }) {
  const formatDuration = (sec: number) => {
    if (!sec) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
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
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Cover Image */}
        <div className="flex-shrink-0">
          {cover ? (
            <img
              src={cover}
              alt={subject.title}
              className="w-full md:w-64 h-96 object-cover rounded-xl shadow-xl"
            />
          ) : (
            <div className="w-full md:w-64 h-96 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center text-8xl">
              🎬
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{subject.title}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-semibold">
                {year}
              </span>
              <span className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-sm font-semibold">
                {type}
              </span>
              {rating !== '—' && (
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-semibold">
                  ⭐ {rating} {ratingCount > 0 && `(${ratingCount.toLocaleString()})`}
                </span>
              )}
              {country && (
                <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-sm font-semibold">
                  {country}
                </span>
              )}
              {duration && (
                <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-semibold">
                  {duration}
                </span>
              )}
            </div>
          </div>

          {genre && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-1">Genre</h3>
              <p className="text-white">{genre}</p>
            </div>
          )}

          {description && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-2">Description</h3>
              <p className="text-slate-300 leading-relaxed">{description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cast & Crew */}
      {(cast.length > 0 || director.length > 0 || writer.length > 0) && (
        <div className="border-t border-slate-700/50 pt-6">
          <h3 className="text-lg font-bold text-rose-500 mb-4">Cast & Crew</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {director.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Director</h4>
                <div className="space-y-1">
                  {director.map((d: any, idx: number) => (
                    <p key={idx} className="text-white">{d.name || d}</p>
                  ))}
                </div>
              </div>
            )}
            {writer.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Writer</h4>
                <div className="space-y-1">
                  {writer.map((w: any, idx: number) => (
                    <p key={idx} className="text-white">{w.name || w}</p>
                  ))}
                </div>
              </div>
            )}
            {cast.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Cast</h4>
                <div className="space-y-1">
                  {cast.slice(0, 10).map((c: any, idx: number) => (
                    <p key={idx} className="text-white">{c.name || c}</p>
                  ))}
                  {cast.length > 10 && (
                    <p className="text-slate-400 text-sm">+{cast.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seasons (for Series) */}
      {seasons.length > 0 && (
        <div className="border-t border-slate-700/50 pt-6">
          <h3 className="text-lg font-bold text-rose-500 mb-4">Seasons</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {seasons.map((s: any) => (
              <div
                key={s.se}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-rose-500/50 transition-colors"
              >
                <p className="font-semibold text-white">Season {s.se}</p>
                <p className="text-sm text-slate-400 mt-1">{s.maxEp} episodes</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function EpisodePicker({
  title,
  seasons,
  subjectId,
  detailPath,
  onFetchLinks,
}: {
  title: string;
  seasons: Array<{ se: number; maxEp: number }>;
  subjectId: string;
  detailPath: string;
  onFetchLinks: (
    subjectId: string,
    detailPath: string,
    label: string,
    se: number,
    ep: number
  ) => Promise<JSX.Element>;
}) {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.se || 1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [linksContent, setLinksContent] = useState<JSX.Element | null>(null);

  const currentSeason = seasons.find((s) => s.se === selectedSeason);
  const maxEp = currentSeason?.maxEp || 1;

  useEffect(() => {
    setSelectedEpisode(1);
    setLinksContent(null);
  }, [selectedSeason]);

  async function handleFetchLinks() {
    setIsLoading(true);
    setLinksContent(
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <div className="spinner w-6 h-6 mb-3"></div>
        <p>Fetching S{selectedSeason} E{selectedEpisode}...</p>
      </div>
    );

    const label = `${title} S${String(selectedSeason).padStart(2, '0')}E${String(selectedEpisode).padStart(2, '0')}`;
    const content = await onFetchLinks(subjectId, detailPath, label, selectedSeason, selectedEpisode);
    setLinksContent(content);
    setIsLoading(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-rose-500 flex items-center gap-2">
        <span>🎬</span> Select Season & Episode
      </h3>
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all cursor-pointer"
        >
          {seasons.map((s) => (
            <option key={s.se} value={s.se}>
              Season {s.se} ({s.maxEp} episodes)
            </option>
          ))}
        </select>
        <select
          value={selectedEpisode}
          onChange={(e) => setSelectedEpisode(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all cursor-pointer"
        >
          {Array.from({ length: maxEp }, (_, i) => i + 1).map((ep) => (
            <option key={ep} value={ep}>
              Episode {ep}
            </option>
          ))}
        </select>
        <button
          onClick={handleFetchLinks}
          disabled={isLoading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              <span>Loading...</span>
            </>
          ) : (
            'Get Links'
          )}
        </button>
      </div>
      <div>{linksContent}</div>
    </div>
  );
}
