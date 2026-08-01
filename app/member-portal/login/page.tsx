import { redirect } from "next/navigation";

export default function MemberLoginRedirectPage() {
  redirect("/member-portal/auth/sign-in");
}
