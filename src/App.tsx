import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import { FAQChatbot } from "@/components/FAQChatbot";
import { RouteScrollReset } from "@/components/layout/RouteScrollReset";

const Courts = lazy(() => import("./pages/Courts"));
const OpenPlay = lazy(() => import("./pages/OpenPlay"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Confirmation = lazy(() => import("./pages/Confirmation"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
const Help = lazy(() => import("./pages/Help"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminOpenPlay = lazy(() => import("./pages/admin/AdminOpenPlay"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCourts = lazy(() => import("./pages/admin/AdminCourts"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminReservations = lazy(() => import("./pages/admin/AdminReservations"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCheckIn = lazy(() => import("./pages/admin/AdminCheckIn"));
const AdminAttendance = lazy(() => import("./pages/admin/AdminAttendance"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <RouteScrollReset />
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</div>}>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/courts" element={<Courts />} />
            <Route path="/open-play" element={<OpenPlay />} />
            <Route path="/admin/open-play" element={<ProtectedRoute requireAdmin><AdminOpenPlay /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/help" element={<Help />} />
            <Route path="/faq" element={<Navigate to="/help" replace />} />

            {/* Auth-protected routes */}
            {/* Legacy per-court booking URL — redirect to unified grid */}
            <Route path="/book/:id" element={<Navigate to="/courts" replace />} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/confirmation" element={<ProtectedRoute><Confirmation /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Admin-protected routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/courts" element={<ProtectedRoute requireAdmin><AdminCourts /></ProtectedRoute>} />
            <Route path="/admin/bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />
            <Route path="/admin/reservations" element={<ProtectedRoute requireAdmin><AdminReservations /></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute requireAdmin><AdminPayments /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/check-in" element={<ProtectedRoute requireAdmin><AdminCheckIn /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute requireAdmin><AdminAttendance /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <FAQChatbot />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
