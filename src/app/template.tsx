/** Every page glides in. Templates re-mount on navigation, which replays the CSS animation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
