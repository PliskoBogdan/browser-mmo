export interface JwtPayload {
  sub: number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
  };
}
