// Mock Data reflecting the structure observed in Strength & Metabolic

export const USER_PROFILE = {
    name: "Sergio Ramos",
    email: "sergio.ramos@icloud.com",
    bodyWeight: 69.30,
    units: "Kg"
};

export type LogSet = {
    id?: string; // Database ID
    setNumber: number;
    weight: number | null; // Nullable for empty input
    reps: number | null;
    prevWeight?: number; // For placeholder
    prevReps?: number;   // For placeholder
    completed: boolean;
    isPR?: boolean; // New property for PR tracking
    videoUrl?: string;
    coachComment?: string;
};

export type Exercise = {
    id: string;
    name: string;
    order: string; // e.g., "A", "B1", "B2"
    setsTarget: string; // e.g., "3" or "2-3"
    repsTarget: string; // e.g., "50,50,50" or "8-10"
    tempo: string; // e.g., "X-0-X-0"
    rest: number; // seconds
    notes?: string;
    videoUrl?: string; // Placeholder for play button
    logs: LogSet[];
};

export type WorkoutSession = {
    id: string;
    date: string;
    phaseName: string;
    phaseNumber: number;
    bodyPart: string;
    completion: string; // e.g., "2/6"
    exercises: Exercise[];
};

export const MOCK_HISTORY: WorkoutSession[] = [
    {
        id: "ws-001",
        date: "2026-01-09",
        phaseName: "Speed Chains",
        phaseNumber: 23,
        bodyPart: "Lower Body 2",
        completion: "2/6",
        exercises: [] // Collapsed in list view
    },
    {
        id: "ws-002",
        date: "2026-01-08",
        phaseName: "Chains 1-3-5",
        phaseNumber: 23,
        bodyPart: "Chest & Back",
        completion: "1/6",
        exercises: []
    },
    {
        id: "ws-003",
        date: "2026-01-06",
        phaseName: "Eccentric Hooks Clusters",
        phaseNumber: 23,
        bodyPart: "Lower Body 1",
        completion: "1/6",
        exercises: []
    },
    // ... more history
];

export const ACTIVE_SESSION: WorkoutSession = {
    id: "active-001",
    date: "2026-01-20",
    phaseName: "Speed Chains",
    phaseNumber: 23,
    bodyPart: "Lower Body 2",
    completion: "3/6",
    exercises: [
        {
            id: "ex-1",
            name: "Squats Romanian Rythm Back BB Feet Flat Normal Stance",
            order: "A",
            setsTarget: "3",
            repsTarget: "8,8,8",
            tempo: "X-0-X-0",
            rest: 180,
            notes: "Keep elbows under the bar. Feet are shoulder width.",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Demo Video
            logs: [
                { setNumber: 1, weight: 69.3, reps: 8, completed: true },
                { setNumber: 2, weight: 69.3, reps: 8, completed: true },
                { setNumber: 3, weight: 0, reps: 0, completed: false }
            ]
        },
        {
            id: "ex-2",
            name: "Lunges Walking DB",
            order: "B",
            setsTarget: "4",
            repsTarget: "12",
            tempo: "2-0-1-0",
            rest: 90,
            logs: [
                { setNumber: 1, weight: 15, reps: 12, completed: false },
                { setNumber: 2, weight: 15, reps: 12, completed: false },
                { setNumber: 3, weight: 15, reps: 12, completed: false },
                { setNumber: 4, weight: 15, reps: 12, completed: false }
            ]
        }
    ]
};
