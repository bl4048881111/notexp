import React from 'react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const partners = [
  {
    name: 'AD Service',
    img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZsMEoXuDhEizJiQdQ86-4NkOJz9HKBOYAkzobXGDmnenZi90a-1LEtU7cvPSOZcB7vwQ&usqp=CAU',
    desc: 'Parte della rete leader di officine e ricambisti indipendenti, per garantirti qualità e competenza.',
    link: 'https://www.aditalia.tech/'
  },
  {
    name: 'BlockBox',
    img: 'https://blockbox.it/wp-content/uploads/2022/05/BANNER-GIUGNO-2019-RIT.jpg',
    desc: 'Proteggi la tua auto con Block Box: blindatura in acciaio inox per ECU e OBD, antifurto meccanico Made in Italy, testato contro le tecniche più sofisticate dei ladri.',
    link: 'https://www.blockbox.it/'
  },
  {
    name: 'Garantiamo',
    img: 'https://i.ibb.co/67mMqctw/Screenshot-2025-05-15-101353.png',
    desc: 'Assicura i lavori eseguiti sulla tua auto per una protezione aggiuntiva e la massima tranquillità.',
    link: 'https://garantiamo.net/'
  }
];

export default function PartnersPage() {
  return (
    <div className="bg-[#0b0c13] min-h-screen text-white">
      <Navbar />
      <section className="max-w-8xl mx-auto px-4 py-16">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-3xl md:text-5xl font-extrabold text-center text-orange-500 mb-16 drop-shadow-lg"
        ><br></br>
          I Nostri Partner di Fiducia
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {partners.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.2, ease: 'easeOut' }}
              className="bg-black/70 rounded-3xl shadow-2xl border border-orange-500/20 flex flex-col items-center text-center p-10 hover:scale-105 hover:shadow-orange-500/30 transition-transform duration-300 group"
            >
              <div className="flex items-center justify-center w-28 h-28 md:w-36 md:h-36 bg-white rounded-2xl mb-6 shadow-lg overflow-hidden">
                <img src={p.img} alt={p.name} className="object-contain w-24 h-24 md:w-32 md:h-32" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors duration-200 drop-shadow">
                {p.name}
              </h3>
              <p className="text-gray-300 text-base md:text-lg mb-8 min-h-[60px]">
                {p.desc}
              </p>
              <motion.a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.97 }}
                className="inline-block px-7 py-3 rounded-xl border-2 border-orange-500 text-orange-400 font-bold bg-black/70 hover:bg-orange-500 hover:text-black transition-colors duration-200 shadow group-hover:shadow-orange-500/30"
              >
                Scopri di più
              </motion.a>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
} 