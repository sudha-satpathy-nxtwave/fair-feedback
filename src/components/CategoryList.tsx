import { motion } from "framer-motion";
import { Sparkles, Lightbulb } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FeedbackItem {
  id: string;
  student_id: string;
  description: string;
  ai_score: number | null;
  created_at?: string;
}

interface Props {
  items: FeedbackItem[];
  variant: "appreciation" | "improvement";
}

/**
 * Clean, scrollable list view of feedback items.
 * Replaces the previous animated marquee for clarity (per spec: simple list views).
 */
const CategoryList = ({ items, variant }: Props) => {
  const isApp = variant === "appreciation";
  const Icon = isApp ? Sparkles : Lightbulb;
  const title = isApp ? "Top Appreciations" : "Improvement Points";

  const accentBorder = isApp ? "border-success/25" : "border-warning/25";
  const accentBg = isApp ? "bg-success/5" : "bg-warning/5";
  const accentText = isApp ? "text-success" : "text-warning";
  const itemBorder = isApp ? "border-success/15" : "border-warning/15";

  return (
    <div className={`rounded-2xl border ${accentBorder} ${accentBg} backdrop-blur-xl p-4 h-full flex flex-col`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accentText}`} />
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground flex-1 flex items-center justify-center text-center py-8">
          No {isApp ? "appreciation" : "improvement"} feedback yet.
        </p>
      ) : (
        <ScrollArea className="h-[260px] pr-3">
          <div className="space-y-2">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                className={`rounded-xl bg-card/80 border ${itemBorder} p-3 text-xs text-foreground/90`}
              >
                <p className="leading-relaxed">"{item.description}"</p>
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{item.student_id}</span>
                  <span>Score: {item.ai_score ?? "—"}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default CategoryList;
