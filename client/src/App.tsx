import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import { useContext } from "react";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import QuotesPage from "./pages/QuotesPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ServiceManagementPage from "./pages/ServiceManagementPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import AdminTools from "./pages/AdminTools";
import NotFound from "@/pages/not-found";
import DevLogger, { devLogger } from "./components/dev/DevLogger";
import { ActivityLoggerProvider } from "./components/dev/ActivityLogger";
import OrdersPage from "@/pages/OrdersPage";
import TagliandoPage from "@/pages/TagliandoPage";
import TagliandoDettaglioPage from "@/pages/TagliandoDettaglioPage";
import LaborTestPage from "@/pages/LaborTestPage";
import StoricoLavoriPage from "./pages/StoricoLavoriPage";
import DeliveryPhase from "./components/DeliveryPhase";
import DbChangesPage from './pages/DbChangesPage';
import LandingPage from "./pages/LandingPage";
import ChecklistEditor from "./components/checklist/ChecklistEditor";
import BirthdaysPage from "./pages/BirthdaysPage";
import ProfiloClientePage from "./pages/profilo-cliente";
import PartiSostituitePage from './pages/PartiSostituitePage';

// Import global styles
import "@/styles/globals.css";

// Funzione diretta per usare il contesto Auth senza l'hook personalizzato
const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("AuthContext non disponibile");
  }
  
  return context;
};

// Protected route component
const ProtectedRoute = ({ component: Component, onlyAdmin = false, onlyClient = false, ...rest }: { component: React.ComponentType<any>, path: string, onlyAdmin?: boolean, onlyClient?: boolean }) => {
  const { isAuthenticated, user } = useAuthContext();
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  if (onlyAdmin && user?.clientId) {
    // Cliente prova ad accedere a pagina admin
    return <Redirect to="/dashboard" />;
  }
  if (onlyClient && !user?.clientId) {
    // Admin prova ad accedere a pagina cliente
    return <Redirect to="/dashboard" />;
  }
  return <Component {...rest} />;
};

// Componente per gestire la pagina 404 e reindirizzare alla landing page
const NotFoundRedirect = () => {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Reindirizza automaticamente alla landing page dopo un breve ritardo
    const timer = setTimeout(() => {
      setLocation('/');
    }, 100);
    
    return () => clearTimeout(timer);
  }, [setLocation]);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      <p className="text-muted-foreground">Reindirizzamento in corso...</p>
    </div>
  );
};

function Router() {
  const { isAuthenticated } = useAuthContext();
  
  useEffect(() => {
    // Empty effect - using Redirect component is more reliable
  }, []);

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} path="/dashboard" />}
      </Route>
      <Route path="/appointments">
        {() => <ProtectedRoute component={AppointmentsPage} path="/appointments" />}
      </Route>
      <Route path="/clients">
        {() => <ProtectedRoute component={ClientsPage} path="/clients" onlyAdmin />}
      </Route>
      <Route path="/quotes">
        {() => <ProtectedRoute component={QuotesPage} path="/quotes" />}
      </Route>
      <Route path="/services">
        {() => <ProtectedRoute component={ServiceManagementPage} path="/services" onlyAdmin />}
      </Route>
      <Route path="/activity-log">
        {() => <ProtectedRoute component={ActivityLogPage} path="/activity-log" onlyAdmin />}
      </Route>
      <Route path="/orders">{() => <ProtectedRoute component={OrdersPage} path="/orders" onlyAdmin />}</Route>
      <Route path="/tagliando">{() => <ProtectedRoute component={TagliandoPage} path="/tagliando" onlyAdmin />}</Route>
      <Route path="/tagliando/:id">{() => <ProtectedRoute component={TagliandoDettaglioPage} path="/tagliando/:id" onlyAdmin />}</Route>
      <Route path="/admin-tools">{() => <ProtectedRoute component={AdminTools} path="/admin-tools" onlyAdmin />}</Route>
      <Route path="/labor-test">{() => <ProtectedRoute component={LaborTestPage} path="/labor-test" onlyAdmin />}</Route>
      <Route path="/storico-lavori">{() => <ProtectedRoute component={StoricoLavoriPage} path="/storico-lavori" />}</Route>
      <Route path="/checklist-editor">{() => <ProtectedRoute component={ChecklistEditor} path="/checklist-editor" onlyAdmin />}</Route>
      <Route path="/deliveryPhase/:id">
        {({ id }) => (
          <ProtectedRoute 
            component={({ path }: { path: string }) => (
              <div className="p-6">
                <DeliveryPhase 
                  vehicleId={id || ''} 
                  customerPhone="" 
                  onComplete={() => {
                    console.log("PDF generato con successo");
                  }} 
                />
              </div>
            )} 
            path="/deliveryPhase/:id" 
            onlyAdmin
          />
        )}
      </Route>
      <Route path="/db-changes">{() => <ProtectedRoute component={DbChangesPage} path="/db-changes" onlyAdmin />}</Route>
      <Route path="/database">{() => <ProtectedRoute component={DbChangesPage} path="/database" onlyAdmin />}</Route>
      <Route path="/compleanni">{() => <ProtectedRoute component={BirthdaysPage} path="/compleanni" onlyAdmin />}</Route>
      <Route path="/profilo-cliente">{() => <ProtectedRoute component={ProfiloClientePage} path="/profilo-cliente" onlyClient />}</Route>
      <Route path="/parti-sostituite">
        {() => <ProtectedRoute component={PartiSostituitePage} path="/parti-sostituite" />}
      </Route>
      <Route path="/" component={LandingPage} />
      <Route component={NotFoundRedirect} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const [location] = useLocation();
  const isLoginPage = location === '/login';
  const isLandingPage = location === '/';
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      {isAuthenticated && !isLoginPage && !isLandingPage ? (
        <AppLayout>
          <Router />
        </AppLayout>
      ) : (
        <Router />
      )}
      <Toaster />
      <DevLogger />
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
