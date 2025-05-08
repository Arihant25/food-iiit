"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"

import { PageHeading } from "@/components/ui/page-heading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Save, User, Key, Phone } from "lucide-react"

interface UserProfile {
    id: string
    email: string
    name: string
    roll_number: string
    api_key: string | null
    phone_number: string | null
    created_at: string
    last_signed_in: string
}

export default function ProfilePage() {
    const router = useRouter()
    const { data: session, status, update } = useSession()

    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/")
        } else if (status === "authenticated" && session?.user?.rollNumber) {
            fetchUserProfile()
        }
    }, [status, session])

    const fetchUserProfile = async () => {
        if (!session?.user?.rollNumber) return

        try {
            setLoading(true)

            const { data, error } = await supabase
                .from("users")
                .select("*")
                .eq("roll_number", session.user.rollNumber)
                .single()

            if (error) {
                throw error
            }

            if (data) {
                setProfile(data as UserProfile)
                setPhoneNumber(data.phone_number || "")
                setApiKey(data.api_key || "")
            }
        } catch (error) {
            console.error("Error fetching profile:", error)
            toast.error("Failed to load profile")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveProfile = async () => {
        if (!session?.user?.rollNumber || !profile) return

        try {
            setIsSaving(true)

            const { error } = await supabase
                .from("users")
                .update({
                    phone_number: phoneNumber,
                    api_key: apiKey
                })
                .eq("roll_number", session.user.rollNumber)

            if (error) {
                throw error
            }

            // Update local state
            setProfile({
                ...profile,
                phone_number: phoneNumber,
                api_key: apiKey
            })

            // Update session
            await update({
                ...session,
                user: {
                    ...session.user,
                    phoneNumber,
                    apiKey
                }
            })

            toast.success("Profile updated successfully")
            setEditing(false)
        } catch (error) {
            console.error("Error updating profile:", error)
            toast.error("Failed to update profile")
        } finally {
            setIsSaving(false)
        }
    }

    if (status === "loading" || loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center h-64">
                    <p>Loading profile...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <PageHeading title="My Profile" />

            {profile ? (
                <div className="max-w-2xl mx-auto">
                    <Card className="mb-8 overflow-hidden">
                        <CardHeader className="bg-main-foreground/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-2xl">Profile Information</CardTitle>
                                {!editing ? (
                                    <Button onClick={() => setEditing(true)} size="sm">
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                ) : (
                                    <Button onClick={() => setEditing(false)} size="sm" variant="noShadow">
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-6">
                                {/* Non-editable fields */}
                                <div>
                                    <div className="flex items-center mb-2">
                                        <User className="h-4 w-4 mr-2" />
                                        <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
                                    </div>
                                    <p className="text-lg">{profile.name}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Email</h3>
                                    <p className="text-lg">{profile.email}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Roll Number</h3>
                                    <p className="text-lg">{profile.roll_number}</p>
                                </div>

                                {/* Editable fields */}
                                <div>
                                    <div className="flex items-center mb-2">
                                        <Phone className="h-4 w-4 mr-2" />
                                        <h3 className="text-sm font-medium text-muted-foreground">Phone Number</h3>
                                    </div>
                                    {editing ? (
                                        <Input
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="+91 9876543210"
                                        />
                                    ) : (
                                        <p className="text-lg">{profile.phone_number || "Not set"}</p>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center mb-2">
                                        <Key className="h-4 w-4 mr-2" />
                                        <h3 className="text-sm font-medium text-muted-foreground">Mess API Key</h3>
                                    </div>
                                    {editing ? (
                                        <Input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Your Mess API Key"
                                        />
                                    ) : (
                                        <p className="text-lg">
                                            {profile.api_key ? "••••••••••••••••" : "Not set"}
                                        </p>
                                    )}
                                </div>

                                <div className="text-sm text-muted-foreground">
                                    <p>Account created: {new Date(profile.created_at).toLocaleString()}</p>
                                    <p>Last signed in: {new Date(profile.last_signed_in).toLocaleString()}</p>
                                </div>

                                {editing && (
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="w-full"
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex justify-center items-center h-64">
                    <p>No profile information found.</p>
                </div>
            )}
        </div>
    )
}