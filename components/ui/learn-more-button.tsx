'use client';

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface LearnMoreButtonProps {
    targetId: string;
}

export function LearnMoreButton({ targetId }: LearnMoreButtonProps) {
    const handleScroll = () => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <Button
            variant="neutral"
            onClick={handleScroll}
        >
            Learn More <ArrowRight />
        </Button>
    );
}
