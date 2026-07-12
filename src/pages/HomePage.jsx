import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/bundle';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import api from '../services/api';
import { FiHeart, FiMessageCircle, FiShare2 } from 'react-icons/fi';
import { AiOutlineClose } from 'react-icons/ai';

const cardHeight = 240;

const fetchVideos = async ({ pageParam = 1 }) => {
  const { data } = await api.get(`/videos?page=${pageParam}&limit=8`);
  return data;
};

function HomePage() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentState, setCommentState] = useState({});
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['videos'],
    queryFn: fetchVideos,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (allPages.length < lastPage.totalPages ? allPages.length + 1 : undefined),
  });

  const videos = useMemo(() => data?.pages.flatMap((page) => page.videos) || [], [data]);
  const selectedVideoData = videos.find((video) => video._id === selectedVideo?._id) || selectedVideo;

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', selectedVideoData?._id],
    queryFn: async () => {
      if (!selectedVideoData?._id) return [];
      const { data } = await api.get(`/videos/${selectedVideoData._id}/comments`);
      return data;
    },
    enabled: !!selectedVideoData?._id,
  });

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 250;
      if (nearBottom && hasNextPage && !isFetchingNextPage) fetchNextPage();
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const likeMutation = useMutation({
    mutationFn: async (videoId) => api.post(`/videos/${videoId}/like`),
    onMutate: async (videoId) => {
      await queryClient.cancelQueries({ queryKey: ['videos'] });
      const previous = queryClient.getQueryData(['videos']);
      queryClient.setQueriesData({ queryKey: ['videos'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            videos: page.videos.map((video) => (video._id === videoId ? { ...video, likes: video.likes + 1 } : video))
          }))
        };
      });
      return { previous };
    },
    onError: (_err, _videoId, context) => {
      queryClient.setQueryData(['videos'], context.previous);
    }
  });

  const commentMutation = useMutation({
    mutationFn: async ({ videoId, username, comment }) => api.post(`/videos/${videoId}/comment`, { username, comment }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.videoId] });
      setCommentDrafts((prev) => ({ ...prev, [variables.videoId]: '' }));
      setCommentState((prev) => ({ ...prev, [variables.videoId]: 'posted' }));
    }
  });

  const shareMutation = useMutation({
    mutationFn: async ({ videoId, platform }) => api.post(`/videos/${videoId}/share`, { platform })
  });

  const openModal = (video) => {
    setSelectedVideo(video);
    setActiveIndex(videos.findIndex((item) => item._id === video._id));
  };

  const closeModal = () => setSelectedVideo(null);

  const handleCommentSubmit = (videoId) => {
    const username = 'Guest';
    const comment = commentDrafts[videoId]?.trim();
    if (!comment) return;
    commentMutation.mutate({ videoId, username, comment });
  };

  const handleShare = (videoId, platform) => {
    shareMutation.mutate({ videoId, platform });
  };

  const rowRenderer = ({ index, style }) => {
    const video = videos[index];
    if (!video) return null;
    return (
      <div style={style} className="px-2 py-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg shadow-slate-950/30">
          <div className="relative mb-3 overflow-hidden rounded-xl">
            <img loading="lazy" src={video.thumbnail} alt={video.title} className="h-44 w-full object-cover" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">{video.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">{video.description}</p>
            </div>
            <button onClick={() => openModal(video)} className="rounded-full bg-primary px-3 py-1 text-sm text-white">Open</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
            <button onClick={() => likeMutation.mutate(video._id)} className="rounded-full border border-slate-700 px-3 py-1">♥ {video.likes}</button>
            <button onClick={() => openModal(video)} className="rounded-full border border-slate-700 px-3 py-1">💬 {video.commentsCount}</button>
            <button onClick={() => handleShare(video._id, 'copy')} className="rounded-full border border-slate-700 px-3 py-1">↗ Share</button>
          </div>
        </article>
      </div>
    );
  };

  if (isLoading) {
    return <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 text-slate-300">Loading BanVid 2.0…</div>;
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-6 text-text sm:px-6 lg:px-8">
      <header className="mx-auto mb-6 flex max-w-6xl flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-primary">BanVid 2.0</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Socially approved video carousel</h1>
          </div>
          <div className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">{videos.length} videos ready</div>
        </div>
        <p className="max-w-2xl text-sm text-slate-400 sm:text-base">Discover trending clips, interact instantly, and enjoy a mobile-first experience designed for high performance.</p>
      </header>

      <main className="mx-auto max-w-6xl">
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Featured picks</h2>
            <span className="text-sm text-slate-400">Swipe, tap, and share</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {videos.slice(0, 6).map((video) => (
              <button key={video._id} onClick={() => openModal(video)} className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-left">
                <img src={video.thumbnail} alt={video.title} className="h-40 w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                <div className="p-3">
                  <p className="font-medium text-white">{video.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{video.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-xl font-semibold">Browse all videos</h2>
          <Swiper
            spaceBetween={16}
            slidesPerView={1}
            breakpoints={{
              640: { slidesPerView: 1 },
              768: { slidesPerView: 2 },
              1024: { slidesPerView: 3 }
            }}
            navigation
            pagination={{ clickable: true }}
          >
            {videos.map((video) => (
              <SwiperSlide key={video._id}>
                <div className="px-2 py-2">
                  <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg shadow-slate-950/30">
                    <div className="relative mb-3 overflow-hidden rounded-xl">
                      <img loading="lazy" src={video.thumbnail} alt={video.title} className="h-44 w-full object-cover" />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{video.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">{video.description}</p>
                      </div>
                      <button onClick={() => openModal(video)} className="rounded-full bg-primary px-3 py-1 text-sm text-white">Open</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                      <button aria-label="like" onClick={() => likeMutation.mutate(video._id)} className="rounded-full border border-slate-700 px-3 py-1 flex items-center gap-2"><FiHeart /> <span>{video.likes}</span></button>
                      <button aria-label="comments" onClick={() => openModal(video)} className="rounded-full border border-slate-700 px-3 py-1 flex items-center gap-2"><FiMessageCircle /> <span>{video.commentsCount}</span></button>
                      <button aria-label="share" onClick={() => handleShare(video._id, 'copy')} className="rounded-full border border-slate-700 px-3 py-1 flex items-center gap-2"><FiShare2 /> <span>Share</span></button>
                    </div>
                  </article>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      </main>

      {selectedVideoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-3 py-4 backdrop-blur-md" onClick={closeModal}>
          <div className="w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900 p-3 shadow-2xl shadow-slate-950/70 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-primary">Modal carousel</p>
                <h3 className="text-xl font-semibold">{selectedVideoData.title}</h3>
              </div>
              <button onClick={closeModal} aria-label="close modal" className="rounded-full border border-slate-700 px-3 py-1 text-sm flex items-center gap-2"><AiOutlineClose /> Close</button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-2">
                <video
                  className="h-[320px] w-full rounded-xl object-cover sm:h-[420px]"
                  controls
                  preload="metadata"
                  poster={selectedVideoData.thumbnail}
                  src={selectedVideoData.videoUrl}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => likeMutation.mutate(selectedVideoData._id)} aria-label="like video" className="rounded-full bg-primary px-3 py-2 text-sm flex items-center gap-2"><FiHeart /> Like</button>
                  <button onClick={() => handleShare(selectedVideoData._id, 'whatsapp')} aria-label="share whatsapp" className="rounded-full border border-slate-700 px-3 py-2 text-sm flex items-center gap-2">WhatsApp</button>
                  <button onClick={() => handleShare(selectedVideoData._id, 'twitter')} aria-label="share twitter" className="rounded-full border border-slate-700 px-3 py-2 text-sm flex items-center gap-2">X</button>
                  <button onClick={() => handleShare(selectedVideoData._id, 'copy')} aria-label="copy link" className="rounded-full border border-slate-700 px-3 py-2 text-sm flex items-center gap-2">Copy Link</button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                  <h4 className="mb-2 font-semibold">Comments</h4>
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment._id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-sm">
                        <p className="font-medium text-white">{comment.username}</p>
                        <p className="text-slate-400">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={commentDrafts[selectedVideoData._id] || ''}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [selectedVideoData._id]: e.target.value }))}
                    placeholder="Add a comment"
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none"
                  />
                  <button onClick={() => handleCommentSubmit(selectedVideoData._id)} className="mt-2 rounded-full bg-primary px-3 py-2 text-sm">Post comment</button>
                  {commentState[selectedVideoData._id] && <p className="mt-2 text-sm text-emerald-400">Comment posted</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
