import React, { useState } from 'react';
import { Bell, Calendar, ChevronRight, FileText, Package, Users } from 'lucide-react';

const workflowSteps = [
  {
    title: "NUOVO PREVENTIVO",
    description: "Istruzioni per creare un nuovo preventivo.",
    icon: <FileText className="w-7 h-7 text-primary" />,
    steps: [
      { label: "Inserire Intestatario" },
      { label: "Inserire la richiesta (intesa come ricambi occorrenti)" },
      { label: "Inserire ore manodopera" },
      { label: "Successivamente verrà fatta la ricerca dal call center" },
      { label: "Ricevuta la ricerca" },
      { label: "Modifichiamo il preventivo" },
      { label: "Esportare il preventivo" },
      { label: "Inviare messaggio whatsapp (promemoria) + Pdf" },
    ]
  },
  {
    title: "NUOVO CLIENTE",
    description: "Istruzioni per aggiungere un nuovo cliente e assicurarsi che sia presente anche su Google.",
    icon: <Users className="w-7 h-7 text-primary" />,
    steps: [
      { label: "Inserimento di tutti i campi" },
      { label: "Aggiungere sulla rubrica telefono" },
      { label: "Inviare il messaggio di benvenuto" },
    ],
  },
  {
    title: "RICHIESTE WEB CHECK UP / PREVENTIVO",
    description: "Istruzioni per gestire le richieste che arrivano dal web in modo rapido e preciso.",
    icon: <FileText className="w-7 h-7 text-primary" />,
    steps: [
      { label: "Controllare constantemente la pagina" },
      { label: "In presenza di una nuova richiesta" },
      { label: "Inserire cliente (seguire procedura nuovo cliente)" },
    ]
  },
  {
    title: "ORDINE AL FORNITORE",
    description: "Istruzioni per procedere con l'ordine dei ricambi necessari dopo aver programmato l'appuntamento.",
    icon: <Package className="w-7 h-7 text-primary" />,
    steps: [
      { label: "Dopo aver programmato un appuntamento" },
      { label: "Ordini" },
      { label: "Invio ordini al fornitore" },
      { label: "Appuntamenti" },
      { label: "Selezionare ricambi ordinati" },
    ]
  }
];

type Step = { label: string };

type StepperLineaArancioneProps = { steps: Step[] };

function StepperLineaArancione({ steps }: StepperLineaArancioneProps) {
  return (
    <div className="overflow-x-auto px-2 py-8 hide-scrollbar">
      <div className="flex justify-center items-start min-h-[110px]">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center min-w-[160px]">
            <div className="relative flex items-center justify-center w-full" style={{ height: 40 }}>
              {/* Linea a sinistra (non per il primo) */}
              {idx > 0 && (
                <div className="absolute left-0 top-1/2 w-1/2 h-1 bg-[#ff9900]" style={{ transform: 'translateY(-50%)', zIndex: 1 }}></div>
              )}
              {/* Linea a destra (non per l'ultimo) */}
              {idx < steps.length - 1 && (
                <div className="absolute right-0 top-1/2 w-1/2 h-1 bg-[#ff9900]" style={{ transform: 'translateY(-50%)', zIndex: 1 }}></div>
              )}
              {/* Pallino sopra la linea */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-[#ff9900] border-[#ff9900] z-10" style={{ zIndex: 2 }}>
                <span className="text-white font-bold text-lg">{idx + 1}</span>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-center text-[#ff9900] break-words leading-snug max-w-[140px] mx-auto">
              {step.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nascondi la scrollbar con una utility CSS
const style = `
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

export default function IstruzioniPage() {
  const [openSections, setOpenSections] = useState<number[]>([]);

  const toggleSection = (index: number) => {
    setOpenSections((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <style>{style}</style>
      <h1 className="text-3xl font-bold text-center mb-8 text-white">
        Manuale di 
        <span className="text-orange-500"> Istruzioni</span>
      </h1>
      <div className="flex flex-col gap-8">
        {workflowSteps.map((section, index) => (
          <div
            key={index}
            className="bg-[#232323] rounded-xl shadow-lg p-6 transition-all duration-300 border border-[#ff9900]/30 hover:shadow-2xl"
          >
            <button
              className="flex items-center justify-center space-x-3 w-full focus:outline-none group"
              onClick={() => toggleSection(index)}
              aria-expanded={openSections.includes(index)}
            >
              {section.icon}
              <span className="text-xl font-semibold text-white group-hover:text-orange-400 transition-colors duration-200">{section.title}</span>
              <ChevronRight className={`ml-2 transition-transform duration-300 ${openSections.includes(index) ? 'rotate-90' : ''}`} />
            </button>
            <div className="text-center text-sm text-gray-300 mt-2 mb-2 px-2">
              {section.description}
            </div>
            <div
              className={`overflow-hidden transition-all duration-500 ${openSections.includes(index) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              {openSections.includes(index) && (
                <StepperLineaArancione steps={section.steps} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 