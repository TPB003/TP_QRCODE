import { Link } from "react-router-dom";

export function Component() {
  return (
    <main className="not-found-page">
      <p className="index-label">404 / NOT FOUND</p>
      <h1>找不到这个页面</h1>
      <Link to="/">返回首页</Link>
    </main>
  );
}
