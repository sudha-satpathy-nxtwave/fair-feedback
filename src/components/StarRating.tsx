import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

const StarRating = ({ value, onChange, label }: StarRatingProps) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (hovered || value);
          return (
            <motion.button
              key={star}
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(star)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5"
            >
              <Star
                className={`w-9 h-9 transition-colors duration-200 ${
                  filled
                    ? "fill-star-filled text-star-filled"
                    : "fill-transparent text-star-empty"
                }`}
                strokeWidth={1.5}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default StarRating;
