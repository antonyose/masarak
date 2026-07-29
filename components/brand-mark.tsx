export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="شعار مسارك"
    >
      <path
        d="M8 11.5c6.4 0 11.7 1.4 16 4.3 4.3-2.9 9.6-4.3 16-4.3v24c-6.2 0-11.6 1.5-16 4.5-4.4-3-9.8-4.5-16-4.5v-24Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
      <path
        d="M24 15.8V40M15 27.8c2.4.3 4.5 1 6.3 2.1M33 19.2c-3.9 0-7 3.1-7 7 0 4.8 7 10.1 7 10.1s7-5.3 7-10.1c0-3.9-3.1-7-7-7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
      <circle cx="33" cy="26.2" r="2.3" fill="currentColor" />
    </svg>
  );
}
