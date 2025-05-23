import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ChecklistEditor from '@/components/checklist/ChecklistEditor';
import DynamicChecklist from '@/components/checklist/DynamicChecklist';
import ChecklistParameterLoader from '@/components/checklist/ChecklistParameterLoader';

export default function ChecklistEditorPage() {
  const [activeTab, setActiveTab] = useState("editor");
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-orange-500">Gestione Checklist</h1>
      
      <Tabs defaultValue="editor" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="editor">Editor Parametri</TabsTrigger>
          <TabsTrigger value="preview">Anteprima Checklist</TabsTrigger>
        </TabsList>
        
        <TabsContent value="editor">
          <ChecklistEditor />
        </TabsContent>
        
        <TabsContent value="preview">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">Anteprima Checklist Dinamica</h2>
              <p className="text-muted-foreground mb-4">
                Questa è un'anteprima di come apparirà la checklist con i parametri configurati.
                I cambiamenti fatti qui non saranno salvati.
              </p>
              
              {/* Utilizziamo vehicleId e appointmentId fittizi per l'anteprima */}
              <DynamicChecklist 
                vehicleId="previewVehicle" 
                appointmentId="previewAppointment" 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 