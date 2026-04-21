import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { clientId, goal } = await req.json();

        if (!clientId) {
            return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
        }

        const firestore = db;
        if (!firestore) {
            return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
        }

        // 1. Fetch Client Profile
        const profileSnap = await getDoc(doc(firestore, 'users', clientId));
        const profile = profileSnap.exists() ? profileSnap.data() : { email: "Unknown" };

        // 2. Fetch Exercises (to provide as reference)
        const exerciseSnap = await getDocs(collection(firestore, 'exercises'));
        const exercises = exerciseSnap.docs.map(d => ({
            id: d.id,
            name: d.data().name,
            body_part: d.data().body_part
        }));

        // 3. Fetch Last 5 Workouts
        const qWorkouts = query(
            collection(firestore, 'workouts'),
            where('user_id', '==', clientId),
            orderBy('date', 'desc'),
            limit(5)
        );
        const workoutsSnap = await getDocs(qWorkouts);
        const lastWorkouts = [];

        for (const wDoc of workoutsSnap.docs) {
            const wData = wDoc.data();
            const logsSnap = await getDocs(query(collection(firestore, 'workout_logs'), where('workout_id', '==', wDoc.id)));
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

        // 4. Fetch Measurements
        const mSnap = await getDocs(query(collection(firestore, 'measurements'), where('userId', '==', clientId), orderBy('date', 'desc'), limit(1)));
        const lastMeasurement = mSnap.docs.length > 0 ? mSnap.docs[0].data() : null;

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
CLIENT EMAIL: ${profile.email}
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
        console.error("AI Coach Error (Gemini):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
