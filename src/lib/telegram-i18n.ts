/**
 * Bilingual (አማርኛ / English) copy for the ሰንበት ት/ቤት registration bot.
 * Stored database values (gender, FKN ids) are never translated.
 */

export type Lang = "am" | "en";

export const LANGS: Lang[] = ["am", "en"];

export function asLang(value: unknown): Lang {
  return value === "en" ? "en" : "am";
}

type Dict = {
  chooseLanguage: string;
  languageSet: string;
  welcome: string;
  btnStart: string;
  btnHelp: string;
  btnHome: string;
  btnLanguage: string;
  btnMale: string;
  btnFemale: string;
  btnConfirm: string;
  btnCancel: string;
  help: string;
  contacts: string;
  questions: Record<
    | "full_name"
    | "christian_name"
    | "gender"
    | "birth_date_ec"
    | "mother_name"
    | "mother_phone"
    | "father_name"
    | "father_phone",
    string
  >;
  summaryTitle: string;
  labels: {
    regId: string;
    fullName: string;
    christianName: string;
    gender: string;
    birthDate: string;
    motherName: string;
    motherPhone: string;
    fatherName: string;
    fatherPhone: string;
  };
  summaryQuestion: string;
  errName: string;
  errChristianName: string;
  errPhone: string;
  errDate: (maxYear: number) => string;
  cancelled: string;
  saveFailed: string;
  success: (regId: string) => string;
  gender: { male: string; female: string };
};

const am: Dict = {
  chooseLanguage: "🌐 እባክዎ ቋንቋ ይምረጡ\n\nPlease choose your language.",
  languageSet: "✅ ቋንቋው ወደ አማርኛ ተቀይሯል።",
  welcome:
    "🙏 እንኳን ወደ ሰንበት ት/ቤት ምዝገባ በደህና መጡ!\n\nየተማሪውን መረጃ በመሙላት ለምዝገባ ይጀምሩ።",
  btnStart: "📝 ምዝገባ ጀምር",
  btnHelp: "❓ እገዛ / ተጨማሪ መረጃ",
  btnHome: "🏠 ወደ መነሻ",
  btnLanguage: "🌐 ቋንቋ ቀይር / Language",
  btnMale: "ወንድ",
  btnFemale: "ሴት",
  btnConfirm: "✅ አዎ፣ አረጋግጣለሁ",
  btnCancel: "❌ ሰርዝ",
  help: [
    "📖 ስለ ምዝገባው ተጨማሪ መረጃ",
    "",
    "የሰንበት ት/ቤት ምዝገባ ለማድረግ እባክዎ የሚጠየቁትን የተማሪ እና የወላጆች መረጃ በትክክል ያስገቡ።",
    "",
    "ለተጨማሪ መረጃ ወይም ጥያቄ ከሚከተሉት ክፍሎች ጋር ይገናኙ።",
    "",
    "📞 ግንኙነት ክፍል - ቤተልሔም ዓለም",
    "0977966450",
    "",
    "📚 ትምህርት ክፍል - ዲ/ን ትንሣኤ ጸጋዬ",
    "0902872151",
  ].join("\n"),
  contacts:
    "📞 ለተጨማሪ መረጃ እባክዎ ያነጋግሩ፦\n\nግንኙነት ክፍል - ቤተልሔም ዓለም\n0977966450\n\nትምህርት ክፍል - ዲ/ን ትንሣኤ ጸጋዬ\n0902872151",
  questions: {
    full_name: "1️⃣ ሙሉ ስም ከነአያት\n\nእባክዎ ሙሉ ስምዎን በአማርኛ ያስገቡ።",
    christian_name: "2️⃣ የክርስትና ስም\n\nእባክዎ የክርስትና ስምዎን በአማርኛ ያስገቡ።",
    gender: "3️⃣ ጾታ\n\nእባክዎ ጾታዎን ይምረጡ።",
    birth_date_ec:
      "4️⃣ የትውልድ ቀን\n\nእባክዎ የትውልድ ቀኑን በኢትዮጵያ አቆጣጠር ሙሉ በሙሉ ያስገቡ።\n\nቅርጸት፦ ቀን/ወር/ዓመት\nለምሳሌ፦ 15/03/2012",
    mother_name: "5️⃣ የእናት ስም\n\nእባክዎ የእናቱን ሙሉ ስም ከነአያት በአማርኛ ያስገቡ።",
    mother_phone:
      "6️⃣ የእናት ስልክ\n\nእባክዎ የእናቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
    father_name: "7️⃣ የአባት ስም\n\nእባክዎ የአባቱን ሙሉ ስም ከነአያት በአማርኛ ያስገቡ።",
    father_phone:
      "8️⃣ የአባት ስልክ\n\nእባክዎ የአባቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
  },
  summaryTitle: "📋 ያስገቡት መረጃ",
  labels: {
    regId: "🆔 የምዝገባ ቁጥር",
    fullName: "👤 ሙሉ ስም",
    christianName: "✝️ የክርስትና ስም",
    gender: "⚥ ጾታ",
    birthDate: "🎂 የትውልድ ቀን",
    motherName: "👩 የእናት ስም",
    motherPhone: "📞 የእናት ስልክ",
    fatherName: "👨 የአባት ስም",
    fatherPhone: "📞 የአባት ስልክ",
  },
  summaryQuestion: "መረጃው ትክክል ነው?",
  errName: "❌ እባክዎ ስሙን በአማርኛ በሦስት ቃላት ብቻ ያስገቡ።",
  errChristianName: "❌ እባክዎ የክርስትና ስሙን በአማርኛ ብቻ ያስገቡ።",
  errPhone:
    "⚠️ የስልክ ቁጥሩ ትክክል አይደለም። እባክዎ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
  errDate: (maxYear) =>
    `⚠️ የትውልድ ቀኑ ትክክል አይደለም። እባክዎ ሙሉ ቀኑን በኢትዮጵያ አቆጣጠር በቅርጸት ቀን/ወር/ዓመት ያስገቡ (ዓመት ከ1950 እስከ ${maxYear})።\n\nለምሳሌ፦ 15/03/2012`,
  cancelled: "❌ ምዝገባው ተሰርዟል። ምንም መረጃ አልተቀመጠም።",
  saveFailed: "⚠️ ምዝገባውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
  success: (regId) =>
    `✅ የሰንበት ት/ቤት ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!\n\n🆔 የምዝገባ ቁጥር፦ ${regId}\n\nእባክዎ የምዝገባ ቁጥርዎን ያስቀምጡ።`,
  gender: { male: "ወንድ", female: "ሴት" },
};

