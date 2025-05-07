'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

const BOARD_SIZE = 9;
const CELL_SIZE = 48;
const WALL_THICKNESS = 4;

type Position = { row: number; col: number };
type Wall = { type: 'horizontal' | 'vertical'; row: number; col: number };

export default function QuoridorGame() {
  const router = useRouter();
  const [players, setPlayers] = useState({
    P1: { row: 0, col: 4 },
    P2: { row: 8, col: 4 },
  });

  const [walls, setWalls] = useState<Wall[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'P1' | 'P2'>('P1');
  const [remainingWalls, setRemainingWalls] = useState({ P1: 10, P2: 10 });
  const [actionPhase, setActionPhase] = useState<'move' | 'wall'>('move');
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'P1' | 'P2' | null>(null);

  useEffect(() => {
    const savedGame = localStorage.getItem('quoridor-current');
    if (savedGame) {
      const gameState = JSON.parse(savedGame);
      setPlayers(gameState.players);
      setWalls(gameState.walls);
      setCurrentPlayer(gameState.currentPlayer);
      setRemainingWalls(gameState.remainingWalls);
      setActionPhase(gameState.actionPhase);
      localStorage.removeItem('quoridor-current');
    }
  }, []);

  useEffect(() => {
    if (actionPhase === 'move' && !gameOver) {
      setValidMoves(getValidMoves(players[currentPlayer]));
    }
  }, [players, currentPlayer, actionPhase, gameOver]);

  const isValidPosition = (pos: Position) => {
    return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
  };

  const isWallBetween = (start: Position, end: Position): boolean => {
    if (start.row !== end.row) {
      const top = Math.min(start.row, end.row);
      const col = start.col;
      return walls.some(wall =>
        wall.type === 'horizontal' &&
        wall.row === top &&
        (wall.col === col || wall.col === col - 1)
      );
    }

    if (start.col !== end.col) {
      const left = Math.min(start.col, end.col);
      const row = start.row;
      return walls.some(wall =>
        wall.type === 'vertical' &&
        wall.col === left &&
        (wall.row === row || wall.row === row - 1)
      );
    }

    return false;
  };

  const getValidMoves = (currentPos: Position): Position[] => {
    const moves: Position[] = [];
    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];

    const otherPlayer = currentPlayer === 'P1' ? players.P2 : players.P1;

    directions.forEach(dir => {
      const newPos = {
        row: currentPos.row + dir.row,
        col: currentPos.col + dir.col
      };

      if (isValidPosition(newPos) && !isWallBetween(currentPos, newPos)) {
        if (newPos.row === otherPlayer.row && newPos.col === otherPlayer.col) {
          const jumpPos = {
            row: newPos.row + dir.row,
            col: newPos.col + dir.col
          };

          if (isValidPosition(jumpPos) && !isWallBetween(newPos, jumpPos)) {
            moves.push(jumpPos);
          }
        } else {
          moves.push(newPos);
        }
      }
    });

    return moves;
  };

  const handleMove = (target: Position) => {
    if (gameOver) return;

    const otherPlayer = currentPlayer === 'P1' ? players.P2 : players.P1;
    if (!validMoves.some(p => p.row === target.row && p.col === target.col)) return;

    const isVictory = currentPlayer === 'P1'
      ? target.row === BOARD_SIZE - 1
      : target.row === 0;

    setPlayers(prev => ({
      ...prev,
      [currentPlayer]: target
    }));

    if (isVictory) {
      setWinner(currentPlayer);
      setGameOver(true);
      return;
    }

    setActionPhase('wall');
  };

  const handleWall = (wall: Wall) => {
    if (gameOver || remainingWalls[currentPlayer] <= 0) return;

    if ((wall.type === 'horizontal' && wall.col >= BOARD_SIZE - 1) ||
      (wall.type === 'vertical' && wall.row >= BOARD_SIZE - 1)) return;

    const isOverlap = walls.some(w => {
      if (w.type === wall.type) {
        if (w.type === 'horizontal') {
          return w.row === wall.row && (
            w.col === wall.col || w.col === wall.col - 1 || w.col === wall.col + 1
          );
        } else {
          return w.col === wall.col && (
            w.row === wall.row || w.row === wall.row - 1 || w.row === wall.row + 1
          );
        }
      } else {
        if (wall.type === 'horizontal') {
          const vCol = w.col;
          const vRowStart = w.row;
          const vRowEnd = w.row + 1;
          const hColStart = wall.col;
          const hColEnd = wall.col + 1;
          const hRow = wall.row;

          const colOverlap = vCol >= hColStart && vCol < hColEnd;
          const rowOverlap = hRow >= vRowStart && hRow < vRowEnd;
          return colOverlap && rowOverlap;
        } else {
          const hCol = wall.col;
          const hRowStart = wall.row;
          const hRowEnd = wall.row + 1;
          const vColStart = w.col;
          const vColEnd = w.col + 1;
          const vRow = w.row;

          const colOverlap = hCol >= vColStart && hCol < vColEnd;
          const rowOverlap = vRow >= hRowStart && vRow < hRowEnd;
          return colOverlap && rowOverlap;
        }
      }
    });

    if (!isOverlap) {
      setWalls(prev => [...prev, wall]);
      setRemainingWalls(prev => ({
        ...prev,
        [currentPlayer]: prev[currentPlayer] - 1
      }));
      endTurn();
    }
  };

  const endTurn = () => {
    setCurrentPlayer(prev => prev === 'P1' ? 'P2' : 'P1');
    setActionPhase('move');
  };

  const saveGame = () => {
    const gameState = {
      players,
      walls,
      currentPlayer,
      remainingWalls,
      actionPhase
    };

    const save = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      state: gameState
    };

    const saves = JSON.parse(localStorage.getItem('quoridor-saves') || '[]');
    saves.unshift(save);
    localStorage.setItem('quoridor-saves', JSON.stringify(saves));
    alert('Jogo salvo com sucesso!');
  };

  const resetGame = () => {
    setPlayers({
      P1: { row: 0, col: 4 },
      P2: { row: 8, col: 4 },
    });
    setWalls([]);
    setCurrentPlayer('P1');
    setRemainingWalls({ P1: 10, P2: 10 });
    setActionPhase('move');
    setGameOver(false);
    setWinner(null);
  };

  const goToMainMenu = () => {
    router.push('/');
  };

  const renderCell = (row: number, col: number) => {
    const isP1 = players.P1.row === row && players.P1.col === col;
    const isP2 = players.P2.row === row && players.P2.col === col;
    const isValidMove = validMoves.some(p => p.row === row && p.col === col);

    return (
      <div
        key={`cell-${row}-${col}`}
        onClick={() => !gameOver && actionPhase === 'move' && handleMove({ row, col })}
        className={clsx(
          'relative flex items-center justify-center cursor-pointer',
          'border border-gray-600 transition-colors',
          isP1 && 'bg-[#0085EA]',
          isP2 && 'bg-[#FF6B6B]',
          !isP1 && !isP2 && 'bg-[#00213A] hover:bg-[#003752]',
          { 'cursor-not-allowed': gameOver || actionPhase !== 'move' }
        )}
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
        }}
      >
        {!isP1 && !isP2 && isValidMove && actionPhase === 'move' && !gameOver && (
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
        )}

        {isP1 && 'P1'}
        {isP2 && 'P2'}
      </div>
    );
  };

  const renderWalls = () => {
    return walls.map((wall, index) => {
      const style: React.CSSProperties = {
        position: 'absolute',
        backgroundColor: '#FFFF00',
        zIndex: 10,
        pointerEvents: 'none'
      };

      if (wall.type === 'horizontal') {
        style.top = `${(wall.row + 1) * CELL_SIZE - WALL_THICKNESS}px`;
        style.left = `${wall.col * CELL_SIZE}px`;
        style.width = `${CELL_SIZE * 2 - 1}px`;
        style.height = `${WALL_THICKNESS}px`;
      } else {
        style.top = `${wall.row * CELL_SIZE}px`;
        style.left = `${(wall.col + 1) * CELL_SIZE - WALL_THICKNESS}px`;
        style.width = `${WALL_THICKNESS}px`;
        style.height = `${CELL_SIZE * 2 - 1}px`;
      }

      return <div key={`wall-${index}`} style={style} />;
    });
  };

  return (
    <div className="min-h-screen bg-[#00111F] text-white flex flex-col items-center py-10 font-sans">
      <h1 className="text-4xl font-bold mb-4">Quoridor</h1>

      <div className="relative" style={{ width: CELL_SIZE * BOARD_SIZE, height: CELL_SIZE * BOARD_SIZE }}>
        <div className="grid grid-cols-9 absolute top-0 left-0">
          {Array(BOARD_SIZE).fill(0).map((_, row) =>
            Array(BOARD_SIZE).fill(0).map((_, col) => renderCell(row, col))
          )}
        </div>

        {renderWalls()}

        {actionPhase === 'wall' && !gameOver && (
          <>
            {Array(BOARD_SIZE - 1).fill(0).map((_, row) =>
              Array(BOARD_SIZE - 1).fill(0).map((_, col) => (
                <div key={`wall-${row}-${col}`}>
                  <div
                    className="absolute hover:bg-gray-400 opacity-25 cursor-pointer"
                    style={{
                      top: (row + 1) * CELL_SIZE - WALL_THICKNESS,
                      left: col * CELL_SIZE,
                      width: CELL_SIZE * 2,
                      height: WALL_THICKNESS,
                    }}
                    onClick={() => handleWall({ type: 'horizontal', row, col })}
                  />
                  <div
                    className="absolute hover:bg-gray-400 opacity-25 cursor-pointer"
                    style={{
                      top: row * CELL_SIZE,
                      left: (col + 1) * CELL_SIZE - WALL_THICKNESS,
                      width: WALL_THICKNESS,
                      height: CELL_SIZE * 2,
                    }}
                    onClick={() => handleWall({ type: 'vertical', row, col })}
                  />
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="mt-4 text-center space-y-2">
        <button
          onClick={saveGame}
          className="bg-[#00C853] hover:bg-[#009624] px-4 py-2 rounded-lg transition-colors"
        >
          Salvar Jogo
        </button>
        <button
          onClick={goToMainMenu}
          className="bg-[#FF6B6B] hover:bg-[#ff5252] px-4 py-2 rounded-lg transition-colors"
        >
          Voltar ao Menu
        </button>

        <p className="text-lg">
          Vez do: <span className="font-bold text-[#0085EA]">{currentPlayer}</span>
        </p>
        <p className="text-sm">
          Muros restantes:
          <span className="text-[#0085EA]"> P1 ({remainingWalls.P1})</span> |
          <span className="text-[#FF6B6B]"> P2 ({remainingWalls.P2})</span>
        </p>

        {actionPhase === 'wall' && !gameOver && (
          <button
            onClick={endTurn}
            className="bg-[#0085EA] hover:bg-[#006fbd] px-4 py-2 rounded-lg transition-colors"
          >
            Pular fase de muro
          </button>
        )}
      </div>

      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-[#00213A] p-8 rounded-lg text-center space-y-4">
            <h2 className="text-3xl font-bold text-[#00FF87]">
              Vitória do Jogador {winner}!
            </h2>
            <div className="flex justify-center space-x-4">
              <button
                onClick={resetGame}
                className="bg-[#0085EA] hover:bg-[#006fbd] px-6 py-3 rounded-lg text-lg font-semibold transition-colors"
              >
                Jogar Novamente
              </button>
              <button
                onClick={goToMainMenu}
                className="bg-[#FF6B6B] hover:bg-[#ff5252] px-6 py-3 rounded-lg text-lg font-semibold transition-colors"
              >
                Menu Principal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}