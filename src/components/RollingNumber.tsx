import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

interface RollingNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

const RollingNumber = ({ value, duration = 1.2, className }: RollingNumberProps) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toString());

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    return controls.stop;
  }, [value, duration, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
};

export default RollingNumber;
