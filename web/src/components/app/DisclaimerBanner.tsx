import { Alert } from "antd";
import { useState } from "react";

const BANNER_DISMISS_KEY = "disclaimer_banner_dismiss_v1";

export default function DisclaimerBanner() {
  const [open, setOpen] = useState(
    () => localStorage.getItem(BANNER_DISMISS_KEY) !== "1",
  );

  if (!open) return null;

  return (
    <Alert
      banner
      showIcon={false}
      type="warning"
      closable
      className="shrink-0 rounded-none border-x-0 border-t-0 border-b-amber-200/80 bg-amber-50 text-amber-950 [&_.ant-alert-message]:m-0 [&_.ant-alert-message]:text-[13px] [&_.ant-alert-message]:leading-snug"
      message={
        <div className="min-w-0 break-words text-xs leading-snug sm:overflow-x-auto sm:overflow-y-hidden sm:whitespace-nowrap sm:text-[13px] sm:leading-tight">
          <strong>免责声明</strong>
          <span className="mx-1.5 font-normal text-amber-800" aria-hidden="true">
            ｜
          </span>
          个人学习演示，不构成投资建议。数据来自第三方，不保证实时、准确、完整。图表与数据不构成任何证券投资建议；使用本页面的风险由您自行承担。
        </div>
      }
      onClose={() => {
        localStorage.setItem(BANNER_DISMISS_KEY, "1");
        setOpen(false);
      }}
    />
  );
}
