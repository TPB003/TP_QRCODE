import { ArrowRight, BarChart3, Check, Download, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { QrSpecimen } from "@client/components/ui/qr-specimen";
import { analyticsSeries } from "../model/marketing-data";
import { StatusDot } from "./visual-primitives";

function toPolyline(values: number[], width: number, height: number, maxValue: number): string {
  return values
    .map((value, index) => {
      const horizontal = (index / (values.length - 1)) * width;
      const vertical = height - (value / maxValue) * height;
      return `${horizontal.toFixed(1)},${vertical.toFixed(1)}`;
    })
    .join(" ");
}

const submissions = [
  ["QR-7F3A", "提交成功", "2026-08-10 14:32:18"],
  ["QR-2C91", "提交成功", "2026-08-10 13:11:07"],
  ["QR-9B44", "提交成功", "2026-08-10 09:47:55"],
  ["QR-6E21", "提交成功", "2026-08-09 21:03:24"],
  ["QR-1D7F", "提交失败", "2026-08-09 18:22:10"],
];

export function DataCtaSection() {
  const chartWidth = 620;
  const chartHeight = 250;

  return (
    <section className="data-cta-section" id="data">
      <div className="data-sheet paper-texture">
        <div className="analytics-chart">
          <header><span><i className="legend legend--blue" />扫码次数</span><span><i className="legend legend--teal" />提交数量</span><strong>最近 30 天</strong></header>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="最近 30 天扫码和提交趋势">
            <g className="chart-grid">
              {[0, 1, 2, 3, 4].map((lineIndex) => <line key={lineIndex} x1="0" x2={chartWidth} y1={lineIndex * 62.5} y2={lineIndex * 62.5} />)}
            </g>
            <polyline className="chart-line chart-line--blue" points={toPolyline(analyticsSeries.scans, chartWidth, chartHeight, 200)} />
            <polyline className="chart-line chart-line--teal" points={toPolyline(analyticsSeries.submissions, chartWidth, chartHeight, 200)} />
          </svg>
        </div>

        <div className="submission-table">
          <div className="submission-table__row submission-table__head"><span>二维码</span><span>提交结果</span><span>提交时间</span></div>
          {submissions.map(([code, status, timestamp]) => (
            <div className={`submission-table__row ${status === "提交失败" ? "is-error" : ""}`} key={code}>
              <code>{code}</code><span><StatusDot tone={status === "提交失败" ? "red" : "teal"} />{status}</span><time>{timestamp}</time>
            </div>
          ))}
        </div>

        <aside className="data-dossier">
          <QrSpecimen data="/s/QR-7F3A" size={130} />
          <dl>
            <div><dt>二维码</dt><dd>QR-7F3A</dd></div>
            <div><dt>来源</dt><dd>产品包装 A 批次</dd></div>
            <div><dt>页面</dt><dd>/feedback</dd></div>
            <div><dt>状态</dt><dd>正常</dd></div>
          </dl>
          <span className="status-seal">正常</span>
        </aside>
      </div>

      <div className="data-cta-section__content">
        <span className="data-cta-section__display" aria-hidden="true">SCAN<small>/30D</small></span>
        <div className="data-cta-section__copy">
          <h2>每一次扫描，都留下可用的反馈</h2>
          <p>查看提交记录、最近 30 天趋势，并随时导出 CSV。</p>
          <div className="data-cta-section__secondary">
            <button type="button"><Download />导出 CSV</button>
            <button type="button"><BarChart3 />查看扫码统计</button>
          </div>
          <Link className="data-cta-section__primary" to="/login">免费创建动态二维码 <ArrowRight /></Link>
        </div>
        <p className="privacy-note"><ShieldCheck />扫码者免登录<br />后台不保存原始 IP</p>
      </div>
      <footer className="marketing-footer"><span>TP QR © 2026</span><span><Check size={15} />动态发布 / 数据可控 / Cloudflare Ready</span></footer>
    </section>
  );
}
