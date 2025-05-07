'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SavedGame = {
  id: string;
  date: string;
  state: {
    players: any;
    walls: any;
    currentPlayer: string;
    remainingWalls: any;
    actionPhase: string;
  };
};

export default function SavedGames() {
  const router = useRouter();
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);

  useEffect(() => {
    const loadGames = () => {
      const games = JSON.parse(localStorage.getItem('quoridor-saves') || '[]');
      setSavedGames(games);
    };
    loadGames();
  }, []);

  const handleLoadGame = (gameState: SavedGame['state']) => {
    localStorage.setItem('quoridor-current', JSON.stringify(gameState));
    router.push('/pvp');
  };

  const handleDeleteGame = (gameId: string) => {
    const updatedGames = savedGames.filter(game => game.id !== gameId);
    localStorage.setItem('quoridor-saves', JSON.stringify(updatedGames));
    setSavedGames(updatedGames);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#00111F] text-white font-sans">
      <div className="flex flex-col gap-4 text-center w-full max-w-2xl px-4">
        <h1 className="text-4xl font-bold mb-6">Jogos Salvos</h1>
        
        {savedGames.length === 0 ? (
          <p className="text-gray-400">Nenhum jogo salvo encontrado</p>
        ) : (
          <div className="grid gap-4">
            {savedGames.map((game) => (
              <div key={game.id} className="bg-[#00213A] p-4 rounded-lg flex justify-between items-center">
                <div className="text-left">
                  <h3 className="font-semibold">Salvo em: {game.date}</h3>
                  <p className="text-sm text-gray-400">
                    Vez do: {game.state.currentPlayer} | 
                    Muros: P1 ({game.state.remainingWalls.P1}) / P2 ({game.state.remainingWalls.P2})
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoadGame(game.state)}
                    className="bg-[#0085EA] hover:bg-[#006fbd] px-4 py-2 rounded-lg text-sm"
                  >
                    Carregar
                  </button>
                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="bg-[#FF6B6B] hover:bg-[#ff5252] px-4 py-2 rounded-lg text-sm"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          className="bg-[#FF6B6B] hover:bg-[#ff5252] transition px-6 py-2 rounded-lg text-lg"
          >
            Voltar
          </button>
      </div>
    </div>
  );
}