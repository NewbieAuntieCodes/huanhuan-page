export interface Collaborator {
  id: string;
  username: string;
  role: 'reader' | 'editor';
}

export interface Character {
  id: string;
  name: string;
  projectId?: string; // To scope characters to a project
  color: string; // Character background: Tailwind color class (e.g., 'bg-blue-500') or hex code (e.g., '#3b82f6')
  textColor?: string; // Character text color: Tailwind color class or hex code
  cvName?: string;
  description?: string;
  cvBackgroundColor?: string; // CV background: Tailwind CSS class or hex code
  cvTextColor?: string;     // CV text color: Tailwind CSS class or hex code
  aiVoicePreset?: string; // Future use
  isStyleLockedToCv?: boolean; // If true, this character's style is individually locked and should not be changed by a CV-level "Unify Styles" action.
  status?: 'active' | 'merged'; // For soft deletion/merging
  mergedIntoCharacterId?: string; // If status is 'merged'
}

export interface ScriptLine {
  id: string;
  text: string;
  originalText?: string; // To track if AI annotation changed it
  characterId?: string;
  audioBlobId?: string; // Path to AI-generated audio
  isAiAudioLoading: boolean;
  isAiAudioSynced: boolean; // True if current text matches generated/assigned audio
  isTextModifiedManual: boolean; // True if user manually edited text after initial load/AI annotation
  soundType?: string; // Off-screen / Off-stage sound type (e.g., 'OS', '电话音')
  isMarkedForReturn?: boolean;
  feedback?: string;
  postSilence?: number; // Override for silence after this line, in seconds
}

export interface Chapter {
  id: string;
  title: string;
  rawContent: string; // Full raw text of the chapter
  scriptLines: ScriptLine[];
}

export type ProjectStatus = "in-progress" | "completed";
export type MainCategory = string; // Changed from "male" | "female" | "custom"

export type LineType = 'narration' | 'dialogue' | 'sfx';

export type SilencePairing = `${LineType}-to-${LineType}`;

export interface SilenceSettings {
  startPadding: number;
  endPadding: number;
  pairs: Record<SilencePairing, number>;
}

export interface Project {
  id: string;
  name: string; // Book name
  rawFullScript?: string; // Full raw text of the uploaded script
  chapters: Chapter[];
  status: ProjectStatus;
  mainCategory: MainCategory;
  subCategory: string; // Can be predefined or custom
  collaborators?: Collaborator[];
  lastModified: number; // Timestamp for sorting
  cvStyles?: CVStylesMap;
  customSoundTypes?: string[];
  lastViewedChapterId?: string;
  silenceSettings?: SilenceSettings;
}

// For Gemini service response parsing
export interface AiAnnotatedLine {
  line_text: string;
  suggested_character_name: string;
}

// For storing audio data
export interface AudioBlob {
  id: string;
  lineId: string;
  data: Blob;
}

// For Editor Page UI State
export type CharacterFilterMode = 'currentChapter' | 'all';

// For Character Merge History
export interface ProjectLineReassignment {
  lineId: string;
  originalCharacterId: string; // The characterId before merge (one of the sourceCharacterIds)
}
export interface MergeHistoryEntry {
  id: string; // Unique ID for this merge event
  mergedAt: number; // Timestamp of the merge
  sourceCharacters: Character[]; // Full data of characters that were merged (and removed/marked)
  targetCharacterId: string; // ID of the character that received the lines
  projectLineReassignments: Record<string, ProjectLineReassignment[]>; // Key: projectId, Value: list of line reassignments
}

// Fix: Moved from App.tsx to break circular dependencies
export type AppView = "upload" | "dashboard" | "editor" | "audioAlignment" | "cvManagement" | "voiceLibrary" | "audioAlignmentAssistant";

export interface CVStyle {
  bgColor: string;
  textColor: string;
}
export type CVStylesMap = Record<string, CVStyle>;

// Definition for editable color presets
export interface PresetColor {
  name: string;
  bgColorClass: string;
  textColorClass: string;
}

export interface ParsedFileInfo {
  chapters: number[];
  characterName: string | null;
  cvName: string | null;
}

export interface AudioAssistantState {
  projectId: string;
  directoryName: string | null;
  scannedFiles: ParsedFileInfo[];
  manualOverrides: Record<string, boolean>;
}

export interface DirectoryHandleEntry {
  projectId: string;
  handle: FileSystemDirectoryHandle;
}