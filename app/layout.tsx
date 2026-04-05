import type { ReactNode } from "react";

export const metadata = {
  title: "Fault-Tolerant Audio Upload Demo",
  description: "Next.js client for reliable audio chunk recording and upload.",
};

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{props.children}</body>
    </html>
  );
}