const en: Dict = {
  chooseLanguage: "🌐 Please choose your language\n\nእባክዎ ቋንቋ ይምረጡ።",
  languageSet: "✅ Language set to English.",
  welcome:
    "🙏 Welcome to the ሰንበት ት/ቤት (Sunday School) registration!\n\nFill in the student's details to register.",
  btnStart: "📝 Start registration",
  btnHelp: "❓ Help / More info",
  btnHome: "🏠 Home",
  btnLanguage: "🌐 Change language / ቋንቋ",
  btnMale: "Male",
  btnFemale: "Female",
  btnConfirm: "✅ Yes, confirm",
  btnCancel: "❌ Cancel",
  help: [
    "📖 About the registration",
    "",
    "To register for Sunday School, please enter the requested student and parent details accurately.",
    "",
    "For more information or questions, contact:",
    "",
    "📞 Public Relations - Betlehem Alem",
    "0977966450",
    "",
    "📚 Education Department - Deacon Tinsae Tsegaye",
    "0902872151",
  ].join("\n"),
  contacts:
    "📞 For more information, please contact:\n\nPublic Relations - Betlehem Alem\n0977966450\n\nEducation Department - Deacon Tinsae Tsegaye\n0902872151",
  questions: {
    full_name:
      "1️⃣ Full name (with grandfather's name)\n\nPlease enter the student's full name in three words.",
    christian_name: "2️⃣ Christian name\n\nPlease enter the Christian name.",
    gender: "3️⃣ Gender\n\nPlease choose the gender.",
    birth_date_ec:
      "4️⃣ Date of birth\n\nPlease enter the full date of birth in the Ethiopian calendar.\n\nFormat: DD/MM/YYYY\nExample: 15/03/2012",
    mother_name: "5️⃣ Mother's name\n\nPlease enter the mother's full name in three words.",
    mother_phone:
      "6️⃣ Mother's phone\n\nPlease enter the mother's phone number.\n\nExample: 0912345678 or +251912345678",
    father_name: "7️⃣ Father's name\n\nPlease enter the father's full name in three words.",
    father_phone:
      "8️⃣ Father's phone\n\nPlease enter the father's phone number.\n\nExample: 0912345678 or +251912345678",
  },
  summaryTitle: "📋 Your details",
  labels: {
    regId: "🆔 Registration ID",
    fullName: "👤 Full name",
    christianName: "✝️ Christian name",
    gender: "⚥ Gender",
    birthDate: "🎂 Date of birth (EC)",
    motherName: "👩 Mother's name",
    motherPhone: "📞 Mother's phone",
    fatherName: "👨 Father's name",
    fatherPhone: "📞 Father's phone",
  },
  summaryQuestion: "Is this information correct?",
  errName:
    "❌ Please enter the name in exactly three words (Amharic or English letters only).",
  errChristianName: "❌ Please enter the Christian name using letters only.",
  errPhone:
    "⚠️ That phone number is not valid. Please enter an Ethiopian phone number.\n\nExample: 0912345678 or +251912345678",
  errDate: (maxYear) =>
    `⚠️ That date of birth is not valid. Please use the Ethiopian calendar in DD/MM/YYYY format (year between 1950 and ${maxYear}).\n\nExample: 15/03/2012`,
  cancelled: "❌ Registration cancelled. Nothing was saved.",
  saveFailed: "⚠️ We could not save the registration. Please try again.",
  success: (regId) =>
    `✅ Your Sunday School registration is complete!\n\n🆔 Registration ID: ${regId}\n\nPlease keep your registration ID safe.`,
  gender: { male: "Male", female: "Female" },
};

export const T: Record<Lang, Dict> = { am, en };
