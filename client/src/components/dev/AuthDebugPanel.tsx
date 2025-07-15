import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase, getAllClients, createClient, registerExistingClientInAuth } from '@shared/supabase';
import { Loader2, Bug, CheckCircle, XCircle, Users, UserPlus, RefreshCw } from 'lucide-react';

export function AuthDebugPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [authUsers, setAuthUsers] = useState<any[]>([]);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testName, setTestName] = useState('');
  const [testSurname, setTestSurname] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testPlate, setTestPlate] = useState('');
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Carica clienti dal database
      const clientList = await getAllClients();
      setClients(clientList);
      
      // Invece di usare l'Admin API, mostriamo solo un messaggio informativo
      setAuthUsers([]);
      
      toast({
        title: "Dati caricati",
        description: "Clienti dal database caricati. Verifica auth disponibile solo durante test di creazione.",
      });
      
    } catch (error) {
      console.error('Errore generale nel caricamento dati:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testCreateClient = async () => {
    if (!testEmail || !testPassword || !testName || !testSurname) {
      toast({
        title: "Campi mancanti",
        description: "Inserisci almeno email, password, nome e cognome",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setDebugResult(null);
      
      const clientData = {
        name: testName,
        surname: testSurname,
        email: testEmail,
        password: testPassword,
        phone: testPhone || '1234567890',
        plate: testPlate || 'TEST123',
        vin: '',
        birthDate: '',
        createdAt: Date.now()
      };

      console.log('🚀 Creazione cliente test:', clientData);
      
      const newClient = await createClient(clientData);
      
      console.log('✅ Cliente creato:', newClient);
      
      // Attendi un momento e poi verifica se è stato creato in Auth
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ricarica gli utenti Auth per vedere se è stato aggiunto
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      
      const authUser = authData?.users?.find(user => user.email === testEmail);
      
      setDebugResult({
        success: !!newClient,
        clientId: newClient?.id,
        authUserFound: !!authUser,
        authUserId: authUser?.id,
        authUserMetadata: authUser?.user_metadata,
        error: null
      });
      
      if (newClient && authUser) {
        toast({
          description: "✅ Cliente creato con successo sia nel DB che in Auth!",
        });
      } else if (newClient && !authUser) {
        toast({
          title: "⚠️ Problema parziale",
          description: "Cliente creato nel DB ma NON trovato in Auth",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Errore",
          description: "Errore nella creazione del cliente",
          variant: "destructive",
        });
      }
      
      // Ricarica tutti i dati
      await loadData();
      
    } catch (error) {
      console.error('Errore durante il test:', error);
      setDebugResult({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      });
      
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testDirectAuthRegistration = async () => {
    if (!testEmail || !testPassword) {
      toast({
        title: "Campi mancanti",
        description: "Inserisci email e password",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Test diretto di registrazione in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            client_name: `${testName} ${testSurname}`,
            user_type: 'client_test',
            phone: testPhone
          }
        }
      });
      
      if (error) {
        toast({
          title: "❌ Test Auth fallito",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          description: "✅ Test registrazione diretta in Auth riuscito!",
        });
      }
      
      console.log('Test registrazione diretta:', { data, error });
      
      // Ricarica i dati
      await loadData();
      
    } catch (error) {
      console.error('Errore test Auth diretto:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const forceRegisterClient = async (clientId: string) => {
    try {
      setIsLoading(true);
      
      const result = await registerExistingClientInAuth(clientId);
      
      if (result.success) {
        toast({
          description: `✅ Cliente ${clientId} registrato forzatamente in Auth!`,
        });
        await loadData();
      } else {
        toast({
          title: "Errore",
          description: result.message,
          variant: "destructive",
        });
      }
      
    } catch (error) {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // Trova clienti che non sono in Auth
  const clientsNotInAuth = clients.filter(client => 
    client.email && !authUsers.some(authUser => authUser.email === client.email)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Autenticazione Clienti
          </CardTitle>
          <CardDescription>
            Strumento per diagnosticare e risolvere problemi di registrazione clienti in Supabase Auth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Statistiche */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Clienti nel DB</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">{clients.length}</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">Verifica Auth</span>
              </div>
              <div className="text-sm text-yellow-700">Solo durante test</div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">Clienti da verificare</span>
              </div>
              <div className="text-2xl font-bold text-red-700">{clients.filter(c => c.email).length}</div>
            </div>
          </div>

          {/* Controlli */}
          <div className="flex gap-2">
            <Button 
              onClick={loadData} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Ricarica Dati
            </Button>
          </div>

          {/* Test creazione cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Creazione Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Email *</Label>
                  <Input 
                    value={testEmail} 
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input 
                    type="password"
                    value={testPassword} 
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="password123"
                  />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input 
                    value={testName} 
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Mario"
                  />
                </div>
                <div>
                  <Label>Cognome *</Label>
                  <Input 
                    value={testSurname} 
                    onChange={(e) => setTestSurname(e.target.value)}
                    placeholder="Rossi"
                  />
                </div>
                <div>
                  <Label>Telefono</Label>
                  <Input 
                    value={testPhone} 
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="3331234567"
                  />
                </div>
                <div>
                  <Label>Targa</Label>
                  <Input 
                    value={testPlate} 
                    onChange={(e) => setTestPlate(e.target.value)}
                    placeholder="AB123CD"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={testCreateClient} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Test Creazione Completa
                </Button>
                
                <Button 
                  onClick={testDirectAuthRegistration} 
                  disabled={isLoading}
                  variant="outline"
                >
                  Test Solo Auth
                </Button>
              </div>
              
              {debugResult && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Risultato Test:</h4>
                  <div className="space-y-1 text-sm">
                    <div className={debugResult.success ? "text-green-700" : "text-red-700"}>
                      Cliente DB: {debugResult.success ? '✅ Creato' : '❌ Fallito'} {debugResult.clientId && `(ID: ${debugResult.clientId})`}
                    </div>
                    <div className={debugResult.authUserFound ? "text-green-700" : "text-red-700"}>
                      Auth User: {debugResult.authUserFound ? '✅ Trovato' : '❌ Non trovato'} {debugResult.authUserId && `(ID: ${debugResult.authUserId})`}
                    </div>
                    {debugResult.authUserMetadata && (
                      <div className="text-blue-700">
                        Metadati: {JSON.stringify(debugResult.authUserMetadata, null, 2)}
                      </div>
                    )}
                    {debugResult.error && (
                      <div className="text-red-700">
                        Errore: {debugResult.error}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clienti con email per test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Clienti nel Database ({clients.filter(c => c.email).length} con email)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {clients.filter(c => c.email).map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{client.id}</span>
                      <span>{client.name} {client.surname}</span>
                      <Badge variant="secondary">{client.email}</Badge>
                      <Badge variant={client.password ? "default" : "destructive"}>
                        {client.password ? "Ha password" : "No password"}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => forceRegisterClient(client.id)}
                      disabled={isLoading || !client.password}
                    >
                      Registra in Auth
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
} 