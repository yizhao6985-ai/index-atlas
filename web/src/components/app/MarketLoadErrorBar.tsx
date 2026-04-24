import { Alert } from "antd";

export default function MarketLoadErrorBar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Alert
      className="shrink-0 rounded-none border-0"
      type="error"
      showIcon
      message="市场数据加载失败，请检查 API 与数据库快照。"
    />
  );
}
