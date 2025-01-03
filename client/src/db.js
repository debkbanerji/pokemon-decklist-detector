// indexed db -browser storage

import Dexie from 'dexie';

export const db = new Dexie('myDatabase');
db.version(1).stores({
    decklists: '++createdTimestamp' // Primary key is the created timestamp
});