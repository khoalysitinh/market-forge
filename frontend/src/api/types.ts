export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}
