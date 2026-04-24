/** 轻量存在性检查：是否已有成分与任一侧行情数据 */
export const DATA_READINESS_SQL = `
  SELECT
    (SELECT COUNT(*)::bigint FROM index_constituents) AS constituents,
    (
      (SELECT COUNT(*)::bigint FROM quotes_daily)
      + (SELECT COUNT(*)::bigint FROM quotes_rt)
    ) AS quotes
`;
