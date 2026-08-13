"use client";

import React from "react";
import { Filter, MapPin, Search } from "lucide-react";
import { DISCIPLINE_GROUPS, type DisciplineId } from "@/lib/report-sectors";

export interface ReportFilterState {
  selectedSector: DisciplineId;
  proximityFilter: "all" | "local_only";
  searchQuery: string;
}

interface SectorCount {
  id: DisciplineId;
  label: string;
  shortLabel: string;
  icon: string;
  count: number;
}

export function ReportFiltersBar({
  filterState,
  onFilterChange,
  availableSectors,
  totalCount,
  localCount,
}: {
  filterState: ReportFilterState;
  onFilterChange: (next: ReportFilterState) => void;
  availableSectors: SectorCount[];
  totalCount: number;
  localCount: number;
}) {
  return (
    <div className="report-filters-container" aria-label="تصفية الترشيحات">
      <div className="report-filters-row">
        <div className="report-filters-header">
          <Filter size={15} aria-hidden="true" />
          <span>تصفية حسب القطاع:</span>
        </div>

        <div className="report-sector-chips" role="group" aria-label="القطاع الدراسي">
          <button
            type="button"
            className={`report-chip${filterState.selectedSector === "all" ? " is-active" : ""}`}
            onClick={() => onFilterChange({ ...filterState, selectedSector: "all" })}
            aria-pressed={filterState.selectedSector === "all"}
          >
            <span>✨ الكل</span>
            <small>({totalCount})</small>
          </button>

          {availableSectors.map((sector) => (
            <button
              key={sector.id}
              type="button"
              className={`report-chip${filterState.selectedSector === sector.id ? " is-active" : ""}`}
              onClick={() => onFilterChange({ ...filterState, selectedSector: sector.id })}
              aria-pressed={filterState.selectedSector === sector.id}
            >
              <span>
                {sector.icon} {sector.shortLabel}
              </span>
              <small>({sector.count})</small>
            </button>
          ))}
        </div>
      </div>

      <div className="report-subfilters-row">
        <div className="report-proximity-toggles" role="group" aria-label="النطاق الجغرافي">
          <button
            type="button"
            className={`proximity-toggle-btn${filterState.proximityFilter === "all" ? " is-active" : ""}`}
            onClick={() => onFilterChange({ ...filterState, proximityFilter: "all" })}
            aria-pressed={filterState.proximityFilter === "all"}
          >
            كل المحافظات
          </button>
          <button
            type="button"
            className={`proximity-toggle-btn${filterState.proximityFilter === "local_only" ? " is-active" : ""}`}
            onClick={() => onFilterChange({ ...filterState, proximityFilter: "local_only" })}
            aria-pressed={filterState.proximityFilter === "local_only"}
          >
            <MapPin size={13} aria-hidden="true" />
            <span>نطاقي القريب فقط</span>
            {localCount > 0 && <small>({localCount})</small>}
          </button>
        </div>

        <div className="report-search-inline">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={filterState.searchQuery}
            onChange={(e) => onFilterChange({ ...filterState, searchQuery: e.target.value })}
            placeholder="ابحث عن كلية أو جامعة…"
            aria-label="بحث سريع داخل الكليات"
          />
        </div>
      </div>
    </div>
  );
}
