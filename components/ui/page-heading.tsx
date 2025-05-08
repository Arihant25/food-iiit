import React from 'react';

interface PageHeadingProps {
    title: string;
    subtitle?: string;
    status?: {
        text: string;
        isActive: boolean;
    };
}

export function PageHeading({ title, subtitle, status }: PageHeadingProps) {
    return (
        <div className="flex flex-col items-center mb-8 sm:mb-12">
            <div className="border-4 border-black shadow-shadow bg-main text-main-foreground p-4 w-full max-w-md rounded-lg transform rotate-1">
                <h1 className="text-4xl sm:text-5xl font-heading text-center mb-4">{title}</h1>

                {subtitle && (
                    <div className="flex flex-col items-center">
                        <p className="text-base sm:text-lg font-base mb-2">{subtitle}</p>
                        {status && (
                            <p className={`text-lg sm:text-xl font-heading px-3 py-1 ${status.isActive ? 'bg-secondary-background' : 'bg-background'} rounded-md border-2 border-black`}>
                                {status.text}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}