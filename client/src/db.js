// indexed db -browser storage

import Dexie from 'dexie';

export const db = new Dexie('myDatabase');
db.version(1).stores({
    decklists: '++createdTimestamp, successorCreatedTimestamp', // Primary key is the created timestamp
    players: '++playerName, lastUsedTimestamp', // Primary key is the player name
});