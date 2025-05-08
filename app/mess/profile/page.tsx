"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { formatRelativeTime, formatJoinDate } from "@/lib/utils"

import { PageHeading } from "@/components/ui/page-heading"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Save, User, Key, Phone, Mail, Calendar, Clock, IdCard } from "lucide-react"

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <PageHeading title="My Profile" />
            {profile && (
                <div className="flex justify-end">
                {!editing ? (
                    <Button onClick={() => setEditing(true)} size="sm">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Profile
                    </Button>
                ) : (
                    <Button onClick={() => setEditing(false)} size="sm" variant="noShadow">
                    Cancel
                    </Button>
                )}
                </div>
            )}
            </div>

            {profile ? (
                <div className="mx-auto">
                    <div className="flex flex-col md:flex-wrap md:flex-row gap-4 justify-center">
                        {/* Name */}
                        <Card className="w-full md:w-auto">
                            <CardContent className="p-6">
                                <div className="flex items-center mb-2">
                                    <User className="h-5 w-5 mr-2 text-primary" />
                                    <h3 className="text-2xl font-bold text-muted-foreground">Name</h3>
                                </div>
                                <p className="text-lg break-words">{profile.name}</p>
                            </CardContent>
                        </Card>

                        {/* Email */}
                        <Card className="w-full md:w-auto">
                            <CardContent className="p-6">
                                <div className="flex items-center mb-2">
                                    <Mail className="h-5 w-5 mr-2 text-primary" />
                                    <h3 className="text-2xl font-bold text-muted-foreground">Email</h3>
                                </div>
                                <p className="text-lg break-words">{profile.email}</p>
                            </CardContent>
                        </Card>

                        {/* Roll Number */}
                        <Card className="w-full md:w-auto">
                            <CardContent className="p-6">
                                <div className="flex items-center mb-2">
                                    <IdCard className="h-5 w-5 mr-2 text-primary" />
                                    <h3 className="text-2xl font-bold text-muted-foreground">Roll Number</h3>
                                </div>
                                <p className="text-lg break-words">{profile.roll_number}</p>
                            </CardContent>
                        </Card>

                        {/* Phone Number */}
                        <Card className="w-full md:w-auto">
                            <CardContent className="p-6">
                                <div className="flex items-center mb-2">
                                    <Phone className="h-5 w-5 mr-2 text-primary" />
                                    <h3 className="text-2xl font-bold text-muted-foreground">Phone Number</h3>
                                </div>
                                {editing ? (
                                    <Input
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="+91 9876543210"
                                        className="mt-2"
                                    />
                                ) : (
                                    <p className="text-lg break-words">{profile.phone_number || "Not set"}</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* API Key */}
                        <Card className="w-full md:w-auto">
                            <CardContent className="p-6">
                                <div className="flex items-center mb-2">
                                    <Key className="h-5 w-5 mr-2 text-primary" />
                                    <h3 className="text-2xl font-bold text-muted-foreground">Mess API Key</h3>
                                </div>
                                {editing ? (
                                    <Input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Your Mess API Key"
                                        className="mt-2"
                                    />
                                ) : (
                                    <p className="text-lg break-words">
                                        {profile.api_key ? "••••••••••••••••" : "Not set"}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Account Info */}
                        <Card className="w-full md:w-auto">
                            <CardContent className="p-6">
                                <div className="space-y-3">
                                    <div className="flex items-center">
                                        <Calendar className="h-5 w-5 mr-2 text-primary" />
                                        <p className="break-words">{formatJoinDate(profile.created_at)}</p>
                                    </div>
                                    <div className="flex items-center">
                                        <Clock className="h-5 w-5 mr-2 text-primary" />
                                        <p className="break-words">Last active {formatRelativeTime(profile.last_signed_in)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Save Button */}
                    {editing && (
                        <Button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="w-full mt-6"
                            size="lg"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex justify-center items-center h-64">
                    <p>No profile information found.</p>
                </div>
            )}
        </div>
    )
}