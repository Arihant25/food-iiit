"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CasLogin() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const searchParams = useSearchParams();
    const router = useRouter();

    // Handle the CAS redirect and ticket
    useEffect(() => {
        const ticket = searchParams.get("ticket");

        // If there's a ticket in the URL, process the CAS login
        if (ticket) {
            setIsLoading(true);
            // Use the current URL's origin + path without the query parameters as service
            const currentUrl = new URL(window.location.origin);
            currentUrl.pathname = "/"; // Ensure path is just the root
            const service = currentUrl.toString();

            // Call the NextAuth API with the ticket
            signIn("credentials", {
                ticket,
                service, // Pass the service URL to match what was sent to CAS
                redirect: false,
            })
            .then((result) => {
                if (result?.error) {
                    setIsLoading(false);
                } else if (result?.ok) {
                    // Successfully authenticated
                    router.push("/canteen");
                }
            })
            .catch((err) => {
                setIsLoading(false);
            });
        }
    }, [searchParams, router]);

    const handleLogin = async () => {
        setIsLoading(true);

        try {
            // Generate the service URL (the URL that CAS will redirect back to)
            const serviceUrl = new URL(window.location.origin);
            serviceUrl.pathname = "/";

            // Redirect to CAS login page
            window.location.href = `https://login.iiit.ac.in/cas/login?service=${encodeURIComponent(
                serviceUrl.toString()
            )}`;
        } catch (error) {
            console.error("Login error:", error);
            setError("Login failed. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <>
            {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
            <Button
                onClick={handleLogin}
                variant="default"
                disabled={isLoading}
            >
                {isLoading ? "Cooking..." : "Login with CAS"}
            </Button>
        </>
    );
}