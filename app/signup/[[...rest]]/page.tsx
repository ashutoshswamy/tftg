import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

// Anyone can create an account. What happens next (set up the company, or
// join one you were invited to) is decided in lib/auth.ts, not here.
export default function SignupPage() {
  return (
    <AuthShell>
      <SignUp path="/signup" routing="path" signInUrl="/login" />
    </AuthShell>
  );
}
