import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, X, Copy, User, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const FloatingAIAssistant = () => {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: newMessages, language: lang },
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110 animate-in fade-in"
        title={lang === 'ar' ? 'المساعد الأكاديمي' : 'AI Assistant'}
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className={`fixed z-50 bg-background border rounded-2xl shadow-2xl flex flex-col transition-all animate-in slide-in-from-bottom-4 ${
      expanded ? 'inset-4' : 'bottom-6 right-6 w-[380px] h-[520px] max-h-[80vh]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{lang === 'ar' ? 'المساعد الأكاديمي' : 'AI Assistant'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Bot className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-sm">{lang === 'ar' ? 'اسأل أي سؤال أكاديمي...' : 'Ask any academic question...'}</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <p className="whitespace-pre-wrap text-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{msg.content}</p>
              {msg.role === 'assistant' && (
                <Button variant="ghost" size="sm" className="mt-1 h-5 px-1.5 text-xs opacity-50 hover:opacity-100" onClick={() => copyMessage(msg.content)}>
                  <Copy className="h-2.5 w-2.5 mr-1" /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                </Button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={lang === 'ar' ? 'اكتب سؤالك...' : 'Type your question...'}
          rows={1}
          className="resize-none text-sm min-h-[36px]"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="h-9 w-9 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
