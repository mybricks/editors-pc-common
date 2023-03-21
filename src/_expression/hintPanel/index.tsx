import React from "react";
import { message } from "antd";
import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import styles from "./index.less";

export interface PanelProps {
  showPanel: boolean;
  result?: Record<string, any>;
  markers?: Array<
    Partial<{
      message: string;
    }>
  >;
}

const Icon = (
  <svg
    width="12px"
    height="12px"
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <g fill="currentColor">
        <path d="M3.375,3.75 L3.375,7.775 C3.375,8.6586556 4.0913444,9.375 4.975,9.375 L4.975,9.375 L7.495,9.375 L7.49451426,9.39926234 C7.41816512,10.4341222 6.5543618,11.25 5.5,11.25 L2.75,11.25 C1.6454305,11.25 0.75,10.3545695 0.75,9.25 L0.75,5.75 C0.75,4.6454305 1.6454305,3.75 2.75,3.75 L3.375,3.75 Z"></path>
        <rect x="4.5" y="0.75" width="6.75" height="7.5" rx="2"></rect>
      </g>
    </g>
  </svg>
);

const onClipboard = async (content: any) => {
  const input = document.createElement("input");
  input.value = JSON.stringify(content);
  document.body.appendChild(input);
  input.select();
  try {
    await document.execCommand("copy");
    message.success("复制成功");
  } catch (error) {
    message.error("复制失败，请重试");
  }
  document.body.removeChild(input);
};

const SuccessPanel = ({ result }: Pick<PanelProps, "result">) => {
  return (
    <div className={styles.result}>
      <div className={styles.title}>
        <span>
          <CheckCircleFilled className={styles.icon} />
          Success
        </span>
        <span onClick={() => onClipboard(result)}>
          {Icon}
        </span>
      </div>
      <div>{JSON.stringify(result)}</div>
    </div>
  );
};

const ErrorPanel = ({ markers = [] }: Pick<PanelProps, "markers">) => {
  return (
    <div className={styles.marker}>
      <div className={styles.title}>
        <span>
          <CloseCircleFilled className={styles.icon} /> Error
        </span>
        <span onClick={() => onClipboard(markers)}>
          {Icon}
        </span>
      </div>
      <ul>
        {markers.map((marker, index) => (
          <li key={index}>{marker?.message}</li>
        ))}
      </ul>
    </div>
  );
};

const Panel = ({ showPanel, markers, result }: PanelProps) => {
  return showPanel ? (
    <div className={styles.drapDown}>
      {!!result && <SuccessPanel result={result} />}
      {Array.isArray(markers) && !!markers.length && (
        <ErrorPanel markers={markers} />
      )}
    </div>
  ) : null;
};

export default Panel;
