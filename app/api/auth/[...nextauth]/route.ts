import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { parseStringPromise } from "xml2js";
import { supabase } from "@/lib/supabaseClient";

// Define the CAS attributes interface
interface CASAttributes {
    "cas:clientIpAddress"?: string[];
    "cas:RollNo"?: string[];
    "cas:E-Mail"?: string[];
    "cas:isFromNewLogin"?: string[];
    "cas:authenticationDate"?: string[];
    "cas:FirstName"?: string[];
    "cas:successfulAuthenticationHandlers"?: string[];
    "cas:userAgent"?: string[];
    "cas:Name"?: string[];
    "cas:credentialType"?: string[];
    "cas:samlAuthenticationStatementAuthMethod"?: string[];
    "cas:uid"?: string[];
    "cas:authenticationMethod"?: string[];
    "cas:serverIpAddress"?: string[];
    "cas:longTermAuthenticationRequestTokenUsed"?: string[];
    "cas:LastName"?: string[];
}

interface CASResponse {
    "cas:serviceResponse"?: {
        "cas:authenticationSuccess"?: [
            {
                "cas:user": string[];
                "cas:attributes": [CASAttributes];
            }
        ];
        "cas:authenticationFailure"?: [
            {
                _: string;
                $: { code: string };
            }
        ];
    };
}

// Create the auth configuration
const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "IIIT CAS",
            credentials: {
                ticket: { label: "Ticket", type: "text" },
                service: { label: "Service", type: "text" },
            },
            async authorize(credentials) {
                try {
                    // Get the ticket from the credentials
                    const ticket = credentials?.ticket;
                    const service = credentials?.service || process.env.NEXTAUTH_URL;

                    if (!ticket) {
                        throw new Error("No CAS ticket provided");
                    }

                    if (!service) {
                        throw new Error("No service URL provided");
                    }

                    // Use the service URL exactly as provided
                    const validationUrl = `https://login.iiit.ac.in/cas/serviceValidate?ticket=${ticket}&service=${encodeURIComponent(
                        service
                    )}`;
                    console.log("Validating CAS ticket with URL:", validationUrl);

                    // Validate the ticket with the CAS server
                    const response = await fetch(validationUrl);
                    const xmlResponse = await response.text();
                    console.log("CAS XML Response:", xmlResponse);

                    // Parse the XML response
                    const result = (await parseStringPromise(xmlResponse)) as CASResponse;

                    // Check for authentication failures first
                    if (result["cas:serviceResponse"]?.["cas:authenticationFailure"]) {
                        const failure =
                            result["cas:serviceResponse"]["cas:authenticationFailure"][0];
                        throw new Error(
                            `CAS authentication failed: ${failure._ || failure.$.code}`
                        );
                    }

                    const authSuccess =
                        result["cas:serviceResponse"]?.["cas:authenticationSuccess"]?.[0];

                    if (!authSuccess) {
                        throw new Error("CAS authentication failed: No success response");
                    }

                    // Extract user information
                    const username = authSuccess["cas:user"][0];
                    const attributes = authSuccess["cas:attributes"]?.[0];

                    if (!attributes) {
                        throw new Error("No attributes found in CAS response");
                    }

                    const email =
                        attributes["cas:E-Mail"]?.[0] || `${username}@iiit.ac.in`;
                    const firstName = attributes["cas:FirstName"]?.[0] || username;
                    const lastName = attributes["cas:LastName"]?.[0] || "";
                    const rollNo = attributes["cas:RollNo"]?.[0] || username;

                    // Return the user object
                    return {
                        id: username,
                        email,
                        name: firstName && lastName ? `${firstName} ${lastName}` : username,
                        rollNumber: rollNo,
                    };
                } catch (error) {
                    return null;
                }
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 1 day
    },
    callbacks: {
        async jwt({ token, user }) {
            // Add user info to the token
            if (user) {
                token.rollNumber = user.rollNumber;

                // Check if user exists in our database, add if not
                try {
                    // First check if the user already exists
                    const { data: existingUser, error: checkError } = await supabase
                        .from('users')
                        .select('id, last_signed_in')
                        .eq('roll_number', user.rollNumber)
                        .single();

                    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
                        console.error("Error checking if user exists:", checkError);
                    }

                    const currentTime = new Date().toISOString();

                    if (!existingUser) {
                        // User doesn't exist, add them to the database
                        console.log(`Adding new user to database: ${user.name} (${user.rollNumber})`);
                        const { error: insertError } = await supabase
                            .from('users')
                            .insert({
                                name: user.name,
                                roll_number: user.rollNumber,
                                email: user.email,
                                created_at: currentTime,
                                last_signed_in: currentTime
                            });

                        if (insertError) {
                            console.error("Error adding user to database:", insertError);
                        }
                    } else {
                        // User exists, update last_signed_in time
                        const { error: updateError } = await supabase
                            .from('users')
                            .update({ last_signed_in: currentTime })
                            .eq('roll_number', user.rollNumber);

                        if (updateError) {
                            console.error("Error updating user sign-in time:", updateError);
                        }
                    }
                } catch (error) {
                    console.error("Error in user database operation:", error);
                }
            }
            return token;
        },
        async session({ session, token }) {
            // Add custom properties to the session
            if (token && session.user) {
                session.user.rollNumber = token.rollNumber as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/",
        error: "/",
    },
    debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };