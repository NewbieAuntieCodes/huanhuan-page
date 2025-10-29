// FIX: The subclassing pattern `class MyDb extends Dexie` was causing TypeScript
// errors where methods like .version() or .transaction() were not found.
// This was likely due to a module resolution or type inference issue with class extension.
// Switched to the direct instantiation pattern with casting, which is a robust alternative.
import Dexie, { type Table } from 'dexie';
import { Project, Character, MergeHistoryEntry, AudioBlob, AudioAssistantState, DirectoryHandleEntry } from './types';
// Fix: Import from types.ts to break circular dependency with App.tsx -> useStore.ts -> db.ts cycle
import { CVStylesMap } from './types';

// Define a type for the 'misc' table for key-value storage
export interface MiscData {
  key: string;
  value: any;
}

// 1. Define an interface representing the database shape.
interface IAudioCreatorDB {
  projects: Table<Project, string>;
  characters: Table<Character, string>;
  misc: Table<MiscData, string>;
  audioBlobs: Table<AudioBlob, string>;
  assistantState: Table<AudioAssistantState, string>;
  directoryHandles: Table<DirectoryHandleEntry, string>;
}

// 2. Create and cast an instance of Dexie. This ensures the `db` object
// is correctly typed with both Dexie's methods and the table definitions.
const db = new Dexie('audioCreatorDB') as Dexie & IAudioCreatorDB;

// 3. Define the database schema.
db.version(1).stores({
  projects: 'id, lastModified', // Primary key 'id', index 'lastModified' for sorting
  characters: 'id', // Primary key 'id'
  misc: 'key', // Primary key 'key' for key-value pairs
});

db.version(2).stores({
  projects: 'id, lastModified',
  characters: 'id, projectId', // Added projectId for indexing
  misc: 'key',
  audioBlobs: 'id, lineId', // Added table for audio blobs, indexed by lineId
});

db.version(3).stores({
  projects: 'id, lastModified',
  characters: 'id, projectId',
  misc: 'key',
  audioBlobs: 'id, lineId',
  assistantState: 'projectId', // Keyed by project ID
});

db.version(4).stores({
  projects: 'id, lastModified',
  characters: 'id, projectId',
  misc: 'key',
  audioBlobs: 'id, lineId',
  assistantState: 'projectId',
});

db.version(5).stores({
  projects: 'id, lastModified',
  characters: 'id, projectId',
  misc: 'key',
  audioBlobs: 'id, lineId',
  assistantState: 'projectId',
  directoryHandles: 'projectId',
});


export { db };
