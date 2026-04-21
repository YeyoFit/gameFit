import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFirestoreAdmin } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
                .orderBy('date', 'desc')
                .limit(5)
                .get();
            
            for (const wDoc of workoutsSnap.docs) {
                const wData = wDoc.data();
                const logsSnap = await adminDb.collection('workout_logs')
                    .where('workout_id', '==', wDoc.id)
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
                    name: wData.name,
                    date: wData.date,
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
                .orderBy('recorded_at', 'desc')
                .limit(1)
                .get();
                
            lastMeasurement = mSnap.docs.length > 0 ? mSnap.docs[0].data() : null;
        } catch (e: any) {
            throw new Error(`Fallo al leer MEDICIONES: ${e.message}`);
        }

        // 5. Construct Prompt
        const systemPrompt = `Eres un Científico del Deporte con Doctorado (PhD) y Coach de Fuerza de Élite. 
Tu objetivo es diseñar un plan de entrenamiento altamente efectivo y basado en la ciencia para un cliente específico.
Basas tus consejos en los últimos estudios, meta-análisis y consenso de expertos (ej: Brad Schoenfeld, Mike Israetel, Eric Helms).

REGLAS:
1. Usa la lista de "Ejercicios Existentes" siempre que sea posible. Si un ejercicio encaja con el objetivo, usa su 'id'.
2. Si necesitas un ejercicio que NO está en la lista, puedes proponerlo. Márcalo claramente con "isNew": true y proporciona un nombre y grupo muscular.
3. Para CADA ejercicio (existente o nuevo), proporciona "technique_cues" (2-3 consejos técnicos cortos y accionables).
4. Analiza el "Historial del Cliente" para asegurar una progresión adecuada.
5. La respuesta DEBE ser un JSON válido.
6. Toda la respuesta (rationale, nombres de ejercicios, notas, consejos técnicos) DEBE estar en Español (Castellano).

CLIENT GOAL: "${goal}"
CLIENT EMAIL: ${profile?.email}
LAST MEASUREMENTS: ${lastMeasurement ? JSON.stringify(lastMeasurement) : "No hay mediciones disponibles"}

AVAILABLE EXERCISES:
${JSON.stringify(exercises)}

CLIENT HISTORY (Last 5 sessions):
${JSON.stringify(lastWorkouts)}

RESPONSE FORMAT (JSON):
{
  "rationale": "Explicación con base científica del plan en español...",
  "workout": [
    {
      "exerciseId": "EXISTING_ID_OR_NULL",
      "name": "Nombre del Ejercicio",
      "isNew": false,
      "body_part": "Grupo Muscular",
      "sets": 3,
      "reps": "8-12",
      "tempo": "3010",
      "rest": "90s",
      "notes": "Notas extra de prescripción...",
      "technique_cues": ["Consejo 1", "Consejo 2"]
    }
  ]
}`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
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
