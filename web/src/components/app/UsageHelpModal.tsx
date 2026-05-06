import { Modal } from "antd";

type UsageHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function UsageHelpModal({ open, onClose }: UsageHelpModalProps) {
  return (
    <Modal
      title="使用说明"
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(520px, calc(100vw - 32px))"
      destroyOnClose
      styles={{ body: { paddingTop: 8 } }}
    >
      <ul className="m-0 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-700">
        <li>
          <strong>云图</strong>：申万 <strong>L1 → L2 → L3 → 个股</strong>{" "}
          自外向内嵌套成一块热力图，<strong>面积</strong>为当前指标；悬停可看行业路径与行情摘要。仅<strong>个股</strong>在已配置雪球时可<strong>点击方块</strong>打开新页。
        </li>
        <li>
          <strong>矩形面积</strong>：表示当前选择的指标——
          <strong>流通市值</strong>、<strong>成交额</strong> 或{" "}
          <strong>成分权重</strong>（在顶部「面积」中切换）。
        </li>
        <li>
          <strong>颜色</strong>：表示<strong>当日涨跌幅</strong>档位，与顶部图例一致；灰档表示波动接近零或缺失数据。
        </li>
        <li>
          <strong>指数</strong>：在顶部下拉框切换跟踪的指数；默认与后端配置一致（如中证全指）。
        </li>
        <li>
          <strong>数据时效</strong>：<strong>交易日</strong>与<strong>数据截至</strong>
          时间见顶部标签；连续竞价时段内云图会按约 10 秒节奏刷新，非交易时段展示最近快照。
        </li>
        <li>
          <strong>涨跌统计</strong>：桌面端可悬停或点击「涨跌统计」查看分布与图表；移动端在「数据与设置」面板中查看。
        </li>
      </ul>
      <p className="mb-0 mt-4 border-t border-slate-200 pt-3 text-xs leading-relaxed text-amber-900/95">
        本页为学习演示，<strong>不构成投资建议</strong>
        ；数据来自第三方，不保证实时、准确、完整。
      </p>
    </Modal>
  );
}
