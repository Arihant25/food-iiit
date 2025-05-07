import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { parseStringPromise } from "xml2js";

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
                    console.error("CAS Authentication Error:", error);
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