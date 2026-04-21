import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocalAuthProvider } from "@/contexts/LocalAuthContext";
import AdminGate from "@/components/AdminGate";
import InstructorGate from "@/components/InstructorGate";
import Index from "./pages/Index";
import MasterAdmin from "./pages/MasterAdmin";
import Setup from "./pages/Setup";
import FeedbackPage from "./pages/FeedbackPage";
import Dashboard from "./pages/Dashboard";
import InstructorQRHub from "./pages/InstructorQRHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LocalAuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/master-admin" element={<MasterAdmin />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/instructor-qr"
              element={
                <AdminGate>
                  <InstructorQRHub />
                </AdminGate>
              }
            />
            {/* Backward-compat alias */}
            <Route path="/qr-hub" element={<InstructorQRHub />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </LocalAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
