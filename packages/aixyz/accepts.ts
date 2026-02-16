export type Accepts = AcceptsX402 | AcceptsFree;

export type AcceptsX402 = {
  scheme: "exact";
  price: string;
  network?: string;
  payTo?: string;
};

export type AcceptsFree = {
  scheme: "free";
};
