import { LuLoader } from 'react-icons/lu';

interface Props {
    // What the model is doing once the upload has finished.
    label: string;
    uploadPercent: number | null;
    elapsed: number;
    onCancel: () => void;
}

function AiProgress({ label, uploadPercent, elapsed, onCancel }: Props) {
    const uploading = uploadPercent !== null && uploadPercent < 100;

    return (
        <div
            role="status"
            className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-purple-800/40 bg-purple-900/10 py-3 px-4"
        >
            <div className="flex items-center gap-3 text-sm font-secondary tracking-wide text-zinc-400">
                <LuLoader className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                {uploading ? (
                    <span>Uploading PDF… {uploadPercent}%</span>
                ) : (
                    <span>
                        {label}… {elapsed}s
                        {elapsed >= 20 && (
                            <span className="text-zinc-500">
                                {' '}
                                (large documents can take up to a minute)
                            </span>
                        )}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={onCancel}
                className="shrink-0 text-xs font-secondary font-bold tracking-wider text-rose-300 hover:text-rose-200 border border-rose-700/40 bg-rose-900/20 hover:bg-rose-900/30 rounded-md py-1.5 px-3 cursor-pointer"
            >
                Cancel
            </button>
        </div>
    );
}

export default AiProgress;
