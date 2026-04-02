import "./globals.css";

export const metadata = {
  title: "Tunely",
  description: "Real-time multiplayer music guessing rooms powered by Spotify imports and Apple previews."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
