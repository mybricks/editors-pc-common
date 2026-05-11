import React from 'react';

export function CheckIcon() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        marginRight: 5,
        borderRadius: '50%',
        background: '#22c55e',
        flexShrink: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M1.5 4.5L3.5 6.5L7.5 2.5"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
