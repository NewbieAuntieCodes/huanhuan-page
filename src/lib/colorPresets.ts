import { PresetColor } from '../types';

const presetNames = [
  // Row 1: Female Leads & Young Roles
  '女一', '女二', '女三', '女四', '青年女一', '青年女二', '青年男一', '青年男二',
  // Row 2: Mid-age Roles & Misc
  '中年女一', '中年女二', '中年女三', '中年男一', '中年男二', '中年男三', '老年女', '老年男',
  // Row 3: Teen/Child Roles & Misc
  '少女', '少年', '女童', '男童', '旁白一', '旁白二', '旁白三', '旁白四',
  // Row 4: Supporting Roles & Misc
  '龙套女一', '龙套女二', '龙套男一', '龙套男二', '音效', 'OS', '系统', 'AI',
];

// Palette for CV Presets
const cvColorPalette: Omit<PresetColor, 'name'>[] = [
  // Row 1: Bright colors with black text
  { bgColorClass: 'bg-red-400', textColorClass: 'text-black' },
  { bgColorClass: 'bg-orange-400', textColorClass: 'text-black' },
  { bgColorClass: 'bg-yellow-300', textColorClass: 'text-black' },
  { bgColorClass: 'bg-lime-400', textColorClass: 'text-black' },
  { bgColorClass: 'bg-cyan-400', textColorClass: 'text-black' },
  { bgColorClass: 'bg-sky-400', textColorClass: 'text-black' },
  { bgColorClass: 'bg-violet-400', textColorClass: 'text-black' },
  { bgColorClass: 'bg-pink-400', textColorClass: 'text-black' },

  // Row 2: Darker colors with white text
  { bgColorClass: 'bg-red-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-orange-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-yellow-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-lime-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-cyan-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-blue-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-violet-700', textColorClass: 'text-white' },
  { bgColorClass: 'bg-pink-700', textColorClass: 'text-white' },
];

// Palette for Character Presets - distinct variations from the CV palette
const characterColorPalette: Omit<PresetColor, 'name'>[] = [
  // Row 1: Bright colors with black text, variations from CV palette
  { bgColorClass: 'bg-rose-400', textColorClass: 'text-black' },    // from red-400
  { bgColorClass: 'bg-orange-300', textColorClass: 'text-black' },   // from orange-400
  { bgColorClass: 'bg-yellow-200', textColorClass: 'text-black' },   // from yellow-300
  { bgColorClass: 'bg-green-400', textColorClass: 'text-black' },     // from lime-400
  { bgColorClass: 'bg-teal-400', textColorClass: 'text-black' },      // from cyan-400
  { bgColorClass: 'bg-blue-400', textColorClass: 'text-black' },       // from sky-400
  { bgColorClass: 'bg-purple-400', textColorClass: 'text-black' },   // from violet-400
  { bgColorClass: 'bg-fuchsia-400', textColorClass: 'text-black' }, // from pink-400

  // Row 2: Darker colors with white text, variations from CV palette
  { bgColorClass: 'bg-red-800', textColorClass: 'text-white' },       // from red-700
  { bgColorClass: 'bg-amber-800', textColorClass: 'text-white' },    // from orange-700
  { bgColorClass: 'bg-yellow-800', textColorClass: 'text-white' },   // from yellow-700
  { bgColorClass: 'bg-lime-800', textColorClass: 'text-white' },     // from lime-700
  { bgColorClass: 'bg-cyan-800', textColorClass: 'text-white' },      // from cyan-700
  { bgColorClass: 'bg-blue-800', textColorClass: 'text-white' },       // from blue-700
  { bgColorClass: 'bg-violet-800', textColorClass: 'text-white' },   // from violet-700
  { bgColorClass: 'bg-rose-800', textColorClass: 'text-white' },     // from pink-700
];


// 2x8 grid = 16 colors for CV Presets.
export const defaultCvPresetColors: PresetColor[] = cvColorPalette.map((preset, index) => ({
  ...preset,
  name: presetNames[index] || `Preset ${index + 1}`,
}));

// 2x8 grid = 16 colors for Character Presets, using the distinct character palette.
export const defaultCharacterPresetColors: PresetColor[] = characterColorPalette.map((preset, index) => ({
  ...preset,
  name: presetNames[index] || `Preset ${index + 1}`, // Names can be the same, just colors differ
}));