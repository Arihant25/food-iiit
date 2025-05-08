import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

// Form validation schema
const formSchema = z.object({
    phone_number: z.string().min(10, {
        message: "Phone number must be at least 10 digits.",
    }),
    api_key: z.string().min(1, {
        message: "API key is required.",
    }),
})

type FormValues = z.infer<typeof formSchema>

type UserAuthFormProps = {
    isOpen: boolean
    onClose: () => void
}

export default function UserAuthForm({ isOpen, onClose }: UserAuthFormProps) {
    const { data: session, update } = useSession()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [needsInfo, setNeedsInfo] = useState(false)
    const [loading, setLoading] = useState(true)
    const [missingFields, setMissingFields] = useState<{
        phone_number: boolean,
        api_key: boolean
    }>({
        phone_number: false,
        api_key: false
    })

    // Initialize the form with react-hook-form
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            phone_number: "",
            api_key: "",
        },
    })

    // Check the database directly for user information
    useEffect(() => {
        async function checkUserInfo() {
            if (!isOpen || !session?.user?.rollNumber) return

            try {
                setLoading(true)

                // Query the database directly to check if user has phone number and API key
                const { data, error } = await supabase
                    .from('users')
                    .select('phone_number, api_key')
                    .eq('roll_number', session.user.rollNumber)
                    .single()

                if (error) {
                    console.error("Error fetching user data:", error)
                    // If there's an error, we'll assume we need both fields
                    setMissingFields({
                        phone_number: true,
                        api_key: true
                    })
                    setNeedsInfo(true)
                    return
                }

                // Check which fields are missing in the database
                const missingPhone = !data.phone_number
                const missingApiKey = !data.api_key

                setMissingFields({
                    phone_number: missingPhone,
                    api_key: missingApiKey
                })

                // Only show the form if at least one field is missing
                setNeedsInfo(missingPhone || missingApiKey)

                // Update form defaults
                form.reset({
                    phone_number: data.phone_number || "",
                    api_key: data.api_key || "",
                })

            } catch (error) {
                console.error("Error checking user info:", error)
            } finally {
                setLoading(false)
            }
        }

        checkUserInfo()
    }, [isOpen, session, form])

    const onSubmit = async (values: FormValues) => {
        if (!session?.user?.rollNumber) {
            toast.error("You must be logged in to update your profile")
            return
        }

        try {
            setIsSubmitting(true)

            // Update the user's profile in Supabase
            const updateData: any = {}

            // Only update fields that were missing
            if (missingFields.phone_number) {
                updateData.phone_number = values.phone_number
            }

            if (missingFields.api_key) {
                updateData.api_key = values.api_key
            }

            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('roll_number', session.user.rollNumber)

            if (error) {
                throw error
            }

            // Update the session to reflect the changes
            await update({
                ...session,
                user: {
                    ...session.user,
                    phoneNumber: missingFields.phone_number ? values.phone_number : session.user.phoneNumber,
                    apiKey: missingFields.api_key ? values.api_key : session.user.apiKey,
                }
            })

            toast.success("Profile updated successfully")
            onClose()
        } catch (error) {
            console.error("Error updating profile:", error)
            toast.error("Failed to update profile")
        } finally {
            setIsSubmitting(false)
        }
    }

    // If user has all required info or we're still loading, don't show the form
    if (!isOpen || !needsInfo || loading) {
        return null
    }

    return (
        <Dialog open={isOpen && needsInfo} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">We're almost there</DialogTitle>
                    <DialogDescription>
                        We just need {missingFields.phone_number && missingFields.api_key ? "two things" : "one thing"} from you to help connect buyers and sellers.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        {missingFields.phone_number && (
                            <FormField
                                control={form.control}
                                name="phone_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+91 9876543210" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        <Accordion type="single" collapsible>
                                            <AccordionItem value="why-phone-number">
                                                <AccordionTrigger className="text-sm">Why phone number?</AccordionTrigger>
                                                <AccordionContent>
                                                    We only show your number to people you approve to buy your meals. This helps connect buyers and sellers directly.
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </FormItem>
                                )}
                            />
                        )}

                        {missingFields.api_key && (
                            <FormField
                                control={form.control}
                                name="api_key"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mess API Key</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Your mess API key" type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        <Accordion type="single" collapsible>
                                            <AccordionItem value="how-get-api-key">
                                                <AccordionTrigger className="text-sm">How to get your API key?</AccordionTrigger>
                                                <AccordionContent>
                                                    You can get the API key from mess.iiit.ac.in &gt; Settings &gt; Auth Keys &gt; Create Auth key
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </FormItem>
                                )}
                            />
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Updating..." : "Update Profile"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}