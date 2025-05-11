import { Metadata } from "next";
import CasLogin from "@/components/auth/CasLogin";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import Marquee from "@/components/ui/marquee";
import { MessIcon } from "@/components/ui/mess-icon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, Utensils, Star, Calendar, ActivitySquare, TrendingUp, Users } from "lucide-react";
import { LearnMoreButton } from "@/components/ui/learn-more-button";

export const metadata: Metadata = {
  title: "Food@IIIT",
  description: "The one stop shop for all things food at IIIT Hyderabad",
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative py-12 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left column - Info */}
            <div className="space-y-8">
              <div className="transform -rotate-2">
                <h1 className="text-5xl md:text-7xl font-heading mb-4 border-4 border-border p-4 bg-main text-main-foreground inline-block shadow-shadow">
                  Food@IIIT
                </h1>
              </div>

              <p className="text-lg md:text-xl font-base border-2 border-border p-4 rounded-base bg-secondary-background shadow-shadow transform rotate-1">
                The one-stop hub for everything food at IIIT Hyderabad
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Suspense fallback={<Button size="lg" disabled>Loading...</Button>}>
                  <CasLogin />
                </Suspense>
                <LearnMoreButton targetId="features" />
              </div>
            </div>

            {/* Right column - Food Icons */}
            <div className="hidden md:block">
              <div className="grid grid-cols-3 gap-4">
                <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform rotate-2">
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <MessIcon messName="north" size={56} />
                    <span className="text-lg font-heading">North Mess</span>
                  </div>
                </div>
                <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform -rotate-2">
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <MessIcon messName="south" size={56} />
                    <span className="text-lg font-heading">South Mess</span>
                  </div>
                </div>
                <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform rotate-1">
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <MessIcon messName="kadamba" size={56} />
                    <span className="text-lg font-heading">Kadamba</span>
                  </div>
                </div>
                <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform -rotate-3 col-span-1">
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <MessIcon messName="yuktahar" size={56} />
                    <span className="text-lg font-heading">Yuktahar</span>
                  </div>
                </div>
                <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform rotate-2 col-span-2">
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <Utensils className="text-purple-500" size={56} />
                    <span className="text-lg font-heading">Canteens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner section - Explains what the site is about */}
      <section className="py-8 bg-main">
        <div className="max-w-5xl mx-auto px-4">
          <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform -rotate-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center border-b-2 md:border-b-0 md:border-r-2 border-border pb-4 md:pb-0 md:pr-4">
                <div className="bg-secondary-background p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border">
                  <Utensils className="text-foreground" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-heading">All Campus Food</h3>
                  <p className="text-sm">Mess menus, canteens, ratings</p>
                </div>
              </div>
              <div className="flex items-center border-b-2 md:border-b-0 md:border-r-2 border-border pb-4 md:pb-0 md:pr-4">
                <div className="bg-secondary-background p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border">
                  <Users className="text-foreground" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-heading">Community Powered</h3>
                  <p className="text-sm">Reviews, rankings</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="bg-secondary-background p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border">
                  <ActivitySquare className="text-foreground" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-heading">Secure</h3>
                  <p className="text-sm">Verified meals, secure orders</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee section */}
      <Marquee items={["Mess Menus", "Save Money", "Buy & Sell QR", "Canteens", "Live Voting", "Analytics", "Leaderboard"]} />


      {/* Features section */}
      <section id="features" className="py-16 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <PageHeading
            title="How It Works"
            subtitle="Everything you need to know about Food@IIIT"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <Card className="border-4 transform hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="bg-main p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border mb-2">
                  <Calendar className="text-main-foreground" />
                </div>
                <CardTitle>Mess Menus</CardTitle>
                <CardDescription>View daily, weekly and monthly menus for all messes on campus</CardDescription>
              </CardHeader>
              <CardContent>
                Access to North, South, Yuktahar and Kadamba mess menus. Never be surprised by what's for lunch again!
              </CardContent>
            </Card>

            <Card className="border-4 transform hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="bg-main p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border mb-2">
                  <Star className="text-main-foreground" />
                </div>
                <CardTitle>Rate & Review</CardTitle>
                <CardDescription>Share your opinions on canteen items</CardDescription>
              </CardHeader>
              <CardContent>
                Like that biryani? Hate that curry? Let everyone know with ratings and reviews for each meal.
              </CardContent>
            </Card>

            <Card className="border-4 transform hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="bg-main p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border mb-2">
                  <ActivitySquare className="text-main-foreground" />
                </div>
                <CardTitle>Meal Analytics</CardTitle>
                <CardDescription>Track your meal consumption and spending patterns</CardDescription>
              </CardHeader>
              <CardContent>
                View your purchase history, analyze spending trends, and get insights on your food preferences over time.
              </CardContent>
            </Card>

            <Card className="border-4 transform hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="bg-main p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border mb-2">
                  <TrendingUp className="text-main-foreground" />
                </div>
                <CardTitle>Meal Listings</CardTitle>
                <CardDescription>Buy and sell meal coupons with other students</CardDescription>
              </CardHeader>
              <CardContent>
                Create listings to sell unused meal coupons or place bids on available meals to save money.
              </CardContent>
            </Card>

            <Card className="border-4 transform hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="bg-main p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border mb-2">
                  <Users className="text-main-foreground" />
                </div>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>See who's most active in the food community</CardDescription>
              </CardHeader>
              <CardContent>
                Discover the most active buyers and sellers in the campus food ecosystem on our community leaderboard.
              </CardContent>
            </Card>

            <Card className="border-4 transform hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="bg-main p-3 rounded-full w-12 h-12 flex items-center justify-center border-2 border-border mb-2">
                  <Utensils className="text-main-foreground" />
                </div>
                <CardTitle>Canteen Menus</CardTitle>
                <CardDescription>Browse menus from campus canteens and cafes</CardDescription>
              </CardHeader>
              <CardContent>
                View menus from BBC, Tantra, Juice Canteen and more. Compare prices and plan your snacks.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Login section */}
      <section className="py-16 px-4 bg-main">
        <div className="max-w-md mx-auto text-center">
          <div className="border-4 border-border bg-background p-6 rounded-base shadow-shadow transform -rotate-1">
            <h2 className="text-3xl font-heading mb-4">Ready to start?</h2>
            <p className="mb-6 font-base">Log in with your IIIT credentials to access all features</p>
            <Suspense fallback={<div>Loading...</div>}>
              <CasLogin />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Footer with branding */}
      <footer className="py-8 px-4 border-t-2 border-border bg-background">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading text-xl border-2 border-border bg-main text-main-foreground p-2 transform -rotate-2">Food@IIIT</span>
            <span className="text-sm">© {new Date().getFullYear()}</span>
          </div>
          <div className="text-sm">
            Made with ♥ for IIIT Hyderabad students
          </div>
        </div>
      </footer>
    </div>
  );
}
