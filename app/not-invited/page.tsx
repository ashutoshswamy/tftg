import { SignOutButton } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function NotInvitedPage() {
  return (
    <AuthShell
      title="You have not been invited yet"
      intro="This account is not a member of the company. Ask an admin to invite your email from Organization, then sign in again."
    >
      <SignOutButton redirectUrl="/login">
        <button type="button" className="btn btn-secondary">
          Sign out
        </button>
      </SignOutButton>
    </AuthShell>
  );
}
