"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { GameClient } from "@odfinex/shared";
import { getGameVisual } from "@/lib/game-visuals";

interface GameGridProps {
  games: GameClient[];
  webUrl: string;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function patternVariant(category: string, hash: number): number {
  if (category === "Stratégie") return 0;
  if (category === "Plateau") return 1;
  return hash % 3;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M6 4.5v15l14-7.5-14-7.5Z" fill="currentColor" />
    </svg>
  );
}

function GameTile({ game, webUrl, index }: { game: GameClient; webUrl: string; index: number }) {
  const visual = getGameVisual(game.clientId);
  const hash = hashSeed(game.clientId);
  const rotate = (hash % 16) - 8;
  const variant = patternVariant(visual.category, hash);
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      className="game-card"
      href={`${webUrl}/launch/${encodeURIComponent(game.clientId)}?src=play`}
      style={
        {
          "--accent": visual.accent,
          "--glow": visual.glow,
        } as CSSProperties
      }
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: "easeOut", delay: reduceMotion ? 0 : index * 0.05 }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    >
      <span className={`game-card__art game-card__art--v${variant}`} aria-hidden="true">
        <span className="game-card__art-pattern" />
        <span className="game-card__art-shine" />
        <span className="game-card__art-emblem" style={{ "--rotate": `${rotate}deg` } as CSSProperties}>
          {initialsFor(game.name)}
        </span>
      </span>

      <span className="game-card__badge">{visual.badge}</span>

      <span className="game-card__scrim" />

      <span className="game-card__body">
        <span className="game-card__name">{game.name}</span>
        <span className="game-card__meta">
          {visual.category} · {visual.players}
        </span>
      </span>

      <span className="game-card__cta">
        Jouer
        <PlayIcon />
      </span>
    </motion.a>
  );
}

export function GameGrid({ games, webUrl }: GameGridProps) {
  return (
    <div className="play-grid">
      {games.map((game, index) => (
        <GameTile key={game.clientId} game={game} webUrl={webUrl} index={index} />
      ))}
    </div>
  );
}
