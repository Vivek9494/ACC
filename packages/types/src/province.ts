/** Province summary for signup and dropdowns. */
export interface ProvinceSummary {
  id: string;
  name: string;
}

/** Admin list/detail projection. */
export interface ProvinceDetail {
  id: string;
  name: string;
  isActive: boolean;
  centerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProvinceRequest {
  name: string;
}

export interface UpdateProvinceRequest {
  name?: string;
  isActive?: boolean;
}
