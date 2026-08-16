import { ArrowRight, BarChart3, Check, Eye, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { analyticsSeries } from "../model/marketing-data";

function toPolyline(values: number[], width: number, height: number, maxValue: number): string {
  return values
    .map((value, index) => {
      const horizontal = (index / (values.length - 1)) * width;
      const vertical = height - (value / maxValue) * height;
      return `${horizontal.toFixed(1)},${vertical.toFixed(1)}`;
    })
    .join(" ");
}

const demoContentRows = [
  ["图片", "公开访问", "保存到设备"],
  ["视频", "公开访问", "播放或下载"],
  ["名片", "公开访问", "保存联系人"],
  ["文字", "公开访问", "复制或分享"],
];

export function DataCtaSection() {
  const chartWidth = 620;
  const chartHeight = 250;

  return (
    <section className="data-cta-section" id="data">
      <div className="data-sheet paper-texture">
        <div className="analytics-chart">
          <header><span><i className="legend legend--blue" />扫码次数</span><span><i className="legend legend--teal" />查看次数</span><strong>视觉示例 · 不计入真实统计</strong></header>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="活码扫码和查看趋势视觉示例">
            <g className="chart-grid">
              {[0, 1, 2, 3, 4].map((lineIndex) => <line key={lineIndex} x1="0" x2={chartWidth} y1={lineIndex * 62.5} y2={lineIndex * 62.5} />)}
            </g>
            <polyline className="chart-line chart-line--blue" points={toPolyline(analyticsSeries.scans, chartWidth, chartHeight, 200)} />
            <polyline className="chart-line chart-line--teal" points={toPolyline(analyticsSeries.views, chartWidth, chartHeight, 200)} />
          </svg>
        </div>

        <div className="submission-table" aria-label="内容操作示例">
          <div className="submission-table__row submission-table__head"><span>内容类型</span><span>访问状态</span><span>扫码后操作</span></div>
          {demoContentRows.map(([type, status, action]) => (
            <div className="submission-table__row" key={type}>
              <code>{type}</code><span>{status}</span><time>{action}</time>
            </div>
          ))}
        </div>

        <aside className="data-dossier">
          <QrSpecimen data="TP QR · example" size={130} />
          <dl>
            <div><dt>示例内容</dt><dd>七类活码</dd></div>
            <div><dt>内容更新</dt><dd>链接保持不变</dd></div>
            <div><dt>公共页面</dt><dd>自适应布局</dd></div>
            <div><dt>统计方式</dt><dd>匿名事件</dd></div>
          </dl>
          <span className="status-seal">示例</span>
        </aside>
      </div>

      <div className="data-cta-section__content">
        <span className="data-cta-section__display" aria-hidden="true">SCAN<small>/30D</small></span>
        <div className="data-cta-section__copy">
          <h2>每一次扫描，都能回到最新内容</h2>
          <p>发布后链接保持不变，内容可以持续更新，并在后台查看匿名访问趋势。</p>
          <div className="data-cta-section__secondary">
            <Link to="/app?view=analytics"><BarChart3 />查看扫码统计</Link>
            <Link to="/decoder"><Eye />打开解码器</Link>
          </div>
          <Link className="data-cta-section__primary" to="/login">免费创建动态二维码 <ArrowRight /></Link>
        </div>
        <p className="privacy-note"><ShieldCheck />扫码者免登录<br />后台不保存原始 IP</p>
      </div>
      <footer className="marketing-footer"><span>TP QR © 2026</span><span><Check size={15} />动态发布 / 数据可控 / Cloudflare Ready</span></footer>
    </section>
  );
}
