import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFirestoreAdmin } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET() {
    try {
        const adminDb = getFirestoreAdmin();
        if (!adminDb) throw new Error("Admin SDK not initialized");

        const usersSnap = await adminDb.collection('users').where('role', '==', 'user').get();
        const clients = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const exercisesSnap = await adminDb.collection('exercises').get();
        const exercises = exercisesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return NextResponse.json({ clients, exercises });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { clientId, goal } = await req.json();

        if (!clientId) {
            return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
        }

        const adminDb = getFirestoreAdmin();
        const missingVars = [];
        if (!process.env.FIREBASE_PROJECT_ID) missingVars.push("PROJECT_ID");
        if (!process.env.FIREBASE_CLIENT_EMAIL) missingVars.push("CLIENT_EMAIL");
        if (!process.env.FIREBASE_PRIVATE_KEY) missingVars.push("PRIVATE_KEY");

        if (missingVars.length > 0) {
            return NextResponse.json({ 
                error: "Configuración incompleta en el servidor.", 
                debug: `Faltan las siguientes variables en Vercel: ${missingVars.join(", ")}`
            }, { status: 500 });
        }

        // 1. Fetch Client Profile
        let profile;
        try {
            const profileSnap = await adminDb.collection('users').doc(clientId).get();
            profile = profileSnap.exists ? profileSnap.data() : { email: "Unknown" };
        } catch (e: any) {
            throw new Error(`Fallo al leer PERFIL del cliente: ${e.message}`);
        }

        // 2. Fetch Exercises (to provide as reference)
        let exercises;
        try {
            const exerciseSnap = await adminDb.collection('exercises').get();
            exercises = exerciseSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                body_part: d.data().body_part
            }));
        } catch (e: any) {
            throw new Error(`Fallo al leer BIBLIOTECA de ejercicios: ${e.message}`);
        }

        // 3. Fetch Last 5 Workouts
        let lastWorkouts = [];
        try {
            const workoutsSnap = await adminDb.collection('workouts')
                .where('user_id', '==', clientId)
                .get();
            
            // Sort in memory to avoid composite index requirement
            const workoutDocs = workoutsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a: any, b: any) => b.date.localeCompare(a.date))
                .slice(0, 5);

            for (const wData of workoutDocs) {
                const logsSnap = await adminDb.collection('workout_logs')
                    .where('workout_id', '==', wData.id)
                    .get();
                    
                const logs = logsSnap.docs.map(l => ({
                    exercise_id: l.data().exercise_id,
                    set: l.data().set_number,
                    reps: l.data().reps,
                    weight: l.data().weight,
                    notes: l.data().notes,
                    completed: l.data().completed
                }));
                lastWorkouts.push({
                    name: (wData as any).name,
                    date: (wData as any).date,
                    logs
                });
            }
        } catch (e: any) {
            throw new Error(`Fallo al leer HISTORIAL (workouts): ${e.message}`);
        }

        // 4. Fetch Measurements (Corrected collection name)
        let lastMeasurement = null;
        try {
            const mSnap = await adminDb.collection('client_measurements')
                .where('user_id', '==', clientId)
                .get();
                
            const mDocs = mSnap.docs
                .map(doc => doc.data())
                .sort((a: any, b: any) => b.recorded_at.localeCompare(a.recorded_at));

            lastMeasurement = mDocs.length > 0 ? mDocs[0] : null;
        } catch (e: any) {
            throw new Error(`Fallo al leer MEDICIONES: ${e.message}`);
        }

        // 5. Construct Prompt
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ 
                error: "Configuración incompleta: Falta GEMINI_API_KEY.", 
                debug: "La clave de la IA no está configurada en las variables de entorno de Vercel."
            }, { status: 500 });
        }

        const systemPrompt = `Eres un Científico del Deporte con Doctorado (PhD) y Coach de Fuerza de Élite. 
...`; // (Truncated for instruction)

        const model = getGenAI().getGenerativeModel({ 
            model: "gemini-1.5-flash", 
        });

        const result = await model.generateContent(systemPrompt);
        const content = result.response.text();
        
        return NextResponse.json(JSON.parse(content || "{}"));

    } catch (error: any) {
        console.error("AI Coach Full Error:", error);
        return NextResponse.json({ 
            error: error.message, // Return the specific "Fallo al leer..." message
            debug: error.stack
        }, { status: 500 });
    }
}
