import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UiLang = "am" | "en";

const STORAGE_KEY = "sst-lang";

type Dict = {
  brand: string;
  landing: {
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    stepsTitle: string;
    steps: string[];
    privacy: string;
    adminLogin: string;
    helpTitle: string;
    contacts: { role: string; name: string; phone: string }[];
  };
  auth: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    signIn: string;
    signUp: string;
    toSignUp: string;
    toSignIn: string;
    created: string;
    failed: string;
    back: string;
    loading: string;
  };
  admin: {
    title: string;
    subtitle: string;
    signOut: string;
    loading: string;
    noAccessTitle: string;
    noAccessBody: string;
    claim: string;
    claimed: string;
    claimFailed: string;
    total: string;
    today: string;
    week: string;
    month: string;
    search: string;
    all: string;
    male: string;
    female: string;
    refresh: string;
    empty: string;
    columns: {
      regId: string;
      fullName: string;
      christianName: string;
      gender: string;
      birthDate: string;
      motherName: string;
      motherPhone: string;
      fatherName: string;
      fatherPhone: string;
      created: string;
      status: string;
      actions: string;
    };
    view: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    detailsTitle: string;
    editTitle: string;
    deleteTitle: string;
    deleteBody: string;
    statusChanged: string;
    statusFailed: string;
    saved: string;
    saveFailed: string;
    deleted: string;
    deleteFailed: string;
    status: Record<string, string>;
    showing: (n: number, total: number) => string;
    tabRegistrations: string;
    tabSettings: string;
    ownerOnly: string;
    exportCsv: string;
    exportDone: string;
    exportFailed: string;
    admins: {
      title: string;
      desc: string;
      telegramId: string;
      chatId: string;
      label: string;
      role: string;
      active: string;
      roleOwner: string;
      roleAdmin: string;
      add: string;
      remove: string;
      saved: string;
      removed: string;
      failed: string;
      empty: string;
      hint: string;
    };
    help: {
      title: string;
      desc: string;
      fieldTitle: string;
      body: string;
      instructions: string;
      contacts: string;
      announcements: string;
      buttons: string;
      buttonText: string;
      buttonUrl: string;
      addButton: string;
      removeButton: string;
      preview: string;
      save: string;
      reset: string;
      saved: string;
      resetDone: string;
      failed: string;
    };
  };
};

