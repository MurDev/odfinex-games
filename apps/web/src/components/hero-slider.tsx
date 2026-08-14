"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GameClient } from "@odfinex/shared";
import type { GameCopy, GameShot } from "@/lib/game-copy";

export interface HeroSliderGame {
  game: GameClient;
  copy: GameCopy;
}

interface HeroSliderProps {
  games: HeroSliderGame[];
}

const AUTOPLAY_MS = 6000;

const panelVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** No real screenshots yet — a deterministic CSS pattern stands in for `shot.src`. */
function GeneratedArt({ seed, compact = false }: { seed: string; compact?: boolean }) {
  const hash = hashSeed(seed);
  const variant = hash % 3;
  const rotate = (hash % 24) - 12;

  return (
    <span
      className={`hero-slider__art hero-slider__art--v${variant}${compact ? " hero-slider__art--compact" : ""}`}
      aria-hidden="true"
    >
      <span className="hero-slider__art-grid" />
      <span className="hero-slider__art-token" style={{ "--rotate": `${rotate}deg` } as CSSProperties} />
    </span>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M21.5 3.5 2.9 10.9c-1.2.5-1.2 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14c.3-1.3-.4-1.9-1.5-1.4Zm-3.4 3.4-9.5 8.6-.4 3.7-1.7-5.4L18.1 6.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function HeroSlider({ games }: HeroSliderProps) {
  const [activeGame, setActiveGame] = useState(0);
  const [activeShot, setActiveShot] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const count = games.length;

  useEffect(() => {
    setActiveShot(0);
  }, [activeGame]);

  useEffect(() => {
    if (count <= 1 || paused || reduceMotion) return;
    const id = setTimeout(() => setActiveGame((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [activeGame, paused, count, reduceMotion]);

  if (count === 0) return null;

  const current = games[activeGame]!;
  const { game, copy } = current;
  const shot: GameShot = copy.gallery[activeShot] ?? copy.gallery[0]!;

  return (
    <div
      className="hero-slider"
      style={{ "--accent": copy.accent, "--glow": copy.glow } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="eyebrow hero-slider__eyebrow">Jeux en vedette</p>

      <div className="hero-slider__grid">
        <div className="hero-slider__stage">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${game.clientId}-${shot.id}`}
              className="hero-slider__frame"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              {shot.src ? (
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  fill
                  sizes="(max-width: 820px) 100vw, 55vw"
                  className="hero-slider__image"
                  priority={activeGame === 0}
                />
              ) : (
                <GeneratedArt seed={shot.id} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hero-slider__panel">
          <AnimatePresence mode="wait">
            <motion.div
              key={game.clientId}
              className="hero-slider__copy"
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit={reduceMotion ? undefined : "hidden"}
              variants={panelVariants}
            >
              <motion.span className="pill pill--live hero-slider__badge" variants={itemVariants}>
                {copy.badge}
              </motion.span>
              <motion.h2 variants={itemVariants}>{game.name}</motion.h2>
              <motion.p className="hero-slider__meta" variants={itemVariants}>
                {copy.category} · {copy.players} · {copy.pace}
              </motion.p>
              <motion.p className="hero-slider__description" variants={itemVariants}>
                {copy.description}
              </motion.p>
              <motion.div className="hero-slider__actions" variants={itemVariants}>
                <Link className="button button--primary" href={`/launch/${encodeURIComponent(game.clientId)}`}>
                  Jouer
                </Link>
                <span className="pill pill--live">Disponible</span>
                {copy.links?.telegram && (
                  <a
                    className="hero-slider__link"
                    href={copy.links.telegram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${game.name} sur Telegram`}
                  >
                    <TelegramIcon />
                  </a>
                )}
                {copy.links?.website && (
                  <a
                    className="hero-slider__link"
                    href={copy.links.website}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Site web de ${game.name}`}
                  >
                    <GlobeIcon />
                  </a>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="hero-slider__thumbs" role="tablist" aria-label={`Images de ${game.name}`}>
            {copy.gallery.map((shotItem, index) => (
              <button
                key={shotItem.id}
                type="button"
                role="tab"
                aria-selected={index === activeShot}
                aria-label={shotItem.alt}
                className={`hero-slider__thumb${index === activeShot ? " hero-slider__thumb--active" : ""}`}
                onClick={() => setActiveShot(index)}
              >
                {shotItem.src ? (
                  <Image src={shotItem.src} alt={shotItem.alt} fill sizes="120px" className="hero-slider__image" />
                ) : (
                  <GeneratedArt seed={shotItem.id} compact />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {count > 1 && (
        <div className="hero-slider__progress" role="tablist" aria-label="Jeux en vedette">
          {games.map((entry, index) => {
            const state = index < activeGame ? "complete" : index === activeGame ? "active" : "upcoming";
            return (
              <button
                key={entry.game.clientId}
                type="button"
                role="tab"
                aria-selected={index === activeGame}
                aria-label={entry.game.name}
                className="hero-slider__segment"
                onClick={() => setActiveGame(index)}
              >
                <span className="hero-slider__segment-track">
                  <span
                    key={state === "active" ? activeGame : undefined}
                    className={`hero-slider__segment-fill hero-slider__segment-fill--${state}`}
                    style={
                      state === "active" && !reduceMotion
                        ? ({ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" } as CSSProperties)
                        : undefined
                    }
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
