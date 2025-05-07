"use client"

import React from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface AvatarItem {
    id: string;
    name: string;
    image?: string | null;
}

interface AvatarBannerProps {
    items: AvatarItem[];
    className?: string;
    onAvatarClick?: (item: AvatarItem) => void;
    selectedItemId?: string;
}

export default function AvatarBanner({ items, className, onAvatarClick, selectedItemId }: AvatarBannerProps) {
    const handleAvatarClick = (item: AvatarItem) => {
        onAvatarClick && onAvatarClick(item);
    };

    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 right-13 bg-background border-t-2 border-border py-2 z-50",
                className
            )}
        >
            <div className="overflow-x-auto scrollbar-hide">
                <div className="flex justify-evenly min-w-max">
                    {items.map((item) => {
                        const isSelected = item.id === selectedItemId;
                        return (
                            <div
                                key={item.id}
                                className="flex flex-col items-center mx-3"
                                onClick={() => handleAvatarClick(item)}
                            >
                                <Avatar
                                    className={cn(
                                        "my-1 cursor-pointer transition-all border-1 border-border shadow-shadow ",
                                        isSelected && "border-primary shadow-shadow-lg translate-x-boxShadowX translate-y-boxShadowY"
                                    )}
                                >
                                    {item.image ? (
                                        <AvatarImage src={item.image} alt={item.name} />
                                    ) : (
                                        <AvatarFallback>
                                            {item.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                {isSelected && (
                                    <div className="h-1 w-1 rounded-full bg-primary mt-1"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    )
}