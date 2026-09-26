import { useRef, useState } from 'react';
import { BiUpload, BiX } from 'react-icons/bi';
import { LuFileText } from 'react-icons/lu';
import { MAX_PDF_MB } from '../../services/genaiApi';

interface Props {
    file: File | null;
    onChange: (file: File | null) => void;
    disabled?: boolean;
}

const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// Checked here so the user finds out instantly, not after an upload.
const validate = (file: File) => {
    const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) return 'Only PDF files are supported.';

    if (file.size > MAX_PDF_MB * 1024 * 1024) {
        return `This PDF is ${formatSize(file.size)}. The limit is ${MAX_PDF_MB} MB.`;
    }

    return '';
};

function PdfDropzone({ file, onChange, disabled }: Props) {
    const input = useRef<HTMLInputElement>(null);

    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');

    const pick = (picked: File | undefined) => {
        if (!picked || disabled) return;

        const problem = validate(picked);
        setError(problem);

        if (!problem) onChange(picked);
    };

    return (
        <div>
            <input
                ref={input}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                data-testid="pdf-input"
                onChange={(e) => {
                    pick(e.target.files?.[0]);
                    // allow picking the same file again after removing it
                    e.target.value = '';
                }}
            />

            {file ? (
                <div className="flex items-center gap-3 py-4 px-5 rounded-xl border border-purple-700/50 bg-purple-900/10">
                    <LuFileText className="w-5 h-5 text-purple-400 shrink-0" />
                    <span className="text-gray-300 font-secondary text-sm truncate flex-1">
                        {file.name}
                    </span>
                    <span className="text-zinc-500 font-secondary text-xs shrink-0">
                        {formatSize(file.size)}
                    </span>
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        disabled={disabled}
                        aria-label="Remove PDF"
                        className="text-zinc-400 hover:text-rose-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <BiX className="w-5 h-5" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        pick(e.dataTransfer.files?.[0]);
                    }}
                    disabled={disabled}
                    className={`w-full flex flex-col items-center gap-2 py-6 px-5 rounded-xl border border-dashed cursor-pointer transition-colors ${
                        dragging
                            ? 'border-purple-400 bg-purple-900/30'
                            : 'border-purple-700/50 bg-purple-900/10 hover:bg-purple-900/20'
                    }`}
                >
                    <BiUpload className="w-6 h-6 text-purple-400" />
                    <span className="text-zinc-300 font-secondary text-sm">
                        Drop a PDF here, or click to choose
                    </span>
                    <span className="text-zinc-500 font-secondary text-xs">
                        Text-based PDFs up to {MAX_PDF_MB} MB
                    </span>
                </button>
            )}

            {error && (
                <p role="alert" className="mt-2 text-sm text-rose-400 font-secondary">
                    {error}
                </p>
            )}
        </div>
    );
}

export default PdfDropzone;
