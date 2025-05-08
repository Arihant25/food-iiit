import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extend the User type to include the rollNumber property
   */
  interface User {
    rollNumber?: string;
  }

  /**
   * Extend the Session type to include the rollNumber property
   */
  interface Session {
    user: {
      rollNumber?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend the JWT type to include the rollNumber property
   */
  interface JWT {
    rollNumber?: string;
  }
}