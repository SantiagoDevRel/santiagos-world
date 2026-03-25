import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface CheckIn {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  continent: 'Europe' | 'Africa' | 'LATAM' | 'Asia' | 'North America' | 'Oceania' | 'Other';
  address: string;
  note: string;
  tags: string[];
  rating: number | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface SantiagosWorldDB extends DBSchema {
  checkins: {
    key: string;
    value: CheckIn;
    indexes: {
      'by-date': string;
      'by-country': string;
      'by-continent': string;
    };
  };
  chat: {
    key: string;
    value: ChatMessage;
    indexes: {
      'by-date': string;
    };
  };
}

/**
 * Current schema version. Bump this when adding stores or indexes.
 *
 * Version history:
 *   1 - Initial: checkins + chat stores
 *   (future) 2 - e.g. chat-sessions, agent-data, user-preferences
 */
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SantiagosWorldDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SantiagosWorldDB>('santiagos-world', DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, _transaction) {
        // Run migrations incrementally from whatever old version the user had
        if (oldVersion < 1) {
          const checkinStore = db.createObjectStore('checkins', { keyPath: 'id' });
          checkinStore.createIndex('by-date', 'created_at');
          checkinStore.createIndex('by-country', 'country');
          checkinStore.createIndex('by-continent', 'continent');

          const chatStore = db.createObjectStore('chat', { keyPath: 'id' });
          chatStore.createIndex('by-date', 'created_at');
        }

        // Future migrations go here:
        // if (oldVersion < 2) {
        //   db.createObjectStore('chat-sessions', { keyPath: 'id' });
        //   db.createObjectStore('agent-data', { keyPath: 'id' });
        //   db.createObjectStore('user-preferences', { keyPath: 'key' });
        // }
      },
    });
  }
  return dbPromise;
}

// Check-in operations
export async function addCheckIn(checkin: CheckIn): Promise<void> {
  const db = await getDB();
  await db.put('checkins', checkin);
}

export async function getAllCheckIns(): Promise<CheckIn[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('checkins', 'by-date');
  return all.reverse(); // newest first
}

export async function getCheckInsByCountry(country: string): Promise<CheckIn[]> {
  const db = await getDB();
  return db.getAllFromIndex('checkins', 'by-country', country);
}

export async function getCheckInsByContinent(continent: string): Promise<CheckIn[]> {
  const db = await getDB();
  return db.getAllFromIndex('checkins', 'by-continent', continent);
}

export async function deleteCheckIn(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('checkins', id);
}

// Chat operations
export async function addChatMessage(message: ChatMessage): Promise<void> {
  const db = await getDB();
  await db.put('chat', message);
}

export async function getAllChatMessages(): Promise<ChatMessage[]> {
  const db = await getDB();
  return db.getAllFromIndex('chat', 'by-date');
}

export async function clearChat(): Promise<void> {
  const db = await getDB();
  await db.clear('chat');
}
