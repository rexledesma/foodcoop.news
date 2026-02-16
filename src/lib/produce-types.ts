export interface ProduceRow {
  name: string;
  price: number;
  prev_day_price: number | null;
  prev_week_price: number | null;
  prev_month_price: number | null;
  prev_3_month_price: number | null;
  prev_6_month_price: number | null;
  prev_year_price: number | null;
  prev_2_year_price: number | null;
  prev_ytd_price: number | null;
  day_high: number | null;
  day_low: number | null;
  week_high: number | null;
  week_low: number | null;
  month_high: number | null;
  month_low: number | null;
  three_month_high: number | null;
  three_month_low: number | null;
  six_month_high: number | null;
  six_month_low: number | null;
  year_high: number | null;
  year_low: number | null;
  two_year_high: number | null;
  two_year_low: number | null;
  ytd_high: number | null;
  ytd_low: number | null;
  is_organic: boolean;
  is_ipm: boolean;
  is_waxed: boolean;
  is_local: boolean;
  is_hydroponic: boolean;
  is_new: boolean;
  first_seen_date: string | null;
  origin: string;
  unit: string;
  is_unavailable: boolean;
  unavailable_since_date: string | null;
}

export interface ProduceHistoryPoint {
  name: string;
  date: string;
  price: number;
}

export type ProduceHistoryMap = Map<string, ProduceHistoryPoint[]>;

export interface ProduceDateRange {
  start: string;
  end: string;
}

export type ProduceSWRPeriod = '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | 'SINCE_2013' | 'YTD';
