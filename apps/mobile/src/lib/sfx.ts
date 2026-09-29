import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSession } from './store/session';

/**
 * Sound vocabulary of the game, next to the haptic one (lib/haptics.ts).
 * The samples are synthesised by scripts/generate-sounds.mjs.
 * Players are created lazily and reused; everything is a no-op when sounds are
 * disabled in the profile, and audio failures never reach the UI.
 */
const SOURCES = {
  lot_open: require('../../assets/sounds/lot_open.wav'),
  bid: require('../../assets/sounds/bid.wav'),
  bid_mine: require('../../assets/sounds/bid_mine.wav'),
  outbid: require('../../assets/sounds/outbid.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  sold: require('../../assets/sounds/sold.wav'),
  sold_mine: require('../../assets/sounds/sold_mine.wav'),
  unsold: require('../../assets/sounds/unsold.wav'),
  whistle: require('../../assets/sounds/whistle.wav'),
  whistle_end: require('../../assets/sounds/whistle_end.wav'),
  goal: require('../../assets/sounds/goal.wav'),
  chance: require('../../assets/sounds/chance.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  post: require('../../assets/sounds/post.wav'),
  card: require('../../assets/sounds/card.wav'),
  crowd_loop: require('../../assets/sounds/crowd_loop.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const VOLUME: Partial<Record<SoundName, number>> = { tick: 0.55, bid: 0.7, chance: 0.8, miss: 0.8, crowd_loop: 0.22 };

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

const enabled = () => useSession.getState().soundEnabled;

function player(name: SoundName): AudioPlayer | null {
  try {
    if (!modeSet) {
      modeSet = true;
      // short effects: play with the silent switch on and never stop the user's music
      void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name] ?? 1;
      players.set(name, p);
    }
    return p;
  } catch {
    return null;
  }
}

function play(name: SoundName): void {
  if (!enabled()) return;
  const p = player(name);
  if (!p) return;
  try {
    void p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // audio is decoration: ignore
  }
}

export const sfx = {
  play,
  /** stadium ambience under the live match */
  crowd(on: boolean) {
    const p = on && enabled() ? player('crowd_loop') : players.get('crowd_loop');
    if (!p) return;
    try {
      if (on && enabled()) {
        p.loop = true;
        p.play();
      } else p.pause();
    } catch {
      // ignore
    }
  },
  /** silence everything that is playing (sounds turned off, screen left…) */
  stopAll() {
    for (const p of players.values()) {
      try {
        p.pause();
      } catch {
        // ignore
      }
    }
  },
};
