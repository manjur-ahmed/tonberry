import type { YoutubeVideo } from '../lib/youtube'

// Renders whatever YoutubeClient's real search actually resolved — never a
// model-generated video id/URL (see tool-config.ts's VIDEO_KEYWORDS_GUIDANCE
// and YoutubeClient for why). youtube-nocookie.com is YouTube's own
// privacy-enhanced embed domain — no tracking cookies until the video is
// actually played. No autoplay: the user presses play themselves.
function YoutubeEmbed({ video }: { video: YoutubeVideo }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-video w-full">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
          title={video.title || 'Related video'}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {video.channelTitle && (
        <p className="px-3 py-2 text-xs text-slate-500">{video.channelTitle}</p>
      )}
    </div>
  )
}

export default YoutubeEmbed
