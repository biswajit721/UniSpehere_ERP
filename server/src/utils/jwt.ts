import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  userId: string;
  roleId: string;
  roleName: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry as jwt.SignOptions["expiresIn"],
  });

export const signRefreshToken = (payload: RefreshTokenPayload): string =>
  jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry as jwt.SignOptions["expiresIn"],
  });

export interface ResetTokenPayload {
  userId: string;
  purpose: "password_reset";
}

export const signResetToken = (userId: string): string =>
  jwt.sign({ userId, purpose: "password_reset" } satisfies ResetTokenPayload, env.jwt.accessSecret, {
    expiresIn: "10m",
  });

export const verifyResetToken = (token: string): ResetTokenPayload => {
  const payload = jwt.verify(token, env.jwt.accessSecret) as ResetTokenPayload;
  if (payload.purpose !== "password_reset") {
    throw new Error("Invalid token purpose");
  }
  return payload;
};

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
