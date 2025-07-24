'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

const BOARD_SIZE = 9;
const CELL_SIZE = 48;
const WALL_THICKNESS = 4;
const INF = 1e9;

type Position = { row: number; col: number };
type Wall = { type: 'horizontal' | 'vertical'; row: number; col: number };
type Player = 'P1' | 'P2';

interface GameState {
  players: { P1: Position; P2: Position };
  walls: Wall[];
  currentPlayer: Player;
  remainingWalls: { P1: number; P2: number };
  actionPhase: 'move' | 'wall';
  moveDescription: string;
}

interface GameTreeNode {
  id: string;
  state: GameState;
  children: GameTreeNode[];
}

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 5);

const areStatesEqual = (a: GameState, b: GameState): boolean => {
  return (
    a.players.P1.row === b.players.P1.row &&
    a.players.P1.col === b.players.P1.col &&
    a.players.P2.row === b.players.P2.row &&
    a.players.P2.col === b.players.P2.col &&
    a.currentPlayer === b.currentPlayer &&
    a.actionPhase === b.actionPhase &&
    a.remainingWalls.P1 === b.remainingWalls.P1 &&
    a.remainingWalls.P2 === b.remainingWalls.P2 &&
    JSON.stringify(a.walls) === JSON.stringify(b.walls)
  );
};

const isWallBetweenWithSet = (start: Position, end: Position, wallsSet: Wall[]): boolean => {
  if (start.row !== end.row) {
    const top = Math.min(start.row, end.row);
    const col = start.col;
    return wallsSet.some(wall =>
      wall.type === 'horizontal' &&
      wall.row === top &&
      (wall.col === col || wall.col === col - 1)
    );
  }

  if (start.col !== end.col) {
    const left = Math.min(start.col, end.col);
    const row = start.row;
    return wallsSet.some(wall =>
      wall.type === 'vertical' &&
      wall.col === left &&
      (wall.row === row || wall.row === row - 1)
    );
  }

  return false;
};


//menor caminho
const shortestPathLength = (player: Player, currentPlayers: { P1: Position; P2: Position }, currentWalls: Wall[]): number => {
  const goalRow = player === 'P1' ? BOARD_SIZE - 1 : 0;
  const start = currentPlayers[player];
  const visited = Array(BOARD_SIZE).fill(false).map(() => Array(BOARD_SIZE).fill(false));
  const queue: { pos: Position; dist: number }[] = [{ pos: start, dist: 0 }];
  visited[start.row][start.col] = true;

  while (queue.length > 0) {
    const { pos: current, dist } = queue.shift()!;

    if ((player === 'P1' && current.row === goalRow) || (player === 'P2' && current.row === goalRow)) {
      return dist;
    }

    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 }
    ];

    for (const dir of directions) {
      const next: Position = {
        row: current.row + dir.row,
        col: current.col + dir.col
      };

      if (next.row < 0 || next.row >= BOARD_SIZE || next.col < 0 || next.col >= BOARD_SIZE) {
        continue;
      }

      if (visited[next.row][next.col]) {
        continue;
      }

      if (isWallBetweenWithSet(current, next, currentWalls)) {
        continue;
      }

      visited[next.row][next.col] = true;
      queue.push({ pos: next, dist: dist + 1 });
    }
  }

  return INF;
};

