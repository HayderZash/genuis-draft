import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ArrowLeft, UserCircle, Trash2, Loader2, Sparkles, X, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface Experience {
  job_title: string;
  company: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
}

interface LanguageEntry {
  name: string;
  level: string;
}

interface EducationEntry {
  degree: string;
  institution: string;
  start_date: string;
  end_date: string;
}

interface CVData {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  generated_content: string | null;
}

const CVBuilder = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkAndConsume } = useFeatureAccess();
  const [cvs, setCVs] = useState<CVData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewCV, setPreviewCV] = useState<CVData | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    linkedin_url: '',
    facebook_url: '',
    portfolio_url: '',
    twitter_url: '',
    summary: '',
    cv_language: 'ar',
    show_linkedin: false,
    show_facebook: false,
    show_portfolio: false,
    show_twitter: false,
  });

  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [technicalSkills, setTechnicalSkills] = useState<string[]>([]);
  const [softSkills, setSoftSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [newTechSkill, setNewTechSkill] = useState('');
  const [newSoftSkill, setNewSoftSkill] = useState('');

  const fetchCVs = async () => {
    const { data } = await supabase
      .from('cvs')
      .select('id, full_name, status, created_at, generated_content')
      .order('updated_at', { ascending: false });
    if (data) setCVs(data);
    setLoading(false);
  };

  useEffect(() => { fetchCVs(); }, []);

  const addExperience = () => {
    setExperiences([...experiences, { job_title: '', company: '', start_date: '', end_date: '', is_current: false, description: '' }]);
  };

  const updateExperience = (index: number, field: keyof Experience, value: any) => {
    const updated = [...experiences];
    (updated[index] as any)[field] = value;
    setExperiences(updated);
  };

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  const addLanguage = () => {
    setLanguages([...languages, { name: '', level: 'intermediate' }]);
  };

  const addEducationEntry = () => {
    setEducation([...education, { degree: '', institution: '', start_date: '', end_date: '' }]);
  };

  const createCV = async () => {
    if (!form.full_name.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال الاسم' : 'Please enter your name', variant: 'destructive' });
      return;
    }
    const allowed = await checkAndConsume('cv', lang);
    if (!allowed) return;
    setGenerating(true);
    try {
      // Call AI to generate CV content
      const cvPayload = {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        linkedin_url: form.show_linkedin ? form.linkedin_url : '',
        facebook_url: form.show_facebook ? form.facebook_url : '',
        portfolio_url: form.show_portfolio ? form.portfolio_url : '',
        twitter_url: form.show_twitter ? form.twitter_url : '',
        summary: form.summary,
        experiences,
        education,
        technical_skills: technicalSkills,
        soft_skills: softSkills,
        languages,
      };

      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-cv', {
        body: { cvData: cvPayload, language: form.cv_language },
      });

      if (aiError) throw new Error(aiError.message || 'AI generation failed');

      const generatedContent = aiData?.content || '';

      const { error } = await supabase
        .from('cvs')
        .insert({
          user_id: user!.id,
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          linkedin_url: form.show_linkedin ? form.linkedin_url : '',
          facebook_url: form.show_facebook ? form.facebook_url : '',
          portfolio_url: form.show_portfolio ? form.portfolio_url : '',
          twitter_url: form.show_twitter ? form.twitter_url : '',
          summary: form.summary,
          cv_language: form.cv_language,
          experiences: experiences as any,
          technical_skills: technicalSkills,
          soft_skills: softSkills,
          languages: languages as any,
          education: education as any,
          generated_content: generatedContent,
          status: 'completed',
        });
      if (error) throw error;
      toast({ title: lang === 'ar' ? 'تم إنشاء السيرة الذاتية!' : 'CV created successfully!' });
      setShowForm(false);
      resetForm();
      fetchCVs();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const resetForm = () => {
    setForm({ full_name: '', phone: '', email: '', linkedin_url: '', facebook_url: '', portfolio_url: '', twitter_url: '', summary: '', cv_language: 'ar', show_linkedin: false, show_facebook: false, show_portfolio: false, show_twitter: false });
    setExperiences([]);
    setTechnicalSkills([]);
    setSoftSkills([]);
    setLanguages([]);
    setEducation([]);
  };

  const deleteCV = async (id: string) => {
    await supabase.from('cvs').delete().eq('id', id);
    setCVs(prev => prev.filter(c => c.id !== id));
  };

  const addTechSkill = () => {
    if (newTechSkill.trim()) {
      setTechnicalSkills([...technicalSkills, newTechSkill.trim()]);
      setNewTechSkill('');
    }
  };

  const addSoftSkillFn = () => {
    if (newSoftSkill.trim()) {
      setSoftSkills([...softSkills, newSoftSkill.trim()]);
      setNewSoftSkill('');
    }
  };

  const exportCVAsWord = (cv: CVData) => {
    if (!cv.generated_content) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${cv.generated_content}</div>`, 'text/html');
    const paragraphs: Paragraph[] = [];

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
        if (text) paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 22 })], alignment: AlignmentType.JUSTIFIED }));
        return;
      }
      const el = node as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      const text = el.textContent?.trim() || '';
      if (!text) return;
      if (tag === 'h1') {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 32, bold: true })], heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
      } else if (tag === 'h2') {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 26, bold: true })], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      } else if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll('li').forEach(li => {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${li.textContent?.trim()}`, font: 'Times New Roman', size: 22 })], spacing: { after: 50 } }));
        });
      } else {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 22 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 } }));
      }
    };

    doc.body.firstElementChild?.childNodes.forEach(processNode);

    const wordDoc = new Document({ sections: [{ children: paragraphs }] });
    Packer.toBlob(wordDoc).then(blob => saveAs(blob, `${cv.full_name || 'cv'}.docx`));
  };

  const exportCVAsPDF = (cv: CVData) => {
    if (!cv.generated_content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${cv.full_name} - CV</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; text-align: justify; }
        h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 5px; }
      </style></head><body>${cv.generated_content}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('myCVs')}</h2>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> {t('newCV')}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fullName')} *</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('cvLanguage')}</Label>
                <Select value={form.cv_language} onValueChange={v => setForm({ ...form, cv_language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t('arabic')}</SelectItem>
                    <SelectItem value="en">{t('english')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Social Accounts */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('socialAccounts')}</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={form.show_linkedin} onCheckedChange={(c) => setForm({ ...form, show_linkedin: !!c })} />
                  <Label className="flex-1">{t('linkedinUrl')}</Label>
                </div>
                {form.show_linkedin && <Input value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />}

                <div className="flex items-center gap-3">
                  <Checkbox checked={form.show_facebook} onCheckedChange={(c) => setForm({ ...form, show_facebook: !!c })} />
                  <Label className="flex-1">{t('facebookUrl')}</Label>
                </div>
                {form.show_facebook && <Input value={form.facebook_url} onChange={e => setForm({ ...form, facebook_url: e.target.value })} placeholder="https://facebook.com/..." />}

                <div className="flex items-center gap-3">
                  <Checkbox checked={form.show_portfolio} onCheckedChange={(c) => setForm({ ...form, show_portfolio: !!c })} />
                  <Label className="flex-1">{t('portfolioUrl')}</Label>
                </div>
                {form.show_portfolio && <Input value={form.portfolio_url} onChange={e => setForm({ ...form, portfolio_url: e.target.value })} placeholder="https://..." />}

                <div className="flex items-center gap-3">
                  <Checkbox checked={form.show_twitter} onCheckedChange={(c) => setForm({ ...form, show_twitter: !!c })} />
                  <Label className="flex-1">{t('twitterUrl')}</Label>
                </div>
                {form.show_twitter && <Input value={form.twitter_url} onChange={e => setForm({ ...form, twitter_url: e.target.value })} placeholder="https://twitter.com/..." />}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label>{t('summary')}</Label>
              <Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={3} />
            </div>

            {/* Experiences */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('experiences')}</Label>
                <Button variant="outline" size="sm" onClick={addExperience} className="gap-1">
                  <Plus className="h-3 w-3" /> {t('addExperience')}
                </Button>
              </div>
              {experiences.map((exp, i) => (
                <Card key={i} className="p-4 space-y-3">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeExperience(i)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('jobTitle')}</Label>
                      <Input value={exp.job_title} onChange={e => updateExperience(i, 'job_title', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('company')}</Label>
                      <Input value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('startDate')}</Label>
                      <Input type="month" value={exp.start_date} onChange={e => updateExperience(i, 'start_date', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('endDate')}</Label>
                      <Input type="month" value={exp.end_date} onChange={e => updateExperience(i, 'end_date', e.target.value)} disabled={exp.is_current} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={exp.is_current} onCheckedChange={(c) => updateExperience(i, 'is_current', !!c)} />
                    <Label className="text-xs">{t('present')}</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('description')}</Label>
                    <Textarea value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} rows={2} />
                  </div>
                </Card>
              ))}
            </div>

            {/* Education */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('education')}</Label>
                <Button variant="outline" size="sm" onClick={addEducationEntry} className="gap-1">
                  <Plus className="h-3 w-3" /> {t('addEducation')}
                </Button>
              </div>
              {education.map((edu, i) => (
                <Card key={i} className="p-4 space-y-3">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setEducation(education.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('degree')}</Label>
                      <Input value={edu.degree} onChange={e => { const u = [...education]; u[i].degree = e.target.value; setEducation(u); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('institution')}</Label>
                      <Input value={edu.institution} onChange={e => { const u = [...education]; u[i].institution = e.target.value; setEducation(u); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('startDate')}</Label>
                      <Input type="month" value={edu.start_date} onChange={e => { const u = [...education]; u[i].start_date = e.target.value; setEducation(u); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('endDate')}</Label>
                      <Input type="month" value={edu.end_date} onChange={e => { const u = [...education]; u[i].end_date = e.target.value; setEducation(u); }} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Technical Skills */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('technicalSkills')}</Label>
              <div className="flex gap-2">
                <Input value={newTechSkill} onChange={e => setNewTechSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTechSkill()} placeholder={lang === 'ar' ? 'أدخل مهارة...' : 'Enter skill...'} />
                <Button variant="outline" size="sm" onClick={addTechSkill}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {technicalSkills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {s} <X className="h-3 w-3 cursor-pointer" onClick={() => setTechnicalSkills(technicalSkills.filter((_, idx) => idx !== i))} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Soft Skills */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('softSkills')}</Label>
              <div className="flex gap-2">
                <Input value={newSoftSkill} onChange={e => setNewSoftSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSoftSkillFn()} placeholder={lang === 'ar' ? 'أدخل مهارة...' : 'Enter skill...'} />
                <Button variant="outline" size="sm" onClick={addSoftSkillFn}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {softSkills.map((s, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    {s} <X className="h-3 w-3 cursor-pointer" onClick={() => setSoftSkills(softSkills.filter((_, idx) => idx !== i))} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('languagesSection')}</Label>
                <Button variant="outline" size="sm" onClick={addLanguage} className="gap-1">
                  <Plus className="h-3 w-3" /> {t('addLanguage')}
                </Button>
              </div>
              {languages.map((l, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Input value={l.name} onChange={e => { const u = [...languages]; u[i].name = e.target.value; setLanguages(u); }} placeholder={t('languageName')} className="flex-1" />
                  <Select value={l.level} onValueChange={v => { const u = [...languages]; u[i].level = v; setLanguages(u); }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t('beginner')}</SelectItem>
                      <SelectItem value="intermediate">{t('intermediate')}</SelectItem>
                      <SelectItem value="advanced">{t('advanced')}</SelectItem>
                      <SelectItem value="native">{t('native')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setLanguages(languages.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>

            <Button onClick={createCV} disabled={generating} className="gap-2 w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t('generating') : t('generateCV')}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12">...</div>
      ) : cvs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{t('noCVs')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cvs.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { if (c.generated_content) { setPreviewCV(c); setEditingContent(c.generated_content); setIsEditing(false); } }}>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">{c.full_name || t('newCV')}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === 'completed' ? 'default' : 'outline'}>{t(c.status as any)}</Badge>
                  {c.generated_content && (
                    <>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); exportCVAsPDF(c); }} className="gap-1">
                        <Download className="h-3 w-3" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); exportCVAsWord(c); }} className="gap-1">
                        <Download className="h-3 w-3" /> Word
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteCV(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* CV Preview Modal */}
      {previewCV && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewCV(null)}>
          <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold">{t('previewCV')}: {previewCV.full_name}</h3>
              <div className="flex items-center gap-2">
                <Button variant={isEditing ? 'default' : 'outline'} size="sm" onClick={() => setIsEditing(!isEditing)} className="gap-1">
                  {isEditing ? t('previewCV') : t('editCV')}
                </Button>
                {isEditing && (
                  <Button size="sm" onClick={async () => {
                    await supabase.from('cvs').update({ generated_content: editingContent }).eq('id', previewCV.id);
                    const updated = { ...previewCV, generated_content: editingContent };
                    setPreviewCV(updated);
                    setCVs(prev => prev.map(c => c.id === previewCV.id ? updated : c));
                    setIsEditing(false);
                    toast({ title: lang === 'ar' ? 'تم حفظ التعديلات' : 'Changes saved' });
                  }} className="gap-1">
                    {t('saveChanges')}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => exportCVAsPDF({ ...previewCV, generated_content: editingContent })} className="gap-1">
                  <Download className="h-3 w-3" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportCVAsWord({ ...previewCV, generated_content: editingContent })} className="gap-1">
                  <Download className="h-3 w-3" /> Word
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewCV(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isEditing ? (
                <Textarea
                  value={editingContent}
                  onChange={e => setEditingContent(e.target.value)}
                  rows={30}
                  className="font-serif text-sm w-full"
                  dir={previewCV.generated_content?.includes('ال') ? 'rtl' : 'ltr'}
                />
              ) : (
                <div className="border-2 border-border rounded-lg p-8 bg-card shadow-inner mx-auto max-w-[800px]">
                  <div
                    className="generated-content prose max-w-none"
                    dir={editingContent.includes('ال') ? 'rtl' : 'ltr'}
                    dangerouslySetInnerHTML={{ __html: editingContent }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CVBuilder;
