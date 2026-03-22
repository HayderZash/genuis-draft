import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Bot, Send, User, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getAssistantProviderPayload } from '@/lib/assistant-provider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistant = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const providerPayload = getAssistantProviderPayload();
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: newMessages, language: lang, ...providerPayload },
      });
      if (error) throw error;
      setMessages([...newMessages, { role: 'assistant', content: data?.reply || '' }]);
    } catch (err: any) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: lang === 'ar' ? 'تم النسخ!' : 'Copied!' });
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 flex flex-col" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-4 self-start">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <h2 className="text-2xl font-bold mb-4">
        {lang === 'ar' ? 'المساعد الأكاديمي الذكي' : 'AI Academic Assistant'}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {lang === 'ar' ? 'اسأل أي سؤال أكاديمي وسيساعدك المساعد الذكي بخبرة أكاديمية عالية - مجاني بدون نقاط' : 'Ask any academic question - free, no points required'}
      </p>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[200px]">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-2">
                  <Bot className="h-12 w-12 mx-auto opacity-40" />
                  <p>{lang === 'ar' ? 'ابدأ بطرح سؤال أكاديمي...' : 'Start by asking an academic question...'}</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="whitespace-pre-wrap text-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <Button variant="ghost" size="sm" className="mt-1 h-6 px-2 text-xs opacity-60 hover:opacity-100" onClick={() => copyMessage(msg.content)}>
                      <Copy className="h-3 w-3 mr-1" /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                    </Button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
              rows={2}
              className="resize-none"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="h-auto">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAssistant;
