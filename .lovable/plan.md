# خطة الإصلاح الشامل وإطلاق نظام الاشتراكات

## المرحلة 1 — إصلاحات حرجة (تُنفّذ أولاً)

### 1.1 إزالة إعادة التحميل القسري
- إزالة أي `window.location.reload()` أو إعادة تحميل دورية تعطّل الكتابة في صفحات الإعدادات/التسعير.

### 1.2 إصلاح "كتابة الأبحاث" لا يفتح
- مراجعة `ResearchList.tsx` و `useFeatureAccess.ts`:
  - زر "بحث جديد" يستدعي `checkAndConsume` ثم `INSERT` ثم navigate. عند فشل `checkAndConsume` صامتاً يبقى الزر معلّقاً → سنفصل المسار: التحقق → الإنشاء → التنقّل، مع رسائل واضحة وعدم بلوكاج عند timeout.
  - تطبيق fail-open على الحساب الإداري وعلى أي حساب `unlimited` فعّال.

### 1.3 retry + exponential backoff
- إضافة helper `withRetry(fn, {retries:3, baseMs:400})` في `src/lib/retry.ts`.
- استخدامه في:
  - استعلامات قائمة المشاريع/الأطروحات/التقارير.
  - `useFeatureAccess.checkAndConsume`.
  - `useUserSettings.saveMultipleSettings`.
- عند فشل كل المحاولات: السماح بالميزة (fail-open) مع toast تحذيري، لا تعطيل.

### 1.4 حفظ APIs في الإعدادات
- `SettingsDialog`: الحفظ المحلي فوري (موجود) + `upsert` على `user_settings` مع retry.
- إزالة أي مزامنة عكسية تُعيد تعيين الحقول أثناء الكتابة.
- تأكيد UI واضح "تم الحفظ في الحساب" بعد نجاح الـ upsert.

### 1.5 صرامة الطلبات للذكاء الاصطناعي
- في `ai-proxy` و `ai-merge-proxy`: التحقق من وجود مفتاح المزوّد المختار قبل الإرسال، رفض الطلب برسالة واضحة بدلاً من السقوط على fallback غير متوقع.
- في `lib/ai-generation.ts`: تمرير system instruction صارم بالعربية يربط المخرج بعنوان الفصل/الموضوع المطلوب فقط، مع رفض التحويل الموضوعي.

---

## المرحلة 2 — نظام الاشتراكات اليدوي (بدون Stripe)

بناءً على طلبك: لا دفع مباشر. المستخدم يختار خطة → يُعرض له واتساب/تيليغرام/إيميل → المدير يفعّل الحساب يدوياً من لوحة الإدارة.

### 2.1 صفحة التسعير `/pricing`
أربع بطاقات:

| الخطة | السعر | النقاط/الحدود |
|---|---|---|
| مجاني | 0 | 1 بحث (3 صفحات/فصل، بدون صور)، تقرير علمي 5 صفحات، 5 أسئلة امتحان، تلخيص ≤1000 حرف، الترجمة كاملة. مغلق: الأطروحات، التدقيق، السيرة الذاتية |
| 5,000 د.ع/شهر | 8 نقاط | كل الميزات حسب أسعار الاستهلاك |
| 10,000 د.ع/شهر | 20 نقطة | نفس الشيء |
| 25,000 د.ع/شهر | 50 نقطة | نفس الشيء |
| 50,000 د.ع/شهر | غير محدود | كل شيء مفتوح بالكامل |

أسعار الاستهلاك (تُحفظ في `platform_settings`):
- بحث كامل: 5 نقاط
- أطروحة: 5 نقاط
- تقرير علمي: 3 نقاط
- خبير الامتحانات (50 سؤال): 3 نقاط
- السيرة الذاتية: 2 نقطة
- التدقيق/الكشف، التلخيص، الترجمة: مفتوحة بدون نقاط

كل بطاقة "اشتراك" تفتح Dialog يعرض:
- واتساب: 07862403284
- تيليغرام: HayderZash
- إيميل: hayderpailot@gmail.com
- أزرار نسخ + روابط مباشرة (`https://wa.me/...`, `https://t.me/HayderZash`, `mailto:`)