const am: Dict = {
  brand: "ሰንበት ት/ቤት",
  landing: {
    badge: "🙏 ሰንበት ት/ቤት",
    title: "የተማሪዎች ምዝገባ በቴሌግራም",
    subtitle:
      "ምዝገባው በሙሉ በቴሌግራም ቦት አማካኝነት ይከናወናል። ቦቱን ከፍተው /start ብለው ይጀምሩ።",
    cta: "📝 ምዝገባ ጀምር",
    stepsTitle: "የሚጠየቁ መረጃዎች",
    steps: [
      "ሙሉ ስም ከነአያት",
      "የክርስትና ስም",
      "ጾታ",
      "የትውልድ ቀን (ቀን/ወር/ዓመት)",
      "የእናት ስም እና ስልክ",
      "የአባት ስም እና ስልክ",
    ],
    privacy: "🔒 የተማሪዎችና የወላጆች መረጃ በሚስጥር ተጠብቆ ይቀመጣል።",
    adminLogin: "🔐 የአስተዳዳሪ መግቢያ",
    helpTitle: "ለተጨማሪ መረጃ",
    contacts: [
      { role: "ግንኙነት ክፍል", name: "ቤተልሔም ዓለም", phone: "0977966450" },
      { role: "ትምህርት ክፍል", name: "ዲ/ን ትንሣኤ ጸጋዬ", phone: "0902872151" },
    ],
  },
  auth: {
    title: "የአስተዳዳሪ መግቢያ",
    subtitle: "የሰንበት ት/ቤት ምዝገባ መረጃ ለተፈቀደላቸው አስተዳዳሪዎች ብቻ ነው።",
    email: "ኢሜይል",
    password: "የመግቢያ ቃል",
    signIn: "ግባ",
    signUp: "መዝገብ ፍጠር",
    toSignUp: "አዲስ መዝገብ ፍጠር",
    toSignIn: "ወደ መግቢያ ተመለስ",
    created: "መዝገቡ ተፈጥሯል። ኢሜይልዎን ያረጋግጡ።",
    failed: "መግባት አልተቻለም። እባክዎ ይሞክሩ።",
    back: "⬅️ ወደ መነሻ",
    loading: "በመጫን ላይ...",
  },
  admin: {
    title: "የምዝገባ አስተዳደር",
    subtitle: "የሰንበት ት/ቤት ተማሪዎች ምዝገባ",
    signOut: "ውጣ",
    loading: "በመጫን ላይ...",
    noAccessTitle: "🔒 ፈቃድ አልተሰጠዎትም",
    noAccessBody: "ይህ ገጽ ለተፈቀደላቸው አስተዳዳሪዎች ብቻ ነው።",
    claim: "እኔን የመጀመሪያ አስተዳዳሪ አድርግ",
    claimed: "የአስተዳዳሪ ፈቃድ ተሰጥቷል።",
    claimFailed: "ፈቃድ መስጠት አልተቻለም።",
    total: "ጠቅላላ ምዝገባ",
    today: "የዛሬ",
    week: "የዚህ ሳምንት",
    month: "የዚህ ወር",
    search: "ስም፣ የምዝገባ ቁጥር ወይም ስልክ ይፈልጉ",
    all: "ሁሉም",
    male: "ወንድ",
    female: "ሴት",
    refresh: "አድስ",
    empty: "ምዝገባ አልተገኘም።",
    columns: {
      regId: "የምዝገባ ቁጥር",
      fullName: "ሙሉ ስም",
      christianName: "የክርስትና ስም",
      gender: "ጾታ",
      birthDate: "የትውልድ ቀን",
      motherName: "የእናት ስም",
      motherPhone: "የእናት ስልክ",
      fatherName: "የአባት ስም",
      fatherPhone: "የአባት ስልክ",
      created: "የምዝገባ ቀን",
      status: "ሁኔታ",
      actions: "እርምጃ",
    },
    view: "ዝርዝር",
    edit: "አስተካክል",
    delete: "ሰርዝ",
    save: "አስቀምጥ",
    cancel: "አይ",
    detailsTitle: "የምዝገባ ዝርዝር",
    editTitle: "ምዝገባ አስተካክል",
    deleteTitle: "ምዝገባውን ይሰርዙ?",
    deleteBody: "ይህ እርምጃ መመለስ አይችልም።",
    statusChanged: "ሁኔታው ተቀይሯል።",
    statusFailed: "ሁኔታውን መቀየር አልተቻለም።",
    saved: "ተስተካክሏል።",
    saveFailed: "ማስተካከል አልተቻለም። መረጃውን ያረጋግጡ።",
    deleted: "ተሰርዟል።",
    deleteFailed: "መሰረዝ አልተቻለም።",
    status: {
      pending: "በመጠባበቅ",
      approved: "ተቀብሏል",
      rejected: "ተቀባይነት አላገኘም",
    },
    showing: (n, total) => `${n} ከ ${total} ምዝገባዎች`,
    tabRegistrations: "ምዝገባዎች",
    tabSettings: "⚙️ ቅንብሮች",
    ownerOnly: "ይህ ክፍል ለባለቤት (Owner) ብቻ ነው።",
    exportCsv: "⬇️ CSV አውርድ",
    exportDone: "ፋይሉ ተዘጋጅቷል።",
    exportFailed: "ማውረድ አልተቻለም።",
    admins: {
      title: "የቴሌግራም አስተዳዳሪዎች",
      desc: "አዲስ ምዝገባ ሲመጣ ማሳወቂያ የሚደርሳቸው አስተዳዳሪዎች።",
      telegramId: "የቴሌግራም መለያ (ID)",
      chatId: "የቻት መለያ (አማራጭ)",
      label: "ስም / መግለጫ",
      role: "ደረጃ",
      active: "ንቁ",
      roleOwner: "ባለቤት",
      roleAdmin: "አስተዳዳሪ",
      add: "አክል / አስቀምጥ",
      remove: "አስወግድ",
      saved: "አስተዳዳሪው ተቀምጧል።",
      removed: "አስተዳዳሪው ተወግዷል።",
      failed: "እርምጃው አልተሳካም።",
      empty: "እስካሁን አስተዳዳሪ አልተመዘገበም።",
      hint: "አስተዳዳሪው በቦቱ ላይ /id ብሎ የቴሌግራም መለያውን ማግኘት ይችላል።",
    },
    help: {
      title: "እገዛ እና መረጃ",
      desc: "እዚህ የሚቀመጠው ጽሑፍ በቴሌግራም ቦቱ ወዲያውኑ ይታያል።",
      fieldTitle: "አርዕስት",
      body: "መግለጫ",
      instructions: "መመሪያ",
      contacts: "የመገኛ አድራሻዎች",
      announcements: "ማስታወቂያ",
      buttons: "አዝራሮች / ሊንኮች",
      buttonText: "የአዝራር ጽሑፍ",
      buttonUrl: "ሊንክ (https://)",
      addButton: "አዝራር አክል",
      removeButton: "አስወግድ",
      preview: "ቅድመ እይታ",
      save: "አስቀምጥ",
      reset: "ወደ ነባሩ መልስ",
      saved: "ተቀምጧል።",
      resetDone: "ወደ ነባሩ ተመልሷል።",
      failed: "ማስቀመጥ አልተቻለም።",
    },
  },
};

