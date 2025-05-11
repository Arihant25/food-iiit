import React from 'react';
import { Coffee, Leaf, Wheat, Drumstick, GlassWater } from 'lucide-react';

interface MessIconProps {
    messName: string;
    className?: string;
    size?: number;
}

export function MessIcon({ messName, className = "", size = 20 }: MessIconProps) {
    // Normalize the mess name to lowercase for case-insensitive matching
    const normalizedName = messName.toLowerCase();

    if (normalizedName.includes('north')) {
        return <Wheat className={`text-orange-500 ${className}`} size={size} />;
    } else if (normalizedName.includes('south')) {
        return <Coffee className={`text-yellow-600 ${className}`} size={size} />;
    } else if (normalizedName.includes('yuktahar')) {
        return <Leaf className={`text-green-600 ${className}`} size={size} />;
    } else if (normalizedName.includes('kadamba')) {
        return <Drumstick className={`text-red-500 ${className}`} size={size} />;
    } else {
        // Default icon for unknown mess
        return <GlassWater className={`text-gray-500 ${className}`} size={size} />;
    }
}