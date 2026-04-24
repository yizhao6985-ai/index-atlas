-- 中证全指 000985.SH：加入可选列表并置为排序第一。
-- 程序默认指数代码与 api `DEFAULT_CODE` 一致，见 005 之后的部署说明。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM indices WHERE code = '000985.SH') THEN
    UPDATE indices SET sort_order = sort_order + 1;
    INSERT INTO indices (code, name, sort_order, tushare_index_code)
    VALUES ('000985.SH', '中证全指', 1, '000985.SH');
  ELSE
    UPDATE indices
    SET
      name = '中证全指',
      tushare_index_code = COALESCE(NULLIF(TRIM(tushare_index_code), ''), '000985.SH'),
      updated_at = now()
    WHERE code = '000985.SH';
  END IF;
END $$;
