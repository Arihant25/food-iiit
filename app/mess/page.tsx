"use client";

import SwitchButton from "@/components/navigation/SwitchButton";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MessPage() {
    const router = useRouter();
    const { status } = useSession();

    // Redirect to home if not logged in
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    return (
        <div className="relative p-6">
            <div className="mx-9 ml-18">
                <h1 className="text-2xl font-bold mb-4">Mess</h1>
                {/* Content for mess page goes here */}
                <div className="p-4 bg-white rounded-lg shadow">
                    <p>Mess information and meal options will be displayed here.</p>
                </div>
            </div>

            <SwitchButton />
        </div>
    );
}