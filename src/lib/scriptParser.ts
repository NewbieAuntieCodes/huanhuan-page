
import { Chapter } from '../types';

export const internalParseScriptToChapters = (scriptText: string, bookName: string): Chapter[] => {
  const chapters: Chapter[] = [];
  if (!scriptText || scriptText.trim() === "") return [];

  const lines = scriptText.split(/\r?\n/);
  // More robust regex for chapter titles, including common Chinese patterns
  const chapterTitleLineRegex = /^(?:##\d+\s*\.\s*)?(Chapter\s+\d+|Part\s+\d+|第\s*[一二三四五六七八九十百千万零\d]+\s*[章章节回卷篇部]|楔子|序章|引子|尾声|Prologue|Epilogue|前言|后记)/i;

  let currentChapterTitleCandidate: string | null = null;
  let currentChapterContent: string[] = [];
  let chapterIdCounter = 0;

  const saveCurrentChapter = (isEndOfFile: boolean = false) => {
    const content = currentChapterContent.join('\n').trim();
    let titleToSave = "Untitled Chapter";

    if (currentChapterTitleCandidate) {
      // Remove potential list-like prefixes (e.g., "##1. ")
      titleToSave = currentChapterTitleCandidate.replace(/^##\d+\s*\.\s*/, '').trim();
      // Remove trailing (number) or （number） for chapter titles
      titleToSave = titleToSave.replace(/\s*[（(]\d+[）)]$/, '').trim();
    } else if (chapters.length === 0) { 
      // If no explicit title found for the first block
      titleToSave = isEndOfFile ? (bookName.replace(/\.txt$/i, '') || "Full Script") : "Prologue / Introduction";
    }

    const hasContent = content.length > 0;
    const hasExplicitTitle = currentChapterTitleCandidate !== null;
    // Check if this is the only block of text in the entire file, if so, treat it as a chapter
    const isOnlyBlockInFile = chapters.length === 0 && isEndOfFile;


    if (hasContent || hasExplicitTitle || isOnlyBlockInFile) {
      chapters.push({
        id: Date.now().toString() + "_ch_" + chapterIdCounter++,
        title: titleToSave,
        rawContent: content,
        scriptLines: [],
      });
    }
    currentChapterContent = []; 
    currentChapterTitleCandidate = null; 
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (chapterTitleLineRegex.test(trimmedLine)) { 
      // If current content or a title candidate exists, save it as a chapter
      if (currentChapterTitleCandidate || currentChapterContent.length > 0) {
        saveCurrentChapter();
      }
      currentChapterTitleCandidate = trimmedLine; // This line IS the title
    } else {
      currentChapterContent.push(line); // Collect content lines
    }
  }

  // Save the last collected chapter content
  saveCurrentChapter(true); 
  
  // If only one chapter was parsed and it has a generic title, use the book name.
  if (chapters.length === 1 && chapters[0].title === "Prologue / Introduction" && (bookName && bookName.replace(/\.txt$/i, ''))) {
      chapters[0].title = bookName.replace(/\.txt$/i, '') || "Full Script";
  }
  
  // Filter out chapters that might have ended up empty and have generic titles
  return chapters.filter(ch => ch.rawContent.trim() !== "" || (ch.title !== "Untitled Chapter" && ch.title !== "Prologue / Introduction"));
};