import { useEffect } from 'react';

interface InstagramPowrFeedProps {
  powrId?: string;
}

export default function InstagramPowrFeed({ powrId = "49e8a352_1747986870" }: InstagramPowrFeedProps) {
  useEffect(() => {
    // Carica lo script POWR
    const script = document.createElement('script');
    script.src = 'https://www.powr.io/powr.js?platform=react';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Rimuovi lo script quando il componente viene smontato
      try {
        document.body.removeChild(script);
      } catch (e) {
        console.error('Errore nella rimozione dello script POWR:', e);
      }
    };
  }, []);

  return (
    <div className="instagram-powr-feed">
      <h2 className="text-2xl font-bold text-center mb-8">Seguici sui Social</h2>
      
      {/* Widget POWR Social Feed */}
      <div className="powr-social-feed" id={powrId}></div>
      
      <div className="text-center mt-8">
        <a
          href="https://www.instagram.com/autoexpressadservice/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:from-orange-600 hover:to-orange-700 transition-all duration-300 mx-2"
        >
          Seguici su Instagram
        </a>
        <a
          href="https://www.facebook.com/autoexpressadservice/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3 px-8 rounded-full hover:from-blue-700 hover:to-blue-800 transition-all duration-300 mx-2"
        >
          Seguici su Facebook
        </a>
      </div>
    </div>
  );
} 