const en: Dict = {
  brand: "Sunday School",
  landing: {
    badge: "🙏 ሰንበት ት/ቤት",
    title: "Student registration on Telegram",
    subtitle:
      "Registration happens entirely inside our Telegram bot. Open the bot and send /start to begin.",
    cta: "📝 Start registration",
    stepsTitle: "What you will be asked",
    steps: [
      "Full name (with grandfather's name)",
      "Christian name",
      "Gender",
      "Date of birth (DD/MM/YYYY, Ethiopian calendar)",
      "Mother's name and phone",
      "Father's name and phone",
    ],
    privacy: "🔒 Student and parent details are stored privately and securely.",
    adminLogin: "🔐 Admin login",
    helpTitle: "Need help?",
    contacts: [
      { role: "Public Relations", name: "Betlehem Alem", phone: "0977966450" },
      {
        role: "Education Department",
        name: "Deacon Tinsae Tsegaye",
        phone: "0902872151",
      },
    ],
  },
  auth: {
    title: "Admin login",
    subtitle: "Registration data is available to authorised administrators only.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Create account",
    toSignUp: "Create a new account",
    toSignIn: "Back to sign in",
    created: "Account created. Please confirm your email.",
    failed: "Sign in failed. Please try again.",
    back: "⬅️ Back home",
    loading: "Loading...",
  },
  admin: {
    title: "Registration management",
    subtitle: "Sunday School student registrations",
    signOut: "Sign out",
    loading: "Loading...",
    noAccessTitle: "🔒 No access",
    noAccessBody: "This page is for authorised administrators only.",
    claim: "Make me the first administrator",
    claimed: "Administrator access granted.",
    claimFailed: "Could not grant administrator access.",
    total: "Total registrations",
    today: "Today",
    week: "This week",
    month: "This month",
    search: "Search name, registration ID or phone",
    all: "All",
    male: "Male",
    female: "Female",
    refresh: "Refresh",
    empty: "No registrations found.",
    columns: {
      regId: "Registration ID",
      fullName: "Full name",
      christianName: "Christian name",
      gender: "Gender",
      birthDate: "Date of birth",
      motherName: "Mother's name",
      motherPhone: "Mother's phone",
      fatherName: "Father's name",
      fatherPhone: "Father's phone",
      created: "Registered on",
      status: "Status",
      actions: "Actions",
    },
    view: "Details",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    detailsTitle: "Registration details",
    editTitle: "Edit registration",
    deleteTitle: "Delete this registration?",
    deleteBody: "This action cannot be undone.",
    statusChanged: "Status updated.",
    statusFailed: "Could not update the status.",
    saved: "Changes saved.",
    saveFailed: "Could not save. Please check the details.",
    deleted: "Registration deleted.",
    deleteFailed: "Could not delete the registration.",
    status: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    },
    showing: (n, total) => `Showing ${n} of ${total} registrations`,
    tabRegistrations: "Registrations",
    tabSettings: "⚙️ Settings",
    ownerOnly: "This section is available to the owner only.",
    exportCsv: "⬇️ Export CSV",
    exportDone: "Export ready.",
    exportFailed: "Could not export.",
    admins: {
      title: "Telegram admins",
      desc: "Everyone listed here receives a notification for each new registration.",
      telegramId: "Telegram ID",
      chatId: "Chat ID (optional)",
      label: "Name / note",
      role: "Role",
      active: "Active",
      roleOwner: "Owner",
      roleAdmin: "Admin",
      add: "Add / save",
      remove: "Remove",
      saved: "Admin saved.",
      removed: "Admin removed.",
      failed: "That action failed.",
      empty: "No Telegram admins yet.",
      hint: "An admin can send /id to the bot to get their Telegram ID.",
    },
    help: {
      title: "Help & Information",
      desc: "Whatever you save here appears in the Telegram bot immediately.",
      fieldTitle: "Title",
      body: "Description",
      instructions: "Instructions",
      contacts: "Contacts",
      announcements: "Announcements",
      buttons: "Buttons / links",
      buttonText: "Button label",
      buttonUrl: "Link (https://)",
      addButton: "Add button",
      removeButton: "Remove",
      preview: "Preview",
      save: "Save",
      reset: "Reset to default",
      saved: "Saved.",
      resetDone: "Reset to the default text.",
      failed: "Could not save.",
    },
  },
};

export const UI: Record<UiLang, Dict> = { am, en };

type Ctx = { lang: UiLang; setLang: (l: UiLang) => void; t: Dict };

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("am");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "am") setLangState(stored);
  }, []);

  const setLang = (next: UiLang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t: UI[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useUiLang(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useUiLang must be used inside LanguageProvider");
  return ctx;
}

/** Gender values are stored in Amharic; only the label is translated. */
export function genderLabel(stored: string, lang: UiLang): string {
  if (stored === "ወንድ") return UI[lang].admin.male;
  if (stored === "ሴት") return UI[lang].admin.female;
  return stored;
}
