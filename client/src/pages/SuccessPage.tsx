import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'preventivo';

  useEffect(() => {
    // Redirect automatico dopo 12 secondi
    const timer = setTimeout(() => {
      navigate('/');
    }, 12000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const isCheckup = type === 'checkup';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center p-5">
      <div className="max-w-2xl w-full text-center bg-black/80 border border-gray-700 rounded-xl p-8 shadow-2xl">
        {/* Icona di successo */}
        <div className="w-20 h-20 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        {/* Titolo */}
        <h1 className="text-3xl font-bold text-orange-500 mb-4">
          {isCheckup ? 'Checkup Prenotato con Successo!' : 'Preventivo Richiesto con Successo!'}
        </h1>

        {/* Messaggio */}
        <p className="text-lg text-gray-300 mb-8 leading-relaxed">
          {isCheckup 
            ? 'Grazie per aver prenotato un checkup con AutoExpress. La tua prenotazione è stata ricevuta e il nostro team ti contatterà per confermare data e orario.'
            : 'Grazie per aver richiesto un preventivo gratuito da AutoExpress. La tua richiesta è stata ricevuta e il nostro team preparerà un preventivo dettagliato per te.'
          }
        </p>

        {/* Pulsante torna alla home */}
        <button
          onClick={() => navigate('/')}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 mb-8"
        >
          Torna alla Home
        </button>

        {/* Info box */}
        <div className="bg-orange-950/30 border border-orange-500/30 rounded-lg p-6 text-left">
          <h3 className="text-orange-400 font-semibold mb-4 text-lg">Cosa succede ora?</h3>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start">
              <span className="text-orange-500 font-bold mr-3 mt-1">✓</span>
              Riceverai una conferma via email entro pochi minuti
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 font-bold mr-3 mt-1">✓</span>
              {isCheckup 
                ? 'Il nostro team ti contatterà per confermare data e orario'
                : 'Il nostro team analizzerà le tue esigenze'
              }
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 font-bold mr-3 mt-1">✓</span>
              {isCheckup
                ? 'Riceverai tutti i dettagli del tuo appuntamento'
                : 'Prepareremo un preventivo dettagliato e personalizzato'
              }
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 font-bold mr-3 mt-1">✓</span>
              Ti contatteremo entro 24 ore {isCheckup ? 'per la conferma' : 'con il preventivo completo'}
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 font-bold mr-3 mt-1">✓</span>
              {isCheckup ? 'Il checkup' : 'Il preventivo'} è completamente gratuito e senza impegno
            </li>
          </ul>
        </div>

        {/* Countdown */}
        <p className="text-sm text-gray-500 mt-6">
          Verrai reindirizzato automaticamente alla home page tra pochi secondi...
        </p>
      </div>
    </div>
  );
} 