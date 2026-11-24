import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell>
      <SignIn path="/login" routing="path" signUpUrl="/signup" />
    </AuthShell>
  );
}
