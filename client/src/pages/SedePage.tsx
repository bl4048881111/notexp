import React from 'react';
import Navbar from '@/components/Navbar';
import { MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SedePage() {
  return (
    <div className="bg-[#0b0c13] min-h-screen text-white overflow-x-hidden">
      <Navbar />
      <section className="max-w-6xl mx-auto px-4 py-24 flex flex-col md:flex-row items-center gap-20 md:gap-16">
        {/* COLONNA SINISTRA: TESTO */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left gap-8"
        >
          <MapPin className="h-16 w-16 text-orange-500 drop-shadow-lg mb-2" />
          <h1 className="text-5xl md:text-6xl font-extrabold text-orange-500 drop-shadow-lg">La nostra sede</h1>
          <p className="text-2xl md:text-3xl text-gray-200 max-w-xl">
            Vieni a trovarci nella nostra officina a Monopoli!<br />
            Siamo sempre pronti ad accoglierti con professionalità e cortesia.
          </p>
          <div className="bg-[#181a23] rounded-2xl shadow-xl border border-orange-500/20 px-10 py-8 flex flex-col items-center md:items-start">
            <div className="flex items-center gap-4 mb-3">
              <MapPin className="h-8 w-8 text-orange-500" />
              <span className="text-2xl font-bold text-white">Indirizzo</span>
            </div>
            <div className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              Via Eugenio Montale, 4<br />70043 Monopoli (BA)
            </div>
          </div>
        </motion.div>
        {/* COLONNA DESTRA: MAPPA */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="w-full md:w-1/2 flex justify-center"
        >
          <div
            className="w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border-4 border-orange-500/40"
            style={{ boxShadow: '0 0 60px 0 #ff8800aa' }}
          >
            <iframe
              title="Mappa Sede Autoexpress"
              src="https://www.google.com/maps?q=Via+Eugenio+Montale+4,+70043+Monopoli+BA&output=embed"
              width="100%"
              height="420"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </motion.div>
      </section>
    </div>
  );
} 