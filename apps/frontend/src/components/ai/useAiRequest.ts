import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestOptions } from '../../services/genaiApi';

// Tracks one in-flight AI request: busy state, upload progress, elapsed
// seconds, and cancellation. Unmounting cancels whatever is running.
export function useAiRequest() {
    const controller = useRef<AbortController | null>(null);

    const [busy, setBusy] = useState(false);
    const [uploadPercent, setUploadPercent] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!busy) return;

        setElapsed(0);
        const timer = setInterval(() => setElapsed((s) => s + 1), 1000);

        return () => clearInterval(timer);
    }, [busy]);

    useEffect(() => () => controller.current?.abort(), []);

    const run = useCallback(
        async <T,>(request: (options: RequestOptions) => Promise<T>) => {
            controller.current?.abort();

            const current = new AbortController();
            controller.current = current;

            setBusy(true);
            setUploadPercent(null);

            try {
                return await request({
                    signal: current.signal,
                    onUploadProgress: setUploadPercent,
                });
            } finally {
                // a newer request may have replaced this one
                if (controller.current === current) {
                    controller.current = null;
                    setBusy(false);
                    setUploadPercent(null);
                }
            }
        },
        []
    );

    const cancel = useCallback(() => controller.current?.abort(), []);

    return { busy, uploadPercent, elapsed, run, cancel };
}
