"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BarChart3,
  Eye,
  GraduationCap,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

type Stats = {
  totalViews: number;
  todayViews: number;
  predictCount: number;
  searchCount: number;
  lastVisit: string;
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassword("");
        checkAuth();
      } else {
        setError(data.error || "كلمة السر غير صحيحة");
      }
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setIsAuthenticated(false);
    setStats(null);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await checkAuth();
    setRefreshing(false);
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat("ar-EG").format(num);
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "غير متاح";
    try {
      return new Date(dateStr).toLocaleString("ar-EG", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="admin-container">
        <div className="admin-card text-center">
          <RefreshCw className="animate-spin mx-auto text-primary" size={32} />
          <p className="mt-3">جارٍ التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="admin-card login-card">
          <div className="login-header">
            <div className="admin-icon-wrapper">
              <Lock size={28} />
            </div>
            <h2>لوحة تحكم مسارك</h2>
            <p>سجل الدخول لعرض إحصائيات وزيارات الموقع</p>
          </div>

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="field">
              <label htmlFor="admin-password">كلمة السر</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة سر الأدمن"
                required
              />
            </div>

            {error ? (
              <p className="form-error" role="alert">
                <ShieldAlert size={17} />
                {error}
              </p>
            ) : null}

            <button type="submit" className="primary-button field-full" disabled={loading}>
              {loading ? "جارٍ تسجيل الدخول..." : "دخول اللوحة"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <div>
          <h2>لوحة الإحصائيات والتحليلات 📊</h2>
          <p>متابعة أداء ومؤشرات استخدام موقع مسارك مباشر</p>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            تحديث البيانات
          </button>
          <button type="button" className="danger-button" onClick={handleLogout}>
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon icon-views">
            <Eye size={24} />
          </div>
          <div className="stat-content">
            <span>إجمالي زيارات الموقع</span>
            <strong>{formatNumber(stats?.totalViews || 0)}</strong>
            <small>إجمالي المشاهدات المسجلة</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-today">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span>زيارات اليوم</span>
            <strong>{formatNumber(stats?.todayViews || 0)}</strong>
            <small>مشاهدات اليوم الحالية</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-predict">
            <GraduationCap size={24} />
          </div>
          <div className="stat-content">
            <span>توقعات الكليات</span>
            <strong>{formatNumber(stats?.predictCount || 0)}</strong>
            <small>عملية حساب توقع أجريت</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-search">
            <Search size={24} />
          </div>
          <div className="stat-content">
            <span>البحث عن النتائج</span>
            <strong>{formatNumber(stats?.searchCount || 0)}</strong>
            <small>عملية بحث عن النتيجة</small>
          </div>
        </div>
      </div>

      <div className="admin-footer-info">
        <p>
          آخر زيارة تم تسجيلها على الموقع:{" "}
          <strong>{formatDate(stats?.lastVisit || "")}</strong>
        </p>
      </div>
    </div>
  );
}
