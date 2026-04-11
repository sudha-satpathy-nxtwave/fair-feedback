import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const SuccessAnimation = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 15 }}
    className="flex flex-col items-center gap-5 py-8 text-center"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
    >
      <CheckCircle2 className="w-20 h-20 text-success" strokeWidth={1.5} />
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="text-xl font-bold text-foreground"
    >
      Feedback Submitted!
    </motion.h2>
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="text-muted-foreground text-sm max-w-xs"
    >
      Feedback submitted successfully. Attendance marked.
    </motion.p>
  </motion.div>
);

export default SuccessAnimation;
