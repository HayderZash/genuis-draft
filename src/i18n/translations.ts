export type Lang = 'ar' | 'en';

export const translations = {
  // Nav & General
  appName: { ar: 'منصة البحث الأكاديمي', en: 'Academic Research Platform' },
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  logout: { ar: 'تسجيل الخروج', en: 'Logout' },
  login: { ar: 'تسجيل الدخول', en: 'Login' },
  signup: { ar: 'إنشاء حساب', en: 'Sign Up' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  displayName: { ar: 'الاسم', en: 'Display Name' },
  noAccount: { ar: 'ليس لديك حساب؟', en: "Don't have an account?" },
  haveAccount: { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
  confirmEmail: { ar: 'تم إرسال رابط التأكيد إلى بريدك الإلكتروني', en: 'A confirmation link has been sent to your email' },

  // Dashboard
  myProjects: { ar: 'مشاريعي البحثية', en: 'My Research Projects' },
  newProject: { ar: 'مشروع جديد', en: 'New Project' },
  noProjects: { ar: 'لا توجد مشاريع بعد. ابدأ بإنشاء مشروع جديد!', en: 'No projects yet. Start by creating a new one!' },
  draft: { ar: 'مسودة', en: 'Draft' },
  generating: { ar: 'جاري التوليد', en: 'Generating' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  deleteProject: { ar: 'حذف', en: 'Delete' },
  openProject: { ar: 'فتح', en: 'Open' },

  // Settings
  aiProvider: { ar: 'مزود الذكاء الاصطناعي', en: 'AI Provider' },
  apiKeyLabel: { ar: 'مفتاح API', en: 'API Key' },
  openaiApiKeyPlaceholder: { ar: 'أدخل مفتاح OpenAI API...', en: 'Enter your OpenAI API key...' },
  geminiApiKeyPlaceholder: { ar: 'أدخل مفتاح Gemini API...', en: 'Enter your Gemini API key...' },
  apiKeySaved: { ar: 'تم حفظ الإعدادات بنجاح', en: 'Settings saved successfully' },
  apiKeyRequired: { ar: 'يرجى إدخال مفتاح API في الإعدادات أولاً', en: 'Please enter your API key in Settings first' },
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  language: { ar: 'اللغة', en: 'Language' },
  interfaceLanguage: { ar: 'لغة الواجهة', en: 'Interface Language' },

  // Project Input
  researchTitle: { ar: 'عنوان البحث', en: 'Research Title' },
  researchAbstract: { ar: 'تفاصيل البحث / الملخص', en: 'Research Details / Abstract' },
  researchLanguage: { ar: 'لغة البحث', en: 'Research Language' },
  arabic: { ar: 'العربية', en: 'Arabic' },
  english: { ar: 'الإنجليزية', en: 'English' },
  customReferences: { ar: 'مراجع مخصصة (اختياري)', en: 'Custom References (Optional)' },
  customReferencesPlaceholder: { ar: 'الصق روابط أو أسماء كتب...', en: 'Paste links or book titles...' },
  chapterCount: { ar: 'عدد الفصول', en: 'Number of Chapters' },
  chapters: { ar: 'الفصول', en: 'Chapters' },
  chapterName: { ar: 'اسم الفصل', en: 'Chapter Name' },
  addChapter: { ar: 'إضافة فصل', en: 'Add Chapter' },
  lockedStructure: { ar: 'هيكل ثابت (5 فصول)', en: 'Fixed structure (5 chapters)' },
  generateResearch: { ar: 'توليد البحث', en: 'Generate Research' },
  projectInputs: { ar: 'مدخلات المشروع', en: 'Project Inputs' },

  // Default chapters
  ch_introduction: { ar: 'المقدمة', en: 'Introduction' },
  ch_literature: { ar: 'الإطار النظري والدراسات السابقة', en: 'Literature Review' },
  ch_methodology: { ar: 'المنهجية', en: 'Methodology' },
  ch_results: { ar: 'النتائج والمناقشة', en: 'Results & Discussion' },
  ch_conclusion: { ar: 'الخاتمة', en: 'Conclusion' },
  ch_recommendations: { ar: 'التوصيات', en: 'Recommendations' },

  // Generation Progress
  analyzingTopic: { ar: 'جاري تحليل الموضوع...', en: 'Analyzing Topic...' },
  draftingChapter: { ar: 'كتابة الفصل', en: 'Drafting Chapter' },
  formattingCitations: { ar: 'تنسيق المراجع...', en: 'Formatting Citations...' },
  finalizing: { ar: 'إنهاء البحث...', en: 'Finalizing...' },

  // Editor
  editor: { ar: 'المحرر', en: 'Editor' },
  preview: { ar: 'معاينة', en: 'Preview' },
  pageSettings: { ar: 'إعدادات الصفحة', en: 'Page Settings' },
  margins: { ar: 'الهوامش', en: 'Margins' },
  top: { ar: 'أعلى', en: 'Top' },
  bottom: { ar: 'أسفل', en: 'Bottom' },
  left: { ar: 'يسار', en: 'Left' },
  right: { ar: 'يمين', en: 'Right' },
  downloadWord: { ar: 'تحميل Word (.docx)', en: 'Download Word (.docx)' },
  cm: { ar: 'سم', en: 'cm' },
  backToDashboard: { ar: 'العودة للوحة التحكم', en: 'Back to Dashboard' },
  pagesPerChapter: { ar: 'عدد الصفحات لكل فصل', en: 'Pages per Chapter' },
  pages: { ar: 'صفحة', en: 'pages' },
  textDirection: { ar: 'اتجاه النص', en: 'Text Direction' },
  rtl: { ar: 'من اليمين لليسار', en: 'Right to Left (RTL)' },
  ltr: { ar: 'من اليسار لليمين', en: 'Left to Right (LTR)' },
  referenceCount: { ar: 'عدد المصادر', en: 'Number of References' },
  regenerateChapter: { ar: 'إعادة توليد الفصل', en: 'Regenerate Chapter' },
  regeneratingChapter: { ar: 'جاري إعادة توليد الفصل...', en: 'Regenerating chapter...' },
  includeToc: { ar: 'جدول المحتويات', en: 'Table of Contents' },
  includeListOfTables: { ar: 'قائمة الجداول', en: 'List of Tables' },
  includeListOfFigures: { ar: 'قائمة الأشكال', en: 'List of Figures' },
  tablesAndLists: { ar: 'الجداول والقوائم', en: 'Tables & Lists' },
  generatingAbstract: { ar: 'جاري توليد الملخص...', en: 'Generating abstract...' },
  generatingToc: { ar: 'جاري توليد جدول المحتويات...', en: 'Generating table of contents...' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}
