import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronRight, Wrench, Calendar, FileText, ShoppingCart, BarChart, CheckCircle, AlertCircle, Car, Users, Globe, Shield, Locate, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RequestQuoteForm from '@/components/RequestQuoteForm';
import OfficinaCarousel from '@/components/OfficinaCarousel';
import Navbar from '@/components/Navbar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faWhatsapp, faTiktok } from '@fortawesome/free-brands-svg-icons';
import { faMapMarkerAlt, faPhone, faEnvelope, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Link } from "wouter";
import { AnimatePresence } from "framer-motion";
import RequestQuotePopup from '@/components/RequestQuotePopup';

const Section = React.forwardRef<HTMLElement, { children: React.ReactNode; id: string; className?: string }>(({ children, id, className = '' }, ref) => (
  <section ref={ref} id={id} className={`py-20 md:py-24 bg-black border-b border-gray-900 ${className}`}>
    <div className="max-w-6xl mx-auto px-6">
      {children}
    </div>
  </section>
));

Section.displayName = 'Section';

export default function NewLandingPage() {
    const preventivoRef = useRef<HTMLDivElement>(null);
    const [showChat, setShowChat] = useState(false);
    const [showQuotePopup, setShowQuotePopup] = useState(false);
    const timelineRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: timelineRef,
        offset: ["start center", "end start"]
    });
    const [activeStep, setActiveStep] = useState(0);
    const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

    const features = [
        { icon: <Calendar className="w-10 h-10 text-orange-500" />, title: 'Nessuna attesa', description: "Scegli data, orario e sede direttamente online, in totale autonomia." },
        { icon: <FileText className="w-10 h-10 text-orange-500" />, title: 'Trasparenza assoluta', description: "Preventivo chiaro prima ancora di venire in officina. Nessuna sorpresa." },
        { icon: <ShoppingCart className="w-10 h-10 text-orange-500" />, title: 'Ricambi di alta qualità', description: "Solo ricambi di alta qualità" },
        { icon: <Locate className="w-10 h-10 text-orange-500" />, title: 'Tracciabilità', description: "Tracciabilità completa di ogni intervento." },
        { icon: <CheckCircle className="w-10 h-10 text-orange-500" />, title: 'Niente sorprese', description: "Paghi solo quello che hai approvato." },
        { icon: <Users className="w-10 h-10 text-orange-500" />, title: 'Supporto clienti', description: "Assistenza reale, disponibile e veloce per ogni tua esigenza." }
    ];

    const steps = [
        { 
            icon: <FileText className="w-8 h-8 text-orange-500" />, 
            title: 'Prenota online', 
            description: "Scegli data, orario e sede direttamente online. Niente chiamate, niente file, niente stress.",
            
        },
        { 
            icon: <Calendar className="w-8 h-8 text-orange-500" />, 
            title: "Intervento Express", 
            description: "Intervento veloce e senza attese, con check-list completo e foto di accettazione.",
            
        },
        { 
            icon: <Wrench className="w-8 h-8 text-orange-500" />, 
            title: 'Risultato garantito', 
            description: "Tutto pronto nei tempi concordati, con documentazione completa. Se qualcosa non va, ti rimborsiamo il costo dell'intervento.",
            
        }
    ];

    const dashboardFeatures = [
        { icon: <FileText className="w-8 h-8 text-orange-500" />, title: 'Foto di accettazione', description: "Immagini dell'auto all'arrivo in officina." },
        { icon: <BarChart className="w-8 h-8 text-orange-500" />, title: 'Preventivo dettagliato', description: 'Tutti i costi e i lavori spiegati voce per voce.' },
        { icon: <CheckCircle className="w-8 h-8 text-orange-500" />, title: 'Check-list completa', description: 'Controlli e ricambi eseguiti, tutto tracciato.' },
        { icon: <AlertCircle className="w-8 h-8 text-orange-500" />, title: 'Segnalazioni', description: 'Componenti da monitorare o guasti futuri.' },
        
    ];

    useEffect(() => {
        // Script CommonNinja
        const commonNinjaScript = document.createElement('script');
        commonNinjaScript.src = 'https://cdn.commoninja.com/sdk/latest/commonninja.js';
        commonNinjaScript.defer = true;
        document.head.appendChild(commonNinjaScript);

        // Existing Iubenda scripts
        const configScript = document.createElement('script');
        configScript.type = 'text/javascript';
        configScript.innerHTML = `var _iub = _iub || []; _iub.csConfiguration = {"siteId":4023991,"cookiePolicyId":34578450,"lang":"it","storage":{"useSiteId":true}};`;
        document.body.appendChild(configScript);

        const autoblockScript = document.createElement('script');
        autoblockScript.type = 'text/javascript';
        autoblockScript.src = 'https://cs.iubenda.com/autoblocking/4023991.js';
        document.body.appendChild(autoblockScript);

        const stubScript = document.createElement('script');
        stubScript.type = 'text/javascript';
        stubScript.src = '//cdn.iubenda.com/cs/gpp/stub.js';
        document.body.appendChild(stubScript);

        const iubendaScript = document.createElement('script');
        iubendaScript.type = 'text/javascript';
        iubendaScript.src = '//cdn.iubenda.com/cs/iubenda_cs.js';
        iubendaScript.charset = 'UTF-8';
        iubendaScript.async = true;
        document.body.appendChild(iubendaScript);

        return () => {
            document.head.removeChild(commonNinjaScript);
            document.body.removeChild(configScript);
            document.body.removeChild(autoblockScript);
            document.body.removeChild(stubScript);
            document.body.removeChild(iubendaScript);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const offsets = stepRefs.current.map(ref => {
                if (!ref) return Infinity;
                const rect = ref.getBoundingClientRect();
                return Math.abs(rect.top - window.innerHeight / 3);
            });
            const min = Math.min(...offsets);
            const idx = offsets.indexOf(min);
            setActiveStep(idx);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToQuote = () => {
        if (preventivoRef.current) {
            const yOffset = -80; // Offset per compensare la navbar
            const y = preventivoRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <div className="bg-black text-white overflow-x-hidden font-sans">
            <Navbar />
            <main>
                {/* HERO */}
                <section id="home" className="relative min-h-screen flex items-center justify-center px-6 text-center">
                    <motion.div
                        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-40"
                        style={{ backgroundImage: "url('https://i.ibb.co/kkCHJmF/IMG-6642.jpg')" }}
                        initial={{ scale: 1.1, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.4 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                            className="text-5xl md:text-7xl font-black tracking-tighter text-white drop-shadow-xl"
                        >
                            Auto e<motion.span
                                className="text-orange-500 inline-block"
                                animate={{ 
                                    rotate: [0, -10, 10, -10, 0],
                                    scale: [1, 1.2, 1.2, 1.2, 1]
                                }}
                                transition={{ 
                                    duration: 1.5,
                                    delay: 1,
                                    repeat: Infinity,
                                    repeatDelay: 5
                                }}
                            >X</motion.span>press
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                            className="mt-6 text-lg md:text-xl max-w-2xl text-gray-300 text-center"
                        >
                            Rivoluzioniamo il concetto di autofficina. Scopri un servizio semplice
                            <br />
                            <span className="text-white font-semibold">trasparente e veloce</span>, per la cura della tua auto.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                            className="flex flex-col sm:flex-row gap-4 mt-10"
                        >
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="relative"
                            >
                                <motion.div
                                    className="absolute -inset-1 rounded-xl bg-orange-500 opacity-70 blur-lg"
                                    animate={{
                                        scale: [1, 1.1, 1],
                                        opacity: [0.7, 0.4, 0.7]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatType: "reverse"
                                    }}
                                />
                                <button 
                                    onClick={scrollToQuote}
                                    className="relative bg-orange-500 hover:bg-orange-600 text-black font-bold px-8 py-3 text-lg rounded-xl shadow-lg w-full sm:w-auto inline-flex items-center justify-center cursor-pointer"
                                >
                                    🔧 Prenota il tuo check-up gratuito <ChevronRight className="ml-2 h-5 w-5" />
                                </button>
                                
                            </motion.div>
                        </motion.div>

                        {/* Scroll indicator */}
                        <motion.div
                            className="mt-8 flex items-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                            onClick={scrollToQuote}
                            style={{ cursor: 'pointer' }}
                        >
                            <motion.div
                                animate={{ 
                                    y: [0, 8, 0]
                                }}
                                transition={{ 
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="relative"
                            >
                                <div className="w-8 h-8 rounded-full border-2 border-orange-500/50 flex items-center justify-center">
                                    <ChevronRight className="rotate-90 w-5 h-5 text-orange-500/50" />
                                </div>
                            </motion.div>
                        </motion.div>

                    </div>
                </section>

                {/* FEATURES */}
                <Section id="servizi">
                    <div className="flex flex-col items-center text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="bg-orange-500/10 rounded-full p-3 mb-4"
                        >
                            <motion.div
                                animate={{ 
                                    rotate: 360
                                }}
                                transition={{ 
                                    duration: 20,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            >
                                <Wrench className="w-6 h-6 text-orange-500" />
                            </motion.div>
                        </motion.div>
                        <motion.span
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="text-orange-500 font-semibold text-lg mb-2"
                        >
                            I NOSTRI VALORI
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-3xl md:text-4xl font-bold text-white mb-4"
                        >
                            Perché Scegliere Auto e<span className="text-orange-500">X</span>press?
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-gray-300 text-lg max-w-2xl"
                        >
                            Innovazione, trasparenza e qualità sono i pilastri del nostro servizio. 
                            Scopri come rendiamo la manutenzione della tua auto un'esperienza semplice e senza stress.
                        </motion.p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, idx) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                whileHover={{ y: -5 }}
                                className="bg-gray-900/50 p-6 rounded-2xl border border-white/10 flex flex-col items-start gap-4 hover:border-orange-500/50 transition-all relative group overflow-hidden"
                            >
                                {/* Effetto glow */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    initial={false}
                                    animate={{ 
                                        opacity: [0, 0.5, 0],
                                        scale: [0.8, 1, 0.8],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        repeatType: "reverse"
                                    }}
                                />

                                {/* Icona con animazione */}
                                <motion.div 
                                    className="bg-orange-500/20 p-3 rounded-lg group-hover:bg-orange-500/30 transition-colors relative"
                                    whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <motion.div
                                        animate={{ 
                                            scale: [1, 1.1, 1],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            repeatType: "reverse",
                                            delay: idx * 0.2
                                        }}
                                    >
                                        {feature.icon}
                                    </motion.div>
                                    
                                    {/* Particelle decorative */}
                                    <motion.div
                                        className="absolute -inset-1 rounded-lg opacity-0 group-hover:opacity-100"
                                        initial={false}
                                        animate={{
                                            background: [
                                                "radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.2) 0%, transparent 50%)",
                                                "radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.2) 0%, transparent 70%)",
                                                "radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.2) 0%, transparent 50%)"
                                            ]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            repeatType: "reverse"
                                        }}
                                    />
                                </motion.div>

                                {/* Titolo con animazione */}
                                <motion.h3 
                                    className="text-xl font-bold text-white group-hover:text-orange-500 transition-colors relative"
                                    whileHover={{ x: 5 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                >
                                    {feature.title}
                                </motion.h3>

                                {/* Descrizione con fade in */}
                                <motion.p 
                                    className="text-gray-400 relative z-10"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    {feature.description}
                                </motion.p>

                                {/* Effetto angolo */}
                                <motion.div
                                    className="absolute -top-10 -right-10 w-20 h-20 bg-orange-500/20 rounded-full blur-xl group-hover:bg-orange-500/30"
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        opacity: [0.2, 0.3, 0.2]
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        delay: idx * 0.1
                                    }}
                                />
                            </motion.div>
                        ))}
                    </div>
                </Section>

                {/* COME FUNZIONA */}
                <Section id="come-funziona" className="bg-gray-900/30">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-orange-500 mb-4">Semplice, in 3 Passi</h2>
                    <p className="text-center text-gray-300 text-lg mb-20 max-w-2xl mx-auto">
                        Un processo semplice e veloce per tornare in strada il prima possibile
                    </p>
                    
                    <div ref={timelineRef} className="max-w-4xl mx-auto relative">
                        {/* Linea verticale */}
                        <div className="absolute left-[39px] md:left-[59px] top-[80px] bottom-20 w-[2px]">
                            <div className="h-full w-full bg-[#1a1a1a]" />
                            <div 
                                className="absolute top-0 left-0 w-full bg-orange-500 transition-all duration-700"
                                style={{
                                    height: `${(activeStep + 1) / steps.length * 100}%`
                                }}
                            />
                        </div>

                        <div className="space-y-64 relative">
                            {steps.map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    ref={el => { stepRefs.current[idx] = el; }}
                                    className="flex items-start gap-8 md:gap-12 relative"
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.5, delay: idx * 0.2 }}
                                >
                                    {/* Cerchio numerato */}
                                    <div className="flex-shrink-0 relative z-10">
                                        <div 
                                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 relative
                                                ${idx <= activeStep ? 'bg-orange-500' : 'bg-[#1a1a1a]'}`}
                                        >
                                            <span className={`text-4xl font-black transition-all duration-700 ${idx <= activeStep ? 'text-black' : 'text-gray-500'}`}>
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            {/* Bordo animato */}
                                            <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-700
                                                ${idx <= activeStep ? 'border-orange-500' : 'border-[#1a1a1a]'}`} />
                                        </div>
                                    </div>

                                    {/* Contenuto */}
                                    <div className="flex-1 pt-4">
                                        <h3 className={`text-2xl md:text-3xl font-bold mb-4 transition-colors duration-700 ${idx <= activeStep ? 'text-orange-500' : 'text-white'}`}>
                                            {step.title}
                                        </h3>
                                        <p className="text-gray-400 text-lg leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </Section>

                {/* OFFICINA */}
                <Section id="officina">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-orange-500 mb-12">La Nostra Officina</h2>
                    <p className="text-lg text-gray-300 text-center mb-12 max-w-3xl mx-auto">
                        Uno sguardo dietro le quinte: ambienti ordinati, attrezzature moderne e tanta passione per le quattro ruote.
                    </p>
                    <OfficinaCarousel />
                </Section>

                {/* SOCIAL WIDGET */}
                <Section id="social">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">Seguici sui <span className="text-orange-500">Social</span></h2>
                    <div className="flex justify-center">
                        <div 
                            className="commonninja_component pid-f89e772b-752e-4b9b-b9f7-da92e0fb6a59 w-full max-w-4xl min-h-[400px] bg-transparent rounded-lg p-4"
                            style={{ 
                                minHeight: '500px',
                                width: '100%',
                                maxWidth: '1200px'
                            }}
                        ></div>
                    </div>
                </Section>

                {/* PREVENTIVO */}
                <div ref={preventivoRef} className="scroll-mt-20 relative">
                    <Section id="preventivo-section" className="bg-gray-900/30">
                        <div className="text-center max-w-3xl mx-auto">
                            <motion.h2 
                                className="text-3xl md:text-4xl font-bold text-orange-500 mb-4"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5 }}
                            >
                                Scegli i nostri servizi
                            </motion.h2>
                            <motion.p 
                                className="text-lg text-gray-300 mb-10"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                            >
                                Compila il modulo e riceverai la nostra migliore proposta senza impegno. È facile, veloce e gratuito.
                            </motion.p>
                            
                            {/* Bottone per aprire il popup */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                            >
                                <Button
                                    onClick={() => setShowQuotePopup(true)}
                                    size="lg"
                                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-lg text-lg group transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                                >
                                    <FileText className="w-6 h-6 mr-3" />
                                    Scegli i nostri servizi
                                    <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </motion.div>
                        </div>
                    </Section>
                </div>
            </main>

            {/* FOOTER */}
            <footer className="pt-16 pb-8 bg-black border-t border-white/10">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                         {/* Col 1: About & Social */}
                        <div className="flex flex-col">
                            <h4 className="text-xl font-bold text-white mb-4">Auto e<span className="text-orange-500">X</span>press</h4>
                            <p className="text-gray-400 mb-6">L'autofficina digitale che ti semplifica la vita. Trasparenza, competenza e tecnologia al tuo servizio.</p>
                            <div className="flex gap-4">
                                <a href="https://wa.me/393293888702" className="text-gray-400 hover:text-orange-500 transition-colors"><FontAwesomeIcon icon={faWhatsapp} className="w-6 h-6" /></a>
                                <a href="https://www.facebook.com/autoexpressadservice" className="text-gray-400 hover:text-orange-500 transition-colors"><FontAwesomeIcon icon={faFacebook} className="w-6 h-6" /></a>
                                <a href="https://www.instagram.com/autoexpressadservice" className="text-gray-400 hover:text-orange-500 transition-colors"><FontAwesomeIcon icon={faInstagram} className="w-6 h-6" /></a>
                                <a href="https://www.tiktok.com/@autoexpressadservice" className="text-gray-400 hover:text-orange-500 transition-colors"><FontAwesomeIcon icon={faTiktok} className="w-6 h-6" /></a>
                            </div>
                        </div>
                        {/* Col 2: Contatti */}
                        <div className="flex flex-col">
                            <h4 className="text-lg font-semibold text-white mb-4">Contatti</h4>
                            <div className="flex items-start gap-3 mb-3 text-gray-400">
                                <FontAwesomeIcon icon={faMapMarkerAlt} className="w-4 h-4 text-orange-500 mt-1" />
                                <span>Via Eugenio Montale, 4<br />70043 Monopoli (BA), Italia</span>
                            </div>
                            <div className="flex items-start gap-3 mb-3 text-gray-400">
                                <FontAwesomeIcon icon={faPhone} className="w-4 h-4 text-orange-500 mt-1" />
                                <a href="tel:+393293888702" className="hover:text-orange-500 transition-colors">+39 329 388 8702</a>
                            </div>
                            <div className="flex items-start gap-3 text-gray-400">
                                <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 text-orange-500 mt-1" />
                                <a href="mailto:assistenza@autoexpressadservice.it" className="hover:text-orange-500 transition-colors break-all">assistenza@autoexpressadservice.it</a>
                            </div>
                        </div>
                        {/* Col 3: Link Utili */}
                         <div className="flex flex-col">
                            <h4 className="text-lg font-semibold text-white mb-4">Link Utili</h4>
                            <a href="#" onClick={(e) => { e.preventDefault(); document.querySelector('#servizi')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-gray-400 hover:text-orange-500 transition-colors mb-2">I Nostri Servizi</a>
                            <a href="#" onClick={(e) => { e.preventDefault(); document.querySelector('#preventivo')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-gray-400 hover:text-orange-500 transition-colors mb-2">Richiedi Preventivo</a>
                            <a href="/chi-siamo" className="text-gray-400 hover:text-orange-500 transition-colors mb-2">Chi Siamo</a>
                            <a href="https://www.race-tech.it/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-500 transition-colors mb-2">Privacy Policy</a>
                            <a href="https://www.race-tech.it/cookie-policy/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-500 transition-colors">Cookie Policy</a>
                        </div>
                    </div>
                    <div className="mt-8 border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
                        <div className="text-gray-500 mb-4 md:mb-0">© {new Date().getFullYear()} Autoexpress. Tutti i diritti riservati. P.IVA 01234567890</div>
                        
                    </div>
                </div>
            </footer>
            
            {/* WhatsApp Widget */}
            <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
                {showChat && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mb-2 bg-white text-black rounded-2xl shadow-xl p-4 w-[calc(100vw-48px)] max-w-[320px] border border-green-500 relative"
                    >
                        <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white rotate-45" />
                        <div className="flex items-center mb-3">
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3 border-2 border-white shadow">
                                <FontAwesomeIcon icon={faWhatsapp} className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="font-bold text-green-600">Assistenza WhatsApp</div>
                                <div className="text-xs text-gray-500">Rispondiamo subito!</div>
                            </div>
                        </div>
                        <p className="text-sm mb-4">Ciao! 👋 Come possiamo aiutarti oggi?</p>
                        <a href="https://api.whatsapp.com/send/?phone=%2B393293888702&text=Salve!%20Ho%20bisogno%20di%20informazioni." target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg w-full block text-center transition">
                            Inizia a chattare
                        </a>
                    </motion.div>
                )}
                <button
                    onClick={() => setShowChat((v) => !v)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg p-4 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                    title="Chatta con noi su WhatsApp"
                    aria-label="Chat WhatsApp"
                >
                    <FontAwesomeIcon icon={faWhatsapp} className="w-7 h-7" />
                </button>
            </div>
            
            {/* Popup del preventivo */}
            <RequestQuotePopup 
                isOpen={showQuotePopup} 
                onClose={() => setShowQuotePopup(false)} 
            />
        </div>
    );
} 