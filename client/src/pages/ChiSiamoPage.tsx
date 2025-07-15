import React from 'react';
import Navbar from '@/components/Navbar';
import { Users, Heart, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChiSiamoPage() {
  return (
    <div className="bg-[#0b0c13] min-h-screen text-white overflow-x-hidden">
      <Navbar />
      {/* HERO MODERNO */}
      <section className="relative flex flex-col items-center justify-center min-h-[60vh] py-20 px-6 bg-gradient-to-br from-[#181a23] via-[#0b0c13] to-[#181a23]">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-5xl md:text-7xl font-extrabold text-center text-orange-500 drop-shadow-lg mb-6"
        >
          Chi siamo
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-gray-200 text-center max-w-2xl mb-10"
        >
          Passione, professionalità e innovazione: la nostra officina è una famiglia che mette il cliente sempre al centro.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative shadow-2xl rounded-3xl overflow-hidden border-4 border-orange-500/40"
          style={{ boxShadow: '0 0 60px 0 #ff8800aa' }}
        >
          <img
            src="https://i.ibb.co/kkCHJmF/IMG-6642.jpg"
            alt="La nostra officina"
            className="w-full max-w-2xl object-cover aspect-[16/8]"
          />
        </motion.div>
      </section>

      {/* VALORI AZIENDALI */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-[#181a23] rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-orange-500/10 hover:scale-105 transition-transform"
        >
          <Users className="h-10 w-10 text-orange-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Professionalità</h3>
          <p className="text-gray-300">Un team esperto e sempre aggiornato, pronto a risolvere ogni esigenza con cura e precisione.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-[#181a23] rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-orange-500/10 hover:scale-105 transition-transform"
        >
          <Heart className="h-10 w-10 text-orange-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Passione</h3>
          <p className="text-gray-300">Amiamo il nostro lavoro e ci impegniamo ogni giorno per offrire un servizio che va oltre le aspettative.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-[#181a23] rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-orange-500/10 hover:scale-105 transition-transform"
        >
          <Lightbulb className="h-10 w-10 text-orange-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Innovazione</h3>
          <p className="text-gray-300">Tecnologie all’avanguardia e formazione continua per garantirti sempre il meglio.</p>
        </motion.div>
      </section>

      {/* FILOSOFIA AZIENDALE */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="bg-[#181a23] rounded-2xl shadow-2xl p-10 border-l-8 border-orange-500/60"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-orange-500 mb-6">Filosofia aziendale</h2>
          <p className="text-xl text-gray-200 mb-4">
            "Crediamo che ogni auto abbia una storia e ogni cliente meriti attenzione, trasparenza e fiducia."
          </p>
          <p className="text-lg text-gray-400">
            La nostra missione è accompagnarti in ogni viaggio, offrendo soluzioni su misura e un servizio che mette al centro la persona, non solo il veicolo.
          </p>
        </motion.div>
      </section>
    </div>
  );
} 