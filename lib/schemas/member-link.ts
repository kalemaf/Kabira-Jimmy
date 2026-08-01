import { z } from "zod";

// Links a self-signed-up member-portal account to a real Member record.
// Requiring BOTH the member number AND the phone on file (rather than just
// the number, which is sequential and guessable) stops one member from
// claiming another member's account by trying member numbers at random.
export const linkMemberSchema = z.object({
  memberNumber: z.string().min(1, "Member number is required"),
  phone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
});

export type LinkMemberInput = z.infer<typeof linkMemberSchema>;
