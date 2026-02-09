
'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className="flex h-full flex-col items-center justify-center bg-slate-100 p-8">
            <div className="rounded-lg bg-white p-6 shadow-xl max-w-lg w-full">
                <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong!</h2>
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 overflow-auto max-h-60">
                    <p className="font-mono text-sm text-red-800 whitespace-pre-wrap">
                        {error.message}
                    </p>
                    {error.stack && (
                        <details className="mt-2">
                            <summary className="text-xs text-red-600 cursor-pointer">Stack Trace</summary>
                            <pre className="text-xs text-red-700 mt-2 overflow-x-auto">
                                {error.stack}
                            </pre>
                        </details>
                    )}
                </div>
                <button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
