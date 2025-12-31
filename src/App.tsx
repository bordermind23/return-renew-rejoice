import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Removals from "./pages/Removals";
import InboundScan from "./pages/InboundScan";
import InboundRecords from "./pages/InboundRecords";
import InboundDiscrepancy from "./pages/InboundDiscrepancy";
import InboundProcess from "./pages/InboundProcess";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Outbound from "./pages/Outbound";
import UserManagement from "./pages/UserManagement";
import Cases from "./pages/Cases";
import Refurbishment from "./pages/Refurbishment";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <InboundScan />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Products />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/removals"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Removals />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbound/scan"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <InboundScan />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbound/records"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <InboundRecords />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbound/discrepancy"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <InboundDiscrepancy />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbound/process"
            element={
              <ProtectedRoute>
                <InboundProcess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Inventory />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Orders />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/outbound"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Outbound />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Cases />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/refurbishment"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Refurbishment />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <UserManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
