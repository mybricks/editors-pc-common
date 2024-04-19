import React from "react";

// figma的padding图标 暂时先用已有的不用下面的
export function Left() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
    >
      <path
        fill="#000"
        fill-opacity=".3"
        fill-rule="evenodd"
        stroke="none"
        d="M16.5 18H10v-1h6.5c.276 0 .5-.224.5-.5v-9c0-.276-.224-.5-.5-.5H10V6h6.5c.828 0 1.5.672 1.5 1.5v9c0 .828-.672 1.5-1.5 1.5z"
      ></path>
      <path
        fill="#000"
        fill-opacity="1"
        fill-rule="evenodd"
        stroke="none"
        d="M6 18V6h1v12H6z"
      ></path>
    </svg>
  );
}

export function Top() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
    >
      <path
        fill="#000"
        fill-opacity=".3"
        fill-rule="evenodd"
        stroke="none"
        d="M6 16.5V10h1v6.5c0 .276.224.5.5.5h9c.276 0 .5-.224.5-.5V10h1v6.5c0 .828-.672 1.5-1.5 1.5h-9c-.828 0-1.5-.672-1.5-1.5z"
      ></path>
      <path
        fill="#000"
        fill-opacity="1"
        fill-rule="evenodd"
        stroke="none"
        d="M6 6h12v1H6V6z"
      ></path>
    </svg>
  );
}

export function Right() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
    >
      <path
        fill="#000"
        fill-opacity=".3"
        fill-rule="evenodd"
        stroke="none"
        d="M7.5 6H14v1H7.5c-.276 0-.5.224-.5.5v9c0 .276.224.5.5.5H14v1H7.5c-.828 0-1.5-.672-1.5-1.5v-9C6 6.672 6.672 6 7.5 6z"
      ></path>
      <path
        fill="#000"
        fill-opacity="1"
        fill-rule="evenodd"
        stroke="none"
        d="M18 6v12h-1V6h1z"
      ></path>
    </svg>
  );
}

export function Bottom() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
    >
      <path
        fill="#000"
        fill-opacity=".3"
        fill-rule="evenodd"
        stroke="none"
        d="M18 7.5V14h-1V7.5c0-.276-.224-.5-.5-.5h-9c-.276 0-.5.224-.5.5V14H6V7.5C6 6.672 6.672 6 7.5 6h9c.828 0 1.5.672 1.5 1.5z"
      ></path>
      <path
        fill="#000"
        fill-opacity="1"
        fill-rule="evenodd"
        stroke="none"
        d="M18 18H6v-1h12v1z"
      ></path>
    </svg>
  );
}
