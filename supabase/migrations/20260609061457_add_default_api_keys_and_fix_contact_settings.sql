-- Migrate contact settings to correct keys
INSERT INTO platform_settings (key, value) VALUES ('contact_whatsapp', '07862403284')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('contact_email', 'hayderpailot@gmail.com')
  ON CONFLICT (key) DO NOTHING;

-- Copy existing telegram value if any
INSERT INTO platform_settings (key, value)
  SELECT 'contact_telegram', COALESCE((SELECT value FROM platform_settings WHERE key = 'contact_telegram'), 'HayderZash')
  ON CONFLICT (key) DO NOTHING;

-- Add default AI provider settings
INSERT INTO platform_settings (key, value) VALUES ('default_ai_provider', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_ai_api_key', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_merge_enabled', 'false')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_merge_providers', '[]')
  ON CONFLICT (key) DO NOTHING;

-- Add individual provider key slots
INSERT INTO platform_settings (key, value) VALUES ('default_key_openai', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_gemini', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_gemini_pro', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_deepseek_chat', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_groq', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_mistral', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_cohere', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_openrouter', '')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('default_key_siliconflow', '')
  ON CONFLICT (key) DO NOTHING;

-- Add pricing settings if missing
INSERT INTO platform_settings (key, value) VALUES ('plan_free_max_research', '1')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_free_max_pages_per_chapter', '3')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_free_report_pages', '5')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_free_exam_questions', '5')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_free_summary_chars', '1000')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_5k_points', '8')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_5k_price', '5000')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_10k_points', '20')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_10k_price', '10000')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_25k_points', '50')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_25k_price', '25000')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('plan_unlimited_price', '50000')
  ON CONFLICT (key) DO NOTHING;

-- Add consumption cost settings if missing
INSERT INTO platform_settings (key, value) VALUES ('cost_research', '5')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_thesis', '5')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_report', '3')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_exam', '3')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_cv', '2')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_proofread', '0')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_summarize', '0')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('cost_translate', '0')
  ON CONFLICT (key) DO NOTHING;