export default function QuoridorGame() {
  const router = useRouter();

  const [mode, setMode] = useState<'PvP' | 'PvAI'>('PvP');
  const [aiAlgorithm, setAiAlgorithm] = useState<'alpha-beta' | 'limited-anticipation'>('alpha-beta');
  const [aiDepth, setAiDepth] = useState(1);

  const initialGameState: GameState = {
    players: {
      P1: { row: 0, col: 4 },
      P2: { row: 8, col: 4 },
    },
    walls: [],
    currentPlayer: 'P1',
    remainingWalls: { P1: 10, P2: 10 },
    actionPhase: 'move',
    moveDescription: 'Estado Inicial'
  };

  const [players, setPlayers] = useState(initialGameState.players);
  const [walls, setWalls] = useState<Wall[]>(initialGameState.walls);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(initialGameState.currentPlayer);
  const [remainingWalls, setRemainingWalls] = useState(initialGameState.remainingWalls);
  const [actionPhase, setActionPhase] = useState<'move' | 'wall'>(initialGameState.actionPhase);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  const [gameTree, setGameTree] = useState<GameTreeNode>({
    id: 'root',
    state: initialGameState,
    children: []
  });

  const [currentNodeId, setCurrentNodeId] = useState<string>('root');
  const [showTree, setShowTree] = useState(false);
  const [showPossibleActions, setShowPossibleActions] = useState(true);
  const [pendingMove, setPendingMove] = useState<Position | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

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
    return isWallBetweenWithSet(start, end, walls);
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
          } else {
            const diagonalDirections = [
              { row: dir.row, col: -1 },
              { row: dir.row, col: 1 },
            ];

            diagonalDirections.forEach(diagDir => {
              const diagPos = {
                row: currentPos.row + diagDir.row,
                col: currentPos.col + diagDir.col
              };
              const dx = Math.abs(diagPos.col - otherPlayer.col);
              const dy = Math.abs(diagPos.row - otherPlayer.row);
              const isAdjacentToOpponent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

              if (isValidPosition(diagPos) && !isWallBetween(currentPos, diagPos) && isAdjacentToOpponent) {
                moves.push(diagPos);
              }
            });
          }
        } else {
          moves.push(newPos);
        }
      }
    });

    return moves;
  };

  const canReachGoal = (player: Player, wallsSet: Wall[], currentPlayers: { P1: Position; P2: Position }): boolean => {
    const goalRow = player === 'P1' ? BOARD_SIZE - 1 : 0;
    const start = currentPlayers[player];
    const visited = Array(BOARD_SIZE).fill(false).map(() => Array(BOARD_SIZE).fill(false));
    const queue: Position[] = [start];
    visited[start.row][start.col] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;

      if ((player === 'P1' && current.row === goalRow) || (player === 'P2' && current.row === goalRow)) return true;

      const directions = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 }
      ];

      for (const dir of directions) {
        const next: Position = {
          row: current.row + dir.row,
          col: current.col + dir.col
        };

        if (next.row < 0 || next.row >= BOARD_SIZE || next.col < 0 || next.col >= BOARD_SIZE) {
          continue;
        }

        if (visited[next.row][next.col]) {
          continue;
        }

        if (isWallBetweenWithSet(current, next, wallsSet)) {
          continue;
        }

        visited[next.row][next.col] = true;
        queue.push(next);
      }
    }

    return false;
  };

  const addNewState = useCallback((newState: GameState) => {
    const newNodeId = generateId();

    setGameTree(prevTree => {
      const addNode = (node: GameTreeNode): GameTreeNode => {
        if (node.id === currentNodeId) {
          const existingChild = node.children.find(child =>
            areStatesEqual(child.state, newState)
          );

          if (existingChild) {
            return {
              ...node,
              children: node.children.map(child =>
                child.id === existingChild.id ?
                  { ...child, state: newState } :
                  child
              )
            };
          }

          return {
            ...node,
            children: [
              ...node.children,
              {
                id: newNodeId,
                state: newState,
                children: []
              }
            ]
          };
        }

        return {
          ...node,
          children: node.children.map(addNode)
        };
      };

      return addNode(prevTree);
    });

    setCurrentNodeId(newNodeId);
    return newNodeId;
  }, [currentNodeId]);

  const navigateToNode = useCallback((nodeId: string) => {
    const findNode = (node: GameTreeNode): GameTreeNode | null => {
      if (node.id === nodeId) return node;
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(gameTree);
    if (node) {
      const state = node.state;
      setPlayers(state.players);
      setWalls(state.walls);
      setCurrentPlayer(state.currentPlayer);
      setRemainingWalls(state.remainingWalls);
      setActionPhase(state.actionPhase);
      setGameOver(false);
      setWinner(null);
      setCurrentNodeId(node.id);
      setPendingMove(null);
    }
  }, [gameTree]);

  const handleMove = (target: Position) => {
    if (gameOver || isAiThinking || (mode === 'PvAI' && currentPlayer === 'P2')) return;

    if (!validMoves.some(p => p.row === target.row && p.col === target.col)) return;

    const isVictory = currentPlayer === 'P1'
      ? target.row === BOARD_SIZE - 1
      : target.row === 0;

    const newPlayers = {
      ...players,
      [currentPlayer]: target
    };

    setPlayers(newPlayers);
    setPendingMove(target);

    if (isVictory) {
      setWinner(currentPlayer);
      setGameOver(true);

      addNewState({
        players: newPlayers,
        walls,
        currentPlayer,
        remainingWalls,
        actionPhase,
        moveDescription: `${currentPlayer} venceu o jogo!`
      });
      return;
    }

    setActionPhase('wall');
  };

  const isWallOverlap = (wall: Wall, wallsState: Wall[]): boolean => {
    return wallsState.some(w => {
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
          return w.type === 'vertical' && w.row === wall.row && w.col === wall.col;
        } else {
          return w.type === 'horizontal' && w.row === wall.row && w.col === wall.col;
        }
      }
    });
  };

  const calculateValidWallsForState = useCallback((currentPlayers: { P1: Position; P2: Position }, currentWalls: Wall[]): Wall[] => {
    const validWalls: Wall[] = [];

    for (let row = 0; row < BOARD_SIZE - 1; row++) {
      for (let col = 0; col < BOARD_SIZE - 1; col++) {
        const horizontalWall: Wall = { type: 'horizontal', row, col };
        const verticalWall: Wall = { type: 'vertical', row, col };

        if (!isWallOverlap(horizontalWall, currentWalls)) {
          const newWalls = [...currentWalls, horizontalWall];
          if (canReachGoal('P1', newWalls, currentPlayers) && canReachGoal('P2', newWalls, currentPlayers)) {
            validWalls.push(horizontalWall);
          }
        }

        if (!isWallOverlap(verticalWall, currentWalls)) {
          const newWalls = [...currentWalls, verticalWall];
          if (canReachGoal('P1', newWalls, currentPlayers) && canReachGoal('P2', newWalls, currentPlayers)) {
            validWalls.push(verticalWall);
          }
        }
      }
    }
    return validWalls;
  }, []);

  const validWalls = useMemo(() => {
    if (actionPhase === 'wall' && !gameOver && remainingWalls[currentPlayer] > 0) {
      return calculateValidWallsForState(players, walls);
    }
    return [];
  }, [actionPhase, gameOver, remainingWalls, currentPlayer, calculateValidWallsForState, players, walls]);

  const handleWall = (wall: Wall) => {
    if (gameOver || isAiThinking || remainingWalls[currentPlayer] <= 0 || (mode === 'PvAI' && currentPlayer === 'P2')) return;

    if ((wall.type === 'horizontal' && wall.col >= BOARD_SIZE - 1) ||
      (wall.type === 'vertical' && wall.row >= BOARD_SIZE - 1)) return;

    if (isWallOverlap(wall, walls)) return;

    const newWalls = [...walls, wall];

    const p1CanReach = canReachGoal('P1', newWalls, players);
    const p2CanReach = canReachGoal('P2', newWalls, players);

    if (!p1CanReach || !p2CanReach) {
      alert('Não é possível bloquear o caminho de nenhum jogador!');
      return;
    }

    setWalls(newWalls);
    const newRemainingWalls = {
      ...remainingWalls,
      [currentPlayer]: remainingWalls[currentPlayer] - 1
    };
    setRemainingWalls(newRemainingWalls);

    const nextPlayer = currentPlayer === 'P1' ? 'P2' : 'P1';

    const newState: GameState = {
      players: {
        ...players,
        [currentPlayer]: pendingMove!,
      },
      walls: newWalls,
      currentPlayer: nextPlayer,
      remainingWalls: newRemainingWalls,
      actionPhase: 'move',
      moveDescription: `${currentPlayer} moveu para (${pendingMove!.row},${pendingMove!.col}) e colocou parede ${wall.type} em (${wall.row},${wall.col})`
    };

    addNewState(newState);

    setCurrentPlayer(nextPlayer);
    setActionPhase('move');
    setPendingMove(null);
  };

  const endTurn = () => {
    if (gameOver || isAiThinking || (mode === 'PvAI' && currentPlayer === 'P2')) return;
    if (!pendingMove) return;

    const nextPlayer = currentPlayer === 'P1' ? 'P2' : 'P1';

    const newState: GameState = {
      players: {
        ...players,
        [currentPlayer]: pendingMove!,
      },
      walls,
      currentPlayer: nextPlayer,
      remainingWalls,
      actionPhase: 'move',
      moveDescription: `${currentPlayer} moveu para (${pendingMove!.row},${pendingMove!.col})`
    };

    addNewState(newState);

    setCurrentPlayer(nextPlayer);
    setActionPhase('move');
    setPendingMove(null);
  };


  //qualidade de estado
  const evaluate = (state: GameState) => {
    if ((state.currentPlayer === 'P1' && state.players.P1.row === BOARD_SIZE - 1) ||
      (state.currentPlayer === 'P2' && state.players.P2.row === 0)) {
      return state.currentPlayer === 'P2' ? INF : -INF;
    }

    const distP1 = shortestPathLength('P1', state.players, state.walls);
    const distP2 = shortestPathLength('P2', state.players, state.walls);

    return distP1 - distP2;
  };


  //gera estados possiveis
  const getNextStates = (state: GameState): GameState[] => {
    const next: GameState[] = [];
    const currentPlayerPlayer = state.currentPlayer;
    const otherPlayerPlayer: Player = state.currentPlayer === 'P1' ? 'P2' : 'P1';

    const moves = getValidMovesForPlayer(state.players[currentPlayerPlayer], state.players, state.walls);

    for (const mv of moves) {
      const tmpPlayers = { ...state.players, [currentPlayerPlayer]: mv };

      const isVictoryMove = (currentPlayerPlayer === 'P1' && mv.row === BOARD_SIZE - 1) ||
        (currentPlayerPlayer === 'P2' && mv.row === 0);

      next.push({
        players: tmpPlayers,
        walls: state.walls,
        currentPlayer: otherPlayerPlayer,
        remainingWalls: state.remainingWalls,
        actionPhase: 'move',
        moveDescription: isVictoryMove ?
          `${currentPlayerPlayer} venceu o jogo!` :
          `${currentPlayerPlayer} moveu para (${mv.row},${mv.col})`
      });

      if (state.remainingWalls[currentPlayerPlayer] > 0 && !isVictoryMove) {
        const candidateWalls = calculateValidWallsForState(tmpPlayers, state.walls);

        for (const w of candidateWalls) {
          const newWalls = [...state.walls, w];
          next.push({
            players: tmpPlayers,
            walls: newWalls,
            currentPlayer: otherPlayerPlayer,
            remainingWalls: {
              ...state.remainingWalls,
              [currentPlayerPlayer]: state.remainingWalls[currentPlayerPlayer] - 1
            },
            actionPhase: 'move',
            moveDescription: `${currentPlayerPlayer} moveu para (${mv.row},${mv.col}) e colocou parede ${w.type}(${w.row},${w.col})`
          });
        }
      }
    }
    return next;
  };


  //movimentos possiveis
  const getValidMovesForPlayer = (currentPos: Position, allPlayers: { P1: Position; P2: Position }, wallsSet: Wall[]): Position[] => {
    const moves: Position[] = [];
    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];

    const otherPlayerPos = currentPos === allPlayers.P1 ? allPlayers.P2 : allPlayers.P1;

    directions.forEach(dir => {
      const newPos = {
        row: currentPos.row + dir.row,
        col: currentPos.col + dir.col
      };

      if (isValidPosition(newPos) && !isWallBetweenWithSet(currentPos, newPos, wallsSet)) {
        if (newPos.row === otherPlayerPos.row && newPos.col === otherPlayerPos.col) {
          const jumpPos = {
            row: newPos.row + dir.row,
            col: newPos.col + dir.col
          };

          if (isValidPosition(jumpPos) && !isWallBetweenWithSet(newPos, jumpPos, wallsSet)) {
            moves.push(jumpPos);
          } else {
            const diagonalDirections = [
              { row: dir.row, col: -1 },
              { row: dir.row, col: 1 },
            ];

            diagonalDirections.forEach(diagDir => {
              const diagPos = {
                row: currentPos.row + diagDir.row,
                col: currentPos.col + diagDir.col
              };
              const dx = Math.abs(diagPos.col - otherPlayerPos.col);
              const dy = Math.abs(diagPos.row - otherPlayerPos.row);
              const isAdjacentToOpponent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

              if (isValidPosition(diagPos) && !isWallBetweenWithSet(currentPos, diagPos, wallsSet) && isAdjacentToOpponent) {
                moves.push(diagPos);
              }
            });
          }
        } else {
          moves.push(newPos);
        }
      }
    });
    return moves;
  };

  //minimax alpha beta
  const minimaxAlphaBeta = (
    state: GameState,
    depth: number,
    maximizingPlayer: boolean,
    alpha: number,
    beta: number
  ): { value: number; bestState: GameState | null } => {
    if (depth === 0 || state.moveDescription.includes('venceu')) {
      return { value: evaluate(state), bestState: null };
    }

    let bestVal = maximizingPlayer ? -INF : INF;
    let bestSt: GameState | null = null;

    const children = getNextStates(state);

    for (const child of children) {
      const { value } = minimaxAlphaBeta(child, depth - 1, !maximizingPlayer, alpha, beta);

      if (maximizingPlayer) {
        if (value > bestVal) {
          bestVal = value;
          bestSt = child;
        }
        alpha = Math.max(alpha, bestVal);
      } else {
        if (value < bestVal) {
          bestVal = value;
          bestSt = child;
        }
        beta = Math.min(beta, bestVal);
      }

      if (beta <= alpha) {
        break;
      }
    }
    return { value: bestVal, bestState: bestSt };
  };


  //minimax antecipacao
  const minimaxLimitedAnticipation = (
    state: GameState,
    depth: number,
    maximizingPlayer: boolean
  ): { value: number; bestState: GameState | null } => {
    if (depth === 0 || state.moveDescription.includes('venceu')) {
      return { value: evaluate(state), bestState: null };
    }

    let bestVal = maximizingPlayer ? -INF : INF;
    let bestSt: GameState | null = null;

    const children = getNextStates(state);

    for (const child of children) {
      const { value } = minimaxLimitedAnticipation(child, depth - 1, !maximizingPlayer);

      if (maximizingPlayer) {
        if (value > bestVal) {
          bestVal = value;
          bestSt = child;
        }
      } else {
        if (value < bestVal) {
          bestVal = value;
          bestSt = child;
        }
      }
    }
    return { value: bestVal, bestState: bestSt };
  };

  //jogada IA
  const aiPlay = useCallback(() => {
    if (mode !== 'PvAI' || currentPlayer !== 'P2' || gameOver || isAiThinking) return;

    setIsAiThinking(true);

    const currentStateForAI: GameState = {
      players,
      walls,
      currentPlayer,
      remainingWalls,
      actionPhase,
      moveDescription: ''
    };

    setTimeout(() => {
      let bestState: GameState | null = null;
      let aiCalculatedValue: number;

      if (aiAlgorithm === 'alpha-beta') {
        const result = minimaxAlphaBeta(currentStateForAI, aiDepth, true, -INF, INF);
        aiCalculatedValue = result.value;
        bestState = result.bestState;
      } else { 
        const result = minimaxLimitedAnticipation(currentStateForAI, aiDepth, true);
        aiCalculatedValue = result.value; 
        bestState = result.bestState;
      }

      if (bestState) {
        setPlayers(bestState.players);
        setWalls(bestState.walls);
        setCurrentPlayer(bestState.currentPlayer);
        setRemainingWalls(bestState.remainingWalls);
        setActionPhase(bestState.actionPhase);
        addNewState(bestState);

        if (bestState.moveDescription.includes('venceu')) {
          setWinner('P2');
          setGameOver(true);
        }
      } else {
        console.warn("IA não conseguiu encontrar um melhor estado, fazendo um movimento válido aleatório se disponível.");
        const currentValidMoves = getValidMovesForPlayer(players.P2, players, walls);
        if (currentValidMoves.length > 0) {
          const randomMove = currentValidMoves[Math.floor(Math.random() * currentValidMoves.length)];
          const newPlayers = { ...players, P2: randomMove };
          const nextPlayer = 'P1';
          const newState: GameState = {
            players: newPlayers,
            walls,
            currentPlayer: nextPlayer,
            remainingWalls,
            actionPhase: 'move',
            moveDescription: `P2 moveu aleatoriamente para (${randomMove.row},${randomMove.col})`
          };

          setPlayers(newPlayers);
          setCurrentPlayer(nextPlayer);
          setActionPhase('move');
          addNewState(newState);

          if (randomMove.row === 0) {
            setWinner('P2');
            setGameOver(true);
          }
        } else {
          console.error("IA não tem movimentos válidos!");
        }
      }
      setIsAiThinking(false);
    }, 500); 
  }, [mode, currentPlayer, players, walls, remainingWalls, actionPhase, aiDepth, gameOver, addNewState, isAiThinking, aiAlgorithm]);

  useEffect(() => {
    if (mode === 'PvAI' && currentPlayer === 'P2' && !gameOver && !isAiThinking) {
      aiPlay();
    }
  }, [currentPlayer, mode, gameOver, isAiThinking, aiPlay]);

  const renderCell = (row: number, col: number) => {
    const isP1 = players.P1.row === row && players.P1.col === col;
    const isP2 = players.P2.row === row && players.P2.col === col;
    const isValidMove = validMoves.some(p => p.row === row && p.col === col);

    return (
      <div
        key={`cell-${row}-${col}`}
        onClick={() => !gameOver && actionPhase === 'move' && !(mode === 'PvAI' && currentPlayer === 'P2') && handleMove({ row, col })}
        className={clsx(
          'relative flex items-center justify-center cursor-pointer',
          'border border-gray-600 transition-colors',
          isP1 && 'bg-[#0085EA]',
          isP2 && 'bg-[#FF6B6B]',
          !isP1 && !isP2 && 'bg-[#00213A] hover:bg-[#003752]',
          { 'cursor-not-allowed': gameOver || actionPhase !== 'move' || (mode === 'PvAI' && currentPlayer === 'P2') || isAiThinking }
        )}
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
        }}
      >
        {!isP1 && !isP2 && isValidMove && actionPhase === 'move' && !gameOver && !(mode === 'PvAI' && currentPlayer === 'P2') && (
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
        style.width = `${CELL_SIZE * 2 + WALL_THICKNESS}px`;
        style.height = `${WALL_THICKNESS}px`;
      } else {
        style.top = `${wall.row * CELL_SIZE}px`;
        style.left = `${(wall.col + 1) * CELL_SIZE - WALL_THICKNESS}px`;
        style.width = `${WALL_THICKNESS}px`;
        style.height = `${CELL_SIZE * 2 + WALL_THICKNESS}px`;
      }

      return <div key={`wall-${index}`} style={style} />;
    });
  };

  const GameTreeViewer = () => {
    const renderNode = (node: GameTreeNode, level = 0) => (
      <div key={node.id} className="w-full">
        <div
          className={clsx(
            'p-1 m-1 cursor-pointer text-xs rounded transition-colors flex items-center',
            node.id === currentNodeId ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700',
          )}
          onClick={() => navigateToNode(node.id)}
          style={{ marginLeft: `${level * 15}px` }}
        >
          <span className="truncate flex-1">{node.state.moveDescription}</span>
          {node.children.length > 0 && (
            <span className="text-xs bg-gray-700 px-1 rounded ml-2">▼</span>
          )}
        </div>

        <div className="w-full">
          {node.children.map(child => renderNode(child, level + 1))}
        </div>
      </div>
    );

    return (
      <div className="fixed right-4 top-4 bottom-4 w-64 bg-gray-900 p-4 rounded-lg shadow-xl overflow-auto z-50">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold">Árvore de Jogadas</h3>
          <button
            onClick={() => setShowTree(false)}
            className="bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-sm"
          >
            Fechar
          </button>
        </div>
        {renderNode(gameTree)}
      </div>
    );
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
    setPlayers(initialGameState.players);
    setWalls(initialGameState.walls);
    setCurrentPlayer(initialGameState.currentPlayer);
    setRemainingWalls(initialGameState.remainingWalls);
    setActionPhase(initialGameState.actionPhase);
    setGameOver(false);
    setWinner(null);
    setPendingMove(null);
    setGameTree({
      id: 'root',
      state: initialGameState,
      children: []
    });
    setCurrentNodeId('root');
    setIsAiThinking(false);
  };

  const goToMainMenu = () => {
    router.push('/');
  };

  const ActionPanel = () => (
    <div className="bg-[#002A42] p-4 rounded-lg shadow-lg w-full max-w-md">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Ações Possíveis</h3>
        <button
          onClick={() => setShowPossibleActions(!showPossibleActions)}
          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
        >
          {showPossibleActions ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {showPossibleActions && (
        <div className="space-y-3 max-h-52 overflow-y-auto">
          <div>
            <h4 className="font-semibold text-[#00C853] mb-1">
              Movimentos Possíveis
            </h4>
            <div className="grid grid-cols-4 gap-1">
              {validMoves.length > 0 ? (
                validMoves.map((move, idx) => (
                  <div
                    key={idx}
                    className="bg-[#004D6B] p-1 text-center rounded text-sm"
                  >
                    ({move.row}, {move.col})
                  </div>
                ))
              ) : (
                <div className="col-span-4 text-center text-gray-400 text-sm">
                  Nenhum movimento disponível
                </div>
              )}
            </div>
          </div>

          {actionPhase === 'wall' && (
            <div>
              <h4 className="font-semibold text-[#0085EA] mb-1">
                Barreiras Possíveis
              </h4>
              <div className="grid grid-cols-4 gap-1">
                {validWalls.length > 0 ? (
                  validWalls.map((wall, idx) => (
                    <div
                      key={idx}
                      className="bg-[#004D6B] p-1 text-center rounded text-sm"
                    >
                      {wall.type === 'horizontal' ? 'H' : 'V'}({wall.row}, {wall.col})
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-center text-gray-400 text-sm">
                    {remainingWalls[currentPlayer] > 0
                      ? "Nenhuma barreira válida"
                      : "Sem barreiras disponíveis"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#00111F] text-white flex flex-col items-center py-6 font-sans">
      <h1 className="text-3xl font-bold mb-2">Quoridor</h1>

      <div className="flex gap-4 mb-4">
        <label>
          Modo:
          <select
            value={mode}
            onChange={e => {
              setMode(e.target.value as 'PvP' | 'PvAI');
              resetGame();
            }}
            className="ml-2 bg-gray-800 p-1 rounded"
            disabled={isAiThinking}
          >
            <option value="PvP">PvP</option>
            <option value="PvAI">PvAI</option>
          </select>
        </label>

        {mode === 'PvAI' && (
          <>
            <label>
              Dificuldade IA:
              <select
                value={aiDepth}
                onChange={e => setAiDepth(parseInt(e.target.value))}
                className="ml-2 bg-gray-800 p-1 rounded"
                disabled={isAiThinking}
              >
                <option value={1}>Fácil</option>
                <option value={2}>Médio</option>
                <option value={3}>Difícil</option>
              </select>
            </label>

            <label>
              Algoritmo IA:
              <select
                value={aiAlgorithm}
                onChange={e => setAiAlgorithm(e.target.value as 'alpha-beta' | 'limited-anticipation')}
                className="ml-2 bg-gray-800 p-1 rounded"
                disabled={isAiThinking}
              >
                <option value="alpha-beta">Alpha-Beta</option>
                <option value="limited-anticipation">Antecipação Limitada</option>
              </select>
            </label>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <div className="relative" style={{ width: CELL_SIZE * BOARD_SIZE, height: CELL_SIZE * BOARD_SIZE }}>
          <div className="grid grid-cols-9 absolute top-0 left-0">
            {Array(BOARD_SIZE).fill(0).map((_, row) =>
              Array(BOARD_SIZE).fill(0).map((_, col) => renderCell(row, col))
            )}
          </div>

          {renderWalls()}

          {actionPhase === 'wall' && !gameOver && !(mode === 'PvAI' && currentPlayer === 'P2') && (
            <>
              {validWalls.map((wall, index) => {
                const style: React.CSSProperties = {
                  position: 'absolute',
                  backgroundColor: '#00C853',
                  zIndex: 5,
                  opacity: 0.7,
                  cursor: 'pointer'
                };

                if (wall.type === 'horizontal') {
                  style.top = `${(wall.row + 1) * CELL_SIZE - WALL_THICKNESS}px`;
                  style.left = `${wall.col * CELL_SIZE}px`;
                  style.width = `${CELL_SIZE * 2 + WALL_THICKNESS}px`;
                  style.height = `${WALL_THICKNESS}px`;
                } else {
                  style.top = `${wall.row * CELL_SIZE}px`;
                  style.left = `${(wall.col + 1) * CELL_SIZE - WALL_THICKNESS}px`;
                  style.width = `${WALL_THICKNESS}px`;
                  style.height = `${CELL_SIZE * 2 + WALL_THICKNESS}px`;
                }

                return (
                  <div
                    key={`valid-wall-${index}`}
                    style={style}
                    onClick={() => handleWall(wall)}
                    className="hover:opacity-100 transition-opacity"
                  />
                );
              })}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 w-full">
          <button
            onClick={() => setShowTree(true)}
            className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm"
            disabled={isAiThinking}
          >
            Árvore
          </button>
          <button
            onClick={saveGame}
            className="bg-[#00C853] hover:bg-[#009624] px-3 py-1 rounded text-sm"
            disabled={isAiThinking}
          >
            Salvar
          </button>
          <button
            onClick={resetGame}
            className="bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded text-sm"
            disabled={isAiThinking}
          >
            Reiniciar
          </button>
          <button
            onClick={goToMainMenu}
            className="bg-[#FF6B6B] hover:bg-[#ff5252] px-3 py-1 rounded text-sm"
            disabled={isAiThinking}
          >
            Menu
          </button>
        </div>

        <div className="text-center">
          <p className="text-md">
            Vez do: <span className="font-bold text-[#0085EA]">{currentPlayer}</span>
            {isAiThinking && currentPlayer === 'P2' && (
              <span className="ml-2 text-yellow-400 animate-pulse"> (IA pensando...)</span>
            )}
          </p>
          <p className="text-xs">
            Muros restantes:
            <span className="text-[#0085EA]"> P1 ({remainingWalls.P1})</span> |
            <span className="text-[#FF6B6B]"> P2 ({remainingWalls.P2})</span>
          </p>

          {actionPhase === 'wall' && !gameOver && !(mode === 'PvAI' && currentPlayer === 'P2') && (
            <div className="mt-2">
              <p className="text-sm mb-1">
                <span className="font-semibold">Movimento pendente:</span> ({pendingMove?.row}, {pendingMove?.col})
              </p>
              <button
                onClick={endTurn}
                className="bg-[#0085EA] hover:bg-[#006fbd] px-3 py-1 rounded text-sm"
                disabled={!pendingMove || isAiThinking}
              >
                Não colocar parede
              </button>
            </div>
          )}
        </div>

        <ActionPanel />
      </div>

      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-[#00213A] p-6 rounded-lg text-center space-y-3">
            <h2 className="text-2xl font-bold text-[#00FF87]">
              Vitória do Jogador {winner}!
            </h2>
            <div className="flex justify-center space-x-3">
              <button
                onClick={resetGame}
                className="bg-[#0085EA] hover:bg-[#006fbd] px-4 py-2 rounded text-md font-semibold"
              >
                Jogar Novamente
              </button>
              <button
                onClick={goToMainMenu}
                className="bg-[#FF6B6B] hover:bg-[#ff5252] px-4 py-2 rounded text-md font-semibold"
              >
                Menu Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {showTree && <GameTreeViewer />}
    </div>
  );
}