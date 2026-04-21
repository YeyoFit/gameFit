import fs from 'fs';
import path from 'path';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { SCRAPED_EXERCISES } from '../lib/scrapedExercises';

// 1. Manually load environment variables from .env.local
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf-8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                process.env[key] = value;
            }
        });
        console.log('Loaded .env.local');
    } else {
        console.warn('.env.local not found');
    }
} catch (e) {
    console.error('Error loading .env.local', e);
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function syncExercises() {
    console.log(`Starting sync of ${SCRAPED_EXERCISES.length} exercises to Firestore...`);

    const exercisesRef = collection(db, 'exercises');
    const querySnapshot = await getDocs(exercisesRef);
    const existingNames = new Set<string>();
    querySnapshot.forEach((doc) => {
        existingNames.add(doc.data().name.toLowerCase());
    });

    const newExercises = SCRAPED_EXERCISES.filter(ex => !existingNames.has(ex.name.toLowerCase()));

    if (newExercises.length === 0) {
        console.log("All exercises are already in the database.");
        return;
    }

    console.log(`Found ${newExercises.length} new exercises to add.`);

    const batchSize = 400; // Firestore batch limit is 500
    for (let i = 0; i < newExercises.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = newExercises.slice(i, i + batchSize);

        chunk.forEach(ex => {
            const newDocRef = doc(exercisesRef);
            batch.set(newDocRef, {
                name: ex.name,
                phase: ex.phase || "Desconocido",
                body_part: ex.bodyPart || "otros",
                created_at: new Date().toISOString()
            });
        });

        await batch.commit();
        console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1} (${chunk.length} exercises)`);
    }

    console.log("Sync finished successfully!");
}

syncExercises().catch(console.error);
