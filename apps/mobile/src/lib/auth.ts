let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
}
