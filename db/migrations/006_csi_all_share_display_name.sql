-- 展示名与其它指数风格统一（中证全指，非「中证全指数」）
UPDATE indices
SET name = '中证全指', updated_at = now()
WHERE code = '000985.SH';
