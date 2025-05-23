import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Icon, ShoppingCart, Car } from 'lucide-react';
import { ChevronRight, LogIn, Wrench, Calendar, Users, FileText, BarChart, Shield, CheckCircle, AlertCircle, MessageSquare, InstagramIcon, FacebookIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RequestQuoteForm from '@/components/RequestQuoteForm';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faWhatsapp, faTiktok } from '@fortawesome/free-brands-svg-icons';
import { faMapMarkerAlt, faPhone, faEnvelope, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import InstagramPowrFeed from '@/components/InstagramPowrFeed';

export default function LandingPage() {
  const requestQuoteRef = useRef<HTMLDivElement>(null);
  const [showChat, setShowChat] = useState(false);

  const features = [
    {
      icon: <Wrench className="w-10 h-10 text-orange-500" />,
      title: 'Officina moderna',
      description: "Ambiente curato, attrezzature all'avanguardia e massima attenzione a pulizia ed ordine."
    },
    {
      icon: <FileText className="w-10 h-10 text-orange-500" />,
      title: 'Trasparenza totale',
      description: "Preventivi chiari e dettagliati prima di ogni intervento. Nessuna sorpresa, solo onestà."
    },
    {
      icon: <Calendar className="w-10 h-10 text-orange-500" />,
      title: 'Prenotazioni su appuntamento',
      description: "Scegli tu l'orario, senza attese inutili. Massima comodità e rispetto dei tempi."
    },
    {
      icon: <Globe className="w-10 h-10 text-orange-500" />,
      title: 'Storico interventi',
      description: "Foto dei ricambi sostituiti, preventivi e check-list sempre disponibili online."
    },
    {
      icon: <ShoppingCart className="w-10 h-10 text-orange-500" />,
      title: 'Ricerca dei migliori brand',
      description: "Selezioniamo i migliori Brand per la tua autovettura a prezzi super competitivi."
    },
    {
      icon: <Car className="w-10 h-10 text-orange-500" />,
      title: 'Vettura sostitutiva',
      description: "Servizio di auto sostitutiva disponibile per i nostri clienti. (Work in progress)"
    }
  ];

  const steps = [
    {
      icon: <FileText className="w-8 h-8 text-orange-500" />,
      title: 'Checkup veicolo',
      description: "Compila il modulo online o chiamaci per ricevere subito una proposta chiara."
    },
    {
      icon: <Calendar className="w-8 h-8 text-orange-500" />,
      title: "Prenota l'appuntamento",
      description: "Scegli la data e l'orario più comodi per te, senza attese."
    },
    {
      icon: <Wrench className="w-8 h-8 text-orange-500" />,
      title: 'Segui i lavori',
      description: "Ricevi aggiornamenti, foto e check-list direttamente nella tua dashboard."
    },
    {
      icon: <CheckCircle className="w-8 h-8 text-orange-500" />,
      title: 'Ritira la tua auto',
      description: "Tutto pronto nei tempi concordati, con documentazione completa."
    }
  ];

  const dashboardFeatures = [
    { icon: <FileText className="w-8 h-8 text-orange-500" />, title: 'Foto di accettazione', description: "Immagini dell'auto all'arrivo in officina." },
    { icon: <BarChart className="w-8 h-8 text-orange-500" />, title: 'Preventivo dettagliato', description: 'Tutti i costi e i lavori spiegati voce per voce.' },
    { icon: <CheckCircle className="w-8 h-8 text-orange-500" />, title: 'Check-list completa', description: 'Controlli e ricambi eseguiti, tutto tracciato.' },
    { icon: <AlertCircle className="w-8 h-8 text-orange-500" />, title: 'Segnalazioni', description: 'Componenti da monitorare o guasti futuri.' }
  ];

  useEffect(() => {
    // Script di configurazione
    const configScript = document.createElement('script');
    configScript.type = 'text/javascript';
    configScript.innerHTML = `
      var _iub = _iub || [];
      _iub.csConfiguration = {"siteId":4023991,"cookiePolicyId":34578450,"lang":"it","storage":{"useSiteId":true}};
    `;
    document.body.appendChild(configScript);

    // Script autoblocking
    const autoblockScript = document.createElement('script');
    autoblockScript.type = 'text/javascript';
    autoblockScript.src = 'https://cs.iubenda.com/autoblocking/4023991.js';
    document.body.appendChild(autoblockScript);

    // Script stub
    const stubScript = document.createElement('script');
    stubScript.type = 'text/javascript';
    stubScript.src = '//cdn.iubenda.com/cs/gpp/stub.js';
    document.body.appendChild(stubScript);

    // Script principale Iubenda
    const iubendaScript = document.createElement('script');
    iubendaScript.type = 'text/javascript';
    iubendaScript.src = '//cdn.iubenda.com/cs/iubenda_cs.js';
    iubendaScript.charset = 'UTF-8';
    iubendaScript.async = true;
    document.body.appendChild(iubendaScript);

    // Cleanup: rimuovi gli script se il componente viene smontato
    return () => {
      document.body.removeChild(configScript);
      document.body.removeChild(autoblockScript);
      document.body.removeChild(stubScript);
      document.body.removeChild(iubendaScript);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HERO - nuova versione moderna, black & orange, foto sempre visibile */}
      <section className="relative w-full min-h-[100vh] flex flex-col md:flex-row items-center justify-center px-6 bg-black overflow-hidden py-16 md:py-0">
        {/* Immagine di sfondo tecnica con overlay nero trasparente */}
        <motion.img 
          src="https://i.ibb.co/kkCHJmF/IMG-6642.jpg" 
          alt="Motore" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none select-none" 
          style={{zIndex: 1}}
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <motion.div 
          className="absolute inset-0 bg-black/10" 
          style={{zIndex: 2}}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        ></motion.div>
        <div className="relative z-10 flex flex-col md:flex-row w-full max-w-6xl mx-auto items-center justify-center gap-10 md:gap-20">
          {/* Testo principale */}
          <motion.div 
            className="flex-1 flex flex-col items-center md:items-start justify-center md:pl-8 w-full"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <motion.span 
              className="block text-4xl md:text-5xl font-extrabold text-white mb-4 drop-shadow-lg select-none text-center md:text-left"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5, type: 'spring', stiffness: 200 }}
            >
              Auto e<span className="text-orange-500">X</span>press
            </motion.span>
            <motion.p 
              className="text-xl md:text-2xl text-white mb-8 text-center md:text-left"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
            >
              Rivoluzioniamo il tuo concetto di <span className="text-orange-500 font-semibold">autofficina</span> <br className="hidden md:block" />Scorri e scopri il perchè!
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 w-full md:w-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9 }}
            >
              <Button className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-4 text-base md:text-lg rounded-xl shadow-lg w-full sm:w-auto transition-all duration-200 hover:scale-105 hover:shadow-[0_0_16px_2px_rgba(255,140,0,0.4)]" onClick={() => requestQuoteRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                Check up Gratuito <ChevronRight className="ml-2" />
              </Button>
              <a href="Login" className="w-full sm:w-auto">
                <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10 px-6 py-4 text-base md:text-lg font-bold rounded-xl shadow-lg w-full sm:w-auto transition-all duration-200 hover:scale-105 hover:shadow-[0_0_16px_2px_rgba(255,140,0,0.2)]">
                  Accedi
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
        {/* Scroll indicator animato */}
        <motion.div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
        >
          <span className="block w-10 h-10 border-2 border-orange-500 rounded-full flex items-center justify-center animate-bounce bg-black shadow-[0_0_16px_2px_rgba(255,140,0,0.4)]">
            <ChevronRight className="rotate-90 text-orange-500 w-6 h-6" />
          </span>
        </motion.div>
      </section>

      {/* SEPARATORE HERO/FEATURES */}
      <div className="relative w-full overflow-hidden" style={{ height: '80px', marginTop: '-40px' }}>
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-full">
          <path d="M0,80 C480,0 960,160 1440,80 L1440,0 L0,0 Z" fill="#000" />
        </svg>
      </div>

      {/* FEATURES - card alternate destra/sinistra */}
      <section className="pt-16 pb-24 bg-black border-b border-gray-800">
        <div className="max-w-5xl mx-auto flex flex-col gap-12 px-6">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className={`flex flex-col md:flex-row items-center ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''} gap-6 bg-black border-2 border-orange-500 rounded-2xl p-6 md:p-8 shadow-xl`}
            >
              <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-orange-500/20 mb-4 md:mb-0">
                {feature.icon}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl md:text-2xl font-bold text-orange-500 mb-2 flex flex-col md:flex-row items-center md:items-start gap-2">{feature.title}</h3>
                <p className="text-white text-base md:text-lg">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* COME FUNZIONA - trasformato in griglia per mobile */}
      <section className="py-20 bg-black border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-orange-500 text-center mb-12 flex items-center justify-center gap-2">
              <ChevronRight className="inline-block text-orange-500 w-7 h-7" /> Come funziona
            </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
            {steps.map((step, idx) => (
              <div key={step.title} className="flex flex-col items-center relative">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true, margin: "-100px" }} 
                  transition={{ duration: 0.5, delay: idx * 0.1 }} 
                  className="bg-gray-900 rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center shadow-lg mb-4 z-10"
                >
                  {step.icon}
                </motion.div>
                <h4 className="font-bold text-orange-400 mb-2 text-lg text-center">{step.title}</h4>
                <p className="text-gray-300 text-sm text-center">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD CLIENTE - mobile rielaborato */}
      <section className="py-20 bg-black border-b border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 px-6">
          <div className="flex-1 flex justify-center">
            <img src="https://i.ibb.co/JW3N4V4t/32131.png" alt="Dashboard Cliente" className="rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md border-4 border-orange-500/30" />
          </div>
          <div className="flex-1 flex flex-col gap-6">
            <h2 className="text-2xl md:text-4xl font-bold text-orange-500 mb-4 flex items-center gap-2 text-center md:text-left"><BarChart className="inline-block text-orange-500 w-6 h-6 md:w-7 md:h-7" /> Dashboard Cliente</h2>
            <div className="grid grid-cols-1 gap-4">
              {dashboardFeatures.map((item, idx) => (
                <motion.div 
                  key={item.title} 
                  initial={{ opacity: 0, x: 40 }} 
                  whileInView={{ opacity: 1, x: 0 }} 
                  viewport={{ once: true, margin: "-100px" }} 
                  transition={{ duration: 0.5, delay: idx * 0.1 }} 
                  className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 shadow-md"
                >
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-orange-400 mb-1">{item.title}</h4>
                    <p className="text-gray-300 text-sm">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTROLLI GRATUITI - card centrale */}
      <section className="py-20 bg-black border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            <motion.div 
              initial={{ opacity: 0, y: 30 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true, margin: "-100px" }} 
              transition={{ duration: 0.5 }} 
              className="bg-black border-2 border-orange-500 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col items-center justify-between flex-1"
            >
              <div className="flex flex-col items-center w-full">
                <div className="h-32 flex items-center justify-center mb-6">
                  <img 
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZsMEoXuDhEizJiQdQ86-4NkOJz9HKBOYAkzobXGDmnenZi90a-1LEtU7cvPSOZcB7vwQ&usqp=CAU" 
                    alt="AD Service Logo" 
                    className="h-24 w-auto bg-white rounded-xl p-6"
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-orange-500 mb-4">AD Service</h3>
                <p className="text-base md:text-lg text-gray-300 mb-8 text-center">
                  Siamo parte della rete AD Service, rete di officine e ricambisti indipendenti leader in Italia. Offriamo servizi di alta qualità con ricambi e prodotti certificati per ogni tipo di veicolo.
                </p>
              </div>
              <Button 
                className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-3 text-base rounded-xl w-full md:w-auto transition-all duration-200 hover:scale-105 hover:shadow-[0_0_16px_2px_rgba(255,140,0,0.4)]" 
                onClick={() => window.open('https://www.aditalia.tech/', '_blank')}
              >
                Scopri di più <ChevronRight className="ml-2" />
              </Button>
            </motion.div>
          
            <motion.div 
              initial={{ opacity: 0, y: 30 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true, margin: "-100px" }} 
              transition={{ duration: 0.5, delay: 0.2 }} 
              className="bg-black border-2 border-orange-500 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col items-center justify-between flex-1"
            >
              <div className="flex flex-col items-center w-full">
                <div className="h-32 flex items-center justify-center mb-6">
                  <img 
                    src="https://i.ibb.co/67mMqctw/Screenshot-2025-05-15-101353.png" 
                    alt="Garantiamo Logo" 
                    className="h-24 w-auto bg-white rounded-xl p-6" 
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-orange-500 mb-4">Assicuriamo i nostri lavori</h3>
                <p className="text-base md:text-lg text-gray-300 mb-8 text-center">
                  Grazie alla partnership con Garantiamo, puoi assicurare i lavori eseguiti sulla tua vettura. Una protezione aggiuntiva che copre eventuali problemi successivi all'intervento, per la tua massima tranquillità.
                </p>
              </div>
              <Button 
                className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-3 text-base rounded-xl w-full md:w-auto transition-all duration-200 hover:scale-105 hover:shadow-[0_0_16px_2px_rgba(255,140,0,0.4)]" 
                onClick={() => window.open('https://garantiamo.net/', '_blank')}
              >
                Scopri di più <ChevronRight className="ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* VETTURA SOSTITUTIVA - Banner informativo */}
      <section className="py-16 bg-black border-b border-gray-800">
      <h2 className="text-3xl md:text-4xl font-bold text-orange-500 text-center mb-20 mt-5 flex items-center justify-center gap-1">
        SERVIZI
      </h2>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true, margin: "-100px" }} 
            transition={{ duration: 0.5 }} 
            className="bg-black border-2 border-orange-500 rounded-2xl p-8 shadow-xl overflow-hidden relative"
          >
            {/* Elemento decorativo */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="bg-orange-500/20 rounded-full p-5 flex-shrink-0">
                <Car className="w-16 h-16 text-orange-500" />
              </div>
              
              <div className="flex-1 z-10">
                <div className="inline-block bg-orange-500/20 rounded-full px-4 py-1 text-sm text-orange-500 font-semibold mb-3">
                  Coming Soon
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-orange-500 mb-4">Servizio Auto Sostitutiva</h3>
                <p className="text-lg text-gray-300 mb-6">
                  Presto disponibile il servizio di auto sostitutiva per tutti i nostri clienti. Non dovrai più preoccuparti di come spostarti mentre la tua auto è in officina!
                </p>
                {/*<div className="flex items-center text-gray-400">
                  <CheckCircle className="w-5 h-5 text-orange-500 mr-2" />
                  <span>Ti avviseremo quando il servizio sarà attivo</span>
                </div>*/}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PREVENTIVO */}
      <section ref={requestQuoteRef} className="py-16 md:py-20 bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true, margin: "-100px" }} 
            transition={{ duration: 0.5 }} 
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-orange-500">
              Richiedi subito il tuo preventi o checkup
            </h2>
            <p className="text-lg md:text-xl text-gray-300 mb-8 md:mb-12">
              Prenota subito e scopri la differenza di un servizio professionale, trasparente e senza stress.
            </p>
            <RequestQuoteForm />
          </motion.div>
        </div>
      </section>

      {/* SOCIAL FEED */}
      <section className="py-20 bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-orange-500 mb-4">Seguici sui Social</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">Scopri le ultime novità, i progetti in corso e gli aggiornamenti dal nostro team sui social media.</p>
          </div>
          
          {/* Componente POWR Social Feed */}
          <InstagramPowrFeed powrId="49e8a352_1747986870" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pt-16 pb-12 bg-gradient-to-b from-black to-gray-900 border-t border-orange-500/20 mt-10 relative overflow-hidden">
        {/* Elementi decorativi del footer */}
        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-orange-500/30 blur-3xl"></div>
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-6">
          {/* Logo animato e slogan */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-center mb-16 text-center"
          >
            <div className="relative mb-4">
              <span className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-lg">
                Auto e<span className="text-orange-500 inline-block relative">
                  X
                  <motion.span 
                    className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"
                    animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}
                  />
                </span>press
              </span>
            </div>
          </motion.div>

          {/* Griglia footer principale - stile semplificato e omogeneo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12 text-base text-gray-300 pb-12 border-b border-gray-800/80">
            {/* COLONNA 1: Chi siamo */}
            <div className="flex flex-col">
              <h4 className="font-bold text-white text-lg mb-6 border-l-2 border-orange-500 pl-3">
                Chi siamo
              </h4>
              <div className="flex items-start gap-3 mb-3">
                <FontAwesomeIcon icon={faMapMarkerAlt} className="w-4 h-4 text-orange-500 mt-1" />
                <span>Via Eugenio Montale, 4<br />70043 Monopoli (BA), Italia</span>
              </div>
              <div className="flex items-start gap-3">
                <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-orange-500 mt-1" />
                <div>
                  <div>P.IVA</div>
                  <div>01234567890</div>
                </div>
              </div>
            </div>
            
            {/* COLONNA 2: Contatti */}
            <div className="flex flex-col">
              <h4 className="font-bold text-white text-lg mb-6 border-l-2 border-orange-500 pl-3">
                Contatti
              </h4>
              <div className="flex items-start gap-3 mb-5">
                <FontAwesomeIcon icon={faPhone} className="w-4 h-4 text-orange-500 mt-1" />
                <div>
                  <div className="text-gray-400 text-sm mb-1">Telefono</div>
                  <a href="tel:+393293888702" className="text-white hover:text-orange-500 transition-colors">
                    +39 329 388 8702
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 text-orange-500 mt-1" />
                <div>
                  <div className="text-gray-400 text-sm mb-1">Email</div>
                  <a href="mailto:assistenza@autoexpressadservice.it" className="text-white hover:text-orange-500 transition-colors break-all">
                    assistenza@autoexpressadservice.it
                  </a>
                </div>
              </div>
            </div>
                          
            {/* COLONNA 3: Link utili e Partners */}
            <div className="flex flex-col sm:flex-row gap-8">
              {/* Link utili */}
              <div className="flex flex-col flex-1">
                <h4 className="font-bold text-white text-lg mb-6 border-l-2 border-orange-500 pl-3">
                  Link utili
                </h4>
                <div className="flex flex-col gap-3">
                  <a href="https://n99.it" className="flex items-center group">
                    <ChevronRight className="w-5 h-5 text-orange-500 mr-2 group-hover:translate-x-1 transition-transform" />
                    <span className="group-hover:text-orange-500 transition-colors">Privacy Policy</span>
                  </a>
                  <a href="https://n99.it" className="flex items-center group">
                    <ChevronRight className="w-5 h-5 text-orange-500 mr-2 group-hover:translate-x-1 transition-transform" />
                    <span className="group-hover:text-orange-500 transition-colors">Cookie Policy</span>
                  </a>
                  <a href="https://n99.it" className="flex items-center group">
                    <ChevronRight className="w-5 h-5 text-orange-500 mr-2 group-hover:translate-x-1 transition-transform" />
                    <span className="group-hover:text-orange-500 transition-colors">Termini e Condizioni</span>
                  </a>
                </div>
              </div>
              
              {/* Partners */}
              <div className="flex flex-col flex-1">
                <h4 className="font-bold text-white text-lg mb-6 border-l-2 border-orange-500 pl-3">
                  Partners
                </h4>
                <div className="flex flex-col gap-3">
                  <a href="https://www.aditalia.tech/" className="flex items-center group">
                    <ChevronRight className="w-5 h-5 text-orange-500 mr-2 group-hover:translate-x-1 transition-transform" />
                    <span className="group-hover:text-orange-500 transition-colors">Aditalia</span>
                  </a>
                  <a href="https://garantiamo.net/" className="flex items-center group">
                    <ChevronRight className="w-5 h-5 text-orange-500 mr-2 group-hover:translate-x-1 transition-transform" />
                    <span className="group-hover:text-orange-500 transition-colors">Garantiamo</span>
                  </a>
                  <a href="https://xenergy.it/xenergy/" className="flex items-center group">
                    <ChevronRight className="w-5 h-5 text-orange-500 mr-2 group-hover:translate-x-1 transition-transform" />
                    <span className="group-hover:text-orange-500 transition-colors">Xenergy</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Seguici - solo icone centrate */}
          <div className="flex flex-col items-center mb-12 mt-8">
            <h4 className="font-bold text-white text-lg mb-6 relative">
              Seguici
            </h4>
            <div className="grid grid-cols-4 gap-6 max-w-md">
              <a href="https://wa.me/393293888702" className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group">
                <FontAwesomeIcon icon={faWhatsapp} className="w-7 h-7 text-orange-500 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://www.facebook.com/autoexpressadservice" className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group">
                <FontAwesomeIcon icon={faFacebook} className="w-7 h-7 text-orange-500 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://www.instagram.com/autoexpressadservice" className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group">
                <FontAwesomeIcon icon={faInstagram} className="w-7 h-7 text-orange-500 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://www.tiktok.com/@autoexpressadservice" className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group">
                <FontAwesomeIcon icon={faTiktok} className="w-7 h-7 text-orange-500 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </div>
          
          {/* Copyright e credit */}
          <div className="mt-8 flex flex-col md:flex-row justify-between items-center border-t border-gray-800/80 pt-8">
            <div className="text-gray-500 text-sm mb-4 md:mb-0">© {new Date().getFullYear()} Autoexpress. Tutti i diritti riservati.</div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">Powered by:</div>
              <a href="https://www.cia.gov" className="text-orange-500 hover:text-orange-400 transition-colors text-sm">Cia.gov</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Widget WhatsApp migliorato e simulazione operatore */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
        {/* Finestra chat simulata */}
        {showChat && (
          <div className="mb-2 bg-white text-black rounded-2xl shadow-xl p-4 w-[calc(100vw-48px)] max-w-[320px] animate-fade-in border border-orange-500 relative" style={{boxShadow: '0 4px 24px 0 #0002'}}>
            {/* Coda della bolla - posizione adattiva */}
            <div className="absolute -bottom-3 left-8 w-6 h-6 bg-white rotate-45 border-l border-b border-green-500" style={{zIndex:1}} />
            <div className="flex items-center mb-2">
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center mr-3 border-2 border-white shadow">
                <FontAwesomeIcon icon={faWhatsapp} className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-green-500 leading-tight">Autoexpress - Assistenza</div>
                <div className="text-xs text-gray-500">Online adesso</div>
              </div>
            </div>
            <div className="text-sm mb-3 bg-gray-100 rounded-xl p-3 text-gray-800 shadow-inner">
              <span className="block mb-1">Ciao! 👋 <br>
              </br>Sono Pasqua, come posso aiutarti?</span>
              <span className="text-xs text-gray-500">Rispondiamo subito su WhatsApp!</span>
            </div>
            <a
              href="https://api.whatsapp.com/send/?phone=%2B393293888702&text=Salve%20ho!%20Ho%20bisogno%20di%20informazioni."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg w-full block text-center transition mt-2"
            >
              Chatta su WhatsApp
            </a>
          </div>
        )}
        {/* Pulsante icona */}
        <button
          onClick={() => setShowChat((v) => !v)}
          className="bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg p-4 flex items-center justify-center transition-all duration-200 focus:outline-none"
          title="Serve aiuto? Chatta con noi su WhatsApp"
          aria-label="Chat WhatsApp"
          style={{ boxShadow: '0 0 16px 2px rgba(123, 255, 0, 0.4)' }}
        >
          <FontAwesomeIcon icon={faWhatsapp} className="w-6 h-6 md:w-7 md:h-7" />
        </button>
      </div>
      {/* Animazione fade-in per la chat */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px);}
          to { opacity: 1; transform: translateY(0);}
        }
        .animate-fade-in {
          animation: fade-in 0.4s cubic-bezier(0.4,0,0.2,1) both;
        }
      `}</style>
    </div>
  );
}