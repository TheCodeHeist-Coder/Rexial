import axios, { type AxiosProgressEvent } from 'axios';

const genaiHost =
    import.meta.env.VITE_GENAI_URL || 'http://localhost:8000';

// LLM calls (RAG, question generation) are slow, so this client uses a
// much longer timeout than the main api client.
export const genaiApi = axios.create({
    baseURL: genaiHost,
    timeout: 120000,
});

// Must match MAX_UPLOAD_MB in apps/genAI/app/main.py.
export const MAX_PDF_MB = 10;

export type Difficulty = 'Low' | 'Medium' | 'High';

// Cancellation and upload progress for the slow, file-carrying calls.
export interface RequestOptions {
    signal?: AbortSignal;
    onUploadProgress?: (percent: number) => void;
}

const requestConfig = ({ signal, onUploadProgress }: RequestOptions = {}) => ({
    signal,
    onUploadProgress: onUploadProgress
        ? (e: AxiosProgressEvent) =>
              onUploadProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0)
        : undefined,
});

export interface ChatResponse {
    response: string;
}

export const chat = async (userQuery: string, options?: RequestOptions) => {
    const { data } = await genaiApi.post<ChatResponse>(
        '/chat',
        { user_query: userQuery },
        requestConfig(options)
    );

    return data.response;
};

export interface GenerateQuestionsResponse {
    message: string;
    filename: string;
    questions: string;
}

export const generateQuestions = async (file: File, userQuery: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('user_query', userQuery);

    const { data } = await genaiApi.post<GenerateQuestionsResponse>(
        '/generate-questions',
        form
    );

    return data;
};

export interface AskPdfResponse {
    message: string;
    filename: string;
    question: string;
    answer: string;
}

export const askPdf = async (
    file: File,
    userQuery: string,
    options?: RequestOptions
) => {
    const form = new FormData();
    form.append('file', file);
    form.append('user_query', userQuery);

    const { data } = await genaiApi.post<AskPdfResponse>(
        '/ask-pdf',
        form,
        requestConfig(options)
    );

    return data;
};

export interface GeneratedOption {
    text: string;
    isCorrect: boolean;
}

export interface GeneratedQuestion {
    text: string;
    difficulty: Difficulty;
    options: GeneratedOption[];
}

export interface GenerateQuizResponse {
    message: string;
    filename: string;
    count: number;
    questions: GeneratedQuestion[];
}

export interface QuizSettings {
    count: number;
    difficulty: Difficulty | 'Mixed';
    // Optional focus, e.g. "chapter 2" or "only the formulas".
    topic: string;
    // Question texts the model must not repeat.
    exclude?: string[];
}

// Structured counterpart to generateQuestions: returns data the quiz
// builder can render and save, rather than a formatted text blob.
export const generateQuiz = async (
    file: File,
    settings: QuizSettings,
    options?: RequestOptions
) => {
    const form = new FormData();
    form.append('file', file);
    form.append('user_query', settings.topic);
    form.append('count', String(settings.count));
    form.append('difficulty', settings.difficulty);
    form.append('exclude', JSON.stringify(settings.exclude ?? []));

    const { data } = await genaiApi.post<GenerateQuizResponse>(
        '/generate-quiz',
        form,
        requestConfig(options)
    );

    return data.questions;
};

export const isCancelled = (err: unknown) => axios.isCancel(err);

// Surfaces the FastAPI "detail" field, which carries the actionable
// message (missing API key, unusable PDF, and so on).
export const genaiErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;

        if (typeof detail === 'string') return detail;

        // FastAPI validation errors carry a list of problems
        if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') {
            return detail[0].msg;
        }

        if (err.code === 'ECONNABORTED') {
            return 'The request timed out. Try asking for fewer questions.';
        }

        if (!err.response) {
            return 'Could not reach the AI service. Is it running on port 8000?';
        }
    }

    return fallback;
};
