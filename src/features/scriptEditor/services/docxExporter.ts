import mammoth from 'mammoth';
import { Chapter, Character, Project } from '../../../types';
import { isHexColor, getContrastingTextColor } from '../../../lib/colorUtils';
import { tailwindToHex } from '../../../lib/tailwindColorMap';

// --- Helper Functions for Chapter Number Parsing ---

const chineseToArabic = (numStr: string): number | null => {
    const map: { [key: string]: number } = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units: { [key: string]: { val: number, sec: boolean } } = { '十': { val: 10, sec: false }, '百': { val: 100, sec: false }, '千': { val: 1000, sec: false }, '万': { val: 10000, sec: true }, '亿': { val: 100000000, sec: true } };
    let result = 0, section = 0, number = 0, secUnit = false;
    for (const char of numStr) {
        if (map[char] !== undefined) {
            number = map[char];
        } else if (units[char] !== undefined) {
            if (units[char].sec) {
                section = (section + number) * units[char].val;
                result += section;
                section = 0;
                secUnit = true;
            } else {
                 section += (number || 1) * units[char].val;
            }
            number = 0;
        }
    }
    if (!secUnit) result += section;
    result += number;
    return result > 0 ? result : null;
};

const getChapterNumber = (title: string): number | null => {
    if (!title) return null;
    const match = title.match(/(?:Chapter|第)\s*([一二三四五六七八九十百千万零\d]+)/i);
    if (match?.[1]) {
        const numPart = match[1];
        return /^\d+$/.test(numPart) ? parseInt(numPart, 10) : chineseToArabic(numPart);
    }
    return null;
};

// --- Export Options Interface ---

export interface ExportOptions {
  project: Project;
  chaptersToExport: Chapter[];
  characters: Character[];
}

// --- Main Export Service Function ---

export const exportChaptersToDocx = async ({
  project,
  chaptersToExport,
  characters,
}: ExportOptions): Promise<void> => {
  if (chaptersToExport.length === 0) {
    alert("没有可导出的章节。");
    return;
  }

  // 1. Generate Filename
  const chapterNumbers = chaptersToExport
    .map(ch => getChapterNumber(ch.title))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const formatNum = (n: number) => n.toString().padStart(3, '0');
  let exportFilename = `${project.name}_画本.docx`;

  if (chapterNumbers.length > 0) {
    if (chapterNumbers.length === 1) {
      exportFilename = `${project.name}_画本_${formatNum(chapterNumbers[0])}章.docx`;
    } else {
      const startNum = formatNum(chapterNumbers[0]);
      const endNum = formatNum(chapterNumbers[chapterNumbers.length - 1]);
      exportFilename = `${project.name}_画本_${startNum}-${endNum}章.docx`;
    }
  } else if (chaptersToExport.length > 0) {
    if (chaptersToExport.length === 1) {
      exportFilename = `${project.name}_画本_${chaptersToExport[0].title}.docx`;
    } else {
      exportFilename = `${project.name}_画本_${chaptersToExport.length}章.docx`;
    }
  }
  
  // 2. Prepare Character Data and Descriptions
  const characterMap = new Map(characters.map(c => [c.id, c]));
  const getColorAsHex = (colorValue: string | undefined, fallback: string): string => {
    if (!colorValue) return fallback;
    if (isHexColor(colorValue)) return colorValue;
    return tailwindToHex[colorValue] || fallback;
  };

  const characterIdsInExport = new Set<string>();
  chaptersToExport.forEach(chapter => {
    chapter.scriptLines.forEach(line => {
      if (line.characterId) characterIdsInExport.add(line.characterId);
    });
  });

  const charactersToDescribe = Array.from(characterIdsInExport)
    .map(id => characterMap.get(id))
    .filter((char): char is Character => !!char && !!char.description && char.name !== 'Narrator' && char.name !== '[静音]');

  let characterDescriptionHtml = '';
  if (charactersToDescribe.length > 0) {
    characterDescriptionHtml = `
      <h2 style="text-align: center; font-size: 18pt; margin-bottom: 1em;">主要角色介绍</h2>
      <div style="margin-bottom: 2em; font-size: 11pt; line-height: 1.6;">
        ${charactersToDescribe.map(char => {
          const bgColor = getColorAsHex(char.color, '#334155');
          const textColor = char.textColor ? getColorAsHex(char.textColor, '#f1f5f9') : getContrastingTextColor(bgColor);
          return `
            <p style="margin-bottom: 10px;">
              <strong style="background-color: ${bgColor}; color: ${textColor}; padding: 2px 6px; border-radius: 4px; font-family: 'SimHei', '黑体', sans-serif;">
                【${char.name}】
              </strong>：${char.description}
            </p>
          `;
        }).join('')}
      </div>
    `;
  }

  // 3. Generate HTML Content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${project.name}</title>
        <style>
            body { font-family: 'SimSun', '宋体', serif; font-size: 12pt; }
            h1 { font-size: 22pt; font-weight: bold; text-align: center; }
            h2 { font-size: 16pt; font-weight: bold; margin-top: 2em; margin-bottom: 1em; }
            .line { margin-bottom: 12px; line-height: 1.5; }
            .dialogue-line { display: inline-block; padding: 2px 8px; border-radius: 4px; font-family: 'SimHei', '黑体', sans-serif; }
        </style>
    </head>
    <body>
        <h1>${project.name}</h1>
        ${characterDescriptionHtml}
        ${chaptersToExport.map(chapter => `
            <h2>${chapter.title}</h2>
            <div>
                ${chapter.scriptLines.map(line => {
                    const character = line.characterId ? characterMap.get(line.characterId) : null;
                    const isNarrator = !character || character.name.toLowerCase() === 'narrator';

                    if (isNarrator) {
                        return `<div class="line">${line.text.replace(/\n/g, '<br>')}</div>`;
                    }
                    
                    const speakerTag = character.cvName ? `【${character.cvName}-${character.name}】` : `【${character.name}】`;
                    const bgColor = getColorAsHex(character?.color, '#334155');
                    const textColor = character?.textColor ? getColorAsHex(character.textColor, '#f1f5f9') : getContrastingTextColor(bgColor);
                    
                    return `
                        <div class="line">
                            <span class="dialogue-line" style="background-color: ${bgColor}; color: ${textColor};">
                                ${speakerTag}${line.text}
                            </span>
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('')}
    </body>
    </html>
  `;

  // 4. Create Blob and Trigger Download
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFilename.replace(/[<>:"/\\|?*]+/g, '_');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};