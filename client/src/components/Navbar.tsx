import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Menu, ChevronDown } from 'lucide-react';
import { useLocation } from 'wouter';

const navLinks = [
  { id: 'servizi', label: 'Servizi' },
];

const partnersLinks = [
  { href: '/partners', label: 'Tutti i Partner', external: false },
];

const aziendaLinks = [
  { href: '/chi-siamo', label: 'Chi Siamo' },
  { href: '/sede', label: 'Sede' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [aziendaOpen, setAziendaOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    if (location !== '/') {
      sessionStorage.setItem('scrollToSection', id);
      window.location.href = '/';
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  useEffect(() => {
    if (location === '/') {
      const section = sessionStorage.getItem('scrollToSection');
      if (section) {
        setTimeout(() => {
          const el = document.getElementById(section);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
          sessionStorage.removeItem('scrollToSection');
        }, 400);
      }
    }
  }, [location]);

  const closeAllDropdowns = () => {
    setPartnersOpen(false);
    setAziendaOpen(false);
  };

  const handleLinkClick = (href: string, external?: boolean) => {
    if (external) {
      window.open(href, '_blank');
    } else {
      window.location.href = href;
    }
    closeAllDropdowns();
    setMobileOpen(false);
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 w-full z-50 backdrop-blur-md ${
        scrolled ? 'bg-black/80 border-b border-gray-800' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <span
          className="text-xl font-extrabold cursor-pointer select-none"
          onClick={() => scrollTo('home')}
        >
          Auto e<span className="text-orange-500">X</span>press
        </span>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {/* Servizi */}
          {navLinks.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="relative text-sm font-medium text-gray-300 hover:text-white transition-colors">
              {l.label}
              <motion.span
                className="absolute left-0 -bottom-0.5 h-[2px] bg-orange-500 origin-left"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ width: '100%' }}
              />
            </button>
          ))}

          {/* Partners Dropdown */}
          <div className="relative">
            <a
              href="/partners"
              className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors px-2 py-1"
            >
              Partners
            </a>
          </div>


          {/* Azienda Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setAziendaOpen(!aziendaOpen);
                setPartnersOpen(false);
              }}
              className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Azienda
              <ChevronDown className={`w-4 h-4 transition-transform ${aziendaOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {aziendaOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-black/90 backdrop-blur-md border border-gray-800 rounded-xl py-2 shadow-xl"
                >
                  {aziendaLinks.map((link) => (
                    <button
                      key={link.label}
                      onClick={() => handleLinkClick(link.href)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
                    >
                      {link.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <a href="/Login">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-black font-bold">
              Login
            </Button>
          </a>
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden text-gray-300 hover:text-white"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          transition={{ duration: 0.4 }}
          className="md:hidden border-t border-gray-800 bg-black/90 backdrop-blur-md"
        >
          <div className="px-6 py-4 flex flex-col gap-4">
            {/* Servizi */}
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="text-left text-gray-300 hover:text-white"
              >
                {l.label}
              </button> 
            ))}

            {/* Partners Mobile */}
            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm font-semibold text-white mb-2">Partners</p>
              <a
                href="/partners"
                className="text-left text-gray-300 hover:text-white block py-1"
              >
                Tutti i Partner
              </a>
            </div>

            {/* Azienda Mobile */}
            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm font-semibold text-white mb-2">Azienda</p>
              {aziendaLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleLinkClick(link.href)}
                  className="block w-full text-left text-gray-300 hover:text-white py-1 pl-4"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <a href="/Login" className="mt-4">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold">
                Login
              </Button>
            </a>
          </div>
        </motion.div>
      )}

      {/* Overlay per chiudere dropdown */}
      {(partnersOpen || aziendaOpen) && (
        <div 
          className="fixed inset-0 z-[-1]" 
          onClick={closeAllDropdowns}
        />
      )}
    </motion.header>
  );
} 