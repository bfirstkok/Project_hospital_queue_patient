import type { SVGProps } from "react";

/**
 * Eye icon indicating password visibility (reveals password).
 */
export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M1.5 12C3.5 6.5 7.5 4 12 4s8.5 2.5 10.5 8c-2 5.5-6 8-10.5 8s-8.5-2.5-10.5-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.6" fill="currentColor" />
      <circle cx="13.2" cy="10.8" r="1.1" fill="#ffffff" />
    </svg>
  );
}

/**
 * Slashed eye icon indicating password concealment (hides password).
 */
export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M1.5 12C3.5 6.5 7.5 4 12 4s8.5 2.5 10.5 8c-2 5.5-6 8-10.5 8s-8.5-2.5-10.5-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.6" fill="currentColor" />
      <circle cx="13.2" cy="10.8" r="1.1" fill="#ffffff" />
      <line
        x1="3"
        y1="3"
        x2="21"
        y2="21"
        stroke="var(--surface, #ffffff)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="3"
        x2="21"
        y2="21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
