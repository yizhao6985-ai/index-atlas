/** 热力图面积维度（与后端契约中的 metric 语义一致，由前端选择；展示顺序：权重、成交额、流通市值） */
export type Metric = "weight" | "turnover" | "mcap";
