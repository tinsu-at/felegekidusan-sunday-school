/**
 * Registration confirmation email to the school inbox.
 *
 * Sending real email requires a verified sender domain for this project
 * (Cloud → Emails). Until that exists there is no real send path, so this
 * helper reports `email_not_configured` instead of pretending an email was
 * sent. Nothing here reads, returns, or logs credentials.
 */

export type RegistrationEmailInput = {
  registrationId: string;
  fullName: string;
  christianName: string;
  gender: string;
  birthDateEc: string;
  motherName: string;
  motherPhone?: string;
  fatherName: string;
  fatherPhone?: string;
  createdAt: string;
};

export type RegistrationEmailResult =
  | { sent: true }
  | {
      sent: false;
      reason: "email_not_configured" | "no_recipient" | "send_failed";
    };

const CONTACTS = [
  "ግንኙነት ክፍል / Public Relations - ቤተልሔም (Betlehem) - 0977966450",
  "ትምህርት ክፍል / Education Department - ዲ/ን ትንሣኤ ጸጋዬ (Deacon Tinsae Tsegaye) - 0902872151",
];

export function buildRegistrationEmail(input: RegistrationEmailInput) {
  const subject = `ሰንበት ት/ቤት Registration Confirmation - ${input.registrationId}`;
  const lines = [
    `🆔 Registration ID: ${input.registrationId}`,
    "",
    "Student information",
    `• Full name: ${input.fullName}`,
    `• Christian name: ${input.christianName}`,
    `• Gender: ${input.gender}`,
    `• Date of birth (Ethiopian calendar): ${input.birthDateEc}`,
    "",
    "Parent information",
    `• Mother: ${input.motherName}${input.motherPhone ? ` — ${input.motherPhone}` : ""}`,
    `• Father: ${input.fatherName}${input.fatherPhone ? ` — ${input.fatherPhone}` : ""}`,
    "",
    `Registration date: ${new Date(input.createdAt).toISOString().slice(0, 10)}`,
    "",
    "Contact information:",
    ...CONTACTS,
  ];
  return { subject, text: lines.join("\n") };
}

export async function sendRegistrationEmail(
  input: RegistrationEmailInput,
): Promise<RegistrationEmailResult> {
  const to = process.env["SCHOOL_NOTIFICATION_EMAIL"];
  if (!to) return { sent: false, reason: "no_recipient" };

  // The managed send helper and templates are generated for this project only
  // after a sender domain the school owns is verified. Until then we never
  // report a success that did not happen.
  console.warn(
    `Registration ${input.registrationId}: confirmation email skipped — no verified sender domain configured`,
  );
  return { sent: false, reason: "email_not_configured" };
}
