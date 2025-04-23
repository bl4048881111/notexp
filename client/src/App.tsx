import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "./contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import QuotesPage from "./pages/QuotesPage";
import ServiceManagementPage from "./pages/ServiceManagementPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import NotFound from "@/pages/not-found";
import { useAuth } from "./hooks/useAuth";
import DevLogger, { devLogger } from "./components/dev/DevLogger";
import { ActivityLoggerProvider } from "./components/dev/ActivityLogger";

// Import global styles
import "@/styles/globals.css";

// Protected route component
const ProtectedRoute = ({ component: Component, ...rest }: { component: React.ComponentType<any>, path: string }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component {...rest} />;
};

function Router() {
  const { isAuthenticated } = useAuth();
  
  // Handled by the Route component now
  useEffect(() => {
    // Empty effect - using Redirect component is more reliable
  }, []);

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} path="/dashboard" />}
      </Route>
      <Route path="/clients">
        {() => <ProtectedRoute component={ClientsPage} path="/clients" />}
      </Route>
      <Route path="/appointments">
        {() => <ProtectedRoute component={AppointmentsPage} path="/appointments" />}
      </Route>
      <Route path="/quotes">
        {() => <ProtectedRoute component={QuotesPage} path="/quotes" />}
      </Route>
      <Route path="/services">
        {() => <ProtectedRoute component={ServiceManagementPage} path="/services" />}
      </Route>
      <Route path="/activity-log">
        {() => <ProtectedRoute component={ActivityLogPage} path="/activity-log" />}
      </Route>
      <Route path="/">
        {() => {
          const { isAuthenticated } = useAuth();
          return isAuthenticated 
            ? <Redirect to="/dashboard" /> 
            : <Redirect to="/login" />;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isLoginPage = location === '/login';
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      {isAuthenticated && !isLoginPage ? (
        <AppLayout>
          <Router />
        </AppLayout>
      ) : (
        <Router />
      )}
      <Toaster />
      <DevLogger />
      
      {/* Pulsante di debug nascosto - solo per test */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 z-10">
          <button
            className="bg-zinc-900 text-white px-3 py-2 rounded-md text-xs border border-zinc-700 hover:bg-zinc-800"
            onClick={() => {
              // Importa dinamicamente e usa il logger
              import('./components/dev/DevLogger').then(module => {
                const { devLogger } = module;
                
                // Log di esempio
                devLogger.log('Pulsante di debug premuto', 'info', 'App', { timestamp: Date.now() });
                devLogger.log('Esempio di log di successo', 'success', 'App', { sample: true });
                devLogger.log('Esempio di warning', 'warning', 'App');
                devLogger.log('Esempio di errore', 'error', 'App', { 
                  error: 'Questo è solo un test',
                  stack: 'App.tsx:123 -> onClick'
                });
              });
            }}
          >
            Test Logger
          </button>
        </div>
      )}
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActivityLoggerProvider>
          <AppContent />
        </ActivityLoggerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
