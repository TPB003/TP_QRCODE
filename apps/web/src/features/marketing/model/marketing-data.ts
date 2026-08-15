import type { CornerSquareType, DotType } from "qr-code-styling";

export interface MarketingQrStyle {
  color: string;
  dotType: DotType;
  finderType: CornerSquareType;
  inverted?: boolean;
  name: string;
}

export const marketingQrStyles: MarketingQrStyle[] = [
  { name: "经典方块", dotType: "square", finderType: "square", color: "#080b0d" },
  { name: "柔和圆点", dotType: "dots", finderType: "dot", color: "#080b0d" },
  { name: "精密网格", dotType: "classy", finderType: "square", color: "#080b0d" },
  { name: "粗体定位角", dotType: "extra-rounded", finderType: "extra-rounded", color: "#080b0d" },
  { name: "品牌中心", dotType: "rounded", finderType: "extra-rounded", color: "#080b0d" },
  { name: "深色科技", dotType: "dots", finderType: "square", color: "#f2efe8", inverted: true },
];

export const analyticsSeries = {
  scans: [89, 92, 128, 110, 141, 171, 120, 137, 140, 91, 85, 135, 125, 99, 112, 130, 174, 160, 132, 141, 115, 128],
  submissions: [28, 56, 42, 63, 51, 50, 80, 75, 56, 40, 35, 61, 49, 67, 50, 60, 52, 60, 49, 72],
};

export const businessTemplates = ["图片", "视频", "音频", "文件", "网址", "名片", "文字"];
