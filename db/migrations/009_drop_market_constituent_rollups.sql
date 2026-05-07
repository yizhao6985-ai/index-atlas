-- 移除预计算时间窗表；大盘改由 live SQL（quotes_rt ∪ quotes_daily）即时查询
DROP TABLE IF EXISTS market_constituent_rollups;
