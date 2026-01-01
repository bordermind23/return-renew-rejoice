-- 将cases表的currency默认值从USD改为EUR
ALTER TABLE public.cases ALTER COLUMN currency SET DEFAULT 'EUR';