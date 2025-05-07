'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [showPlayOptions, setShowPlayOptions] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#00111F] text-white font-sans">
      
      <div className="flex flex-col gap-4 text-center">
        {!showPlayOptions ? (
          <>
            <h1 className="text-4xl font-bold mb-6">Quoridor</h1>
            <button
              onClick={() => setShowPlayOptions(true)}
              className="bg-[#0085EA] hover:bg-[#006fbd] transition px-6 py-2 rounded-lg text-lg"
            >
              Jogar
            </button>
            <button
              onClick={() => alert('Saindo...')}
              className="bg-[#FF6B6B] hover:bg-[#ff5252] transition px-6 py-2 rounded-lg text-lg"
            >
              Sair
            </button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-semibold mb-4">Modo de Jogo</h2>
            <button
              onClick={() => router.push('/pvp')}
              className="bg-[#0085EA] hover:bg-[#006fbd] transition px-6 py-2 rounded-lg text-lg"
            >
              Player vs Player
            </button>
            <button
              onClick={() => router.push('/pvia')}
              className="bg-[#0085EA] hover:bg-[#006fbd] transition px-6 py-2 rounded-lg text-lg"
            >
              Player vs IA
            </button>
            <button
              onClick={() => router.push('/jogossalvos')}
              className="bg-[#0085EA] hover:bg-[#006fbd] transition px-6 py-2 rounded-lg text-lg"
            >
              Jogos Salvos
            </button>
            <button
              onClick={() => setShowPlayOptions(false)}
              className="bg-[#FF6B6B] hover:bg-[#ff5252] transition px-6 py-2 rounded-lg text-lg"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
