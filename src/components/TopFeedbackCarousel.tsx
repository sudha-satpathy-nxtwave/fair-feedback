import { motion } from "framer-motion";
import { Sparkles, Quote } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface TopFeedback {
  id: string;
  student_id: string;
  description: string;
  ai_score: number | null;
  understanding_rating: number;
  instructor_rating: number;
}

interface Props {
  items: TopFeedback[];
}

const TopFeedbackCarousel = ({ items }: Props) => {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <Sparkles className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No top-rated feedback yet (AI score ≥ 95).</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Top Feedbacks</h3>
        <span className="text-xs text-muted-foreground">AI score ≥ 95</span>
      </div>
      <Carousel opts={{ loop: items.length > 1 }} className="px-2">
        <CarouselContent>
          {items.map((item) => (
            <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/2">
              <div className="h-full rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{item.student_id}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    <Sparkles className="w-3 h-3" />
                    {item.ai_score}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Quote className="w-4 h-4 text-primary/40 shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/85 leading-relaxed line-clamp-4">
                    {item.description}
                  </p>
                </div>
                <div className="flex gap-3 pt-1 text-xs text-muted-foreground border-t border-border/50">
                  <span>Understanding: <strong className="text-foreground">{item.understanding_rating}⭐</strong></span>
                  <span>Instructor: <strong className="text-foreground">{item.instructor_rating}⭐</strong></span>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {items.length > 1 && (
          <>
            <CarouselPrevious className="-left-2" />
            <CarouselNext className="-right-2" />
          </>
        )}
      </Carousel>
    </motion.div>
  );
};

export default TopFeedbackCarousel;
