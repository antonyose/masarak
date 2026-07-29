import fs from "fs";
import path from "path";

export type AnalyticsData = {
  totalViews: number;
  todayViews: Record<string, number>;
  predictCount: number;
  searchCount: number;
  lastVisit: string;
};

const getFilePath = () => {
  const isVercel = process.env.VERCEL === "1";
  if (isVercel) {
    return path.join("/tmp", "masarak-analytics.json");
  }
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "analytics.json");
};

const defaultData: AnalyticsData = {
  totalViews: 0,
  todayViews: {},
  predictCount: 0,
  searchCount: 0,
  lastVisit: new Date().toISOString(),
};

export function getAnalytics(): AnalyticsData {
  try {
    const filePath = getFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return { ...defaultData, ...JSON.parse(raw) };
    }
  } catch (error) {
    console.error("Failed to read analytics file:", error);
  }
  return defaultData;
}

export function saveAnalytics(data: AnalyticsData) {
  try {
    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write analytics file:", error);
  }
}

export function trackEvent(type: "view" | "predict" | "search") {
  const data = getAnalytics();
  const today = new Date().toISOString().split("T")[0];

  if (!data.todayViews) data.todayViews = {};
  if (!data.todayViews[today]) data.todayViews[today] = 0;

  if (type === "view") {
    data.totalViews += 1;
    data.todayViews[today] += 1;
    data.lastVisit = new Date().toISOString();
  } else if (type === "predict") {
    data.predictCount += 1;
  } else if (type === "search") {
    data.searchCount += 1;
  }

  saveAnalytics(data);
  return data;
}
