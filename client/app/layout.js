import "./globals.css";

export const metadata = {
  title: "Song Guess Party",
  description: "Real-time multiplayer song guessing party with Spotify playlist rooms."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
