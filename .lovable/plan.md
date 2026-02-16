

# AI Academic Research Platform

A professional, bilingual (Arabic/English) web application that helps students generate, edit, and export AI-powered graduation research papers — complete with user accounts, project management, and a rich text editor.

---

## 1. Authentication & User Accounts
- Email/password signup and login using Supabase Auth
- User profiles table for storing preferences (default language, saved API key reference)
- Protected routes — unauthenticated users redirected to login

## 2. Landing / Dashboard Page
- After login, show a dashboard listing the user's saved research projects (title, date, status)
- "New Project" button to start a new research paper
- Quick access to Settings (API key, language)

## 3. Settings & Configuration
- **API Key Management**: Modal/page where users input their OpenAI API key, stored securely in LocalStorage (never sent to our backend, used client-side for AI calls)
- **Interface Language Toggle (i18n)**: Navbar toggle to switch the entire UI between Arabic (RTL) and English (LTR). Default: Arabic. Persisted in user preferences

## 4. New Project — Input Workflow (Sidebar)
A collapsible sidebar with a step-by-step form:
- **Research Metadata**: Title field, Abstract/Details textarea
- **Research Language**: Dropdown (Arabic / English) — controls the language of AI-generated content
- **Custom References** (optional): Textarea for pasting links or book titles for the AI to cite
- **Chapter Structure**:
  - Dropdown: 4, 5, or 6 chapters
  - If **5 chapters**: Auto-locked to [Introduction, Literature Review, Methodology, Results & Discussion, Conclusion] — no editing
  - If **4 or 6 chapters**: Pre-filled defaults, but user can rename chapters, add custom chapters, and drag-and-drop reorder them

## 5. AI Generation Process
- Calls OpenAI API directly from the client using the user's stored API key
- AI is prompted as a "strict academic expert" writing in the selected research language
- **Granular Progress Bar** showing real-time steps: "Analyzing Topic…", "Drafting Chapter 1…", "Formatting Citations…", "Finalizing"
- **Content targets per chapter**:
  - Ch 1: ~1200 words, Ch 2–3: ~1800 words each, Ch 4: ~1200 words, Ch 5: ~900 words
  - APA-style references appended at the end
  - Placeholder figures inserted as `[Figure X: Description]`

## 6. Rich Text Editor & Preview (Main Area)
- WYSIWYG editor (using a library like TipTap or similar) so users can edit the generated content before downloading
- **Strict academic formatting applied automatically**:
  - Font: Times New Roman throughout
  - Justified text alignment
  - Chapter titles: 22px, centered
  - Main headings: 18px, bold
  - Sub-headings: 16px, bold + underlined
  - Body text: 14px, normal weight
- Users can fix typos, add/remove content, and adjust formatting

## 7. Export & Page Setup
- **Page Settings Panel**: Configurable margins (defaults: Top/Bottom 2.5cm, Left 2.5cm, Right 3cm for binding)
- **"Download Word (.docx)" button**: Generates a .docx file using the `docx` library, strictly respecting Times New Roman and the heading size hierarchy (22, 18, 16, 14)

## 8. Project Persistence (Supabase Database)
- Save each research project to the database: metadata, chapter structure, generated content, export settings
- Auto-save as user edits in the rich text editor
- Users can return to the dashboard and resume any project

## 9. UI & Design
- Clean academic aesthetic: white background, dark text, subtle blue primary accents
- Collapsible sidebar for project inputs, main area for the editor/preview
- Fully responsive layout
- RTL support for Arabic interface mode
- Professional typography and spacing

