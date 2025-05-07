"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import React from "react";

export default function SwitchButton() {
    const pathname = usePathname();
    const router = useRouter();
    const isCanteenPage = !pathname.includes("/mess");
    const [mounted, setMounted] = useState(false);

    // Handle hydration mismatch by delaying the render
    useEffect(() => {
        setMounted(true);
    }, []);
    
    const [isExiting, setIsExiting] = useState(false);

    if (!mounted) return null;

    const handleSwitchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        
        // Set exiting state to trigger exit animation
        setIsExiting(true);
        
        // Define the target URL
        const targetUrl = isCanteenPage ? "/mess" : "/canteen";

        // After animation completes, navigate to the target page
        setTimeout(() => {
            router.push(targetUrl);
        }, 150); // Match the animation duration
    };

    return (
        <AnimatePresence mode="wait" onExitComplete={() => setIsExiting(false)}>
            <motion.div
                key={isExiting ? "exiting" : (isCanteenPage ? "canteen" : "mess")}
                initial={{
                    x: isCanteenPage ? "calc(100% - 1rem)" : "-2rem"
                }}
                animate={{
                    x: isCanteenPage ? "calc(100% - 3rem)" : "0"
                }}
                exit={{
                    x: isCanteenPage ? "100%" : "-3rem"
                }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className={`fixed top-0 ${isCanteenPage ? "right-0" : "left-0"} h-full z-10`}
                style={{ width: "3rem" }}
            >
                <Button
                    variant="default"
                    className="h-full w-12 p-0 rounded-none"
                    onClick={handleSwitchClick}
                >
                    <div className="h-full w-full flex items-center justify-center">
                        <span className={`transform ${isCanteenPage ? "rotate-270" : "rotate-90"} text-lg whitespace-nowrap`}>
                            {isCanteenPage ? "SWITCH TO MESS" : "SWITCH TO CANTEEN"}
                        </span>
                    </div>
                </Button>
            </motion.div>
        </AnimatePresence>
    );
}