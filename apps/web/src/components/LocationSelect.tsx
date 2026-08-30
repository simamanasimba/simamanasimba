"use client";

import { listRegions, listDistricts, listWards } from "@/lib/tanzania";
import { useLang } from "@/lib/i18n";

export interface LocationValue {
  region: string;
  district: string;
  ward: string;
}

const REGIONS = listRegions();

export function LocationSelect({
  value,
  onChange,
  required,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
}) {
  const { t } = useLang();
  const districts = listDistricts(value.region);
  const wards = listWards(value.region, value.district);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="label">{t("region")}</label>
        <select
          required={required}
          className="input"
          value={value.region}
          onChange={(e) => onChange({ region: e.target.value, district: "", ward: "" })}
        >
          <option value="">—</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("district")}</label>
        <select
          required={required}
          disabled={!value.region}
          className="input"
          value={value.district}
          onChange={(e) => onChange({ ...value, district: e.target.value, ward: "" })}
        >
          <option value="">—</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("wardLabel")}</label>
        <select
          disabled={!value.district}
          className="input"
          value={value.ward}
          onChange={(e) => onChange({ ...value, ward: e.target.value })}
        >
          <option value="">—</option>
          {wards.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
