export interface GameVisual {
  accent: string;
  glow: string;
  category: string;
  players: string;
  badge: string;
  /** Artwork reel (public/games/*) ; a defaut, la card utilise un motif genere. */
  image?: string;
}

/** Meme categories/couleurs que apps/web (src/lib/game-copy.ts) pour une identite coherente entre les deux apps. */
export const GAME_VISUALS: Record<string, GameVisual> = {
  "duelpion.live": {
    accent: "#16d7ff",
    glow: "#1746ff",
    category: "Stratégie",
    players: "1v1",
    badge: "Hot pick",
    image: "/games/duelpion.png",
  },
  "ludolakay.live": {
    accent: "#ffd43b",
    glow: "#ff6b5f",
    category: "Plateau",
    players: "2-4",
    badge: "Gains reels",
    image: "/games/ludolakay.png",
  },
  "dominotactics.live": {
    accent: "#8b6cff",
    glow: "#e8c468",
    category: "Domino",
    players: "1v1",
    badge: "Gains reels",
    image: "/games/dominotactics.png",
  },
};

export const FALLBACK_VISUAL: GameVisual = {
  accent: "#ffd43b",
  glow: "#7c5cff",
  category: "Arcade",
  players: "Multi",
  badge: "Nouveau",
};

export function getGameVisual(clientId: string): GameVisual {
  return GAME_VISUALS[clientId] ?? FALLBACK_VISUAL;
}
