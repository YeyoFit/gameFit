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
        const systemPrompt = `Eres un Científico del Deporte con Doctorado (PhD) y Coach de Fuerza de Élite (vanguardia en Biomecánica y Fisiología).
        
        CONTEXTO DEL ATLETA:
        - Perfil: ${JSON.stringify(profile)}
        - Últimas Mediciones: ${JSON.stringify(lastMeasurement)}
        - Últimos 5 Entrenamientos: ${JSON.stringify(lastWorkouts)}
        
        BIBLIOTECA DE EJERCICIOS DISPONIBLES:
        ${JSON.stringify(exercises)}
        
        OBJETIVO DEL ENTRENAMIENTO:
        "${goal}"
        
        TAREA:
        Diseña una única sesión de entrenamiento ultra-personalizada basada en evidencia científica. 
        Si el objetivo requiere un ejercicio que NO está en la biblioteca, márcalo como 'isNew: true' y sugiere uno excelente.
        
        REGLAS CRÍTICAS:
        1. Debes responder EXCLUSIVAMENTE con un objeto JSON válido.
        2. No incluyas texto antes o después del JSON. No uses bloques de código markdown (\` \` \`json).
        3. El rationale debe ser una explicación técnica corta (2-3 frases) de por qué elegiste este volumen/intensidad.
        
        ESTRUCTURA JSON:
        {
          "rationale": "Breve explicación científica...",
          "workout": [
            {
              "exerciseId": "id_de_la_biblioteca_o_null",
              "name": "Nombre exacto",
              "isNew": false,
              "body_part": "Pecho/Espalda/etc",
              "sets": 4,
              "reps": "8-12",
              "tempo": "3011",
              "rest": "90s",
              "notes": "Instrucción técnica clave",
              "technique_cues": ["Cue 1", "Cue 2"]
            }
          ]
        }
        `;

        const model = getGenAI().getGenerativeModel({ 
            model: "gemini-2.0-flash", 
        });

        const result = await model.generateContent(systemPrompt);
        let content = result.response.text().trim();
        
        // Remove markdown formatting if present
        if (content.startsWith("```")) {
            content = content.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        }
        
        return NextResponse.json(JSON.parse(content || "{}"));

    } catch (error: any) {
        console.error("AI Coach Full Error:", error);
        return NextResponse.json({ 
            error: error.message, // Return the specific "Fallo al leer..." message
            debug: error.stack
        }, { status: 500 });
    }
}
