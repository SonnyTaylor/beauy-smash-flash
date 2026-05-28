export function ScreenHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header>
      <p className="screen-kicker">{kicker}</p>
      <h2>{title}</h2>
    </header>
  );
}
