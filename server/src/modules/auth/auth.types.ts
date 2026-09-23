export interface LoginInput {
  identifier: string; // email or universityId
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    universityId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    mustResetPassword: boolean;
    profilePhoto: string | null;
  };
}