### 2.2 تخزين وسائل التواصل
جدول `platform_settings` يحوي:
- `contact_whatsapp`, `contact_telegram`, `contact_email`
- `plan_free_limits`, `plan_5k_points`, `plan_10k_points`, `plan_25k_points`, `cost_research`, `cost_thesis`, ...

### 2.3 تطبيق حدود الخطة المجانية
- في `useFeatureAccess`: عند `account_type='free'` أو غير معروف → تطبيق `plan_free_limits`:
  - عدّ المشاريع الموجودة قبل السماح بإنشاء جديد.
  - تمرير `maxPagesPerChapter=3` و `includeImages=false` لـ ResearchEditor.
  - منع الدخول لـ Theses/Proofreading/CV مع toast "متاحة في الخطط المدفوعة" + زر اشتراك.
- صفحات Reports/Summarizer/ExamExpert: تطبيق سقف الصفحات/الأحرف/الأسئلة.

### 2.4 لوحة الإدارة
- في `AdminDashboard`:
  - عند إنشاء/تعديل مستخدم: قائمة منسدلة بالخطط (مجاني/5K/10K/25K/50K) تضبط `account_type` + `expires_at` (شهر) + النقاط لكل ميزة تلقائياً وفق الخطة.
  - زر "تجديد شهر" / "إضافة نقاط".
  - قسم "إعدادات المنصة" جديد: تعديل أرقام التواصل وأسعار الاستهلاك (يحفظ في `platform_settings` عبر `admin-users` action `update-settings`).

### 2.5 صفحة "حسابي/النقاط"
- عرض الخطة الحالية، النقاط المتبقية لكل ميزة، تاريخ الانتهاء، زر "ترقية" → `/pricing`.

---

## التغييرات التقنية

**ملفات جديدة:**
- `src/lib/retry.ts` — withRetry/withTimeout helpers
- `src/pages/Pricing.tsx` — صفحة التسعير
- `src/components/SubscribeDialog.tsx` — نافذة وسائل التواصل
- `src/components/admin/PlatformSettingsTab.tsx` — تبويب إعدادات المنصة في لوحة الإدارة
- `src/hooks/usePlatformSettings.ts` — جلب/تخزين إعدادات المنصة

**ملفات معدّلة:**
- `src/main.tsx` — إزالة أي reload متبقي
- `src/hooks/useFeatureAccess.ts` — retry + fail-open + تطبيق حدود الخطة
- `src/hooks/useUserSettings.ts` — retry للحفظ
- `src/components/SettingsDialog.tsx` — تأكيد الحفظ
- `src/pages/ResearchList.tsx`, `Theses.tsx`, `Reports.tsx`, `CVBuilder.tsx`, `Summarizer.tsx`, `ExamExpert.tsx`, `Proofreading.tsx` — تطبيق حدود الخطة
- `src/pages/AdminDashboard.tsx` — إضافة تبويب إعدادات + خطط جاهزة
- `src/App.tsx` — إضافة route `/pricing`
- `src/components/Navbar.tsx` — رابط "الاشتراكات"
- `supabase/functions/admin-users/index.ts` — دعم action `apply-plan` وتفعيل update-settings للقيم الجديدة
- `supabase/functions/ai-proxy/index.ts`, `ai-merge-proxy/index.ts` — التحقق الصارم من المفاتيح

**Migration:**
- إضافة `account_type` value `'free'` (نص حر، لا enum، لا حاجة لتغيير schema).
- إدراج صفوف افتراضية في `platform_settings` (contact_*, plan_*, cost_*).
- لا تغييرات RLS (موجودة وصحيحة).

---

## ترتيب التنفيذ
1. Migration: إدراج إعدادات المنصة الافتراضية.
2. `retry.ts` + إصلاح `useFeatureAccess` و `useUserSettings` و `main.tsx`.
3. إصلاح زر "بحث جديد" في `ResearchList`.
4. صفحة `/pricing` + `SubscribeDialog`.
5. تطبيق حدود الخطة المجانية في كل ميزة.
6. تبويب إعدادات المنصة في لوحة الإدارة + خطط جاهزة.
7. صرامة AI proxy والـ system instructions.
8. اختبار يدوي للمسارات الحرجة.

---

**ملاحظة:** لن أضيف Stripe حالياً بناءً على طلبك (دفع يدوي عبر التواصل). إذا أردت Stripe لاحقاً يمكن إضافته كطبقة فوق نفس بنية النقاط/الخطط.
