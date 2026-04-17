import { Sparkles, Quote } from "lucide-react";

interface TopFeedback {
  id: string;
  student_id: string;
  description: string;
  ai_score: number | null;
}

interface Props {
  items: TopFeedback[];
}

/**
 * Auto-scrolling marquee of high-scoring feedback.
 * Pure CSS animation; pauses on hover.
 */
const TopFeedbackTicker = ({ items }: Props) => {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 text-center">
        <Sparkles className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No top-rated feedback yet (AI score ≥ 95).</p>
      </div>
    );
  }

  // Duplicate the list so the loop is seamless.
  const loop = [...items, ...items];

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Top Feedback Ticker</h3>
        <span className="text-xs text-muted-foreground">AI ≥ 95</span>
      </div>

      <div
        className="relative overflow-hidden group"
        style={{ maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)" }}
      >
        <div
          className="flex gap-3 w-max animate-[ticker_45s_linear_infinite] group-hover:[animation-play-state:paused]"
        >
          {loop.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="shrink-0 w-[320px] rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">
                  {item.student_id}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  <Sparkles className="w-2.5 h-2.5" />
                  {item.ai_score}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Quote className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/85 leading-relaxed line-clamp-3">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default TopFeedbackTicker;
