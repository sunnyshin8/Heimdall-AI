import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        // MVP: Hardcoded credentials
        if (credentials?.username === "admin" && credentials?.password === "admin") {
          return { id: "1", name: "AgentGuard Admin", email: "admin@agentguard.local" };
        }
        return null;
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET || "super-secret-agentguard-key-123",
});

export { handler as GET, handler as POST };
