import React, { CSSProperties } from "react";
import styles from "./index.less";

const icons = {
  absolute: (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="4316"
      data-spm-anchor-id="a313x.7781069.0.i0"
      width="200"
      height="200"
    >
      <path
        d="M554.666667 298.666667V21.333333h-85.333334v277.333334h85.333334z m-256 170.666666H21.333333v85.333334h277.333334v-85.333334z m170.666666 256v277.333334h85.333334V725.333333h-85.333334z m256-170.666666h277.333334v-85.333334H725.333333v85.333334z m-213.333333 106.666666a149.333333 149.333333 0 1 1 0-298.666666 149.333333 149.333333 0 0 1 0 298.666666z m0-85.333333a64 64 0 1 0 0-128 64 64 0 0 0 0 128z"
        fill="#555555"
        p-id="4317"
        data-spm-anchor-id="a313x.7781069.0.i1"
      ></path>
    </svg>
  ),
  "row-direction": (
    <svg
      width="11"
      height="7"
      viewBox="0 0 11 7"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.707 3.5L7.354.146l-.708.708L8.793 3H.5v1h8.293L6.646 6.146l.708.708L10.707 3.5z"
        fillRule="evenodd"
        fillOpacity="1"
        fill="#555555"
        stroke="none"
      ></path>
    </svg>
  ),
  "column-direction": (
    <svg
      width="8"
      height="11"
      viewBox="0 0 8 11"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 10.207L.646 6.854l.708-.708L3.5 8.293V0h1v8.293l2.146-2.147.708.708L4 10.207z"
        fillRule="evenodd"
        fillOpacity="1"
        fill="#555555"
        stroke="none"
      ></path>
    </svg>
  ),
  "space-around-column": (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="5666"
      width="200"
      height="200"
    >
      <path
        d="M160 320V192H0V128h160V0h704v128h160v64h-160v128H160z m0 704v-128H0v-64h160v-128h704v128h160v64h-160v128H160z"
        fill="#555555"
        fillOpacity=".65"
        p-id="5667"
      ></path>
    </svg>
  ),
  "space-around-row": (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="2424"
      width="200"
      height="200"
    >
      <path
        d="M320 864H192v160H128v-160H0V160h128V0h64v160h128v704z m704 0h-128v160h-64v-160h-128V160h128V0h64v160h128v704z"
        fill="#555555"
        fillOpacity=".65"
        p-id="2425"
      ></path>
    </svg>
  ),
  "space-between-column": (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="5302"
      width="200"
      height="200"
    >
      <path
        d="M0 64V0h1024v64H0z m160 384V128h704v320H160z m0 448V576h704v320H160z m-160 128v-64h1024v64H0z"
        fill="#555555"
        fillOpacity=".65"
        p-id="5303"
      ></path>
    </svg>
  ),
  "space-between-row": (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="5129"
      width="200"
      height="200"
    >
      <path
        d="M64 1024H0V0h64v1024z m384-160H128V160h320v704z m448 0H576V160h320v704z m128 160h-64V0h64v1024z"
        fill="#555555"
        fillOpacity=".65"
        p-id="5130"
      ></path>
    </svg>
  ),
  wrap: (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="1538"
      width="200"
      height="200"
    >
      <path
        d="M64 64h704v192H64zM62.72 764.416H960V960H62.72z"
        fill="#555555"
        p-id="1539"
        data-spm-anchor-id="a313x.7781069.0.i0"
      ></path>
      <path
        d="M895.872 64v403.904H320.128V399.488L191.872 501.504 320.128 608V535.168h639.744V64z"
        fill="#555555"
        p-id="1540"
        data-spm-anchor-id="a313x.7781069.0.i2"
      ></path>
    </svg>
  ),
};

export default ({
  name,
  style,
}: {
  name: keyof typeof icons;
  style?: CSSProperties;
}) => {
  return (
    <span style={style} className={styles.anticon}>
      {icons[name]}
    </span>
  );
};
