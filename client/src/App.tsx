import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import QuotesPage from "./pages/QuotesPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import RequestsPage from "./pages/RequestsPage";
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
import ReportLavoriPage from "./pages/ReportLavoriPage";
import DeliveryPhase from "./components/DeliveryPhase";
import DbChangesPage from './pages/DbChangesPage';
import NewLandingPage from "./pages/NewLandingPage";
import ChecklistEditor from "./components/checklist/ChecklistEditor";
import BirthdaysPage from "./pages/BirthdaysPage";
import ProfiloClientePage from "./pages/profilo-cliente";
import PartiSostituitePage from './pages/PartiSostituitePage';
import SuccessPage from "./pages/SuccessPage";
import WhatsAppTemplatesPage from "./pages/WhatsAppTemplatesPage";
import SmartRemindersPage from "./pages/SmartRemindersPage.tsx";
import ChiSiamoPage from "./pages/ChiSiamoPage";
import IstruzioniPage from "./pages/IstruzioniPage";
import PartnersPage from "./pages/PartnersPage";
import SedePage from "./pages/SedePage";
import AccettazioneMercePage from "./pages/AccettazioneMerce";
// Import global styles
import "@/styles/globals.css";

// Protected route component
const ProtectedRoute = ({ component: Component, onlyAdmin = false, onlyClient = false, ...rest }: { component: React.ComponentType<any>, path: string, onlyAdmin?: boolean, onlyClient?: boolean }) => {
  const { isAuthenticated, user } = useAuth();
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
  const { isAuthenticated } = useAuth();
  
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
      <Route path="/requests">
        {() => <ProtectedRoute component={RequestsPage} path="/requests" onlyAdmin />}
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
      <Route path="/report-lavori">{() => <ProtectedRoute component={ReportLavoriPage} path="/report-lavori" />}</Route>
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
                    // console.log("PDF generato con successo");
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
      <Route path="/success-preventivo" component={SuccessPage} />
      <Route path="/success-checkup" component={SuccessPage} />
      <Route path="/whatsapp-templates">{() => <ProtectedRoute component={WhatsAppTemplatesPage} path="/whatsapp-templates" onlyAdmin />}</Route>
      <Route path="/smart-reminders">{() => <ProtectedRoute component={SmartRemindersPage} path="/smart-reminders" onlyAdmin />}</Route>
      <Route path="/accettazione-merce">{() => <ProtectedRoute component={AccettazioneMercePage} path="/accettazione-merce" onlyAdmin />}</Route>
      <Route path="/partners" component={PartnersPage} />
      <Route path="/chi-siamo" component={ChiSiamoPage} />
      <Route path="/istruzioni" component={IstruzioniPage} />
      <Route path="/sede" component={SedePage} />
      <Route path="/" component={NewLandingPage} />
      <Route component={NotFoundRedirect} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isLoginPage = location === '/login';
  const isLandingPage = location === '/';
  const isPartnersPage = location === '/partners';
  const isChiSiamoPage = location === '/chi-siamo';
  const isSedePage = location === '/sede';
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      {isAuthenticated && !isLoginPage && !isLandingPage && !isPartnersPage && !isChiSiamoPage && !isSedePage ? (
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
