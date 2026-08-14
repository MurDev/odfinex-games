export interface GameShot {
  id: string;
  alt: string;
  /** Absent today (no real screenshots yet) -> the hero renders a generated CSS pattern. */
  src?: string;
}

export interface GameCopy {
  /** Short text used by the existing catalogue cards. */
  blurb: string;
  /** Longer text used by the hero slider's text panel. */
  description: string;
  accent: string;
  glow: string;
  category: string;
  players: string;
  pace: string;
  badge: string;
  /** gallery[0] is the featured image; the rest populate the thumbnail strip. */
  gallery: GameShot[];
  links?: { telegram?: string; website?: string };
}

export const GAME_COPY: Record<string, GameCopy> = {
  "duelpion.live": {
    blurb: "Duels de pions rapides avec une lecture tactique claire, entre Morpion et Gomoku.",
    description:
      "DUELPION oppose deux joueurs sur une grille tactique : chaque coup compte, chaque ligne peut basculer la partie. Un format 1v1 rapide, pense pour enchainer les manches et grimper au classement.",
    accent: "#16d7ff",
    glow: "#1746ff",
    category: "Stratégie",
    players: "1v1",
    pace: "Rapide",
    badge: "Hot pick",
    gallery: [
      { id: "duelpion-board", alt: "Plateau de jeu DUELPION" },
      { id: "duelpion-victory", alt: "Ecran de victoire" },
      { id: "duelpion-leaderboard", alt: "Classement des joueurs" },
      { id: "duelpion-training", alt: "Mode entrainement" },
    ],
  },
  "ludolakay.live": {
    blurb: "Ludo multijoueur en temps reel avec mises en HTG, parties 2 a 4 joueurs et classement hebdomadaire.",
    description:
      "LUDOLAKAY reinvente le Ludo classique en multijoueur temps reel : creez une salle ou rejoignez un defi, misez en HTG et grimpez au classement hebdomadaire. Reconnexion automatique et parties contre l'IA disponibles a tout moment.",
    accent: "#ffd43b",
    glow: "#ff6b5f",
    category: "Plateau",
    players: "2-4",
    pace: "Standard",
    badge: "Gains reels",
    gallery: [
      { id: "ludolakay-board", alt: "Plateau de jeu Ludo" },
      { id: "ludolakay-waiting-room", alt: "Salle d'attente multijoueur" },
      { id: "ludolakay-victory", alt: "Ecran de victoire" },
      { id: "ludolakay-leaderboard", alt: "Classement hebdomadaire" },
    ],
  },
};

export const FALLBACK_COPY: GameCopy = {
  blurb: "Jeu connecte a Odfinex Games avec authentification et wallet unifies.",
  description:
    "Jeu connecte a Odfinex Games avec authentification et wallet unifies. Lancez une partie en un clic et retrouvez votre solde dans le meme compte.",
  accent: "#ffd43b",
  glow: "#7c5cff",
  category: "Arcade",
  players: "Multi",
  pace: "Standard",
  badge: "Nouveau",
  gallery: [
    { id: "fallback-1", alt: "Apercu du jeu 1" },
    { id: "fallback-2", alt: "Apercu du jeu 2" },
    { id: "fallback-3", alt: "Apercu du jeu 3" },
  ],
};

export function getGameCopy(clientId: string): GameCopy {
  return GAME_COPY[clientId] ?? FALLBACK_COPY;
}
