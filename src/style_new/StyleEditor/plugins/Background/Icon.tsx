import React from "react";

export const SoldIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
  >
    <path
      fill="currentColor"
      fill-opacity="1"
      fill-rule="nonzero"
      stroke="none"
      d="M10 8h10v12H8V8z"
    ></path>
  </svg>
);

export const GradientIcon = () => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      opacity="0.85"
      x="8"
      y="8"
      width="12"
      height="12"
      rx="1"
      fill="url(#paint0_linear)"
    ></rect>
    <defs>
      <linearGradient
        id="paint0_linear"
        x1="14"
        y1="8"
        x2="14"
        y2="20"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="black"></stop>
        <stop stop-color="black" offset="1" stop-opacity="0.2"></stop>
      </linearGradient>
    </defs>
  </svg>
);

export const ImgIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
  >
    <path
      fill="currentColor"
      fill-opacity=".8"
      fill-rule="evenodd"
      stroke="none"
      d="M19 9H9v6.293l2.146-2.147.354-.353.354.353L17.707 19H19zM9 19v-2.293l2.5-2.5L16.293 19zM9 8c-.552 0-1 .448-1 1v10c0 .552.448 1 1 1h10c.552 0 1-.448 1-1V9c0-.552-.448-1-1-1zm8 4c0 .552-.448 1-1 1-.552 0-1-.448-1-1 0-.552.448-1 1-1 .552 0 1 .448 1 1m1 0c0 1.105-.895 2-2 2-1.105 0-2-.895-2-2 0-1.105.895-2 2-2 1.105 0 2 .895 2 2"
    ></path>
  </svg>
);
