import { motion } from "framer-motion";
import { Sparkles, Lightbulb } from "lucide-react";

interface FeedbackItem {
  id: string;
  student_id: string;
  description: string;
  ai_score: number | null;
  category?: string | null;
}

interface Props {
  items: FeedbackItem[];
  variant: "appreciation" | "improvement";
}

/**
 * Auto-scrolling marquee that pauses on hover. Two visual variants
 * for "Appreciation" (green) and "Improvement" (amber).
 */
const CategoryTicker = ({ items, variant }: Props) => {
  const isApp = variant === "appreciation";
  const Icon = isApp ? Sparkles : Lightbulb;
  const title = isApp ? "Top Appreciation" : "Top Improvements";
  const accent = isApp
    ? "from-success/15 to-success/5 border-success/25 text-success"
    : "from-warning/15 to-warning/5 border-warning/25 text-warning";

  if (!items.length) {
    return (
      <div className={`rounded-2xl border bg-gradient-to-br ${accent} backdrop-blur-xl p-4 h-full min-h-[140px] flex flex-col`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" />
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground flex-1 flex items-center justify-center">
          No {isApp ? "appreciation" : "improvement"} feedback yet.
        </p>
      </div>
    );
  }

  // Duplicate for seamless loop
  const loop = [...items, ...items];

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${accent} backdrop-blur-xl p-4 h-full min-h-[140px] overflow-hidden`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" />
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="ml-auto text-[10px] font-mono opacity-70">{items.length}</span>
      </div>
      <div className="relative overflow-hidden group">
        <motion.div
          className="flex gap-3 group-hover:[animation-play-state:paused]"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: items.length * 6, repeat: Infinity, ease: "linear" }}
        >
          {loop.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="shrink-0 max-w-[280px] rounded-xl bg-card/80 border border-border/40 p-3 text-xs text-foreground/90"
            >
              <p className="line-clamp-3 italic">"{item.description}"</p>
              <p className="mt-1.5 text-[10px] font-mono text-muted-foreground">
                {item.student_id} · score {item.ai_score ?? "—"}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default CategoryTicker;
