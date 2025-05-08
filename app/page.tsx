import { Metadata } from "next";
import CasLogin from "@/components/auth/CasLogin";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Food@IIIT",
  description: "The one stop shop for all things food at IIIT Hyderabad",
};

export default function Home() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-center">Food@IIIT</h1>
        <div className="flex flex-col items-center">
          <Suspense fallback={<div>Loading...</div>}>
            <CasLogin />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
