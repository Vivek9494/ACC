/** Minimal Center projection used to populate the signup Center selector. */
export interface CenterSummary {
  id: string;
  name: string;
  provinceId: string;
}

/** Admin list/detail projection. */
export interface CenterDetail {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCenterRequest {
  name: string;
  provinceId: string;
}

export interface UpdateCenterRequest {
  name?: string;
  provinceId?: string;
  isActive?: boolean;
}
