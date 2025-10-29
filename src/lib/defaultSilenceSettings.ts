import { SilenceSettings } from '../types';

export const defaultSilenceSettings: SilenceSettings = {
  startPadding: 1.0,
  endPadding: 1.0,
  pairs: {
    'narration-to-narration': 1.2,
    'narration-to-dialogue': 1.2,
    'narration-to-sfx': 0.6,
    'dialogue-to-dialogue': 1.1,
    'dialogue-to-narration': 1.3,
    'dialogue-to-sfx': 0.7,
    'sfx-to-dialogue': 0.7,
    'sfx-to-narration': 0.7,
    'sfx-to-sfx': 0.7,
  },
};
